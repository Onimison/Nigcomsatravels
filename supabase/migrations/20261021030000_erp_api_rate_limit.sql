-- Shared rate limiting for the machine-to-machine ERP API.

CREATE TABLE IF NOT EXISTS erp_api_rate_limit_buckets (
  subject_hash TEXT PRIMARY KEY CHECK (length(subject_hash) = 64),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE erp_api_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS erp_api_rate_limit_buckets_deny_client ON erp_api_rate_limit_buckets;
CREATE POLICY erp_api_rate_limit_buckets_deny_client
  ON erp_api_rate_limit_buckets
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION consume_erp_api_rate_limit(
  p_subject_hash TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bucket_row erp_api_rate_limit_buckets%ROWTYPE;
  window_ended_at TIMESTAMPTZ;
  retry_after_seconds INTEGER;
BEGIN
  IF p_subject_hash !~ '^[a-f0-9]{64}$'
     OR p_limit < 1
     OR p_limit > 100000
     OR p_window_seconds < 1
     OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid ERP rate-limit configuration' USING ERRCODE = '22023';
  END IF;

  INSERT INTO erp_api_rate_limit_buckets (subject_hash, window_started_at, request_count)
  VALUES (p_subject_hash, now(), 0)
  ON CONFLICT (subject_hash) DO NOTHING;

  SELECT * INTO bucket_row
  FROM erp_api_rate_limit_buckets
  WHERE subject_hash = p_subject_hash
  FOR UPDATE;

  window_ended_at := bucket_row.window_started_at + make_interval(secs => p_window_seconds);
  IF window_ended_at <= now() THEN
    UPDATE erp_api_rate_limit_buckets
    SET window_started_at = now(),
        request_count = 1,
        updated_at = now()
    WHERE subject_hash = p_subject_hash;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_limit - 1,
      'retry_after_seconds', 0
    );
  END IF;

  IF bucket_row.request_count >= p_limit THEN
    retry_after_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_ended_at - now())))::INTEGER);
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', retry_after_seconds
    );
  END IF;

  UPDATE erp_api_rate_limit_buckets
  SET request_count = bucket_row.request_count + 1,
      updated_at = now()
  WHERE subject_hash = p_subject_hash;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - bucket_row.request_count - 1,
    'retry_after_seconds', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION consume_erp_api_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_erp_api_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
