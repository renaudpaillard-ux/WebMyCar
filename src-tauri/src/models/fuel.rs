use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FuelEntry {
    pub id: String,
    pub vehicle_id: String,
    pub vehicle_name: String,
    pub entry_date: String,
    pub mileage: i64,
    pub liters: f64,
    pub total_price_cents: i64,
    pub price_per_liter_millis: Option<i64>,
    pub energy_type_id: String,
    pub energy_type_label: String,
    pub station: Option<String>,
    pub note: Option<String>,
    pub is_full_tank: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateFuelEntryInput {
    pub vehicle_id: String,
    pub entry_date: String,
    pub mileage: i64,
    pub liters: f64,
    pub total_price_cents: i64,
    pub price_per_liter_millis: i64,
    pub energy_type_id: String,
    pub station: Option<String>,
    pub note: Option<String>,
    pub is_full_tank: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFuelEntryInput {
    pub id: String,
    pub vehicle_id: String,
    pub entry_date: String,
    pub mileage: i64,
    pub liters: f64,
    pub total_price_cents: i64,
    pub price_per_liter_millis: i64,
    pub energy_type_id: String,
    pub station: Option<String>,
    pub note: Option<String>,
    pub is_full_tank: bool,
}
