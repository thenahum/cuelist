import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/app";
import { bootstrapApp } from "./app/bootstrap";
import "./index.css";

async function start() {
  const repositories = await bootstrapApp();
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("CueList root element was not found.");
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App repositories={repositories} />
    </StrictMode>,
  );
}

void start();
