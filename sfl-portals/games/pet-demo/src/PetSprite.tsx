/**
 * Pet provisoire dessiné en SVG « pixel » (création originale, sans art du jeu).
 * À remplacer par les sprites définitifs.
 */
const FACES: Record<string, { eyes: string; mouth: string }> = {
  ravi: { eyes: "M9 9h2v1H9zM15 9h2v1h-2z", mouth: "M10 13h6v1h-1v1h-4v-1h-1z" },
  content: { eyes: "M9 8h2v2H9zM15 8h2v2h-2z", mouth: "M11 13h4v1h-4z" },
  grognon: { eyes: "M9 9h2v1H9zM15 9h2v1h-2z", mouth: "M11 14h4v1h-4zM10 15h1v1h-1zM15 15h1v1h-1z" },
  "affamé": { eyes: "M9 8h2v2H9zM15 8h2v2h-2z", mouth: "M11 13h4v3h-4z" },
};

export function PetSprite({ mood }: { mood: string }) {
  const face = FACES[mood] ?? FACES.content;
  return (
    <svg className={`pet pet-${mood}`} viewBox="0 0 26 24" shapeRendering="crispEdges" role="img" aria-label={`Pet ${mood}`}>
      {/* feuilles */}
      <path d="M12 0h2v4h-2z" fill="#4f7a2c" />
      <path d="M8 1h4v2H8zM14 1h4v2h-4z" fill="#79b04a" />
      {/* corps */}
      <path d="M7 4h12v1h2v2h1v10h-1v2h-2v1H7v-1H5v-2H4V7h1V5h2z" fill="#e9b45a" />
      <path d="M7 4h12v1H7zM5 5h2v2H5zM19 5h2v2h-2z" fill="#f4cf82" />
      <path d="M4 15h1v2h2v2h12v-2h2v-2h1v2h-1v2h-2v1H7v-1H5v-2H4z" fill="#c78a3a" />
      {/* joues */}
      <path d="M7 11h2v1H7zM17 11h2v1h-2z" fill="#e88a6a" />
      {/* visage */}
      <path d={face.eyes} fill="#3b2a1a" />
      <path d={face.mouth} fill="#3b2a1a" />
      {/* pattes */}
      <path d="M8 20h3v2H8zM15 20h3v2h-3z" fill="#c78a3a" />
    </svg>
  );
}
