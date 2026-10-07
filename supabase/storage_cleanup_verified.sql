-- Preconditions: all nine table snapshots restored with typed PostgreSQL columns.
-- Atomic cleanup; application coordinates/typed operational values are untouched.
lock table public.camera_records,public.camera_source_links in access exclusive mode;
do $$ begin
 if (select count(*) from public.camera_records)<>65134 or (select count(*) from public.camera_source_links)<>66168 or (select md5(string_agg(md5(row_to_json(r)::text),'' order by id)) from public.camera_records r)<>'7b8495478fba497faf8ca9db9e800dd3' then raise exception 'Live data changed since verified archive; abort';end if;
end; $$;
insert into camera_bootstrap_private.storage_control(id,normalized_manifest,archive_root,delivery_pending) values(1,'archive/v1/manifests/ad0fdd23638b244ba66173bb6836c9d2ad414b8330053950bee46194a3ce3148.json','archive/v1/manifests/08d542168690e1901e0d6bba0e2db396af9501661f43eda8fab5b60a658a2d9a.json',true);
insert into camera_bootstrap_private.archive_registry(root_key,observation_count,candidate_count,normalized_manifest) values('archive/v1/manifests/08d542168690e1901e0d6bba0e2db396af9501661f43eda8fab5b60a658a2d9a.json',66168,5864,'archive/v1/manifests/ad0fdd23638b244ba66173bb6836c9d2ad414b8330053950bee46194a3ce3148.json');
insert into camera_bootstrap_private.camera_moderation select canonical_id,country_code,status,confidence,'archive/v1/manifests/ad0fdd23638b244ba66173bb6836c9d2ad414b8330053950bee46194a3ce3148.json' from public.camera_records where not(active and confidence in ('high','medium'));
delete from public.camera_records where not(active and confidence in ('high','medium'));
update public.camera_records set metadata=jsonb_build_object('archive_ref','archive/v1/manifests/ad0fdd23638b244ba66173bb6836c9d2ad414b8330053950bee46194a3ce3148.json','source_codes',coalesce((select jsonb_agg(distinct s->>'source_code') from jsonb_array_elements(coalesce(metadata->'provenance','[]'::jsonb)) s),'[]'::jsonb),'source_count',jsonb_array_length(coalesce(metadata->'provenance','[]'::jsonb))) where country_code not in ('UA','PL');
-- Legacy metadata drives UA/PL mobile projections, so preserve those small payloads.
update public.camera_import_runs set report=jsonb_build_object('archive_ref','archive/v1/manifests/08d542168690e1901e0d6bba0e2db396af9501661f43eda8fab5b60a658a2d9a.json'),notes=left(notes,512);
drop table public.camera_source_links;
create or replace function camera_bootstrap_private.baseline_records() returns setof jsonb language sql stable security definer set search_path='' as $$ select to_jsonb(r) from public.camera_records r where country_code in ('UA','PL') order by id; $$;
drop table camera_backup_20261007.camera_source_links,camera_backup_20261007.camera_records,camera_backup_20261007.camera_import_runs,camera_backup_20261007.camera_sources;
drop schema camera_backup_20261007;
do $$ begin
 if (select count(*) from public.camera_records)<>59270 or (select count(*) from camera_bootstrap_private.camera_moderation)<>5864 then raise exception 'Operational cleanup count mismatch';end if;
end; $$;
