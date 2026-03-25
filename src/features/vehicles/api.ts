import { invoke } from "@tauri-apps/api/core";
import type { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "./types";

export async function listVehicles(includeArchived: boolean): Promise<Vehicle[]> {
  return invoke<Vehicle[]>("list_vehicles", { includeArchived });
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  return invoke<Vehicle>("create_vehicle", { input });
}

export async function updateVehicle(input: UpdateVehicleInput): Promise<Vehicle> {
  return invoke<Vehicle>("update_vehicle", { input });
}

export async function archiveVehicle(id: string): Promise<void> {
  return invoke<void>("archive_vehicle", { id });
}

export async function unarchiveVehicle(id: string): Promise<void> {
  return invoke<void>("unarchive_vehicle", { id });
}
