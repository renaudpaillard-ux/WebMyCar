use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurrentDatabaseInfo {
    pub path: String,
    pub file_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MenuActionPayload {
    pub action: String,
    pub path: Option<String>,
}
