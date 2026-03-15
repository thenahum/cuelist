import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useRepositories } from "../../app/repository-context";
import { PageShell } from "../../components/page-shell";
import type {
  PerformanceType,
  Setlist,
  Song,
} from "../../domain/models";
import {
  formatSetlistDate,
  getPerformanceTypeName,
  summarizeSetlistSongs,
} from "./setlist-ui";

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

function formatUpdatedAt(updatedAt: string): string {
  return new Date(updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SetlistsPage() {
  const repositories = useRepositories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [performanceTypes, setPerformanceTypes] = useState<PerformanceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const query = searchParams.get("q") ?? "";
  const filterPerformanceTypeId =
    searchParams.get("performanceType") ?? undefined;
  const hasSearchState = Boolean(query || filterPerformanceTypeId);
  const isSearchExpanded = searchParams.get("search") === "open";
  const editorSearchSuffix = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("search");
    const serialized = next.toString();
    return serialized ? `?${serialized}` : "";
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      setIsLoading(true);

      try {
        const [loadedSetlists, loadedSongs, loadedPerformanceTypes] =
          await Promise.all([
            repositories.setlists.list(),
            repositories.songs.list(),
            repositories.performanceTypes.list(),
          ]);

        if (cancelled) {
          return;
        }

        setSetlists(loadedSetlists);
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

    void loadPageData();

    return () => {
      cancelled = true;
    };
  }, [
    repositories.performanceTypes,
    repositories.setlists,
    repositories.songs,
  ]);

  useEffect(() => {
    if (isSearchExpanded) {
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else {
      setIsFilterMenuOpen(false);
    }
  }, [isSearchExpanded]);

  const filteredSetlists = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return setlists.filter((setlist) => {
      const matchesQuery = normalizedQuery
        ? [setlist.title, setlist.venue, setlist.notes]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalizedQuery))
        : true;

      const matchesPerformanceType = filterPerformanceTypeId
        ? setlist.defaultPerformanceTypeId === filterPerformanceTypeId ||
          setlist.songEntries.some(
            (songEntry) => songEntry.performanceTypeId === filterPerformanceTypeId,
          )
        : true;

      return matchesQuery && matchesPerformanceType;
    });
  }, [filterPerformanceTypeId, query, setlists]);

  function updateSearchParam(key: string, value: string | undefined) {
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
      { replace: true },
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
        next.delete("performanceType");
        return next;
      },
      { replace: true },
    );
  }

  return (
    <PageShell className="relative space-y-4">
      <section className="px-1 pt-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
              Setlists
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {filteredSetlists.length}{" "}
              {filteredSetlists.length === 1 ? "setlist" : "setlists"}
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
            aria-label="Close setlist search"
            onClick={() => setSearchOpen(false)}
            className="cu-setlist-search-backdrop"
          />
          <section className="cu-setlist-search-panel">
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                <SearchIcon />
              </div>
              <input
                ref={searchInputRef}
                className="cu-setlist-search-input"
                value={query}
                onChange={(event) =>
                  updateSearchParam("q", event.target.value || undefined)
                }
                placeholder="Search titles, venues, or notes"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <button
                  type="button"
                  aria-label="Open filters"
                  onClick={() => setIsFilterMenuOpen((current) => !current)}
                  className={[
                    "cu-setlist-search-icon-button",
                    isFilterMenuOpen || filterPerformanceTypeId
                      ? "cu-setlist-search-icon-button-active"
                      : "",
                  ].join(" ")}
                >
                  <FilterIcon />
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {filteredSetlists.length}{" "}
                {filteredSetlists.length === 1 ? "match" : "matches"}
              </p>
              <div className="flex items-center gap-2">
                {hasSearchState ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="cu-setlist-search-secondary-button"
                  >
                    Reset
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="cu-setlist-search-secondary-button"
                >
                  Close
                </button>
              </div>
            </div>

            {isFilterMenuOpen ? (
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <select
                  className="cu-setlist-filter-select"
                  value={filterPerformanceTypeId ?? ""}
                  onChange={(event) =>
                    updateSearchParam(
                      "performanceType",
                      event.target.value || undefined,
                    )
                  }
                >
                  <option value="">All setlists</option>
                  {performanceTypes.map((performanceType) => (
                    <option
                      key={performanceType.id}
                      value={performanceType.id}
                    >
                      {performanceType.name}
                    </option>
                  ))}
                </select>
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
            Loading setlists...
          </div>
        ) : null}

        {!isLoading && filteredSetlists.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-4 py-6 text-sm text-[var(--text-muted)]">
            No setlists match the current filters.
          </div>
        ) : null}

        {!isLoading
          ? filteredSetlists.map((setlist) => (
              <article
                key={setlist.id}
                className="cu-setlist-card relative overflow-hidden"
              >
                <Link
                  to={`/setlists/${setlist.id}${editorSearchSuffix}`}
                  aria-label={`Open ${setlist.title}`}
                  className="absolute inset-0 z-10 rounded-[inherit]"
                />

                <div className="pointer-events-none relative z-20 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                      {setlist.title}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {setlist.venue || "No venue"} •{" "}
                      {formatSetlistDate(setlist.performanceDate)}
                    </p>
                  </div>

                  <p className="shrink-0 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-[var(--text-soft)]">
                    {formatUpdatedAt(setlist.updatedAt)}
                  </p>
                </div>

                <div className="pointer-events-none relative z-20 mt-4 flex flex-wrap gap-2">
                  <span className="cu-setlist-meta-pill">
                    {setlist.songEntries.length}{" "}
                    {setlist.songEntries.length === 1 ? "song" : "songs"}
                  </span>
                  <span className="cu-setlist-meta-pill">
                    {getPerformanceTypeName(
                      setlist.defaultPerformanceTypeId,
                      performanceTypes,
                    )}
                  </span>
                </div>

                <div className="relative z-20 mt-4 flex items-end justify-between gap-3">
                  <p className="pointer-events-none min-w-0 text-sm leading-6 text-[var(--text-secondary)]">
                    {summarizeSetlistSongs(setlist, songs)}
                  </p>

                  <Link
                    to={`/setlists/${setlist.id}/perform`}
                    className="cu-setlist-perform-button pointer-events-auto relative z-30 shrink-0"
                  >
                    Perform
                  </Link>
                </div>
              </article>
            ))
          : null}
      </section>

      <div className="cu-setlist-action-zone">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search setlists"
          className={`cu-setlist-search-trigger ${isSearchExpanded || hasSearchState ? "cu-setlist-search-trigger-active" : ""}`}
        >
          <SearchIcon />
        </button>

        <Link
          to={`/setlists/new${editorSearchSuffix}`}
          aria-label="Add setlist"
          className="cu-setlist-add-button"
        >
          <PlusIcon />
        </Link>
      </div>
    </PageShell>
  );
}
