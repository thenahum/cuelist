import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "../../app/auth-context";
import { useRepositories } from "../../app/repository-context";
import { useSyncService } from "../../app/sync-context";
import { PageContentStack } from "../../components/page-content-stack";
import { PageShell } from "../../components/page-shell";
import { StatusCard } from "../../components/status-card";

interface AccountStats {
  songs: number;
  performanceTypes: number;
  setlists: number;
}

export function AccountPage() {
  const repositories = useRepositories();
  const syncService = useSyncService();
  const {
    configurationMessage,
    isConfigured,
    isLoading: isSessionLoading,
    signInWithMagicLink,
    signOut,
    user,
  } = useAuth();
  const [stats, setStats] = useState<AccountStats>({
    songs: 0,
    performanceTypes: 0,
    setlists: 0,
  });
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  async function loadStats() {
    const [songs, performanceTypes, setlists] = await Promise.all([
      repositories.songs.count(),
      repositories.performanceTypes.count(),
      repositories.setlists.count(),
    ]);

    setStats({
      songs,
      performanceTypes,
      setlists,
    });
  }

  useEffect(() => {
    let cancelled = false;

    void loadStats().catch((loadError) => {
      if (!cancelled) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load stats.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repositories]);

  useEffect(() => {
    let cancelled = false;

    async function loadLastSync() {
      if (!user) {
        setLastSyncedAt(null);
        return;
      }

      const nextLastSyncAt = await syncService.getLastSyncAt(user.id);

      if (!cancelled) {
        setLastSyncedAt(nextLastSyncAt ?? null);
      }
    }

    void loadLastSync().catch((loadError) => {
      if (!cancelled) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load sync status.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [syncService, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Enter an email address to receive a magic link.");
      return;
    }

    setError(null);
    setFeedback(null);
    setIsSubmitting(true);

    try {
      await signInWithMagicLink(normalizedEmail);
      setFeedback(`Magic link sent to ${normalizedEmail}.`);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to send magic link.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setError(null);
    setFeedback(null);
    setIsSubmitting(true);

    try {
      await signOut();
      setFeedback("Signed out.");
    } catch (signOutError) {
      setError(
        signOutError instanceof Error ? signOutError.message : "Unable to sign out.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePushLocalToCloud() {
    if (!user) {
      return;
    }

    setError(null);
    setFeedback(null);
    setIsSyncing(true);

    try {
      await syncService.pushLocalToCloud(user.id);
      const nextLastSyncAt = await syncService.getLastSyncAt(user.id);
      setLastSyncedAt(nextLastSyncAt ?? null);
      setFeedback("Local data pushed to Supabase.");
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : "Unable to push local data.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function handlePullCloudToLocal() {
    if (!user) {
      return;
    }

    setError(null);
    setFeedback(null);
    setIsSyncing(true);

    try {
      await syncService.pullCloudToLocal(user.id);
      await loadStats();
      const nextLastSyncAt = await syncService.getLastSyncAt(user.id);
      setLastSyncedAt(nextLastSyncAt ?? null);
      setFeedback("Cloud data pulled into local IndexedDB.");
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : "Unable to pull cloud data.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleConfirmDeleteLocalData() {
    setError(null);
    setFeedback(null);
    setIsResetting(true);

    try {
      await syncService.clearLocalData();
      await loadStats();
      setLastSyncedAt(null);
      setIsResetModalOpen(false);
      setFeedback("All local data was deleted from this device.");
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to delete local data.",
      );
    } finally {
      setIsResetting(false);
    }
  }

  const sessionLabel = isSessionLoading
    ? "Checking session"
    : user
      ? "Signed in"
      : "Signed out";
  const syncStatus = user ? "Cloud sync enabled" : "Local only";

  return (
    <PageShell>
      <PageContentStack density="compact">
        <section className="cu-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                Session
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Supabase auth is optional for now. The app remains fully local-first
                until sync is introduced.
              </p>
            </div>
            <span className="cu-setlist-meta-pill">{sessionLabel}</span>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
                Account email
              </dt>
              <dd className="mt-2 text-sm text-[var(--text-secondary)]">
                {user?.email ?? "No account connected yet"}
              </dd>
            </div>
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
                Sync status
              </dt>
              <dd className="mt-2 text-sm text-[var(--text-secondary)]">
                {syncStatus}
              </dd>
            </div>
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
                Auth setup
              </dt>
              <dd className="mt-2 text-sm text-[var(--text-secondary)]">
                {isConfigured ? "Supabase configured" : "Env vars required"}
              </dd>
            </div>
          </dl>

          {configurationMessage ? (
            <p className="cu-status-banner cu-status-banner-warning mt-5">
              {configurationMessage}
            </p>
          ) : null}

          {error ? (
            <p className="cu-status-banner cu-status-banner-error mt-5">{error}</p>
          ) : null}

          {feedback ? (
            <p className="cu-status-banner cu-status-banner-success mt-5">
              {feedback}
            </p>
          ) : null}

          {user ? (
            <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
                    Cloud sync
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    Manual for now: push this device&apos;s local data to Supabase
                    or pull your cloud data back into IndexedDB.
                  </p>
                </div>
                <span className="cu-setlist-meta-pill">
                  {lastSyncedAt
                    ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
                    : "No sync yet"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="cu-button cu-button-primary"
                  onClick={handlePushLocalToCloud}
                  disabled={isSyncing || isSessionLoading || isResetting}
                >
                  {isSyncing ? "Syncing..." : "Push local to cloud"}
                </button>
                <button
                  type="button"
                  className="cu-button cu-button-neutral"
                  onClick={handlePullCloudToLocal}
                  disabled={isSyncing || isSessionLoading || isResetting}
                >
                  Pull cloud to local
                </button>
                <button
                  type="button"
                  className="cu-button cu-button-neutral"
                  onClick={handleSignOut}
                  disabled={isSubmitting || isSyncing || isResetting}
                >
                  {isSubmitting ? "Signing out..." : "Log out"}
                </button>
              </div>
            </div>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  htmlFor="account-email"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]"
                >
                  Email magic link
                </label>
                <input
                  id="account-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="cu-search-field"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="cu-button cu-button-primary"
                  disabled={
                    !isConfigured || isSubmitting || isSessionLoading || isResetting
                  }
                >
                  {isSubmitting ? "Sending..." : "Send magic link"}
                </button>
              </div>
            </form>
          )}

          <div className="cu-account-danger-zone mt-6 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--color-destructive)]">
                  Danger zone
                </p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
                  Delete all songs, setlists, performance types, and local sync
                  metadata from this device. Supabase cloud data is not deleted and
                  can be pulled back later.
                </p>
              </div>
              <button
                type="button"
                className="cu-button cu-button-destructive"
                onClick={() => setIsResetModalOpen(true)}
                disabled={isSyncing || isSubmitting || isResetting}
              >
                Delete all local data
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <StatusCard label="Songs" value={String(stats.songs)} />
          <StatusCard
            label="Performance Types"
            value={String(stats.performanceTypes)}
          />
          <StatusCard label="Setlists" value={String(stats.setlists)} />
        </section>
      </PageContentStack>

      {isResetModalOpen ? (
        <div className="cu-editor-overlay">
          <button
            type="button"
            aria-label="Close delete local data confirmation"
            className="cu-editor-backdrop"
            onClick={() => {
              if (!isResetting) {
                setIsResetModalOpen(false);
              }
            }}
          />

          <div className="cu-account-confirm-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="cu-editor-eyebrow">Danger zone</p>
                <h2 className="cu-editor-title">Delete all local data?</h2>
                <p className="cu-editor-subtitle">
                  This clears all local songs, setlists, performance types, and
                  local sync metadata from this device only. It does not delete any
                  Supabase cloud data, and you can pull cloud data back later.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="cu-button cu-button-neutral"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cu-button cu-button-destructive"
                onClick={handleConfirmDeleteLocalData}
                disabled={isResetting}
              >
                {isResetting ? "Deleting..." : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
