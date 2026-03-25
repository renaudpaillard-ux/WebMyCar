import { useEffect, useState } from "react";
import { archiveVehicle, createVehicle, listVehicles, unarchiveVehicle, updateVehicle } from "../features/vehicles/api";
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

// ─── Archive confirmation modal ───────────────────────────────────────────────

interface ArchiveConfirmModalProps {
  vehicle: Vehicle;
  onCancel: () => void;
  onConfirmed: (id: string) => void;
}

function ArchiveConfirmModal({ vehicle, onCancel, onConfirmed }: ArchiveConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await archiveVehicle(vehicle.id);
      onConfirmed(vehicle.id);
    } catch (err) {
      setError(typeof err === "string" ? err : "Impossible d'archiver le véhicule.");
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Archiver le véhicule</h2>
          <button className="modal__close" onClick={onCancel} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}
          <p>
            Voulez-vous archiver <strong>{vehicle.name}</strong> ? Le véhicule ne sera plus
            affiché dans la liste principale, mais ses données seront conservées.
          </p>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? "Archivage…" : "Archiver"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Vehicle list ─────────────────────────────────────────────────────────────

interface VehicleRowProps {
  vehicle: Vehicle;
  onEdit: (vehicle: Vehicle) => void;
  onArchive: (vehicle: Vehicle) => void;
  onUnarchive: (id: string) => void;
}

function VehicleRow({ vehicle, onEdit, onArchive, onUnarchive }: VehicleRowProps) {
  const subtitle = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const [unarchiving, setUnarchiving] = useState(false);

  async function handleUnarchive() {
    setUnarchiving(true);
    try {
      await unarchiveVehicle(vehicle.id);
      onUnarchive(vehicle.id);
    } catch (err) {
      // Surface the error inline — keep the row visible
      console.error(err);
    } finally {
      setUnarchiving(false);
    }
  }

  return (
    <tr className={vehicle.is_archived ? "row--archived" : undefined}>
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
        {vehicle.is_archived ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="badge badge--neutral">Archivé</span>
            <button
              className="btn btn--secondary btn--sm"
              disabled={unarchiving}
              onClick={handleUnarchive}
            >
              {unarchiving ? "…" : "Réactiver"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn--secondary btn--sm" onClick={() => onEdit(vehicle)}>
              Modifier
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => onArchive(vehicle)}>
              Archiver
            </button>
          </div>
        )}
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
  const [archivingVehicle, setArchivingVehicle] = useState<Vehicle | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    listVehicles(showArchived)
      .then((data) => {
        setVehicles(data);
        setError(null);
      })
      .catch((err) => setError(typeof err === "string" ? err : "Impossible de charger les véhicules."))
      .finally(() => setLoading(false));
  }, [showArchived]);

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

  function handleArchived(id: string) {
    setArchivingVehicle(null);
    if (showArchived) {
      // Keep the row but flip its archived flag in place
      setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, is_archived: true } : v)));
    } else {
      // Remove it from the active list
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    }
  }

  function handleUnarchived(id: string) {
    // The row is always visible when this is called (showArchived is true).
    // Flip the flag in place so the row switches back to active state.
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, is_archived: false } : v)));
  }

  const isEmpty = !loading && vehicles.length === 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Véhicules</h1>
          <p className="page-header__subtitle">Gérez vos fiches véhicules.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "var(--color-text-secondary)" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Afficher les véhicules archivés
          </label>
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            + Ajouter un véhicule
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? null : isEmpty ? (
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
              <VehicleRow
                key={v.id}
                vehicle={v}
                onEdit={setEditingVehicle}
                onArchive={setArchivingVehicle}
                onUnarchive={handleUnarchived}
              />
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

      {archivingVehicle !== null && (
        <ArchiveConfirmModal
          vehicle={archivingVehicle}
          onCancel={() => setArchivingVehicle(null)}
          onConfirmed={handleArchived}
        />
      )}
    </>
  );
}
