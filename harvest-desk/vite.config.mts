import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the built page also loads from file:// inside Electron.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  test: { environment: "node" },
} as any);
