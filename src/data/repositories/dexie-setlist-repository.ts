import type { Setlist, SetlistDraft } from "../../domain/models";
import type { SetlistRepository } from "../../domain/repositories";
import { createId } from "../../shared/id";
import { nowIsoString } from "../../shared/time";
import type { CueListDexieDatabase } from "../db/cuelist-db";

export class DexieSetlistRepository implements SetlistRepository {
  constructor(private readonly db: CueListDexieDatabase) {}

  async list(): Promise<Setlist[]> {
    return this.db.setlists.orderBy("updatedAt").reverse().toArray();
  }

  async getById(id: string): Promise<Setlist | undefined> {
    return this.db.setlists.get(id);
  }

  async create(draft: SetlistDraft): Promise<Setlist> {
    const timestamp = nowIsoString();
    const setlist: Setlist = {
      id: createId("setlist"),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...draft,
    };

    await this.db.setlists.add(setlist);
    return setlist;
  }

  async update(entity: Setlist): Promise<Setlist> {
    const updatedSetlist: Setlist = {
      ...entity,
      updatedAt: nowIsoString(),
    };

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
