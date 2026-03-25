/** Full vehicle record as returned by the backend. */
export interface Vehicle {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  registration: string | null;
  vin: string | null;
  powertrain_type: string | null;
  preferred_energy_type_id: string | null;
  compatible_energy_type_ids: string[];
  engine_power_hp: number | null;
  purchase_date: string | null;
  purchase_price_cents: number | null;
  initial_mileage: number;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

/** Input DTO for creating a new vehicle (V1 form fields). */
export interface CreateVehicleInput {
  name: string;
  brand: string | null;
  model: string | null;
  registration: string | null;
  powertrain_type: string | null;
  preferred_energy_type_id: string | null;
  compatible_energy_type_ids: string[];
  initial_mileage: number;
}

/** Input DTO for updating an existing vehicle. */
export interface UpdateVehicleInput {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  registration: string | null;
  powertrain_type: string | null;
  preferred_energy_type_id: string | null;
  compatible_energy_type_ids: string[];
  initial_mileage: number;
}
