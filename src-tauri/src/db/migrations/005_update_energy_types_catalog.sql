INSERT INTO energy_types (id, code, label, category, is_active, created_at, updated_at) VALUES
    ('energy_type_diesel', 'diesel_b7', 'Gazole classique (B7)', 'diesel', 1, datetime('now'), datetime('now')),
    ('energy_type_petrol_e5', 'petrol_sp95', 'SP95 (E5)', 'petrol', 1, datetime('now'), datetime('now')),
    ('energy_type_petrol_e10', 'petrol_e10', 'SP95-E10 (E10)', 'petrol', 1, datetime('now'), datetime('now')),
    ('energy_type_petrol_e85', 'petrol_e85', 'Superéthanol (E85)', 'petrol', 1, datetime('now'), datetime('now')),
    ('energy_type_electric', 'electric_charge', 'Recharge électrique', 'electric', 1, datetime('now'), datetime('now')),
    ('energy_type_lpg', 'lpg', 'GPL (LPG)', 'gas', 1, datetime('now'), datetime('now')),
    ('energy_type_other', 'other', 'Autre', 'additive', 1, datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
    code = excluded.code,
    label = excluded.label,
    category = excluded.category,
    is_active = excluded.is_active,
    updated_at = datetime('now');

INSERT INTO energy_types (id, code, label, category, is_active, created_at, updated_at) VALUES
    ('energy_type_petrol_sp98', 'petrol_sp98', 'SP98 (E5)', 'petrol', 1, datetime('now'), datetime('now')),
    ('energy_type_diesel_b10', 'diesel_b10', 'Gazole B10 (B10)', 'diesel', 1, datetime('now'), datetime('now')),
    ('energy_type_diesel_xtl', 'diesel_xtl', 'Diesel renouvelable (XTL / HVO100)', 'diesel', 1, datetime('now'), datetime('now')),
    ('energy_type_adblue', 'adblue', 'AdBlue', 'additive', 1, datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
    code = excluded.code,
    label = excluded.label,
    category = excluded.category,
    is_active = excluded.is_active,
    updated_at = datetime('now');
