import { useMemo, useState } from "react";
import { summarizeDeliveries, type NpcSummary } from "../../core/deliveries";
import { TicketGoal } from "./TicketGoal";
import type { AppState } from "../../shared/types";
import { Icon } from "../icons";
import { fmt, itemList, nf, npcName, signed, usd } from "../format";

const DAY = 86_400_000;

/** Cost of the chapter's ticket deliveries, all of them or a chosen set, plus the margin of paid deliveries. */
export function DeliveriesView({ state }: { state: AppState }) {
  const farm = state.farm!, market = state.market!;
  const now = state.fetchedAt ? Date.parse(state.fetchedAt) : Date.now();
  const { chapter, npcs } = useMemo(() => summarizeDeliveries(state.orders, farm, market, now), [state.orders, farm, market, now]);
  const rate = market.flowerUsd;
  const ticketNpcs = npcs.filter((n) => n.kind === "tickets" && n.tickets > 0).sort((a, b) => a.cost / a.tickets - b.cost / b.tickets);
  const paid = npcs.filter((n) => n.kind !== "tickets").sort((a, b) => (b.reward - b.cost) - (a.reward - a.cost));
  const [off, setOff] = useState<Set<string>>(new Set());
  const chosen = ticketNpcs.filter((n) => !off.has(n.npc));
  const toggle = (npc: string) => setOff((s) => { const n = new Set(s); n.has(npc) ? n.delete(npc) : n.add(npc); return n; });
  const avgPerTicket = ticketNpcs.reduce((a, n) => a + n.cost, 0) / Math.max(1, ticketNpcs.reduce((a, n) => a + n.tickets, 0));

  // One ticket delivery per NPC and per day, frozen from the chapter start to the second Monday.
  const dayCost = chosen.reduce((a, n) => a + n.cost, 0);
  const dayTickets = chosen.reduce((a, n) => a + n.tickets, 0);
  const days = chapter?.ticketDays ?? 84, left = chapter?.ticketDaysLeft ?? days;
  const samples = state.orders.length;
  const since = state.orders.length ? Math.min(...state.orders.map((o) => o.createdAt)) : now;
  const unknown = [...new Set(npcs.flatMap((n) => n.unknown))];

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="l">Saison en cours</div>
          <div className="v">{chapter?.name ?? "Hors saison"}</div>
          <div className="d dim">{chapter ? `${left} jour${left > 1 ? "s" : ""} de livraisons restant${left > 1 ? "s" : ""} sur ${days}` : ""}</div>
        </div>
        <div className="kpi">
          <div className="l">Toute la saison, ta sélection</div>
          <div className="v gold">{usd(dayCost * days * rate)}</div>
          <div className="d dim">{nf(dayCost * days)} FLOWER pour {nf(dayTickets * days)} tickets, hors doubles</div>
        </div>
        <div className="kpi">
          <div className="l">D'ici la fin de la saison</div>
          <div className="v">{usd(dayCost * left * rate)}</div>
          <div className="d dim">{usd(dayCost * rate)} par jour, {nf(dayTickets)} tickets</div>
        </div>
      </div>

      <div className="grid">
        <section className="card" aria-labelledby="h-tix">
          <h2 id="h-tix">Livraisons à tickets</h2>
          <p className="hint">Une par personnage et par jour. Coût moyen des objets demandés, au prix du marché d'aujourd'hui. Coche celles que tu fais.</p>
          <div className="seg" role="group" aria-label="Sélection rapide">
            <button className="btn" onClick={() => setOff(new Set())}>Toutes</button>
            <button className="btn" onClick={() => setOff(new Set(ticketNpcs.filter((n) => n.cost / n.tickets > avgPerTicket).map((n) => n.npc)))}>Les moins chères par ticket</button>
            <button className="btn" onClick={() => setOff(new Set(ticketNpcs.map((n) => n.npc)))}>Aucune</button>
          </div>
          <div className="sim">
            {ticketNpcs.map((n) => <NpcToggle key={n.npc} n={n} on={!off.has(n.npc)} toggle={() => toggle(n.npc)} rate={rate} />)}
            {ticketNpcs.length === 0 ? <p className="empty">Aucune commande à tickets vue pour l'instant.</p> : null}
          </div>
        </section>

        <section className="card stat" aria-labelledby="h-pt">
          <h2 id="h-pt">Prix d'un ticket</h2>
          <p className="hint">Ce que coûte un ticket chez chaque personnage. Moyenne de toutes les livraisons à tickets : {fmt(avgPerTicket * rate, 3)} $.</p>
          <div className="big">{dayTickets ? fmt((dayCost / dayTickets) * rate, 3) : "0"} $ <small className="unit">par ticket, ta sélection</small></div>
          <div className="bars">
            {ticketNpcs.map((n) => {
              const per = n.cost / n.tickets;
              const max = Math.max(...ticketNpcs.map((x) => x.cost / x.tickets));
              return (
                <div className="br" key={n.npc} style={{ opacity: off.has(n.npc) ? 0.45 : 1 }}>
                  <span className="lb"><Icon name="ticket" size={18} />{npcName(n.npc)}</span>
                  <span className="tr"><b style={{ left: 0, width: `${(per / max) * 100}%`, background: per <= avgPerTicket * 0.6 ? "var(--sheep)" : per <= avgPerTicket * 1.4 ? "var(--gold)" : "var(--loss)" }} /></span>
                  <span className="n">{fmt(per * rate, 3)} $</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <TicketGoal farm={farm} now={now} npcs={ticketNpcs} rate={rate} />

      <section className="card stat" aria-labelledby="h-paid">
        <h2 id="h-paid">Livraisons payées</h2>
        <p className="hint">Personnages qui paient en coins ou en FLOWER. Gain moyen par livraison, une fois les objets payés au prix du marché. Les coins comptent 320 pour 1 FLOWER, le taux de la banque.</p>
        <div className="bars wide">
          {paid.map((n) => {
            const m = (n.reward - n.cost) * rate;
            const lim = Math.max(0.01, ...paid.map((x) => Math.abs(x.reward - x.cost) * rate)) * 1.05;
            const w = (Math.abs(m) / lim) * 50;
            return (
              <div className="br" key={n.npc}>
                <span className="lb"><Icon name={n.kind === "flower" ? "flower" : "coins"} size={18} />{npcName(n.npc)}</span>
                <span className="tr">
                  <span className="axis" style={{ left: "50%" }} />
                  <b style={{ left: `${m < 0 ? 50 - w : 50}%`, width: `${w}%`, background: m < 0 ? "var(--loss)" : "var(--sheep)" }} />
                </span>
                <span className={"n" + (m < 0 ? " loss" : "")}>{signed(m)} $</span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="foot">
        Moyenne sur {samples} commandes vues depuis le {new Date(since).toLocaleDateString("fr-FR")}
        {now - since < 21 * DAY ? ", la moyenne s'affine au fil des semaines" : ""}. Poissons et prises de casiers estimés au coût d'une canne ou d'un casier.
        {unknown.length ? ` Sans prix, comptés 0 : ${unknown.join(", ")}.` : ""} Une * signale un coût en partie estimé. Les jours de double livraison doublent les tickets sans coûter plus.
      </p>
    </>
  );
}

function NpcToggle({ n, on, toggle, rate }: { n: NpcSummary; on: boolean; toggle: () => void; rate: number }) {
  return (
    <button className="toggle" aria-pressed={on} onClick={toggle}>
      <span className="sw" aria-hidden="true" />
      <span className="chip"><Icon name="ticket" label="Tickets" /></span>
      <span className="t">
        <b>{npcName(n.npc)}</b>
        <span>{n.current ? `En cours : ${itemList(n.current.items)}` : `${n.samples} commande${n.samples > 1 ? "s" : ""} vue${n.samples > 1 ? "s" : ""}`}</span>
      </span>
      <span className="g">
        <b>{usd(n.cost * rate)}{n.estimated ? "*" : ""}</b>
        <span>{n.tickets} tickets</span>
      </span>
    </button>
  );
}
