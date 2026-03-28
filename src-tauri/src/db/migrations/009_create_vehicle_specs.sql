CREATE TABLE vehicle_specs (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    extra TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

CREATE INDEX idx_vehicle_specs_vehicle_id ON vehicle_specs(vehicle_id);
CREATE INDEX idx_vehicle_specs_vehicle_category_order
    ON vehicle_specs(vehicle_id, category, order_index, label);
