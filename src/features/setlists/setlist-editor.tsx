import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router-dom";

import type {
  PerformanceType,
  Setlist,
  SetlistDraft,
  SetlistSongEntry,
  Song,
} from "../../domain/models";
import { useScreenWakeLock } from "../../hooks/use-screen-wake-lock";
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

interface EntryDragState {
  cardHeight: number;
  cardWidth: number;
  dropIndex: number;
  entryId: string;
  offsetX: number;
  offsetY: number;
  originIndex: number;
  pointerId: number;
  pointerX: number;
  pointerY: number;
}

interface PendingEntryDragRequest {
  entryId: string;
  handleOffsetX: number;
  handleOffsetY: number;
  pointerId: number;
  pointerX: number;
  pointerY: number;
}

const dragPreviewVerticalBiasPx = 8;

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

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M12 6h.01M12 12h.01M12 18h.01"
        stroke="currentColor"
        strokeWidth="2.4"
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
  insertIndex: number,
): EditableSetlistEntry[] {
  const sourceIndex = entries.findIndex((entry) => entry.id === draggedEntryId);

  if (sourceIndex < 0) {
    return entries;
  }

  const nextEntries = [...entries];
  const [movedEntry] = nextEntries.splice(sourceIndex, 1);
  const normalizedInsertIndex = Math.max(0, Math.min(insertIndex, nextEntries.length));

  nextEntries.splice(normalizedInsertIndex, 0, movedEntry);

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
  const [dragState, setDragState] = useState<EntryDragState | null>(null);
  const [pendingDragRequest, setPendingDragRequest] =
    useState<PendingEntryDragRequest | null>(null);
  const [openEntryMenuId, setOpenEntryMenuId] = useState<string | null>(null);
  const songPickerInputRef = useRef<HTMLInputElement | null>(null);
  const songEntryCardRefs = useRef(new Map<string, HTMLElement>());
  const songEntryHandleRefs = useRef(new Map<string, HTMLElement>());
  const dragStateRef = useRef<EntryDragState | null>(null);
  const shouldKeepScreenAwake = isExistingSetlist && !isEditMode;

  useScreenWakeLock(shouldKeepScreenAwake);

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

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!pendingDragRequest) {
      return;
    }

    const activePointerId = pendingDragRequest.pointerId;
    let isCancelled = false;

    function cancelPendingDrag(event: PointerEvent) {
      if (event.pointerId !== activePointerId) {
        return;
      }

      isCancelled = true;
      setPendingDragRequest(null);
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      if (isCancelled) {
        return;
      }

      const cardElement = songEntryCardRefs.current.get(pendingDragRequest.entryId);
      const handleElement = songEntryHandleRefs.current.get(pendingDragRequest.entryId);
      const originIndex = formState.songEntries.findIndex(
        (songEntry) => songEntry.id === pendingDragRequest.entryId,
      );

      if (!cardElement || !handleElement || originIndex < 0) {
        setPendingDragRequest(null);
        return;
      }

      const collapsedCardRect = cardElement.getBoundingClientRect();
      const collapsedHandleRect = handleElement.getBoundingClientRect();
      const handleOffsetX = collapsedHandleRect.left - collapsedCardRect.left;
      const handleOffsetY = collapsedHandleRect.top - collapsedCardRect.top;
      const nextOffsetX = Math.min(
        collapsedCardRect.width,
        Math.max(0, handleOffsetX + pendingDragRequest.handleOffsetX),
      );
      const nextOffsetY = Math.min(
        collapsedCardRect.height,
        Math.max(
          0,
          handleOffsetY + pendingDragRequest.handleOffsetY + dragPreviewVerticalBiasPx,
        ),
      );

      setDragState({
        cardHeight: collapsedCardRect.height,
        cardWidth: collapsedCardRect.width,
        dropIndex: originIndex,
        entryId: pendingDragRequest.entryId,
        offsetX: nextOffsetX,
        offsetY: nextOffsetY,
        originIndex,
        pointerId: pendingDragRequest.pointerId,
        pointerX: pendingDragRequest.pointerX,
        pointerY: pendingDragRequest.pointerY,
      });
      setPendingDragRequest(null);
    });

    window.addEventListener("pointerup", cancelPendingDrag);
    window.addEventListener("pointercancel", cancelPendingDrag);

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointerup", cancelPendingDrag);
      window.removeEventListener("pointercancel", cancelPendingDrag);
    };
  }, [formState.songEntries, pendingDragRequest]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousWebkitUserSelect = document.body.style.webkitUserSelect;
    const activePointerId = dragState.pointerId;

    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    function getDropIndex(clientY: number) {
      const currentDragState = dragStateRef.current;

      if (!currentDragState) {
        return 0;
      }

      const remainingEntries = formState.songEntries.filter(
        (songEntry) => songEntry.id !== currentDragState.entryId,
      );

      if (remainingEntries.length === 0) {
        return 0;
      }

      let nextDropIndex = 0;

      for (const [index, songEntry] of remainingEntries.entries()) {
        const cardElement = songEntryCardRefs.current.get(songEntry.id);

        if (!cardElement) {
          continue;
        }

        const cardRect = cardElement.getBoundingClientRect();

        if (clientY >= cardRect.top + cardRect.height / 2) {
          nextDropIndex = index + 1;
        } else {
          break;
        }
      }

      return nextDropIndex;
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activePointerId) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      setDragState((current) =>
        current && current.pointerId === activePointerId
          ? {
              ...current,
              dropIndex: getDropIndex(event.clientY),
              pointerX: event.clientX,
              pointerY: event.clientY,
            }
          : current,
      );
    }

    function finishPointerDrag(event: PointerEvent) {
      if (event.pointerId !== activePointerId) {
        return;
      }

      const currentDragState = dragStateRef.current;

      if (!currentDragState) {
        setDragState(null);
        return;
      }

      setFormState((current) => {
        if (currentDragState.dropIndex === currentDragState.originIndex) {
          return current;
        }

        return {
          ...current,
          songEntries: reorderEntries(
            current.songEntries,
            currentDragState.entryId,
            currentDragState.dropIndex,
          ),
        };
      });
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishPointerDrag);
    window.addEventListener("pointercancel", finishPointerDrag);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.webkitUserSelect = previousWebkitUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPointerDrag);
      window.removeEventListener("pointercancel", finishPointerDrag);
    };
  }, [dragState?.pointerId, formState.songEntries]);

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

  const isReorderMode = dragState !== null || pendingDragRequest !== null;
  const draggedEntryId = dragState?.entryId ?? null;

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
    setOpenEntryMenuId(null);
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
    setOpenEntryMenuId(null);
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

  function setSongEntryCardRef(songEntryId: string, element: HTMLElement | null) {
    if (element) {
      songEntryCardRefs.current.set(songEntryId, element);
      return;
    }

    songEntryCardRefs.current.delete(songEntryId);
  }

  function setSongEntryHandleRef(songEntryId: string, element: HTMLElement | null) {
    if (element) {
      songEntryHandleRefs.current.set(songEntryId, element);
      return;
    }

    songEntryHandleRefs.current.delete(songEntryId);
  }

  function handleDragHandlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    songEntryId: string,
  ) {
    if (!event.isPrimary) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const cardElement = songEntryCardRefs.current.get(songEntryId);

    if (!cardElement) {
      return;
    }

    event.preventDefault();
    const handleRect = event.currentTarget.getBoundingClientRect();
    setOpenEntryMenuId(null);
    setPendingDragRequest({
      entryId: songEntryId,
      handleOffsetX: event.clientX - handleRect.left,
      handleOffsetY: event.clientY - handleRect.top,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
    });
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
    setDragState(null);
    setPendingDragRequest(null);
    setOpenEntryMenuId(null);
    closeSongPicker();
  }

  function getSongEntryPresentation(songEntry: EditableSetlistEntry) {
    const song = songsById.get(songEntry.songId);
    const effectivePerformanceTypeId = getEffectivePerformanceTypeId(
      normalizeOptionalText(formState.defaultPerformanceTypeId),
      songEntry,
    );
    const matchingProfile = song?.performanceProfiles.find(
      (profile) => profile.performanceTypeId === effectivePerformanceTypeId,
    );

    return {
      effectivePerformanceTypeId,
      matchingProfile,
      song,
    };
  }

  function renderDropPlaceholder(displayIndex: number) {
    if (!dragState) {
      return null;
    }

    return (
      <article
        aria-hidden="true"
        className="rounded-[26px] border border-dashed border-[color-mix(in_srgb,var(--brand)_46%,var(--border-strong))] bg-[color-mix(in_srgb,var(--surface)_88%,var(--color-primary)_12%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-all duration-200 sm:p-5"
        style={{ height: dragState.cardHeight }}
      >
        <div className="flex h-full gap-4">
          <div className="shrink-0">
            <span className="cu-setlist-slot-badge opacity-45">{displayIndex}</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
            <div className="flex items-center gap-2">
              <span className="h-4 min-w-0 flex-1 rounded-full bg-[color-mix(in_srgb,var(--border)_78%,transparent)]" />
              <span className="h-7 w-24 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--border)_72%,transparent)]" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="h-3 w-32 rounded-full bg-[color-mix(in_srgb,var(--border)_62%,transparent)]" />
              <span
                aria-hidden="true"
                className="cu-setlist-drag-handle pointer-events-none opacity-45"
              >
                <GripIcon />
              </span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  function renderEditableSongEntryCard(
    songEntry: EditableSetlistEntry,
    displayIndex: number,
    options?: {
      isPreview?: boolean;
    },
  ) {
    const isPreview = options?.isPreview ?? false;
    const { effectivePerformanceTypeId, matchingProfile, song } =
      getSongEntryPresentation(songEntry);
    const isCompactDragMode = isReorderMode || isPreview;
    const shouldDisableCollapseTransitions = pendingDragRequest !== null;

    return (
      <article
        ref={
          isPreview
            ? undefined
            : (element) => setSongEntryCardRef(songEntry.id, element)
        }
        className={[
          "rounded-[26px] border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-all duration-200 sm:p-5",
          isPreview
            ? "border-[color-mix(in_srgb,var(--brand)_42%,var(--border-strong))] bg-[color-mix(in_srgb,var(--surface-elevated)_96%,transparent)] shadow-[0_20px_42px_rgba(5,8,14,0.26)]"
            : "",
        ].join(" ")}
      >
        <div className="flex gap-4">
          <div className="shrink-0">
            <span className="cu-setlist-slot-badge">{displayIndex}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-start gap-2">
                <Link
                  to={song ? `/songs/${song.id}` : "#"}
                  state={songLinkState}
                  className="min-w-0 flex-1 text-xl font-semibold tracking-tight text-[var(--text-primary)] hover:underline"
                >
                  <span className="block break-words leading-tight">
                    {song?.title ?? "Unknown song"}
                  </span>
                </Link>
                {matchingProfile ? (
                  <PerformanceProfileChip
                    profile={matchingProfile}
                    performanceTypes={performanceTypes}
                  />
                ) : (
                  <span className="cu-setlist-meta-pill shrink-0">
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

              {isCompactDragMode ? (
                <div className="mt-3 flex items-center justify-end">
                  <span
                    ref={
                      isPreview
                        ? undefined
                        : (element) => setSongEntryHandleRef(songEntry.id, element)
                    }
                    aria-hidden="true"
                    className="cu-setlist-drag-handle pointer-events-none opacity-75"
                  >
                    <GripIcon />
                  </span>
                </div>
              ) : null}
            </div>

            <div
              className={[
                "overflow-hidden",
                shouldDisableCollapseTransitions
                  ? ""
                  : "transition-[margin,max-height,opacity] duration-200 ease-out",
                isCompactDragMode
                  ? "mt-0 max-h-0 opacity-0 pointer-events-none"
                  : "mt-4 max-h-24 opacity-100",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openSongPicker(songEntry.id)}
                  className="cu-button cu-button-neutral cu-button-small min-h-10 flex-1 justify-center sm:flex-none"
                >
                  Change song
                </button>

                <div className="relative ml-auto">
                  <button
                    type="button"
                    aria-label={`More actions for slot ${displayIndex}`}
                    aria-haspopup="menu"
                    aria-expanded={openEntryMenuId === songEntry.id}
                    onClick={() =>
                      setOpenEntryMenuId((current) =>
                        current === songEntry.id ? null : songEntry.id,
                      )
                    }
                    className="cu-setlist-icon-button"
                  >
                    <MoreIcon />
                  </button>

                  {openEntryMenuId === songEntry.id ? (
                    <>
                      <button
                        type="button"
                        aria-label="Close entry actions"
                        className="fixed inset-0 z-10 border-0 bg-transparent"
                        onClick={() => setOpenEntryMenuId(null)}
                      />
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-20 mt-2 min-w-40 rounded-[1.15rem] border border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--surface-elevated)_96%,transparent)] p-2 shadow-[0_18px_40px_rgba(5,8,14,0.2)] backdrop-blur-xl"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => removeSongEntry(songEntry.id)}
                          className="flex w-full items-center justify-between rounded-[0.95rem] px-3 py-2.5 text-left text-sm font-medium text-[var(--color-destructive-bg)] transition hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)]"
                        >
                          Remove song
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>

                <button
                  type="button"
                  ref={
                    isCompactDragMode
                      ? undefined
                      : (element) => setSongEntryHandleRef(songEntry.id, element)
                  }
                  aria-label={`Reorder slot ${displayIndex}`}
                  onPointerDown={(event) =>
                    handleDragHandlePointerDown(event, songEntry.id)
                  }
                  className="cu-setlist-drag-handle shrink-0"
                >
                  <GripIcon />
                </button>
              </div>
            </div>

            <div
              className={[
                "overflow-hidden",
                shouldDisableCollapseTransitions
                  ? ""
                  : "transition-[margin,max-height,opacity] duration-200 ease-out",
                isCompactDragMode
                  ? "mt-0 max-h-0 opacity-0 pointer-events-none"
                  : "mt-4 max-h-[28rem] opacity-100",
              ].join(" ")}
            >
              <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
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
        </div>
      </article>
    );
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
            const { effectivePerformanceTypeId, matchingProfile, song } =
              getSongEntryPresentation(songEntry);
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

            return null;
          })}

          {isEditMode
            ? (() => {
                const remainingEntries = draggedEntryId
                  ? formState.songEntries.filter(
                      (songEntry) => songEntry.id !== draggedEntryId,
                    )
                  : formState.songEntries;
                const renderedCards: ReactNode[] = [];

                remainingEntries.forEach((songEntry, remainingIndex) => {
                  const displayIndex =
                    remainingIndex +
                    1 +
                    (dragState && dragState.dropIndex <= remainingIndex ? 1 : 0);

                  if (dragState && dragState.dropIndex === remainingIndex) {
                    renderedCards.push(
                      <div key={`drop-${dragState.entryId}-${remainingIndex}`}>
                        {renderDropPlaceholder(remainingIndex + 1)}
                      </div>,
                    );
                  }

                  renderedCards.push(
                    <div key={songEntry.id}>
                      {renderEditableSongEntryCard(songEntry, displayIndex)}
                    </div>,
                  );
                });

                if (dragState && dragState.dropIndex === remainingEntries.length) {
                  renderedCards.push(
                    <div key={`drop-${dragState.entryId}-end`}>
                      {renderDropPlaceholder(remainingEntries.length + 1)}
                    </div>,
                  );
                }

                return renderedCards;
              })()
            : null}
        </div>
      </section>

      {dragState
        ? (() => {
            const draggedSongEntry = formState.songEntries.find(
              (songEntry) => songEntry.id === dragState.entryId,
            );

            if (!draggedSongEntry) {
              return null;
            }

            const viewportWidth =
              typeof window === "undefined" ? dragState.cardWidth : window.innerWidth;
            const previewLeft = Math.min(
              Math.max(12, dragState.pointerX - dragState.offsetX),
              Math.max(12, viewportWidth - dragState.cardWidth - 12),
            );

            return (
              <div
                className="pointer-events-none fixed z-40"
                style={{
                  left: previewLeft,
                  top: dragState.pointerY - dragState.offsetY,
                  width: dragState.cardWidth,
                }}
              >
                {renderEditableSongEntryCard(
                  draggedSongEntry,
                  dragState.dropIndex + 1,
                  { isPreview: true },
                )}
              </div>
            );
          })()
        : null}

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
