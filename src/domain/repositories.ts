import type {
  EntityId,
  PerformanceType,
  PerformanceTypeDraft,
  Setlist,
  SetlistDraft,
  Song,
  SongDraft,
  SongFilters,
} from "./models";

export interface PerformanceTypeRepository {
  list(): Promise<PerformanceType[]>;
  getById(id: EntityId): Promise<PerformanceType | undefined>;
  create(draft: PerformanceTypeDraft): Promise<PerformanceType>;
  update(entity: PerformanceType): Promise<PerformanceType>;
  delete(id: EntityId): Promise<void>;
  count(): Promise<number>;
}

export interface SongRepository {
  list(filters?: SongFilters): Promise<Song[]>;
  getById(id: EntityId): Promise<Song | undefined>;
  create(draft: SongDraft): Promise<Song>;
  update(entity: Song): Promise<Song>;
  delete(id: EntityId): Promise<void>;
  count(): Promise<number>;
}

export interface SetlistRepository {
  list(): Promise<Setlist[]>;
  getById(id: EntityId): Promise<Setlist | undefined>;
  create(draft: SetlistDraft): Promise<Setlist>;
  update(entity: Setlist): Promise<Setlist>;
  delete(id: EntityId): Promise<void>;
  count(): Promise<number>;
}

export interface AppRepositories {
  performanceTypes: PerformanceTypeRepository;
  songs: SongRepository;
  setlists: SetlistRepository;
}
