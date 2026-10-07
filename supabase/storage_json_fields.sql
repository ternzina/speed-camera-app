-- Read-only exact aggregate sizes for every stored JSON/JSONB column.
-- Privileged aggregate access only; no raw JSON values returned.
select n.nspname schema_name,c.relname table_name,a.attname column_name,
 (xpath('/row/rows/text()',x))[1]::text::bigint rows,
 (xpath('/row/stored_value_bytes/text()',x))[1]::text::bigint stored_value_bytes,
 (xpath('/row/logical_json_bytes/text()',x))[1]::text::bigint logical_json_bytes,
 (xpath('/row/max_json_bytes/text()',x))[1]::text::bigint max_json_bytes
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 cross join lateral query_to_xml(format('select count(*) rows,coalesce(sum(pg_column_size(%I)),0) stored_value_bytes,coalesce(sum(octet_length(%I::text)),0) logical_json_bytes,coalesce(max(octet_length(%I::text)),0) max_json_bytes from %I.%I',a.attname,a.attname,a.attname,n.nspname,c.relname),false,true,'') x
 where c.relkind in ('r','m') and a.atttypid in ('json'::regtype,'jsonb'::regtype) and a.attnum>0 and not a.attisdropped and n.nspname not in ('pg_catalog','information_schema')
 order by stored_value_bytes desc;
