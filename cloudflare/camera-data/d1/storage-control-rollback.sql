-- Prepared rollback for storage-control-full-pointer.sql.
-- Not executed. It restores the trial count only after that pointer update
-- has been applied, and only while the row still points at master fd4cede5.
-- It does not change cameras, R2, the production Worker, or Supabase.

UPDATE storage_control
SET master_record_count = 2944,
    updated_at = '2026-10-13T15:35:26.807485+00:00'
WHERE id = 1
  AND normalized_manifest = 'archive/v1/manifests/fd4cede54c8cd2e1d513d5ca05c0b520ddd13ccfc7ee0f02bf5ea8f000d9648b.json'
  AND archive_root = 'archive/v1/manifests/756b0aeda1c228f5c2d11864cd8776515d7717c4cf05761b7b1a131ca308d760.json'
  AND delivery_pending = 0
  AND master_decoded_sha256 = '5c1d560481035c7a4b8a5805ae50e9088c5ef6e23b092576b0015c21be713d39'
  AND master_record_count = 123579
  AND manifest_sha256 = '7824306f2409909985e482bf110b65bf6c21a3444a21716b55c7a081a9159f4b'
  AND manifest_generated_at = '2026-10-13T15:35:26.807485+00:00';
