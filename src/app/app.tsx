import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthProvider } from "./auth-context";
import { RouterProvider } from "react-router-dom";

import type { AppRepositories } from "../domain/repositories";
import type { CloudSyncService } from "../domain/sync";
import { sanitizeMonitoringEvent } from "../lib/observability";
import { AppErrorBoundary } from "./app-error-boundary";
import { RepositoryProvider } from "./repository-context";
import { SyncProvider } from "./sync-context";
import { ThemeProvider } from "./theme-context";
import { router } from "./router";

interface AppProps {
  repositories: AppRepositories;
  syncService: CloudSyncService;
}

export function App({ repositories, syncService }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider syncService={syncService}>
          <RepositoryProvider repositories={repositories}>
            <AppErrorBoundary>
              <>
                <RouterProvider router={router} />
                <Analytics beforeSend={sanitizeMonitoringEvent} />
                <SpeedInsights beforeSend={sanitizeMonitoringEvent} />
              </>
            </AppErrorBoundary>
          </RepositoryProvider>
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
