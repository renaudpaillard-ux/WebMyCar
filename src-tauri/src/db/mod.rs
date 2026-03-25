use std::path::Path;
use std::sync::Mutex;
use rusqlite::Connection;
use crate::error::{AppError, Result};

/// Tauri managed state holding the SQLite connection behind a mutex.
pub struct DbState(pub Mutex<Connection>);

/// Open the database at `path` and run all pending migrations.
pub fn open_and_migrate(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // Enable WAL mode for better concurrent read performance.
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

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
    let migrations: &[(&str, &str)] = &[(
        "001_create_vehicles",
        include_str!("migrations/001_create_vehicles.sql"),
    )];

    for (name, sql) in migrations {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM _migrations WHERE name = ?1",
            [name],
            |row| row.get(0),
        )?;

        if count == 0 {
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO _migrations (name, applied_at) VALUES (?1, datetime('now'))",
                [name],
            )
            .map_err(|e| AppError::msg(format!("Migration '{}' tracking failed: {}", name, e)))?;
        }
    }

    Ok(())
}
