import { RouterProvider } from "react-router-dom";

import type { AppRepositories } from "../domain/repositories";
import { RepositoryProvider } from "./repository-context";
import { ThemeProvider } from "./theme-context";
import { router } from "./router";

interface AppProps {
  repositories: AppRepositories;
}

export function App({ repositories }: AppProps) {
  return (
    <ThemeProvider>
      <RepositoryProvider repositories={repositories}>
        <RouterProvider router={router} />
      </RepositoryProvider>
    </ThemeProvider>
  );
}
