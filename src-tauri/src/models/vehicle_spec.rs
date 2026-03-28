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

#[derive(Debug, Serialize, Deserialize)]
pub struct VehicleSpecCategory {
    pub id: String,
    pub vehicle_id: String,
    pub name: String,
    pub order_index: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VehicleSpecSheet {
    pub categories: Vec<VehicleSpecCategory>,
    pub specs: Vec<VehicleSpec>,
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
pub struct VehicleSpecCategoryInput {
    pub name: String,
    pub order_index: i64,
}

#[derive(Debug, Deserialize)]
pub struct SaveVehicleSpecsInput {
    pub vehicle_id: String,
    pub specs: Vec<VehicleSpecInput>,
}

#[derive(Debug, Deserialize)]
pub struct SaveVehicleSpecSheetInput {
    pub vehicle_id: String,
    pub categories: Vec<VehicleSpecCategoryInput>,
    pub specs: Vec<VehicleSpecInput>,
}
