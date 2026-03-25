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
