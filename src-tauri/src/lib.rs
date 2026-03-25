mod commands;
mod db;
mod error;
mod models;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            use tauri::Manager;
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("webmycar.db");
            let conn = db::open_and_migrate(&db_path)?;
            app.manage(db::DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::vehicles::list_vehicles,
            commands::vehicles::create_vehicle,
            commands::vehicles::update_vehicle,
            commands::vehicles::archive_vehicle,
            commands::vehicles::unarchive_vehicle,
            commands::fuel::list_fuel_entries,
            commands::fuel::list_energy_types,
            commands::fuel::create_fuel_entry,
            commands::fuel::update_fuel_entry,
            commands::fuel::delete_fuel_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
