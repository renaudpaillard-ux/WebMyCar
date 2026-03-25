UPDATE energy_types
SET code = id || '_legacy',
    is_active = 0,
    updated_at = datetime('now')
WHERE id IN (
    'energy_type_petrol_e10',
    'energy_type_petrol_e5',
    'energy_type_petrol_sp98',
    'energy_type_petrol_e85',
    'energy_type_diesel',
    'energy_type_diesel_b10',
    'energy_type_diesel_xtl',
    'energy_type_lpg',
    'energy_type_electric',
    'energy_type_adblue',
    'energy_type_other'
);

INSERT INTO energy_types (id, code, label, category, is_active, created_at, updated_at) VALUES
    ('petrol_e10', 'petrol_e10', 'SP95-E10 (E10)', 'petrol', 1, datetime('now'), datetime('now')),
    ('petrol_e5_95', 'petrol_e5_95', 'SP95 (E5)', 'petrol', 1, datetime('now'), datetime('now')),
    ('petrol_e5_98', 'petrol_e5_98', 'SP98 (E5)', 'petrol', 1, datetime('now'), datetime('now')),
    ('petrol_e85', 'petrol_e85', 'Superéthanol (E85)', 'petrol', 1, datetime('now'), datetime('now')),
    ('diesel_b7', 'diesel_b7', 'Gazole classique (B7)', 'diesel', 1, datetime('now'), datetime('now')),
    ('diesel_b10', 'diesel_b10', 'Gazole B10 (B10)', 'diesel', 1, datetime('now'), datetime('now')),
    ('diesel_xtl', 'diesel_xtl', 'Diesel renouvelable (XTL / HVO100)', 'diesel', 1, datetime('now'), datetime('now')),
    ('lpg', 'lpg', 'GPL (LPG)', 'gas_energy', 1, datetime('now'), datetime('now')),
    ('electric', 'electric', 'Recharge électrique', 'gas_energy', 1, datetime('now'), datetime('now')),
    ('adblue', 'adblue', 'AdBlue (additif diesel)', 'additive', 1, datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
    label = excluded.label,
    category = excluded.category,
    is_active = excluded.is_active,
    updated_at = datetime('now');

UPDATE fuel_entries
SET energy_type_id = CASE energy_type_id
    WHEN 'energy_type_petrol_e10' THEN 'petrol_e10'
    WHEN 'energy_type_petrol_e5' THEN 'petrol_e5_95'
    WHEN 'energy_type_petrol_sp98' THEN 'petrol_e5_98'
    WHEN 'energy_type_petrol_e85' THEN 'petrol_e85'
    WHEN 'energy_type_diesel' THEN 'diesel_b7'
    WHEN 'energy_type_diesel_b10' THEN 'diesel_b10'
    WHEN 'energy_type_diesel_xtl' THEN 'diesel_xtl'
    WHEN 'energy_type_lpg' THEN 'lpg'
    WHEN 'energy_type_electric' THEN 'electric'
    WHEN 'energy_type_adblue' THEN 'adblue'
    ELSE energy_type_id
END
WHERE energy_type_id IN (
    'energy_type_petrol_e10',
    'energy_type_petrol_e5',
    'energy_type_petrol_sp98',
    'energy_type_petrol_e85',
    'energy_type_diesel',
    'energy_type_diesel_b10',
    'energy_type_diesel_xtl',
    'energy_type_lpg',
    'energy_type_electric',
    'energy_type_adblue'
);

UPDATE vehicles
SET preferred_energy_type_id = CASE preferred_energy_type_id
    WHEN 'energy_type_petrol_e10' THEN 'petrol_e10'
    WHEN 'energy_type_petrol_e5' THEN 'petrol_e5_95'
    WHEN 'energy_type_petrol_sp98' THEN 'petrol_e5_98'
    WHEN 'energy_type_petrol_e85' THEN 'petrol_e85'
    WHEN 'energy_type_diesel' THEN 'diesel_b7'
    WHEN 'energy_type_diesel_b10' THEN 'diesel_b10'
    WHEN 'energy_type_diesel_xtl' THEN 'diesel_xtl'
    WHEN 'energy_type_lpg' THEN 'lpg'
    WHEN 'energy_type_electric' THEN 'electric'
    WHEN 'energy_type_adblue' THEN 'adblue'
    ELSE preferred_energy_type_id
END
WHERE preferred_energy_type_id IN (
    'energy_type_petrol_e10',
    'energy_type_petrol_e5',
    'energy_type_petrol_sp98',
    'energy_type_petrol_e85',
    'energy_type_diesel',
    'energy_type_diesel_b10',
    'energy_type_diesel_xtl',
    'energy_type_lpg',
    'energy_type_electric',
    'energy_type_adblue'
);

UPDATE vehicle_energy_types
SET energy_type_id = CASE energy_type_id
    WHEN 'energy_type_petrol_e10' THEN 'petrol_e10'
    WHEN 'energy_type_petrol_e5' THEN 'petrol_e5_95'
    WHEN 'energy_type_petrol_sp98' THEN 'petrol_e5_98'
    WHEN 'energy_type_petrol_e85' THEN 'petrol_e85'
    WHEN 'energy_type_diesel' THEN 'diesel_b7'
    WHEN 'energy_type_diesel_b10' THEN 'diesel_b10'
    WHEN 'energy_type_diesel_xtl' THEN 'diesel_xtl'
    WHEN 'energy_type_lpg' THEN 'lpg'
    WHEN 'energy_type_electric' THEN 'electric'
    WHEN 'energy_type_adblue' THEN 'adblue'
    ELSE energy_type_id
END
WHERE energy_type_id IN (
    'energy_type_petrol_e10',
    'energy_type_petrol_e5',
    'energy_type_petrol_sp98',
    'energy_type_petrol_e85',
    'energy_type_diesel',
    'energy_type_diesel_b10',
    'energy_type_diesel_xtl',
    'energy_type_lpg',
    'energy_type_electric',
    'energy_type_adblue'
);
