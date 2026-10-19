-- Prepared import_runs correction for camalert-operational
-- (65a68ee8-74ff-4429-9b0c-125df189018b).
--
-- This file has not been executed. storage_control and this row are separate.
-- Updating storage_control.master_record_count does not change import_runs,
-- because its primary key is the master checksum and the load SQL uses
-- ON CONFLICT DO NOTHING. A later import with that same checksum keeps the
-- trial result unless this guarded UPDATE is applied on its own approval.

UPDATE import_runs
SET camera_count = 123579,
    published_count = 114794,
    unpublished_count = 8785,
    source_count = 218,
    moderation_count = 8785,
    delivery_alias_count = 1329,
    render_projection_count = 68,
    registry_count = 53,
    result = 'full_load_verified',
    finished_at = '2026-10-19T10:07:34Z'
WHERE master_decoded_sha256 = '5c1d560481035c7a4b8a5805ae50e9088c5ef6e23b092576b0015c21be713d39'
  AND manifest_sha256 = '7824306f2409909985e482bf110b65bf6c21a3444a21716b55c7a081a9159f4b'
  AND result = 'ua_pl_trial'
  AND camera_count = 2944
  AND published_count = 1329
  AND unpublished_count = 1615
  AND source_count = 6
  AND moderation_count = 1615
  AND delivery_alias_count = 1329
  AND render_projection_count = 68
  AND registry_count = 1;
