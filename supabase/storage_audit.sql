-- Read-only. Run through an authorized privileged Supabase SQL connection.
-- Outputs aggregate sizes/counts/definitions only; never exports row contents.
with objects as (
 select c.oid,n.nspname,c.relname,c.relkind,c.reltoastrelid,
 pg_relation_size(c.oid) heap_bytes,pg_table_size(c.oid) data_bytes,
 pg_indexes_size(c.oid) index_bytes,pg_total_relation_size(c.oid) total_bytes,
 case when c.reltoastrelid=0 then 0 else pg_total_relation_size(c.reltoastrelid) end toast_bytes,
 (xpath('/row/n/text()',query_to_xml(format('select count(*) as n from %I.%I',n.nspname,c.relname),false,true,'')))[1]::text::bigint row_count
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind in ('r','m') and n.nspname not like 'pg_toast%' and n.nspname not like 'pg_temp%'
), indexes as (
 select n.nspname schema_name,c.relname index_name,t.relname table_name,pg_relation_size(c.oid) size_bytes,
 i.indisunique,i.indisprimary,pg_get_indexdef(c.oid) definition,coalesce(s.idx_scan,0) scans
 from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_index i on i.indexrelid=c.oid
 join pg_class t on t.oid=i.indrelid left join pg_stat_user_indexes s on s.indexrelid=c.oid
)
select jsonb_build_object('captured_at',now(),'database_bytes',pg_database_size(current_database()),
 'objects',(select jsonb_agg(to_jsonb(o)-'oid'-'reltoastrelid' order by total_bytes desc) from objects o),
 'indexes',(select jsonb_agg(to_jsonb(i) order by size_bytes desc) from indexes i),
 'views',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('v','m') and n.nspname not in ('pg_catalog','information_schema')))
 as audit;
