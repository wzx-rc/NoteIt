import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : le build marche aussi bien sur le sous-domaine SFL qu'en local.
  base: "./",
  server: { port: 3000 },
});
