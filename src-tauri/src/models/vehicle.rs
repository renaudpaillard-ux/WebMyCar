use serde::{Deserialize, Serialize};

/// Full vehicle record returned by queries.
#[derive(Debug, Serialize, Deserialize)]
pub struct Vehicle {
    pub id: String,
    pub name: String,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub version: Option<String>,
    pub registration: Option<String>,
    pub vin: Option<String>,
    pub fuel_type: Option<String>,
    pub engine_power_hp: Option<i64>,
    pub purchase_date: Option<String>,
    pub purchase_price_cents: Option<i64>,
    pub initial_mileage: i64,
    pub notes: Option<String>,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// DTO for creating a new vehicle. Only the fields exposed in the V1 form.
#[derive(Debug, Deserialize)]
pub struct CreateVehicleInput {
    pub name: String,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub registration: Option<String>,
    pub fuel_type: Option<String>,
    pub initial_mileage: Option<i64>,
}

/// DTO for updating an existing vehicle.
#[derive(Debug, Deserialize)]
pub struct UpdateVehicleInput {
    pub id: String,
    pub name: String,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub registration: Option<String>,
    pub fuel_type: Option<String>,
    pub initial_mileage: Option<i64>,
}
