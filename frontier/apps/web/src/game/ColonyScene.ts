import Phaser from "phaser";
import {
  BUILDINGS, CROPS, RAID, RECIPES, RESOURCES, isBuilt, isExpanded, levelForXp, type BuildingName, type GameState,
} from "@frontier/core";
import { now } from "../lib/clock";
import { ASSET_URL, RES } from "./assets";
import { BED_POS, ISLAND, NODE_POS, PLACES, WORLD } from "./layout";

export type Target =
  | { kind: "bed"; id: string }
  | { kind: "node"; id: string }
  | { kind: "place"; id: "hq" | "shop" | "npc" | "greenhouse" | "zone" | BuildingName };

/** Pont entre Phaser et React : la scène émet les clics, React lui pousse l'état. */
export const bridge = new Phaser.Events.EventEmitter();

const FACE = "'Chakra Petch', system-ui, sans-serif";
const FONT = { fontFamily: FACE, fontSize: "11px", fontStyle: "600", color: "#eef3f8", backgroundColor: "#0d1219d9", padding: { x: 5, y: 2 }, resolution: 3 };
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}` : `${s}s`;
};

interface Ent {
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  badge: Phaser.GameObjects.Text;
  w: number;
  h: number;
}

export class ColonyScene extends Phaser.Scene {
  private game$: GameState | null = null;
  private ents = new Map<string, Ent>();
  private ground!: Phaser.GameObjects.Image;
  private zone: { g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text } | null = null;
  private drone?: Phaser.GameObjects.Image;
  private groundExpanded: boolean | null = null;
  private dragging = false;

  constructor() { super("colony"); }

  preload() {
    for (const [key, url] of Object.entries(ASSET_URL)) this.load.image(key, url);
  }

  create() {
    this.drawStars();
    this.ground = this.add.image(0, 0, "__DEFAULT").setOrigin(0).setDepth(0);

    // Bâtiments fixes
    this.place("hq", "hq", PLACES.hq.x, PLACES.hq.y, "QG");
    this.place("shop", "capsule", PLACES.shop.x, PLACES.shop.y, "Comptoir");
    this.place("greenhouse", "greenhouse", PLACES.greenhouse.x, PLACES.greenhouse.y, "Serre");
    const npc = this.place("npc", "colonist", PLACES.npc.x, PLACES.npc.y, "Livraisons");
    this.tweens.add({ targets: npc.sprite, y: -3, yoyo: true, repeat: -1, duration: 900, ease: "Sine.inOut" });
    this.place("raffinerie", "construction", PLACES.raffinerie.x, PLACES.raffinerie.y, "Raffinerie");
    this.place("tourelle", "construction", PLACES.tourelle.x, PLACES.tourelle.y, "Tourelle");
    for (const [id, p] of Object.entries(BED_POS)) this.ent(`bed:${id}`, "bed", p.x, p.y, { kind: "bed", id });
    for (const [id, p] of Object.entries(NODE_POS)) this.ent(`node:${id}`, id === "6" ? "xenon-geyser" : "ferrite", p.x, p.y, { kind: "node", id });

    // Zone d'extension
    const z = PLACES.zone;
    const zr = this.add.graphics().setDepth(z.y);
    zr.fillStyle(0xf0a648, 0.06).fillRoundedRect(z.x, z.y, z.w, z.h, 18).lineStyle(2, 0xf0a648, 0.75).strokeRoundedRect(z.x, z.y, z.w, z.h, 18);
    zr.setInteractive(new Phaser.Geom.Rectangle(z.x, z.y, z.w, z.h), Phaser.Geom.Rectangle.Contains);
    zr.on("pointerup", (p: Phaser.Input.Pointer) => this.click({ kind: "place", id: "zone" }, p));
    zr.input!.cursor = "pointer";
    const zt = this.add.text(z.x + z.w / 2, z.y + z.h / 2, "", { ...FONT, backgroundColor: undefined, align: "center", fontSize: "13px", color: "#ffd9a3", stroke: "#0d1219", strokeThickness: 4 }).setOrigin(0.5).setDepth(z.y + 1);
    this.zone = { g: zr, t: zt };

    this.setupCamera();
    bridge.on("state", (s: GameState) => { this.game$ = s; this.refresh(); });
    bridge.on("float", (p: { target: string; text: string; color?: string }) => this.float(p.target, p.text, p.color));
    bridge.on("boom", () => this.boom());
    bridge.emit("ready");
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.refresh() });
  }

  private setupCamera() {
    const cam = this.cameras.main;
    cam.setBackgroundColor("#06080d");
    const fit = () => {
      const { width, height } = this.scale.gameSize;
      const fitZoom = Math.min(width / WORLD.w, (height - 40) / WORLD.h) * 0.98;
      const narrow = width < 700;
      cam.setZoom(narrow ? Math.min(1.2, Math.max(fitZoom, 0.62)) : Math.max(0.5, fitZoom));
      cam.centerOn(narrow ? WORLD.w * 0.4 : WORLD.w / 2, WORLD.h / 2 + 10);
    };
    fit();
    this.scale.on("resize", fit);
    let start: { x: number; y: number; sx: number; sy: number } | null = null;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => { start = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY }; this.dragging = false; });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!start || !p.isDown) return;
      const dx = p.x - start.x, dy = p.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) this.dragging = true;
      if (this.dragging) cam.setScroll(start.sx - dx / cam.zoom, start.sy - dy / cam.zoom);
    });
    this.input.on("pointerup", () => { start = null; setTimeout(() => (this.dragging = false), 0); });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.5, 3)));
  }

  /** Ignore les clics faits sur l'interface HTML posée au-dessus du canvas (Phaser écoute toute la fenêtre). */
  private click(t: Target, p: Phaser.Input.Pointer) {
    const canvas = this.game.canvas;
    if (this.dragging || p.downElement !== canvas || p.upElement !== canvas) return;
    bridge.emit("click", t);
  }

  private drawStars() {
    const g = this.add.graphics().setDepth(-2);
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) { g.fillStyle(0xc8d2eb, 0.15 + rnd() * 0.35); g.fillRect(rnd() * WORLD.w * 1.6 - WORLD.w * 0.3, rnd() * WORLD.h * 1.6 - WORLD.h * 0.3, 1, 1); }
  }

  /** Sol peint (tuile Recraft répétée), découpé à la forme de l'île, avec une falaise dessous. */
  private drawGround(expanded: boolean) {
    const key = `ground-${expanded ? 1 : 0}`;
    if (!this.textures.exists(key)) {
      const c = document.createElement("canvas");
      c.width = WORLD.w; c.height = WORLD.h;
      const g = c.getContext("2d")!;
      const shapes = [ISLAND.main, ...(expanded ? [ISLAND.expansion] : [])];
      const path = (dy: number, grow = 0) => { g.beginPath(); for (const e of shapes) g.ellipse(e.cx, e.cy + dy, e.rx + grow, e.ry + grow, 0, 0, Math.PI * 2); };
      // falaise
      path(22); g.fillStyle = "#14161c"; g.fill();
      path(12); g.fillStyle = "#3a3431"; g.fill();
      // halo lumineux sous le bord
      g.save(); path(0, 3); g.fillStyle = "#6b6460"; g.fill(); g.restore();
      // sol
      g.save(); path(0); g.clip();
      const tile = this.textures.get("ground").getSourceImage() as HTMLImageElement;
      g.fillStyle = g.createPattern(tile, "repeat")!; g.fillRect(0, 0, WORLD.w, WORLD.h);
      for (const e of shapes) {
        const v = g.createRadialGradient(e.cx, e.cy, Math.min(e.rx, e.ry) * 0.55, e.cx, e.cy, Math.max(e.rx, e.ry) * 1.02);
        v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(10,8,12,0.38)");
        g.fillStyle = v; g.fillRect(0, 0, WORLD.w, WORLD.h);
      }
      g.restore();
      this.textures.addCanvas(key, c);
    }
    this.ground.setTexture(key);
  }

  private place(id: string, tex: string, x: number, y: number, label: string) {
    return this.ent(`place:${id}`, tex, x, y, { kind: "place", id: id as never }, label);
  }

  private ent(key: string, tex: string, x: number, y: number, target: Target, label = "") {
    const sprite = this.add.image(0, 0, tex).setOrigin(0).setScale(1 / RES);
    const w = sprite.displayWidth, h = sprite.displayHeight;
    const lbl = this.add.text(w / 2, h + 1, label, FONT).setOrigin(0.5, 0);
    const bar = this.add.graphics();
    const badge = this.add.text(w / 2, -6, "!", { fontFamily: FACE, fontSize: "14px", fontStyle: "700", color: "#1a1206", backgroundColor: "#f0a648", padding: { x: 6, y: 1 }, resolution: 3 }).setOrigin(0.5, 1).setVisible(false);
    const root = this.add.container(x, y, [sprite, lbl, bar, badge]).setDepth(y + h);
    sprite.setInteractive({ useHandCursor: true, pixelPerfect: false })
      .on("pointerover", () => sprite.setTint(0xfff1d6))
      .on("pointerout", () => sprite.clearTint())
      .on("pointerup", (p: Phaser.Input.Pointer) => this.click(target, p));
    this.tweens.add({ targets: badge, y: -10, yoyo: true, repeat: -1, duration: 500, ease: "Sine.inOut" });
    const e: Ent = { root, sprite, label: lbl, bar, badge, w, h };
    this.ents.set(key, e);
    return e;
  }

  private setBar(e: Ent, p: number | null) {
    e.bar.clear();
    if (p === null) return;
    const bw = Math.max(40, e.w * 0.7), x = (e.w - bw) / 2, y = e.h + 20;
    e.bar.fillStyle(0x0d1219, 0.9).fillRoundedRect(x - 2, y - 2, bw + 4, 8, 4);
    e.bar.fillStyle(0x6fd38a).fillRoundedRect(x, y, Math.max(4, Math.round(bw * Phaser.Math.Clamp(p, 0, 1))), 4, 2);
  }

  private setTex(e: Ent, tex: string) {
    if (e.sprite.texture.key === tex) return;
    e.sprite.setTexture(tex);
    e.w = e.sprite.displayWidth; e.h = e.sprite.displayHeight;
    e.label.setPosition(e.w / 2, e.h + 1);
    e.badge.setX(e.w / 2);
  }

  /** Met la carte à jour à partir de l'état du jeu (appelé à chaque action et 4 fois par seconde). */
  private refresh() {
    const s = this.game$;
    if (!s) return;
    const t = now(), L = levelForXp(s.xp), expanded = isExpanded(s, t);
    if (this.groundExpanded !== expanded) { this.drawGround(expanded); this.groundExpanded = expanded; }

    this.ents.get("place:hq")!.label.setText(`QG · niv. ${L}`);
    this.ents.get("place:npc")!.badge.setVisible(s.orders.some(o => Object.entries(o.items).every(([k, n]) => (s.inventory[k as never] ?? 0) >= (n ?? 0))));

    // Bâtiments à construire
    for (const b of ["raffinerie", "tourelle"] as BuildingName[]) {
      const e = this.ents.get(`place:${b}`)!, info = s.buildings[b], cfg = BUILDINGS[b];
      const built = isBuilt(s, b, t);
      if (built) {
        this.setTex(e, b === "raffinerie" ? "extractor" : "turret");
      } else this.setTex(e, "construction");
      e.sprite.setAlpha(L < cfg.level ? 0.45 : 1);
      if (!info) { e.label.setText(L < cfg.level ? `${cfg.label} · niv. ${cfg.level}` : `Construire : ${cfg.label.toLowerCase()}`); this.setBar(e, null); e.badge.setVisible(false); }
      else if (!built) { e.label.setText(`Chantier · ${fmt(info.readyAt - t)}`); this.setBar(e, 1 - (info.readyAt - t) / (cfg.seconds * 1000)); e.badge.setVisible(false); }
      else if (b === "raffinerie") {
        const c = s.crafting, done = !!c && t >= c.readyAt;
        e.label.setText(c ? (done ? "Raffinerie · prêt" : `Raffinerie · ${fmt(c.readyAt - t)}`) : "Raffinerie");
        this.setBar(e, c && !done ? 1 - (c.readyAt - t) / (RECIPES[c.item].seconds * 1000) : null);
        e.badge.setVisible(done);
      } else { e.label.setText(s.raid.nextAt && s.raid.nextAt - t < 30000 ? "Tourelle · alerte" : "Tourelle"); this.setBar(e, null); }
    }

    // Bacs
    for (const [id, bed] of Object.entries(s.beds)) {
      const e = this.ents.get(`bed:${id}`)!;
      const visible = !bed.expansion || expanded;
      e.root.setVisible(visible);
      if (!visible) continue;
      const crop = bed.crop;
      if (!crop) { this.setTex(e, "bed"); e.label.setText("Bac vide"); this.setBar(e, null); e.badge.setVisible(false); continue; }
      const total = CROPS[crop.name].seconds * 1000, p = (t - crop.plantedAt) / total, ready = p >= 1;
      const st = ready ? 2 : p > 0.5 ? 1 : 0;
      this.setTex(e, `bed-${crop.name}-${st}`);
      e.label.setText(ready ? `${CROPS[crop.name].label} · prêt` : fmt(crop.plantedAt + total - t));
      this.setBar(e, ready ? null : p);
      e.badge.setVisible(ready);
    }

    // Gisements
    for (const [id, n] of Object.entries(s.nodes)) {
      const e = this.ents.get(`node:${id}`)!;
      const visible = !n.expansion || expanded;
      e.root.setVisible(visible);
      if (!visible) continue;
      const cfg = RESOURCES[n.kind], readyAt = n.minedAt ? n.minedAt + cfg.respawnSeconds * 1000 : 0, ok = t >= readyAt;
      const tex = n.kind === "xenon" ? "xenon-geyser" : "ferrite";
      this.setTex(e, ok ? tex : `${tex}-off`.replace("ferrite-off", "ferrite-empty"));
      e.label.setText(ok ? (n.kind === "xenon" ? "Xénon · 2 charges" : "Ferrite") : fmt(readyAt - t));
      this.setBar(e, ok ? null : 1 - (readyAt - t) / (cfg.respawnSeconds * 1000));
    }

    // Zone d'extension
    if (expanded && this.zone) { this.zone.g.destroy(); this.zone.t.destroy(); this.zone = null; }
    if (this.zone) this.zone.t.setText(s.expansion.readyAt ? `Extension en cours\n${fmt(s.expansion.readyAt - t)}` : L >= 3 ? "Étendre la colonie\n(touche ici)" : "Zone d'extension\nniveau 3");

    // Raid de drones : ils approchent pendant les 30 dernières secondes
    const left = s.raid.nextAt ? s.raid.nextAt - t : Infinity;
    if (L >= RAID.level && left < 30000 && left > -2000) {
      if (!this.drone) this.drone = this.add.image(0, 0, "drone").setOrigin(0).setScale(1.2 / RES).setDepth(9999);
      const k = 1 - Math.max(0, left) / 30000;
      this.drone.setPosition(WORLD.w + 40 - k * 300, PLACES.tourelle.y - 30 + Math.sin(t / 300) * 6);
    } else if (this.drone) { this.drone.destroy(); this.drone = undefined; }
  }

  private float(target: string, text: string, color = "#b6e3a0") {
    const e = this.ents.get(target);
    if (!e) return;
    const f = this.add.text(e.root.x + e.w / 2, e.root.y - 4, text, { fontFamily: FACE, fontSize: "14px", fontStyle: "700", color, stroke: "#0d1219", strokeThickness: 4, resolution: 3 }).setOrigin(0.5, 1).setDepth(10000);
    this.tweens.add({ targets: f, y: f.y - 26, alpha: 0, duration: 1200, ease: "Cubic.out", onComplete: () => f.destroy() });
  }

  private boom() {
    const x = this.drone ? this.drone.x : PLACES.tourelle.x + 60, y = this.drone ? this.drone.y : PLACES.tourelle.y - 20;
    // Explosion dessinée : flash, boule de feu et onde de choc
    const cx = x + 26, cy = y + 18;
    const flash = this.add.circle(cx, cy, 10, 0xfff1c4).setDepth(10001);
    const fire = this.add.circle(cx, cy, 8, 0xf0a648, 0.9).setDepth(10000);
    const ring = this.add.circle(cx, cy, 10).setStrokeStyle(3, 0xffd9a3).setDepth(10000);
    this.tweens.add({ targets: flash, scale: 2.4, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    this.tweens.add({ targets: fire, scale: 3.2, alpha: 0, duration: 650, ease: "Cubic.out", onComplete: () => fire.destroy() });
    this.tweens.add({ targets: ring, scale: 4.5, alpha: 0, duration: 550, ease: "Cubic.out", onComplete: () => ring.destroy() });
    this.cameras.main.shake(180, 0.004);
  }
}
