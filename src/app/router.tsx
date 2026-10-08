import { lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppShell } from "../components/app-shell";

const AccountPage = lazy(async () => {
  const { AccountPage: Component } = await import("../features/account/account-page");
  return { default: Component };
});

const PerformanceTypesPage = lazy(async () => {
  const { PerformanceTypesPage: Component } = await import(
    "../features/performance-types/performance-types-page"
  );
  return { default: Component };
});

const PerformModePage = lazy(async () => {
  const { PerformModePage: Component } = await import(
    "../features/setlists/perform-mode-page"
  );
  return { default: Component };
});

const SetlistEditorPage = lazy(async () => {
  const { SetlistEditorPage: Component } = await import(
    "../features/setlists/setlist-editor-page"
  );
  return { default: Component };
});

const SetlistsPage = lazy(async () => {
  const { SetlistsPage: Component } = await import("../features/setlists/setlists-page");
  return { default: Component };
});

const SongEditorPage = lazy(async () => {
  const { SongEditorPage: Component } = await import(
    "../features/songs/song-editor-page"
  );
  return { default: Component };
});

const SongsPage = lazy(async () => {
  const { SongsPage: Component } = await import("../features/songs/songs-page");
  return { default: Component };
});

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/songs" replace />,
      },
      {
        path: "songs",
        element: <SongsPage />,
      },
      {
        path: "songs/new",
        element: <SongEditorPage />,
      },
      {
        path: "songs/:id",
        element: <SongEditorPage />,
      },
      {
        path: "performance-types",
        element: <PerformanceTypesPage />,
      },
      {
        path: "setlists",
        element: <SetlistsPage />,
      },
      {
        path: "setlists/new",
        element: <SetlistEditorPage />,
      },
      {
        path: "setlists/:id",
        element: <SetlistEditorPage />,
      },
      {
        path: "account",
        element: <AccountPage />,
      },
      {
        path: "more",
        element: <Navigate to="/account" replace />,
      },
      {
        path: "setlists/:id/perform",
        element: <PerformModePage />,
      },
    ],
  },
]);
