import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { useRepositories } from "../../app/repository-context";
import { PageShell } from "../../components/page-shell";
import type { PerformanceType, Song, SongDraft } from "../../domain/models";
import {
  addObservabilityBreadcrumb,
  captureObservabilityError,
} from "../../lib/observability";
import { SongEditor } from "./song-editor";

interface SongNavigationState {
  backTo?: string;
  backLabel?: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function SongEditorPage() {
  const repositories = useRepositories();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isCreating = location.pathname.endsWith("/new");

  const [song, setSong] = useState<Song | null>(null);
  const [performanceTypes, setPerformanceTypes] = useState<PerformanceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigationState = (location.state as SongNavigationState | null) ?? null;
  const listPath = useMemo(() => `/songs${location.search}`, [location.search]);
  const backTo = navigationState?.backTo ?? listPath;
  const backLabel = navigationState?.backLabel ?? "Songs";

  useEffect(() => {
    let cancelled = false;

    async function loadEditorData() {
      setIsLoading(true);

      try {
        const [loadedSong, loadedPerformanceTypes] = await Promise.all([
          isCreating || !id ? Promise.resolve(undefined) : repositories.songs.getById(id),
          repositories.performanceTypes.list(),
        ]);

        if (cancelled) {
          return;
        }

        if (!isCreating && id && !loadedSong) {
          setError("That song could not be found.");
          setSong(null);
          return;
        }

        setSong(loadedSong ?? null);
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

    void loadEditorData();

    return () => {
      cancelled = true;
    };
  }, [id, isCreating, repositories.performanceTypes, repositories.songs]);

  async function handleSave(nextSong: Song | SongDraft) {
    const isUpdating = "id" in nextSong;
    const operation = isUpdating ? "song.update" : "song.create";

    addObservabilityBreadcrumb({
      category: "song",
      message: isUpdating ? "Song update started" : "Song save started",
      data: {
        operation,
        route: location.pathname,
        songId: "id" in nextSong ? nextSong.id : undefined,
      },
    });

    try {
      const savedSong = isUpdating
        ? await repositories.songs.update(nextSong)
        : await repositories.songs.create(nextSong);

      addObservabilityBreadcrumb({
        category: "song",
        message: isUpdating ? "Song update completed" : "Song save completed",
        data: {
          operation,
          route: location.pathname,
          songId: savedSong.id,
          performanceProfileCount: savedSong.performanceProfiles.length,
        },
      });

      setSong(savedSong);
      navigate(`/songs/${savedSong.id}${location.search}`, {
        replace: true,
        state: navigationState ?? undefined,
      });
    } catch (error) {
      captureObservabilityError(error, {
        operation,
        route: location.pathname,
        context: {
          route: location.pathname,
          songId: "id" in nextSong ? nextSong.id : undefined,
          performanceProfileCount: nextSong.performanceProfiles.length,
          sourceType: nextSong.sourceType,
        },
      });
      throw error;
    }
  }

  async function handleDelete(nextSong: Song) {
    await repositories.songs.delete(nextSong.id);
    navigate(backTo, { replace: true });
  }

  if (isLoading) {
    return (
      <PageShell mode="editor">
        <div className="space-y-4">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <span aria-hidden="true">←</span>
          {backLabel}
        </Link>
        <div className="rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          Loading song...
        </div>
        </div>
      </PageShell>
    );
  }

  if (error || (!isCreating && !song)) {
    return (
      <PageShell mode="editor">
        <div className="space-y-4">
        <Link
          to={backTo}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <span aria-hidden="true">←</span>
          {backLabel}
        </Link>
        <div className="rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          {error ?? "This song could not be loaded."}
        </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell mode="editor">
      <SongEditor
        song={song ?? undefined}
        performanceTypes={performanceTypes}
        backTo={backTo}
        backLabel={backLabel}
        onSave={handleSave}
        onDelete={handleDelete}
        onCancel={() => navigate(backTo)}
      />
    </PageShell>
  );
}
