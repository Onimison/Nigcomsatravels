-- Supabase commonly installs pgcrypto in the extensions schema. The ERP
-- finalization function hashes the immutable payload with digest(), so its
-- SECURITY DEFINER search path must include that schema.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER FUNCTION finalize_hr_review_v2(
  UUID,
  UUID,
  INTEGER,
  NUMERIC,
  JSONB,
  JSONB,
  TEXT,
  JSONB,
  TEXT,
  TEXT,
  JSONB
) SET search_path = public, extensions;

ALTER FUNCTION finalize_hr_costing_standalone_v1(
  UUID,
  UUID,
  INTEGER,
  NUMERIC,
  JSONB,
  JSONB,
  TEXT,
  JSONB,
  TEXT,
  TEXT,
  JSONB
) SET search_path = public, extensions;
