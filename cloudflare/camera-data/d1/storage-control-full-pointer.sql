-- Prepared pointer update for the test database camalert-operational
-- (65a68ee8-74ff-4429-9b0c-125df189018b).
--
-- This file has not been executed. It does not bind D1 to the production
-- Worker, does not change R2, and does not publish any camera.
-- Apply it only after a separate approval. The WHERE clause changes the row
-- only when it still points at the pinned fd4cede5 master and the trial count.

UPDATE storage_control
SET master_record_count = 123579,
    updated_at = '2026-10-19T10:07:34Z'
WHERE id = 1
  AND normalized_manifest = 'archive/v1/manifests/fd4cede54c8cd2e1d513d5ca05c0b520ddd13ccfc7ee0f02bf5ea8f000d9648b.json'
  AND archive_root = 'archive/v1/manifests/756b0aeda1c228f5c2d11864cd8776515d7717c4cf05761b7b1a131ca308d760.json'
  AND delivery_pending = 0
  AND master_decoded_sha256 = '5c1d560481035c7a4b8a5805ae50e9088c5ef6e23b092576b0015c21be713d39'
  AND master_record_count = 2944
  AND manifest_sha256 = '7824306f2409909985e482bf110b65bf6c21a3444a21716b55c7a081a9159f4b'
  AND manifest_generated_at = '2026-10-13T15:35:26.807485+00:00';
