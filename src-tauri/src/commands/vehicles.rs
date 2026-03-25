use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::db::DbState;
use crate::error::{AppError, Result};
use crate::models::vehicle::{CreateVehicleInput, UpdateVehicleInput, Vehicle};

/// Return all non-archived vehicles ordered by creation date descending.
#[tauri::command]
pub fn list_vehicles(state: State<DbState>) -> Result<Vec<Vehicle>> {
    let conn = state.0.lock().map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    let mut stmt = conn.prepare(
        "SELECT id, name, brand, model, version, registration, vin, fuel_type,
                engine_power_hp, purchase_date, purchase_price_cents, initial_mileage,
                notes, is_archived, created_at, updated_at
         FROM vehicles
         WHERE is_archived = 0
         ORDER BY created_at DESC",
    )?;

    let vehicles = stmt
        .query_map([], |row| {
            Ok(Vehicle {
                id: row.get(0)?,
                name: row.get(1)?,
                brand: row.get(2)?,
                model: row.get(3)?,
                version: row.get(4)?,
                registration: row.get(5)?,
                vin: row.get(6)?,
                fuel_type: row.get(7)?,
                engine_power_hp: row.get(8)?,
                purchase_date: row.get(9)?,
                purchase_price_cents: row.get(10)?,
                initial_mileage: row.get(11)?,
                notes: row.get(12)?,
                is_archived: row.get::<_, i64>(13)? != 0,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(vehicles)
}

/// Create a new vehicle and return the persisted record.
#[tauri::command]
pub fn create_vehicle(state: State<DbState>, input: CreateVehicleInput) -> Result<Vehicle> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::msg("Le nom du véhicule est obligatoire"));
    }

    let conn = state.0.lock().map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let initial_mileage = input.initial_mileage.unwrap_or(0);

    conn.execute(
        "INSERT INTO vehicles
             (id, name, brand, model, registration, fuel_type, initial_mileage, is_archived, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9)",
        params![
            id,
            name,
            input.brand,
            input.model,
            input.registration,
            input.fuel_type,
            initial_mileage,
            now,
            now,
        ],
    )?;

    let vehicle = conn.query_row(
        "SELECT id, name, brand, model, version, registration, vin, fuel_type,
                engine_power_hp, purchase_date, purchase_price_cents, initial_mileage,
                notes, is_archived, created_at, updated_at
         FROM vehicles WHERE id = ?1",
        [&id],
        |row| {
            Ok(Vehicle {
                id: row.get(0)?,
                name: row.get(1)?,
                brand: row.get(2)?,
                model: row.get(3)?,
                version: row.get(4)?,
                registration: row.get(5)?,
                vin: row.get(6)?,
                fuel_type: row.get(7)?,
                engine_power_hp: row.get(8)?,
                purchase_date: row.get(9)?,
                purchase_price_cents: row.get(10)?,
                initial_mileage: row.get(11)?,
                notes: row.get(12)?,
                is_archived: row.get::<_, i64>(13)? != 0,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        },
    )?;

    Ok(vehicle)
}

/// Update an existing vehicle and return the updated record.
#[tauri::command]
pub fn update_vehicle(state: State<DbState>, input: UpdateVehicleInput) -> Result<Vehicle> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::msg("Le nom du véhicule est obligatoire"));
    }

    let conn = state.0.lock().map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    let now = chrono::Utc::now().to_rfc3339();
    let initial_mileage = input.initial_mileage.unwrap_or(0);

    let rows_affected = conn.execute(
        "UPDATE vehicles
         SET name = ?1, brand = ?2, model = ?3, registration = ?4,
             fuel_type = ?5, initial_mileage = ?6, updated_at = ?7
         WHERE id = ?8 AND is_archived = 0",
        params![
            name,
            input.brand,
            input.model,
            input.registration,
            input.fuel_type,
            initial_mileage,
            now,
            input.id,
        ],
    )?;

    if rows_affected == 0 {
        return Err(AppError::msg("Véhicule introuvable"));
    }

    let vehicle = conn.query_row(
        "SELECT id, name, brand, model, version, registration, vin, fuel_type,
                engine_power_hp, purchase_date, purchase_price_cents, initial_mileage,
                notes, is_archived, created_at, updated_at
         FROM vehicles WHERE id = ?1",
        [&input.id],
        |row| {
            Ok(Vehicle {
                id: row.get(0)?,
                name: row.get(1)?,
                brand: row.get(2)?,
                model: row.get(3)?,
                version: row.get(4)?,
                registration: row.get(5)?,
                vin: row.get(6)?,
                fuel_type: row.get(7)?,
                engine_power_hp: row.get(8)?,
                purchase_date: row.get(9)?,
                purchase_price_cents: row.get(10)?,
                initial_mileage: row.get(11)?,
                notes: row.get(12)?,
                is_archived: row.get::<_, i64>(13)? != 0,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        },
    )?;

    Ok(vehicle)
}
