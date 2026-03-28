use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::db::DbState;
use crate::error::{AppError, Result};
use crate::models::vehicle::{CreateVehicleInput, UpdateVehicleInput, Vehicle};
use crate::models::vehicle_spec::{SaveVehicleSpecsInput, VehicleSpec, VehicleSpecInput};

#[tauri::command]
pub fn list_vehicles(state: State<DbState>, include_archived: bool) -> Result<Vec<Vehicle>> {
    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    let sql = if include_archived {
        "SELECT id, name, brand, model, version, registration, vin, powertrain_type,
                preferred_energy_type_id, engine_power_hp, purchase_date, purchase_price_cents,
                initial_mileage, notes, is_archived, created_at, updated_at
         FROM vehicles
         ORDER BY is_archived ASC, created_at DESC"
    } else {
        "SELECT id, name, brand, model, version, registration, vin, powertrain_type,
                preferred_energy_type_id, engine_power_hp, purchase_date, purchase_price_cents,
                initial_mileage, notes, is_archived, created_at, updated_at
         FROM vehicles
         WHERE is_archived = 0
         ORDER BY created_at DESC"
    };

    let mut stmt = conn.prepare(sql)?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<i64>>(9)?,
                row.get::<_, Option<String>>(10)?,
                row.get::<_, Option<i64>>(11)?,
                row.get::<_, i64>(12)?,
                row.get::<_, Option<String>>(13)?,
                row.get::<_, i64>(14)? != 0,
                row.get::<_, String>(15)?,
                row.get::<_, String>(16)?,
            ))
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    let mut vehicles = Vec::with_capacity(rows.len());
    for row in rows {
        vehicles.push(Vehicle {
            id: row.0.clone(),
            name: row.1,
            brand: row.2,
            model: row.3,
            version: row.4,
            registration: row.5,
            vin: row.6,
            powertrain_type: row.7,
            preferred_energy_type_id: row.8,
            compatible_energy_type_ids: load_vehicle_energy_type_ids(&conn, &row.0)?,
            engine_power_hp: row.9,
            purchase_date: row.10,
            purchase_price_cents: row.11,
            initial_mileage: row.12,
            notes: row.13,
            is_archived: row.14,
            created_at: row.15,
            updated_at: row.16,
        });
    }

    Ok(vehicles)
}

#[tauri::command]
pub fn create_vehicle(state: State<DbState>, input: CreateVehicleInput) -> Result<Vehicle> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::msg("Le nom du véhicule est obligatoire"));
    }

    let powertrain_type = normalize_required_text(input.powertrain_type, "La motorisation est obligatoire")?;
    let compatible_energy_type_ids = normalize_energy_type_ids(input.compatible_energy_type_ids);
    let preferred_energy_type_id = normalize_optional_text(input.preferred_energy_type_id);

    validate_vehicle_energy_selection(
        &compatible_energy_type_ids,
        preferred_energy_type_id.as_deref(),
    )?;

    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    ensure_energy_types_are_active(&conn, &compatible_energy_type_ids)?;
    ensure_preferred_energy_is_active(&conn, preferred_energy_type_id.as_deref())?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let initial_mileage = input.initial_mileage.unwrap_or(0);

    conn.execute(
        "INSERT INTO vehicles
             (id, name, brand, model, registration, powertrain_type, preferred_energy_type_id,
              initial_mileage, is_archived, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?10)",
        params![
            id,
            name,
            normalize_optional_text(input.brand),
            normalize_optional_text(input.model),
            normalize_optional_text(input.registration),
            powertrain_type,
            preferred_energy_type_id,
            initial_mileage,
            now,
            now,
        ],
    )?;

    replace_vehicle_energy_types(&conn, &id, &compatible_energy_type_ids, &now)?;
    get_vehicle_by_id(&conn, &id)
}

#[tauri::command]
pub fn update_vehicle(state: State<DbState>, input: UpdateVehicleInput) -> Result<Vehicle> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::msg("Le nom du véhicule est obligatoire"));
    }

    let powertrain_type = normalize_required_text(input.powertrain_type, "La motorisation est obligatoire")?;
    let compatible_energy_type_ids = normalize_energy_type_ids(input.compatible_energy_type_ids);
    let preferred_energy_type_id = normalize_optional_text(input.preferred_energy_type_id);

    validate_vehicle_energy_selection(
        &compatible_energy_type_ids,
        preferred_energy_type_id.as_deref(),
    )?;

    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    ensure_energy_types_are_active(&conn, &compatible_energy_type_ids)?;
    ensure_preferred_energy_is_active(&conn, preferred_energy_type_id.as_deref())?;

    let now = chrono::Utc::now().to_rfc3339();
    let initial_mileage = input.initial_mileage.unwrap_or(0);

    let rows_affected = conn.execute(
        "UPDATE vehicles
         SET name = ?1, brand = ?2, model = ?3, registration = ?4,
             powertrain_type = ?5, preferred_energy_type_id = ?6, initial_mileage = ?7, updated_at = ?8
         WHERE id = ?9 AND is_archived = 0",
        params![
            name,
            normalize_optional_text(input.brand),
            normalize_optional_text(input.model),
            normalize_optional_text(input.registration),
            powertrain_type,
            preferred_energy_type_id,
            initial_mileage,
            now,
            input.id,
        ],
    )?;

    if rows_affected == 0 {
        return Err(AppError::msg("Véhicule introuvable"));
    }

    replace_vehicle_energy_types(&conn, &input.id, &compatible_energy_type_ids, &now)?;
    get_vehicle_by_id(&conn, &input.id)
}

#[tauri::command]
pub fn archive_vehicle(state: State<DbState>, id: String) -> Result<()> {
    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    let now = chrono::Utc::now().to_rfc3339();

    let rows_affected = conn.execute(
        "UPDATE vehicles SET is_archived = 1, updated_at = ?1 WHERE id = ?2 AND is_archived = 0",
        params![now, id],
    )?;

    if rows_affected == 0 {
        return Err(AppError::msg("Véhicule introuvable ou déjà archivé"));
    }

    Ok(())
}

#[tauri::command]
pub fn unarchive_vehicle(state: State<DbState>, id: String) -> Result<()> {
    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    let now = chrono::Utc::now().to_rfc3339();

    let rows_affected = conn.execute(
        "UPDATE vehicles SET is_archived = 0, updated_at = ?1 WHERE id = ?2 AND is_archived = 1",
        params![now, id],
    )?;

    if rows_affected == 0 {
        return Err(AppError::msg("Véhicule introuvable ou déjà actif"));
    }

    Ok(())
}

#[tauri::command]
pub fn list_vehicle_specs(state: State<DbState>, vehicle_id: String) -> Result<Vec<VehicleSpec>> {
    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    ensure_vehicle_exists(&conn, &vehicle_id)?;
    list_vehicle_specs_for_vehicle(&conn, &vehicle_id)
}

#[tauri::command]
pub fn save_vehicle_specs(state: State<DbState>, input: SaveVehicleSpecsInput) -> Result<Vec<VehicleSpec>> {
    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    ensure_vehicle_exists(&conn, &input.vehicle_id)?;
    replace_vehicle_specs(&conn, &input.vehicle_id, input.specs)?;
    list_vehicle_specs_for_vehicle(&conn, &input.vehicle_id)
}

fn get_vehicle_by_id(conn: &rusqlite::Connection, id: &str) -> Result<Vehicle> {
    let row = conn.query_row(
        "SELECT id, name, brand, model, version, registration, vin, powertrain_type,
                preferred_energy_type_id, engine_power_hp, purchase_date, purchase_price_cents,
                initial_mileage, notes, is_archived, created_at, updated_at
         FROM vehicles
         WHERE id = ?1",
        [id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, Option<String>>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<i64>>(9)?,
                row.get::<_, Option<String>>(10)?,
                row.get::<_, Option<i64>>(11)?,
                row.get::<_, i64>(12)?,
                row.get::<_, Option<String>>(13)?,
                row.get::<_, i64>(14)? != 0,
                row.get::<_, String>(15)?,
                row.get::<_, String>(16)?,
            ))
        },
    )?;

    Ok(Vehicle {
        id: row.0.clone(),
        name: row.1,
        brand: row.2,
        model: row.3,
        version: row.4,
        registration: row.5,
        vin: row.6,
        powertrain_type: row.7,
        preferred_energy_type_id: row.8,
        compatible_energy_type_ids: load_vehicle_energy_type_ids(conn, &row.0)?,
        engine_power_hp: row.9,
        purchase_date: row.10,
        purchase_price_cents: row.11,
        initial_mileage: row.12,
        notes: row.13,
        is_archived: row.14,
        created_at: row.15,
        updated_at: row.16,
    })
}

fn load_vehicle_energy_type_ids(conn: &rusqlite::Connection, vehicle_id: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT energy_type_id
         FROM vehicle_energy_types
         WHERE vehicle_id = ?1
         ORDER BY created_at ASC, energy_type_id ASC",
    )?;

    let ids = stmt
        .query_map([vehicle_id], |row| row.get::<_, String>(0))?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(ids)
}

fn list_vehicle_specs_for_vehicle(conn: &rusqlite::Connection, vehicle_id: &str) -> Result<Vec<VehicleSpec>> {
    let mut stmt = conn.prepare(
        "SELECT id, vehicle_id, category, label, value, extra, order_index
         FROM vehicle_specs
         WHERE vehicle_id = ?1
         ORDER BY category COLLATE NOCASE ASC, order_index ASC, label COLLATE NOCASE ASC",
    )?;

    let specs = stmt
        .query_map([vehicle_id], |row| {
            Ok(VehicleSpec {
                id: row.get(0)?,
                vehicle_id: row.get(1)?,
                category: row.get(2)?,
                label: row.get(3)?,
                value: row.get(4)?,
                extra: row.get(5)?,
                order_index: row.get(6)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(specs)
}

fn replace_vehicle_specs(
    conn: &rusqlite::Connection,
    vehicle_id: &str,
    specs: Vec<VehicleSpecInput>,
) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM vehicle_specs WHERE vehicle_id = ?1", [vehicle_id])?;

    for spec in specs {
        let category = normalize_spec_category(spec.category);
        let label = normalize_spec_required_text(spec.label, "Le libellé d'une spécification est obligatoire")?;
        let value = normalize_spec_required_text(spec.value, "La valeur d'une spécification est obligatoire")?;
        let extra = normalize_optional_text(spec.extra);

        tx.execute(
            "INSERT INTO vehicle_specs (id, vehicle_id, category, label, value, extra, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                Uuid::new_v4().to_string(),
                vehicle_id,
                category,
                label,
                value,
                extra,
                spec.order_index,
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}

fn replace_vehicle_energy_types(
    conn: &rusqlite::Connection,
    vehicle_id: &str,
    energy_type_ids: &[String],
    now: &str,
) -> Result<()> {
    conn.execute("DELETE FROM vehicle_energy_types WHERE vehicle_id = ?1", [vehicle_id])?;

    for energy_type_id in energy_type_ids {
        conn.execute(
            "INSERT INTO vehicle_energy_types (vehicle_id, energy_type_id, created_at)
             VALUES (?1, ?2, ?3)",
            params![vehicle_id, energy_type_id, now],
        )?;
    }

    Ok(())
}

fn ensure_vehicle_exists(conn: &rusqlite::Connection, vehicle_id: &str) -> Result<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM vehicles WHERE id = ?1",
        [vehicle_id],
        |row| row.get(0),
    )?;

    if count == 0 {
        return Err(AppError::msg("Véhicule introuvable"));
    }

    Ok(())
}

fn validate_vehicle_energy_selection(
    compatible_energy_type_ids: &[String],
    preferred_energy_type_id: Option<&str>,
) -> Result<()> {
    if compatible_energy_type_ids.is_empty() {
        return Err(AppError::msg("Sélectionnez au moins une énergie compatible"));
    }

    let preferred = preferred_energy_type_id
        .ok_or_else(|| AppError::msg("L'énergie préférée est obligatoire"))?;

    if !compatible_energy_type_ids.iter().any(|id| id == preferred) {
        return Err(AppError::msg(
            "L'énergie préférée doit faire partie des énergies compatibles",
        ));
    }

    Ok(())
}

fn ensure_energy_types_are_active(conn: &rusqlite::Connection, energy_type_ids: &[String]) -> Result<()> {
    for energy_type_id in energy_type_ids {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM energy_types WHERE id = ?1 AND is_active = 1",
            [energy_type_id],
            |row| row.get(0),
        )?;

        if count == 0 {
            return Err(AppError::msg("Une énergie compatible sélectionnée est introuvable ou inactive"));
        }
    }

    Ok(())
}

fn ensure_preferred_energy_is_active(
    conn: &rusqlite::Connection,
    preferred_energy_type_id: Option<&str>,
) -> Result<()> {
    if let Some(energy_type_id) = preferred_energy_type_id {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM energy_types WHERE id = ?1 AND is_active = 1",
            [energy_type_id],
            |row| row.get(0),
        )?;

        if count == 0 {
            return Err(AppError::msg("L'énergie préférée est introuvable ou inactive"));
        }
    }

    Ok(())
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

fn normalize_required_text(value: Option<String>, message: &str) -> Result<String> {
    normalize_optional_text(value).ok_or_else(|| AppError::msg(message))
}

fn normalize_spec_required_text(value: String, message: &str) -> Result<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(AppError::msg(message))
    } else {
        Ok(trimmed)
    }
}

fn normalize_spec_category(value: String) -> String {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        "Autres informations".to_string()
    } else {
        trimmed
    }
}

fn normalize_energy_type_ids(values: Vec<String>) -> Vec<String> {
    let mut unique = Vec::new();

    for value in values {
        let trimmed = value.trim().to_string();
        if !trimmed.is_empty() && !unique.iter().any(|current| current == &trimmed) {
            unique.push(trimmed);
        }
    }

    unique
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_specs_test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch(
            "
            CREATE TABLE vehicles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_archived INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE vehicle_specs (
                id TEXT PRIMARY KEY,
                vehicle_id TEXT NOT NULL,
                category TEXT NOT NULL,
                label TEXT NOT NULL,
                value TEXT NOT NULL,
                extra TEXT,
                order_index INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO vehicles (id, name, is_archived, created_at, updated_at)
            VALUES ('vehicle-1', 'Test', 0, '', '');
            ",
        )
        .expect("prepare schema");
        conn
    }

    #[test]
    fn replaces_specs_in_block_and_returns_sorted_rows() {
        let conn = setup_specs_test_conn();

        replace_vehicle_specs(
            &conn,
            "vehicle-1",
            vec![
                VehicleSpecInput {
                    category: "Sécurité".to_string(),
                    label: "Boulons antivol".to_string(),
                    value: "McGard".to_string(),
                    extra: Some("27170SUB".to_string()),
                    order_index: 1,
                },
                VehicleSpecInput {
                    category: "Pneumatiques".to_string(),
                    label: "Pneus".to_string(),
                    value: "225/55 R18".to_string(),
                    extra: None,
                    order_index: 0,
                },
            ],
        )
        .expect("replace specs");

        let specs = list_vehicle_specs_for_vehicle(&conn, "vehicle-1").expect("list specs");
        assert_eq!(specs.len(), 2);
        assert_eq!(specs[0].category, "Pneumatiques");
        assert_eq!(specs[1].category, "Sécurité");

        replace_vehicle_specs(
            &conn,
            "vehicle-1",
            vec![VehicleSpecInput {
                category: "".to_string(),
                label: "Tracker GPS".to_string(),
                value: "Invoxia".to_string(),
                extra: Some("2432973B10E84EF".to_string()),
                order_index: 0,
            }],
        )
        .expect("replace specs a second time");

        let specs = list_vehicle_specs_for_vehicle(&conn, "vehicle-1").expect("list specs after replace");
        assert_eq!(specs.len(), 1);
        assert_eq!(specs[0].category, "Autres informations");
        assert_eq!(specs[0].label, "Tracker GPS");
    }
}
