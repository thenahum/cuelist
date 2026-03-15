import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { PerformanceType, Setlist, Song } from "../../domain/models";
import { useRepositories } from "../../app/repository-context";
import { PageContentStack } from "../../components/page-content-stack";
import { PageShell } from "../../components/page-shell";

const inputClassName =
  "mt-2 cu-search-field";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function getUsageSummary(
  performanceTypeId: string,
  songs: Song[],
  setlists: Setlist[],
): string {
  const songCount = songs.filter((song) =>
    song.performanceProfiles.some(
      (profile) => profile.performanceTypeId === performanceTypeId,
    ),
  ).length;

  const setlistCount = setlists.filter(
    (setlist) =>
      setlist.defaultPerformanceTypeId === performanceTypeId ||
      setlist.songEntries.some(
        (entry) => entry.performanceTypeId === performanceTypeId,
      ),
  ).length;

  if (songCount === 0 && setlistCount === 0) {
    return "Unused";
  }

  const parts: string[] = [];

  if (songCount > 0) {
    parts.push(`${songCount} song${songCount === 1 ? "" : "s"}`);
  }

  if (setlistCount > 0) {
    parts.push(`${setlistCount} setlist${setlistCount === 1 ? "" : "s"}`);
  }

  return parts.join(" • ");
}

function isTypeInUse(
  performanceTypeId: string,
  songs: Song[],
  setlists: Setlist[],
): boolean {
  return (
    songs.some((song) =>
      song.performanceProfiles.some(
        (profile) => profile.performanceTypeId === performanceTypeId,
      ),
    ) ||
    setlists.some(
      (setlist) =>
        setlist.defaultPerformanceTypeId === performanceTypeId ||
        setlist.songEntries.some(
          (entry) => entry.performanceTypeId === performanceTypeId,
        ),
    )
  );
}

export function PerformanceTypesPage() {
  const repositories = useRepositories();
  const [searchParams, setSearchParams] = useSearchParams();
  const [performanceTypes, setPerformanceTypes] = useState<PerformanceType[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeTypeId = searchParams.get("type");
  const isCreating = searchParams.get("editor") === "new";
  const query = searchParams.get("q") ?? "";

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      setIsLoading(true);

      try {
        const [loadedPerformanceTypes, loadedSongs, loadedSetlists] =
          await Promise.all([
            repositories.performanceTypes.list(),
            repositories.songs.list(),
            repositories.setlists.list(),
          ]);

        if (cancelled) {
          return;
        }

        setPerformanceTypes(loadedPerformanceTypes);
        setSongs(loadedSongs);
        setSetlists(loadedSetlists);
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

  const activeType = performanceTypes.find((type) => type.id === activeTypeId);

  useEffect(() => {
    if (isCreating) {
      setName("");
      return;
    }

    setName(activeType?.name ?? "");
  }, [activeType, isCreating]);

  useEffect(() => {
    if (activeTypeId && !activeType) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("type");
          return next;
        },
        { replace: true },
      );
    }
  }, [activeType, activeTypeId, setSearchParams]);

  const filteredPerformanceTypes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return performanceTypes;
    }

    return performanceTypes.filter((type) =>
      type.name.toLowerCase().includes(normalizedQuery),
    );
  }, [performanceTypes, query]);

  function openTypeEditor(typeId: string) {
    setError(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("type", typeId);
      next.delete("editor");
      return next;
    });
  }

  function openNewTypeEditor() {
    setError(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("editor", "new");
      next.delete("type");
      return next;
    });
  }

  function closeEditor() {
    setError(null);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("editor");
        next.delete("type");
        return next;
      },
      { replace: true },
    );
  }

  async function refreshData(nextActiveTypeId?: string | null) {
    const [loadedPerformanceTypes, loadedSongs, loadedSetlists] =
      await Promise.all([
        repositories.performanceTypes.list(),
        repositories.songs.list(),
        repositories.setlists.list(),
      ]);

    setPerformanceTypes(loadedPerformanceTypes);
    setSongs(loadedSongs);
    setSetlists(loadedSetlists);

    if (typeof nextActiveTypeId === "string") {
      openTypeEditor(nextActiveTypeId);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Performance type name is required.");
      return;
    }

    const nameAlreadyExists = performanceTypes.some(
      (type) =>
        type.id !== activeType?.id &&
        type.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (nameAlreadyExists) {
      setError("That performance type already exists.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      if (activeType && !isCreating) {
        const updated = await repositories.performanceTypes.update({
          ...activeType,
          name: trimmedName,
        });

        await refreshData(updated.id);
      } else {
        const created = await repositories.performanceTypes.create({
          name: trimmedName,
          isSeeded: false,
        });

        await refreshData(created.id);
      }
    } catch (submitError) {
      setError(toErrorMessage(submitError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!activeType) {
      return;
    }

    if (activeType.isSeeded || isTypeInUse(activeType.id, songs, setlists)) {
      setError("Only unused custom performance types can be deleted right now.");
      return;
    }

    const confirmed = window.confirm(`Delete "${activeType.name}"?`);

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await repositories.performanceTypes.delete(activeType.id);
      closeEditor();
      setName("");
      await refreshData(null);
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  }

  const selectedTypeCanDelete = activeType
    ? !activeType.isSeeded && !isTypeInUse(activeType.id, songs, setlists)
    : false;

  return (
    <PageShell className="relative">
      <PageContentStack>
      <section>
        <div className="space-y-4">
          <div>
            <Link to="/songs" className="cu-button cu-button-neutral cu-button-small">
              <span aria-hidden="true">←</span>
              Songs
            </Link>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                Performance Types
              </h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {filteredPerformanceTypes.length}{" "}
                {filteredPerformanceTypes.length === 1 ? "type" : "types"}
              </p>
            </div>

            <button
              type="button"
              onClick={openNewTypeEditor}
              className="cu-button cu-button-primary"
            >
              Add Type
            </button>
          </div>
        </div>
      </section>

      <section>
        <label className="block text-sm text-[var(--text-secondary)]">
          Search
          <input
            className={inputClassName}
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;

              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current);

                  if (nextValue) {
                    next.set("q", nextValue);
                  } else {
                    next.delete("q");
                  }

                  return next;
                },
                { replace: true },
              );
            }}
            placeholder="Find a performance type"
          />
        </label>
      </section>

      {error && !(activeType || isCreating) ? (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--color-destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] px-4 py-3 text-sm text-[color-mix(in_srgb,var(--color-destructive-bg)_78%,white_22%)]">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        {isLoading ? (
          <div className="cu-empty-state">
            Loading performance types...
          </div>
        ) : null}

        {!isLoading && filteredPerformanceTypes.length === 0 ? (
          <div className="cu-empty-state">
            No performance types match the current search.
          </div>
        ) : null}

        {!isLoading
          ? filteredPerformanceTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  openTypeEditor(type.id);
                  setError(null);
                }}
                className="cu-setlist-card w-full text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                        {type.name}
                      </h2>
                      {type.isSeeded ? (
                        <span className="cu-setlist-meta-pill text-[0.7rem] uppercase tracking-[0.2em]">
                          Seeded
                        </span>
                      ) : (
                        <span className="rounded-full border border-[color-mix(in_srgb,var(--color-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-[var(--brand-soft)]">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      {getUsageSummary(type.id, songs, setlists)}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm text-[var(--text-soft)]">
                    Edit
                  </span>
                </div>
              </button>
            ))
          : null}
      </section>
      </PageContentStack>

      {activeType || isCreating ? (
        <div className="cu-editor-overlay">
          <button
            type="button"
            aria-label="Close performance type editor"
            className="cu-editor-backdrop"
            onClick={closeEditor}
          />
          <form onSubmit={handleSubmit} className="cu-editor-panel">
            <div className="cu-editor-header">
              <div>
                <p className="cu-editor-eyebrow">
                  {isCreating ? "New type" : "Edit type"}
                </p>
                <h2 className="cu-editor-title">
                  {isCreating
                    ? "Create performance type"
                    : activeType?.name ?? "Edit performance type"}
                </h2>
                <p className="cu-editor-subtitle">
                  Keep this list focused on the live contexts you actually use.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="cu-button cu-button-neutral cu-button-small"
              >
                Close
              </button>
            </div>

            <div className="cu-editor-body">
              {error ? (
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--color-destructive)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] px-4 py-3 text-sm text-[color-mix(in_srgb,var(--color-destructive-bg)_78%,white_22%)]">
                  {error}
                </div>
              ) : null}

              <label className="block text-sm text-[var(--text-secondary)]">
                Name
                <input
                  className={inputClassName}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acoustic"
                />
              </label>

              {activeType ? (
                <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-secondary)]">
                  <p>{getUsageSummary(activeType.id, songs, setlists)}</p>
                  <p className="mt-2">
                    {activeType.isSeeded
                      ? "Seeded types can be renamed, but deletion is locked to protect the starter data model."
                      : selectedTypeCanDelete
                        ? "This custom type is currently unused, so it can be deleted safely."
                        : "This type is in use, so deletion is disabled until references are removed."}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-4 sm:px-5">
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={isSaving || isDeleting}
                  className="cu-button cu-button-primary"
                >
                  {isSaving
                    ? "Saving..."
                    : isCreating
                      ? "Create type"
                      : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="cu-button cu-button-neutral"
                >
                  Cancel
                </button>
              </div>

              {activeType ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!selectedTypeCanDelete || isSaving || isDeleting}
                  className="cu-button cu-button-destructive"
                >
                  {isDeleting ? "Deleting..." : "Delete type"}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </PageShell>
  );
}
