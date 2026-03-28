CREATE TABLE vehicle_spec_categories (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE UNIQUE INDEX idx_vehicle_spec_categories_vehicle_name
    ON vehicle_spec_categories(vehicle_id, name);
CREATE INDEX idx_vehicle_spec_categories_vehicle_order
    ON vehicle_spec_categories(vehicle_id, order_index, name);

INSERT INTO vehicle_spec_categories (id, vehicle_id, name, order_index)
SELECT
    lower(hex(randomblob(16))),
    source.vehicle_id,
    source.category,
    ROW_NUMBER() OVER (
        PARTITION BY source.vehicle_id
        ORDER BY source.category COLLATE NOCASE ASC
    ) - 1
FROM (
    SELECT DISTINCT vehicle_id, category
    FROM vehicle_specs
    WHERE trim(category) <> ''
) AS source;
