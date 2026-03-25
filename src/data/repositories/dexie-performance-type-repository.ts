import type {
  PerformanceType,
  PerformanceTypeDraft,
} from "../../domain/models";
import {
  createPendingSyncMetadata,
  ensureSyncMetadata,
  markEntityDirty,
} from "../../domain/sync-metadata";
import type { PerformanceTypeRepository } from "../../domain/repositories";
import { createId } from "../../shared/id";
import { nowIsoString } from "../../shared/time";
import type { CueListDexieDatabase } from "../db/cuelist-db";

export class DexiePerformanceTypeRepository
  implements PerformanceTypeRepository
{
  constructor(private readonly db: CueListDexieDatabase) {}

  async list(): Promise<PerformanceType[]> {
    const performanceTypes = await this.db.performanceTypes.orderBy("name").toArray();
    return performanceTypes.map(ensureSyncMetadata);
  }

  async getById(id: string): Promise<PerformanceType | undefined> {
    const performanceType = await this.db.performanceTypes.get(id);
    return performanceType ? ensureSyncMetadata(performanceType) : undefined;
  }

  async create(draft: PerformanceTypeDraft): Promise<PerformanceType> {
    const timestamp = nowIsoString();
    const performanceType: PerformanceType = {
      id: createId("ptype"),
      createdAt: timestamp,
      updatedAt: timestamp,
      syncMetadata: createPendingSyncMetadata(),
      ...draft,
    };

    await this.db.performanceTypes.add(performanceType);
    return performanceType;
  }

  async update(entity: PerformanceType): Promise<PerformanceType> {
    const updatedEntity = markEntityDirty(ensureSyncMetadata(entity), nowIsoString());

    await this.db.performanceTypes.put(updatedEntity);
    return updatedEntity;
  }

  async delete(id: string): Promise<void> {
    // TODO: When Supabase is introduced, enforce referential integrity checks
    // across song performance profiles and setlist defaults before delete.
    await this.db.performanceTypes.delete(id);
  }

  async count(): Promise<number> {
    return this.db.performanceTypes.count();
  }
}
