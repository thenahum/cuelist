import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { StatusCard } from "../../components/status-card";
import { useRepositories } from "../../app/repository-context";
import { useTheme } from "../../app/theme-context";

interface DashboardStats {
  songs: number;
  performanceTypes: number;
  setlists: number;
}

export function HomePage() {
  const repositories = useRepositories();
  const { mode } = useTheme();
  const [stats, setStats] = useState<DashboardStats>({
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
    <div className="space-y-5">
      <section className="rounded-[34px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-2xl shadow-black/15 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--brand-soft)]">
          More
        </p>
        <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-white">
          The quiet utility space for everything around the core workflow.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
          Songs and Setlists stay front-and-center in navigation. This area is
          for overview, quick stats, and performance-type management without
          crowding the main work surfaces.
        </p>
        <div className="mt-5 inline-flex rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300">
          Active theme: {mode === "dark" ? "Dark" : "Light"}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatusCard
          label="Songs"
          value={String(stats.songs)}
          caption="Mock catalog entries seeded into IndexedDB for local development."
        />
        <StatusCard
          label="Performance Types"
          value={String(stats.performanceTypes)}
          caption="User-defined structure with seeded Acoustic, Electric, and Full Band."
        />
        <StatusCard
          label="Setlists"
          value={String(stats.setlists)}
          caption="Development setlists ready for the setlist and perform-mode phases."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
          <h3 className="text-lg font-semibold tracking-tight text-white">
            Quick actions
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              to="/performance-types"
              className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/20 hover:bg-white/7"
            >
              <p className="text-sm font-semibold text-white">Manage performance types</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Review the current list, rename existing types, or remove unused custom ones.
              </p>
            </Link>
            <Link
              to="/performance-types?editor=new"
              className="rounded-[24px] border border-[color-mix(in_srgb,var(--color-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-4 text-left transition hover:border-[color-mix(in_srgb,var(--color-primary)_42%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)]"
            >
              <p className="text-sm font-semibold text-[var(--color-primary-soft)]">Add performance type</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Create a new live context like Duo, Loop Set, or Backing Track.
              </p>
            </Link>
            <Link
              to="/songs?sort=practice"
              className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/20 hover:bg-white/7"
            >
              <p className="text-sm font-semibold text-white">Open practice view</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Jump straight into songs sorted for rehearsal and maintenance work.
              </p>
            </Link>
            <Link
              to="/setlists"
              className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/20 hover:bg-white/7"
            >
              <p className="text-sm font-semibold text-white">Review setlists</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Pick up where you left off with show prep and perform mode.
              </p>
            </Link>
          </div>
        </article>

        <article className="rounded-[28px] border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold tracking-tight text-white">
            Notes
          </h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>Editors are now being pulled into their own workspace so the next pass can focus on making those forms genuinely enjoyable.</p>
            <p>The MVP foundation is still repository-first, so a Supabase-backed sync layer remains a clean follow-up.</p>
          </div>
        </article>
      </section>
    </div>
  );
}
