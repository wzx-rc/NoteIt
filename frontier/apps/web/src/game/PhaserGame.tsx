import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { GameState } from "@frontier/core";
import { ColonyScene, bridge, type Target } from "./ColonyScene";

/** Monte le canvas Phaser et lui transmet l'état du jeu. */
export function PhaserGame({ state, onClick }: { state: GameState; onClick: (t: Target) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    const ready = () => bridge.emit("state", latest.current);
    bridge.on("ready", ready);
    const game = new Phaser.Game({
      type: new URLSearchParams(location.search).get("renderer") === "canvas" ? Phaser.CANVAS : Phaser.AUTO,
      parent: host.current!,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: "#06080d",
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
      scene: [ColonyScene],
      banner: false,
    });
    (window as unknown as { __game: Phaser.Game }).__game = game;
    return () => { bridge.off("ready", ready); bridge.removeAllListeners("state"); bridge.removeAllListeners("float"); bridge.removeAllListeners("boom"); game.destroy(true); };
  }, []);

  useEffect(() => { bridge.emit("state", state); }, [state]);

  useEffect(() => {
    bridge.on("click", onClick);
    return () => { bridge.off("click", onClick); };
  }, [onClick]);

  return <div className="game" ref={host} />;
}
