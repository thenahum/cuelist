import * as Sentry from "@sentry/react";
import type { PropsWithChildren } from "react";

function AppCrashFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-lg shadow-black/5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--brand-soft)]">
          CueList
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          The error has been captured. Refresh the app to keep working.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--brand)]"
        >
          Refresh CueList
        </button>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: PropsWithChildren) {
  return <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>{children}</Sentry.ErrorBoundary>;
}
