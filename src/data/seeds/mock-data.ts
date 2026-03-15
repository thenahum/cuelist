import type { PerformanceType, Setlist, Song } from "../../domain/models";

const timestamp = "2026-03-14T20:00:00.000Z";

export const seededPerformanceTypes: PerformanceType[] = [
  {
    id: "ptype_acoustic",
    name: "Acoustic",
    isSeeded: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "ptype_electric",
    name: "Electric",
    isSeeded: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "ptype_full_band",
    name: "Full Band",
    isSeeded: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

export const seededSongs: Song[] = [
  {
    id: "song_midnight_signal",
    title: "Midnight Signal",
    sourceType: "original",
    lyrics: "City lights blur in the rearview\nI keep the chorus close tonight",
    chords: "[Em]City lights blur in the [C]rearview",
    personalNotes: "Keep verse one restrained. Open up on the second chorus.",
    tags: ["opener", "dynamic"],
    performanceProfiles: [
      {
        performanceTypeId: "ptype_acoustic",
        comfortLevel: "ready",
        performanceNotes: "Capo 2. Leave a full bar before the final chorus.",
      },
      {
        performanceTypeId: "ptype_electric",
        comfortLevel: "almost_ready",
        performanceNotes: "Dial in dotted eighth delay before soundcheck.",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "song_glass_on_the_floor",
    title: "Glass on the Floor",
    artist: "Chris Whitley",
    sourceType: "cover",
    lyrics: "Broken rooms and borrowed time",
    chords: "[Am]Broken rooms and [F]borrowed time",
    externalChordUrl: "https://example.com/glass-on-the-floor/chords",
    externalLyricUrl: "https://example.com/glass-on-the-floor/lyrics",
    tags: ["cover", "late-set"],
    performanceProfiles: [
      {
        performanceTypeId: "ptype_acoustic",
        comfortLevel: "ready",
        performanceNotes: "Stay loose on tempo and let the vocal lead.",
      },
      {
        performanceTypeId: "ptype_full_band",
        comfortLevel: "maybe",
        performanceNotes: "Needs a clearer band ending cue.",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "song_rusted_satellite",
    title: "Rusted Satellite",
    sourceType: "original",
    lyrics: "Static in the rafters, heartbeat in the kick drum",
    chords: "[Dm]Static in the rafters",
    personalNotes: "Practice bridge transition slowly with metronome.",
    tags: ["practice", "band"],
    performanceProfiles: [
      {
        performanceTypeId: "ptype_full_band",
        comfortLevel: "almost_ready",
        performanceNotes: "Count off slower than rehearsal tempo.",
      },
      {
        performanceTypeId: "ptype_electric",
        comfortLevel: "maybe",
        performanceNotes: "Need cleaner pickup into chorus riff.",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "song_northern_line",
    title: "Northern Line",
    artist: "Nick Drake",
    sourceType: "cover",
    lyrics: "Smoke from the station and a cold black sky",
    chords: "[G]Smoke from the station",
    personalNotes: "Keep spoken intro short.",
    tags: ["quiet", "encore"],
    performanceProfiles: [
      {
        performanceTypeId: "ptype_acoustic",
        comfortLevel: "you_suck",
        performanceNotes: "Still rebuilding fingerpicking confidence.",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

export const seededSetlists: Setlist[] = [
  {
    id: "setlist_river_room",
    title: "River Room Residency",
    venue: "River Room",
    performanceDate: "2026-04-02",
    notes: "Keep first three songs tight and under 15 minutes total.",
    defaultPerformanceTypeId: "ptype_acoustic",
    songEntries: [
      {
        id: "entry_river_1",
        songId: "song_midnight_signal",
        order: 1,
      },
      {
        id: "entry_river_2",
        songId: "song_glass_on_the_floor",
        order: 2,
      },
      {
        id: "entry_river_3",
        songId: "song_northern_line",
        performanceTypeId: "ptype_acoustic",
        order: 3,
        performanceNoteOverride: "Skip spoken intro if the room is noisy.",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "setlist_band_rehearsal",
    title: "Band Rehearsal Pull List",
    notes: "Focus on transitions and endings.",
    defaultPerformanceTypeId: "ptype_full_band",
    songEntries: [
      {
        id: "entry_rehearsal_1",
        songId: "song_rusted_satellite",
        order: 1,
      },
      {
        id: "entry_rehearsal_2",
        songId: "song_glass_on_the_floor",
        order: 2,
        performanceTypeId: "ptype_full_band",
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];
