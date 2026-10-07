-- Additive, private read-only export API. No table/data deletion in this phase.
create or replace function camera_bootstrap_private.archive_page(table_name text, page_offset integer default 0, page_size integer default 1000)
returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if session_user not in ('postgres','supabase_admin','camera_bootstrap') then raise exception 'unauthorized archive session'; end if;
 if table_name not in ('public.camera_records','public.camera_source_links','public.camera_sources','public.camera_import_runs','public.camera_import_staging','camera_backup_20261007.camera_records','camera_backup_20261007.camera_source_links','camera_backup_20261007.camera_sources','camera_backup_20261007.camera_import_runs') or page_offset<0 or page_size not between 1 and 1000 then raise exception 'invalid archive scope'; end if;
 return query execute format('select to_jsonb(r) from %I.%I r order by %s offset $1 limit $2',split_part(table_name,'.',1),split_part(table_name,'.',2),case when table_name='public.camera_import_staging' then 'batch_id,chunk_no' else 'id' end) using page_offset,page_size;
end; $$;
revoke all on function camera_bootstrap_private.archive_page(text,integer,integer) from public,anon,authenticated;
grant execute on function camera_bootstrap_private.archive_page(text,integer,integer) to camera_bootstrap;
