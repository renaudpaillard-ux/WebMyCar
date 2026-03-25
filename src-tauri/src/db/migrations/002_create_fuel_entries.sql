CREATE TABLE fuel_entries (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    mileage INTEGER NOT NULL,
    liters REAL NOT NULL,
    total_price_cents INTEGER NOT NULL,
    price_per_liter_cents INTEGER,
    energy_type TEXT NOT NULL,
    station TEXT,
    note TEXT,
    is_full_tank INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE INDEX idx_fuel_entries_vehicle_id ON fuel_entries(vehicle_id);
CREATE INDEX idx_fuel_entries_entry_date ON fuel_entries(entry_date);
