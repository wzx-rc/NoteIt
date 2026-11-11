import type { CategoryKey } from "../../core/engine";
import { Icon } from "../icons";
import { CATS } from "../model";
import { fmt } from "../format";

/** Categories sorted by what they earn, with the option gain next to the name. */
export function Legend({ values, base, subtitles }: { values: Record<CategoryKey, number>; base: Record<CategoryKey, number>; subtitles: Record<CategoryKey, string> }) {
  return (
    <div className="legend">
      {[...CATS].sort((a, b) => values[b.key] - values[a.key]).map((c) => {
        const d = values[c.key] - base[c.key];
        return (
          <div className="leg" key={c.key}>
            <span className="chip" style={{ ["--cc" as string]: c.color }}><Icon name={c.icon} label={c.name} /></span>
            <b>{c.name}{d > 0.005 ? <span className="plus">+{fmt(d)}</span> : null}</b>
            <span className="v">{fmt(values[c.key])} $</span>
            <small>{subtitles[c.key]}</small>
          </div>
        );
      })}
    </div>
  );
}
