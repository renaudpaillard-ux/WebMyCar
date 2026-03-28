import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { listVehicleSpecSheet, saveVehicleSpecSheet } from "../features/vehicles/api";
import type {
  SaveVehicleSpecSheetInput,
  Vehicle,
  VehicleSpec,
  VehicleSpecCategory,
  VehicleSpecInput,
} from "../features/vehicles/types";
import ModalFrame from "./ModalFrame";
import { useToast } from "./ToastProvider";

interface SpecLineDraft {
  localId: string;
  label: string;
  value: string;
  extra: string;
  order_index: number;
}

interface CategoryDraft {
  localId: string;
  name: string;
  order_index: number;
  lines: SpecLineDraft[];
}

interface SortableSpecLineRowProps {
  line: SpecLineDraft;
  incomplete: boolean;
  onFieldChange: (lineLocalId: string, field: keyof Omit<SpecLineDraft, "localId" | "order_index">) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFieldBlur: (lineLocalId: string, field: keyof Omit<SpecLineDraft, "localId" | "order_index">) => (event: React.FocusEvent<HTMLInputElement>) => void;
  onDelete: (lineLocalId: string) => void;
}

interface VehicleSpecsModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  onSaved: (specs: VehicleSpec[]) => void;
}

function buildLocalId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function trimValue(value: string): string {
  return value.trim();
}

function sortLines(left: SpecLineDraft, right: SpecLineDraft): number {
  return left.order_index - right.order_index || left.label.localeCompare(right.label, "fr");
}

function reindexLines(lines: SpecLineDraft[]): SpecLineDraft[] {
  return lines.map((line, index) => ({ ...line, order_index: index }));
}

function reindexCategories(categories: CategoryDraft[]): CategoryDraft[] {
  return categories.map((category, index) => ({ ...category, order_index: index }));
}

function isLineEmpty(line: SpecLineDraft): boolean {
  return !trimValue(line.label) && !trimValue(line.value) && !trimValue(line.extra);
}

function isLineIncomplete(line: SpecLineDraft): boolean {
  return Boolean(trimValue(line.label)) !== Boolean(trimValue(line.value));
}

function createEmptyLine(orderIndex: number): SpecLineDraft {
  return {
    localId: buildLocalId("line"),
    label: "",
    value: "",
    extra: "",
    order_index: orderIndex,
  };
}

function buildDefaultCategoryName(categories: CategoryDraft[]): string {
  const existingNames = new Set(
    categories.map((category) => trimValue(category.name).toLocaleLowerCase("fr")).filter(Boolean),
  );

  if (!existingNames.has("nouvelle catégorie")) {
    return "Nouvelle catégorie";
  }

  let index = 2;
  while (existingNames.has(`nouvelle catégorie ${index}`)) {
    index += 1;
  }

  return `Nouvelle catégorie ${index}`;
}

function SortableSpecLineRow({
  line,
  incomplete,
  onFieldChange,
  onFieldBlur,
  onDelete,
}: SortableSpecLineRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.localId });

  return (
    <div
      ref={setNodeRef}
      className={["specs-row", isDragging ? "specs-row--dragging" : ""].filter(Boolean).join(" ")}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className="specs-row__grid">
        <div>
          <input
            className="form-input"
            value={line.label}
            onChange={onFieldChange(line.localId, "label")}
            onBlur={onFieldBlur(line.localId, "label")}
            placeholder="ex. Pneus"
            aria-label="Libellé"
          />
        </div>
        <div>
          <input
            className="form-input"
            value={line.value}
            onChange={onFieldChange(line.localId, "value")}
            onBlur={onFieldBlur(line.localId, "value")}
            placeholder="ex. 225/55 R18 98 V"
            aria-label="Valeur"
          />
        </div>
        <div>
          <input
            className="form-input"
            value={line.extra}
            onChange={onFieldChange(line.localId, "extra")}
            onBlur={onFieldBlur(line.localId, "extra")}
            placeholder="ex. Référence ou note"
            aria-label="Complément"
          />
        </div>
        <div className="specs-row__actions">
          <button
            type="button"
            className="specs-row__icon-btn"
            onClick={() => onDelete(line.localId)}
            aria-label="Supprimer la ligne"
            title="Supprimer la ligne"
          >
            🗑
          </button>
          <button
            type="button"
            className="specs-row__icon-btn specs-row__drag-handle"
            aria-label="Réordonner la ligne"
            title="Réordonner la ligne"
            {...attributes}
            {...listeners}
          >
            ≡
          </button>
        </div>
      </div>
      {incomplete && (
        <div className="specs-row__hint">
          Renseignez le libellé et la valeur pour enregistrer cette ligne.
        </div>
      )}
    </div>
  );
}

function groupSheet(categories: VehicleSpecCategory[], specs: VehicleSpec[]): CategoryDraft[] {
  const groupedSpecs = new Map<string, SpecLineDraft[]>();

  for (const spec of specs) {
    const lines = groupedSpecs.get(spec.category) ?? [];
    lines.push({
      localId: spec.id,
      label: spec.label,
      value: spec.value,
      extra: spec.extra ?? "",
      order_index: spec.order_index,
    });
    groupedSpecs.set(spec.category, lines);
  }

  const drafts = categories.map((category) => ({
    localId: category.id,
    name: category.name,
    order_index: category.order_index,
    lines: reindexLines((groupedSpecs.get(category.name) ?? []).sort(sortLines)),
  }));

  const missingCategories = [...groupedSpecs.keys()]
    .filter((name) => !drafts.some((draft) => draft.name === name))
    .sort((left, right) => left.localeCompare(right, "fr"));

  for (const name of missingCategories) {
    drafts.push({
      localId: buildLocalId("category"),
      name,
      order_index: drafts.length,
      lines: reindexLines((groupedSpecs.get(name) ?? []).sort(sortLines)),
    });
  }

  return reindexCategories(drafts.sort((left, right) => left.order_index - right.order_index));
}

export default function VehicleSpecsModal({ vehicle, onClose, onSaved }: VehicleSpecsModalProps) {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<CategoryDraft[]>([]);
  const [editingCategoryLocalId, setEditingCategoryLocalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  useEffect(() => {
    setLoading(true);
    setError(null);

    void listVehicleSpecSheet(vehicle.id)
      .then((sheet) => {
        setCategories(groupSheet(sheet.categories, sheet.specs));
      })
      .catch((currentError) => {
        setError(typeof currentError === "string" ? currentError : "Impossible de charger la fiche technique.");
      })
      .finally(() => setLoading(false));
  }, [vehicle.id]);

  function updateCategory(localId: string, updater: (category: CategoryDraft) => CategoryDraft): void {
    setCategories((current) => current.map((category) => (
      category.localId === localId ? updater(category) : category
    )));
  }

  function addCategory() {
    setError(null);
    setCategories((current) => {
      const localId = buildLocalId("category");
      const nextCategory: CategoryDraft = {
        localId,
        name: buildDefaultCategoryName(current),
        order_index: current.length,
        lines: [],
      };
      setEditingCategoryLocalId(localId);
      return reindexCategories([...current, nextCategory]);
    });
  }

  function handleDeleteCategory(localId: string) {
    const category = categories.find((current) => current.localId === localId);
    if (!category) {
      return;
    }

    const confirmed = window.confirm(
      `Supprimer la catégorie "${category.name}" et toutes ses lignes ?`,
    );

    if (!confirmed) {
      return;
    }

    setCategories((current) => reindexCategories(current.filter((item) => item.localId !== localId)));
  }

  function moveCategory(localId: string, direction: -1 | 1) {
    setCategories((current) => {
      const index = current.findIndex((category) => category.localId === localId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const reordered = [...current];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, moved);
      return reindexCategories(reordered);
    });
  }

  function addLine(categoryLocalId: string) {
    updateCategory(categoryLocalId, (category) => ({
      ...category,
      lines: [...category.lines, createEmptyLine(category.lines.length)],
    }));
  }

  function deleteLine(categoryLocalId: string, lineLocalId: string) {
    updateCategory(categoryLocalId, (category) => ({
      ...category,
      lines: reindexLines(category.lines.filter((line) => line.localId !== lineLocalId)),
    }));
  }

  function setCategoryName(categoryLocalId: string) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextName = event.target.value;
      updateCategory(categoryLocalId, (category) => ({ ...category, name: nextName }));
    };
  }

  function trimCategoryName(categoryLocalId: string) {
    return (event: React.FocusEvent<HTMLInputElement>) => {
      const nextName = trimValue(event.target.value);
      updateCategory(categoryLocalId, (category) => ({ ...category, name: nextName }));
      setEditingCategoryLocalId((current) => (current === categoryLocalId ? null : current));
    };
  }

  function setLineField(
    categoryLocalId: string,
    lineLocalId: string,
    field: keyof Omit<SpecLineDraft, "localId" | "order_index">,
  ) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      updateCategory(categoryLocalId, (category) => ({
        ...category,
        lines: category.lines.map((line) => (
          line.localId === lineLocalId ? { ...line, [field]: nextValue } : line
        )),
      }));
    };
  }

  function trimLineField(
    categoryLocalId: string,
    lineLocalId: string,
    field: keyof Omit<SpecLineDraft, "localId" | "order_index">,
  ) {
    return (event: React.FocusEvent<HTMLInputElement>) => {
      const nextValue = trimValue(event.target.value);
      updateCategory(categoryLocalId, (category) => ({
        ...category,
        lines: category.lines.map((line) => (
          line.localId === lineLocalId ? { ...line, [field]: nextValue } : line
        )),
      }));
    };
  }

  function handleLineDragEnd(categoryLocalId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    updateCategory(categoryLocalId, (category) => {
      const oldIndex = category.lines.findIndex((line) => line.localId === active.id);
      const newIndex = category.lines.findIndex((line) => line.localId === over.id);
      if (oldIndex < 0 || newIndex < 0) {
        return category;
      }

      return {
        ...category,
        lines: reindexLines(arrayMove(category.lines, oldIndex, newIndex)),
      };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const normalizedCategories = categories.map((category, categoryIndex) => ({
      ...category,
      name: trimValue(category.name),
      order_index: categoryIndex,
      lines: reindexLines(category.lines.map((line) => ({
        ...line,
        label: trimValue(line.label),
        value: trimValue(line.value),
        extra: trimValue(line.extra),
      }))),
    }));

    const emptyCategory = normalizedCategories.find((category) => !category.name);
    if (emptyCategory) {
      setError("Chaque catégorie doit avoir un nom.");
      return;
    }

    const duplicateCategory = normalizedCategories.find((category, index) =>
      normalizedCategories.findIndex((current) =>
        current.name.localeCompare(category.name, "fr", { sensitivity: "accent" }) === 0,
      ) !== index,
    );
    if (duplicateCategory) {
      setError("Les catégories doivent avoir des noms distincts.");
      return;
    }

    const cleanedSpecs: VehicleSpecInput[] = [];
    for (const category of normalizedCategories) {
      const filteredLines = category.lines.filter((line) => !isLineEmpty(line));
      const invalidLine = filteredLines.find(isLineIncomplete);
      if (invalidLine) {
        setError("Chaque ligne enregistrée doit contenir un libellé et une valeur.");
        return;
      }

      const seen = new Set<string>();
      for (const line of filteredLines) {
        const duplicateKey = [category.name, line.label, line.value, line.extra].join("|");
        if (seen.has(duplicateKey)) {
          continue;
        }

        seen.add(duplicateKey);
        cleanedSpecs.push({
          category: category.name,
          label: line.label,
          value: line.value,
          extra: line.extra || null,
          order_index: line.order_index,
        });
      }
    }

    const payload: SaveVehicleSpecSheetInput = {
      vehicle_id: vehicle.id,
      categories: normalizedCategories.map((category) => ({
        name: category.name,
        order_index: category.order_index,
      })),
      specs: cleanedSpecs,
    };

    setSubmitting(true);
    try {
      const sheet = await saveVehicleSpecSheet(payload);
      setCategories(groupSheet(sheet.categories, sheet.specs));
      onSaved(sheet.specs);
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
      title={`Fiche technique – ${vehicle.name}`}
      onClose={onClose}
      className="modal--wide"
    >
      <form className="modal__form" onSubmit={handleSubmit}>
        <div className="modal__body">
          {error && <div className="error-banner">{error}</div>}

          {loading ? (
            <div className="empty-state empty-state--compact">
              <p className="empty-state__title">Chargement en cours</p>
              <p className="empty-state__body">Préparation de la fiche technique du véhicule.</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="specs-empty">
              <p className="empty-state__title">Aucune catégorie pour le moment</p>
              <button type="button" className="btn btn--primary" onClick={addCategory}>
                + Ajouter une catégorie
              </button>
            </div>
          ) : (
            <div className="specs-sections">
              <div className="specs-toolbar">
                <button type="button" className="btn btn--secondary specs-toolbar__add" onClick={addCategory}>
                  + Ajouter une catégorie
                </button>
              </div>

              {categories.map((category, categoryIndex) => (
                <section key={category.localId} className="specs-section">
                  <div className="specs-section__header">
                    <div className="specs-section__title-wrap">
                      {editingCategoryLocalId === category.localId ? (
                        <input
                          className="specs-section__title-input"
                          value={category.name}
                          onChange={setCategoryName(category.localId)}
                          onBlur={trimCategoryName(category.localId)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                            if (event.key === "Escape") {
                              setEditingCategoryLocalId(null);
                              event.currentTarget.blur();
                            }
                          }}
                          placeholder="Nom de la catégorie"
                          autoFocus
                        />
                      ) : (
                        <h3 className="specs-section__title">
                          {trimValue(category.name) || "Catégorie sans nom"}
                        </h3>
                      )}
                    </div>
                    <div className="specs-section__actions">
                      <button
                        type="button"
                        className="specs-section__icon-btn"
                        onClick={() => setEditingCategoryLocalId(category.localId)}
                        aria-label="Renommer la catégorie"
                        title="Renommer la catégorie"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="specs-section__move-btn"
                        onClick={() => moveCategory(category.localId, -1)}
                        disabled={categoryIndex === 0}
                        aria-label="Monter la catégorie"
                        title="Monter la catégorie"
                      >
                        ˄
                      </button>
                      <button
                        type="button"
                        className="specs-section__move-btn"
                        onClick={() => moveCategory(category.localId, 1)}
                        disabled={categoryIndex === categories.length - 1}
                        aria-label="Descendre la catégorie"
                        title="Descendre la catégorie"
                      >
                        ˅
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => addLine(category.localId)}
                      >
                        + Ajouter une ligne
                      </button>
                      <button
                        type="button"
                        className="specs-section__icon-btn"
                        onClick={() => handleDeleteCategory(category.localId)}
                        aria-label="Supprimer la catégorie"
                        title="Supprimer la catégorie"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {category.lines.length === 0 ? (
                    <div className="specs-section__empty">
                      <span>Aucune ligne pour le moment.</span>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => addLine(category.localId)}
                      >
                        + Ajouter une ligne
                      </button>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleLineDragEnd(category.localId, event)}
                    >
                      <SortableContext
                        items={category.lines.map((line) => line.localId)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="specs-list">
                          <div className="specs-list__header">
                            <span>Libellé</span>
                            <span>Valeur</span>
                            <span>Complément</span>
                            <span className="specs-list__header-actions">Actions</span>
                          </div>
                          {category.lines.map((line) => {
                            return (
                              <SortableSpecLineRow
                                key={line.localId}
                                line={line}
                                incomplete={isLineIncomplete(line)}
                                onFieldChange={(lineLocalId, field) => setLineField(category.localId, lineLocalId, field)}
                                onFieldBlur={(lineLocalId, field) => trimLineField(category.localId, lineLocalId, field)}
                                onDelete={(lineLocalId) => deleteLine(category.localId, lineLocalId)}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </section>
              ))}
            </div>
          )}
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
