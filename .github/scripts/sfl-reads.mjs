// One reading of the farm for Harvest Desk's Money Tree page, appended to a JSONL file.
// Run by .github/workflows/money-tree.yml. Never prints the key.
// Row: { at, c: [Basic, Ancient, Sacred Tree chops], mt: last Money Tree pop, tree, mult }.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2] || "reads.jsonl";
const key = (process.env.SFL_API_KEY || "").trim().replace(/^</, "").replace(/>$/, "");
const farmId = (process.env.SFL_FARM_ID || "").trim();
const base = (process.env.SFL_API_BASE || "https://api.sunflower-land.com").replace(/\/+$/, "");
const KEEP = 90 * 86_400_000;
if (!key || !farmId) { console.error("SFL_API_KEY or SFL_FARM_ID missing"); process.exit(1); }

async function farm() {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${base}/community/farms/${farmId}`, { headers: { "x-api-key": key } });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 10_000)); continue; }
    if (!res.ok) throw new Error(`farm read failed: HTTP ${res.status}`);
    return (await res.json()).farm;
  }
  throw new Error("farm read failed: rate limited");
}

const KINDS = { Tree: "Basic Tree", "Ancient Tree": "Ancient Tree", "Sacred Tree": "Sacred Tree" };
const f = await farm();
const fa = f.farmActivity || {};
const row = { at: Date.now(), c: ["Basic Tree", "Ancient Tree", "Sacred Tree"].map((k) => Number(fa[`${k} Chopped`] || 0)) };
const mt = f.boostsUsedAt?.["Money Tree"];
if (mt) {
  row.mt = mt;
  for (const t of Object.values(f.trees || {})) {
    if (t.wood?.choppedAt && Math.abs(t.wood.choppedAt - mt) <= 1000) { row.tree = KINDS[t.name || "Tree"] || "Basic Tree"; row.mult = t.multiplier || 1; break; }
  }
}

const old = existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : [];
const kept = old.filter((l) => { try { return JSON.parse(l).at > row.at - KEEP; } catch { return false; } });
writeFileSync(file, [...kept, JSON.stringify(row)].join("\n") + "\n");
console.log(`ok: ${kept.length + 1} readings${row.tree ? `, last pop on ${row.tree}` : ""}`);
