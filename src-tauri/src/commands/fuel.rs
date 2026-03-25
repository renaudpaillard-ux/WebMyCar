use std::collections::HashMap;

use chrono::NaiveDate;
use csv::Trim;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

use crate::db::DbState;
use crate::error::{AppError, Result};
use crate::models::energy_type::EnergyType;
use crate::models::fuel::{
    CreateFuelEntryInput, FuelEntry, ImportFuelCsvInput, ImportFuelCsvLineError, ImportFuelCsvResult,
    PreviewFuelCsvResult, FuelCsvPreviewAction, FuelCsvPreviewLine, FuelCsvPreviewStatus, UpdateFuelEntryInput,
};

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
         ORDER BY f.vehicle_id ASC, f.mileage ASC, f.entry_date ASC, f.created_at ASC",
    )?;

    let entries = stmt
        .query_map([], |row| {
            map_fuel_entry_row(row)
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(with_metrics(entries))
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

#[tauri::command]
pub fn import_fuel_csv(state: State<DbState>, input: ImportFuelCsvInput) -> Result<ImportFuelCsvResult> {
    if input.vehicle_id.trim().is_empty() {
        return Err(AppError::msg("Le véhicule est obligatoire pour l'import CSV"));
    }

    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    import_fuel_csv_with_conn(&conn, input)
}

#[tauri::command]
pub fn preview_fuel_csv(state: State<DbState>, input: ImportFuelCsvInput) -> Result<PreviewFuelCsvResult> {
    if input.vehicle_id.trim().is_empty() {
        return Err(AppError::msg("Le véhicule est obligatoire pour l'import CSV"));
    }

    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    Ok(analyze_fuel_csv_with_conn(&conn, &input)?.preview)
}

fn import_fuel_csv_with_conn(
    conn: &rusqlite::Connection,
    input: ImportFuelCsvInput,
) -> Result<ImportFuelCsvResult> {
    if input.vehicle_id.trim().is_empty() {
        return Err(AppError::msg("Le véhicule est obligatoire pour l'import CSV"));
    }

    ensure_vehicle_is_active(&conn, &input.vehicle_id)?;

    let analysis = analyze_fuel_csv_with_conn(conn, &input)?;
    let mut existing_entry_ids_by_mileage = get_vehicle_entry_ids_by_mileage(conn, &input.vehicle_id)?;

    let mut result = ImportFuelCsvResult {
        created_count: 0,
        replaced_count: 0,
        rejected_count: analysis.preview.rejected_rows,
        recalculated_price_per_liter_count: 0,
        preferred_energy_fallback_count: 0,
        errors: analysis
            .preview
            .lines
            .iter()
            .filter(|line| matches!(line.status, FuelCsvPreviewStatus::Rejected))
            .map(|line| ImportFuelCsvLineError {
                line_number: line.line_number,
                message: line.messages.join(" "),
            })
            .collect(),
    };

    for prepared_row in analysis.rows_to_import {
        let parsed_row = prepared_row.parsed_row;

        if parsed_row.recalculated_price_per_liter {
            result.recalculated_price_per_liter_count += 1;
        }

        if parsed_row.used_preferred_energy_fallback {
            result.preferred_energy_fallback_count += 1;
        }

        if let Some(existing_entry_id) = existing_entry_ids_by_mileage.get(&parsed_row.mileage).cloned() {
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE fuel_entries
                 SET entry_date = ?1, liters = ?2, total_price_cents = ?3, price_per_liter_millis = ?4,
                     energy_type_id = ?5, station = ?6, note = ?7, is_full_tank = ?8, updated_at = ?9
                 WHERE id = ?10",
                params![
                    parsed_row.entry_date,
                    parsed_row.liters,
                    parsed_row.total_price_cents,
                    parsed_row.price_per_liter_millis,
                    parsed_row.energy_type_id,
                    parsed_row.station,
                    parsed_row.note,
                    if parsed_row.is_full_tank { 1 } else { 0 },
                    now,
                    existing_entry_id,
                ],
            )?;
            result.replaced_count += 1;
        } else {
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
                    parsed_row.entry_date,
                    parsed_row.mileage,
                    parsed_row.liters,
                    parsed_row.total_price_cents,
                    parsed_row.price_per_liter_millis,
                    parsed_row.energy_type_id,
                    parsed_row.station,
                    parsed_row.note,
                    if parsed_row.is_full_tank { 1 } else { 0 },
                    now,
                    now,
                ],
            )?;
            existing_entry_ids_by_mileage.insert(parsed_row.mileage, id);
            result.created_count += 1;
        }
    }

    Ok(result)
}

struct FuelCsvAnalysis {
    preview: PreviewFuelCsvResult,
    rows_to_import: Vec<PreparedImportRow>,
}

struct PreparedImportRow {
    parsed_row: ParsedCsvFuelRow,
}

fn analyze_fuel_csv_with_conn(
    conn: &rusqlite::Connection,
    input: &ImportFuelCsvInput,
) -> Result<FuelCsvAnalysis> {
    ensure_vehicle_is_active(conn, &input.vehicle_id)?;

    let energy_lookup = get_energy_type_lookup(conn)?;
    let preferred_energy_type_id = get_preferred_vehicle_energy_type_id(conn, &input.vehicle_id)?;
    let mut simulated_entry_ids_by_mileage = get_vehicle_entry_ids_by_mileage(conn, &input.vehicle_id)?;
    let mut rows_to_import = Vec::new();
    let mut preview_lines = Vec::new();
    let mut total_rows = 0;
    let mut valid_rows = 0;
    let mut replacement_rows = 0;
    let mut warning_rows = 0;
    let mut rejected_rows = 0;

    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .trim(Trim::All)
        .from_reader(input.csv_content.as_bytes());

    let headers = reader
        .headers()
        .map_err(|_| AppError::msg("Impossible de lire l'en-tête du fichier CSV"))?
        .clone();

    let expected_headers = ["date", "km", "quantite", "montant", "prix_litre", "lieu", "plein", "energie"];
    let normalized_headers: Vec<String> = headers.iter().map(normalize_csv_header).collect();

    for expected_header in expected_headers {
        if !normalized_headers.iter().any(|header| header == expected_header) {
            return Err(AppError::msg(format!(
                "Colonne CSV obligatoire manquante : {}",
                expected_header
            )));
        }
    }

    for (record_index, current_record) in reader.records().enumerate() {
        let line_number = record_index + 2;
        let record = match current_record {
            Ok(record) => record,
            Err(_) => {
                total_rows += 1;
                rejected_rows += 1;
                preview_lines.push(FuelCsvPreviewLine {
                    line_number,
                    date: "—".to_string(),
                    km: "—".to_string(),
                    quantite: "—".to_string(),
                    montant: "—".to_string(),
                    prix_litre: "—".to_string(),
                    lieu: "—".to_string(),
                    plein: "—".to_string(),
                    energie: "—".to_string(),
                    observations: "—".to_string(),
                    status: FuelCsvPreviewStatus::Rejected,
                    import_action: None,
                    messages: vec!["Ligne CSV illisible".to_string()],
                });
                continue;
            }
        };

        if record.iter().all(|value| value.trim().is_empty()) {
            continue;
        }

        total_rows += 1;
        let row = CsvFuelRow::from_record(&headers, &record);

        let parsed_row = match parse_csv_fuel_row(&row, &preferred_energy_type_id, &energy_lookup) {
            Ok(parsed) => parsed,
            Err(message) => {
                rejected_rows += 1;
                preview_lines.push(build_preview_line_rejected(line_number, &row, message));
                continue;
            }
        };

        if let Err(error) = validate_fuel_entry_input(
            &input.vehicle_id,
            &parsed_row.entry_date,
            parsed_row.mileage,
            parsed_row.liters,
            parsed_row.total_price_cents,
            parsed_row.price_per_liter_millis,
            &parsed_row.energy_type_id,
        ) {
            rejected_rows += 1;
            preview_lines.push(build_preview_line_rejected(line_number, &row, error.to_string()));
            continue;
        }

        let will_replace = simulated_entry_ids_by_mileage.contains_key(&parsed_row.mileage);
        if !will_replace {
            simulated_entry_ids_by_mileage.insert(parsed_row.mileage, format!("preview-line-{}", line_number));
        }

        let warnings = build_preview_warnings(&parsed_row);
        let has_warnings = !warnings.is_empty();

        valid_rows += 1;
        if will_replace {
            replacement_rows += 1;
        }
        if has_warnings {
            warning_rows += 1;
        }

        preview_lines.push(build_preview_line_valid(
            line_number,
            &parsed_row,
            will_replace,
            warnings,
        ));

        rows_to_import.push(PreparedImportRow { parsed_row });
    }

    Ok(FuelCsvAnalysis {
        preview: PreviewFuelCsvResult {
            total_rows,
            valid_rows,
            replacement_rows,
            warning_rows,
            rejected_rows,
            lines: preview_lines,
        },
        rows_to_import,
    })
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

fn get_preferred_vehicle_energy_type_id(conn: &rusqlite::Connection, vehicle_id: &str) -> Result<Option<String>> {
    let preferred_energy_type_id = conn.query_row(
        "SELECT preferred_energy_type_id FROM vehicles WHERE id = ?1",
        [vehicle_id],
        |row| row.get::<_, Option<String>>(0),
    )?;

    Ok(preferred_energy_type_id.and_then(|current| {
        let trimmed = current.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    }))
}

fn get_vehicle_entry_ids_by_mileage(
    conn: &rusqlite::Connection,
    vehicle_id: &str,
) -> Result<HashMap<i64, String>> {
    let mut stmt = conn.prepare(
        "SELECT id, mileage
         FROM fuel_entries
         WHERE vehicle_id = ?1",
    )?;

    let rows = stmt
        .query_map([vehicle_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(rows
        .into_iter()
        .map(|(id, mileage)| (mileage, id))
        .collect::<HashMap<_, _>>())
}

struct EnergyTypeLookup {
    id_by_alias: HashMap<String, String>,
    label_by_id: HashMap<String, String>,
}

fn get_energy_type_lookup(conn: &rusqlite::Connection) -> Result<EnergyTypeLookup> {
    let mut stmt = conn.prepare("SELECT id, code, label FROM energy_types WHERE is_active = 1")?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    let mut aliases = HashMap::new();
    let mut label_by_id = HashMap::new();

    for (id, code, label) in rows {
        label_by_id.insert(id.clone(), label.clone());
        aliases.insert(normalize_energy_alias(&code), id.clone());
        aliases.insert(normalize_energy_alias(&label), id.clone());

        match code.as_str() {
            "petrol_e10" => {
                aliases.insert(normalize_energy_alias("SP95-E10"), id.clone());
                aliases.insert(normalize_energy_alias("E10"), id.clone());
            }
            "petrol_e5_95" => {
                aliases.insert(normalize_energy_alias("SP95"), id.clone());
            }
            "petrol_e5_98" => {
                aliases.insert(normalize_energy_alias("SP98"), id.clone());
            }
            "petrol_e85" => {
                aliases.insert(normalize_energy_alias("E85"), id.clone());
                aliases.insert(normalize_energy_alias("Superéthanol"), id.clone());
                aliases.insert(normalize_energy_alias("Superethanol"), id.clone());
            }
            "diesel_b7" => {
                aliases.insert(normalize_energy_alias("Diesel"), id.clone());
                aliases.insert(normalize_energy_alias("Gazole"), id.clone());
                aliases.insert(normalize_energy_alias("B7"), id.clone());
            }
            "diesel_b10" => {
                aliases.insert(normalize_energy_alias("B10"), id.clone());
            }
            "diesel_xtl" => {
                aliases.insert(normalize_energy_alias("XTL"), id.clone());
                aliases.insert(normalize_energy_alias("HVO100"), id.clone());
            }
            "lpg" => {
                aliases.insert(normalize_energy_alias("GPL"), id.clone());
            }
            "electric" => {
                aliases.insert(normalize_energy_alias("Electric"), id.clone());
                aliases.insert(normalize_energy_alias("Électricité"), id.clone());
                aliases.insert(normalize_energy_alias("Electricite"), id.clone());
            }
            "adblue" => {
                aliases.insert(normalize_energy_alias("AdBlue"), id.clone());
            }
            _ => {}
        }
    }

    Ok(EnergyTypeLookup {
        id_by_alias: aliases,
        label_by_id,
    })
}

#[derive(Default)]
struct CsvFuelRow {
    date: String,
    km: String,
    quantite: String,
    montant: String,
    prix_litre: String,
    lieu: String,
    observations: String,
    plein: String,
    energie: String,
}

struct ParsedCsvFuelRow {
    entry_date: String,
    mileage: i64,
    liters: f64,
    total_price_cents: i64,
    price_per_liter_millis: i64,
    energy_type_id: String,
    energy_type_label: String,
    station: Option<String>,
    note: Option<String>,
    is_full_tank: bool,
    used_preferred_energy_fallback: bool,
    recalculated_price_per_liter: bool,
}

impl CsvFuelRow {
    fn from_record(headers: &csv::StringRecord, record: &csv::StringRecord) -> Self {
        let mut row = CsvFuelRow::default();

        for (index, header) in headers.iter().enumerate() {
            let value = record.get(index).unwrap_or("").trim().to_string();
            match normalize_csv_header(header) {
                normalized if normalized == "date" => row.date = value,
                normalized if normalized == "km" => row.km = value,
                normalized if normalized == "quantite" => row.quantite = value,
                normalized if normalized == "montant" => row.montant = value,
                normalized if normalized == "prix_litre" => row.prix_litre = value,
                normalized if normalized == "lieu" => row.lieu = value,
                normalized if normalized == "observations" => row.observations = value,
                normalized if normalized == "plein" => row.plein = value,
                normalized if normalized == "energie" => row.energie = value,
                _ => {}
            }
        }

        row
    }
}

fn parse_csv_fuel_row(
    row: &CsvFuelRow,
    preferred_energy_type_id: &Option<String>,
    energy_lookup: &EnergyTypeLookup,
) -> std::result::Result<ParsedCsvFuelRow, String> {
    let entry_date = parse_csv_date(&row.date).ok_or_else(|| "date invalide".to_string())?;

    let mileage = normalize_csv_number(&row.km)
        .parse::<i64>()
        .map_err(|_| "kilométrage invalide".to_string())?;

    let liters = parse_csv_decimal(&row.quantite)
        .ok_or_else(|| "quantité invalide".to_string())?;

    let total_price_cents = parse_csv_amount_to_cents(&row.montant)
        .ok_or_else(|| "montant invalide".to_string())?;

    let is_full_tank = match normalize_import_flag(&row.plein).as_str() {
        "o" => true,
        "n" => false,
        _ => return Err("la colonne plein doit contenir O ou N".to_string()),
    };

    let mut used_preferred_energy_fallback = false;
    let energy_type_id = if row.energie.trim().is_empty() {
        used_preferred_energy_fallback = true;
        preferred_energy_type_id.clone()
    } else {
        energy_lookup
            .id_by_alias
            .get(&normalize_energy_alias(&row.energie))
            .cloned()
            .or_else(|| {
                used_preferred_energy_fallback = true;
                preferred_energy_type_id.clone()
            })
    }
    .ok_or_else(|| "énergie inconnue et aucun véhicule par défaut utilisable".to_string())?;

    let recalculated_price_per_liter = row.prix_litre.trim().is_empty();
    let price_per_liter_millis = if recalculated_price_per_liter {
        if liters <= 0.0 {
            return Err("impossible de recalculer le prix au litre".to_string());
        }

        ((total_price_cents as f64 / 100.0) * 1000.0 / liters).round() as i64
    } else {
        parse_csv_amount_to_millis(&row.prix_litre)
            .ok_or_else(|| "prix au litre invalide".to_string())?
    };

    Ok(ParsedCsvFuelRow {
        entry_date,
        mileage,
        liters,
        total_price_cents,
        price_per_liter_millis,
        energy_type_label: energy_lookup
            .label_by_id
            .get(&energy_type_id)
            .cloned()
            .unwrap_or_else(|| row.energie.trim().to_string()),
        energy_type_id,
        station: normalize_optional_text(Some(row.lieu.clone())),
        note: normalize_optional_text(Some(row.observations.clone())),
        is_full_tank,
        used_preferred_energy_fallback,
        recalculated_price_per_liter,
    })
}

fn parse_csv_date(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    NaiveDate::parse_from_str(trimmed, "%d/%m/%Y")
        .or_else(|_| NaiveDate::parse_from_str(trimmed, "%Y-%m-%d"))
        .ok()
        .map(|date| date.format("%Y-%m-%d").to_string())
}

fn parse_csv_decimal(value: &str) -> Option<f64> {
    let normalized = normalize_csv_number(value).replace(',', ".");
    if normalized.is_empty() {
        return None;
    }

    normalized.parse::<f64>().ok()
}

fn normalize_csv_number(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect()
}

fn parse_csv_amount_to_cents(value: &str) -> Option<i64> {
    parse_csv_decimal(value).map(|current| (current * 100.0).round() as i64)
}

fn parse_csv_amount_to_millis(value: &str) -> Option<i64> {
    parse_csv_decimal(value).map(|current| (current * 1000.0).round() as i64)
}

fn normalize_csv_header(value: &str) -> String {
    value.trim().to_lowercase().replace(' ', "_")
}

fn normalize_import_flag(value: &str) -> String {
    value.trim().to_lowercase()
}

fn normalize_energy_alias(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace('é', "e")
        .replace('è', "e")
        .replace('ê', "e")
        .replace('à', "a")
        .replace('û', "u")
        .replace(' ', "")
}

fn build_preview_warnings(parsed_row: &ParsedCsvFuelRow) -> Vec<String> {
    let mut warnings = Vec::new();

    if parsed_row.used_preferred_energy_fallback {
        warnings.push("Énergie du véhicule utilisée par défaut".to_string());
    }

    if parsed_row.recalculated_price_per_liter {
        warnings.push("Prix/L recalculé depuis le montant et la quantité".to_string());
    }

    warnings
}

fn build_preview_line_rejected(
    line_number: usize,
    row: &CsvFuelRow,
    message: String,
) -> FuelCsvPreviewLine {
    FuelCsvPreviewLine {
        line_number,
        date: preview_text_value(&row.date),
        km: preview_text_value(&row.km),
        quantite: preview_text_value(&row.quantite),
        montant: preview_text_value(&row.montant),
        prix_litre: preview_text_value(&row.prix_litre),
        lieu: preview_text_value(&row.lieu),
        plein: preview_text_value(&row.plein),
        energie: preview_text_value(&row.energie),
        observations: preview_text_value(&row.observations),
        status: FuelCsvPreviewStatus::Rejected,
        import_action: None,
        messages: vec![message],
    }
}

fn build_preview_line_valid(
    line_number: usize,
    parsed_row: &ParsedCsvFuelRow,
    will_replace: bool,
    messages: Vec<String>,
) -> FuelCsvPreviewLine {
    FuelCsvPreviewLine {
        line_number,
        date: parsed_row.entry_date.clone(),
        km: format_preview_integer(parsed_row.mileage),
        quantite: format_preview_decimal(parsed_row.liters, 2),
        montant: format_preview_decimal(parsed_row.total_price_cents as f64 / 100.0, 2),
        prix_litre: format_preview_decimal(parsed_row.price_per_liter_millis as f64 / 1000.0, 3),
        lieu: preview_optional_text(parsed_row.station.as_deref()),
        plein: if parsed_row.is_full_tank { "O" } else { "N" }.to_string(),
        energie: preview_optional_text(Some(parsed_row.energy_type_label.as_str())),
        observations: preview_optional_text(parsed_row.note.as_deref()),
        status: if messages.is_empty() {
            FuelCsvPreviewStatus::Ok
        } else {
            FuelCsvPreviewStatus::Warning
        },
        import_action: Some(if will_replace {
            FuelCsvPreviewAction::Replace
        } else {
            FuelCsvPreviewAction::Create
        }),
        messages,
    }
}

fn preview_text_value(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "—".to_string()
    } else {
        trimmed.to_string()
    }
}

fn preview_optional_text(value: Option<&str>) -> String {
    value
        .map(str::trim)
        .filter(|current| !current.is_empty())
        .unwrap_or("—")
        .to_string()
}

fn format_preview_integer(value: i64) -> String {
    let digits = value.abs().to_string();
    let mut result = String::new();

    for (index, character) in digits.chars().rev().enumerate() {
        if index > 0 && index % 3 == 0 {
            result.push(' ');
        }
        result.push(character);
    }

    let mut grouped: String = result.chars().rev().collect();
    if value < 0 {
        grouped.insert(0, '-');
    }

    grouped
}

fn format_preview_decimal(value: f64, digits: usize) -> String {
    format!("{value:.digits$}").replace('.', ",")
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
        map_fuel_entry_row,
    )?;

    let entries = list_fuel_entries_for_vehicle(conn, &entry.vehicle_id)?;
    entries
        .into_iter()
        .find(|current| current.id == entry.id)
        .ok_or_else(|| AppError::msg("Entrée carburant introuvable"))
}

fn list_fuel_entries_for_vehicle(conn: &rusqlite::Connection, vehicle_id: &str) -> Result<Vec<FuelEntry>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.vehicle_id, v.name, f.entry_date, f.mileage, f.liters,
                f.total_price_cents, f.price_per_liter_millis, f.energy_type_id,
                et.label, f.station, f.note, f.is_full_tank, f.created_at, f.updated_at
         FROM fuel_entries f
         INNER JOIN vehicles v ON v.id = f.vehicle_id
         INNER JOIN energy_types et ON et.id = f.energy_type_id
         WHERE f.vehicle_id = ?1
         ORDER BY f.mileage ASC, f.entry_date ASC, f.created_at ASC",
    )?;

    let entries = stmt
        .query_map([vehicle_id], map_fuel_entry_row)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(with_metrics(entries))
}

fn map_fuel_entry_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FuelEntry> {
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
        trip_distance_km: None,
        consumption_l_per_100: None,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

fn with_metrics(entries: Vec<FuelEntry>) -> Vec<FuelEntry> {
    let mut entries = entries;
    let mut indices_by_vehicle = std::collections::HashMap::<String, Vec<usize>>::new();

    for (index, entry) in entries.iter().enumerate() {
        indices_by_vehicle
            .entry(entry.vehicle_id.clone())
            .or_default()
            .push(index);
    }

    for indices in indices_by_vehicle.values() {
        let mut sorted_indices = indices.clone();
        sorted_indices.sort_by(|left, right| {
            let left_entry = &entries[*left];
            let right_entry = &entries[*right];

            left_entry
                .mileage
                .cmp(&right_entry.mileage)
                .then_with(|| left_entry.entry_date.cmp(&right_entry.entry_date))
                .then_with(|| left_entry.created_at.cmp(&right_entry.created_at))
        });

        let mut previous_full_index: Option<usize> = None;
        let mut previous_entry_index: Option<usize> = None;
        let mut liters_since_previous_full = 0.0_f64;

        for current_index in sorted_indices {
            if let Some(previous_index) = previous_entry_index {
                let trip_distance = entries[current_index].mileage - entries[previous_index].mileage;
                if trip_distance > 0 {
                    entries[current_index].trip_distance_km = Some(trip_distance);
                }
            }

            liters_since_previous_full += entries[current_index].liters;

            if !entries[current_index].is_full_tank {
                previous_entry_index = Some(current_index);
                continue;
            }

            if let Some(previous_index) = previous_full_index {
                let distance = entries[current_index].mileage - entries[previous_index].mileage;

                if distance > 0 {
                    entries[current_index].consumption_l_per_100 =
                        Some((liters_since_previous_full / distance as f64) * 100.0);
                }
            }

            previous_full_index = Some(current_index);
            previous_entry_index = Some(current_index);
            liters_since_previous_full = 0.0;
        }
    }

    entries
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

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{params, Connection};

    fn setup_import_test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");

        conn.execute_batch(
            "
            CREATE TABLE vehicles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                preferred_energy_type_id TEXT,
                is_archived INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE energy_types (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                label TEXT NOT NULL,
                category TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE fuel_entries (
                id TEXT PRIMARY KEY,
                vehicle_id TEXT NOT NULL,
                entry_date TEXT NOT NULL,
                mileage INTEGER NOT NULL,
                liters REAL NOT NULL,
                total_price_cents INTEGER NOT NULL,
                price_per_liter_millis INTEGER NOT NULL,
                energy_type_id TEXT NOT NULL,
                station TEXT,
                note TEXT,
                is_full_tank INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            ",
        )
        .expect("create schema");

        conn.execute(
            "INSERT INTO energy_types (id, code, label, category, is_active) VALUES (?1, ?2, ?3, ?4, 1)",
            params!["energy-diesel-b7", "diesel_b7", "Diesel B7", "diesel"],
        )
        .expect("insert energy type");

        conn.execute(
            "INSERT INTO vehicles (id, name, preferred_energy_type_id, is_archived) VALUES (?1, ?2, ?3, 0)",
            params!["vehicle-1", "Véhicule test", "energy-diesel-b7"],
        )
        .expect("insert vehicle");

        conn
    }

    fn import_csv(conn: &Connection, csv_content: &str) -> ImportFuelCsvResult {
        import_fuel_csv_with_conn(
            conn,
            ImportFuelCsvInput {
                vehicle_id: "vehicle-1".to_string(),
                csv_content: csv_content.to_string(),
            },
        )
        .expect("import csv")
    }

    fn preview_csv(conn: &Connection, csv_content: &str) -> PreviewFuelCsvResult {
        analyze_fuel_csv_with_conn(
            conn,
            &ImportFuelCsvInput {
                vehicle_id: "vehicle-1".to_string(),
                csv_content: csv_content.to_string(),
            },
        )
        .expect("preview csv")
        .preview
    }

    #[test]
    fn imports_observations_when_present() {
        let conn = setup_import_test_conn();

        let result = import_csv(
            &conn,
            "date,km,quantite,montant,prix_litre,lieu,observations,plein,energie\n2025-03-17,12345,45.12,78.50,1.739,Total,\"Plein autoroute\",O,Diesel\n",
        );

        assert_eq!(result.created_count, 1);

        let note: Option<String> = conn
            .query_row("SELECT note FROM fuel_entries WHERE mileage = 12345", [], |row| row.get(0))
            .expect("select note");
        assert_eq!(note.as_deref(), Some("Plein autoroute"));
    }

    #[test]
    fn imports_empty_observations_as_null() {
        let conn = setup_import_test_conn();

        let result = import_csv(
            &conn,
            "date,km,quantite,montant,prix_litre,lieu,observations,plein,energie\n2025-03-17,12345,45.12,78.50,1.739,Total,,O,Diesel\n",
        );

        assert_eq!(result.created_count, 1);

        let note: Option<String> = conn
            .query_row("SELECT note FROM fuel_entries WHERE mileage = 12345", [], |row| row.get(0))
            .expect("select note");
        assert_eq!(note, None);
    }

    #[test]
    fn replacement_updates_observations() {
        let conn = setup_import_test_conn();

        conn.execute(
            "INSERT INTO fuel_entries
                 (id, vehicle_id, entry_date, mileage, liters, total_price_cents, price_per_liter_millis,
                  energy_type_id, station, note, is_full_tank, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                "fuel-1",
                "vehicle-1",
                "2025-03-01",
                12345_i64,
                40.0_f64,
                7000_i64,
                1750_i64,
                "energy-diesel-b7",
                "Ancienne station",
                "Ancienne note",
                1_i64,
                "2025-03-01T10:00:00Z",
                "2025-03-01T10:00:00Z",
            ],
        )
        .expect("seed fuel entry");

        let result = import_csv(
            &conn,
            "date,km,quantite,montant,prix_litre,lieu,observations,plein,energie\n2025-03-17,12345,45.12,78.50,1.739,Total,\"Nouvelle note\",O,Diesel\n",
        );

        assert_eq!(result.replaced_count, 1);

        let note: Option<String> = conn
            .query_row("SELECT note FROM fuel_entries WHERE id = 'fuel-1'", [], |row| row.get(0))
            .expect("select replaced note");
        assert_eq!(note.as_deref(), Some("Nouvelle note"));
    }

    #[test]
    fn imports_quoted_observations_with_spaces_and_separator() {
        let conn = setup_import_test_conn();

        let result = import_csv(
            &conn,
            "date,km,quantite,montant,prix_litre,lieu,observations,plein,energie\n17/03/2025,12345,45,12,78,50,1,739,Total,\"  Texte avec virgule, et espaces  \",O,Diesel\n"
                .replace(",45,12,78,50,1,739,", ",45.12,78.50,1.739,")
                .as_str(),
        );

        assert_eq!(result.created_count, 1);

        let note: Option<String> = conn
            .query_row("SELECT note FROM fuel_entries WHERE mileage = 12345", [], |row| row.get(0))
            .expect("select note");
        assert_eq!(note.as_deref(), Some("Texte avec virgule, et espaces"));
    }

    #[test]
    fn imports_numeric_fields_with_spaces() {
        let conn = setup_import_test_conn();

        let result = import_csv(
            &conn,
            "date,km,quantite,montant,prix_litre,lieu,observations,plein,energie\n2025-03-17,\"12 345\",\"45 12\",\"7 850\",\"1 739\",Total,,O,Diesel\n"
                .replace("\"45 12\"", "\"45,12\"")
                .replace("\"7 850\"", "\"78,50\"")
                .replace("\"1 739\"", "\"1,739\"")
                .as_str(),
        );

        assert_eq!(result.created_count, 1);

        let (mileage, liters, total_price_cents, price_per_liter_millis): (i64, f64, i64, i64) = conn
            .query_row(
                "SELECT mileage, liters, total_price_cents, price_per_liter_millis
                 FROM fuel_entries
                 WHERE mileage = 12345",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("select imported numeric values");

        assert_eq!(mileage, 12345);
        assert!((liters - 45.12).abs() < f64::EPSILON);
        assert_eq!(total_price_cents, 7850);
        assert_eq!(price_per_liter_millis, 1739);
    }

    #[test]
    fn preview_reports_counts_statuses_and_messages() {
        let conn = setup_import_test_conn();

        conn.execute(
            "INSERT INTO fuel_entries
                 (id, vehicle_id, entry_date, mileage, liters, total_price_cents, price_per_liter_millis,
                  energy_type_id, station, note, is_full_tank, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                "fuel-existing",
                "vehicle-1",
                "2025-03-01",
                12345_i64,
                40.0_f64,
                7000_i64,
                1750_i64,
                "energy-diesel-b7",
                "Ancienne station",
                "Ancienne note",
                1_i64,
                "2025-03-01T10:00:00Z",
                "2025-03-01T10:00:00Z",
            ],
        )
        .expect("seed existing entry");

        let preview = preview_csv(
            &conn,
            "date,km,quantite,montant,prix_litre,lieu,plein,energie,observations\n2025-03-17,12345,45.12,78.50,,Total,O,,Remplacement\n2025-03-18,12500,44.00,76.00,1.727,Leclerc,N,Diesel,Creation\ninvalide,13000,40.00,70.00,1.750,Total,O,Diesel,Erreur\n",
        );

        assert_eq!(preview.total_rows, 3);
        assert_eq!(preview.valid_rows, 2);
        assert_eq!(preview.replacement_rows, 1);
        assert_eq!(preview.warning_rows, 1);
        assert_eq!(preview.rejected_rows, 1);
        assert_eq!(preview.lines[0].status, FuelCsvPreviewStatus::Warning);
        assert_eq!(preview.lines[0].import_action, Some(FuelCsvPreviewAction::Replace));
        assert_eq!(preview.lines[1].status, FuelCsvPreviewStatus::Ok);
        assert_eq!(preview.lines[1].import_action, Some(FuelCsvPreviewAction::Create));
        assert_eq!(preview.lines[2].status, FuelCsvPreviewStatus::Rejected);
        assert!(preview.lines[0].messages.iter().any(|message| message.contains("Énergie du véhicule utilisée")));
        assert!(preview.lines[0].messages.iter().any(|message| message.contains("Prix/L recalculé")));
        assert_eq!(preview.lines[2].messages, vec!["date invalide"]);
    }
}
