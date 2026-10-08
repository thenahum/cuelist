import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) {
            return undefined;
          }

          if (id.includes("/node_modules/@sentry/")) {
            return "sentry";
          }

          if (id.includes("/node_modules/@supabase/")) {
            return "supabase";
          }

          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react-router")
          ) {
            return "react";
          }

          if (id.includes("/node_modules/dexie/")) {
            return "dexie";
          }

          return undefined;
        },
      },
    },
  },
});
