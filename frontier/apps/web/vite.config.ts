import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build --mode single` produit un seul fichier HTML (assets inclus), pratique pour partager le prototype.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "single" ? [viteSingleFile()] : [])],
  base: "./",
  build: { assetsInlineLimit: mode === "single" ? 100_000_000 : 4096, chunkSizeWarningLimit: 2000, outDir: mode === "single" ? "dist-single" : "dist" },
}));
