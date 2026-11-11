import Phaser from "phaser";
import {
  BUILDINGS, CROPS, RAID, RECIPES, RESOURCES, isBuilt, isExpanded, levelForXp, type BuildingName, type CropName, type GameState,
} from "@frontier/core";
import { now } from "../lib/clock";
import { ASSET_URL, SHEETS } from "./assets";
import { BED_POS, NODE_POS, PLACES, WORLD, onExpansion, onMain } from "./layout";
import { CROP_COLORS, bedCanvas, cropCanvas } from "./textures";

export type Target =
  | { kind: "bed"; id: string }
  | { kind: "node"; id: string }
  | { kind: "place"; id: "hq" | "shop" | "npc" | "greenhouse" | "zone" | BuildingName };

/** Pont entre Phaser et React : la scène émet les clics, React lui pousse l'état. */
export const bridge = new Phaser.Events.EventEmitter();

const FONT = { fontFamily: "Silkscreen, monospace", fontSize: "8px", color: "#e6edf5", backgroundColor: "#0b0d12cc", padding: { x: 3, y: 1 }, resolution: 3 };
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}` : `${s}s`;
};

interface Ent {
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
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
  private drone?: Phaser.GameObjects.Sprite;
  private groundExpanded: boolean | null = null;
  private dragging = false;

  constructor() { super("colony"); }

  preload() {
    for (const [key, url] of Object.entries(ASSET_URL)) {
      const sheet = SHEETS[key];
      if (sheet) this.load.spritesheet(key, url, { frameWidth: sheet.w, frameHeight: sheet.h });
      else this.load.image(key, url);
    }
  }

  create() {
    this.textures.addCanvas("bed", bedCanvas());
    (Object.keys(CROPS) as CropName[]).forEach(c => ([0, 1, 2] as const).forEach(st => this.textures.addCanvas(`crop-${c}-${st}`, cropCanvas(CROP_COLORS[c], st))));
    this.anims.create({ key: "geyser", frames: this.anims.generateFrameNumbers("xenon-geyser", { start: 0, end: 2 }), frameRate: 5, repeat: -1 });
    this.anims.create({ key: "walk", frames: this.anims.generateFrameNumbers("colonist", { start: 0, end: 3 }), frameRate: 4, repeat: -1 });
    this.anims.create({ key: "drone", frames: this.anims.generateFrameNumbers("drone", { start: 0, end: 1 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: "boom", frames: this.anims.generateFrameNumbers("explosion", { start: 0, end: 3 }), frameRate: 10 });
    this.anims.create({ key: "turret", frames: this.anims.generateFrameNumbers("turret", { start: 0, end: 1 }), frameRate: 1, repeat: -1 });

    this.drawStars();
    this.ground = this.add.image(0, 0, "__DEFAULT").setOrigin(0).setDepth(0);

    // Bâtiments fixes
    this.place("hq", "hq", PLACES.hq.x, PLACES.hq.y, "QG");
    this.place("shop", "capsule", PLACES.shop.x, PLACES.shop.y, "Comptoir");
    this.place("greenhouse", "greenhouse", PLACES.greenhouse.x, PLACES.greenhouse.y, "Serre");
    const npc = this.place("npc", "colonist", PLACES.npc.x, PLACES.npc.y, "Livraisons", 1.5);
    (npc.sprite as Phaser.GameObjects.Sprite).play("walk");
    this.place("raffinerie", "construction", PLACES.raffinerie.x, PLACES.raffinerie.y, "Raffinerie");
    this.place("tourelle", "construction", PLACES.tourelle.x, PLACES.tourelle.y, "Tourelle");
    for (const [id, p] of Object.entries(BED_POS)) this.ent(`bed:${id}`, "bed", p.x, p.y, { kind: "bed", id });
    for (const [id, p] of Object.entries(NODE_POS)) this.ent(`node:${id}`, id === "6" ? "xenon-geyser" : "ferrite", p.x, p.y, { kind: "node", id }, id === "6" ? 1.25 : 1);

    // Zone d'extension
    const z = PLACES.zone;
    const zr = this.add.graphics().setDepth(z.y);
    zr.lineStyle(2, 0xf0a648, 0.8).strokeRect(z.x, z.y, z.w, z.h).fillStyle(0xf0a648, 0.05).fillRect(z.x, z.y, z.w, z.h);
    zr.setInteractive(new Phaser.Geom.Rectangle(z.x, z.y, z.w, z.h), Phaser.Geom.Rectangle.Contains);
    zr.on("pointerup", (p: Phaser.Input.Pointer) => this.click({ kind: "place", id: "zone" }, p));
    zr.input!.cursor = "pointer";
    const zt = this.add.text(z.x + z.w / 2, z.y + z.h / 2, "", { ...FONT, backgroundColor: undefined, align: "center", fontSize: "9px" }).setOrigin(0.5).setDepth(z.y + 1);
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

  /** Sol quasi uni (demande de lisibilité) avec un léger damier, dessiné une fois dans une texture. */
  private drawGround(expanded: boolean) {
    const T = WORLD.tile, c = document.createElement("canvas");
    c.width = WORLD.w; c.height = WORLD.h;
    const g = c.getContext("2d")!;
    const R = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const on = (x: number, y: number) => onMain(x, y) || (expanded && onExpansion(x, y));
    for (let y = 0; y < WORLD.h / T; y++) for (let x = 0; x < WORLD.w / T; x++) {
      if (!on(x, y)) continue;
      R(x * T, y * T, T, T, (x + y) % 2 ? "#33323a" : "#35343c");
      if (!on(x, y - 1)) R(x * T, y * T, T, 2, "#45444d");
      if (!on(x, y + 1)) { R(x * T, y * T + T, T, 10, "#24232a"); R(x * T, y * T + T + 10, T, 2, "#0b0d12"); }
    }
    const key = `ground-${expanded ? 1 : 0}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, c);
    this.ground.setTexture(key);
  }

  private place(id: string, tex: string, x: number, y: number, label: string, scale = 1) {
    return this.ent(`place:${id}`, tex, x, y, { kind: "place", id: id as never }, scale, label);
  }

  private ent(key: string, tex: string, x: number, y: number, target: Target, scale = 1, label = "") {
    const sprite = this.add.sprite(0, 0, tex, 0).setOrigin(0).setScale(scale);
    const w = sprite.displayWidth, h = sprite.displayHeight;
    const lbl = this.add.text(w / 2, h + 2, label, FONT).setOrigin(0.5, 0);
    const bar = this.add.graphics();
    const badge = this.add.text(w / 2, -6, "!", { fontFamily: "Silkscreen, monospace", fontSize: "12px", color: "#0b0d12", backgroundColor: "#f0a648", padding: { x: 4, y: 1 }, resolution: 3 }).setOrigin(0.5, 1).setVisible(false);
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
    const bw = Math.max(36, e.w * 0.7), x = (e.w - bw) / 2, y = e.h + 16;
    e.bar.fillStyle(0x0b0d12).fillRect(x - 1, y - 1, bw + 2, 6);
    e.bar.fillStyle(0x3fa66b).fillRect(x, y, Math.round(bw * Phaser.Math.Clamp(p, 0, 1)), 4);
  }

  private setTex(e: Ent, tex: string, scale = 1) {
    if (e.sprite.texture.key === tex) return;
    e.sprite.setTexture(tex, 0).setScale(scale);
    e.w = e.sprite.displayWidth; e.h = e.sprite.displayHeight;
    e.label.setPosition(e.w / 2, e.h + 2);
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
        if (b === "raffinerie") this.setTex(e, "extractor");
        else if (e.sprite.texture.key !== "turret") { this.setTex(e, "turret", 1.4); (e.sprite as Phaser.GameObjects.Sprite).play("turret"); }
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
      e.root.list.filter(o => o.name === "crop").forEach(o => o.destroy());
      if (!crop) { e.label.setText("Bac vide"); this.setBar(e, null); e.badge.setVisible(false); continue; }
      const total = CROPS[crop.name].seconds * 1000, p = (t - crop.plantedAt) / total, ready = p >= 1;
      const st = ready ? 2 : p > 0.5 ? 1 : 0;
      [[10, 8], [26, 8], [42, 8], [18, 18], [34, 18]].forEach(([x, y]) => e.root.add(this.add.image(x, y, `crop-${crop.name}-${st}`).setOrigin(0).setName("crop")));
      e.root.bringToTop(e.label); e.root.bringToTop(e.bar); e.root.bringToTop(e.badge);
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
      e.sprite.setAlpha(ok ? 1 : 0.45);
      const sp = e.sprite as Phaser.GameObjects.Sprite;
      if (n.kind === "xenon") { if (ok && !sp.anims.isPlaying) sp.play("geyser"); if (!ok && sp.anims.isPlaying) sp.stop().setFrame(0); }
      e.label.setText(ok ? (n.kind === "xenon" ? "Xénon · 2 charges" : "Ferrite") : fmt(readyAt - t));
      this.setBar(e, ok ? null : 1 - (readyAt - t) / (cfg.respawnSeconds * 1000));
    }

    // Zone d'extension
    if (expanded && this.zone) { this.zone.g.destroy(); this.zone.t.destroy(); this.zone = null; }
    if (this.zone) this.zone.t.setText(s.expansion.readyAt ? `Extension en cours\n${fmt(s.expansion.readyAt - t)}` : L >= 3 ? "Étendre la colonie\n(touche ici)" : "Zone d'extension\nniveau 3");

    // Raid de drones : ils approchent pendant les 30 dernières secondes
    const left = s.raid.nextAt ? s.raid.nextAt - t : Infinity;
    if (L >= RAID.level && left < 30000 && left > -2000) {
      if (!this.drone) this.drone = this.add.sprite(0, 0, "drone").setOrigin(0).setScale(1.4).setDepth(9999).play("drone");
      const k = 1 - Math.max(0, left) / 30000;
      this.drone.setPosition(WORLD.w + 40 - k * 300, PLACES.tourelle.y - 30 + Math.sin(t / 300) * 6);
    } else if (this.drone) { this.drone.destroy(); this.drone = undefined; }
  }

  private float(target: string, text: string, color = "#b6e3a0") {
    const e = this.ents.get(target);
    if (!e) return;
    const f = this.add.text(e.root.x + e.w / 2, e.root.y - 4, text, { fontFamily: "Silkscreen, monospace", fontSize: "10px", color, stroke: "#0b0d12", strokeThickness: 3, resolution: 3 }).setOrigin(0.5, 1).setDepth(10000);
    this.tweens.add({ targets: f, y: f.y - 26, alpha: 0, duration: 1200, ease: "Cubic.out", onComplete: () => f.destroy() });
  }

  private boom() {
    const x = this.drone ? this.drone.x : PLACES.tourelle.x + 60, y = this.drone ? this.drone.y : PLACES.tourelle.y - 20;
    const b = this.add.sprite(x, y, "explosion").setOrigin(0).setScale(1.5).setDepth(10000).play("boom");
    b.once("animationcomplete", () => b.destroy());
  }
}
