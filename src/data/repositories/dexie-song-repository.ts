import type { Song, SongDraft, SongFilters } from "../../domain/models";
import type { SongRepository } from "../../domain/repositories";
import { createId } from "../../shared/id";
import { nowIsoString } from "../../shared/time";
import type { CueListDexieDatabase } from "../db/cuelist-db";

function includesQuery(haystack: string | undefined, query: string): boolean {
  return haystack?.toLowerCase().includes(query) ?? false;
}

export class DexieSongRepository implements SongRepository {
  constructor(private readonly db: CueListDexieDatabase) {}

  async list(filters?: SongFilters): Promise<Song[]> {
    const songs = await this.db.songs.orderBy("updatedAt").reverse().toArray();

    if (!filters) {
      return songs;
    }

    const query = filters.query?.trim().toLowerCase();

    return songs.filter((song) => {
      if (filters.sourceType && song.sourceType !== filters.sourceType) {
        return false;
      }

      if (query) {
        const matchesQuery =
          includesQuery(song.title, query) ||
          includesQuery(song.artist, query) ||
          includesQuery(song.personalNotes, query) ||
          song.tags?.some((tag) => tag.toLowerCase().includes(query));

        if (!matchesQuery) {
          return false;
        }
      }

      if (filters.tag) {
        const tagQuery = filters.tag.toLowerCase();
        const hasTag =
          song.tags?.some((tag) => tag.toLowerCase() === tagQuery) ?? false;

        if (!hasTag) {
          return false;
        }
      }

      if (filters.performanceTypeId || filters.comfortLevel) {
        const hasMatchingProfile = song.performanceProfiles.some((profile) => {
          const matchesPerformanceType = filters.performanceTypeId
            ? profile.performanceTypeId === filters.performanceTypeId
            : true;
          const matchesComfortLevel = filters.comfortLevel
            ? profile.comfortLevel === filters.comfortLevel
            : true;

          return matchesPerformanceType && matchesComfortLevel;
        });

        if (!hasMatchingProfile) {
          return false;
        }
      }

      return true;
    });
  }

  async getById(id: string): Promise<Song | undefined> {
    return this.db.songs.get(id);
  }

  async create(draft: SongDraft): Promise<Song> {
    const timestamp = nowIsoString();
    const song: Song = {
      id: createId("song"),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...draft,
    };

    await this.db.songs.add(song);
    return song;
  }

  async update(entity: Song): Promise<Song> {
    const updatedSong: Song = {
      ...entity,
      updatedAt: nowIsoString(),
    };

    await this.db.songs.put(updatedSong);
    return updatedSong;
  }

  async delete(id: string): Promise<void> {
    // TODO: Add cascading or soft-delete behavior when setlists become editable
    // against a synced backend.
    await this.db.songs.delete(id);
  }

  async count(): Promise<number> {
    return this.db.songs.count();
  }
}
