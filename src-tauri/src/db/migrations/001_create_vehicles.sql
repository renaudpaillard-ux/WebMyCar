CREATE TABLE vehicles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    version TEXT,
    registration TEXT,
    vin TEXT,
    fuel_type TEXT,
    engine_power_hp INTEGER,
    purchase_date TEXT,
    purchase_price_cents INTEGER,
    initial_mileage INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
