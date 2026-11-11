import { Icon } from "../icons";

const LINKS = [
  { href: "https://sunflower-land.com/play/", label: "Ouvrir le jeu", sub: "sunflower-land.com", icon: "play", primary: true },
  { href: "https://sunflower-land.com/play/#/marketplace", label: "Marketplace", sub: "prix et offres", icon: "market" },
  { href: "https://claude.ai/artifact/M9VxjQE4Q7pyTRYCHmeZ88", label: "Rapport détaillé", sub: "tableaux complets", icon: "doc" },
  { href: "https://sunflower-land.com/community-docs", label: "API Community", sub: "doc et clé", icon: "code" },
];

export function Shortcuts({ fetchedAt }: { fetchedAt?: string }) {
  const at = fetchedAt ? new Date(fetchedAt) : null;
  return (
    <section className="card">
      <h2>Raccourcis</h2>
      <div className="links">
        {LINKS.map((l) => (
          <a key={l.href} className={l.primary ? "primary" : undefined} href={l.href} target="_blank" rel="noopener noreferrer">
            <span className="ll"><Icon name={l.icon} size={18} />{l.label}</span> <span>{l.sub}</span>
          </a>
        ))}
      </div>
      <p className="foot">
        {at ? `Mis à jour le ${at.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. ` : ""}
        Outil perso, non officiel.
      </p>
    </section>
  );
}
