// Bundles the Electron main and preload scripts into dist-electron/.
import { build } from "esbuild";

const common = { bundle: true, platform: "node", format: "cjs", target: "node20", external: ["electron"], sourcemap: false };
await build({ ...common, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.js" });
await build({ ...common, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.js" });
