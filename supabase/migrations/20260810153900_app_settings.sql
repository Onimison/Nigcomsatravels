-- App Settings — generic key/value config store.
-- PRD Section 3.4: "FX Rate Override — Manual override for the daily
-- exchange rate used on new international requests."

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read (HR needs the current FX rate too when
-- pricing international requests), only admin can write (PRD Section 3.4).
CREATE POLICY "Authenticated users can read settings" ON app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin full access app_settings" ON app_settings
  FOR ALL USING (current_staff_role() = 'admin');

-- Seed a starting FX rate so the system has a baseline value.
INSERT INTO app_settings (key, value)
VALUES ('fx_rate_usd_ngn', '1500.00')
ON CONFLICT (key) DO NOTHING;