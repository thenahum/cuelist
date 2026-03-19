import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useTheme } from "../../app/theme-context";
import { useRepositories } from "../../app/repository-context";
import type { PerformanceType, Setlist, Song } from "../../domain/models";
import { useScreenWakeLock } from "../../hooks/use-screen-wake-lock";
import {
  addObservabilityBreadcrumb,
  captureObservabilityError,
} from "../../lib/observability";
import {
  getSongSheetContent,
  SongSheetRenderer,
  type SongSheetScale,
} from "../songs/song-sheet-renderer";
import {
  formatSetlistDate,
  getEffectivePerformanceTypeId,
  getPerformanceTypeName,
  resolveEntryNote,
  sortSongEntries,
} from "./setlist-ui";

type ContentMode = "lyrics" | "lyrics_chords";
const scaleSteps: SongSheetScale[] = ["large", "xlarge"];

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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={open ? "h-4 w-4 rotate-180 transition" : "h-4 w-4 transition"}
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PerformModePage() {
  const { id } = useParams<{ id: string }>();
  const repositories = useRepositories();
  const { mode, setMode } = useTheme();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [performanceTypes, setPerformanceTypes] = useState<PerformanceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [songSheetScale, setSongSheetScale] = useState<SongSheetScale>("xlarge");
  const [isControlsSheetOpen, setIsControlsSheetOpen] = useState(false);
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
        addObservabilityBreadcrumb({
          category: "perform",
          level: "error",
          message: "Perform mode load failed",
          data: {
            action: "perform.enter",
            route: "/setlists/unknown/perform",
            status: "failure",
          },
        });
        setError("No setlist was selected.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const startedAt = Date.now();

      try {
        addObservabilityBreadcrumb({
          category: "perform",
          message: "Perform mode load started",
          data: {
            action: "perform.enter",
            route: `/setlists/${id}/perform`,
            setlistId: id,
            status: "start",
          },
        });
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
          addObservabilityBreadcrumb({
            category: "perform",
            level: "error",
            message: "Perform mode load failed",
            data: {
              action: "perform.enter",
              durationMs: Date.now() - startedAt,
              route: `/setlists/${id}/perform`,
              setlistId: id,
              status: "failure",
            },
          });
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
        addObservabilityBreadcrumb({
          category: "perform",
          message: "Perform mode entered",
          data: {
            action: "perform.enter",
            durationMs: Date.now() - startedAt,
            route: `/setlists/${id}/perform`,
            setlistId: loadedSetlist.id,
            songEntryCount: loadedSetlist.songEntries.length,
            status: "success",
          },
        });
      } catch (loadError) {
        if (!cancelled) {
          addObservabilityBreadcrumb({
            category: "perform",
            level: "error",
            message: "Perform mode load failed",
            data: {
              action: "perform.enter",
              durationMs: Date.now() - startedAt,
              route: `/setlists/${id}/perform`,
              setlistId: id,
              status: "failure",
            },
          });
          captureObservabilityError(loadError, {
            operation: "perform.enter",
            route: `/setlists/${id}/perform`,
            context: {
              action: "perform.enter",
              durationMs: Date.now() - startedAt,
              route: `/setlists/${id}/perform`,
              setlistId: id,
              status: "failure",
            },
          });
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
      if (event.key === "Escape") {
        setIsControlsSheetOpen(false);
      }

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
  const nextEntry =
    currentIndex < performEntries.length - 1
      ? performEntries[currentIndex + 1]
      : null;
  const cueEntries = performEntries.slice(
    currentIndex,
    Math.min(currentIndex + 4, performEntries.length),
  );
  const currentScaleIndex = scaleSteps.indexOf(songSheetScale);
  const songSheetContent = currentEntry
    ? getSongSheetContent(currentEntry.song)
    : undefined;
  const shouldKeepScreenAwake =
    !isLoading && !error && Boolean(setlist) && performEntries.length > 0;

  useScreenWakeLock(shouldKeepScreenAwake);

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
    <div className="cu-perform-shell">
      <div className="cu-perform-stage">
        <header className="cu-perform-header">
          <div className="cu-perform-header-main">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={id ? `/setlists/${id}` : "/setlists"}
                className="cu-button cu-button-neutral cu-button-small"
              >
                Exit
              </Link>
              <span className="cu-perform-status-pill">
                Song {currentIndex + 1} of {performEntries.length}
              </span>
            </div>
            <h1 className="cu-perform-song-title">{currentEntry.song.title}</h1>
            <p className="cu-perform-song-subtitle">
              {currentEntry.song.artist ||
                (currentEntry.song.sourceType === "cover"
                  ? "Cover artist not set"
                  : "Original")}
            </p>
            <div className="cu-perform-pill-row">
              <span className="cu-setlist-meta-pill">
                {currentEntry.effectivePerformanceTypeName}
              </span>
              <span className="cu-setlist-meta-pill cu-perform-pill-desktop-only">
                {noteSourceLabel(currentEntry.resolvedNoteSource)}
              </span>
              {nextEntry ? (
                <span className="cu-setlist-meta-pill cu-perform-pill-desktop-only">
                  Next: {nextEntry.song.title}
                </span>
              ) : null}
            </div>
          </div>

          <div className="cu-perform-header-controls">
            <div className="cu-mini-segmented" role="group" aria-label="Song sheet display">
              <button
                type="button"
                onClick={() => setContentMode("lyrics")}
                className={[
                  "cu-mini-segment",
                  contentMode === "lyrics" ? "cu-mini-segment-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Lyrics
              </button>
              <button
                type="button"
                onClick={() => setContentMode("lyrics_chords")}
                className={[
                  "cu-mini-segment",
                  contentMode === "lyrics_chords" ? "cu-mini-segment-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Chords
              </button>
            </div>

            <div className="cu-mini-segmented" role="group" aria-label="Perform mode text size">
              <button
                type="button"
                aria-label="Decrease text size"
                disabled={currentScaleIndex === 0}
                onClick={() =>
                  setSongSheetScale(scaleSteps[Math.max(currentScaleIndex - 1, 0)])
                }
                className="cu-mini-segment"
              >
                A-
              </button>
              <button
                type="button"
                aria-label="Increase text size"
                disabled={currentScaleIndex === scaleSteps.length - 1}
                onClick={() =>
                  setSongSheetScale(
                    scaleSteps[Math.min(currentScaleIndex + 1, scaleSteps.length - 1)],
                  )
                }
                className="cu-mini-segment"
              >
                A+
              </button>
            </div>

            <div className="cu-mini-segmented" role="group" aria-label="Perform mode theme">
              <button
                type="button"
                onClick={() => setMode("light")}
                className={[
                  "cu-mini-segment",
                  mode === "light" ? "cu-mini-segment-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={mode === "light"}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setMode("dark")}
                className={[
                  "cu-mini-segment",
                  mode === "dark" ? "cu-mini-segment-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={mode === "dark"}
              >
                Dark
              </button>
            </div>
          </div>
        </header>

        <div className="cu-perform-layout">
          <section className="cu-perform-reader">
            {currentEntry.song.externalTabsUrl ? (
              <div className="cu-perform-reader-actions">
                <a
                  href={currentEntry.song.externalTabsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cu-external-tabs-button"
                >
                  Open Tabs ↗
                </a>
              </div>
            ) : null}

            <SongSheetRenderer
              content={songSheetContent}
              showChords={contentMode === "lyrics_chords"}
              presentation="perform"
              scale={songSheetScale}
              emptyMessage="No song sheet saved for this song yet."
              className="cu-perform-song-sheet"
            />
          </section>

          <aside className="cu-perform-sidebar">
            <section className="cu-perform-panel">
              <div className="cu-perform-panel-header">
                <p className="cu-perform-panel-label">Performance Note</p>
                <span className="cu-setlist-meta-pill">
                  {currentEntry.effectivePerformanceTypeName}
                </span>
              </div>
              <p className="cu-perform-note-copy">
                {currentEntry.resolvedNote ??
                  "No resolved note for this song and performance context yet."}
              </p>
            </section>

            <section className="cu-perform-panel">
              <div className="cu-perform-panel-header">
                <p className="cu-perform-panel-label">Cue</p>
                <span className="cu-perform-panel-caption">
                  Current song and what is coming next
                </span>
              </div>
              <div className="cu-perform-cue-list">
                {cueEntries.map((entry, cueIndex) => {
                  const actualIndex = currentIndex + cueIndex;
                  const isCurrent = actualIndex === currentIndex;

                  return (
                    <button
                      key={entry.entryId}
                      type="button"
                      onClick={() => setCurrentIndex(actualIndex)}
                      className={[
                        "cu-perform-cue-item",
                        isCurrent ? "cu-perform-cue-item-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span className="cu-perform-cue-position">
                        {isCurrent ? "Now" : actualIndex + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="cu-perform-cue-title">{entry.song.title}</span>
                        <span className="cu-perform-cue-meta">
                          {entry.song.artist || "Original"} ·{" "}
                          {entry.effectivePerformanceTypeName}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <div className="cu-perform-footer">
        <div className="cu-perform-footer-inner">
          <div className="cu-perform-set-bar">
            <div className="cu-perform-set-bar-copy-group">
              <span className="cu-perform-set-bar-title">{setlist.title}</span>
              <span className="cu-perform-set-bar-copy">
                {setlist.venue || "No venue"} · {formatSetlistDate(setlist.performanceDate)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsControlsSheetOpen((current) => !current)}
              aria-expanded={isControlsSheetOpen}
              aria-controls="perform-controls-sheet"
              className="cu-perform-sheet-trigger"
            >
              Display
              <ChevronIcon open={isControlsSheetOpen} />
            </button>
          </div>

          <div className="cu-perform-nav">
            <button
              type="button"
              onClick={() => setCurrentIndex((current) => Math.max(current - 1, 0))}
              disabled={currentIndex === 0}
              className="cu-perform-nav-button cu-perform-nav-button-secondary"
            >
              Previous
            </button>

            <div className="cu-perform-nav-count">
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
              className="cu-perform-nav-button cu-perform-nav-button-primary"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isControlsSheetOpen ? (
        <div className="cu-perform-sheet-layer">
          <button
            type="button"
            aria-label="Close perform controls"
            className="cu-perform-sheet-backdrop"
            onClick={() => setIsControlsSheetOpen(false)}
          />
          <section
            id="perform-controls-sheet"
            className="cu-perform-sheet"
            aria-label="Perform display controls"
          >
            <div className="cu-perform-sheet-header">
              <div>
                <p className="cu-perform-panel-label">Display Controls</p>
                <p className="cu-perform-panel-caption">
                  Reader settings for perform mode
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsControlsSheetOpen(false)}
                className="cu-setlist-icon-button"
                aria-label="Close perform controls"
              >
                ×
              </button>
            </div>

            <div className="cu-perform-sheet-groups">
              <div className="cu-perform-sheet-group">
                <p className="cu-perform-sheet-label">Display</p>
                <div className="cu-mini-segmented" role="group" aria-label="Song sheet display">
                  <button
                    type="button"
                    onClick={() => setContentMode("lyrics")}
                    className={[
                      "cu-mini-segment",
                      contentMode === "lyrics" ? "cu-mini-segment-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    Lyrics
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentMode("lyrics_chords")}
                    className={[
                      "cu-mini-segment",
                      contentMode === "lyrics_chords" ? "cu-mini-segment-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    Chords
                  </button>
                </div>
              </div>

              <div className="cu-perform-sheet-group">
                <p className="cu-perform-sheet-label">Text size</p>
                <div className="cu-mini-segmented" role="group" aria-label="Perform mode text size">
                  <button
                    type="button"
                    aria-label="Decrease text size"
                    disabled={currentScaleIndex === 0}
                    onClick={() =>
                      setSongSheetScale(scaleSteps[Math.max(currentScaleIndex - 1, 0)])
                    }
                    className="cu-mini-segment"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    aria-label="Increase text size"
                    disabled={currentScaleIndex === scaleSteps.length - 1}
                    onClick={() =>
                      setSongSheetScale(
                        scaleSteps[Math.min(currentScaleIndex + 1, scaleSteps.length - 1)],
                      )
                    }
                    className="cu-mini-segment"
                  >
                    A+
                  </button>
                </div>
              </div>

              <div className="cu-perform-sheet-group">
                <p className="cu-perform-sheet-label">Theme</p>
                <div className="cu-mini-segmented" role="group" aria-label="Perform mode theme">
                  <button
                    type="button"
                    onClick={() => setMode("light")}
                    className={[
                      "cu-mini-segment",
                      mode === "light" ? "cu-mini-segment-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={mode === "light"}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("dark")}
                    className={[
                      "cu-mini-segment",
                      mode === "dark" ? "cu-mini-segment-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={mode === "dark"}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
