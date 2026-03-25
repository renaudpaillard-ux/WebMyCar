import { useEffect, useId, useMemo, useRef, useState } from "react";
import ModalFrame from "../components/ModalFrame";
import { createFuelEntry, deleteFuelEntry, importFuelCsv, listEnergyTypes, listFuelEntries, previewFuelCsv, updateFuelEntry } from "../features/fuel/api";
import type {
  CreateFuelEntryInput,
  EnergyType,
  FuelCsvPreviewAction,
  FuelEntry,
  ImportFuelCsvResult,
  PreviewFuelCsvResult,
  UpdateFuelEntryInput,
} from "../features/fuel/types";
import { listVehicles } from "../features/vehicles/api";
import type { Vehicle } from "../features/vehicles/types";

interface FuelFormState {
  vehicle_id: string;
  entry_date: string;
  mileage: string;
  liters: string;
  total_price: string;
  price_per_liter: string;
  energy_type_id: string;
  station: string;
  note: string;
  is_full_tank: boolean;
}

interface EnergyTypeGroup {
  category: string;
  label: string;
  options: EnergyType[];
}

const CATEGORY_LABELS: Record<string, string> = {
  petrol: "Essences",
  diesel: "Gasoils",
  gas_energy: "Gaz et énergie",
  additive: "Additifs",
};

const CATEGORY_ORDER = ["petrol", "diesel", "gas_energy", "additive"];
const SELECTED_VEHICLE_STORAGE_KEY = "webmycar:selected-fuel-vehicle";

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const EMPTY_FORM: FuelFormState = {
  vehicle_id: "",
  entry_date: getTodayDate(),
  mileage: "",
  liters: "",
  total_price: "",
  price_per_liter: "",
  energy_type_id: "",
  station: "",
  note: "",
  is_full_tank: true,
};

function formatDecimal(value: number, maximumFractionDigits: number): string {
  return value.toLocaleString("fr-FR", {
    useGrouping: false,
    maximumFractionDigits,
  });
}

function formatMoneyInput(cents: number | null): string {
  if (cents === null) {
    return "";
  }

  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatPricePerLiterInput(millis: number | null): string {
  if (millis === null) {
    return "";
  }

  return (millis / 1000).toFixed(3).replace(".", ",");
}

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEuroToCents(value: string): number | null {
  const amount = parseDecimal(value);
  if (amount === null) {
    return null;
  }

  return Math.round(amount * 100);
}

function parseEuroToMillis(value: string): number | null {
  const amount = parseDecimal(value);
  if (amount === null) {
    return null;
  }

  return Math.round(amount * 1000);
}

function computePricePerLiterMillis(totalPriceInput: string, litersInput: string): number | null {
  const totalPriceCents = parseEuroToCents(totalPriceInput);
  const liters = parseDecimal(litersInput);

  if (totalPriceCents === null || liters === null || liters <= 0) {
    return null;
  }

  return Math.round((totalPriceCents / 100) * 1000 / liters);
}

function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return value.toLocaleString("fr-FR", options);
}

function formatInteger(value: number | null | undefined): string {
  return formatNumber(value, {
    maximumFractionDigits: 0,
  });
}

function formatQuantity(value: number | null | undefined): string {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoneyAmount(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return "—";
  }

  return formatNumber(cents / 100, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUnitPrice(millis: number | null | undefined): string {
  if (millis === null || millis === undefined) {
    return "—";
  }

  return formatNumber(millis / 1000, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatConsumption(value: number | null | undefined): string {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function sortFuelEntries(entries: FuelEntry[]): FuelEntry[] {
  return [...entries].sort((left, right) =>
    right.mileage - left.mileage
    || right.entry_date.localeCompare(left.entry_date)
    || right.created_at.localeCompare(left.created_at),
  );
}

function getStationSuggestions(entries: FuelEntry[], vehicleId: string): string[] {
  const byRecency = [...entries].sort((left, right) =>
    right.entry_date.localeCompare(left.entry_date)
    || right.created_at.localeCompare(left.created_at),
  );

  function collectSuggestions(source: FuelEntry[]) {
    const seen = new Set<string>();
    const suggestions: string[] = [];

    for (const entry of source) {
      const station = entry.station?.trim();
      if (!station) {
        continue;
      }

      const normalized = station.toLocaleLowerCase("fr-FR");
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      suggestions.push(station);
    }

    return suggestions;
  }

  const vehicleSuggestions = vehicleId
    ? collectSuggestions(byRecency.filter((entry) => entry.vehicle_id === vehicleId))
    : [];

  if (vehicleSuggestions.length > 0) {
    return vehicleSuggestions;
  }

  return collectSuggestions(byRecency);
}

function shouldIgnoreRowDoubleClick(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && target.closest("button, input, select, textarea, a, label") !== null;
}

function fuelEntryToForm(entry: FuelEntry): FuelFormState {
  return {
    vehicle_id: entry.vehicle_id,
    entry_date: entry.entry_date,
    mileage: String(entry.mileage),
    liters: formatDecimal(entry.liters, 3),
    total_price: formatMoneyInput(entry.total_price_cents),
    price_per_liter: formatPricePerLiterInput(entry.price_per_liter_millis),
    energy_type_id: entry.energy_type_id,
    station: entry.station ?? "",
    note: entry.note ?? "",
    is_full_tank: entry.is_full_tank,
  };
}

function groupEnergyTypes(energyTypes: EnergyType[]): EnergyTypeGroup[] {
  const grouped = new Map<string, EnergyType[]>();

  for (const category of CATEGORY_ORDER) {
    grouped.set(category, []);
  }

  for (const energyType of energyTypes) {
    const category = grouped.has(energyType.category) ? energyType.category : "additive";
    grouped.get(category)?.push(energyType);
  }

  const result: EnergyTypeGroup[] = [];

  for (const category of CATEGORY_ORDER) {
    const options = grouped.get(category) ?? [];
    if (options.length === 0) {
      continue;
    }

    const label = CATEGORY_LABELS[category] ?? "Autres";
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

interface FuelModalProps {
  entry?: FuelEntry;
  entries: FuelEntry[];
  vehicles: Vehicle[];
  energyTypes: EnergyType[];
  selectedVehicleId?: string;
  onClose: () => void;
  onSaved: (entry: FuelEntry) => void;
}

function FuelModal({ entry, entries, vehicles, energyTypes, selectedVehicleId, onClose, onSaved }: FuelModalProps) {
  const isEditing = entry !== undefined;
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const vehicleMap = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles],
  );
  const stationListId = useId();
  const [form, setForm] = useState<FuelFormState>(() => {
    if (entry) {
      return fuelEntryToForm(entry);
    }

    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
    const firstVehicle = selectedVehicle ?? vehicles[0];
    return {
      ...EMPTY_FORM,
      vehicle_id: firstVehicle?.id ?? "",
      energy_type_id: firstVehicle?.preferred_energy_type_id ?? energyTypes[0]?.id ?? "",
    };
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastAutoPricePerLiter, setLastAutoPricePerLiter] = useState<string>(() => {
    if (entry?.price_per_liter_millis !== null && entry?.price_per_liter_millis !== undefined) {
      return formatPricePerLiterInput(entry.price_per_liter_millis);
    }

    const computed = computePricePerLiterMillis(
      formatMoneyInput(entry?.total_price_cents ?? null),
      entry ? formatDecimal(entry.liters, 3) : "",
    );
    return formatPricePerLiterInput(computed);
  });

  const groupedEnergyTypes = useMemo(() => groupEnergyTypes(energyTypes), [energyTypes]);
  const stationSuggestions = useMemo(
    () => getStationSuggestions(entries, form.vehicle_id),
    [entries, form.vehicle_id],
  );

  useEffect(() => {
    const computedPricePerLiter = formatPricePerLiterInput(
      computePricePerLiterMillis(form.total_price, form.liters),
    );

    if (!computedPricePerLiter) {
      if ((!form.price_per_liter || form.price_per_liter === lastAutoPricePerLiter) && form.price_per_liter !== "") {
        setForm((previous) => ({ ...previous, price_per_liter: "" }));
      }
      if (lastAutoPricePerLiter !== "") {
        setLastAutoPricePerLiter("");
      }
      return;
    }

    if ((!form.price_per_liter || form.price_per_liter === lastAutoPricePerLiter) && form.price_per_liter !== computedPricePerLiter) {
      setForm((previous) => ({ ...previous, price_per_liter: computedPricePerLiter }));
    }

    if (lastAutoPricePerLiter !== computedPricePerLiter) {
      setLastAutoPricePerLiter(computedPricePerLiter);
    }
  }, [form.liters, form.price_per_liter, form.total_price, lastAutoPricePerLiter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      dateInputRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function setField(field: keyof FuelFormState) {
    return (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
      const target = event.target;
      const value = target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : target.value;
      setForm((previous) => {
        if (field === "vehicle_id") {
          const selectedVehicle = vehicleMap.get(String(value));
          return {
            ...previous,
            vehicle_id: String(value),
            energy_type_id: selectedVehicle?.preferred_energy_type_id ?? previous.energy_type_id,
          };
        }

        return { ...previous, [field]: value };
      });
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.vehicle_id) {
      setError("Le véhicule est obligatoire.");
      return;
    }

    if (!form.entry_date) {
      setError("La date est obligatoire.");
      return;
    }

    const mileage = form.mileage.trim() ? Number.parseInt(form.mileage, 10) : Number.NaN;
    if (!Number.isInteger(mileage) || mileage < 0) {
      setError("Le kilométrage doit être un nombre supérieur ou égal à 0.");
      return;
    }

    const liters = parseDecimal(form.liters);
    if (liters === null || liters <= 0) {
      setError("La quantité doit être supérieure à 0.");
      return;
    }

    const totalPriceCents = parseEuroToCents(form.total_price);
    if (totalPriceCents === null || totalPriceCents < 0) {
      setError("Le montant doit être supérieur ou égal à 0.");
      return;
    }

    const pricePerLiterMillis = parseEuroToMillis(form.price_per_liter);
    if (pricePerLiterMillis === null || pricePerLiterMillis < 0) {
      setError("Le prix au litre doit être supérieur ou égal à 0.");
      return;
    }

    if (!form.energy_type_id) {
      setError("L'énergie est obligatoire.");
      return;
    }

    setSubmitting(true);
    try {
      let saved: FuelEntry;
      if (isEditing) {
        const input: UpdateFuelEntryInput = {
          id: entry.id,
          vehicle_id: form.vehicle_id,
          entry_date: form.entry_date,
          mileage,
          liters,
          total_price_cents: totalPriceCents,
          price_per_liter_millis: pricePerLiterMillis,
          energy_type_id: form.energy_type_id,
          station: form.station.trim() || null,
          note: form.note.trim() || null,
          is_full_tank: form.is_full_tank,
        };
        saved = await updateFuelEntry(input);
      } else {
        const input: CreateFuelEntryInput = {
          vehicle_id: form.vehicle_id,
          entry_date: form.entry_date,
          mileage,
          liters,
          total_price_cents: totalPriceCents,
          price_per_liter_millis: pricePerLiterMillis,
          energy_type_id: form.energy_type_id,
          station: form.station.trim() || null,
          note: form.note.trim() || null,
          is_full_tank: form.is_full_tank,
        };
        saved = await createFuelEntry(input);
      }

      onSaved(saved);
    } catch (currentError) {
      const fallback = isEditing
        ? "Impossible de modifier l'entrée carburant."
        : "Impossible d'ajouter l'entrée carburant.";
      setError(typeof currentError === "string" ? currentError : fallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame
      title={isEditing ? "Modifier une entrée carburant" : "Nouvelle entrée carburant"}
      onClose={onClose}
    >
      {vehicles.length === 0 ? (
        <>
          <div className="modal__body">
            <div className="empty-state empty-state--compact">
              <p className="empty-state__title">Aucun véhicule actif</p>
              <p className="empty-state__body">
                Créez d&apos;abord un véhicule actif pour enregistrer un plein ou une recharge.
              </p>
            </div>
          </div>
          <div className="modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Fermer
            </button>
          </div>
        </>
      ) : energyTypes.length === 0 ? (
        <>
          <div className="modal__body">
            <div className="empty-state empty-state--compact">
              <p className="empty-state__title">Aucune énergie disponible</p>
              <p className="empty-state__body">
                Aucune énergie active n&apos;est disponible pour enregistrer une entrée carburant.
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

              <div className="form-row row g-3">
                <div className="col-md-3">
                  <label className="form-label form-label--required" htmlFor="fuel-date">
                    Date
                  </label>
                  <input
                    ref={dateInputRef}
                    id="fuel-date"
                    name="entry_date"
                    type="date"
                    className="form-input form-control"
                    value={form.entry_date}
                    onChange={setField("entry_date")}
                    required
                  />
                </div>
                <div className="col-md-9">
                  <label className="form-label form-label--required" htmlFor="fuel-vehicle">
                    Véhicule
                  </label>
                  <select
                    id="fuel-vehicle"
                    className="form-select"
                    value={form.vehicle_id}
                    onChange={setField("vehicle_id")}
                  >
                    <option value="">— Sélectionner —</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row--2col">
                <div>
                  <label className="form-label form-label--required" htmlFor="fuel-mileage">
                    Kilométrage
                  </label>
                  <input
                    id="fuel-mileage"
                    className="form-input"
                    type="number"
                    min="0"
                    step="1"
                    value={form.mileage}
                    onChange={setField("mileage")}
                    placeholder="ex. 45210"
                  />
                </div>
                <div>
                  <label className="form-label form-label--required" htmlFor="fuel-liters">
                    Quantité (litres)
                  </label>
                  <input
                    id="fuel-liters"
                    className="form-input"
                    type="text"
                    inputMode="decimal"
                    value={form.liters}
                    onChange={setField("liters")}
                    placeholder="ex. 42,50"
                  />
                </div>
              </div>

              <div className="form-row--2col">
                <div>
                  <label className="form-label form-label--required" htmlFor="fuel-price">
                    Montant (€)
                  </label>
                  <input
                    id="fuel-price"
                    className="form-input"
                    type="text"
                    inputMode="decimal"
                    value={form.total_price}
                    onChange={setField("total_price")}
                    placeholder="ex. 78,34"
                  />
                </div>
                <div>
                  <label className="form-label form-label--required" htmlFor="fuel-price-per-liter">
                    Prix au litre (€ / L)
                  </label>
                  <input
                    id="fuel-price-per-liter"
                    className="form-input"
                    type="text"
                    inputMode="decimal"
                    value={form.price_per_liter}
                    onChange={setField("price_per_liter")}
                    placeholder="ex. 1,84"
                  />
                </div>
              </div>

              <div className="form-row">
                <label className="form-label form-label--required" htmlFor="fuel-energy">
                  Énergie
                </label>
                <select
                  id="fuel-energy"
                  className="form-select"
                  value={form.energy_type_id}
                  onChange={setField("energy_type_id")}
                >
                  <option value="">— Sélectionner —</option>
                  {groupedEnergyTypes.map((group) => (
                    <optgroup key={group.category} label={group.label}>
                      {group.options.map((energyType) => (
                        <option key={energyType.id} value={energyType.id}>
                          {energyType.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label className="form-checkbox" htmlFor="fuel-full-tank">
                  <input
                    id="fuel-full-tank"
                    type="checkbox"
                    checked={form.is_full_tank}
                    onChange={setField("is_full_tank")}
                  />
                  <span>Plein complet</span>
                </label>
              </div>

              <div className="form-row--2col">
                <div>
                  <label className="form-label" htmlFor="fuel-station">
                    Lieu
                  </label>
                  <input
                    id="fuel-station"
                    className="form-input"
                    type="text"
                    value={form.station}
                    onChange={setField("station")}
                    list={stationSuggestions.length > 0 ? stationListId : undefined}
                    autoComplete="off"
                    placeholder="ex. TotalEnergies, Paris"
                  />
                  {stationSuggestions.length > 0 && (
                    <datalist id={stationListId}>
                      {stationSuggestions.map((station) => (
                        <option key={station} value={station} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div>
                  <label className="form-label" htmlFor="fuel-note">
                    Observations
                  </label>
                  <textarea
                    id="fuel-note"
                    className="form-textarea"
                    value={form.note}
                    onChange={setField("note")}
                    placeholder="Ajoutez une remarque si nécessaire"
                    rows={3}
                  />
                </div>
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

interface DeleteFuelEntryModalProps {
  entry: FuelEntry;
  onCancel: () => void;
  onConfirmed: (id: string) => void;
}

function DeleteFuelEntryModal({ entry, onCancel, onConfirmed }: DeleteFuelEntryModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteFuelEntry(entry.id);
      onConfirmed(entry.id);
    } catch (currentError) {
      setError(typeof currentError === "string" ? currentError : "Impossible de supprimer l'entrée carburant.");
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame title="Supprimer l'entrée carburant" onClose={onCancel}>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}
          <p>
            Voulez-vous supprimer l&apos;entrée du <strong>{formatDisplayDate(entry.entry_date)}</strong> pour{" "}
            <strong>{entry.vehicle_name}</strong> ?
          </p>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="btn btn--danger" disabled={submitting} onClick={handleConfirm} autoFocus>
            {submitting ? "Suppression…" : "Supprimer"}
          </button>
        </div>
    </ModalFrame>
  );
}

function FuelImportSummaryModal({ result, onClose }: FuelImportSummaryModalProps) {
  return (
    <ModalFrame title="Résultat de l'import CSV" onClose={onClose}>
      <div className="modal__body">
        <div className="fuel-import-summary">
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Entrées créées</span>
            <strong className="fuel-import-summary__value">{formatInteger(result.created_count)}</strong>
          </div>
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Entrées remplacées</span>
            <strong className="fuel-import-summary__value">{formatInteger(result.replaced_count)}</strong>
          </div>
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Lignes rejetées</span>
            <strong className="fuel-import-summary__value">{formatInteger(result.rejected_count)}</strong>
          </div>
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Prix/L recalculés</span>
            <strong className="fuel-import-summary__value">{formatInteger(result.recalculated_price_per_liter_count)}</strong>
          </div>
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Énergie du véhicule utilisée</span>
            <strong className="fuel-import-summary__value">{formatInteger(result.preferred_energy_fallback_count)}</strong>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="fuel-import-errors">
            <p className="fuel-import-errors__title">Lignes rejetées</p>
            <ul className="fuel-import-errors__list">
              {result.errors.map((error) => (
                <li key={`${error.line_number}-${error.message}`}>
                  Ligne {error.line_number} : {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="modal__footer">
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </ModalFrame>
  );
}

function getPreviewActionLabel(action: FuelCsvPreviewAction | null): string | null {
  if (action === "create") {
    return "Création";
  }

  if (action === "replace") {
    return "Remplacement";
  }

  return null;
}

function FuelImportPreviewModal({ pendingImport, importing, onCancel, onConfirm }: FuelImportPreviewModalProps) {
  const { fileName, vehicleName, preview } = pendingImport;
  const hasImportableRows = preview.valid_rows > 0;

  return (
    <ModalFrame
      title="Prévisualisation de l'import CSV"
      onClose={onCancel}
      className="modal--wide"
    >
      <div className="modal__body">
        <div className="fuel-import-preview__meta">
          <div>
            <span className="fuel-import-preview__meta-label">Fichier</span>
            <strong className="fuel-import-preview__meta-value">{fileName}</strong>
          </div>
          <div>
            <span className="fuel-import-preview__meta-label">Véhicule</span>
            <strong className="fuel-import-preview__meta-value">{vehicleName}</strong>
          </div>
        </div>

        <div className="fuel-import-summary fuel-import-summary--preview">
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Lignes analysées</span>
            <strong className="fuel-import-summary__value">{formatInteger(preview.total_rows)}</strong>
          </div>
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Lignes valides</span>
            <strong className="fuel-import-summary__value">{formatInteger(preview.valid_rows)}</strong>
          </div>
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Remplacements prévus</span>
            <strong className="fuel-import-summary__value">{formatInteger(preview.replacement_rows)}</strong>
          </div>
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Lignes avec avertissements</span>
            <strong className="fuel-import-summary__value">{formatInteger(preview.warning_rows)}</strong>
          </div>
          <div className="fuel-import-summary__item">
            <span className="fuel-import-summary__label">Lignes rejetées</span>
            <strong className="fuel-import-summary__value">{formatInteger(preview.rejected_rows)}</strong>
          </div>
        </div>

        <div className="fuel-import-preview__table-wrap">
          <table className="data-table fuel-import-preview__table">
            <thead>
              <tr>
                <th>Ligne</th>
                <th>Date</th>
                <th className="cell--number">Km</th>
                <th className="cell--number">Quantité</th>
                <th className="cell--number">Montant</th>
                <th className="cell--number">Prix/L</th>
                <th>Lieu</th>
                <th>Plein</th>
                <th>Énergie</th>
                <th>Observations</th>
                <th>Statut</th>
                <th>Message(s)</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((line) => {
                const actionLabel = getPreviewActionLabel(line.import_action);

                return (
                  <tr key={line.line_number}>
                    <td className="cell--number">{formatInteger(line.line_number)}</td>
                    <td>{line.date}</td>
                    <td className="cell--number">{line.km}</td>
                    <td className="cell--number">{line.quantite}</td>
                    <td className="cell--number">{line.montant}</td>
                    <td className="cell--number">{line.prix_litre}</td>
                    <td>{line.lieu}</td>
                    <td>{line.plein}</td>
                    <td>{line.energie}</td>
                    <td className="fuel-import-preview__observations" title={line.observations}>
                      {line.observations}
                    </td>
                    <td>
                      <div className="fuel-import-preview__status">
                        {line.status === "rejected" ? (
                          <span className="badge badge--danger">Rejetée</span>
                        ) : (
                          <>
                            {actionLabel && (
                              <span className={`badge ${line.import_action === "replace" ? "badge--info" : "badge--success"}`}>
                                {actionLabel}
                              </span>
                            )}
                            <span className={`badge ${line.status === "warning" ? "badge--warning" : "badge--neutral"}`}>
                              {line.status === "warning" ? "Avertissement" : "OK"}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      {line.messages.length > 0 ? (
                        <div className="fuel-import-preview__messages">
                          {line.messages.map((message) => (
                            <div key={message}>{message}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="data-table__muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="modal__footer">
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={importing}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onConfirm}
          disabled={importing || !hasImportableRows}
        >
          {importing ? "Import en cours…" : "Importer"}
        </button>
      </div>
    </ModalFrame>
  );
}

interface FuelRowProps {
  entry: FuelEntry;
  canEdit: boolean;
  onEdit: (entry: FuelEntry) => void;
  onDelete: (entry: FuelEntry) => void;
}

interface FuelStats {
  averageConsumption: number | null;
  latestConsumption: number | null;
  trackedDistance: number | null;
}

interface FuelImportSummaryModalProps {
  result: ImportFuelCsvResult;
  onClose: () => void;
}

interface PendingFuelImport {
  fileName: string;
  vehicleId: string;
  vehicleName: string;
  csvContent: string;
  preview: PreviewFuelCsvResult;
}

interface FuelImportPreviewModalProps {
  pendingImport: PendingFuelImport;
  importing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function FuelRow({ entry, canEdit, onEdit, onDelete }: FuelRowProps) {
  return (
    <tr
      onDoubleClick={(event) => {
        if (canEdit && !shouldIgnoreRowDoubleClick(event.target)) {
          onEdit(entry);
        }
      }}
    >
      <td>{formatDisplayDate(entry.entry_date)}</td>
      <td className="cell--number">{formatInteger(entry.mileage)}</td>
      <td className="cell--number">{formatInteger(entry.trip_distance_km)}</td>
      <td className="cell--number">{formatQuantity(entry.liters)}</td>
      <td className="cell--number">{formatMoneyAmount(entry.total_price_cents)}</td>
      <td className="cell--number">{formatUnitPrice(entry.price_per_liter_millis)}</td>
      <td className="cell--number">{formatConsumption(entry.consumption_l_per_100)}</td>
      <td>
        <span className="badge badge--neutral">{entry.energy_type_label}</span>
      </td>
      <td>{entry.station ?? <span className="data-table__muted">—</span>}</td>
      <td>
        {entry.is_full_tank ? (
          <span className="badge badge--neutral">Complet</span>
        ) : (
          <span className="badge badge--warning">Partiel</span>
        )}
      </td>
      <td>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn--secondary btn--sm" onClick={() => onEdit(entry)} disabled={!canEdit}>
            Modifier
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => onDelete(entry)}>
            Supprimer
          </button>
        </div>
      </td>
    </tr>
  );
}

function getFuelStats(entries: FuelEntry[]): FuelStats {
  const consumptions = entries
    .map((entry) => entry.consumption_l_per_100)
    .filter((value): value is number => value !== null);

  const averageConsumption = consumptions.length > 0
    ? consumptions.reduce((sum, value) => sum + value, 0) / consumptions.length
    : null;

  const latestConsumptionEntry = entries.find((entry) => entry.consumption_l_per_100 !== null);
  const latestConsumption = latestConsumptionEntry?.consumption_l_per_100 ?? null;

  if (entries.length < 2) {
    return {
      averageConsumption,
      latestConsumption,
      trackedDistance: null,
    };
  }

  const mileages = entries.map((entry) => entry.mileage);
  const minMileage = Math.min(...mileages);
  const maxMileage = Math.max(...mileages);
  const trackedDistance = maxMileage > minMileage ? maxMileage - minMileage : null;

  return {
    averageConsumption,
    latestConsumption,
    trackedDistance,
  };
}

export default function FuelPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [energyTypes, setEnergyTypes] = useState<EnergyType[]>([]);
  const [storedSelectedVehicleId, setStoredSelectedVehicleId] = useState(() =>
    window.localStorage.getItem(SELECTED_VEHICLE_STORAGE_KEY) ?? "",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FuelEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<FuelEntry | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingFuelImport | null>(null);
  const [importResult, setImportResult] = useState<ImportFuelCsvResult | null>(null);

  async function loadFuelPageData() {
    return Promise.all([listFuelEntries(), listVehicles(false), listEnergyTypes()])
      .then(([fuelEntries, activeVehicles, activeEnergyTypes]) => {
        setEntries(fuelEntries);
        setVehicles(activeVehicles);
        setEnergyTypes(activeEnergyTypes);
        setError(null);
      })
      .catch((currentError) =>
        setError(
          typeof currentError === "string"
            ? currentError
            : "Impossible de charger les entrées carburant.",
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void loadFuelPageData();
  }, []);

  const selectedVehicleId = useMemo(() => {
    if (vehicles.length === 0) {
      return "";
    }

    if (storedSelectedVehicleId && vehicles.some((vehicle) => vehicle.id === storedSelectedVehicleId)) {
      return storedSelectedVehicleId;
    }

    return vehicles[0]?.id ?? "";
  }, [vehicles, storedSelectedVehicleId]);

  useEffect(() => {
    if (!selectedVehicleId) {
      window.localStorage.removeItem(SELECTED_VEHICLE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, selectedVehicleId);
  }, [selectedVehicleId]);

  const activeVehicleIds = useMemo(() => new Set(vehicles.map((vehicle) => vehicle.id)), [vehicles]);
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId],
  );
  const filteredEntries = useMemo(
    () => entries.filter((entry) => entry.vehicle_id === selectedVehicleId),
    [entries, selectedVehicleId],
  );
  const displayedEntries = useMemo(() => sortFuelEntries(filteredEntries), [filteredEntries]);
  const stats = useMemo(() => getFuelStats(displayedEntries), [displayedEntries]);
  const hasActiveEnergyTypes = energyTypes.length > 0;
  const hasActiveVehicles = vehicles.length > 0;
  const isEmpty = !loading && selectedVehicleId !== "" && displayedEntries.length === 0;

  function closeModal() {
    setShowCreate(false);
    setEditingEntry(null);
  }

  function handleSaved(entry: FuelEntry) {
    if (editingEntry) {
      setEntries((previous) => previous.map((current) => (current.id === entry.id ? entry : current)));
    } else {
      setEntries((previous) => [entry, ...previous]);
    }
    closeModal();
  }

  function handleDeleted(id: string) {
    setDeletingEntry(null);
    setEntries((previous) => previous.filter((current) => current.id !== id));
  }

  async function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !selectedVehicleId || !selectedVehicle) {
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const csvContent = await file.text();
      const preview = await previewFuelCsv({
        vehicle_id: selectedVehicleId,
        csv_content: csvContent,
      });

      setPendingImport({
        fileName: file.name,
        vehicleId: selectedVehicleId,
        vehicleName: selectedVehicle.name,
        csvContent,
        preview,
      });
    } catch (currentError) {
      setError(typeof currentError === "string" ? currentError : "Impossible d'analyser le fichier CSV.");
    } finally {
      setImporting(false);
    }
  }

  async function handleConfirmImport() {
    if (!pendingImport) {
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const result = await importFuelCsv({
        vehicle_id: pendingImport.vehicleId,
        csv_content: pendingImport.csvContent,
      });

      await loadFuelPageData();
      setPendingImport(null);
      setImportResult(result);
    } catch (currentError) {
      setError(typeof currentError === "string" ? currentError : "Impossible d'importer le fichier CSV.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Carburant</h1>
          <p className="page-header__subtitle">
            Enregistrez vos pleins et recharges, véhicule par véhicule.
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => setShowCreate(true)}
          disabled={!hasActiveVehicles || !hasActiveEnergyTypes}
        >
          + Ajouter une entrée
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />

      {hasActiveVehicles && (
        <>
          <div className="form-row" style={{ maxWidth: 360 }}>
            <label className="form-label form-label--required" htmlFor="fuel-page-vehicle">
              Véhicule
            </label>
            <select
              id="fuel-page-vehicle"
              className="form-select"
              value={selectedVehicleId}
              onChange={(event) => setStoredSelectedVehicleId(event.target.value)}
            >
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedVehicleId || importing}
            >
              {importing ? "Import en cours…" : "Importer CSV"}
            </button>
          </div>

          <div className="fuel-stats">
            <div className="fuel-stats__card">
              <div className="fuel-stats__label">Conso moyenne</div>
              <div className="fuel-stats__value">{formatConsumption(stats.averageConsumption)}</div>
            </div>
            <div className="fuel-stats__card">
              <div className="fuel-stats__label">Dernière conso</div>
              <div className="fuel-stats__value">{formatConsumption(stats.latestConsumption)}</div>
            </div>
            <div className="fuel-stats__card">
              <div className="fuel-stats__label">Distance suivie</div>
              <div className="fuel-stats__value">{formatInteger(stats.trackedDistance)}</div>
            </div>
          </div>
        </>
      )}

      {error && <div className="error-banner">{error}</div>}

      {!loading && !hasActiveVehicles ? (
        <div className="empty-state">
          <p className="empty-state__title">Aucun véhicule actif</p>
          <p className="empty-state__body">
            Créez d&apos;abord un véhicule pour commencer à enregistrer vos pleins et recharges.
          </p>
        </div>
      ) : !loading && !hasActiveEnergyTypes && entries.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">Aucune énergie disponible</p>
          <p className="empty-state__body">
            Aucune énergie active n&apos;est disponible. Ajoutez d&apos;abord des types d&apos;énergie en base.
          </p>
        </div>
      ) : isEmpty ? (
        <div className="empty-state">
          <p className="empty-state__title">Aucune entrée carburant</p>
          <p className="empty-state__body">
            {selectedVehicle
              ? `Aucune entrée n'est encore enregistrée pour ${selectedVehicle.name}.`
              : "Ajoutez votre premier plein ou votre première recharge pour commencer votre suivi."}
          </p>
          <button
            className="btn btn--primary"
            onClick={() => setShowCreate(true)}
            disabled={!hasActiveVehicles || !hasActiveEnergyTypes}
          >
            + Ajouter une entrée
          </button>
        </div>
      ) : loading ? null : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th className="cell--number">Km total (km)</th>
              <th className="cell--number">Parcouru (km)</th>
              <th className="cell--number">Quantité (L)</th>
              <th className="cell--number">Montant (€)</th>
              <th className="cell--number">Prix/L (€/L)</th>
              <th className="cell--number">Conso (L/100)</th>
              <th>Énergie</th>
              <th>Lieu</th>
              <th>Plein</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayedEntries.map((entry) => (
              <FuelRow
                key={entry.id}
                entry={entry}
                canEdit={activeVehicleIds.has(entry.vehicle_id)}
                onEdit={setEditingEntry}
                onDelete={setDeletingEntry}
              />
            ))}
          </tbody>
        </table>
      )}

      {(showCreate || editingEntry !== null) && (
        <FuelModal
          entry={editingEntry ?? undefined}
          entries={entries}
          vehicles={vehicles}
          energyTypes={energyTypes}
          selectedVehicleId={selectedVehicleId}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {deletingEntry !== null && (
        <DeleteFuelEntryModal
          entry={deletingEntry}
          onCancel={() => setDeletingEntry(null)}
          onConfirmed={handleDeleted}
        />
      )}

      {pendingImport !== null && (
        <FuelImportPreviewModal
          pendingImport={pendingImport}
          importing={importing}
          onCancel={() => setPendingImport(null)}
          onConfirm={handleConfirmImport}
        />
      )}

      {importResult !== null && (
        <FuelImportSummaryModal
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}
    </>
  );
}
