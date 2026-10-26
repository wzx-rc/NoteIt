/* Pokédex: the harmony module of the "Pokédex chromatique" board. The device is the painted one of the concept
   (assets/roue-harmonie.webp, the kit's harmony wheel emptied of its colour stones). A thin hue ring is laid over its
   painted ring so that each stone sits on its own hue: red at the top, the hues turning clockwise. The stones are the
   colours of the harmony (the first one, the base, is the biggest), joined to the steel hub by fine cream rods; the
   modes sit on the cream bar under the device, with the painted node icons of the concept. Same contract as the base
   module: colours carry data-c, modes data-hm (see harmony in THEME_BASE). */
const PKH = { W: 300, H: 317, CX: .5333, CY: .4944, R: .2724, HUB: .125 };
function pkHarmony({ base, mode, modes, hues, cols, bs }) {
  const { W, H } = PKH, cx = PKH.CX * W, cy = PKH.CY * H, R = PKH.R * W, hub = PKH.HUB * W, f = v => v.toFixed(1);
  const at = (deg, r) => { const a = (deg - 90) * Math.PI / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  let ring = '';
  for (let i = 0; i < 72; i++) { const [x0, y0] = at(i * 5 - .4, R), [x1, y1] = at(i * 5 + 5.4, R); ring += `<path d="M${f(x0)} ${f(y0)}A${f(R)} ${f(R)} 0 0 1 ${f(x1)} ${f(y1)}" stroke="${hexv(i * 5, .72, .9)}"/>`; }
  const stones = hues.map((hu, i) => {
    const c = cols[i] || base, rr = i ? 18 : 22, [x, y] = at(hu, R), [hx, hy] = at(hu, hub + 4), [mx, my] = at(hu, R - rr - 6);
    return `<line x1="${f(hx)}" y1="${f(hy)}" x2="${f(mx)}" y2="${f(my)}" class="pkh-rod"/><circle cx="${f(mx)}" cy="${f(my)}" r="3.2" class="pkh-pin"/>
      <g class="pkh-stone" data-c="${c}" tabindex="0" role="button" aria-label="${c}"><title>${c}</title><circle cx="${f(x)}" cy="${f(y)}" r="${rr}" fill="${c}"/><circle cx="${f(x)}" cy="${f(y)}" r="${rr}" fill="url(#pkhGloss)" class="pkh-gloss"/></g>`;
  }).join('');
  const label = { comp: 'Complémentaire', analog: 'Analogue', triad: 'Triade', tetra: 'Tétradique', mono: 'Mono' };
  return `<div class="harm pkh"><div class="pkh-dev"><img src="asset:roue-harmonie.webp" alt="" draggable="false">
      <svg viewBox="0 0 ${W} ${H}" aria-label="Harmonie des couleurs"><defs><radialGradient id="pkhGloss" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".28" stop-color="#fff" stop-opacity=".12"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient></defs>
        <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" class="pkh-bed"/><g class="pkh-ring">${ring}</g>${stones}</svg></div>
    <div class="harm-modes pkh-modes">${modes.map(([k, l]) => `<button data-hm="${k}" aria-pressed="${mode === k}" title="${l}">${icon('hm-' + k)}<span>${label[k] || l}</span></button>`).join('')}</div></div>
    <div class="harm-row">${cols.map((c, i) => blob(c, i)).join('')}</div>`;
}
