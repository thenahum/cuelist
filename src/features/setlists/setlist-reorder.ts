import type { SetlistSongEntry } from "../../domain/models";

export function reorderEntries(
  entries: SetlistSongEntry[],
  draggedEntryId: string,
  insertIndex: number,
): SetlistSongEntry[] {
  const sourceIndex = entries.findIndex((entry) => entry.id === draggedEntryId);

  if (sourceIndex < 0) {
    return entries;
  }

  const nextEntries = [...entries];
  const [movedEntry] = nextEntries.splice(sourceIndex, 1);
  const normalizedInsertIndex = Math.max(0, Math.min(insertIndex, nextEntries.length));

  nextEntries.splice(normalizedInsertIndex, 0, movedEntry);

  return nextEntries.map((entry, index) => ({
    ...entry,
    order: index + 1,
  }));
}
