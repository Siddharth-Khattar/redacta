import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  optimizeDeps: { exclude: ["mupdf"] },
  build: { target: "es2022" },
});
