import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import type {
  ComfortLevel,
  PerformanceType,
  Song,
  SongDraft,
  SongPerformanceProfile,
  SourceType,
} from "../../domain/models";
import { createId } from "../../shared/id";
import { PerformanceProfileChip } from "./performance-profile-chip";
import {
  getSongSheetContent,
  SongSheetRenderer,
  type SongSheetScale,
} from "./song-sheet-renderer";
import {
  comfortLevelOptions,
  createEmptySongDraft,
  formatComfortLevel,
  formatSourceType,
  formatTagInput,
  normalizeOptionalText,
  parseTagInput,
  sanitizeProfiles,
  sourceTypeOptions,
} from "./song-ui";

interface SongEditorProps {
  song?: Song;
  performanceTypes: PerformanceType[];
  backTo: string;
  backLabel?: string;
  onSave(song: Song | SongDraft): Promise<void>;
  onDelete(song: Song): Promise<void>;
  onCancel(): void;
}

interface EditableProfile extends SongPerformanceProfile {
  rowId: string;
  performanceNotes: string;
}

interface SongFormState {
  title: string;
  artist: string;
  sourceType: SourceType;
  songSheet: string;
  personalNotes: string;
  externalTabsUrl: string;
  tags: string;
  performanceProfiles: EditableProfile[];
}

const fieldClassName =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[0.95rem] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[color-mix(in_srgb,var(--brand)_48%,var(--border))] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]";

const metadataTextareaClassName = `${fieldClassName} min-h-28 resize-y`;
const inlineTitleFieldClassName =
  "w-full border-0 border-b border-[var(--border-strong)] bg-transparent px-0 pb-3 pt-1 text-3xl font-semibold tracking-tight text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[color-mix(in_srgb,var(--brand)_52%,var(--border-strong))] sm:text-4xl";
const inlineMetaFieldClassName =
  "w-full border-0 border-b border-[var(--border)] bg-transparent px-0 pb-2 pt-1 text-base text-[var(--text-secondary)] outline-none transition placeholder:text-[var(--text-soft)] focus:border-[color-mix(in_srgb,var(--brand)_52%,var(--border-strong))]";

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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M5 7h14M5 17h14M9 7a2 2 0 1 0 0 .01M15 17a2 2 0 1 0 0 .01M15 7a2 2 0 1 0 0 .01M9 17a2 2 0 1 0 0 .01"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function createFormState(song?: Song): SongFormState {
  if (!song) {
    const draft = createEmptySongDraft();

    return {
      title: draft.title,
      artist: draft.artist ?? "",
      sourceType: draft.sourceType,
      songSheet: getSongSheetContent(draft) ?? "",
      personalNotes: draft.personalNotes ?? "",
      externalTabsUrl: draft.externalTabsUrl ?? "",
      tags: formatTagInput(draft.tags),
      performanceProfiles: [],
    };
  }

  return {
    title: song.title,
    artist: song.artist ?? "",
    sourceType: song.sourceType,
    songSheet: getSongSheetContent(song) ?? "",
    personalNotes: song.personalNotes ?? "",
    externalTabsUrl: song.externalTabsUrl ?? "",
    tags: formatTagInput(song.tags),
    performanceProfiles: song.performanceProfiles.map((profile) => ({
      rowId: createId("profile"),
      performanceTypeId: profile.performanceTypeId,
      comfortLevel: profile.comfortLevel,
      performanceNotes: profile.performanceNotes ?? "",
    })),
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function SongEditor({
  song,
  performanceTypes,
  backTo,
  backLabel = "Songs",
  onSave,
  onDelete,
  onCancel,
}: SongEditorProps) {
  const isExistingSong = Boolean(song);
  const [formState, setFormState] = useState(() => createFormState(song));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(!song);
  const [showChords, setShowChords] = useState(true);
  const [songSheetScale, setSongSheetScale] = useState<SongSheetScale>("standard");
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const songSheetEditorRef = useRef<HTMLTextAreaElement | null>(null);

  const scaleSteps: SongSheetScale[] = ["standard", "large", "xlarge"];
  const currentScaleIndex = scaleSteps.indexOf(songSheetScale);

  useEffect(() => {
    setFormState(createFormState(song));
    setIsEditMode(!song);
  }, [song]);

  useEffect(() => {
    if (isEditMode) {
      window.requestAnimationFrame(() => {
        songSheetEditorRef.current?.focus();
      });
    }
  }, [isEditMode]);

  function updateField<Key extends keyof SongFormState>(
    key: Key,
    value: SongFormState[Key],
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateProfile(
    rowId: string,
    key: keyof EditableProfile,
    value: string | ComfortLevel,
  ) {
    setFormState((current) => ({
      ...current,
      performanceProfiles: current.performanceProfiles.map((profile) =>
        profile.rowId === rowId ? { ...profile, [key]: value } : profile,
      ),
    }));
  }

  function addProfile() {
    setFormState((current) => ({
      ...current,
      performanceProfiles: [
        ...current.performanceProfiles,
        {
          rowId: createId("profile"),
          performanceTypeId: "",
          comfortLevel: "maybe",
          performanceNotes: "",
        },
      ],
    }));
    setIsMetadataOpen(true);
  }

  function removeProfile(rowId: string) {
    setFormState((current) => ({
      ...current,
      performanceProfiles: current.performanceProfiles.filter(
        (profile) => profile.rowId !== rowId,
      ),
    }));
  }

  function validateForm(): string | null {
    if (!formState.title.trim()) {
      return "Song title is required.";
    }

    const selectedPerformanceTypeIds = formState.performanceProfiles
      .map((profile) => profile.performanceTypeId)
      .filter(Boolean);

    if (selectedPerformanceTypeIds.length !== formState.performanceProfiles.length) {
      return "Each performance profile needs a performance type.";
    }

    if (new Set(selectedPerformanceTypeIds).size !== selectedPerformanceTypeIds.length) {
      return "A song can only have one profile per performance type.";
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

    const normalizedSongSheet = normalizeOptionalText(formState.songSheet);

    const draft: SongDraft = {
      title: formState.title.trim(),
      artist: normalizeOptionalText(formState.artist),
      sourceType: formState.sourceType,
      songSheet: normalizedSongSheet,
      personalNotes: normalizeOptionalText(formState.personalNotes),
      externalTabsUrl: normalizeOptionalText(formState.externalTabsUrl),
      tags: parseTagInput(formState.tags),
      performanceProfiles: sanitizeProfiles(formState.performanceProfiles),
    };

    try {
      if (song) {
        await onSave({
          ...song,
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
    if (!song) {
      return;
    }

    const confirmed = window.confirm(`Delete "${song.title}" from your catalog?`);

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await onDelete(song);
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCancelEdit() {
    if (!song) {
      onCancel();
      return;
    }

    setFormState(createFormState(song));
    setError(null);
    setIsEditMode(false);
  }

  return (
    <form className="space-y-4 pb-10" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backTo}
          className="cu-button cu-button-neutral"
        >
          <span aria-hidden="true">←</span>
          {backLabel}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {!isEditMode ? (
            <>
              <div className="cu-mini-segmented" role="group" aria-label="Chord display">
                <button
                  type="button"
                  onClick={() => setShowChords(false)}
                  className={showChords ? "cu-mini-segment" : "cu-mini-segment cu-mini-segment-active"}
                >
                  Lyrics
                </button>
                <button
                  type="button"
                  onClick={() => setShowChords(true)}
                  className={showChords ? "cu-mini-segment cu-mini-segment-active" : "cu-mini-segment"}
                >
                  Chords
                </button>
              </div>

              <div className="cu-mini-segmented" role="group" aria-label="Song sheet text size">
                <button
                  type="button"
                  aria-label="Decrease text size"
                  disabled={currentScaleIndex === 0}
                  onClick={() => setSongSheetScale(scaleSteps[Math.max(currentScaleIndex - 1, 0)])}
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
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setIsMetadataOpen((current) => !current)}
            aria-label="Open song settings"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] ${isMetadataOpen ? "border-[color-mix(in_srgb,var(--brand)_48%,var(--border))] text-[var(--text-primary)]" : ""}`}
          >
            <SettingsIcon />
          </button>

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
          <div className="space-y-3">
            <div className="space-y-3">
              <input
                className={inlineTitleFieldClassName}
                value={formState.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="Untitled song"
              />
              <input
                className={inlineMetaFieldClassName}
                value={formState.artist}
                onChange={(event) => updateField("artist", event.target.value)}
                placeholder="Artist"
              />
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {formState.title || "Untitled song"}
            </h1>
            {formState.artist ? (
              <p className="mt-2 text-base text-[var(--text-secondary)]">
                {formState.artist}
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="cu-song-source-pill">
            {formatSourceType(formState.sourceType)}
          </span>
          {formState.performanceProfiles.map((profile) => (
            <PerformanceProfileChip
              key={profile.rowId}
              profile={profile}
              performanceTypes={performanceTypes}
            />
          ))}
        </div>
      </section>

      <section className="cu-song-workspace-panel">
        {!isEditMode && formState.externalTabsUrl ? (
          <div className="mb-4 border-b border-[var(--border)] pb-4">
            <a
              href={formState.externalTabsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cu-external-tabs-button"
            >
              Open Tabs ↗
            </a>
          </div>
        ) : null}
        {isEditMode ? (
          <textarea
            ref={songSheetEditorRef}
            className="cu-song-text-editor"
            value={formState.songSheet}
            onChange={(event) => updateField("songSheet", event.target.value)}
            placeholder={`[Dm]Static in the rafters
heartbeat in the [G]kick drum`}
          />
        ) : (
          <SongSheetRenderer
            content={formState.songSheet}
            showChords={showChords}
            presentation="standard"
            scale={songSheetScale}
          />
        )}
      </section>

      <section className="cu-song-workspace-panel">
        <button
          type="button"
          onClick={() => setIsNotesOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--brand-soft)]">
            Notes
          </span>
          <ChevronIcon open={isNotesOpen} />
        </button>

        {isNotesOpen ? (
          <div className="mt-4">
            {isEditMode ? (
              <textarea
                className={metadataTextareaClassName}
                value={formState.personalNotes}
                onChange={(event) =>
                  updateField("personalNotes", event.target.value)
                }
                placeholder="Arrangement notes, reminders, capo positions..."
              />
            ) : formState.personalNotes ? (
              <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
                {formState.personalNotes}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No notes yet.</p>
            )}
          </div>
        ) : null}
      </section>

      {isMetadataOpen ? (
        <div className="cu-song-metadata-layer">
          <button
            type="button"
            aria-label="Close song settings"
            className="cu-song-metadata-backdrop"
            onClick={() => setIsMetadataOpen(false)}
          />
          <section className="cu-song-metadata-panel">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-soft)]">
                  Song Settings
                </p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Secondary details and performance setup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMetadataOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                <ChevronIcon open />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                    Tags
                  </p>
                  {isEditMode ? (
                    <input
                      className={fieldClassName}
                      value={formState.tags}
                      onChange={(event) => updateField("tags", event.target.value)}
                      placeholder="opener, band, practice"
                    />
                  ) : formState.tags ? (
                    <div className="flex flex-wrap gap-2">
                      {parseTagInput(formState.tags)?.map((tag) => (
                        <span key={tag} className="cu-song-metadata-pill">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)]">No tags yet.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                    Source
                  </p>
                  {isEditMode ? (
                    <div className="cu-source-segmented" role="group" aria-label="Source type">
                      {sourceTypeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => updateField("sourceType", option)}
                          className={
                            formState.sourceType === option
                              ? "cu-source-option cu-source-option-active"
                              : "cu-source-option"
                          }
                        >
                          {formatSourceType(option)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="cu-song-metadata-pill">
                      {formatSourceType(formState.sourceType)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                  External tabs link
                </p>
                {isEditMode ? (
                  <input
                    className={fieldClassName}
                    value={formState.externalTabsUrl}
                    onChange={(event) =>
                      updateField("externalTabsUrl", event.target.value)
                    }
                    placeholder="Optional URL"
                  />
                ) : formState.externalTabsUrl ? (
                  <a
                    href={formState.externalTabsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cu-external-tabs-button"
                  >
                    Open Tabs ↗
                  </a>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">None saved.</p>
                )}
              </div>

              <div className="border-t border-[var(--border)] pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                      Performance profiles
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Performance-specific comfort and notes.
                    </p>
                  </div>
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={addProfile}
                      className="cu-song-add-profile-button"
                    >
                      Add Profile
                    </button>
                  ) : null}
                </div>

                {formState.performanceProfiles.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">
                    No performance profiles yet.
                  </div>
                ) : null}

                <div className="mt-4 space-y-4">
                  {formState.performanceProfiles.map((profile, index) => (
                    <div
                      key={profile.rowId}
                      className="border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0"
                    >
                      {isEditMode ? (
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              Profile {index + 1}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeProfile(profile.rowId)}
                              className="cu-button cu-button-destructive cu-button-small"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                Type
                              </p>
                              <select
                                className={fieldClassName}
                                value={profile.performanceTypeId}
                                onChange={(event) =>
                                  updateProfile(
                                    profile.rowId,
                                    "performanceTypeId",
                                    event.target.value,
                                  )
                                }
                              >
                                <option value="">Select performance type</option>
                                {performanceTypes.map((type) => {
                                  const usedByOtherProfile = formState.performanceProfiles.some(
                                    (candidate) =>
                                      candidate.rowId !== profile.rowId &&
                                      candidate.performanceTypeId === type.id,
                                  );

                                  return (
                                    <option
                                      key={type.id}
                                      value={type.id}
                                      disabled={usedByOtherProfile}
                                    >
                                      {type.name}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                                Comfort
                              </p>
                              <select
                                className={fieldClassName}
                                value={profile.comfortLevel}
                                onChange={(event) =>
                                  updateProfile(
                                    profile.rowId,
                                    "comfortLevel",
                                    event.target.value as ComfortLevel,
                                  )
                                }
                              >
                                {comfortLevelOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {formatComfortLevel(option)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                              Notes
                            </p>
                            <textarea
                              className={metadataTextareaClassName}
                              value={profile.performanceNotes}
                              onChange={(event) =>
                                updateProfile(
                                  profile.rowId,
                                  "performanceNotes",
                                  event.target.value,
                                )
                              }
                              placeholder="Capo, arrangement notes, intros, endings..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <PerformanceProfileChip
                            profile={profile}
                            performanceTypes={performanceTypes}
                          />
                          <p className="text-sm leading-6 text-[var(--text-secondary)]">
                            {profile.performanceNotes || "No performance notes."}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {song ? (
                <div className="border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    disabled={isSaving || isDeleting}
                    onClick={handleDelete}
                    className="cu-button cu-button-destructive"
                  >
                    {isDeleting ? "Deleting..." : "Delete song"}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
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
            {isSaving ? "Saving..." : isExistingSong ? "Save" : "Create"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
