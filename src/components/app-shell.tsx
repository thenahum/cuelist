import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
} from "react-router-dom";

import { useTheme } from "../app/theme-context";

const navigationItems = [
  { to: "/songs", label: "Songs" },
  { to: "/setlists", label: "Setlists" },
];

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function isNavItemActive(pathname: string, itemPath: string): boolean {
  if (itemPath === "/more") {
    return pathname.startsWith("/more") || pathname.startsWith("/performance-types");
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function navClassName(isActive: boolean): string {
  return isActive ? "cu-nav-item cu-nav-item-active" : "cu-nav-item";
}

export function AppShell() {
  const location = useLocation();
  const { mode, setMode } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isPerformMode = location.pathname.includes("/perform");
  const hideShellHeader =
    location.pathname.startsWith("/songs") || location.pathname.startsWith("/setlists");
  const isMoreActive =
    location.pathname.startsWith("/more") ||
    location.pathname.startsWith("/performance-types");

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname, location.search]);

  if (isPerformMode) {
    return (
      <div className="min-h-svh bg-transparent text-slate-100">
        <main className="min-h-svh">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="cu-app-shell">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 pb-28 pt-4 sm:px-6 lg:px-8">
        {hideShellHeader ? null : (
          <header className="cu-shell-header">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[var(--brand-soft)]">
                  CueList
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-primary)] sm:text-xl">
                  {location.pathname.startsWith("/setlists")
                    ? "Setlists"
                    : isMoreActive
                      ? "More"
                      : "Songs"}
                </p>
              </div>
              <div className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-2 text-sm text-[var(--text-secondary)] sm:block">
                {location.pathname.startsWith("/songs")
                  ? "Catalog"
                  : location.pathname.startsWith("/setlists")
                    ? "Live Planning"
                    : "Utilities"}
              </div>
            </div>
          </header>
        )}

        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      <nav className="cu-bottom-nav">
        <div className="cu-bottom-nav-inner">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={() => navClassName(isNavItemActive(location.pathname, item.to))}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            aria-label="Open more menu"
            className={navClassName(isMenuOpen || isMoreActive)}
          >
            <MenuIcon />
          </button>
        </div>
      </nav>

      {isMenuOpen ? (
        <div className="cu-menu-layer">
          <button
            type="button"
            className="cu-menu-backdrop"
            aria-label="Close menu"
            onClick={() => setIsMenuOpen(false)}
          />
          <section className="cu-menu-panel">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-soft)]">
                More
              </p>
              <div className="space-y-2">
                <Link
                  to="/more"
                  className="cu-menu-link"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Overview
                </Link>
                <Link
                  to="/performance-types"
                  className="cu-menu-link"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Performance Types
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Theme
              </p>
              <div className="cu-theme-toggle" role="group" aria-label="Theme mode">
                <button
                  type="button"
                  onClick={() => setMode("light")}
                  className={mode === "light" ? "cu-theme-option cu-theme-option-active" : "cu-theme-option"}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setMode("dark")}
                  className={mode === "dark" ? "cu-theme-option cu-theme-option-active" : "cu-theme-option"}
                >
                  Dark
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
