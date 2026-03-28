use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct VehicleSpec {
    pub id: String,
    pub vehicle_id: String,
    pub category: String,
    pub label: String,
    pub value: String,
    pub extra: Option<String>,
    pub order_index: i64,
}

#[derive(Debug, Deserialize)]
pub struct VehicleSpecInput {
    pub category: String,
    pub label: String,
    pub value: String,
    pub extra: Option<String>,
    pub order_index: i64,
}

#[derive(Debug, Deserialize)]
pub struct SaveVehicleSpecsInput {
    pub vehicle_id: String,
    pub specs: Vec<VehicleSpecInput>,
}
