import { invoke } from "@tauri-apps/api/core";
import type { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "./types";

export async function listVehicles(): Promise<Vehicle[]> {
  return invoke<Vehicle[]>("list_vehicles");
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  return invoke<Vehicle>("create_vehicle", { input });
}

export async function updateVehicle(input: UpdateVehicleInput): Promise<Vehicle> {
  return invoke<Vehicle>("update_vehicle", { input });
}
