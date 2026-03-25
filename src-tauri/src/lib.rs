mod commands;
mod db;
mod error;
mod models;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .on_menu_event(|app, event| {
            commands::app_file::handle_menu_event(app, event.id().as_ref());
        })
        .setup(|app| {
            let db_path = commands::app_file::startup_database_path(&app.handle())?;
            let conn = db::open_and_migrate(&db_path)?;
            app.manage(db::DbState(Mutex::new(conn)));
            app.manage(db::CurrentDatabasePath(Mutex::new(db_path.clone())));
            commands::app_file::setup_file_menu(&app.handle(), &db_path)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_file::get_current_database_info,
            commands::app_file::create_database_at_path,
            commands::app_file::open_database_at_path,
            commands::app_file::save_database_as_path,
            commands::app_file::reveal_current_database_in_folder,
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
            commands::fuel::preview_fuel_csv,
            commands::fuel::import_fuel_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
