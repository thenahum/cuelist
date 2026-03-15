import type {
  ComfortLevel,
  SongDraft,
  SongPerformanceProfile,
  SourceType,
} from "../../domain/models";

export const comfortLevelOptions: ComfortLevel[] = [
  "ready",
  "almost_ready",
  "maybe",
  "you_suck",
];

export const sourceTypeOptions: SourceType[] = ["original", "cover"];

export function formatComfortLevel(level: ComfortLevel): string {
  switch (level) {
    case "ready":
      return "Ready";
    case "almost_ready":
      return "Almost Ready";
    case "maybe":
      return "Maybe";
    case "you_suck":
      return "You Suck";
  }
}

export function formatSourceType(sourceType: SourceType): string {
  switch (sourceType) {
    case "original":
      return "Original";
    case "cover":
      return "Cover";
  }
}

export function comfortLevelClasses(level: ComfortLevel): string {
  switch (level) {
    case "ready":
      return "cu-comfort-chip cu-comfort-chip-ready";
    case "almost_ready":
      return "cu-comfort-chip cu-comfort-chip-almost-ready";
    case "maybe":
      return "cu-comfort-chip cu-comfort-chip-maybe";
    case "you_suck":
      return "cu-comfort-chip cu-comfort-chip-you-suck";
  }
}

export function createEmptySongDraft(): SongDraft {
  return {
    title: "",
    artist: "",
    sourceType: "original",
    lyrics: "",
    chords: "",
    personalNotes: "",
    externalChordUrl: "",
    externalLyricUrl: "",
    tags: [],
    performanceProfiles: [],
  };
}

export function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseTagInput(value: string): string[] | undefined {
  const tags = Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );

  return tags.length > 0 ? tags : undefined;
}

export function formatTagInput(tags?: string[]): string {
  return tags?.join(", ") ?? "";
}

export function sanitizeProfiles(
  profiles: SongPerformanceProfile[],
): SongPerformanceProfile[] {
  return profiles.map((profile) => ({
    performanceTypeId: profile.performanceTypeId,
    comfortLevel: profile.comfortLevel,
    performanceNotes: normalizeOptionalText(profile.performanceNotes ?? ""),
  }));
}
