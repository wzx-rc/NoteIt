import type { CategoryKey } from "../../core/engine";
import { CATS } from "../model";
import { MONTH, fmt, nf } from "../format";

const R = 48, C = 2 * Math.PI * R, GAP = 2.2;

/** Donut of the daily net per category, with the total in the middle. */
export function Ring({ values, total, base, scale }: { values: Record<CategoryKey, number>; total: number; base: number; scale: number }) {
  let off = 0;
  const d = total - base;
  return (
    <div className="ring">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--raise)" strokeWidth="7" />
        {CATS.map((c) => {
          const len = (Math.max(values[c.key], 0) / scale) * C;
          const el = (
            <circle key={c.key} cx="60" cy="60" r={R} fill="none" stroke={c.color} strokeWidth="7"
              strokeDasharray={`${Math.max(len - GAP, 0)} ${C}`} strokeDashoffset={-off} />
          );
          off += len;
          return el;
        })}
      </svg>
      <div className="c">
        <div className="num">{fmt(total)}<span>$</span></div>
        <div className="per">≈ {nf(total * MONTH)} $ par mois</div>
        <div className="delta" aria-live="polite">
          {d > 0.005 ? <>+{fmt(d)} $/jour<br />+{nf(d * 365)} $/an</> : null}
        </div>
      </div>
    </div>
  );
}
