import { useEffect, useId, useMemo, useState } from "react";
import { listVehicleSpecs, saveVehicleSpecs } from "../features/vehicles/api";
import type { Vehicle, VehicleSpec, VehicleSpecInput } from "../features/vehicles/types";
import ModalFrame from "./ModalFrame";
import { useToast } from "./ToastProvider";

const SUGGESTED_CATEGORIES = [
  "Pneumatiques",
  "Entretien",
  "Sécurité",
  "Équipements",
  "Achat",
  "Autres informations",
];

const LABEL_SUGGESTIONS_BY_CATEGORY: Record<string, string[]> = {
  Pneumatiques: ["Pneus", "Modèle", "Roue de secours"],
  Entretien: ["Bougies", "Essuie-glace AV conducteur", "Essuie-glace AV passager", "Batterie"],
  Sécurité: ["Boulons antivol", "Référence", "Julian Date"],
  Équipements: ["Tracker GPS", "Identifiant", "Caméra", "Tapis"],
  Achat: ["Lieu achat", "Contact", "N° ANTS", "KM à l'achat", "Prix d'achat"],
  "Autres informations": ["Note", "Référence", "Commentaire"],
};

interface VehicleSpecDraft {
  localId: string;
  category: string;
  label: string;
  value: string;
  extra: string;
  order_index: number;
}

interface VehicleSpecsModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onSaved: (specs: VehicleSpec[]) => void;
}

function specToDraft(spec: VehicleSpec): VehicleSpecDraft {
  return {
    localId: spec.id,
    category: spec.category,
    label: spec.label,
    value: spec.value,
    extra: spec.extra ?? "",
    order_index: spec.order_index,
  };
}

function normalizeCategory(value: string): string {
  const trimmed = value.trim();
  return trimmed || "Autres informations";
}

function sortDrafts(left: VehicleSpecDraft, right: VehicleSpecDraft): number {
  return left.order_index - right.order_index || left.label.localeCompare(right.label, "fr");
}

function reindexCategory(drafts: VehicleSpecDraft[], category: string): VehicleSpecDraft[] {
  const normalizedCategory = normalizeCategory(category);
  let orderIndex = 0;

  return drafts.map((draft) => {
    if (normalizeCategory(draft.category) !== normalizedCategory) {
      return draft;
    }

    const nextDraft = {
      ...draft,
      category: normalizedCategory,
      order_index: orderIndex,
    };
    orderIndex += 1;
    return nextDraft;
  });
}

function getNextOrderIndex(drafts: VehicleSpecDraft[], category: string): number {
  const normalizedCategory = normalizeCategory(category);
  return drafts.filter((draft) => normalizeCategory(draft.category) === normalizedCategory).length;
}

function trimDraftValue(value: string): string {
  return value.trim();
}

function normalizeDraft(draft: VehicleSpecDraft): VehicleSpecDraft {
  return {
    ...draft,
    category: normalizeCategory(draft.category),
    label: trimDraftValue(draft.label),
    value: trimDraftValue(draft.value),
    extra: trimDraftValue(draft.extra),
  };
}

function isDraftCompletelyEmpty(draft: VehicleSpecDraft): boolean {
  return !draft.label && !draft.value;
}

function isDraftIncomplete(draft: VehicleSpecDraft): boolean {
  return Boolean(trimDraftValue(draft.label)) !== Boolean(trimDraftValue(draft.value));
}

export default function VehicleSpecsModal({ vehicle, onClose, onSaved }: VehicleSpecsModalProps) {
  const categoryListId = useId();
  const labelListPrefix = useId();
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<VehicleSpecDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    void listVehicleSpecs(vehicle.id)
      .then((specs) => {
        setDrafts(specs.map(specToDraft));
      })
      .catch((currentError) => {
        setError(typeof currentError === "string" ? currentError : "Impossible de charger la fiche technique.");
      })
      .finally(() => setLoading(false));
  }, [vehicle.id]);

  const categories = useMemo(() => {
    const customCategories = drafts
      .map((draft) => normalizeCategory(draft.category))
      .filter((category) => !SUGGESTED_CATEGORIES.includes(category))
      .sort((left, right) => left.localeCompare(right, "fr"));

    return [...SUGGESTED_CATEGORIES, ...customCategories];
  }, [drafts]);

  function setDraftField(localId: string, field: "label" | "value" | "extra") {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setDrafts((current) => current.map((draft) => (
        draft.localId === localId ? { ...draft, [field]: nextValue } : draft
      )));
    };
  }

  function setDraftCategory(localId: string) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextCategory = normalizeCategory(event.target.value);
      setDrafts((current) => {
        const target = current.find((draft) => draft.localId === localId);
        if (!target) {
          return current;
        }

        const withoutTarget = current.filter((draft) => draft.localId !== localId);
        const nextDraft = {
          ...target,
          category: nextCategory,
          order_index: getNextOrderIndex(withoutTarget, nextCategory),
        };

        return reindexCategory([...withoutTarget, nextDraft], target.category);
      });
    };
  }

  function trimDraftField(localId: string, field: "category" | "label" | "value" | "extra") {
    return (event: React.FocusEvent<HTMLInputElement>) => {
      const nextValue = field === "category"
        ? normalizeCategory(event.target.value)
        : trimDraftValue(event.target.value);

      setDrafts((current) => current.map((draft) => (
        draft.localId === localId ? { ...draft, [field]: nextValue } : draft
      )));
    };
  }

  function addDraft(category: string) {
    setDrafts((current) => [
      ...current,
      {
        localId: `draft-${crypto.randomUUID()}`,
        category,
        label: "",
        value: "",
        extra: "",
        order_index: getNextOrderIndex(current, category),
      },
    ]);
  }

  function deleteDraft(localId: string) {
    setDrafts((current) => {
      const target = current.find((draft) => draft.localId === localId);
      if (!target) {
        return current;
      }

      return reindexCategory(
        current.filter((draft) => draft.localId !== localId),
        target.category,
      );
    });
  }

  function moveDraft(localId: string, direction: -1 | 1) {
    setDrafts((current) => {
      const target = current.find((draft) => draft.localId === localId);
      if (!target) {
        return current;
      }

      const category = normalizeCategory(target.category);
      const categoryDrafts = current
        .filter((draft) => normalizeCategory(draft.category) === category)
        .sort(sortDrafts);
      const index = categoryDrafts.findIndex((draft) => draft.localId === localId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= categoryDrafts.length) {
        return current;
      }

      const reordered = [...categoryDrafts];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, moved);

      const updatedById = new Map(
        reordered.map((draft, orderIndex) => [draft.localId, { ...draft, order_index: orderIndex }]),
      );

      return current.map((draft) => updatedById.get(draft.localId) ?? draft);
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const cleanedDrafts = drafts.map(normalizeDraft);
    const filteredDrafts = cleanedDrafts.filter((draft) => !isDraftCompletelyEmpty(draft));

    const invalidDraft = filteredDrafts.find((draft) => !draft.label || !draft.value);
    if (invalidDraft) {
      setError("Chaque ligne enregistrée doit contenir un libellé et une valeur. Les lignes vides sont ignorées.");
      return;
    }

    const seen = new Set<string>();
    const payload: VehicleSpecInput[] = [];

    for (const draft of filteredDrafts) {
      const duplicateKey = [
        draft.category,
        draft.label,
        draft.value,
        draft.extra,
      ].join("|");

      if (seen.has(duplicateKey)) {
        continue;
      }

      seen.add(duplicateKey);
      payload.push({
        category: draft.category,
        label: draft.label,
        value: draft.value,
        extra: draft.extra || null,
        order_index: draft.order_index,
      });
    }

    setSubmitting(true);
    try {
      const savedSpecs = await saveVehicleSpecs({
        vehicle_id: vehicle.id,
        specs: payload,
      });
      setDrafts(savedSpecs.map(specToDraft));
      onSaved(savedSpecs);
      showToast("Fiche technique enregistrée");
      onClose();
    } catch (currentError) {
      setError(typeof currentError === "string" ? currentError : "Impossible d'enregistrer la fiche technique.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalFrame
      title={`Spécifications du véhicule · ${vehicle.name}`}
      onClose={onClose}
      className="modal--wide"
    >
      <form className="modal__form" onSubmit={handleSubmit}>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}

          <div className="specs-intro">
            <h3 className="specs-intro__title">Fiche technique enrichie</h3>
            <p className="specs-intro__body">
              Organisez les informations utiles par sections, avec un libellé, une valeur et un complément optionnel.
            </p>
          </div>

          {loading ? (
            <div className="empty-state empty-state--compact">
              <p className="empty-state__title">Chargement en cours</p>
              <p className="empty-state__body">Préparation de la fiche technique du véhicule.</p>
            </div>
          ) : (
            <div className="specs-sections">
              {categories.map((category) => {
                const categoryDrafts = drafts
                  .filter((draft) => normalizeCategory(draft.category) === category)
                  .sort(sortDrafts);

                return (
                  <section key={category} className="specs-section">
                    <div className="specs-section__header">
                      <div>
                        <h3 className="specs-section__title">{category}</h3>
                        <p className="specs-section__subtitle">
                          Informations pratiques modifiables ligne par ligne.
                        </p>
                      </div>
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => addDraft(category)}>
                        + Ajouter une ligne
                      </button>
                    </div>

                    {categoryDrafts.length === 0 ? (
                      <div className="specs-section__empty">
                        Aucune information dans cette section pour le moment.
                      </div>
                    ) : (
                      <div className="specs-list">
                        {categoryDrafts.map((draft, index) => (
                          <div key={draft.localId} className="specs-row">
                            {isDraftIncomplete(draft) && (
                              <div className="specs-row__hint">
                                Renseignez à la fois le libellé et la valeur, sinon la ligne ne sera pas enregistrée.
                              </div>
                            )}
                            <div className="specs-row__grid">
                              <div>
                                <label className="form-label">Catégorie</label>
                                <input
                                  className="form-input"
                                  value={draft.category}
                                  onChange={setDraftCategory(draft.localId)}
                                  onBlur={trimDraftField(draft.localId, "category")}
                                  list={categoryListId}
                                  placeholder="ex. Pneumatiques"
                                />
                              </div>
                              <div>
                                <label className="form-label form-label--required">Libellé</label>
                                <input
                                  className="form-input"
                                  value={draft.label}
                                  onChange={setDraftField(draft.localId, "label")}
                                  onBlur={trimDraftField(draft.localId, "label")}
                                  list={`${labelListPrefix}-${draft.localId}`}
                                  placeholder="ex. Pneus"
                                />
                                <datalist id={`${labelListPrefix}-${draft.localId}`}>
                                  {[
                                    ...(LABEL_SUGGESTIONS_BY_CATEGORY[normalizeCategory(draft.category)] ?? []),
                                    ...drafts
                                      .filter((current) => normalizeCategory(current.category) === normalizeCategory(draft.category))
                                      .map((current) => trimDraftValue(current.label))
                                      .filter(Boolean),
                                  ]
                                    .filter((label, labelIndex, source) => source.indexOf(label) === labelIndex)
                                    .map((label) => (
                                      <option key={label} value={label} />
                                    ))}
                                </datalist>
                              </div>
                              <div>
                                <label className="form-label form-label--required">Valeur</label>
                                <input
                                  className="form-input"
                                  value={draft.value}
                                  onChange={setDraftField(draft.localId, "value")}
                                  onBlur={trimDraftField(draft.localId, "value")}
                                  placeholder="ex. 225/55 R18 98 V"
                                />
                              </div>
                              <div>
                                <label className="form-label">Complément</label>
                                <input
                                  className="form-input"
                                  value={draft.extra}
                                  onChange={setDraftField(draft.localId, "extra")}
                                  onBlur={trimDraftField(draft.localId, "extra")}
                                  placeholder="ex. Référence ou note complémentaire"
                                />
                              </div>
                            </div>
                            <div className="specs-row__actions">
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                onClick={() => moveDraft(draft.localId, -1)}
                                disabled={index === 0}
                              >
                                Monter
                              </button>
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                onClick={() => moveDraft(draft.localId, 1)}
                                disabled={index === categoryDrafts.length - 1}
                              >
                                Descendre
                              </button>
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                onClick={() => deleteDraft(draft.localId)}
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          <datalist id={categoryListId}>
            {SUGGESTED_CATEGORIES.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Fermer
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading || submitting}>
            {submitting ? "Enregistrement…" : "Enregistrer la fiche"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
