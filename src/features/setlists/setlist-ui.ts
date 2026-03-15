import type {
  PerformanceType,
  Setlist,
  SetlistDraft,
  SetlistSongEntry,
  Song,
} from "../../domain/models";

export interface ResolvedSetlistEntryNote {
  note?: string;
  source: "override" | "profile" | "none";
}

export function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function createEmptySetlistDraft(): SetlistDraft {
  return {
    title: "",
    venue: "",
    performanceDate: "",
    notes: "",
    defaultPerformanceTypeId: undefined,
    songEntries: [],
  };
}

export function sortSongEntries(
  songEntries: SetlistSongEntry[],
): SetlistSongEntry[] {
  return [...songEntries].sort((left, right) => left.order - right.order);
}

export function getEffectivePerformanceTypeId(
  defaultPerformanceTypeId: string | undefined,
  songEntry: Pick<SetlistSongEntry, "performanceTypeId">,
): string | undefined {
  return songEntry.performanceTypeId ?? defaultPerformanceTypeId;
}

export function resolveEntryNote(
  song: Song | undefined,
  defaultPerformanceTypeId: string | undefined,
  songEntry: Pick<
    SetlistSongEntry,
    "performanceTypeId" | "performanceNoteOverride"
  >,
): ResolvedSetlistEntryNote {
  if (songEntry.performanceNoteOverride?.trim()) {
    return {
      note: songEntry.performanceNoteOverride.trim(),
      source: "override",
    };
  }

  const effectivePerformanceTypeId = getEffectivePerformanceTypeId(
    defaultPerformanceTypeId,
    songEntry,
  );

  if (!song || !effectivePerformanceTypeId) {
    return {
      source: "none",
    };
  }

  const matchingProfile = song.performanceProfiles.find(
    (profile) => profile.performanceTypeId === effectivePerformanceTypeId,
  );

  return matchingProfile?.performanceNotes?.trim()
    ? {
        note: matchingProfile.performanceNotes.trim(),
        source: "profile",
      }
    : {
        source: "none",
      };
}

export function getPerformanceTypeName(
  performanceTypeId: string | undefined,
  performanceTypes: PerformanceType[],
): string {
  if (!performanceTypeId) {
    return "No performance type";
  }

  return (
    performanceTypes.find((performanceType) => performanceType.id === performanceTypeId)
      ?.name ?? "Unknown type"
  );
}

export function formatSetlistDate(performanceDate?: string): string {
  if (!performanceDate) {
    return "No date";
  }

  return new Date(`${performanceDate}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function summarizeSetlistSongs(setlist: Setlist, songs: Song[]): string {
  const orderedEntries = sortSongEntries(setlist.songEntries).slice(0, 3);
  const labels = orderedEntries.map((entry) => {
    const song = songs.find((candidate) => candidate.id === entry.songId);
    return song?.title ?? "Unknown song";
  });

  if (labels.length === 0) {
    return "No songs added yet.";
  }

  const suffix =
    setlist.songEntries.length > 3
      ? ` +${setlist.songEntries.length - 3} more`
      : "";

  return `${labels.join(" • ")}${suffix}`;
}
