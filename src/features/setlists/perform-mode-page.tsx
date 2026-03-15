import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useRepositories } from "../../app/repository-context";
import type { PerformanceType, Setlist, Song } from "../../domain/models";
import {
  formatSetlistDate,
  getEffectivePerformanceTypeId,
  getPerformanceTypeName,
  resolveEntryNote,
  sortSongEntries,
} from "./setlist-ui";

type ContentMode = "lyrics" | "lyrics_chords";

interface PerformEntryViewModel {
  entryId: string;
  index: number;
  song: Song;
  effectivePerformanceTypeId?: string;
  effectivePerformanceTypeName: string;
  resolvedNote?: string;
  resolvedNoteSource: "override" | "profile" | "none";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function noteSourceLabel(source: "override" | "profile" | "none"): string {
  switch (source) {
    case "override":
      return "Setlist override";
    case "profile":
      return "Song profile";
    case "none":
      return "No note";
  }
}

function buildPerformEntries(
  setlist: Setlist,
  songs: Song[],
  performanceTypes: PerformanceType[],
): PerformEntryViewModel[] {
  return sortSongEntries(setlist.songEntries).reduce<PerformEntryViewModel[]>(
    (entries, songEntry, index) => {
      const song = songs.find((candidate) => candidate.id === songEntry.songId);

      if (!song) {
        return entries;
      }

      const effectivePerformanceTypeId = getEffectivePerformanceTypeId(
        setlist.defaultPerformanceTypeId,
        songEntry,
      );
      const resolvedNote = resolveEntryNote(
        song,
        setlist.defaultPerformanceTypeId,
        songEntry,
      );

      entries.push({
        entryId: songEntry.id,
        index,
        song,
        effectivePerformanceTypeId,
        effectivePerformanceTypeName: getPerformanceTypeName(
          effectivePerformanceTypeId,
          performanceTypes,
        ),
        resolvedNote: resolvedNote.note,
        resolvedNoteSource: resolvedNote.source,
      });

      return entries;
    },
    [],
  );
}

export function PerformModePage() {
  const { id } = useParams<{ id: string }>();
  const repositories = useRepositories();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [performanceTypes, setPerformanceTypes] = useState<PerformanceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [contentMode, setContentMode] = useState<ContentMode>(() => {
    if (typeof window === "undefined") {
      return "lyrics_chords";
    }

    const storedValue = window.localStorage.getItem("cuelist.perform.contentMode");

    return storedValue === "lyrics" ? "lyrics" : "lyrics_chords";
  });

  useEffect(() => {
    let cancelled = false;

    async function loadPerformData() {
      if (!id) {
        setError("No setlist was selected.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const [loadedSetlist, loadedSongs, loadedPerformanceTypes] =
          await Promise.all([
            repositories.setlists.getById(id),
            repositories.songs.list(),
            repositories.performanceTypes.list(),
          ]);

        if (cancelled) {
          return;
        }

        if (!loadedSetlist) {
          setError("That setlist could not be found.");
          setSetlist(null);
          setSongs([]);
          setPerformanceTypes([]);
          return;
        }

        setSetlist(loadedSetlist);
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

    void loadPerformData();

    return () => {
      cancelled = true;
    };
  }, [
    id,
    repositories.performanceTypes,
    repositories.setlists,
    repositories.songs,
  ]);

  const performEntries = useMemo(() => {
    if (!setlist) {
      return [];
    }

    return buildPerformEntries(setlist, songs, performanceTypes);
  }, [performanceTypes, setlist, songs]);

  useEffect(() => {
    if (typeof window === "undefined" || !id) {
      return;
    }

    const storedIndex = window.sessionStorage.getItem(
      `cuelist.perform.${id}.index`,
    );

    if (!storedIndex) {
      return;
    }

    const parsedIndex = Number.parseInt(storedIndex, 10);

    if (!Number.isNaN(parsedIndex)) {
      setCurrentIndex(parsedIndex);
    }
  }, [id]);

  useEffect(() => {
    if (performEntries.length === 0) {
      setCurrentIndex(0);
      return;
    }

    setCurrentIndex((current) =>
      Math.min(Math.max(current, 0), performEntries.length - 1),
    );
  }, [performEntries.length]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("cuelist.perform.contentMode", contentMode);
  }, [contentMode]);

  useEffect(() => {
    if (typeof window === "undefined" || !id) {
      return;
    }

    window.sessionStorage.setItem(
      `cuelist.perform.${id}.index`,
      String(currentIndex),
    );
  }, [currentIndex, id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        setCurrentIndex((current) =>
          Math.min(current + 1, Math.max(performEntries.length - 1, 0)),
        );
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrentIndex((current) => Math.max(current - 1, 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [performEntries.length]);

  const currentEntry = performEntries[currentIndex];
  const previousEntry = currentIndex > 0 ? performEntries[currentIndex - 1] : null;
  const nextEntry =
    currentIndex < performEntries.length - 1
      ? performEntries[currentIndex + 1]
      : null;

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-slate-300">
        Loading perform mode...
      </div>
    );
  }

  if (error || !setlist) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6">
        <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-slate-950/80 p-6 text-center shadow-2xl shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-soft)]">
            Perform Mode
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Unable to load setlist
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {error ?? "This setlist is unavailable."}
          </p>
          <Link
            to="/setlists"
            className="cu-button cu-button-primary mt-6"
          >
            Back to setlists
          </Link>
        </div>
      </div>
    );
  }

  if (performEntries.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6">
        <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-slate-950/80 p-6 text-center shadow-2xl shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-soft)]">
            {setlist.title}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            This setlist is empty
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Add songs to the setlist before using perform mode on stage.
          </p>
          <Link
            to="/setlists"
            className="cu-button cu-button-primary mt-6"
          >
            Back to setlists
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(60,34,115,0.16),transparent_28%),linear-gradient(180deg,#050608_0%,#0b0f14_45%,#040506_100%)] px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)] text-slate-100 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-7xl flex-col gap-4 xl:grid xl:grid-cols-[1.45fr_0.55fr] xl:gap-5">
        <section className="flex min-h-0 flex-col rounded-[30px] border border-white/10 bg-slate-950/78 p-4 shadow-2xl shadow-black/30 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={id ? `/setlists/${id}` : "/setlists"}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  Exit
                </Link>
                <span className="rounded-full border border-[color-mix(in_srgb,var(--color-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-[var(--brand-soft)]">
                  Perform Mode
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {setlist.title}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                {setlist.venue || "No venue"} • {formatSetlistDate(setlist.performanceDate)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setContentMode("lyrics")}
                className={[
                  "rounded-full px-4 py-2 text-sm transition",
                  contentMode === "lyrics"
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white",
                ].join(" ")}
              >
                Lyrics only
              </button>
              <button
                type="button"
                onClick={() => setContentMode("lyrics_chords")}
                className={[
                  "rounded-full px-4 py-2 text-sm transition",
                  contentMode === "lyrics_chords"
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white",
                ].join(" ")}
              >
                Lyrics + chords
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-soft)]">
                Song {currentIndex + 1} of {performEntries.length}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {currentEntry.song.title}
              </h2>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">
                {currentEntry.song.artist ||
                  (currentEntry.song.sourceType === "cover"
                    ? "Cover artist not set"
                    : "Original")}
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              <p>
                Performance type:{" "}
                <span className="font-medium text-white">
                  {currentEntry.effectivePerformanceTypeName}
                </span>
              </p>
              <p className="mt-1">
                Note source:{" "}
                <span className="font-medium text-white">
                  {noteSourceLabel(currentEntry.resolvedNoteSource)}
                </span>
              </p>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[0.78fr_0.22fr]">
            <article className="min-h-0 rounded-[26px] border border-white/10 bg-black/20 p-5 sm:p-6">
              <div className="grid gap-4">
                <section className="rounded-[22px] border border-[color-mix(in_srgb,var(--color-primary)_22%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-soft)]">
                    Performance note
                  </p>
                  <p className="mt-3 text-base leading-7 text-[color-mix(in_srgb,white_90%,var(--color-primary-bg)_10%)] sm:text-lg">
                    {currentEntry.resolvedNote ??
                      "No resolved note for this song and performance context yet."}
                  </p>
                </section>

                {contentMode === "lyrics_chords" ? (
                  <section className="rounded-[22px] border border-white/10 bg-slate-950/65 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      Chords
                    </p>
                    <pre className="mt-4 whitespace-pre-wrap font-mono text-[1rem] leading-8 text-emerald-100 sm:text-[1.1rem]">
                      {currentEntry.song.chords ?? "No chords saved for this song."}
                    </pre>
                  </section>
                ) : null}

                <section className="min-h-0 rounded-[22px] border border-white/10 bg-slate-950/65 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Lyrics
                  </p>
                  <pre className="mt-4 whitespace-pre-wrap font-sans text-[1.2rem] leading-9 text-slate-100 sm:text-[1.4rem] sm:leading-10">
                    {currentEntry.song.lyrics ?? "No lyrics saved for this song."}
                  </pre>
                </section>
              </div>
            </article>

            <aside className="grid gap-4">
              <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Previous
                </p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-white">
                  {previousEntry?.song.title ?? "Start of set"}
                </p>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Up next
                </p>
                <p className="mt-3 text-lg font-semibold tracking-tight text-white">
                  {nextEntry?.song.title ?? "End of set"}
                </p>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Queue
                </p>
                <div className="mt-3 space-y-2">
                  {performEntries.map((entry, index) => (
                    <button
                      key={entry.entryId}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      className={[
                        "w-full rounded-2xl border px-3 py-2 text-left text-sm transition",
                        index === currentIndex
                          ? "border-[color-mix(in_srgb,var(--color-primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--brand-soft)]"
                          : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:text-white",
                      ].join(" ")}
                    >
                      {index + 1}. {entry.song.title}
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/92 px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentIndex((current) => Math.max(current - 1, 0))}
            disabled={currentIndex === 0}
            className="min-h-14 flex-1 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-base font-medium text-slate-100 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300">
            {currentIndex + 1} / {performEntries.length}
          </div>

          <button
            type="button"
            onClick={() =>
              setCurrentIndex((current) =>
                Math.min(current + 1, performEntries.length - 1),
              )
            }
            disabled={currentIndex === performEntries.length - 1}
            className="min-h-14 flex-1 rounded-[22px] bg-[var(--color-primary)] px-4 py-3 text-base font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
