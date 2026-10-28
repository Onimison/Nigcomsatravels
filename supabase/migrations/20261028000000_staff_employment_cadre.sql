-- Preserve the employment cadre from the nominal roll separately from the
-- designation used to resolve the DTA grade band.
ALTER TABLE staff
  ADD COLUMN cadre TEXT;

COMMENT ON COLUMN staff.cadre IS
  'Employment cadre from the staff nominal roll, for example Engineer or Finance. This is separate from designation_id, which drives DTA pricing.';
