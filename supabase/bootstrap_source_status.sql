-- Refresh provenance while retaining missing source observations.
create or replace function camera_bootstrap_private.ingest_batch(payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
    r jsonb; s jsonb; src bigint; camera bigint; applied integer:=0; linked integer:=0;
    cid text; cc text; kind text; conf text; state text; protected boolean;
begin
    if session_user not in ('postgres','camera_bootstrap','supabase_admin') then
        raise exception 'unauthorized bootstrap session';
    end if;
    if jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)>1000 then raise exception 'expected array of <=1000 records'; end if;
    for r in select value from jsonb_array_elements(payload) loop
        cid=r->>'canonical_id';cc=r->>'country_code';kind=r->>'camera_type';conf=lower(r->>'confidence');state=r->>'status';
        if cc !~ '^[A-Z]{2}$' or cid is null or kind not in ('fixed_speed','red_light','speed_and_red_light','average_speed_start','average_speed_end','average_speed_section','other_enforcement') or conf not in ('high','medium','low') or state not in ('active','candidate','review','missing_source') then raise exception 'invalid model'; end if;
        if (r->>'latitude')::float8 not between -90 and 90 or (r->>'longitude')::float8 not between -180 and 180 or ((r->>'latitude')::float8=0 and (r->>'longitude')::float8=0) then raise exception 'invalid coordinates'; end if;
        if r->>'speed_limit' is not null and (r->>'speed_limit')::int not between 5 and 200 then raise exception 'invalid speed';end if;
        select exists(select 1 from camera_backup_20261007.camera_records b where b.canonical_id=cid) into protected;
        if protected then
            select id into camera from public.camera_records where canonical_id=cid;
        else
            insert into public.camera_records(canonical_id,country_code,record_type,camera_type,latitude,longitude,end_latitude,end_longitude,speed_limit,direction_code,direction_name,road,locality,region,active,confidence,status,first_seen_at,last_seen_at,last_verified_at,updated_at,metadata)
            values(cid,cc,case kind when 'fixed_speed' then 'speed_camera' when 'red_light' then 'red_light' when 'speed_and_red_light' then 'red_light' when 'average_speed_section' then 'average_speed_section' else 'checkpoint' end,kind,
                (r->>'latitude')::float8,(r->>'longitude')::float8,(r->>'end_latitude')::float8,(r->>'end_longitude')::float8,
                (r->>'speed_limit')::int,r->>'direction',r->>'direction_raw',coalesce(r->>'road_ref',r->>'road_name'),r->>'city',r->>'region',
                state in ('active','missing_source') and conf in ('high','medium') and cc not in ('UA','PL'),conf,state,
                (r->>'first_seen_at')::timestamptz,(r->>'last_seen_at')::timestamptz,null,(r->>'updated_at')::timestamptz,
                (r-'camera_sources')||jsonb_build_object('provenance',coalesce((select jsonb_agg(v-'raw_payload') from jsonb_array_elements(r->'camera_sources') v),'[]'::jsonb)))
            on conflict(canonical_id) do update set
                latitude=excluded.latitude,longitude=excluded.longitude,end_latitude=excluded.end_latitude,end_longitude=excluded.end_longitude,
                speed_limit=excluded.speed_limit,direction_code=excluded.direction_code,direction_name=excluded.direction_name,
                road=excluded.road,locality=excluded.locality,region=excluded.region,active=excluded.active,confidence=excluded.confidence,
                camera_type=excluded.camera_type,record_type=excluded.record_type,status=excluded.status,
                last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at,metadata=excluded.metadata
            returning id into camera;
            applied:=applied+1;
        end if;
        for s in select value from jsonb_array_elements(r->'camera_sources') loop
            if s->>'source_id' is null or s->>'source_url' is null or s->>'license' is null then raise exception 'missing provenance';end if;
            insert into public.camera_sources(code,name,source_type,country_code,homepage_url,license_notes,priority)
            values(s->>'source_code',s->>'source_name',s->>'source_type',cc,s->>'source_url',s->>'license'||' | '||coalesce(s->>'license_url',''),case s->>'source_type' when 'official_government' then 10 else 30 end)
            on conflict(code) do update set license_notes=excluded.license_notes,updated_at=now() returning id into src;
            insert into public.camera_source_links(camera_record_id,source_id,external_id,source_updated_at,source_status,
                observed_latitude,observed_longitude,observed_end_latitude,observed_end_longitude,observed_speed_limit,observed_direction,raw_payload,last_seen_at)
            values(camera,src,s->>'source_id',(s->>'source_updated_at')::timestamptz,coalesce(s->>'source_status',state),
                (s->>'latitude')::float8,(s->>'longitude')::float8,(s->>'end_latitude')::float8,(s->>'end_longitude')::float8,(s->>'speed_limit')::int,
                coalesce(s->>'direction_raw',s->>'direction'),coalesce(s->'raw_payload','{}'::jsonb)||jsonb_build_object('_source',s-'raw_payload'),(s->>'retrieved_at')::timestamptz)
            on conflict(source_id,external_id) do update set camera_record_id=excluded.camera_record_id,
                source_updated_at=excluded.source_updated_at,source_status=excluded.source_status,
                observed_latitude=excluded.observed_latitude,observed_longitude=excluded.observed_longitude,
                observed_end_latitude=excluded.observed_end_latitude,observed_end_longitude=excluded.observed_end_longitude,
                observed_speed_limit=excluded.observed_speed_limit,observed_direction=excluded.observed_direction,
                raw_payload=excluded.raw_payload,last_seen_at=excluded.last_seen_at,updated_at=now();
            linked:=linked+1;
        end loop;
    end loop;
    return jsonb_build_object('applied',applied,'linked',linked);
end; $$;
revoke all on function camera_bootstrap_private.ingest_batch(jsonb) from public,anon,authenticated;
grant execute on function camera_bootstrap_private.ingest_batch(jsonb) to camera_bootstrap;
