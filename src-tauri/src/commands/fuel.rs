use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::db::DbState;
use crate::error::{AppError, Result};
use crate::models::energy_type::EnergyType;
use crate::models::fuel::{CreateFuelEntryInput, FuelEntry, UpdateFuelEntryInput};

#[tauri::command]
pub fn list_energy_types(state: State<DbState>) -> Result<Vec<EnergyType>> {
    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    let mut stmt = conn.prepare(
        "SELECT id, code, label, category, is_active, created_at, updated_at
         FROM energy_types
         WHERE is_active = 1
         ORDER BY
            CASE category
                WHEN 'petrol' THEN 1
                WHEN 'diesel' THEN 2
                WHEN 'gas_energy' THEN 3
                WHEN 'additive' THEN 4
                ELSE 99
            END,
            label ASC",
    )?;

    let energy_types = stmt
        .query_map([], |row| {
            Ok(EnergyType {
                id: row.get(0)?,
                code: row.get(1)?,
                label: row.get(2)?,
                category: row.get(3)?,
                is_active: row.get::<_, i64>(4)? != 0,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(energy_types)
}

#[tauri::command]
pub fn list_fuel_entries(state: State<DbState>) -> Result<Vec<FuelEntry>> {
    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    let mut stmt = conn.prepare(
        "SELECT f.id, f.vehicle_id, v.name, f.entry_date, f.mileage, f.liters,
                f.total_price_cents, f.price_per_liter_millis, f.energy_type_id,
                et.label, f.station, f.note, f.is_full_tank, f.created_at, f.updated_at
         FROM fuel_entries f
         INNER JOIN vehicles v ON v.id = f.vehicle_id
         INNER JOIN energy_types et ON et.id = f.energy_type_id
         ORDER BY f.entry_date DESC, f.created_at DESC",
    )?;

    let entries = stmt
        .query_map([], |row| {
            Ok(FuelEntry {
                id: row.get(0)?,
                vehicle_id: row.get(1)?,
                vehicle_name: row.get(2)?,
                entry_date: row.get(3)?,
                mileage: row.get(4)?,
                liters: row.get(5)?,
                total_price_cents: row.get(6)?,
                price_per_liter_millis: row.get(7)?,
                energy_type_id: row.get(8)?,
                energy_type_label: row.get(9)?,
                station: row.get(10)?,
                note: row.get(11)?,
                is_full_tank: row.get::<_, i64>(12)? != 0,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(entries)
}

#[tauri::command]
pub fn create_fuel_entry(state: State<DbState>, input: CreateFuelEntryInput) -> Result<FuelEntry> {
    validate_fuel_entry_input(
        &input.vehicle_id,
        &input.entry_date,
        input.mileage,
        input.liters,
        input.total_price_cents,
        input.price_per_liter_millis,
        &input.energy_type_id,
    )?;

    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    ensure_vehicle_is_active(&conn, &input.vehicle_id)?;
    ensure_energy_type_is_active(&conn, &input.energy_type_id)?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO fuel_entries
             (id, vehicle_id, entry_date, mileage, liters, total_price_cents,
              price_per_liter_millis, energy_type_id, station, note, is_full_tank,
              created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            id,
            input.vehicle_id,
            input.entry_date,
            input.mileage,
            input.liters,
            input.total_price_cents,
            input.price_per_liter_millis,
            input.energy_type_id.trim(),
            normalize_optional_text(input.station),
            normalize_optional_text(input.note),
            if input.is_full_tank { 1 } else { 0 },
            now,
            now,
        ],
    )?;

    get_fuel_entry_by_id(&conn, &id)
}

#[tauri::command]
pub fn update_fuel_entry(state: State<DbState>, input: UpdateFuelEntryInput) -> Result<FuelEntry> {
    if input.id.trim().is_empty() {
        return Err(AppError::msg("L'identifiant de l'entrée est obligatoire"));
    }

    validate_fuel_entry_input(
        &input.vehicle_id,
        &input.entry_date,
        input.mileage,
        input.liters,
        input.total_price_cents,
        input.price_per_liter_millis,
        &input.energy_type_id,
    )?;

    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    ensure_vehicle_is_active(&conn, &input.vehicle_id)?;
    ensure_energy_type_is_active(&conn, &input.energy_type_id)?;

    let now = chrono::Utc::now().to_rfc3339();

    let rows_affected = conn.execute(
        "UPDATE fuel_entries
         SET vehicle_id = ?1, entry_date = ?2, mileage = ?3, liters = ?4,
             total_price_cents = ?5, price_per_liter_millis = ?6, energy_type_id = ?7,
             station = ?8, note = ?9, is_full_tank = ?10, updated_at = ?11
         WHERE id = ?12",
        params![
            input.vehicle_id,
            input.entry_date,
            input.mileage,
            input.liters,
            input.total_price_cents,
            input.price_per_liter_millis,
            input.energy_type_id.trim(),
            normalize_optional_text(input.station),
            normalize_optional_text(input.note),
            if input.is_full_tank { 1 } else { 0 },
            now,
            input.id,
        ],
    )?;

    if rows_affected == 0 {
        return Err(AppError::msg("Entrée carburant introuvable"));
    }

    get_fuel_entry_by_id(&conn, &input.id)
}

#[tauri::command]
pub fn delete_fuel_entry(state: State<DbState>, id: String) -> Result<()> {
    if id.trim().is_empty() {
        return Err(AppError::msg("L'identifiant de l'entrée est obligatoire"));
    }

    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    let rows_affected = conn.execute("DELETE FROM fuel_entries WHERE id = ?1", [id])?;

    if rows_affected == 0 {
        return Err(AppError::msg("Entrée carburant introuvable"));
    }

    Ok(())
}

fn validate_fuel_entry_input(
    vehicle_id: &str,
    entry_date: &str,
    mileage: i64,
    liters: f64,
    total_price_cents: i64,
    price_per_liter_millis: i64,
    energy_type_id: &str,
) -> Result<()> {
    if vehicle_id.trim().is_empty() {
        return Err(AppError::msg("Le véhicule est obligatoire"));
    }

    if entry_date.trim().is_empty() {
        return Err(AppError::msg("La date est obligatoire"));
    }

    if mileage < 0 {
        return Err(AppError::msg("Le kilométrage doit être supérieur ou égal à 0"));
    }

    if liters <= 0.0 {
        return Err(AppError::msg("La quantité doit être supérieure à 0"));
    }

    if total_price_cents < 0 {
        return Err(AppError::msg("Le montant doit être supérieur ou égal à 0"));
    }

    if price_per_liter_millis < 0 {
        return Err(AppError::msg("Le prix au litre doit être supérieur ou égal à 0"));
    }

    if energy_type_id.trim().is_empty() {
        return Err(AppError::msg("L'énergie est obligatoire"));
    }

    Ok(())
}

fn ensure_vehicle_is_active(conn: &rusqlite::Connection, vehicle_id: &str) -> Result<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM vehicles WHERE id = ?1 AND is_archived = 0",
        [vehicle_id],
        |row| row.get(0),
    )?;

    if count == 0 {
        return Err(AppError::msg("Le véhicule sélectionné est introuvable ou archivé"));
    }

    Ok(())
}

fn ensure_energy_type_is_active(conn: &rusqlite::Connection, energy_type_id: &str) -> Result<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM energy_types WHERE id = ?1 AND is_active = 1",
        [energy_type_id],
        |row| row.get(0),
    )?;

    if count == 0 {
        return Err(AppError::msg("L'énergie sélectionnée est introuvable ou inactive"));
    }

    Ok(())
}

fn get_fuel_entry_by_id(conn: &rusqlite::Connection, id: &str) -> Result<FuelEntry> {
    let entry = conn.query_row(
        "SELECT f.id, f.vehicle_id, v.name, f.entry_date, f.mileage, f.liters,
                f.total_price_cents, f.price_per_liter_millis, f.energy_type_id,
                et.label, f.station, f.note, f.is_full_tank, f.created_at, f.updated_at
         FROM fuel_entries f
         INNER JOIN vehicles v ON v.id = f.vehicle_id
         INNER JOIN energy_types et ON et.id = f.energy_type_id
         WHERE f.id = ?1",
        [id],
        |row| {
            Ok(FuelEntry {
                id: row.get(0)?,
                vehicle_id: row.get(1)?,
                vehicle_name: row.get(2)?,
                entry_date: row.get(3)?,
                mileage: row.get(4)?,
                liters: row.get(5)?,
                total_price_cents: row.get(6)?,
                price_per_liter_millis: row.get(7)?,
                energy_type_id: row.get(8)?,
                energy_type_label: row.get(9)?,
                station: row.get(10)?,
                note: row.get(11)?,
                is_full_tank: row.get::<_, i64>(12)? != 0,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        },
    )?;

    Ok(entry)
}
fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|current| {
        let trimmed = current.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}
