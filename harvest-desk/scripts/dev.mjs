// Dev mode: Vite server with hot reload, then Electron pointed at it.
import { spawn } from "node:child_process";
import { createServer } from "vite";
import electron from "electron";

await import("./build-electron.mjs");
const server = await createServer();
await server.listen();
const url = server.resolvedUrls.local[0];
const app = spawn(electron, ["."], { stdio: "inherit", env: { ...process.env, VITE_DEV_SERVER_URL: url } });
app.on("close", () => { server.close(); process.exit(0); });
