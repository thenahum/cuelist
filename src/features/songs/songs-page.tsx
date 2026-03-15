import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router-dom";

import type {
  ComfortLevel,
  PerformanceType,
  Song,
  SongFilters,
  SourceType,
} from "../../domain/models";
import { useRepositories } from "../../app/repository-context";
import { PerformanceProfileChip } from "./performance-profile-chip";
import {
  comfortLevelOptions,
  formatComfortLevel,
  formatSourceType,
} from "./song-ui";

type SongSortOption = "updated" | "title" | "practice";

const comfortScores: Record<ComfortLevel, number> = {
  you_suck: 0,
  maybe: 1,
  almost_ready: 2,
  ready: 3,
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Zm9 2-4.2-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 6h16M7 12h10m-6 6h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M8 6v12m0 0-3-3m3 3 3-3M16 18V6m0 0-3 3m3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatLastUpdated(updatedAt: string): string {
  return new Date(updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseSourceType(value: string | null): SourceType | undefined {
  return value === "original" || value === "cover" ? value : undefined;
}

function parseComfortLevel(value: string | null): ComfortLevel | undefined {
  return comfortLevelOptions.includes(value as ComfortLevel)
    ? (value as ComfortLevel)
    : undefined;
}

function parseSongSort(value: string | null): SongSortOption {
  return value === "title" || value === "practice" ? value : "updated";
}

function getPracticeScore(song: Song, performanceTypeId?: string): number {
  const relevantProfiles = performanceTypeId
    ? song.performanceProfiles.filter(
        (profile) => profile.performanceTypeId === performanceTypeId,
      )
    : song.performanceProfiles;

  if (relevantProfiles.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(
    ...relevantProfiles.map((profile) => comfortScores[profile.comfortLevel]),
  );
}

function sortSongs(
  songs: Song[],
  sortOption: SongSortOption,
  performanceTypeId?: string,
): Song[] {
  const nextSongs = [...songs];

  switch (sortOption) {
    case "title":
      return nextSongs.sort((left, right) => left.title.localeCompare(right.title));
    case "practice":
      return nextSongs.sort((left, right) => {
        const scoreDifference =
          getPracticeScore(left, performanceTypeId) -
          getPracticeScore(right, performanceTypeId);

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        return left.title.localeCompare(right.title);
      });
    case "updated":
    default:
      return nextSongs.sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
  }
}

export function SongsPage() {
  const repositories = useRepositories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [songs, setSongs] = useState<Song[]>([]);
  const [performanceTypes, setPerformanceTypes] = useState<PerformanceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filters = useMemo<SongFilters>(
    () => ({
      query: searchParams.get("q") ?? "",
      sourceType: parseSourceType(searchParams.get("source")),
      performanceTypeId: searchParams.get("performanceType") ?? undefined,
      comfortLevel: parseComfortLevel(searchParams.get("comfort")),
      tag: searchParams.get("tag") ?? undefined,
    }),
    [searchParams],
  );

  const sortOption = useMemo(
    () => parseSongSort(searchParams.get("sort")),
    [searchParams],
  );
  const deferredQuery = useDeferredValue(filters.query ?? "");
  const hasAdvancedFilters = Boolean(
    filters.sourceType || filters.performanceTypeId || filters.comfortLevel,
  );
  const hasSearchState =
    Boolean(filters.query) || hasAdvancedFilters || sortOption !== "updated";
  const isSearchExpanded = searchParams.get("search") === "open";
  const editorSearchSuffix = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("search");
    const serialized = next.toString();
    return serialized ? `?${serialized}` : "";
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogData() {
      setIsLoading(true);

      try {
        const nextFilters: SongFilters = {
          ...filters,
          query: deferredQuery,
        };
        const [loadedSongs, loadedPerformanceTypes] = await Promise.all([
          repositories.songs.list(nextFilters),
          repositories.performanceTypes.list(),
        ]);

        if (cancelled) {
          return;
        }

        setSongs(loadedSongs);
        setPerformanceTypes(loadedPerformanceTypes);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(toErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCatalogData();

    return () => {
      cancelled = true;
    };
  }, [
    deferredQuery,
    filters.comfortLevel,
    filters.performanceTypeId,
    filters.sourceType,
    filters.tag,
    repositories.performanceTypes,
    repositories.songs,
  ]);

  useEffect(() => {
    if (isSearchExpanded) {
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [isSearchExpanded]);

  useEffect(() => {
    if (!isSearchExpanded) {
      setIsFilterMenuOpen(false);
      setIsSortMenuOpen(false);
    }
  }, [isSearchExpanded]);

  const visibleSongs = useMemo(
    () => sortSongs(songs, sortOption, filters.performanceTypeId),
    [filters.performanceTypeId, songs, sortOption],
  );

  function updateSearchParam(
    key: string,
    value: string | undefined,
    replace = true,
  ) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }

        return next;
      },
      { replace },
    );
  }

  function setSearchOpen(isOpen: boolean) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (isOpen) {
          next.set("search", "open");
        } else {
          next.delete("search");
        }

        return next;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("q");
        next.delete("source");
        next.delete("performanceType");
        next.delete("comfort");
        next.delete("tag");
        next.delete("sort");
        return next;
      },
      { replace: true },
    );
  }

  function openSearchPanel() {
    setSearchOpen(true);
  }

  return (
    <div className="relative space-y-4 pb-28">
      <section className="px-1 pt-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
              Songs
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {visibleSongs.length} {visibleSongs.length === 1 ? "song" : "songs"}
            </p>
          </div>
          {hasSearchState ? (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              Reset
            </button>
          ) : null}
        </div>
      </section>

      {isSearchExpanded ? (
        <>
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
            className="cu-song-search-backdrop"
          />
          <section className="cu-song-search-panel">
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <SearchIcon />
              </div>
              <input
                ref={searchInputRef}
                className="cu-song-search-input"
                value={filters.query ?? ""}
                onChange={(event) =>
                  updateSearchParam("q", event.target.value || undefined)
                }
                placeholder="Search songs or artists"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <button
                  type="button"
                  aria-label="Open filters"
                  onClick={() => {
                    setIsFilterMenuOpen((current) => !current);
                    setIsSortMenuOpen(false);
                  }}
                  className={[
                    "cu-song-search-icon-button",
                    isFilterMenuOpen || hasAdvancedFilters
                      ? "cu-song-search-icon-button-active"
                      : "",
                  ].join(" ")}
                >
                  <FilterIcon />
                </button>
                <button
                  type="button"
                  aria-label="Open sorting"
                  onClick={() => {
                    setIsSortMenuOpen((current) => !current);
                    setIsFilterMenuOpen(false);
                  }}
                  className={[
                    "cu-song-search-icon-button",
                    isSortMenuOpen || sortOption !== "updated"
                      ? "cu-song-search-icon-button-active"
                      : "",
                  ].join(" ")}
                >
                  <SortIcon />
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {visibleSongs.length}{" "}
                {visibleSongs.length === 1 ? "match" : "matches"}
              </p>
              <div className="flex items-center gap-2">
                {hasSearchState ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="cu-song-search-secondary-button"
                  >
                    Reset
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="cu-song-search-secondary-button"
                >
                  Close
                </button>
              </div>
            </div>

            {isFilterMenuOpen ? (
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    className="cu-song-filter-select"
                    value={filters.performanceTypeId ?? ""}
                    onChange={(event) =>
                      updateSearchParam(
                        "performanceType",
                        event.target.value || undefined,
                      )
                    }
                  >
                    <option value="">All performance types</option>
                    {performanceTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="cu-song-filter-select"
                    value={filters.comfortLevel ?? ""}
                    onChange={(event) =>
                      updateSearchParam("comfort", event.target.value || undefined)
                    }
                  >
                    <option value="">All comfort levels</option>
                    {comfortLevelOptions.map((level) => (
                      <option key={level} value={level}>
                        {formatComfortLevel(level)}
                      </option>
                    ))}
                  </select>

                  <select
                    className="cu-song-filter-select"
                    value={filters.sourceType ?? ""}
                    onChange={(event) =>
                      updateSearchParam("source", event.target.value || undefined)
                    }
                  >
                    <option value="">All songs</option>
                    <option value="original">Original</option>
                    <option value="cover">Cover</option>
                  </select>
                </div>
              </div>
            ) : null}

            {isSortMenuOpen ? (
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <div className="grid gap-1">
                {[
                  { value: "updated", label: "Recently updated" },
                  { value: "title", label: "Alphabetical" },
                  { value: "practice", label: "Comfort level" },
                ].map((option) => {
                  const isActive = sortOption === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        updateSearchParam(
                          "sort",
                          option.value === "updated" ? undefined : option.value,
                        );
                        setIsSortMenuOpen(false);
                      }}
                      className={[
                        "rounded-[18px] px-4 py-3 text-left text-sm font-medium transition",
                        isActive
                          ? "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        {isLoading ? (
          <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-6 text-sm text-[var(--text-muted)]">
            Loading songs...
          </div>
        ) : null}

        {!isLoading && visibleSongs.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-6 text-sm text-[var(--text-muted)]">
            No songs match the current search yet.
          </div>
        ) : null}

        {!isLoading
          ? visibleSongs.map((song) => (
              <Link
                key={song.id}
                to={`/songs/${song.id}${editorSearchSuffix}`}
                className="cu-song-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                        {song.title}
                      </h2>
                      <span className="cu-song-source-pill">
                        {formatSourceType(song.sourceType)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {song.artist ||
                        (song.sourceType === "cover"
                          ? "Cover artist not set"
                          : "Original catalog entry")}
                    </p>
                  </div>

                  <p className="shrink-0 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-[var(--text-soft)]">
                    {formatLastUpdated(song.updatedAt)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {song.performanceProfiles.map((profile) => (
                    <PerformanceProfileChip
                      key={`${song.id}-${profile.performanceTypeId}`}
                      profile={profile}
                      performanceTypes={performanceTypes}
                    />
                  ))}
                </div>
              </Link>
            ))
          : null}
      </section>

      <div className="cu-song-action-zone">
        <button
          type="button"
          onClick={openSearchPanel}
          aria-label="Search songs"
          className={`cu-song-search-trigger ${isSearchExpanded || hasSearchState ? "cu-song-search-trigger-active" : ""}`}
        >
          <SearchIcon />
        </button>

        <Link
          to={`/songs/new${editorSearchSuffix}`}
          aria-label="Add song"
          className="cu-song-add-button"
        >
          <PlusIcon />
        </Link>
      </div>
    </div>
  );
}
