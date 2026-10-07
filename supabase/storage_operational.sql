-- Compact operational storage. Applied only after verified cold snapshots.
create table camera_bootstrap_private.storage_control(id integer primary key check(id=1),normalized_manifest text not null,archive_root text not null,updated_at timestamptz not null default now(),delivery_pending boolean not null default false);
create table camera_bootstrap_private.archive_registry(root_key text primary key,observation_count bigint not null,candidate_count bigint not null,normalized_manifest text not null,verified_at timestamptz not null default now());
create table camera_bootstrap_private.camera_moderation(canonical_id text primary key,country_code text not null,status text,confidence text,archive_ref text not null);
revoke all on camera_bootstrap_private.storage_control,camera_bootstrap_private.archive_registry,camera_bootstrap_private.camera_moderation from public,anon,authenticated;
grant select on camera_bootstrap_private.storage_control,camera_bootstrap_private.archive_registry,camera_bootstrap_private.camera_moderation to camera_bootstrap;
create or replace function camera_bootstrap_private.register_archive(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare current_key text;s jsonb;
begin
 if session_user not in ('postgres','supabase_admin','camera_bootstrap') then raise exception 'unauthorized';end if;
 select normalized_manifest into current_key from camera_bootstrap_private.storage_control where id=1 for update;
 if current_key is distinct from p->>'expected_manifest' then raise exception 'Concurrent import; rebuild master';end if;
 if coalesce(p->>'verified_readback','')<>'true' or coalesce(p#>>'{root,key}','') !~ '^archive/v1/manifests/[a-f0-9]{64}\.json$' or coalesce(p#>>'{normalized_master,key}','') !~ '^archive/v1/manifests/[a-f0-9]{64}\.json$' then raise exception 'verified immutable archive required';end if;
 if jsonb_array_length(coalesce(p->'source_catalog','[]'::jsonb))>1000 then raise exception 'source catalog exceeds bound';end if;
 for s in select value from jsonb_array_elements(coalesce(p->'source_catalog','[]'::jsonb)) loop
  if octet_length(s::text)>4096 or coalesce(s->>'source_url','') !~ '^https://' or coalesce(s->>'license','')='' then raise exception 'invalid source reference';end if;
  insert into public.camera_sources(code,name,source_type,country_code,homepage_url,license_notes,priority) values(s->>'source_code',s->>'source_name',s->>'source_type',s->>'country_code',s->>'source_url',(s->>'license')||' | '||coalesce(s->>'license_url',''),case s->>'source_type' when 'official_government' then 10 else 30 end) on conflict(code) do nothing;
 end loop;
 insert into camera_bootstrap_private.archive_registry(root_key,observation_count,candidate_count,normalized_manifest) values(p#>>'{root,key}',(p->>'observation_count')::bigint,(p->>'candidate_count')::bigint,p#>>'{normalized_master,key}') on conflict do nothing;
end; $$;
create or replace function camera_bootstrap_private.advance_archive(p text) returns void language plpgsql security definer set search_path='' as $$
begin
 if session_user not in ('postgres','supabase_admin','camera_bootstrap') or not exists(select 1 from camera_bootstrap_private.archive_registry where normalized_manifest=p and verified_at>=transaction_timestamp()) then raise exception 'verified registered archive required';end if;
 update camera_bootstrap_private.storage_control set normalized_manifest=p,updated_at=now() where id=1;
end; $$;
create or replace function camera_bootstrap_private.ingest_batch(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;kind text;conf text;state text;applied integer:=0; affected integer;
begin
 if session_user not in ('postgres','supabase_admin','camera_bootstrap') or jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)>1000 then raise exception 'unauthorized or invalid batch';end if;
 if not exists(select 1 from camera_bootstrap_private.archive_registry where verified_at>=transaction_timestamp()) then raise exception 'archive must be registered in this transaction first';end if;
 for r in select value from jsonb_array_elements(payload) loop
  kind=r->>'camera_type';conf=lower(r->>'confidence');state=r->>'status';
  if r ? 'camera_sources' or r ? 'provenance' or r ? 'raw_payload' or octet_length(r::text)>4096 or coalesce(r->>'archive_ref','') !~ '^archive/v1/objects/[a-f0-9]{64}\.jsonl.gz$' then raise exception 'cold storage pointer required; payloads forbidden';end if;
  if coalesce(conf,'') not in ('high','medium') or coalesce(state,'') not in ('active','missing_source') or coalesce(r->>'country_code','') !~ '^[A-Z]{2}$' or r->>'country_code' in ('UA','PL') or coalesce(kind,'') not in ('fixed_speed','red_light','speed_and_red_light','average_speed_start','average_speed_end','average_speed_section','other_enforcement') then raise exception 'unpublishable camera';end if;
  if (r->>'latitude')::float8 not between -90 and 90 or (r->>'longitude')::float8 not between -180 and 180 or ((r->>'latitude')::float8=0 and (r->>'longitude')::float8=0) then raise exception 'invalid coordinates';end if;
  if r->>'speed_limit' is not null and (r->>'speed_limit')::int not between 5 and 200 then raise exception 'invalid speed';end if;
  if r->>'direction' is not null and (r->>'direction')::float8 not between 0 and 359.999999999 then raise exception 'invalid direction';end if;
  if coalesce(jsonb_typeof(r->'source_codes'),'')<>'array' or jsonb_array_length(r->'source_codes')<1 or coalesce(r->>'source_count','0')::int<1 then raise exception 'source reference summary required';end if;
  if kind='average_speed_section' and (r->>'end_latitude' is null or r->>'end_longitude' is null or (r->>'end_latitude')::float8 not between -90 and 90 or (r->>'end_longitude')::float8 not between -180 and 180) then raise exception 'missing section endpoint';end if;
  insert into public.camera_records(canonical_id,country_code,record_type,camera_type,latitude,longitude,end_latitude,end_longitude,speed_limit,direction_code,direction_name,road,locality,region,active,confidence,status,first_seen_at,last_seen_at,updated_at,metadata)
  values(r->>'canonical_id',r->>'country_code',case kind when 'fixed_speed' then 'speed_camera' when 'red_light' then 'red_light' when 'speed_and_red_light' then 'red_light' when 'average_speed_section' then 'average_speed_section' else 'checkpoint' end,kind,(r->>'latitude')::float8,(r->>'longitude')::float8,(r->>'end_latitude')::float8,(r->>'end_longitude')::float8,(r->>'speed_limit')::int,r->>'direction',r->>'direction_raw',coalesce(r->>'road_ref',r->>'road_name'),r->>'city',r->>'region',true,conf,state,(r->>'first_seen_at')::timestamptz,(r->>'last_seen_at')::timestamptz,(r->>'updated_at')::timestamptz,jsonb_build_object('archive_ref',r->>'archive_ref','source_codes',r->'source_codes','source_count',r->'source_count')) on conflict(canonical_id) do nothing;
  get diagnostics affected=row_count;applied:=applied+affected;
 end loop;
 if applied>0 then update camera_bootstrap_private.storage_control set delivery_pending=true where id=1;end if;
 return jsonb_build_object('applied',applied,'linked',0);
end; $$;
revoke all on function camera_bootstrap_private.register_archive(jsonb),camera_bootstrap_private.advance_archive(text),camera_bootstrap_private.ingest_batch(jsonb) from public,anon,authenticated;
grant execute on function camera_bootstrap_private.register_archive(jsonb),camera_bootstrap_private.advance_archive(text),camera_bootstrap_private.ingest_batch(jsonb) to camera_bootstrap;

create or replace function camera_bootstrap_private.complete_delivery(expected_hash text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if session_user not in ('postgres','supabase_admin','camera_bootstrap') then raise exception 'unauthorized';end if;
 if (select md5(string_agg(md5(row_to_json(r)::text),'' order by id)) from public.camera_records r) is distinct from expected_hash then return false;end if;
 update camera_bootstrap_private.storage_control set delivery_pending=false where id=1;
 return true;
end; $$;
revoke all on function camera_bootstrap_private.complete_delivery(text) from public,anon,authenticated;
grant execute on function camera_bootstrap_private.complete_delivery(text) to camera_bootstrap;
