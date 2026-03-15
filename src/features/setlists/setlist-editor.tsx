import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";

import type {
  PerformanceType,
  Setlist,
  SetlistDraft,
  SetlistSongEntry,
  Song,
} from "../../domain/models";
import { createId } from "../../shared/id";
import { PerformanceProfileChip } from "../songs/performance-profile-chip";
import {
  createEmptySetlistDraft,
  formatSetlistDate,
  getEffectivePerformanceTypeId,
  getPerformanceTypeName,
  normalizeOptionalText,
  resolveEntryNote,
  sortSongEntries,
} from "./setlist-ui";

interface SetlistEditorProps {
  setlist?: Setlist;
  songs: Song[];
  performanceTypes: PerformanceType[];
  backTo: string;
  detailPath?: string;
  onSave(setlist: Setlist | SetlistDraft): Promise<void>;
  onDelete(setlist: Setlist): Promise<void>;
  onCancel(): void;
}

type EditableSetlistEntry = SetlistSongEntry;

interface SetlistFormState {
  title: string;
  venue: string;
  performanceDate: string;
  notes: string;
  defaultPerformanceTypeId: string;
  songEntries: EditableSetlistEntry[];
}

const fieldClassName =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[color-mix(in_srgb,var(--brand)_48%,var(--border))] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]";

const inlineFieldClassName =
  "w-full border-0 border-b border-[var(--border)] bg-transparent px-0 pb-2 pt-1 text-[0.96rem] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[color-mix(in_srgb,var(--brand)_52%,var(--border-strong))]";

const inlineTitleClassName =
  "w-full border-0 border-b border-[var(--border-strong)] bg-transparent px-0 pb-3 pt-1 text-3xl font-semibold tracking-tight text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[color-mix(in_srgb,var(--brand)_52%,var(--border-strong))] sm:text-4xl";

const notesClassName = `${fieldClassName} min-h-28 resize-y`;
const entryNotesClassName = `${fieldClassName} min-h-24 resize-y`;

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M4 20h4l10.5-10.5a1.8 1.8 0 0 0 0-2.5l-1.5-1.5a1.8 1.8 0 0 0-2.5 0L4 16v4Z"
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
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function createFormState(setlist?: Setlist): SetlistFormState {
  if (!setlist) {
    const draft = createEmptySetlistDraft();

    return {
      title: draft.title,
      venue: draft.venue ?? "",
      performanceDate: draft.performanceDate ?? "",
      notes: draft.notes ?? "",
      defaultPerformanceTypeId: draft.defaultPerformanceTypeId ?? "",
      songEntries: draft.songEntries,
    };
  }

  return {
    title: setlist.title,
    venue: setlist.venue ?? "",
    performanceDate: setlist.performanceDate ?? "",
    notes: setlist.notes ?? "",
    defaultPerformanceTypeId: setlist.defaultPerformanceTypeId ?? "",
    songEntries: sortSongEntries(setlist.songEntries),
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatDateLabel(performanceDate: string): string {
  return performanceDate ? formatSetlistDate(performanceDate) : "Add date";
}

function reorderEntries(
  entries: EditableSetlistEntry[],
  draggedEntryId: string,
  targetEntryId: string,
): EditableSetlistEntry[] {
  const sourceIndex = entries.findIndex((entry) => entry.id === draggedEntryId);
  const targetIndex = entries.findIndex((entry) => entry.id === targetEntryId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return entries;
  }

  const nextEntries = [...entries];
  const [movedEntry] = nextEntries.splice(sourceIndex, 1);
  nextEntries.splice(targetIndex, 0, movedEntry);

  return nextEntries.map((entry, index) => ({
    ...entry,
    order: index + 1,
  }));
}

export function SetlistEditor({
  setlist,
  songs,
  performanceTypes,
  backTo,
  detailPath,
  onSave,
  onDelete,
  onCancel,
}: SetlistEditorProps) {
  const isExistingSetlist = Boolean(setlist);
  const [formState, setFormState] = useState(() => createFormState(setlist));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(!setlist);
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);
  const [songPickerTargetEntryId, setSongPickerTargetEntryId] = useState<
    string | null
  >(null);
  const [songPickerQuery, setSongPickerQuery] = useState("");
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dragOverEntryId, setDragOverEntryId] = useState<string | null>(null);
  const songPickerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFormState(createFormState(setlist));
    setIsEditMode(!setlist);
  }, [setlist]);

  useEffect(() => {
    if (isSongPickerOpen) {
      window.requestAnimationFrame(() => {
        songPickerInputRef.current?.focus();
      });
    } else {
      setSongPickerQuery("");
      setSongPickerTargetEntryId(null);
    }
  }, [isSongPickerOpen]);

  const songsById = useMemo(() => new Map(songs.map((song) => [song.id, song])), [songs]);

  const sortedSongs = useMemo(
    () =>
      [...songs].sort((left, right) =>
        left.title.localeCompare(right.title, undefined, { sensitivity: "base" }),
      ),
    [songs],
  );

  const filteredSongOptions = useMemo(() => {
    const normalizedQuery = songPickerQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return sortedSongs;
    }

    return sortedSongs.filter((song) =>
      [song.title, song.artist]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery)),
    );
  }, [songPickerQuery, sortedSongs]);

  const songLinkState = useMemo(() => {
    if (!setlist || !detailPath) {
      return undefined;
    }

    return {
      backTo: detailPath,
      backLabel: formState.title.trim() || "Setlist",
    };
  }, [detailPath, formState.title, setlist]);

  function updateField<Key extends keyof SetlistFormState>(
    key: Key,
    value: SetlistFormState[Key],
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateSongEntry(
    songEntryId: string,
    patch: Partial<EditableSetlistEntry>,
  ) {
    setFormState((current) => ({
      ...current,
      songEntries: current.songEntries.map((songEntry) =>
        songEntry.id === songEntryId ? { ...songEntry, ...patch } : songEntry,
      ),
    }));
  }

  function openSongPicker(targetEntryId?: string) {
    if (songs.length === 0) {
      setError("Add songs to your catalog before building a setlist.");
      return;
    }

    setError(null);
    setSongPickerTargetEntryId(targetEntryId ?? null);
    setIsSongPickerOpen(true);
  }

  function closeSongPicker() {
    setIsSongPickerOpen(false);
  }

  function handleSongSelection(songId: string) {
    setError(null);
    setFormState((current) => {
      if (songPickerTargetEntryId) {
        return {
          ...current,
          songEntries: current.songEntries.map((songEntry) =>
            songEntry.id === songPickerTargetEntryId
              ? { ...songEntry, songId }
              : songEntry,
          ),
        };
      }

      return {
        ...current,
        songEntries: [
          ...current.songEntries,
          {
            id: createId("entry"),
            songId,
            order: current.songEntries.length + 1,
            performanceTypeId: undefined,
            performanceNoteOverride: undefined,
          },
        ],
      };
    });
    closeSongPicker();
  }

  function removeSongEntry(songEntryId: string) {
    setFormState((current) => ({
      ...current,
      songEntries: current.songEntries
        .filter((songEntry) => songEntry.id !== songEntryId)
        .map((songEntry, index) => ({
          ...songEntry,
          order: index + 1,
        })),
    }));
  }

  function handleEntryDragStart(
    event: DragEvent<HTMLButtonElement>,
    songEntryId: string,
  ) {
    setDraggedEntryId(songEntryId);
    setDragOverEntryId(songEntryId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", songEntryId);
  }

  function handleEntryDragOver(
    event: DragEvent<HTMLElement>,
    songEntryId: string,
  ) {
    if (!draggedEntryId || draggedEntryId === songEntryId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverEntryId(songEntryId);
  }

  function handleEntryDrop(
    event: DragEvent<HTMLElement>,
    targetEntryId: string,
  ) {
    event.preventDefault();
    const activeEntryId =
      draggedEntryId || event.dataTransfer.getData("text/plain");

    if (!activeEntryId) {
      return;
    }

    setFormState((current) => ({
      ...current,
      songEntries: reorderEntries(current.songEntries, activeEntryId, targetEntryId),
    }));
    setDraggedEntryId(null);
    setDragOverEntryId(null);
  }

  function handleEntryDragEnd() {
    setDraggedEntryId(null);
    setDragOverEntryId(null);
  }

  function validateForm(): string | null {
    if (!formState.title.trim()) {
      return "Setlist title is required.";
    }

    const hasUnselectedSong = formState.songEntries.some((songEntry) => !songEntry.songId);

    if (hasUnselectedSong) {
      return "Every setlist entry needs a song.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSaving(true);

    const draft: SetlistDraft = {
      title: formState.title.trim(),
      venue: normalizeOptionalText(formState.venue),
      performanceDate: normalizeOptionalText(formState.performanceDate),
      notes: normalizeOptionalText(formState.notes),
      defaultPerformanceTypeId:
        normalizeOptionalText(formState.defaultPerformanceTypeId),
      songEntries: formState.songEntries.map((songEntry, index) => ({
        id: songEntry.id,
        songId: songEntry.songId,
        order: index + 1,
        performanceTypeId: normalizeOptionalText(songEntry.performanceTypeId ?? ""),
        performanceNoteOverride: normalizeOptionalText(
          songEntry.performanceNoteOverride ?? "",
        ),
      })),
    };

    try {
      if (setlist) {
        await onSave({
          ...setlist,
          ...draft,
        });
      } else {
        await onSave(draft);
      }

      setIsEditMode(false);
    } catch (submitError) {
      setError(toErrorMessage(submitError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!setlist) {
      return;
    }

    const confirmed = window.confirm(`Delete "${setlist.title}"?`);

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await onDelete(setlist);
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancelEdit() {
    if (!setlist) {
      onCancel();
      return;
    }

    setFormState(createFormState(setlist));
    setError(null);
    setIsEditMode(false);
    setDraggedEntryId(null);
    setDragOverEntryId(null);
    closeSongPicker();
  }

  return (
    <form className="space-y-4 pb-10" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backTo}
          className="cu-button cu-button-neutral"
        >
          <span aria-hidden="true">←</span>
          Setlists
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {setlist && !isEditMode ? (
            <Link
              to={`/setlists/${setlist.id}/perform`}
              className="cu-setlist-perform-button"
            >
              Perform
            </Link>
          ) : null}

          {!isEditMode ? (
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="cu-button cu-button-neutral"
            >
              <PencilIcon />
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="px-1 pt-1">
        {isEditMode ? (
          <div className="space-y-4">
            <input
              className={inlineTitleClassName}
              value={formState.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Untitled setlist"
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                  Venue
                </span>
                <input
                  className={inlineFieldClassName}
                  value={formState.venue}
                  onChange={(event) => updateField("venue", event.target.value)}
                  placeholder="Add venue"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                  Date
                </span>
                <input
                  type="date"
                  className={inlineFieldClassName}
                  value={formState.performanceDate}
                  onChange={(event) =>
                    updateField("performanceDate", event.target.value)
                  }
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                  Default profile
                </span>
                <select
                  className={inlineFieldClassName}
                  value={formState.defaultPerformanceTypeId}
                  onChange={(event) =>
                    updateField("defaultPerformanceTypeId", event.target.value)
                  }
                >
                  <option value="">No default profile</option>
                  {performanceTypes.map((performanceType) => (
                    <option key={performanceType.id} value={performanceType.id}>
                      {performanceType.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {formState.title || "Untitled setlist"}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {formState.venue ? (
                <span className="cu-setlist-meta-pill">{formState.venue}</span>
              ) : null}
              <span className="cu-setlist-meta-pill">
                {formatDateLabel(formState.performanceDate)}
              </span>
              {normalizeOptionalText(formState.defaultPerformanceTypeId) ? (
                <span className="cu-setlist-meta-pill">
                  {getPerformanceTypeName(
                    normalizeOptionalText(formState.defaultPerformanceTypeId),
                    performanceTypes,
                  )}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {(isEditMode || formState.notes.trim()) ? (
        <section className="cu-song-workspace-panel">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--brand-soft)]">
            Notes
          </p>
          <div className="mt-4">
            {isEditMode ? (
              <textarea
                className={notesClassName}
                value={formState.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Pacing notes, transition reminders, rehearsal priorities..."
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
                {formState.notes}
              </p>
            )}
          </div>
        </section>
      ) : null}

      <section className="cu-song-workspace-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-muted)]">
            {formState.songEntries.length}{" "}
            {formState.songEntries.length === 1 ? "song" : "songs"}
          </p>
          {isEditMode ? (
            <button
              type="button"
              onClick={() => openSongPicker()}
              className="cu-setlist-add-song-button"
            >
              <PlusIcon />
              Add Song
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {formState.songEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">
              No songs in this setlist yet.
            </div>
          ) : null}

          {formState.songEntries.map((songEntry, index) => {
            const song = songsById.get(songEntry.songId);
            const effectivePerformanceTypeId = getEffectivePerformanceTypeId(
              normalizeOptionalText(formState.defaultPerformanceTypeId),
              songEntry,
            );
            const matchingProfile = song?.performanceProfiles.find(
              (profile) => profile.performanceTypeId === effectivePerformanceTypeId,
            );
            const resolvedNote = resolveEntryNote(
              song,
              normalizeOptionalText(formState.defaultPerformanceTypeId),
              songEntry,
            );

            if (!isEditMode) {
              return (
                <Link
                  key={songEntry.id}
                  to={song ? `/songs/${song.id}` : "#"}
                  state={songLinkState}
                  className="group block rounded-[26px] border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--border-strong)] sm:p-5"
                >
                  <div className="flex gap-4">
                    <div className="shrink-0">
                      <span className="cu-setlist-slot-badge">{index + 1}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                            {song?.title ?? "Unknown song"}
                          </h2>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {song?.artist ||
                              (song?.sourceType === "cover"
                                ? "Cover artist not set"
                                : "Original catalog entry")}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {matchingProfile ? (
                            <PerformanceProfileChip
                              profile={matchingProfile}
                              performanceTypes={performanceTypes}
                            />
                          ) : (
                            <span className="cu-setlist-meta-pill">
                              {getPerformanceTypeName(
                                effectivePerformanceTypeId,
                                performanceTypes,
                              )}
                            </span>
                          )}
                          <span className="text-sm text-[var(--text-soft)] transition group-hover:text-[var(--text-secondary)]">
                            →
                          </span>
                        </div>
                      </div>

                      {resolvedNote.note ? (
                        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                          {resolvedNote.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            }

            const isDropTarget =
              dragOverEntryId === songEntry.id && draggedEntryId !== songEntry.id;

            return (
              <article
                key={songEntry.id}
                onDragOver={(event) => handleEntryDragOver(event, songEntry.id)}
                onDrop={(event) => handleEntryDrop(event, songEntry.id)}
                className={[
                  "rounded-[26px] border bg-[var(--surface-soft)] p-4 transition sm:p-5",
                  isDropTarget
                    ? "border-[color-mix(in_srgb,var(--brand)_50%,var(--border-strong))] bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--surface-soft))]"
                    : "border-[var(--border)]",
                ].join(" ")}
              >
                <div className="flex gap-4">
                  <div className="shrink-0">
                    <span className="cu-setlist-slot-badge">{index + 1}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={song ? `/songs/${song.id}` : "#"}
                            state={songLinkState}
                            className="text-xl font-semibold tracking-tight text-[var(--text-primary)] hover:underline"
                          >
                            {song?.title ?? "Unknown song"}
                          </Link>
                          {matchingProfile ? (
                            <PerformanceProfileChip
                              profile={matchingProfile}
                              performanceTypes={performanceTypes}
                            />
                          ) : (
                            <span className="cu-setlist-meta-pill">
                              {getPerformanceTypeName(
                                effectivePerformanceTypeId,
                                performanceTypes,
                              )}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {song?.artist ||
                            (song?.sourceType === "cover"
                              ? "Cover artist not set"
                              : "Original catalog entry")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openSongPicker(songEntry.id)}
                          className="cu-button cu-button-neutral cu-button-small"
                        >
                          Change song
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSongEntry(songEntry.id)}
                          className="cu-button cu-button-destructive cu-button-small"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          draggable
                          aria-label={`Reorder slot ${index + 1}`}
                          onDragStart={(event) =>
                            handleEntryDragStart(event, songEntry.id)
                          }
                          onDragEnd={handleEntryDragEnd}
                          className="cu-setlist-drag-handle"
                        >
                          <GripIcon />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
                      <label className="space-y-1.5">
                        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                          Profile
                        </span>
                        <select
                          className={inlineFieldClassName}
                          value={songEntry.performanceTypeId ?? ""}
                          onChange={(event) =>
                            updateSongEntry(songEntry.id, {
                              performanceTypeId:
                                normalizeOptionalText(event.target.value),
                            })
                          }
                        >
                          <option value="">Use setlist default</option>
                          {performanceTypes.map((performanceType) => (
                            <option key={performanceType.id} value={performanceType.id}>
                              {performanceType.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                          Entry note override
                        </span>
                        <textarea
                          className={entryNotesClassName}
                          value={songEntry.performanceNoteOverride ?? ""}
                          onChange={(event) =>
                            updateSongEntry(songEntry.id, {
                              performanceNoteOverride: event.target.value,
                            })
                          }
                          placeholder="Optional override note for this slot"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {setlist && isEditMode ? (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={isSaving || isDeleting}
            onClick={handleDelete}
            className="cu-button cu-button-destructive"
          >
            {isDeleting ? "Deleting..." : "Delete setlist"}
          </button>
        </div>
      ) : null}

      {isEditMode ? (
        <div className="cu-song-edit-action-bar">
          <button
            type="button"
            onClick={handleCancelEdit}
            className="cu-button cu-button-neutral"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || isDeleting}
            className="cu-button cu-button-primary"
          >
            {isSaving ? "Saving..." : isExistingSetlist ? "Save" : "Create"}
          </button>
        </div>
      ) : null}

      {isSongPickerOpen ? (
        <div className="cu-setlist-picker-layer">
          <button
            type="button"
            aria-label="Close song picker"
            className="cu-setlist-picker-backdrop"
            onClick={closeSongPicker}
          />
          <section className="cu-setlist-picker-panel">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-soft)]">
                  {songPickerTargetEntryId ? "Change song" : "Add Song"}
                </p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Choose from your catalog. New songs are added to the end.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSongPicker}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-4">
              <input
                ref={songPickerInputRef}
                className="cu-setlist-search-input"
                value={songPickerQuery}
                onChange={(event) => setSongPickerQuery(event.target.value)}
                placeholder="Search songs or artists"
              />
            </div>

            <div className="mt-4 max-h-[52svh] space-y-2 overflow-auto pr-1">
              {filteredSongOptions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">
                  No songs match this search.
                </div>
              ) : null}

              {filteredSongOptions.map((songOption) => (
                <button
                  key={songOption.id}
                  type="button"
                  onClick={() => handleSongSelection(songOption.id)}
                  className="cu-setlist-picker-option"
                >
                  <div className="min-w-0">
                    <p className="truncate text-left text-base font-semibold text-[var(--text-primary)]">
                      {songOption.title}
                    </p>
                    <p className="mt-1 truncate text-left text-sm text-[var(--text-secondary)]">
                      {songOption.artist ||
                        (songOption.sourceType === "cover"
                          ? "Cover artist not set"
                          : "Original catalog entry")}
                    </p>
                  </div>
                  <span className="cu-song-source-pill shrink-0">
                    {songOption.performanceProfiles.length}{" "}
                    {songOption.performanceProfiles.length === 1
                      ? "profile"
                      : "profiles"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </form>
  );
}
