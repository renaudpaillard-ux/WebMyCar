import { invoke } from "@tauri-apps/api/core";
import type { CreateFuelEntryInput, EnergyType, FuelEntry, UpdateFuelEntryInput } from "./types";

export async function listFuelEntries(): Promise<FuelEntry[]> {
  return invoke<FuelEntry[]>("list_fuel_entries");
}

export async function listEnergyTypes(): Promise<EnergyType[]> {
  return invoke<EnergyType[]>("list_energy_types");
}

export async function createFuelEntry(input: CreateFuelEntryInput): Promise<FuelEntry> {
  return invoke<FuelEntry>("create_fuel_entry", { input });
}

export async function updateFuelEntry(input: UpdateFuelEntryInput): Promise<FuelEntry> {
  return invoke<FuelEntry>("update_fuel_entry", { input });
}

export async function deleteFuelEntry(id: string): Promise<void> {
  return invoke<void>("delete_fuel_entry", { id });
}
