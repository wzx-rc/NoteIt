import type { ReactElement } from "react";

/**
 * Harvest Desk's own icons, drawn for this app on a 24 px grid.
 * The game's sprites are not licensed for reuse, so none are bundled here.
 */
const ICONS: Record<string, ReactElement> = {
  logo: (
    <g>
      <circle cx="12" cy="12" r="4" fill="#2a1d10" />
      <g stroke="#2a1d10" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </g>
    </g>
  ),
  flower: (
    <g>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx="12" cy="6.5" rx="3" ry="4.2" fill="#f2bf45" transform={`rotate(${a} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="3.4" fill="#7a4a1f" />
    </g>
  ),
  wheat: (
    <g>
      <path d="M12 22V6" stroke="#b07a3a" strokeWidth="1.6" strokeLinecap="round" />
      {[7, 11, 15].map((y) => (
        <g key={y}>
          <ellipse cx="9.3" cy={y} rx="2" ry="3.2" fill="#e0a85c" transform={`rotate(-30 9.3 ${y})`} />
          <ellipse cx="14.7" cy={y} rx="2" ry="3.2" fill="#f2bf45" transform={`rotate(30 14.7 ${y})`} />
        </g>
      ))}
      <ellipse cx="12" cy="4" rx="1.8" ry="2.8" fill="#f2bf45" />
    </g>
  ),
  sheep: (
    <g>
      <path d="M8 17v4M15 17v4" stroke="#3a2a2f" strokeWidth="1.8" strokeLinecap="round" />
      <g fill="#f3e6d2">
        <circle cx="8" cy="12" r="4" /><circle cx="12" cy="10" r="4.5" /><circle cx="16" cy="12.5" r="4" /><circle cx="11.5" cy="15" r="4" />
      </g>
      <ellipse cx="19" cy="9.5" rx="2.6" ry="3.2" fill="#3a2a2f" />
      <circle cx="19.8" cy="9" r=".7" fill="#f3e6d2" />
    </g>
  ),
  rice: (
    <g>
      <path d="M5 14h14l-2 7H7z" fill="#55a99d" />
      <path d="M12 14V5" stroke="#86b86a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zM12 11c3 0 5-2 5-5-3 0-5 2-5 5z" fill="#86b86a" />
    </g>
  ),
  gold: (
    <g>
      <path d="M4 16l3-7 6-3 6 4 1 6-6 3H8z" fill="#f2bf45" />
      <path d="M7 9l6-3 2 5-6 2z" fill="#ffe08a" />
      <path d="M9 13l6-2 5 5" fill="none" stroke="#b8862a" strokeWidth="1" />
    </g>
  ),
  iron: (
    <g>
      <path d="M4 16l3-7 6-3 6 4 1 6-6 3H8z" fill="#8d9fb8" />
      <path d="M7 9l6-3 2 5-6 2z" fill="#c4d0e0" />
      <path d="M9 13l6-2 5 5" fill="none" stroke="#5d6b80" strokeWidth="1" />
    </g>
  ),
  crim: (
    <g>
      <path d="M12 3l7 6-7 12-7-12z" fill="#e2685a" />
      <path d="M5 9h14M12 3l-3 6 3 12 3-12z" fill="none" stroke="#ffb0a5" strokeWidth="1" strokeLinejoin="round" />
    </g>
  ),
  pick: (
    <g>
      <path d="M8 16l-4 5" stroke="#b07a3a" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 9c4-5 11-6 18-3-5-1-9 0-12 3l4 4-3 3-4-4c-1 0-2 0-3-3z" fill="#b5a9a0" />
      <path d="M14 6l4 4" stroke="#b07a3a" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  ),
  quarry: (
    <g>
      <rect x="3" y="14" width="8" height="6" rx="1.2" fill="#8d9fb8" />
      <rect x="12" y="14" width="9" height="6" rx="1.2" fill="#a9b6c8" />
      <rect x="7" y="7" width="9" height="6" rx="1.2" fill="#c4d0e0" />
      <path d="M17 3l3 3-5 5" stroke="#f2bf45" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </g>
  ),
  kuebiko: (
    <g>
      <path d="M12 9v13M5 12h14" stroke="#b07a3a" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 11h8l-1 7H9z" fill="#55a99d" />
      <circle cx="12" cy="7" r="3.2" fill="#e0a85c" />
      <path d="M6.5 5h11L14 2h-4z" fill="#6b4a2e" />
      <path d="M5 12l-1.5 2M19 12l1.5 2" stroke="#f2bf45" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  ),
  hoot: (
    <g>
      <ellipse cx="12" cy="13.5" rx="7" ry="8" fill="#9a6a45" />
      <ellipse cx="12" cy="16" rx="4" ry="4.5" fill="#e0a85c" />
      <path d="M5.5 7l2 3M18.5 7l-2 3" stroke="#9a6a45" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="9.2" cy="11" r="2.4" fill="#f3e6d2" /><circle cx="14.8" cy="11" r="2.4" fill="#f3e6d2" />
      <circle cx="9.2" cy="11" r="1.1" fill="#1b1416" /><circle cx="14.8" cy="11" r="1.1" fill="#1b1416" />
      <path d="M11 13.5h2l-1 1.6z" fill="#f2bf45" />
    </g>
  ),
  mermaid: (
    <g>
      <path d="M15 15c3 0 4 2 6 1-1 3-3 4-6 3" fill="#55a99d" />
      <g fill="#f3e6d2"><circle cx="7" cy="12" r="3.6" /><circle cx="11" cy="10.5" r="4" /><circle cx="14" cy="13" r="3.6" /><circle cx="10" cy="15" r="3.6" /></g>
      <ellipse cx="4.5" cy="9.5" rx="2.3" ry="2.9" fill="#3a2a2f" />
      <path d="M8 19c2 1.5 4 1.5 6 0" stroke="#55a99d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  ),
  lightning: <path d="M13 2L5 13.5h6L10 22l9-12h-6.2z" fill="#f2bf45" />,
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  market: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M4 10v10h16V10" /><path d="M3 4h18l-1.5 6a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0z" /><path d="M10 20v-5h4v5" />
    </g>
  ),
  doc: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" />
    </g>
  ),
  code: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
    </g>
  ),
  // Rail (line icons, follow currentColor)
  revenue: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  timers: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" />
    </g>
  ),
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  settings: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
    </g>
  ),
  refresh: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </g>
  ),
};

export function Icon({ name, size = 22, label }: { name: string; size?: number; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role={label ? "img" : undefined}
      aria-label={label} aria-hidden={label ? undefined : true}>
      {ICONS[name] ?? ICONS.flower}
    </svg>
  );
}
