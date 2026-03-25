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
    pub trip_distance_km: Option<i64>,
    pub consumption_l_per_100: Option<f64>,
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

#[derive(Debug, Deserialize)]
pub struct ImportFuelCsvInput {
    pub vehicle_id: String,
    pub csv_content: String,
}

#[derive(Debug, Serialize, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum FuelCsvPreviewStatus {
    Ok,
    Warning,
    Rejected,
}

#[derive(Debug, Serialize, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum FuelCsvPreviewAction {
    Create,
    Replace,
}

#[derive(Debug, Serialize)]
pub struct FuelCsvPreviewLine {
    pub line_number: usize,
    pub date: String,
    pub km: String,
    pub quantite: String,
    pub montant: String,
    pub prix_litre: String,
    pub lieu: String,
    pub plein: String,
    pub energie: String,
    pub observations: String,
    pub status: FuelCsvPreviewStatus,
    pub import_action: Option<FuelCsvPreviewAction>,
    pub messages: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct PreviewFuelCsvResult {
    pub total_rows: usize,
    pub valid_rows: usize,
    pub replacement_rows: usize,
    pub warning_rows: usize,
    pub rejected_rows: usize,
    pub lines: Vec<FuelCsvPreviewLine>,
}

#[derive(Debug, Serialize)]
pub struct ImportFuelCsvLineError {
    pub line_number: usize,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ImportFuelCsvResult {
    pub created_count: usize,
    pub replaced_count: usize,
    pub rejected_count: usize,
    pub recalculated_price_per_liter_count: usize,
    pub preferred_energy_fallback_count: usize,
    pub errors: Vec<ImportFuelCsvLineError>,
}
