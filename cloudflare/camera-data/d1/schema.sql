-- Operational CamAlert mirror for Cloudflare D1.
-- SQLite-compatible. Apply locally first. Do not attach this file to the
-- production Worker and do not create a remote D1 database from it until the
-- account check in the import report is confirmed.
--
-- The pinned snapshot is the local normalized master of 123579 canonical rows:
-- 114794 published (active or missing_source, high or medium confidence) and
-- 8785 unpublished. The 443 prepared points from 15 October 2026 are not part
-- of this schema load.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cameras (
  canonical_id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL CHECK (country_code GLOB '[A-Z][A-Z]'),
  camera_type TEXT NOT NULL CHECK (camera_type IN (
    'fixed_speed','red_light','speed_and_red_light','average_speed_start',
    'average_speed_end','average_speed_section','other_enforcement')),
  status TEXT NOT NULL CHECK (status IN ('active','candidate','review','missing_source')),
  confidence TEXT NOT NULL CHECK (lower(confidence) IN ('high','medium','low')),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  end_latitude REAL CHECK (end_latitude IS NULL OR end_latitude BETWEEN -90 AND 90),
  end_longitude REAL CHECK (end_longitude IS NULL OR end_longitude BETWEEN -180 AND 180),
  speed_limit INTEGER CHECK (speed_limit IS NULL OR speed_limit BETWEEN 5 AND 200),
  direction REAL CHECK (direction IS NULL OR (direction >= 0 AND direction < 360)),
  direction_raw TEXT,
  road_ref TEXT,
  road_name TEXT,
  city TEXT,
  region TEXT,
  publication_review TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  updated_at TEXT,
  source_codes TEXT NOT NULL CHECK (json_valid(source_codes)),
  source_count INTEGER NOT NULL CHECK (source_count >= 0),
  published INTEGER NOT NULL CHECK (published IN (0,1)),
  lat_cell INTEGER NOT NULL,
  lon_cell INTEGER NOT NULL,
  chunk_key TEXT NOT NULL,
  row_sha256 TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cameras_country_status ON cameras(country_code, status);
CREATE INDEX IF NOT EXISTS idx_cameras_published_country ON cameras(country_code) WHERE published = 1;
CREATE INDEX IF NOT EXISTS idx_cameras_spatial_grid ON cameras(country_code, lat_cell, lon_cell);

-- Delivery ids are the ids in the public country export. For 120 countries the
-- delivery id is the canonical id and is not duplicated here. Ukraine and
-- Poland keep every delivery id, including ids that differ from canonical_id.
-- Poland's 68 red-light sites are render projections, not additional cameras.
-- Fifteen of those site ids (pl-red-001 through pl-red-015) have no canonical
-- camera. canonical_key stores '' for that case so a repeat import conflicts
-- instead of inserting another NULL primary-key row.
CREATE TABLE IF NOT EXISTS camera_export_ids (
  country_code TEXT NOT NULL CHECK (country_code IN ('UA','PL')),
  export_group TEXT NOT NULL,
  export_id TEXT NOT NULL,
  canonical_id TEXT REFERENCES cameras(canonical_id) ON DELETE CASCADE,
  canonical_key TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('delivery','render_projection')),
  base_id TEXT,
  PRIMARY KEY (country_code, export_group, export_id, canonical_key),
  CHECK (canonical_key = ifnull(canonical_id, '')),
  CHECK (role = 'render_projection' OR canonical_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_export_lookup ON camera_export_ids(country_code, export_id);

CREATE TABLE IF NOT EXISTS sources (
  source_code TEXT PRIMARY KEY,
  source_name TEXT,
  source_type TEXT,
  country_code TEXT,
  source_url TEXT,
  license TEXT,
  license_url TEXT,
  manifest_license TEXT,
  in_public_manifest INTEGER NOT NULL CHECK (in_public_manifest IN (0,1))
);

-- Compact index of the 8785 unpublished master rows. Full fields stay on cameras.
CREATE TABLE IF NOT EXISTS camera_moderation (
  canonical_id TEXT PRIMARY KEY REFERENCES cameras(canonical_id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence TEXT NOT NULL,
  archive_ref TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_country ON camera_moderation(country_code, status);

CREATE TABLE IF NOT EXISTS storage_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  normalized_manifest TEXT NOT NULL,
  archive_root TEXT NOT NULL,
  delivery_pending INTEGER NOT NULL CHECK (delivery_pending IN (0,1)),
  master_decoded_sha256 TEXT NOT NULL,
  master_record_count INTEGER NOT NULL CHECK (master_record_count >= 0),
  manifest_sha256 TEXT NOT NULL,
  manifest_generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archive_registry (
  root_key TEXT PRIMARY KEY,
  created_at TEXT,
  batch TEXT,
  observation_count INTEGER,
  candidate_count INTEGER,
  normalized_manifest TEXT NOT NULL,
  verified_readback INTEGER NOT NULL CHECK (verified_readback IN (0,1))
);

CREATE TABLE IF NOT EXISTS import_runs (
  master_decoded_sha256 TEXT PRIMARY KEY,
  manifest_sha256 TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  camera_count INTEGER NOT NULL,
  published_count INTEGER NOT NULL,
  unpublished_count INTEGER NOT NULL,
  source_count INTEGER NOT NULL,
  moderation_count INTEGER NOT NULL,
  delivery_alias_count INTEGER NOT NULL,
  render_projection_count INTEGER NOT NULL,
  registry_count INTEGER NOT NULL,
  result TEXT NOT NULL
);
