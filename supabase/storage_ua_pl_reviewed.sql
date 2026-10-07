-- Explicitly reviewed UA/PL intake; generic global imports remain blocked.
CREATE OR REPLACE FUNCTION camera_bootstrap_private.ingest_batch(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;kind text;conf text;state text;applied integer:=0; affected integer;
begin
 if session_user not in ('postgres','supabase_admin','camera_bootstrap') or jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)>1000 then raise exception 'unauthorized or invalid batch';end if;
 if not exists(select 1 from camera_bootstrap_private.archive_registry where verified_at>=transaction_timestamp()) then raise exception 'archive must be registered in this transaction first';end if;
 for r in select value from jsonb_array_elements(payload) loop
  kind=r->>'camera_type';conf=lower(r->>'confidence');state=r->>'status';
  if r ? 'camera_sources' or r ? 'provenance' or r ? 'raw_payload' or octet_length(r::text)>4096 or coalesce(r->>'archive_ref','') !~ '^archive/v1/objects/[a-f0-9]{64}\.jsonl.gz$' then raise exception 'cold storage pointer required; payloads forbidden';end if;
  if coalesce(conf,'') not in ('high','medium') or coalesce(state,'') not in ('active','missing_source') or coalesce(r->>'country_code','') !~ '^[A-Z]{2}$' or (r->>'country_code' in ('UA','PL') and (coalesce(r->>'publication_review','')<>'ua_pl_official_v1' or (r->>'country_code'='UA' and ((r->>'source_count')::int<2 or not (r->'source_codes' ? 'UA_NPU_CURRENT'))) or (r->>'country_code'='PL' and not (r->'source_codes' ? 'PL_CANARD_CURRENT')))) or coalesce(kind,'') not in ('fixed_speed','red_light','speed_and_red_light','average_speed_start','average_speed_end','average_speed_section','other_enforcement') then raise exception 'unpublishable camera';end if;
  if (r->>'latitude')::float8 not between -90 and 90 or (r->>'longitude')::float8 not between -180 and 180 or ((r->>'latitude')::float8=0 and (r->>'longitude')::float8=0) then raise exception 'invalid coordinates';end if;
  if r->>'speed_limit' is not null and (r->>'speed_limit')::int not between 5 and 200 then raise exception 'invalid speed';end if;
  if r->>'direction' is not null and (r->>'direction')::float8 not between 0 and 359.999999999 then raise exception 'invalid direction';end if;
  if coalesce(jsonb_typeof(r->'source_codes'),'')<>'array' or jsonb_array_length(r->'source_codes')<1 or coalesce(r->>'source_count','0')::int<1 then raise exception 'source reference summary required';end if;
  if kind='average_speed_section' and (r->>'end_latitude' is null or r->>'end_longitude' is null or (r->>'end_latitude')::float8 not between -90 and 90 or (r->>'end_longitude')::float8 not between -180 and 180) then raise exception 'missing section endpoint';end if;
  if r ? 'delivery' and (jsonb_typeof(r->'delivery')<>'object' or (r->'delivery') - array['id','type','camera_type','latitude','longitude','speed_limit','direction','direction_code','location','road','road_index','region','name','start','end','base_id'] <> '{}'::jsonb) then raise exception 'invalid operational projection';end if;
  insert into public.camera_records(canonical_id,country_code,record_type,camera_type,latitude,longitude,end_latitude,end_longitude,speed_limit,direction_code,direction_name,road,locality,region,active,confidence,status,first_seen_at,last_seen_at,updated_at,metadata)
  values(r->>'canonical_id',r->>'country_code',case kind when 'fixed_speed' then 'speed_camera' when 'red_light' then 'red_light' when 'speed_and_red_light' then 'red_light' when 'average_speed_section' then 'average_speed_section' else 'checkpoint' end,kind,(r->>'latitude')::float8,(r->>'longitude')::float8,(r->>'end_latitude')::float8,(r->>'end_longitude')::float8,(r->>'speed_limit')::int,r->>'direction',r->>'direction_raw',coalesce(r->>'road_ref',r->>'road_name'),r->>'city',r->>'region',true,conf,state,(r->>'first_seen_at')::timestamptz,(r->>'last_seen_at')::timestamptz,(r->>'updated_at')::timestamptz,jsonb_build_object('archive_ref',r->>'archive_ref','source_codes',r->'source_codes','source_count',r->'source_count') || coalesce(r->'delivery','{}'::jsonb)) on conflict(canonical_id) do nothing;
  get diagnostics affected=row_count;applied:=applied+affected;
 end loop;
 if applied>0 then update camera_bootstrap_private.storage_control set delivery_pending=true where id=1;end if;
 return jsonb_build_object('applied',applied,'linked',0);
end; $function$;

revoke all on function camera_bootstrap_private.ingest_batch(jsonb) from public,anon,authenticated;
grant execute on function camera_bootstrap_private.ingest_batch(jsonb) to camera_bootstrap;
