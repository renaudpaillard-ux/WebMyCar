PRAGMA foreign_keys = OFF;

CREATE TABLE energy_types (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO energy_types (id, code, label, category, is_active, created_at, updated_at) VALUES
    ('energy_type_diesel', 'diesel_b7', 'Gazole classique (B7)', 'diesel', 1, datetime('now'), datetime('now')),
    ('energy_type_diesel_b10', 'diesel_b10', 'Gazole B10 (B10)', 'diesel', 1, datetime('now'), datetime('now')),
    ('energy_type_diesel_xtl', 'diesel_xtl', 'Diesel renouvelable (XTL / HVO100)', 'diesel', 1, datetime('now'), datetime('now')),
    ('energy_type_petrol_e5', 'petrol_sp95', 'SP95 (E5)', 'petrol', 1, datetime('now'), datetime('now')),
    ('energy_type_petrol_sp98', 'petrol_sp98', 'SP98 (E5)', 'petrol', 1, datetime('now'), datetime('now')),
    ('energy_type_petrol_e10', 'petrol_e10', 'SP95-E10 (E10)', 'petrol', 1, datetime('now'), datetime('now')),
    ('energy_type_petrol_e85', 'petrol_e85', 'Superéthanol (E85)', 'petrol', 1, datetime('now'), datetime('now')),
    ('energy_type_electric', 'electric_charge', 'Recharge électrique', 'electric', 1, datetime('now'), datetime('now')),
    ('energy_type_lpg', 'lpg', 'GPL (LPG)', 'gas', 1, datetime('now'), datetime('now')),
    ('energy_type_adblue', 'adblue', 'AdBlue', 'additive', 1, datetime('now'), datetime('now')),
    ('energy_type_other', 'other', 'Autre', 'additive', 1, datetime('now'), datetime('now'));

ALTER TABLE fuel_entries RENAME TO fuel_entries_legacy;

CREATE TABLE fuel_entries (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    mileage INTEGER NOT NULL,
    liters REAL NOT NULL,
    total_price_cents INTEGER NOT NULL,
    price_per_liter_cents INTEGER,
    energy_type_id TEXT NOT NULL,
    station TEXT,
    note TEXT,
    is_full_tank INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (energy_type_id) REFERENCES energy_types(id)
);

INSERT INTO fuel_entries (
    id,
    vehicle_id,
    entry_date,
    mileage,
    liters,
    total_price_cents,
    price_per_liter_cents,
    energy_type_id,
    station,
    note,
    is_full_tank,
    created_at,
    updated_at
)
SELECT
    f.id,
    f.vehicle_id,
    f.entry_date,
    f.mileage,
    f.liters,
    f.total_price_cents,
    f.price_per_liter_cents,
    CASE
        WHEN lower(trim(f.energy_type)) = 'diesel' THEN 'energy_type_diesel'
        WHEN lower(trim(f.energy_type)) = 'petrol_e5' THEN 'energy_type_petrol_e5'
        WHEN lower(trim(f.energy_type)) = 'petrol_e10' THEN 'energy_type_petrol_e10'
        WHEN lower(trim(f.energy_type)) = 'petrol_e85' THEN 'energy_type_petrol_e85'
        WHEN lower(trim(f.energy_type)) = 'electric' THEN 'energy_type_electric'
        WHEN lower(trim(f.energy_type)) IN ('lpg', 'gpl') THEN 'energy_type_lpg'
        ELSE 'energy_type_other'
    END,
    f.station,
    f.note,
    f.is_full_tank,
    CASE
        WHEN f.created_at IS NULL OR trim(f.created_at) = '' THEN datetime('now')
        ELSE f.created_at
    END,
    CASE
        WHEN f.updated_at IS NULL OR trim(f.updated_at) = '' THEN datetime('now')
        ELSE f.updated_at
    END
FROM fuel_entries_legacy f;

DROP TABLE fuel_entries_legacy;

CREATE INDEX idx_fuel_entries_vehicle_id ON fuel_entries(vehicle_id);
CREATE INDEX idx_fuel_entries_entry_date ON fuel_entries(entry_date);
CREATE INDEX idx_fuel_entries_energy_type_id ON fuel_entries(energy_type_id);

PRAGMA foreign_keys = ON;
