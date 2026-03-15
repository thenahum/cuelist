import { createContext, useContext } from "react";

import type { AppRepositories } from "../domain/repositories";

const RepositoryContext = createContext<AppRepositories | null>(null);

interface RepositoryProviderProps {
  repositories: AppRepositories;
  children: React.ReactNode;
}

export function RepositoryProvider({
  repositories,
  children,
}: RepositoryProviderProps) {
  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepositories(): AppRepositories {
  const value = useContext(RepositoryContext);

  if (!value) {
    throw new Error("Repository context is unavailable.");
  }

  return value;
}
