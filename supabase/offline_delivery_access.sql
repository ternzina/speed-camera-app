-- PREPARED ONLY. Apply at the protected-delivery cutover, never while the collector uses the legacy export.
-- No record/source mutation or storage migration. camera_bootstrap privileges remain intact.
begin;
revoke all on public.camera_records, public.camera_sources from public, anon, authenticated;
-- The legacy read policies would permit scraping again if grants were restored accidentally.
drop policy if exists "Public read active camera records" on public.camera_records;
drop policy if exists "Public read camera sources" on public.camera_sources;
-- Metadata coverage remains readable, but has no coordinates or full country datasets.
commit;
-- Expected: false / false; verify camera_bootstrap retains its own SELECT privileges before cutover.
select has_table_privilege('anon','public.camera_records','SELECT') as anon_records,
       has_table_privilege('authenticated','public.camera_records','SELECT') as authenticated_records,
       has_table_privilege('camera_bootstrap','public.camera_records','SELECT') as collector_read;
