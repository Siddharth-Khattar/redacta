import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  optimizeDeps: { exclude: ["mupdf"] },
  build: {
    target: "es2022",
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // mupdf references Node.js-only modules that Vite correctly externalizes;
        // these warnings are expected and safe to suppress.
        if (
          warning.plugin === "vite:resolve" &&
          warning.message?.includes("has been externalized for browser compatibility")
        ) {
          return;
        }
        defaultHandler(warning);
      },
    },
  },
});
