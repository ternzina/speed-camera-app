-- Run each statement outside a transaction after verified archival cleanup.
-- Reclaims old heap/index allocation without changing operational values.
VACUUM (FULL, ANALYZE) public.camera_records;
VACUUM (FULL, ANALYZE) public.camera_sources;
