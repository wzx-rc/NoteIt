import type { CategoryKey } from "../../core/engine";
import { Legend } from "./Legend";
import { Ring } from "./Ring";

interface Props {
  values: Record<CategoryKey, number>; baseValues: Record<CategoryKey, number>;
  total: number; base: number; scale: number; days: number; subtitles: Record<CategoryKey, string>;
}

export function RevenueCard({ values, baseValues, total, base, scale, days, subtitles }: Props) {
  return (
    <section className="card" aria-labelledby="h-rev">
      <h2 id="h-rev">Ce que la ferme rapporte par jour</h2>
      <p className="hint">Net, après graines, nourriture et pioches. Moyenne réelle sur {days >= 1.5 ? `${Math.round(days)} jours` : "moins de 2 jours"}.</p>
      <div className="hero" style={{ marginTop: 18 }}>
        <Ring values={values} total={total} base={base} scale={scale} />
        <Legend values={values} base={baseValues} subtitles={subtitles} />
      </div>
    </section>
  );
}
