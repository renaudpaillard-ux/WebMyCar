import { invoke } from "@tauri-apps/api/core";
import type { CurrentDatabaseInfo } from "./types";

export async function getCurrentDatabaseInfo(): Promise<CurrentDatabaseInfo> {
  return invoke<CurrentDatabaseInfo>("get_current_database_info");
}

export async function createDatabaseAtPath(path: string): Promise<CurrentDatabaseInfo> {
  return invoke<CurrentDatabaseInfo>("create_database_at_path", { path });
}

export async function openDatabaseAtPath(path: string): Promise<CurrentDatabaseInfo> {
  return invoke<CurrentDatabaseInfo>("open_database_at_path", { path });
}

export async function saveDatabaseAsPath(path: string): Promise<CurrentDatabaseInfo> {
  return invoke<CurrentDatabaseInfo>("save_database_as_path", { path });
}

export async function revealCurrentDatabaseInFolder(): Promise<void> {
  return invoke<void>("reveal_current_database_in_folder");
}
