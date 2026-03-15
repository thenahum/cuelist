import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useRepositories } from "../../app/repository-context";
import { PageShell } from "../../components/page-shell";
import { StatusCard } from "../../components/status-card";

interface AccountStats {
  songs: number;
  performanceTypes: number;
  setlists: number;
}

export function AccountPage() {
  const repositories = useRepositories();
  const [stats, setStats] = useState<AccountStats>({
    songs: 0,
    performanceTypes: 0,
    setlists: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      const [songs, performanceTypes, setlists] = await Promise.all([
        repositories.songs.count(),
        repositories.performanceTypes.count(),
        repositories.setlists.count(),
      ]);

      if (!cancelled) {
        setStats({
          songs,
          performanceTypes,
          setlists,
        });
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [repositories]);

  return (
    <PageShell className="space-y-5">
      <section className="cu-panel p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--brand-soft)]">
          Account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
          Account & Stats
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          CueList is still running locally on this device. This screen is the
          future home for auth, session state, and sync setup once Supabase is
          connected.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatusCard
          label="Songs"
          value={String(stats.songs)}
          caption="Songs currently stored in your local catalog."
        />
        <StatusCard
          label="Performance Types"
          value={String(stats.performanceTypes)}
          caption="Seeded and custom performance contexts available right now."
        />
        <StatusCard
          label="Setlists"
          value={String(stats.setlists)}
          caption="Saved show and rehearsal lists on this device."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="cu-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                Session
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Auth is not connected yet, so the app is currently operating in
                local-only mode.
              </p>
            </div>
            <span className="cu-setlist-meta-pill">Signed out</span>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
                Account email
              </dt>
              <dd className="mt-2 text-sm text-[var(--text-secondary)]">
                No account connected yet
              </dd>
            </div>
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
                Sync status
              </dt>
              <dd className="mt-2 text-sm text-[var(--text-secondary)]">
                Local device only
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="cu-button cu-button-primary" disabled>
              Log in
            </button>
            <button type="button" className="cu-button cu-button-neutral" disabled>
              Log out
            </button>
          </div>
        </article>

        <article className="cu-panel p-6">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            App
          </h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
                Storage
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                IndexedDB is the active local store. Repositories are already in
                place so auth and Supabase-backed sync can plug in next without
                changing the feature UI.
              </p>
            </div>

            <Link to="/performance-types" className="cu-menu-link">
              Performance Types
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>
      </section>
    </PageShell>
  );
}
