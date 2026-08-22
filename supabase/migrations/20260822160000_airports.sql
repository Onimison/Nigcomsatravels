-- Airports reference table — prerequisite for any flight-price work.
--
-- Today `travel_requests.destination` and `.origin` are free text (see
-- 20260731144738_initial_schema.sql), and Admin types destinations by hand
-- into rate-management.tsx. That is fine for a human reading a queue and
-- fatal for anything that has to key off a route: "Lagos", "lagos" and
-- "Lagos State" are three different destinations to a machine, and no
-- flight API takes a city name typed by a person.
--
-- This adds the controlled vocabulary. It is deliberately ADDITIVE: the
-- existing TEXT columns stay authoritative and untouched, and the new FK
-- columns are nullable. Nothing downstream breaks, and the backfill below
-- resolves the seeded demo data automatically. Swapping the TEXT columns
-- out entirely is a follow-up — it has to move rate_reference's
-- UNIQUE(destination, level_id, mode) constraint with it, which is a real
-- breaking change and does not belong in the same migration as this one.
--
-- Note `route_type` here is GENERATED, not entered. rate_reference.route_type
-- (added in 20260820120000) is a hand-picked dropdown value, which means two
-- rows for the same city can disagree about whether it is domestic. Deriving
-- it from country_code makes that class of bug unrepresentable.

CREATE TABLE airports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iata_code CHAR(3) NOT NULL UNIQUE,
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  -- Domestic == inside Nigeria. Derived, never entered.
  route_type TEXT GENERATED ALWAYS AS (
    CASE WHEN country_code = 'NG' THEN 'domestic' ELSE 'international' END
  ) STORED,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE airports IS
  'Controlled vocabulary for trip origins/destinations. One row per city — see the seed note about multi-airport cities before adding a second.';
COMMENT ON COLUMN airports.route_type IS
  'Generated from country_code. Unlike rate_reference.route_type this cannot drift, because nothing can write it.';

CREATE INDEX idx_airports_city_lower ON airports (lower(city));
CREATE INDEX idx_airports_route_type ON airports (route_type) WHERE active;

-- ============================================================
-- Seed
-- ============================================================
-- Exactly one airport per city, on purpose: the backfill at the bottom of
-- this migration matches free-text destinations on city name, and a second
-- row for the same city would make that match ambiguous. When a multi-airport
-- city is genuinely needed (London Gatwick alongside Heathrow, say), add it
-- *and* give the backfill a tie-breaker at the same time.

-- Nigeria — domestic network
INSERT INTO airports (iata_code, city, name, country_code) VALUES
  ('ABV', 'Abuja',         'Nnamdi Azikiwe International Airport',        'NG'),
  ('LOS', 'Lagos',         'Murtala Muhammed International Airport',      'NG'),
  ('PHC', 'Port Harcourt', 'Port Harcourt International Airport',         'NG'),
  ('KAN', 'Kano',          'Mallam Aminu Kano International Airport',     'NG'),
  ('ENU', 'Enugu',         'Akanu Ibiam International Airport',           'NG'),
  ('QOW', 'Owerri',        'Sam Mbakwe International Cargo Airport',      'NG'),
  ('CBQ', 'Calabar',       'Margaret Ekpo International Airport',         'NG'),
  ('QUO', 'Uyo',           'Victor Attah International Airport',          'NG'),
  ('BNI', 'Benin City',    'Benin Airport',                               'NG'),
  ('ABB', 'Asaba',         'Asaba International Airport',                 'NG'),
  ('WAR', 'Warri',         'Warri Airport',                               'NG'),
  ('ILR', 'Ilorin',        'Ilorin International Airport',                'NG'),
  ('KAD', 'Kaduna',        'Kaduna International Airport',                'NG'),
  ('JOS', 'Jos',           'Yakubu Gowon Airport',                        'NG'),
  ('SKO', 'Sokoto',        'Sadiq Abubakar III International Airport',    'NG'),
  ('MIU', 'Maiduguri',     'Maiduguri International Airport',             'NG'),
  ('YOL', 'Yola',          'Yola Airport',                                'NG'),
  ('AKR', 'Akure',         'Akure Airport',                               'NG'),
  ('GMO', 'Gombe',         'Gombe Lawanti International Airport',         'NG'),
  ('BCU', 'Bauchi',        'Sir Abubakar Tafawa Balewa Airport',          'NG')
ON CONFLICT (iata_code) DO NOTHING;

-- International — regional hubs, plus the destinations that actually recur
-- for a satellite/telecom parastatal: Geneva (ITU), Vienna (UNOOSA), and the
-- Chinese hubs (CGWIC, the NigComSat-1R programme partner).
INSERT INTO airports (iata_code, city, name, country_code) VALUES
  ('ACC', 'Accra',         'Kotoka International Airport',                'GH'),
  ('ADD', 'Addis Ababa',   'Addis Ababa Bole International Airport',      'ET'),
  ('NBO', 'Nairobi',       'Jomo Kenyatta International Airport',         'KE'),
  ('JNB', 'Johannesburg',  'O. R. Tambo International Airport',           'ZA'),
  ('CAI', 'Cairo',         'Cairo International Airport',                 'EG'),
  ('DXB', 'Dubai',         'Dubai International Airport',                 'AE'),
  ('DOH', 'Doha',          'Hamad International Airport',                 'QA'),
  ('IST', 'Istanbul',      'Istanbul Airport',                            'TR'),
  ('LHR', 'London',        'Heathrow Airport',                            'GB'),
  ('CDG', 'Paris',         'Charles de Gaulle Airport',                   'FR'),
  ('FRA', 'Frankfurt',     'Frankfurt Airport',                           'DE'),
  ('AMS', 'Amsterdam',     'Amsterdam Airport Schiphol',                  'NL'),
  ('BRU', 'Brussels',      'Brussels Airport',                            'BE'),
  ('GVA', 'Geneva',        'Geneva Airport',                              'CH'),
  ('VIE', 'Vienna',        'Vienna International Airport',                'AT'),
  ('FCO', 'Rome',          'Leonardo da Vinci–Fiumicino Airport',         'IT'),
  ('MAD', 'Madrid',        'Adolfo Suárez Madrid–Barajas Airport',        'ES'),
  ('JFK', 'New York',      'John F. Kennedy International Airport',       'US'),
  -- 'Washington DC', not 'Washington': rate_reference is seeded with that
  -- exact string (20260820130000_demo_travel_policy.sql) and the pre-submit
  -- estimate matches destination text with ILIKE. A city name here that
  -- doesn't match there silently returns "no reference rate found".
  ('IAD', 'Washington DC', 'Washington Dulles International Airport',     'US'),
  ('PEK', 'Beijing',       'Beijing Capital International Airport',       'CN'),
  ('PVG', 'Shanghai',      'Shanghai Pudong International Airport',       'CN'),
  ('DEL', 'New Delhi',     'Indira Gandhi International Airport',         'IN')
ON CONFLICT (iata_code) DO NOTHING;

-- ============================================================
-- travel_requests → airports
-- ============================================================
-- Nullable on purpose. Road trips may have no airport at either end, and
-- historical rows may name a city that isn't in the seed. Consumers must
-- treat a null as "no route key available" and degrade, not throw.
-- Constraint names are explicit because two FKs point at the same table and
-- PostgREST needs a disambiguator to embed both in one select.

ALTER TABLE travel_requests
  ADD COLUMN origin_airport_id UUID,
  ADD COLUMN destination_airport_id UUID,
  ADD CONSTRAINT travel_requests_origin_airport_fkey
    FOREIGN KEY (origin_airport_id) REFERENCES airports(id) ON DELETE RESTRICT,
  ADD CONSTRAINT travel_requests_destination_airport_fkey
    FOREIGN KEY (destination_airport_id) REFERENCES airports(id) ON DELETE RESTRICT;

CREATE INDEX idx_travel_requests_origin_airport ON travel_requests (origin_airport_id);
CREATE INDEX idx_travel_requests_destination_airport ON travel_requests (destination_airport_id);

-- Backfill from the existing free text. Case- and whitespace-insensitive
-- exact match on city only — no fuzzy matching, because a wrong airport is
-- worse than a null (a null degrades to "look it up yourself", a wrong one
-- quietly prices the wrong route).
UPDATE travel_requests tr
SET destination_airport_id = a.id
FROM airports a
WHERE tr.destination_airport_id IS NULL
  AND lower(btrim(tr.destination)) = lower(a.city);

UPDATE travel_requests tr
SET origin_airport_id = a.id
FROM airports a
WHERE tr.origin_airport_id IS NULL
  AND tr.origin IS NOT NULL
  AND lower(btrim(tr.origin)) = lower(a.city);

-- ============================================================
-- RLS
-- ============================================================
-- Same shape as levels/departments in 20260822140000: a reference table
-- every authenticated role reads and only Admin writes. Enabling RLS
-- without policies is a deny-all — that is the exact bug 20260822140000
-- was written to clean up, so both policies go in with the ENABLE.

ALTER TABLE airports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read airports" ON airports
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin full access airports" ON airports
  FOR ALL USING (current_staff_role() = 'admin');
