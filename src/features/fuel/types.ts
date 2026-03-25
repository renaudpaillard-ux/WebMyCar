export interface FuelEntry {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  entry_date: string;
  mileage: number;
  liters: number;
  total_price_cents: number;
  price_per_liter_millis: number | null;
  energy_type_id: string;
  energy_type_label: string;
  station: string | null;
  note: string | null;
  is_full_tank: boolean;
  trip_distance_km: number | null;
  consumption_l_per_100: number | null;
  created_at: string;
  updated_at: string;
}

export interface EnergyType {
  id: string;
  code: string;
  label: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateFuelEntryInput {
  vehicle_id: string;
  entry_date: string;
  mileage: number;
  liters: number;
  total_price_cents: number;
  price_per_liter_millis: number;
  energy_type_id: string;
  station: string | null;
  note: string | null;
  is_full_tank: boolean;
}

export interface UpdateFuelEntryInput extends CreateFuelEntryInput {
  id: string;
}

export interface ImportFuelCsvInput {
  vehicle_id: string;
  csv_content: string;
}

export type FuelCsvPreviewStatus = "ok" | "warning" | "rejected";
export type FuelCsvPreviewAction = "create" | "replace";

export interface FuelCsvPreviewLine {
  line_number: number;
  date: string;
  km: string;
  quantite: string;
  montant: string;
  prix_litre: string;
  lieu: string;
  plein: string;
  energie: string;
  observations: string;
  status: FuelCsvPreviewStatus;
  import_action: FuelCsvPreviewAction | null;
  messages: string[];
}

export interface PreviewFuelCsvResult {
  total_rows: number;
  valid_rows: number;
  replacement_rows: number;
  warning_rows: number;
  rejected_rows: number;
  lines: FuelCsvPreviewLine[];
}

export interface ImportFuelCsvLineError {
  line_number: number;
  message: string;
}

export interface ImportFuelCsvResult {
  created_count: number;
  replaced_count: number;
  rejected_count: number;
  recalculated_price_per_liter_count: number;
  preferred_energy_fallback_count: number;
  errors: ImportFuelCsvLineError[];
}
