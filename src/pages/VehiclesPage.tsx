import { useEffect, useState } from "react";
import { createVehicle, listVehicles, updateVehicle } from "../features/vehicles/api";
import type { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "../features/vehicles/types";

const FUEL_TYPES = ["Essence", "Diesel", "Électrique", "Hybride", "Hybride rechargeable", "GPL", "Autre"];

// ─── Vehicle modal (create + edit) ───────────────────────────────────────────

interface VehicleFormState {
  name: string;
  brand: string;
  model: string;
  registration: string;
  fuel_type: string;
  initial_mileage: string;
}

const EMPTY_FORM: VehicleFormState = {
  name: "",
  brand: "",
  model: "",
  registration: "",
  fuel_type: "",
  initial_mileage: "",
};

function vehicleToForm(vehicle: Vehicle): VehicleFormState {
  return {
    name: vehicle.name,
    brand: vehicle.brand ?? "",
    model: vehicle.model ?? "",
    registration: vehicle.registration ?? "",
    fuel_type: vehicle.fuel_type ?? "",
    initial_mileage: String(vehicle.initial_mileage),
  };
}

interface VehicleModalProps {
  vehicle?: Vehicle; // present = edit mode, absent = create mode
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}

function VehicleModal({ vehicle, onClose, onSaved }: VehicleModalProps) {
  const isEditing = vehicle !== undefined;

  const [form, setForm] = useState<VehicleFormState>(() =>
    vehicle ? vehicleToForm(vehicle) : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set(field: keyof VehicleFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Le nom du véhicule est obligatoire.");
      return;
    }

    const mileage = form.initial_mileage.trim() ? parseInt(form.initial_mileage, 10) : 0;
    if (form.initial_mileage.trim() && isNaN(mileage)) {
      setError("Le kilométrage initial doit être un nombre.");
      return;
    }

    setSubmitting(true);
    try {
      let saved: Vehicle;
      if (isEditing) {
        const input: UpdateVehicleInput = {
          id: vehicle.id,
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          registration: form.registration.trim() || null,
          fuel_type: form.fuel_type || null,
          initial_mileage: mileage,
        };
        saved = await updateVehicle(input);
      } else {
        const input: CreateVehicleInput = {
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          registration: form.registration.trim() || null,
          fuel_type: form.fuel_type || null,
          initial_mileage: mileage,
        };
        saved = await createVehicle(input);
      }
      onSaved(saved);
    } catch (err) {
      const fallback = isEditing
        ? "Impossible de modifier le véhicule."
        : "Impossible de créer le véhicule.";
      setError(typeof err === "string" ? err : fallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">
            {isEditing ? "Modifier le véhicule" : "Nouveau véhicule"}
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            {error && <div className="error-banner">{error}</div>}

            <div className="form-row">
              <label className="form-label form-label--required" htmlFor="v-name">
                Nom
              </label>
              <input
                id="v-name"
                className="form-input"
                type="text"
                value={form.name}
                onChange={set("name")}
                placeholder="ex. Ma voiture"
                autoFocus
              />
            </div>

            <div className="form-row--2col">
              <div>
                <label className="form-label" htmlFor="v-brand">
                  Marque
                </label>
                <input
                  id="v-brand"
                  className="form-input"
                  type="text"
                  value={form.brand}
                  onChange={set("brand")}
                  placeholder="ex. Peugeot"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="v-model">
                  Modèle
                </label>
                <input
                  id="v-model"
                  className="form-input"
                  type="text"
                  value={form.model}
                  onChange={set("model")}
                  placeholder="ex. 308"
                />
              </div>
            </div>

            <div className="form-row--2col">
              <div>
                <label className="form-label" htmlFor="v-registration">
                  Immatriculation
                </label>
                <input
                  id="v-registration"
                  className="form-input"
                  type="text"
                  value={form.registration}
                  onChange={set("registration")}
                  placeholder="ex. AB-123-CD"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="v-fuel">
                  Type de carburant
                </label>
                <select
                  id="v-fuel"
                  className="form-select"
                  value={form.fuel_type}
                  onChange={set("fuel_type")}
                >
                  <option value="">— Sélectionner —</option>
                  {FUEL_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {ft}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="v-mileage">
                Kilométrage initial (km)
              </label>
              <input
                id="v-mileage"
                className="form-input"
                type="number"
                min="0"
                value={form.initial_mileage}
                onChange={set("initial_mileage")}
                placeholder="0"
              />
            </div>
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? "Enregistrement…" : isEditing ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Vehicle list ─────────────────────────────────────────────────────────────

interface VehicleRowProps {
  vehicle: Vehicle;
  onEdit: (vehicle: Vehicle) => void;
}

function VehicleRow({ vehicle, onEdit }: VehicleRowProps) {
  const subtitle = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 500 }}>{vehicle.name}</div>
        {subtitle && <div className="data-table__muted">{subtitle}</div>}
      </td>
      <td>{vehicle.registration ?? <span className="data-table__muted">—</span>}</td>
      <td>
        {vehicle.fuel_type ? (
          <span className="badge badge--neutral">{vehicle.fuel_type}</span>
        ) : (
          <span className="data-table__muted">—</span>
        )}
      </td>
      <td>{vehicle.initial_mileage.toLocaleString()} km</td>
      <td>
        <button className="btn btn--secondary btn--sm" onClick={() => onEdit(vehicle)}>
          Modifier
        </button>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    listVehicles()
      .then(setVehicles)
      .catch((err) => setError(typeof err === "string" ? err : "Impossible de charger les véhicules."))
      .finally(() => setLoading(false));
  }, []);

  function closeModal() {
    setShowCreate(false);
    setEditingVehicle(null);
  }

  function handleSaved(vehicle: Vehicle) {
    if (editingVehicle) {
      setVehicles((prev) => prev.map((v) => (v.id === vehicle.id ? vehicle : v)));
    } else {
      setVehicles((prev) => [vehicle, ...prev]);
    }
    closeModal();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Véhicules</h1>
          <p className="page-header__subtitle">Gérez vos fiches véhicules.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
          + Ajouter un véhicule
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? null : vehicles.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Aucun véhicule</p>
          <p className="empty-state__body">
            Ajoutez votre premier véhicule pour commencer à suivre le carburant, l'entretien et le kilométrage.
          </p>
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            + Ajouter un véhicule
          </button>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Véhicule</th>
              <th>Immatriculation</th>
              <th>Carburant</th>
              <th>Kilométrage initial</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <VehicleRow key={v.id} vehicle={v} onEdit={setEditingVehicle} />
            ))}
          </tbody>
        </table>
      )}

      {(showCreate || editingVehicle !== null) && (
        <VehicleModal
          vehicle={editingVehicle ?? undefined}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
