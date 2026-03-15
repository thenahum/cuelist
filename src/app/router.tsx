import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppShell } from "../components/app-shell";
import { HomePage } from "../features/home/home-page";
import { PerformanceTypesPage } from "../features/performance-types/performance-types-page";
import { PerformModePage } from "../features/setlists/perform-mode-page";
import { SetlistEditorPage } from "../features/setlists/setlist-editor-page";
import { SetlistsPage } from "../features/setlists/setlists-page";
import { SongEditorPage } from "../features/songs/song-editor-page";
import { SongsPage } from "../features/songs/songs-page";

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
        path: "more",
        element: <HomePage />,
      },
      {
        path: "setlists/:id/perform",
        element: <PerformModePage />,
      },
    ],
  },
]);
