import type { Setlist, SetlistDraft } from "../../domain/models";
import {
  createPendingSyncMetadata,
  ensureSyncMetadata,
  markEntityDirty,
} from "../../domain/sync-metadata";
import type { SetlistRepository } from "../../domain/repositories";
import { createId } from "../../shared/id";
import { nowIsoString } from "../../shared/time";
import type { CueListDexieDatabase } from "../db/cuelist-db";

export class DexieSetlistRepository implements SetlistRepository {
  constructor(private readonly db: CueListDexieDatabase) {}

  async list(): Promise<Setlist[]> {
    const setlists = await this.db.setlists.orderBy("updatedAt").reverse().toArray();
    return setlists.map(ensureSyncMetadata);
  }

  async getById(id: string): Promise<Setlist | undefined> {
    const setlist = await this.db.setlists.get(id);
    return setlist ? ensureSyncMetadata(setlist) : undefined;
  }

  async create(draft: SetlistDraft): Promise<Setlist> {
    const timestamp = nowIsoString();
    const setlist: Setlist = {
      id: createId("setlist"),
      createdAt: timestamp,
      updatedAt: timestamp,
      syncMetadata: createPendingSyncMetadata(),
      ...draft,
    };

    await this.db.setlists.add(setlist);
    return setlist;
  }

  async update(entity: Setlist): Promise<Setlist> {
    const updatedSetlist = markEntityDirty(ensureSyncMetadata(entity), nowIsoString());

    await this.db.setlists.put(updatedSetlist);
    return updatedSetlist;
  }

  async delete(id: string): Promise<void> {
    await this.db.setlists.delete(id);
  }

  async count(): Promise<number> {
    return this.db.setlists.count();
  }
}
