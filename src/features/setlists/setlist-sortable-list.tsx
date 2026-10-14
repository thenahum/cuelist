import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { DragDropProvider, DragOverlay, useDragDropManager } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import type { SetlistSongEntry } from "../../domain/models";

const sensors = [
  PointerSensor.configure({
    activationConstraints: [new PointerActivationConstraints.Distance({ value: 4 })],
  }),
  KeyboardSensor,
];
const modifiers = [RestrictToVerticalAxis];

interface CardBindings {
  handleRef?: Ref<HTMLButtonElement>;
  isPreview?: boolean;
}

interface SetlistSortableListProps {
  entries: SetlistSongEntry[];
  disabled: boolean;
  onDraggingChange(dragging: boolean): void;
  onReorder(entryId: string, index: number): void;
  renderCard(entry: SetlistSongEntry, index: number, bindings: CardBindings): ReactNode;
}

function SortableEntry({ entry, index, disabled, renderCard }: {
  entry: SetlistSongEntry;
  index: number;
  disabled: boolean;
  renderCard: SetlistSortableListProps["renderCard"];
}) {
  const { ref, handleRef, isDragSource } = useSortable({ id: entry.id, index, disabled });
  return (
    <div ref={ref} data-entry-id={entry.id} className="cu-setlist-sortable-entry"
      data-drag-source={isDragSource || undefined}>
      {renderCard(entry, index, { handleRef })}
    </div>
  );
}

// A viewport change invalidates the geometry measured at pickup. Cancel safely
// rather than committing a destination based on stale measurements.
function CancelOnViewportChange() {
  const manager = useDragDropManager();
  useEffect(() => {
    const cancel = () => { void manager?.actions.stop({ canceled: true }); };
    const onVisibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("resize", cancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("resize", cancel);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [manager]);
  return null;
}

export function SetlistSortableList({ entries, disabled, onDraggingChange, onReorder, renderCard }: SetlistSortableListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");

  return (
    <DragDropProvider sensors={sensors} modifiers={modifiers}
      onBeforeDragStart={(event) => { if (disabled) event.preventDefault(); }}
      onDragStart={() => onDraggingChange(true)}
      onDragEnd={(event) => {
        onDraggingChange(false);
        const { source, target } = event.operation;
        if (!source || !isSortable(source)) return;
        if (!event.canceled && target && !disabled) {
          onReorder(String(source.id), source.index);
          setAnnouncement(`Moved to position ${source.index + 1} of ${entries.length}.`);
        } else {
          setAnnouncement("Reorder canceled. Original order restored.");
        }
        const id = String(source.id);
        requestAnimationFrame(() => {
          const row = Array.from(listRef.current?.children ?? []).find(
            (element) => element.getAttribute("data-entry-id") === id,
          );
          row?.querySelector<HTMLButtonElement>(".cu-setlist-drag-handle")?.focus({ preventScroll: true });
        });
      }}>
      <CancelOnViewportChange />
      <div ref={listRef} className="cu-setlist-sortable-list">
        {entries.map((entry, index) => (
          <SortableEntry key={entry.id} entry={entry} index={index} disabled={disabled} renderCard={renderCard} />
        ))}
      </div>
      <DragOverlay className="cu-setlist-drag-overlay" dropAnimation={{ duration: 160, easing: "ease-out" }}>
        {(source) => {
          const index = entries.findIndex((entry) => entry.id === source.id);
          return index < 0 ? null : (
            <div aria-hidden="true" inert>{renderCard(entries[index], index, { isPreview: true })}</div>
          );
        }}
      </DragOverlay>
      <p role="status" className="sr-only">{announcement}</p>
    </DragDropProvider>
  );
}
