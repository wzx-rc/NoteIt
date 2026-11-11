import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

/**
 * Sunflower Land Community API client. Runs only in the Electron main process,
 * so the API key never reaches the window.
 * Limit: about 1 request every 5 s on /community/*, a 429 means wait 10 s.
 */
export class SflClient {
  private last = 0;
  constructor(private base: string, private key: string) {}

  private async get(path: string, tries = 4): Promise<any> {
    const wait = this.last + 5500 - Date.now();
    if (wait > 0) await sleep(wait);
    this.last = Date.now();
    const res = await fetch(this.base + path, { headers: { "x-api-key": this.key } });
    if (res.status === 429 && tries > 0) {
      await sleep(10_000);
      return this.get(path, tries - 1);
    }
    if (res.status === 401) throw new Error("Clé API refusée. Vérifie-la dans les réglages (VIP actif et niveau 50 requis).");
    if (!res.ok) throw new Error(`L'API a répondu ${res.status} sur ${path}.`);
    return res.json();
  }

  farm(id: string) {
    return this.get(`/community/farms/${encodeURIComponent(id)}`);
  }
  marketplace() {
    return this.get("/community/data?type=marketplaceActivity");
  }
  dumps(): Promise<{ data: { filename: string }[] }> {
    return this.get("/community/data?type=nightlyDump");
  }
}

/** Keeps only the counters the engine reads, to keep history files small. */
export function trimActivity(fa: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(fa)) {
    if (/(Mined|Crafted|Fed|Collected|Harvested|Planted|Seed Bought|Chopped)$/.test(k)) out[k] = v;
  }
  return out;
}

/**
 * Reads one nightly dump (≈ 800 MB compressed, streamed, nothing saved to disk)
 * and returns this farm's row: its state and the time of its last action.
 */
export async function farmFromDump(file: string, farmId: string): Promise<{ at: number; farm: any } | null> {
  const res = await fetch(`https://community.sunflower-land.com/${file}`);
  if (!res.ok || !res.body) throw new Error(`Dump ${file} indisponible (${res.status}).`);
  const lines = createInterface({ input: Readable.fromWeb(res.body as any).pipe(createGunzip()), crlfDelay: Infinity });
  const needles = [`"id":${farmId},`, `"nftId":${farmId},`, `"id":"${farmId}"`];
  for await (const line of lines) {
    if (!needles.some((n) => line.includes(n))) continue;
    const row = JSON.parse(line);
    if (String(row.id) !== farmId && String(row.nftId) !== farmId) continue;
    lines.close();
    res.body.cancel().catch(() => {});
    return { at: Number(row.lastActivity ?? Date.parse(file.slice(0, 10))), farm: row.farm ?? {} };
  }
  return null;
}

export const cleanKey = (k: string) => k.trim().replace(/^<|>$/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
