use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

use crate::db::{self, CurrentDatabasePath, DbState};
use crate::error::{AppError, Result};
use crate::models::app_file::{CurrentDatabaseInfo, MenuActionPayload};

const MENU_FILE_NEW: &str = "file_new";
const MENU_FILE_OPEN: &str = "file_open";
const MENU_FILE_SHOW_IN_FOLDER: &str = "file_show_in_folder";
const MENU_FILE_SAVE_AS: &str = "file_save_as";
const MENU_FILE_QUIT: &str = "file_quit";
const MENU_FILE_RECENT_EMPTY: &str = "file_recent_empty";
const MENU_FILE_RECENT_PREFIX: &str = "file_recent_";
const MENU_ACTION_EVENT: &str = "menu-action";
const DATABASE_CHANGED_EVENT: &str = "database-changed";
const RECENT_DATABASES_FILE: &str = "recent_databases.json";
const MAX_RECENT_DATABASES: usize = 10;

#[tauri::command]
pub fn get_current_database_info(current_path: State<CurrentDatabasePath>) -> Result<CurrentDatabaseInfo> {
    let current_path = current_path
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès au fichier courant"))?
        .clone();

    Ok(database_info_from_path(&current_path))
}

#[tauri::command]
pub fn create_database_at_path(
    app: AppHandle,
    db_state: State<DbState>,
    current_path: State<CurrentDatabasePath>,
    path: String,
) -> Result<CurrentDatabaseInfo> {
    let target_path = normalize_database_path(path)?;
    let existing_path = current_database_path(&current_path)?;

    if same_file_path(&existing_path, &target_path) {
        return Err(AppError::msg(
            "Choisissez un autre fichier pour créer une nouvelle base.",
        ));
    }

    ensure_parent_directory(&target_path)?;
    remove_database_file_if_exists(&target_path)?;

    let new_connection = db::open_and_migrate(&target_path)?;
    replace_database_connection(&db_state, &current_path, new_connection, &target_path)?;
    finalize_database_switch(&app, &target_path)?;

    Ok(database_info_from_path(&target_path))
}

#[tauri::command]
pub fn open_database_at_path(
    app: AppHandle,
    db_state: State<DbState>,
    current_path: State<CurrentDatabasePath>,
    path: String,
) -> Result<CurrentDatabaseInfo> {
    let target_path = normalize_database_path(path)?;
    if !target_path.exists() {
        return Err(AppError::msg("Le fichier sélectionné est introuvable."));
    }

    let existing_path = current_database_path(&current_path)?;
    if same_file_path(&existing_path, &target_path) {
        finalize_database_switch(&app, &target_path)?;
        return Ok(database_info_from_path(&target_path));
    }

    let new_connection = db::open_and_migrate(&target_path)?;
    replace_database_connection(&db_state, &current_path, new_connection, &target_path)?;
    finalize_database_switch(&app, &target_path)?;

    Ok(database_info_from_path(&target_path))
}

#[tauri::command]
pub fn save_database_as_path(
    app: AppHandle,
    db_state: State<DbState>,
    current_path: State<CurrentDatabasePath>,
    path: String,
) -> Result<CurrentDatabaseInfo> {
    let target_path = normalize_database_path(path)?;
    let source_path = current_database_path(&current_path)?;

    if same_file_path(&source_path, &target_path) {
        return Err(AppError::msg(
            "Choisissez un autre fichier pour l'enregistrement sous.",
        ));
    }

    ensure_parent_directory(&target_path)?;
    export_current_database_to_path(&db_state, &target_path)?;

    let new_connection = db::open_and_migrate(&target_path)?;
    replace_database_connection(&db_state, &current_path, new_connection, &target_path)?;
    finalize_database_switch(&app, &target_path)?;

    Ok(database_info_from_path(&target_path))
}

#[tauri::command]
pub fn reveal_current_database_in_folder(
    app: AppHandle,
    current_path: State<CurrentDatabasePath>,
) -> Result<()> {
    let current_path = current_database_path(&current_path)?;
    if !current_path.exists() {
        return Err(AppError::msg("Le fichier courant est introuvable."));
    }

    app.opener()
        .reveal_item_in_dir(&current_path)
        .map_err(|error| AppError::msg(format!("Impossible d'afficher le fichier dans le dossier : {}", error)))
}

pub fn startup_database_path(app: &AppHandle) -> Result<PathBuf> {
    let recent_paths = load_recent_database_paths(app)?;
    if let Some(last_used_path) = recent_paths.first() {
        return Ok(last_used_path.clone());
    }

    default_database_path(app)
}

fn default_database_path(app: &AppHandle) -> Result<PathBuf> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;

    let primary = app_data_dir.join("webmycar.wmc");
    let legacy = app_data_dir.join("webmycar.db");

    if primary.exists() {
        Ok(primary)
    } else if legacy.exists() {
        Ok(legacy)
    } else {
        Ok(primary)
    }
}

pub fn setup_file_menu(app: &AppHandle, current_path: &Path) -> Result<()> {
    let recent_paths = load_recent_database_paths(app)?;
    let menu = build_file_menu(app, current_path, &recent_paths)?;
    app.set_menu(menu)?;
    update_window_title(app, current_path)?;
    Ok(())
}

pub fn handle_menu_event(app: &AppHandle, menu_id: &str) {
    let result = if menu_id == MENU_FILE_NEW {
        emit_menu_action(app, "new", None)
    } else if menu_id == MENU_FILE_OPEN {
        emit_menu_action(app, "open", None)
    } else if menu_id == MENU_FILE_SAVE_AS {
        emit_menu_action(app, "save_as", None)
    } else if menu_id == MENU_FILE_SHOW_IN_FOLDER {
        emit_menu_action(app, "show_in_folder", None)
    } else if menu_id == MENU_FILE_QUIT {
        app.exit(0);
        return;
    } else if let Some(index) = menu_id.strip_prefix(MENU_FILE_RECENT_PREFIX) {
        match index.parse::<usize>() {
            Ok(parsed_index) => {
                let recent_paths = load_recent_database_paths(app);
                match recent_paths {
                    Ok(paths) => {
                        let selected_path = paths.get(parsed_index).cloned();
                        if let Some(path) = selected_path {
                            emit_menu_action(app, "open_recent", Some(path.to_string_lossy().to_string()))
                        } else {
                            setup_file_menu(app, &default_database_path(app).unwrap_or_else(|_| PathBuf::from("webmycar.wmc")))
                        }
                    }
                    Err(error) => Err(error),
                }
            }
            Err(_) => Ok(()),
        }
    } else if menu_id == MENU_FILE_RECENT_EMPTY {
        Ok(())
    } else {
        Ok(())
    };

    if let Err(error) = result {
        eprintln!("Menu Fichier: {}", error);
    }
}

fn emit_menu_action(app: &AppHandle, action: &str, path: Option<String>) -> Result<()> {
    app.emit(
        MENU_ACTION_EVENT,
        MenuActionPayload {
            action: action.to_string(),
            path,
        },
    )?;

    Ok(())
}

fn finalize_database_switch(app: &AppHandle, target_path: &Path) -> Result<()> {
    push_recent_database_path(app, target_path)?;
    setup_file_menu(app, target_path)?;
    app.emit(DATABASE_CHANGED_EVENT, database_info_from_path(target_path))?;
    Ok(())
}

fn replace_database_connection(
    db_state: &State<DbState>,
    current_path: &State<CurrentDatabasePath>,
    new_connection: Connection,
    target_path: &Path,
) -> Result<()> {
    {
        let mut connection = db_state
            .0
            .lock()
            .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;
        *connection = new_connection;
    }

    {
        let mut current_path_guard = current_path
            .0
            .lock()
            .map_err(|_| AppError::msg("Erreur d'accès au fichier courant"))?;
        *current_path_guard = target_path.to_path_buf();
    }

    Ok(())
}

fn export_current_database_to_path(db_state: &State<DbState>, target_path: &Path) -> Result<()> {
    let connection = db_state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès à la base de données"))?;

    connection.execute_batch("PRAGMA journal_mode=DELETE;")?;
    remove_database_file_if_exists(target_path)?;
    connection.execute("VACUUM INTO ?1", [target_path.to_string_lossy().to_string()])?;
    Ok(())
}

fn normalize_database_path(path: String) -> Result<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::msg("Le chemin du fichier est obligatoire."));
    }

    let mut path = PathBuf::from(trimmed);
    if path.extension().is_none() {
        path.set_extension("wmc");
    }

    Ok(path)
}

fn same_file_path(left: &Path, right: &Path) -> bool {
    left == right
}

fn ensure_parent_directory(path: &Path) -> Result<()> {
    let Some(parent) = path.parent() else {
        return Err(AppError::msg("Le dossier cible est invalide."));
    };

    fs::create_dir_all(parent)?;
    Ok(())
}

fn remove_database_file_if_exists(path: &Path) -> Result<()> {
    if path.exists() {
        fs::remove_file(path)?;
    }

    Ok(())
}

fn build_file_menu(
    app: &AppHandle,
    current_path: &Path,
    recent_paths: &[PathBuf],
) -> Result<tauri::menu::Menu<tauri::Wry>> {
    let recent_submenu = build_recent_submenu(app, recent_paths)?;
    let file_menu = SubmenuBuilder::new(app, "Fichier")
        .item(&MenuItem::with_id(app, MENU_FILE_NEW, "Nouveau", true, Some("CmdOrCtrl+N"))?)
        .item(&MenuItem::with_id(app, MENU_FILE_OPEN, "Ouvrir…", true, Some("CmdOrCtrl+O"))?)
        .item(&recent_submenu)
        .separator()
        .item(&MenuItem::with_id(
            app,
            MENU_FILE_SHOW_IN_FOLDER,
            "Afficher dans le dossier",
            current_path.exists(),
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            MENU_FILE_SAVE_AS,
            "Enregistrer sous…",
            true,
            Some("CmdOrCtrl+Shift+S"),
        )?)
        .separator()
        .item(&MenuItem::with_id(app, MENU_FILE_QUIT, "Quitter", true, Some("CmdOrCtrl+Q"))?)
        .build()?;

    let mut menu = MenuBuilder::new(app);

    if cfg!(target_os = "macos") {
        let app_menu = build_application_submenu(app)?;
        menu = menu.item(&app_menu);
    }

    menu.item(&file_menu).build().map_err(Into::into)
}

fn build_application_submenu(app: &AppHandle) -> Result<tauri::menu::Submenu<tauri::Wry>> {
    SubmenuBuilder::new(app, "WebMyCar")
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .build()
        .map_err(Into::into)
}

fn build_recent_submenu(
    app: &AppHandle,
    recent_paths: &[PathBuf],
) -> Result<tauri::menu::Submenu<tauri::Wry>> {
    let builder = SubmenuBuilder::new(app, "Ouvrir récent");

    if recent_paths.is_empty() {
        return builder
            .item(&MenuItem::with_id(
                app,
                MENU_FILE_RECENT_EMPTY,
                "Aucun fichier récent",
                false,
                None::<&str>,
            )?)
            .build()
            .map_err(Into::into);
    }

    let mut builder = builder;
    for (index, path) in recent_paths.iter().enumerate() {
        let label = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Fichier sans nom")
            .to_string();
        builder = builder.item(&MenuItem::with_id(
            app,
            format!("{}{}", MENU_FILE_RECENT_PREFIX, index),
            label,
            true,
            None::<&str>,
        )?);
    }

    builder.build().map_err(Into::into)
}

fn database_info_from_path(path: &Path) -> CurrentDatabaseInfo {
    CurrentDatabaseInfo {
        path: path.to_string_lossy().to_string(),
        file_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("webmycar.wmc")
            .to_string(),
    }
}

fn update_window_title(app: &AppHandle, current_path: &Path) -> Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_title(&format!(
            "WebMyCar — {}",
            current_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("webmycar.wmc")
        ))?;
    }

    Ok(())
}

fn load_recent_database_paths(app: &AppHandle) -> Result<Vec<PathBuf>> {
    let recents_path = recent_databases_file_path(app)?;
    if !recents_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(recents_path)?;
    let stored_recent_paths = serde_json::from_str::<Vec<String>>(&content).unwrap_or_default();
    let recent_paths = stored_recent_paths
        .into_iter()
        .map(PathBuf::from)
        .filter(|path| path.exists())
        .take(MAX_RECENT_DATABASES)
        .collect::<Vec<_>>();

    persist_recent_database_paths(app, &recent_paths)?;
    Ok(recent_paths)
}

fn push_recent_database_path(app: &AppHandle, path: &Path) -> Result<()> {
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let mut recent_paths = load_recent_database_paths(app)?;
    recent_paths.retain(|current| current != &canonical);
    recent_paths.insert(0, canonical);
    recent_paths.truncate(MAX_RECENT_DATABASES);

    persist_recent_database_paths(app, &recent_paths)?;
    Ok(())
}

fn persist_recent_database_paths(app: &AppHandle, recent_paths: &[PathBuf]) -> Result<()> {
    let serialized = serde_json::to_string_pretty(
        &recent_paths
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect::<Vec<_>>(),
    )
    .map_err(|error| AppError::msg(format!("Impossible d'enregistrer les fichiers récents : {}", error)))?;

    fs::write(recent_databases_file_path(app)?, serialized)?;
    Ok(())
}

fn recent_databases_file_path(app: &AppHandle) -> Result<PathBuf> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;
    Ok(app_data_dir.join(RECENT_DATABASES_FILE))
}

fn current_database_path(state: &State<CurrentDatabasePath>) -> Result<PathBuf> {
    state
        .0
        .lock()
        .map_err(|_| AppError::msg("Erreur d'accès au fichier courant"))
        .map(|path| path.clone())
}
