ALTER TABLE vehicles ADD COLUMN powertrain_type TEXT;
ALTER TABLE vehicles ADD COLUMN preferred_energy_type_id TEXT REFERENCES energy_types(id);

UPDATE vehicles
SET powertrain_type = CASE lower(trim(fuel_type))
    WHEN 'essence' THEN 'petrol'
    WHEN 'diesel' THEN 'diesel'
    WHEN 'hybride' THEN 'hybrid'
    WHEN 'hybride rechargeable' THEN 'plug_in_hybrid'
    WHEN 'électrique' THEN 'electric'
    WHEN 'electrique' THEN 'electric'
    WHEN 'gpl' THEN 'lpg'
    WHEN 'autre' THEN 'other'
    ELSE NULL
END
WHERE powertrain_type IS NULL;

UPDATE vehicles
SET preferred_energy_type_id = CASE lower(trim(fuel_type))
    WHEN 'essence' THEN 'energy_type_petrol_e5'
    WHEN 'diesel' THEN 'energy_type_diesel'
    WHEN 'hybride' THEN 'energy_type_petrol_e5'
    WHEN 'hybride rechargeable' THEN 'energy_type_electric'
    WHEN 'électrique' THEN 'energy_type_electric'
    WHEN 'electrique' THEN 'energy_type_electric'
    WHEN 'gpl' THEN 'energy_type_lpg'
    WHEN 'autre' THEN 'energy_type_other'
    ELSE NULL
END
WHERE preferred_energy_type_id IS NULL;

CREATE TABLE vehicle_energy_types (
    vehicle_id TEXT NOT NULL,
    energy_type_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (vehicle_id, energy_type_id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (energy_type_id) REFERENCES energy_types(id)
);

INSERT OR IGNORE INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
SELECT id, 'energy_type_petrol_e5', datetime('now')
FROM vehicles
WHERE powertrain_type IN ('petrol', 'hybrid', 'plug_in_hybrid');

INSERT OR IGNORE INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
SELECT id, 'energy_type_petrol_sp98', datetime('now')
FROM vehicles
WHERE powertrain_type IN ('petrol', 'hybrid', 'plug_in_hybrid');

INSERT OR IGNORE INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
SELECT id, 'energy_type_petrol_e10', datetime('now')
FROM vehicles
WHERE powertrain_type IN ('petrol', 'hybrid', 'plug_in_hybrid');

INSERT OR IGNORE INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
SELECT id, 'energy_type_diesel', datetime('now')
FROM vehicles
WHERE powertrain_type = 'diesel';

INSERT OR IGNORE INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
SELECT id, 'energy_type_diesel_b10', datetime('now')
FROM vehicles
WHERE powertrain_type = 'diesel';

INSERT OR IGNORE INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
SELECT id, 'energy_type_diesel_xtl', datetime('now')
FROM vehicles
WHERE powertrain_type = 'diesel';

INSERT OR IGNORE INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
SELECT id, 'energy_type_electric', datetime('now')
FROM vehicles
WHERE powertrain_type IN ('electric', 'plug_in_hybrid');

INSERT OR IGNORE INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
SELECT id, 'energy_type_lpg', datetime('now')
FROM vehicles
WHERE powertrain_type = 'lpg';

INSERT OR IGNORE INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
SELECT id, 'energy_type_other', datetime('now')
FROM vehicles
WHERE powertrain_type = 'other';
