import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { useRepositories } from "../../app/repository-context";
import type {
  PerformanceType,
  Setlist,
  SetlistDraft,
  Song,
} from "../../domain/models";
import { SetlistEditor } from "./setlist-editor";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function SetlistEditorPage() {
  const repositories = useRepositories();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isCreating = location.pathname.endsWith("/new");

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [performanceTypes, setPerformanceTypes] = useState<PerformanceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listPath = useMemo(() => `/setlists${location.search}`, [location.search]);
  const detailPath = useMemo(() => `${location.pathname}${location.search}`, [
    location.pathname,
    location.search,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadEditorData() {
      setIsLoading(true);

      try {
        const [loadedSetlist, loadedSongs, loadedPerformanceTypes] =
          await Promise.all([
            isCreating || !id
              ? Promise.resolve(undefined)
              : repositories.setlists.getById(id),
            repositories.songs.list(),
            repositories.performanceTypes.list(),
          ]);

        if (cancelled) {
          return;
        }

        if (!isCreating && id && !loadedSetlist) {
          setError("That setlist could not be found.");
          setSetlist(null);
          return;
        }

        setSetlist(loadedSetlist ?? null);
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

    void loadEditorData();

    return () => {
      cancelled = true;
    };
  }, [
    isCreating,
    repositories.performanceTypes,
    repositories.setlists,
    repositories.songs,
    id,
  ]);

  async function handleSave(nextSetlist: Setlist | SetlistDraft) {
    const savedSetlist =
      "id" in nextSetlist
        ? await repositories.setlists.update(nextSetlist)
        : await repositories.setlists.create(nextSetlist);

    setSetlist(savedSetlist);
    navigate(`/setlists/${savedSetlist.id}${location.search}`, { replace: true });
  }

  async function handleDelete(nextSetlist: Setlist) {
    await repositories.setlists.delete(nextSetlist.id);
    navigate(listPath, { replace: true });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Link
          to={listPath}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <span aria-hidden="true">←</span>
          Setlists
        </Link>
        <div className="rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          Loading setlist...
        </div>
      </div>
    );
  }

  if (error || (!isCreating && !setlist)) {
    return (
      <div className="space-y-4">
        <Link
          to={listPath}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <span aria-hidden="true">←</span>
          Setlists
        </Link>
        <div className="rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]">
          {error ?? "This setlist could not be loaded."}
        </div>
      </div>
    );
  }

  return (
    <SetlistEditor
      setlist={setlist ?? undefined}
      songs={songs}
      performanceTypes={performanceTypes}
      backTo={listPath}
      detailPath={isCreating ? undefined : detailPath}
      onSave={handleSave}
      onDelete={handleDelete}
      onCancel={() => navigate(listPath)}
    />
  );
}
