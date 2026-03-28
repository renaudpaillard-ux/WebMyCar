import { useEffect, useMemo, useState } from "react";
import ModalFrame from "../components/ModalFrame";
import { useToast } from "../components/ToastProvider";
import VehicleSpecsModal from "../components/VehicleSpecsModal";
import { listEnergyTypes } from "../features/fuel/api";
import type { EnergyType } from "../features/fuel/types";
import { archiveVehicle, createVehicle, listVehicles, unarchiveVehicle, updateVehicle } from "../features/vehicles/api";
import type { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "../features/vehicles/types";

const POWERTRAIN_OPTIONS = [
  { value: "petrol", label: "Essence" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybride" },
  { value: "plug_in_hybrid", label: "Hybride rechargeable" },
  { value: "electric", label: "Électrique" },
  { value: "lpg", label: "GPL" },
  { value: "other", label: "Autre" },
] as const;

const POWERTRAIN_LABELS = new Map<string, string>(
  POWERTRAIN_OPTIONS.map((option) => [option.value, option.label]),
);

const ENERGY_CATEGORY_LABELS: Record<string, string> = {
  petrol: "Essences",
  diesel: "Gasoils",
  gas_energy: "Gaz et énergie",
  additive: "Additifs",
};

const ENERGY_CATEGORY_ORDER = ["petrol", "diesel", "gas_energy", "additive"];
interface EnergyTypeGroup {
  category: string;
  label: string;
  options: EnergyType[];
}

interface VehicleFormState {
  name: string;
  brand: string;
  model: string;
  registration: string;
  powertrain_type: string;
  compatible_energy_type_ids: string[];
  preferred_energy_type_id: string;
  initial_mileage: string;
}

const EMPTY_FORM: VehicleFormState = {
  name: "",
  brand: "",
  model: "",
  registration: "",
  powertrain_type: "",
  compatible_energy_type_ids: [],
  preferred_energy_type_id: "",
  initial_mileage: "",
};

function groupEnergyTypes(energyTypes: EnergyType[]): EnergyTypeGroup[] {
  const grouped = new Map<string, EnergyType[]>();

  for (const category of ENERGY_CATEGORY_ORDER) {
    grouped.set(category, []);
  }

  for (const energyType of energyTypes) {
    const category = grouped.has(energyType.category) ? energyType.category : "additive";
    grouped.get(category)?.push(energyType);
  }

  const result: EnergyTypeGroup[] = [];

  for (const category of ENERGY_CATEGORY_ORDER) {
    const options = grouped.get(category) ?? [];
    if (options.length === 0) {
      continue;
    }

    const label = ENERGY_CATEGORY_LABELS[category] ?? "Autres";
    const previousGroup = result[result.length - 1];

    if (previousGroup && previousGroup.label === label) {
      previousGroup.options.push(...options);
    } else {
      result.push({
        category,
        label,
        options: [...options],
      });
    }
  }

  return result;
}

function vehicleToForm(vehicle: Vehicle): VehicleFormState {
  return {
    name: vehicle.name,
    brand: vehicle.brand ?? "",
    model: vehicle.model ?? "",
    registration: vehicle.registration ?? "",
    powertrain_type: vehicle.powertrain_type ?? "",
    compatible_energy_type_ids: vehicle.compatible_energy_type_ids,
    preferred_energy_type_id: vehicle.preferred_energy_type_id ?? "",
    initial_mileage: String(vehicle.initial_mileage),
  };
}

function formatPowertrainLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return POWERTRAIN_LABELS.get(value) ?? value;
}

function getPowertrainBadgeClass(value: string | null): string {
  switch (value) {
    case "hybrid":
    case "plug_in_hybrid":
      return "badge badge--powertrain badge--powertrain-hybrid";
    case "electric":
      return "badge badge--powertrain badge--powertrain-electric";
    case "diesel":
      return "badge badge--powertrain badge--powertrain-diesel";
    default:
      return "badge badge--powertrain";
  }
}

function formatEnergyTypeLabels(
  ids: string[],
  energyTypeLabels: Map<string, string>,
): string {
  return ids.map((id) => energyTypeLabels.get(id) ?? id).join(", ");
}

function shouldIgnoreRowDoubleClick(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && target.closest("button, input, select, textarea, a, label") !== null;
}

interface VehicleModalProps {
  vehicle?: Vehicle;
  energyTypes: EnergyType[];
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}

function VehicleModal({ vehicle, energyTypes, onClose, onSaved }: VehicleModalProps) {
  const isEditing = vehicle !== undefined;
  const [form, setForm] = useState<VehicleFormState>(() =>
    vehicle ? vehicleToForm(vehicle) : EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const groupedEnergyTypes = useMemo(() => groupEnergyTypes(energyTypes), [energyTypes]);
  const preferredEnergyOptions = useMemo(
    () => energyTypes.filter((energyType) => form.compatible_energy_type_ids.includes(energyType.id)),
    [energyTypes, form.compatible_energy_type_ids],
  );

  function setField(field: keyof VehicleFormState) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((previous) => ({ ...previous, [field]: event.target.value }));
    };
  }

  function toggleCompatibleEnergyType(energyTypeId: string) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((previous) => {
        const nextIds = event.target.checked
          ? [...previous.compatible_energy_type_ids, energyTypeId]
          : previous.compatible_energy_type_ids.filter((current) => current !== energyTypeId);

        const preferredEnergyTypeId = nextIds.includes(previous.preferred_energy_type_id)
          ? previous.preferred_energy_type_id
          : nextIds[0] ?? "";

        return {
          ...previous,
          compatible_energy_type_ids: nextIds,
          preferred_energy_type_id: preferredEnergyTypeId,
        };
      });
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Le nom du véhicule est obligatoire.");
      return;
    }

    if (!form.powertrain_type) {
      setError("La motorisation est obligatoire.");
      return;
    }

    if (form.compatible_energy_type_ids.length === 0) {
      setError("Sélectionnez au moins une énergie compatible.");
      return;
    }

    if (!form.preferred_energy_type_id) {
      setError("L'énergie préférée est obligatoire.");
      return;
    }

    if (!form.compatible_energy_type_ids.includes(form.preferred_energy_type_id)) {
      setError("L'énergie préférée doit faire partie des énergies compatibles.");
      return;
    }

    const mileage = form.initial_mileage.trim() ? Number.parseInt(form.initial_mileage, 10) : 0;
    if (form.initial_mileage.trim() && Number.isNaN(mileage)) {
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
          powertrain_type: form.powertrain_type,
          preferred_energy_type_id: form.preferred_energy_type_id,
          compatible_energy_type_ids: form.compatible_energy_type_ids,
          initial_mileage: mileage,
        };
        saved = await updateVehicle(input);
      } else {
        const input: CreateVehicleInput = {
          name: form.name.trim(),
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          registration: form.registration.trim() || null,
          powertrain_type: form.powertrain_type,
          preferred_energy_type_id: form.preferred_energy_type_id,
          compatible_energy_type_ids: form.compatible_energy_type_ids,
          initial_mileage: mileage,
        };
        saved = await createVehicle(input);
      }

      onSaved(saved);
    } catch (currentError) {
      const fallback = isEditing
        ? "Impossible de modifier le véhicule."
        : "Impossible de créer le véhicule.";
      setError(typeof currentError === "string" ? currentError : fallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame
      title={isEditing ? "Modifier le véhicule" : "Nouveau véhicule"}
      onClose={onClose}
    >
      {energyTypes.length === 0 ? (
        <>
          <div className="modal__body">
            <div className="empty-state empty-state--compact">
              <p className="empty-state__title">Aucune énergie disponible</p>
              <p className="empty-state__body">
                Ajoutez d&apos;abord des types d&apos;énergie en base pour configurer un véhicule.
              </p>
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Fermer
            </button>
          </div>
        </>
      ) : (
        <form className="modal__form" onSubmit={handleSubmit}>
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
                  onChange={setField("name")}
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
                    onChange={setField("brand")}
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
                    onChange={setField("model")}
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
                    onChange={setField("registration")}
                    placeholder="ex. AB-123-CD"
                  />
                </div>
                <div>
                  <label className="form-label form-label--required" htmlFor="v-powertrain">
                    Motorisation
                  </label>
                  <select
                    id="v-powertrain"
                    className="form-select"
                    value={form.powertrain_type}
                    onChange={setField("powertrain_type")}
                  >
                    <option value="">— Sélectionner —</option>
                    {POWERTRAIN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label form-label--required">
                  Énergies compatibles
                </label>
                <div className="form-checkbox-grid">
                  {groupedEnergyTypes.map((group) => (
                    <div key={group.category} className="form-checkbox-group">
                      <div className="form-checkbox-group__title">{group.label}</div>
                      {group.options.map((energyType) => (
                        <label key={energyType.id} className="form-checkbox">
                          <input
                            type="checkbox"
                            checked={form.compatible_energy_type_ids.includes(energyType.id)}
                            onChange={toggleCompatibleEnergyType(energyType.id)}
                          />
                          <span>{energyType.label}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <label className="form-label form-label--required" htmlFor="v-preferred-energy">
                  Énergie préférée
                </label>
                <select
                  id="v-preferred-energy"
                  className="form-select"
                  value={form.preferred_energy_type_id}
                  onChange={setField("preferred_energy_type_id")}
                  disabled={preferredEnergyOptions.length === 0}
                >
                  <option value="">— Sélectionner —</option>
                  {preferredEnergyOptions.map((energyType) => (
                    <option key={energyType.id} value={energyType.id}>
                      {energyType.label}
                    </option>
                  ))}
                </select>
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
                  onChange={setField("initial_mileage")}
                  placeholder="0"
                />
              </div>
          </div>

          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? (isEditing ? "Enregistrement…" : "Ajout…") : isEditing ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}

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
    } catch (currentError) {
      setError(typeof currentError === "string" ? currentError : "Impossible d'archiver le véhicule.");
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame title="Archiver le véhicule" onClose={onCancel}>
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
    </ModalFrame>
  );
}

interface VehicleRowProps {
  vehicle: Vehicle;
  energyTypeLabels: Map<string, string>;
  onEdit: (vehicle: Vehicle) => void;
  onManageSpecs: (vehicle: Vehicle) => void;
  onArchive: (vehicle: Vehicle) => void;
  onUnarchive: (id: string) => void;
}

function VehicleRow({ vehicle, energyTypeLabels, onEdit, onManageSpecs, onArchive, onUnarchive }: VehicleRowProps) {
  const subtitle = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const [unarchiving, setUnarchiving] = useState(false);
  const compatibleEnergyLabels = formatEnergyTypeLabels(vehicle.compatible_energy_type_ids, energyTypeLabels);
  const preferredEnergyLabel = vehicle.preferred_energy_type_id
    ? energyTypeLabels.get(vehicle.preferred_energy_type_id) ?? vehicle.preferred_energy_type_id
    : null;

  async function handleUnarchive() {
    setUnarchiving(true);
    try {
      await unarchiveVehicle(vehicle.id);
      onUnarchive(vehicle.id);
    } catch (currentError) {
      console.error(currentError);
    } finally {
      setUnarchiving(false);
    }
  }

  return (
    <tr
      className={vehicle.is_archived ? "row--archived" : undefined}
      onDoubleClick={(event) => {
        if (!vehicle.is_archived && !shouldIgnoreRowDoubleClick(event.target)) {
          onEdit(vehicle);
        }
      }}
    >
      <td className="cell--primary">
        <div className="data-table__title data-table__title--strong">{vehicle.name}</div>
        {subtitle && <div className="data-table__muted">{subtitle}</div>}
      </td>
      <td className="cell--secondary">{vehicle.registration ?? <span className="data-table__muted">—</span>}</td>
      <td className="cell--secondary">
        {vehicle.powertrain_type ? (
          <>
            <span className={getPowertrainBadgeClass(vehicle.powertrain_type)}>
              {formatPowertrainLabel(vehicle.powertrain_type)}
            </span>
            {preferredEnergyLabel && (
              <div className="data-table__muted">Préférée: {preferredEnergyLabel}</div>
            )}
            {compatibleEnergyLabels && (
              <div className="data-table__muted">Compatibles: {compatibleEnergyLabels}</div>
            )}
          </>
        ) : (
          <span className="data-table__muted">—</span>
        )}
      </td>
      <td className="cell--actions">
        {vehicle.is_archived ? (
          <div className="table-actions">
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
          <div className="table-actions">
            <button className="btn btn--secondary btn--sm" onClick={() => onManageSpecs(vehicle)}>
              Fiche technique
            </button>
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

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [energyTypes, setEnergyTypes] = useState<EnergyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [specsVehicle, setSpecsVehicle] = useState<Vehicle | null>(null);
  const [archivingVehicle, setArchivingVehicle] = useState<Vehicle | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([listVehicles(showArchived), listEnergyTypes()])
      .then(([vehicleData, energyTypeData]) => {
        setVehicles(vehicleData);
        setEnergyTypes(energyTypeData);
        setError(null);
      })
      .catch((currentError) =>
        setError(typeof currentError === "string" ? currentError : "Impossible de charger les véhicules."),
      )
      .finally(() => setLoading(false));
  }, [showArchived]);

  const energyTypeLabels = useMemo(
    () => new Map(energyTypes.map((energyType) => [energyType.id, energyType.label])),
    [energyTypes],
  );

  function closeModal() {
    setShowCreate(false);
    setEditingVehicle(null);
  }

  function handleSaved(vehicle: Vehicle) {
    if (editingVehicle) {
      setVehicles((previous) => previous.map((current) => (current.id === vehicle.id ? vehicle : current)));
      showToast("Véhicule modifié");
    } else {
      setVehicles((previous) => [vehicle, ...previous]);
      showToast("Véhicule ajouté");
    }
    closeModal();
  }

  function handleArchived(id: string) {
    setArchivingVehicle(null);
    if (showArchived) {
      setVehicles((previous) => previous.map((vehicle) => (
        vehicle.id === id ? { ...vehicle, is_archived: true } : vehicle
      )));
    } else {
      setVehicles((previous) => previous.filter((vehicle) => vehicle.id !== id));
    }
    showToast("Véhicule archivé");
  }

  function handleUnarchived(id: string) {
    setVehicles((previous) => previous.map((vehicle) => (
      vehicle.id === id ? { ...vehicle, is_archived: false } : vehicle
    )));
    showToast("Véhicule réactivé");
  }

  const isEmpty = !loading && vehicles.length === 0;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Véhicules</h1>
          <p className="page-header__subtitle">Gérez vos fiches véhicules.</p>
        </div>
        <div className="page-actions vehicles-page__actions">
          <label className="form-switch">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
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
            Ajoutez votre premier véhicule pour commencer à suivre le carburant, l&apos;entretien et le kilométrage.
          </p>
          <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
            + Ajouter un véhicule
          </button>
        </div>
      ) : (
        <section className="surface-panel table-shell">
          <div className="table-scroll">
            <table className="data-table data-table--vehicles">
              <thead>
                <tr>
                  <th>Véhicule</th>
                  <th>Immatriculation</th>
                  <th>Motorisation</th>
                  <th className="cell--actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <VehicleRow
                    key={vehicle.id}
                    vehicle={vehicle}
                    energyTypeLabels={energyTypeLabels}
                    onEdit={setEditingVehicle}
                    onManageSpecs={setSpecsVehicle}
                    onArchive={setArchivingVehicle}
                    onUnarchive={handleUnarchived}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(showCreate || editingVehicle !== null) && (
        <VehicleModal
          vehicle={editingVehicle ?? undefined}
          energyTypes={energyTypes}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {specsVehicle !== null && (
        <VehicleSpecsModal
          vehicle={specsVehicle}
          onSaved={(_specs) => {}}
          onClose={() => setSpecsVehicle(null)}
        />
      )}

      {archivingVehicle !== null && (
        <ArchiveConfirmModal
          vehicle={archivingVehicle}
          onCancel={() => setArchivingVehicle(null)}
          onConfirmed={handleArchived}
        />
      )}
    </div>
  );
}
