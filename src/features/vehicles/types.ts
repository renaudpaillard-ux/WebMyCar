/** Full vehicle record as returned by the backend. */
export interface Vehicle {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  registration: string | null;
  vin: string | null;
  fuel_type: string | null;
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
  fuel_type: string | null;
  initial_mileage: number;
}
