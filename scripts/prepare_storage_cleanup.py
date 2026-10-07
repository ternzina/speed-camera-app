#!/usr/bin/env python3
"""Generate guarded cleanup SQL only after remote archive and typed restore proof."""
import json
from r2_archive import ROOT,read_dataset
p=json.loads((ROOT/'master-db/backups/storage-architecture/prepared.json').read_text())
assert all(v.get('typed_postgres_restore') and v['exact_full_row_restoration'] for v in p['restore_proof'].values())
# Recheck existence and checksum of each immutable manifest before generating SQL.
list(read_dataset(p['canonical_snapshot'],refresh=True))
key=p['normalized_master']['key'];root=p['root_ref']['key']
sql=f"""-- Preconditions: all nine table snapshots restored with typed PostgreSQL columns.
-- Atomic cleanup; application coordinates/typed operational values are untouched.
lock table public.camera_records,public.camera_source_links in access exclusive mode;
do $$ begin
 if (select count(*) from public.camera_records)<>65134 or (select count(*) from public.camera_source_links)<>66168 or (select md5(string_agg(md5(row_to_json(r)::text),'' order by id)) from public.camera_records r)<>'7b8495478fba497faf8ca9db9e800dd3' then raise exception 'Live data changed since verified archive; abort';end if;
end; $$;
insert into camera_bootstrap_private.storage_control(id,normalized_manifest,archive_root,delivery_pending) values(1,'{key}','{root}',true);
insert into camera_bootstrap_private.archive_registry(root_key,observation_count,candidate_count,normalized_manifest) values('{root}',66168,5864,'{key}');
insert into camera_bootstrap_private.camera_moderation select canonical_id,country_code,status,confidence,'{key}' from public.camera_records where not(active and confidence in ('high','medium'));
delete from public.camera_records where not(active and confidence in ('high','medium'));
update public.camera_records set metadata=jsonb_build_object('archive_ref','{key}','source_codes',coalesce((select jsonb_agg(distinct s->>'source_code') from jsonb_array_elements(coalesce(metadata->'provenance','[]'::jsonb)) s),'[]'::jsonb),'source_count',jsonb_array_length(coalesce(metadata->'provenance','[]'::jsonb))) where country_code not in ('UA','PL');
-- Legacy metadata drives UA/PL mobile projections, so preserve those small payloads.
update public.camera_import_runs set report=jsonb_build_object('archive_ref','{root}'),notes=left(notes,512);
drop table public.camera_source_links;
create or replace function camera_bootstrap_private.baseline_records() returns setof jsonb language sql stable security definer set search_path='' as $$ select to_jsonb(r) from public.camera_records r where country_code in ('UA','PL') order by id; $$;
drop table camera_backup_20261007.camera_source_links,camera_backup_20261007.camera_records,camera_backup_20261007.camera_import_runs,camera_backup_20261007.camera_sources;
drop schema camera_backup_20261007;
do $$ begin
 if (select count(*) from public.camera_records)<>59270 or (select count(*) from camera_bootstrap_private.camera_moderation)<>5864 then raise exception 'Operational cleanup count mismatch';end if;
end; $$;
"""
(ROOT/'supabase/storage_cleanup_verified.sql').write_text(sql)
print('Guarded cleanup prepared; not executed')
