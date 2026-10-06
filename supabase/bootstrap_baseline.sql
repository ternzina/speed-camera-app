-- Read-only recovery of the original anchors for a fresh pipeline checkout.
-- The schema and function remain outside the public PostgREST schemas.
create or replace function camera_bootstrap_private.baseline_records()
returns setof jsonb language sql stable security definer set search_path='' as $$
    select to_jsonb(b) from camera_backup_20261007.camera_records b order by b.id;
$$;
revoke all on function camera_bootstrap_private.baseline_records() from public,anon,authenticated;
grant execute on function camera_bootstrap_private.baseline_records() to camera_bootstrap;
