-- Currency: NGN only (REVISED_SCOPE.md M2 / Phase 0a).
--
-- The application has been USD-denominated with an admin-editable FX rate
-- used to derive an NGN "equivalent" for display. That machinery existed
-- only to support international travel, which is out of scope for good
-- (todays-task.md: international allocations come from the ministry, not
-- this platform) — and it has a live, silent mispricing bug: HR typing
-- 60000 meaning ₦60,000 into a USD-typed field reports ₦90,000,000 at the
-- seeded 1500 rate. This migration removes the FX layer entirely and
-- re-seeds the remaining (domestic) reference rates in Naira.

-- ============================================================
-- Re-seed domestic rate_reference rows in Naira before route_type
-- disappears — same historical FX rate (1500) the app used for display,
-- applied once so the stored figures stop being three orders of magnitude
-- off the moment the FX conversion stops happening at read time.
-- ============================================================
UPDATE rate_reference
SET
  accommodation_rate = accommodation_rate * 1500,
  per_diem_rate = per_diem_rate * 1500,
  flight_estimate = flight_estimate * 1500,
  airport_taxi = airport_taxi * 1500
WHERE route_type = 'domestic';

-- International travel is out of scope and not coming back (todays-task.md,
-- REVISED_SCOPE.md decision 16). Delete those reference rows rather than
-- re-seed them in a currency the platform no longer prices in.
DELETE FROM rate_reference WHERE route_type = 'international';

ALTER TABLE rate_reference DROP COLUMN route_type;

-- travel_requests.locked_fx_rate has no meaning without an FX rate to lock.
ALTER TABLE travel_requests DROP COLUMN locked_fx_rate;

-- Retire the FX override setting itself.
DELETE FROM app_settings WHERE key = 'fx_rate_usd_ngn';
