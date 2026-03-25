use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct EnergyType {
    pub id: String,
    pub code: String,
    pub label: String,
    pub category: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}
