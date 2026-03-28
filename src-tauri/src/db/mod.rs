use std::path::{Path, PathBuf};
use std::sync::Mutex;
use rusqlite::Connection;
use crate::error::{AppError, Result};

/// Tauri managed state holding the SQLite connection behind a mutex.
pub struct DbState(pub Mutex<Connection>);

/// Tauri managed state holding the current database file path.
pub struct CurrentDatabasePath(pub Mutex<PathBuf>);

/// Open the database at `path` and run all pending migrations.
pub fn open_and_migrate(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // Keep a mono-file SQLite layout for `.wmc` documents.
    conn.execute_batch("PRAGMA journal_mode=DELETE;")?;

    run_migrations(&conn)?;
    Ok(conn)
}

fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            applied_at  TEXT NOT NULL
        );",
    )?;

    // Add new migrations here in order. Each entry is (name, sql).
    let migrations: &[(&str, &str)] = &[
        (
            "001_create_vehicles",
            include_str!("migrations/001_create_vehicles.sql"),
        ),
        (
            "002_create_fuel_entries",
            include_str!("migrations/002_create_fuel_entries.sql"),
        ),
        (
            "003_repair_fuel_entries_schema",
            include_str!("migrations/003_repair_fuel_entries_schema.sql"),
        ),
        (
            "004_create_energy_types_and_refactor_fuel_entries",
            include_str!("migrations/004_create_energy_types_and_refactor_fuel_entries.sql"),
        ),
        (
            "005_update_energy_types_catalog",
            include_str!("migrations/005_update_energy_types_catalog.sql"),
        ),
        (
            "006_add_price_per_liter_millis",
            include_str!("migrations/006_add_price_per_liter_millis.sql"),
        ),
        (
            "007_add_vehicle_powertrain_and_energy_types",
            include_str!("migrations/007_add_vehicle_powertrain_and_energy_types.sql"),
        ),
        (
            "008_reseed_energy_types_reference",
            include_str!("migrations/008_reseed_energy_types_reference.sql"),
        ),
        (
            "009_create_vehicle_specs",
            include_str!("migrations/009_create_vehicle_specs.sql"),
        ),
    ];

    for (name, sql) in migrations {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM _migrations WHERE name = ?1",
            [name],
            |row| row.get(0),
        )?;

        if count == 0 {
            if *name == "003_repair_fuel_entries_schema" {
                repair_fuel_entries_schema(conn)?;
            } else {
                conn.execute_batch(sql)?;
            }
            conn.execute(
                "INSERT INTO _migrations (name, applied_at) VALUES (?1, datetime('now'))",
                [name],
            )
            .map_err(|e| AppError::msg(format!("Migration '{}' tracking failed: {}", name, e)))?;
        }
    }

    Ok(())
}

fn repair_fuel_entries_schema(conn: &Connection) -> Result<()> {
    let table_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'fuel_entries'",
        [],
        |row| row.get(0),
    )?;

    if table_exists == 0 {
        return Ok(());
    }

    if !column_exists(conn, "fuel_entries", "price_per_liter_cents")? {
        conn.execute_batch(
            "ALTER TABLE fuel_entries ADD COLUMN price_per_liter_cents INTEGER;",
        )?;
    }

    if !column_exists(conn, "fuel_entries", "energy_type")? {
        conn.execute_batch(
            "ALTER TABLE fuel_entries ADD COLUMN energy_type TEXT NOT NULL DEFAULT 'other';",
        )?;
    }

    if !column_exists(conn, "fuel_entries", "station")? {
        conn.execute_batch(
            "ALTER TABLE fuel_entries ADD COLUMN station TEXT;",
        )?;
    }

    if !column_exists(conn, "fuel_entries", "note")? {
        conn.execute_batch(
            "ALTER TABLE fuel_entries ADD COLUMN note TEXT;",
        )?;
    }

    if !column_exists(conn, "fuel_entries", "is_full_tank")? {
        conn.execute_batch(
            "ALTER TABLE fuel_entries ADD COLUMN is_full_tank INTEGER NOT NULL DEFAULT 1;",
        )?;
    }

    if !column_exists(conn, "fuel_entries", "created_at")? {
        conn.execute_batch(
            "ALTER TABLE fuel_entries ADD COLUMN created_at TEXT NOT NULL DEFAULT '';",
        )?;
    }

    if !column_exists(conn, "fuel_entries", "updated_at")? {
        conn.execute_batch(
            "ALTER TABLE fuel_entries ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';",
        )?;
    }

    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicle_id ON fuel_entries(vehicle_id);
         CREATE INDEX IF NOT EXISTS idx_fuel_entries_entry_date ON fuel_entries(entry_date);",
    )?;

    Ok(())
}

fn column_exists(conn: &Connection, table_name: &str, column_name: &str) -> Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table_name))?;
    let mut rows = stmt.query([])?;

    while let Some(row) = rows.next()? {
        let current_name: String = row.get(1)?;
        if current_name == column_name {
            return Ok(true);
        }
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_database_in_delete_journal_mode() {
        let temp_dir = std::env::temp_dir().join(format!("webmycar-db-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).expect("create temp dir");
        let db_path = temp_dir.join("journal_mode_test.wmc");

        let conn = open_and_migrate(&db_path).expect("open and migrate");
        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .expect("read journal mode");

        assert_eq!(journal_mode.to_lowercase(), "delete");

        drop(conn);
        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
