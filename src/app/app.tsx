import { AuthProvider } from "./auth-context";
import { RouterProvider } from "react-router-dom";

import type { AppRepositories } from "../domain/repositories";
import type { CloudSyncService } from "../domain/sync";
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
            <RouterProvider router={router} />
          </RepositoryProvider>
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
