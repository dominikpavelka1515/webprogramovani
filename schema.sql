-- ==============================================================================
-- Euro Truck Simulator 2 (ETS2) Logbook & Fleet Management Schema
-- RDBMS: SQLite (kompatibilní s SQLite 3.24+)
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- 1. TABULKA: trucks (Vozový park tahačů)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trucks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,                                       -- Značka (např. 'Scania', 'Volvo', 'MAN', 'DAF', 'Mercedes-Benz')
    model TEXT NOT NULL,                                       -- Model (např. 'S 730 V8', 'FH16 750', 'TGX Individual Lion')
    license_plate TEXT NOT NULL UNIQUE,                        -- SPZ/RZ tahače (např. '1AB 8899')
    tank_capacity_l REAL NOT NULL CHECK(tank_capacity_l > 0),  -- Objem nádrže v litrech (např. 1400)
    base_consumption_l_100km REAL NOT NULL CHECK(base_consumption_l_100km > 0), -- Základní průměrná spotřeba l/100km
    current_odometer_km REAL NOT NULL DEFAULT 0.0 CHECK(current_odometer_km >= 0), -- Stav tachometru
    notes TEXT,                                                -- Volitelná poznámka k výbavě / motorizaci
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)), -- 1 = v provozu, 0 = vyřazen/archivován
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. TABULKA: cargo_types (Kategorie / Typy nákladů)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cargo_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,                                 -- např. 'Standardní', 'Těžký náklad', 'Nebezpečný (ADR)', 'Chlazený'
    hazard_class TEXT DEFAULT NULL,                            -- např. 'ADR 1-9' nebo NULL
    is_fragile INTEGER NOT NULL DEFAULT 0 CHECK(is_fragile IN (0, 1)) -- 1 = Křehký náklad
);

-- ------------------------------------------------------------------------------
-- 3. TABULKA: trips (Logbook odjetých zakázek a tras)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    truck_id INTEGER NOT NULL,                                 -- Vazba na tahač
    origin_city TEXT NOT NULL,                                 -- Výchozí město (např. 'Praha')
    destination_city TEXT NOT NULL,                            -- Cílové město (např. 'Rotterdam')
    distance_km REAL NOT NULL CHECK(distance_km > 0),          -- Vzdálenost zakázky v km
    cargo_type_id INTEGER,                                     -- Cizí klíč na typ nákladu
    cargo_name TEXT NOT NULL,                                  -- Konkrétní náklad (např. 'Těžký bagr', 'Elektronika')
    cargo_weight_t REAL NOT NULL DEFAULT 0.0 CHECK(cargo_weight_t >= 0), -- Hmotnost nákladu v tunách
    revenue REAL NOT NULL CHECK(revenue >= 0),                 -- Výdělek / odměna ze zakázky (€ nebo Kč)
    diesel_price_per_l REAL NOT NULL CHECK(diesel_price_per_l > 0), -- Cena nafty za litr
    
    -- Vypočtené a denormalizované hodnoty pro zachování historické integrity
    effective_consumption_l_100km REAL NOT NULL,               -- Spotřeba se započtením tonáže
    fuel_consumed_l REAL NOT NULL,                             -- Celkem spáleno nafty (litry)
    fuel_cost REAL NOT NULL,                                   -- Celkové náklady na naftu
    net_profit REAL NOT NULL,                                  -- Čistý zisk (revenue - fuel_cost)
    
    -- Tachometr
    odometer_start_km REAL NOT NULL,                           -- Stav tachometru před zakázkou
    odometer_end_km REAL NOT NULL,                             -- Stav tachometru po dokončení zakázky
    
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,           -- Datum dokončení
    notes TEXT,                                                -- Poznámka k jízdě (poškození, pokuty, zážitky)
    
    FOREIGN KEY (truck_id) REFERENCES trucks(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (cargo_type_id) REFERENCES cargo_types(id) ON UPDATE CASCADE ON DELETE SET NULL
);

-- ------------------------------------------------------------------------------
-- Indexy pro optimalizaci agregací na dashboardu
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_trips_truck ON trips(truck_id);
CREATE INDEX IF NOT EXISTS idx_trips_completed ON trips(completed_at);
CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(origin_city, destination_city);
