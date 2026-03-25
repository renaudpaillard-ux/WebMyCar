import { invoke } from "@tauri-apps/api/core";
import type { CreateVehicleInput, Vehicle } from "./types";

export async function listVehicles(): Promise<Vehicle[]> {
  return invoke<Vehicle[]>("list_vehicles");
}

export async function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  return invoke<Vehicle>("create_vehicle", { input });
}
