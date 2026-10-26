/* Pokédex: the note cards of the "Notédex" concept. Each card is a cream index card whose tab takes the colour of
   its space, the nearest of the six painted ones (rouge, jaune, verte, bleue, violette, grise). */
function pkTint(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 'grise';
  const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d || d / mx < .28) return 'grise';
  const h = (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return h < 18 || h >= 330 ? 'rouge' : h < 70 ? 'jaune' : h < 190 ? 'verte' : h < 255 ? 'bleue' : 'violette';
}
const pkDocAttrs = (d, sp) => `data-tint="${pkTint(sp && sp.color)}"${sp ? ` data-tag="#${esc(sp.name.toLowerCase().replace(/\s+/g, ''))}"` : ''}`;
