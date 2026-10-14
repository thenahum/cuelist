import type { Ref } from "react";
import { Link } from "react-router-dom";
import type { PerformanceType, SetlistSongEntry, Song } from "../../domain/models";
import { PerformanceProfileChip } from "../songs/performance-profile-chip";
import { getEffectivePerformanceTypeId, getPerformanceTypeName, normalizeOptionalText } from "./setlist-ui";

interface SetlistEntryCardProps {
  entry: SetlistSongEntry;
  displayIndex: number;
  song?: Song;
  performanceTypes: PerformanceType[];
  defaultPerformanceTypeId?: string;
  expanded: boolean;
  dragDisabled: boolean;
  actionsDisabled: boolean;
  isPreview?: boolean;
  handleRef?: Ref<HTMLButtonElement>;
  songLinkState?: { backTo: string; backLabel: string };
  onToggleExpanded(): void;
  onChangeSong(): void;
  onRemove(): void;
  onUpdate(patch: Partial<SetlistSongEntry>): void;
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function SetlistEntryCard({
  entry, displayIndex, song, performanceTypes, defaultPerformanceTypeId,
  expanded, dragDisabled, actionsDisabled, isPreview = false, handleRef,
  songLinkState, onToggleExpanded, onChangeSong, onRemove, onUpdate,
}: SetlistEntryCardProps) {
  const title = song?.title ?? "Unknown song";
  const effectiveType = getEffectivePerformanceTypeId(defaultPerformanceTypeId, entry);
  const profile = song?.performanceProfiles.find((item) => item.performanceTypeId === effectiveType);
  const detailsId = `entry-details-${entry.id}`;

  return (
    <article className={`cu-setlist-entry-card${isPreview ? " cu-setlist-entry-preview" : ""}`}>
      <div className="flex gap-3 sm:gap-4">
        <span className="cu-setlist-slot-badge shrink-0">{displayIndex}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            {isPreview ? (
              <span className="min-w-0 flex-1 break-words text-xl font-semibold leading-tight tracking-tight">{title}</span>
            ) : (
              <Link to={song ? `/songs/${song.id}` : "#"} state={songLinkState}
                tabIndex={actionsDisabled ? -1 : undefined}
                onClick={(event) => { if (actionsDisabled) event.preventDefault(); }}
                className="min-w-0 flex-1 break-words text-xl font-semibold leading-tight tracking-tight hover:underline">
                {title}
              </Link>
            )}
            {profile ? (
              <PerformanceProfileChip profile={profile} performanceTypes={performanceTypes} />
            ) : (
              <span className="cu-setlist-meta-pill shrink-0">{getPerformanceTypeName(effectiveType, performanceTypes)}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {song?.artist || (song?.sourceType === "cover" ? "Cover artist not set" : "Original catalog entry")}
          </p>
          <div className="mt-2 flex items-center justify-end gap-2">
            {isPreview ? (
              <>
                <span className="cu-button cu-button-neutral cu-button-small min-h-11">Edit</span>
                <span className="cu-setlist-drag-handle"><GripIcon /></span>
              </>
            ) : (
              <>
                <button type="button" className="cu-button cu-button-neutral cu-button-small min-h-11"
                  aria-label={`${expanded ? "Done editing" : "Edit"} slot ${displayIndex}`}
                  aria-expanded={expanded} aria-controls={expanded ? detailsId : undefined}
                  disabled={actionsDisabled} onClick={onToggleExpanded}>
                  {expanded ? "Done" : "Edit"}
                </button>
                <button type="button" ref={handleRef} className="cu-setlist-drag-handle"
                  aria-label={`Reorder ${title}, slot ${displayIndex}`}
                  title={dragDisabled ? "Close song details to reorder" : "Drag to reorder"}
                  disabled={dragDisabled}>
                  <GripIcon />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {expanded && !isPreview ? (
        <div id={detailsId} className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className="cu-button cu-button-neutral cu-button-small"
              disabled={actionsDisabled} onClick={onChangeSong}>Change song</button>
            <button type="button" className="cu-button cu-button-destructive cu-button-small"
              disabled={actionsDisabled} onClick={onRemove}>Remove song</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            <label className="space-y-1.5">
              <span className="text-sm text-[var(--text-secondary)]">Profile</span>
              <select className="cu-setlist-entry-field" value={entry.performanceTypeId ?? ""}
                disabled={actionsDisabled}
                onChange={(event) => onUpdate({ performanceTypeId: normalizeOptionalText(event.target.value) })}>
                <option value="">Use setlist default</option>
                {performanceTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm text-[var(--text-secondary)]">Entry note override</span>
              <textarea className="cu-setlist-entry-field min-h-24 resize-y"
                value={entry.performanceNoteOverride ?? ""} disabled={actionsDisabled}
                onChange={(event) => onUpdate({ performanceNoteOverride: event.target.value })}
                placeholder="Optional override note for this slot" />
            </label>
          </div>
        </div>
      ) : null}
    </article>
  );
}
