/* ================= UI Design (0.2.38) =================
   A zone of the board (a frame with `ui`) where software interfaces are laid out from blocks: windows, docked panels,
   inspectors, trees, timelines, fields… Each block is an item { k: 'uic', t: <type>, txt, v }, drawn here as plain HTML
   whose look follows the zone's rendering (sketch, wireframe, or the dark "theme" tokens). Its words live in it.txt,
   one line per row; each type reads its lines its own way (see UIKIT[t].hint). */
const UI_FIDS = [['sketch', 'Croquis'], ['wire', 'Wireframe'], ['theme', 'Thème']];
const UI_CATS = ['Fenêtre', 'Commandes', 'Données', 'Saisie', 'Vues', 'Retour'];
/* t: [category, name, w, h, default text, hint for the text editor, dock sides it accepts] */
const UIKIT = {};
[
  ['window', 0, 'Fenêtre', 960, 600, 'WZX Engine · Niveau_01\nFichier|Édition|Vue|Objet|Rendu|Aide\nPrêt|128 objets · 60 i/s', 'Ligne 1 : titre · ligne 2 : menus séparés par | · ligne 3 : barre d’état (gauche|droite)'],
  ['dialog', 0, 'Dialogue', 420, 230, 'Exporter la scène\nChoisissez le format et le dossier d’export.\nAnnuler|Exporter', 'Titre · texte · boutons séparés par | (le dernier est le principal)'],
  ['panel', 0, 'Panneau', 260, 360, 'Hiérarchie|Calques', 'Onglets séparés par | (le premier est actif)', 'lrtbc'],
  ['menubar', 0, 'Barre de menus', 480, 24, 'Fichier|Édition|Vue|Aide', 'Menus séparés par |', 't'],
  ['tabs', 0, 'Onglets', 320, 28, 'Console|Assets|Timeline', 'Onglets séparés par | (* devant : actif)'],
  ['statusbar', 0, 'Barre d’état', 480, 22, 'Prêt|128 objets', 'Gauche|droite', 'b'],
  ['splitter', 0, 'Séparateur', 6, 240, '', ''],
  ['toolbar', 1, 'Barre d’outils', 520, 36, 'Déplacer|Tourner|Échelle', 'Groupe segmenté séparé par | (le premier est actif)', 't'],
  ['button', 1, 'Bouton', 104, 28, 'Valider', 'Libellé'],
  ['iconbtn', 1, 'Bouton icône', 28, 28, '', ''],
  ['segmented', 1, 'Groupe segmenté', 220, 28, 'Déplacer|Tourner|Échelle', 'Choix séparés par | (* devant : actif)'],
  ['menu', 1, 'Menu', 220, 190, 'Nouveau|Ctrl N\nOuvrir…|Ctrl O\nEnregistrer|Ctrl S\n-\n*Exporter…|Ctrl E\n-\nQuitter|Alt F4', 'Une ligne par entrée : libellé|raccourci · - : séparateur · * devant : survolée'],
  ['ctxmenu', 1, 'Menu contextuel', 180, 150, 'Couper\nCopier\nColler\n-\nSupprimer', 'Une ligne par entrée · - : séparateur'],
  ['cmdpal', 1, 'Palette de commandes', 380, 190, 'Rechercher une commande…\n*Ouvrir le projet\nExporter la scène\nBasculer la grille\nRecharger les shaders', 'Ligne 1 : champ · puis une commande par ligne (* : choisie)'],
  ['tree', 2, 'Arborescence', 240, 280, 'Scène\n Caméra principale\n Lumière soleil\n Bâtiments\n  *Maison_01\n  Maison_02\n Végétation\n PNJ', 'Une ligne par nœud · espaces devant : niveau · * : sélectionné', 'lrc'],
  ['inspector', 2, 'Inspecteur', 280, 320, 'Maison_01\n#Transformation\nPosition|12|0|-4,5\nRotation|0|35|0\nÉchelle|1|1|1\n#Matériau\nShader:Standard PBR\nRugosité~0,62\nMétal~0,10\n[x] Projette des ombres', 'Ligne 1 : nom · #Section · Nom|x|y|z · Nom:valeur · Nom~0,5 (curseur) · [x] case', 'lrc'],
  ['table', 2, 'Tableau', 380, 200, 'Nom|Type|Taille\nMaison_01|Mesh|2,4 Mo\nGrange|Mesh|1,1 Mo\nSoleil|Lumière|—', 'Ligne 1 : en-têtes · une ligne par rangée, colonnes séparées par |', 'lrbc'],
  ['console', 2, 'Console', 420, 160, '> Build terminé en 2,3 s\n! 2 textures manquantes\n> 128 objets chargés', '> message · ! avertissement · x erreur', 'bc'],
  ['assets', 2, 'Liste d’assets', 380, 220, 'Bois\nPierre\nTuiles\nHerbe\nEau\nSable', 'Un asset par ligne', 'lrbc'],
  ['breadcrumb', 2, 'Fil d’Ariane', 260, 22, 'Projet›Niveaux›Niveau_01', 'Étapes séparées par ›'],
  ['label', 2, 'Libellé', 160, 20, 'Libellé', 'Texte'],
  ['title', 2, 'Titre de section', 220, 28, 'Titre de section', 'Texte'],
  ['field', 3, 'Champ texte', 220, 26, 'Nom:Maison_01', 'Libellé:valeur'],
  ['number', 3, 'Champ numérique', 140, 24, 'Taille:1,00', 'Libellé:valeur'],
  ['xyz', 3, 'Champ XYZ', 280, 24, 'Position|12|0|-4,5', 'Libellé|x|y|z'],
  ['slider', 3, 'Curseur', 220, 22, 'Opacité~0,62', 'Libellé~valeur entre 0 et 1'],
  ['color', 3, 'Couleur', 220, 26, 'Couleur:#C98B62', 'Libellé:#hex'],
  ['dropdown', 3, 'Liste déroulante', 220, 26, 'Shader:Standard PBR', 'Libellé:valeur'],
  ['checkbox', 3, 'Case à cocher', 180, 20, '[x] Projette des ombres', '[x] ou [ ] puis le libellé'],
  ['toggle', 3, 'Interrupteur', 160, 22, '[x] Grille', '[x] ou [ ] puis le libellé'],
  ['path', 3, 'Chemin de fichier', 320, 26, 'D:/Export/Niveau_01|Parcourir…', 'Chemin|bouton'],
  ['curve', 3, 'Éditeur de courbe', 240, 150, 'Accélération', 'Titre'],
  ['viewport', 4, 'Viewport 3D', 480, 300, 'Perspective · Éclairé', 'Libellé de la vue', 'c'],
  ['timeline', 4, 'Timeline', 600, 180, 'Caméra\nSoleil\nMaison_01\nPNJ', 'Une piste par ligne', 'bc'],
  ['nodes', 4, 'Graphe de nœuds', 420, 260, 'Texture|Mélange|Sortie', 'Nœuds séparés par |', 'c'],
  ['canvas2d', 4, 'Canvas 2D', 360, 240, 'Canvas 2D', 'Libellé', 'c'],
  ['histogram', 4, 'Histogramme', 240, 120, 'Histogramme', 'Titre'],
  ['gizmo', 4, 'Gizmo d’axes', 64, 64, '', ''],
  ['toast', 5, 'Notification', 280, 44, 'Scène enregistrée', 'Message'],
  ['progress', 5, 'Barre de progression', 240, 30, 'Export…~0,62', 'Libellé~valeur entre 0 et 1'],
  ['badge', 5, 'Badge', 44, 20, '3', 'Texte'],
  ['alert', 5, 'Alerte', 340, 140, 'Fichier modifié\nEnregistrer les changements avant de fermer ?\nNe pas enregistrer|Annuler|Enregistrer', 'Titre · message · boutons séparés par |'],
  ['spinner', 5, 'Chargement', 36, 36, '', ''],
  ['empty', 5, 'État vide', 260, 170, 'Aucun objet\nGlissez un modèle ici', 'Titre · aide']
].forEach(([t, c, name, w, h, txt, hint, dock]) => { UIKIT[t] = { t, cat: UI_CATS[c], name, w, h, txt, hint, dock: dock || '' }; });
const UI_CONTAINERS = ['window', 'dialog', 'panel'];
/* the part of a window that panels dock into: under the title and menu bars, above the status bar */
const UI_WIN_TOP = 52, UI_WIN_BOT = 22;
const mkUic = (t, x, y) => { const d = UIKIT[t]; return { id: uid('u'), k: 'uic', t, x: Math.round(x / 4) * 4, y: Math.round(y / 4) * 4, w: d.w, h: d.h, txt: d.txt }; };

/* ---------- drawing the blocks ---------- */
const ukLines = it => String(it.txt ?? '').split('\n');
const ukNum = s => { const v = parseFloat(String(s || '').replace(',', '.')); return isFinite(v) ? clamp(v, 0, 1) : .5; };
const ukChk = s => /^\s*\[[xX✓]\]/.test(s), ukUnchk = s => String(s).replace(/^\s*\[[ xX✓]?\]\s*/, '');
const ukStar = s => /^\s*\*/.test(s), ukUnstar = s => String(s).replace(/^\s*\*\s*/, '');
const ukBtns = (list, cls = '') => list.map((b, i) => `<span class="uk-btn${i === list.length - 1 ? ' pri' : ''} ${cls}" data-ukbtn="1">${esc(b.trim())}</span>`).join('');
const ukRow = (l) => {   // one line of an inspector-like list
  if (/^#/.test(l)) return `<div class="uk-sec">${esc(l.slice(1))}</div>`;
  if (/^\s*\[[ xX✓]?\]/.test(l)) return `<div class="uk-r"><i class="uk-cb${ukChk(l) ? ' on' : ''}"></i><span>${esc(ukUnchk(l))}</span></div>`;
  const p = l.split('|');
  if (p.length >= 4) return `<div class="uk-r"><span class="uk-l">${esc(p[0])}</span><span class="uk-n x">${esc(p[1])}</span><span class="uk-n y">${esc(p[2])}</span><span class="uk-n z">${esc(p[3])}</span></div>`;
  const sl = l.indexOf('~'); if (sl > 0) { const v = ukNum(l.slice(sl + 1)); return `<div class="uk-r"><span class="uk-l">${esc(l.slice(0, sl))}</span><span class="uk-tr"><i style="width:${(v * 100).toFixed(0)}%"></i></span><span class="uk-v">${esc(l.slice(sl + 1).trim())}</span></div>`; }
  const c = l.indexOf(':'); if (c > 0) { const v = l.slice(c + 1).trim(), col = /^#[0-9a-f]{3,8}$/i.test(v); return `<div class="uk-r"><span class="uk-l">${esc(l.slice(0, c))}</span>${col ? `<i class="uk-sw" style="background:${v}"></i>` : ''}<span class="uk-f${/^\S+ ?▾?$/.test(v) || !col ? '' : ''}">${esc(v)}</span></div>`; }
  return l.trim() ? `<div class="uk-r"><span>${esc(l)}</span></div>` : '';
};
const ukLabeled = (l, inner) => { const c = l.indexOf(':'); return c > 0 ? `<span class="uk-l">${esc(l.slice(0, c))}</span>${inner(l.slice(c + 1).trim())}` : inner(l.trim()); };
function uicHTML(it) {
  const L = ukLines(it), a = L[0] || '';
  switch (it.t) {
    case 'window': {
      const menus = (L[1] || '').split('|').filter(Boolean), st = (L[2] || '').split('|');
      return `<div class="uk-win"><div class="uk-tb"><i class="uk-logo"></i><span class="uk-tt">${esc(a)}</span><span class="uk-wc"><i></i><i></i><i></i></span></div><div class="uk-mb">${menus.map(m => `<span>${esc(m)}</span>`).join('')}</div><div class="uk-wb"></div><div class="uk-sb"><span>${esc(st[0] || '')}</span><span>${esc(st[1] || '')}</span></div></div>`;
    }
    case 'dialog': return `<div class="uk-dlg"><div class="uk-dh">${esc(a)}<i class="uk-x"></i></div><div class="uk-dt">${esc(L[1] || '')}</div><div class="uk-sp"></div><div class="uk-dbtn">${ukBtns((L[2] || 'OK').split('|'))}</div></div>`;
    case 'alert': return `<div class="uk-dlg uk-alert"><div class="uk-dh"><i class="uk-warn">!</i>${esc(a)}</div><div class="uk-dt">${esc(L[1] || '')}</div><div class="uk-sp"></div><div class="uk-dbtn">${ukBtns((L[2] || 'OK').split('|'))}</div></div>`;
    case 'panel': { const tabs = a.split('|').filter(Boolean); return `<div class="uk-pan"><div class="uk-tabs">${tabs.map((t, i) => `<span class="${i ? '' : 'on'}">${esc(t)}</span>`).join('')}<i class="uk-pm"></i></div><div class="uk-pb"></div></div>`; }
    case 'menubar': return `<div class="uk-mb solo">${a.split('|').map(m => `<span>${esc(m)}</span>`).join('')}</div>`;
    case 'tabs': { const t = a.split('|'), act = t.some(ukStar) ? t.findIndex(ukStar) : 0; return `<div class="uk-tabs solo">${t.map((s, i) => `<span class="${i === act ? 'on' : ''}">${esc(ukUnstar(s))}</span>`).join('')}</div>`; }
    case 'statusbar': { const p = a.split('|'); return `<div class="uk-sb solo"><span>${esc(p[0] || '')}</span><span>${esc(p[1] || '')}</span></div>`; }
    case 'splitter': return `<div class="uk-split"><i></i></div>`;
    case 'toolbar': { const s = a.split('|').filter(Boolean); return `<div class="uk-tool"><i class="uk-ib"></i><i class="uk-ib"></i><i class="uk-ib"></i><b class="uk-vs"></b><span class="uk-seg">${s.map((x, i) => `<span class="${i ? '' : 'on'}">${esc(x)}</span>`).join('')}</span><span class="uk-sp"></span><i class="uk-play"></i><span class="uk-sp"></span><span class="uk-dd">Perspective</span></div>`; }
    case 'button': return `<span class="uk-btn solo ${it.v || 'pri'}" data-ukbtn="1">${esc(a)}</span>`;
    case 'iconbtn': return `<i class="uk-ib solo"></i>`;
    case 'segmented': { const s = a.split('|'), act = s.some(ukStar) ? s.findIndex(ukStar) : 0; return `<span class="uk-seg solo">${s.map((x, i) => `<span class="${i === act ? 'on' : ''}">${esc(ukUnstar(x))}</span>`).join('')}</span>`; }
    case 'menu': case 'ctxmenu': return `<div class="uk-menu">${L.map(l => l.trim() === '-' ? '<i class="uk-ms"></i>' : (() => { const p = ukUnstar(l).split('|'); return `<div class="uk-mi${ukStar(l) ? ' on' : ''}"><span>${esc(p[0])}</span><small>${esc(p[1] || '')}</small></div>`; })()).join('')}</div>`;
    case 'cmdpal': return `<div class="uk-menu uk-pal"><div class="uk-q">${esc(a)}</div>${L.slice(1).map(l => `<div class="uk-mi${ukStar(l) ? ' on' : ''}"><span>${esc(ukUnstar(l))}</span></div>`).join('')}</div>`;
    case 'tree': return `<div class="uk-list uk-tree">${L.map(l => { const lv = (l.match(/^ */) || [''])[0].length, s = ukStar(l.trim()); return l.trim() ? `<div class="uk-tr${s ? ' on' : ''}" style="padding-left:${8 + lv * 14}px"><i class="uk-ti"></i>${esc(ukUnstar(l.trim()))}</div>` : ''; }).join('')}</div>`;
    case 'inspector': return `<div class="uk-list uk-insp"><div class="uk-r uk-name"><i class="uk-cb on"></i><span class="uk-f">${esc(a)}</span></div>${L.slice(1).map(ukRow).join('')}</div>`;
    case 'table': { const head = a.split('|'); return `<div class="uk-table"><div class="uk-th">${head.map(h => `<span>${esc(h)}</span>`).join('')}</div>${L.slice(1).map((l, i) => `<div class="uk-td${i === 0 ? ' on' : ''}">${l.split('|').map(c => `<span>${esc(c)}</span>`).join('')}</div>`).join('')}</div>`; }
    case 'console': return `<div class="uk-con">${L.map(l => `<div class="${/^!/.test(l) ? 'w' : /^x/i.test(l) ? 'e' : ''}">${esc(l)}</div>`).join('')}</div>`;
    case 'assets': return `<div class="uk-assets">${L.filter(s => s.trim()).map(s => `<div><i></i><span>${esc(s)}</span></div>`).join('')}</div>`;
    case 'breadcrumb': return `<div class="uk-bc">${a.split('›').map(s => `<span>${esc(s.trim())}</span>`).join('<b>›</b>')}</div>`;
    case 'label': return `<div class="uk-lab">${esc(a)}</div>`;
    case 'title': return `<div class="uk-ttl">${esc(a)}</div>`;
    case 'field': case 'number': return `<div class="uk-r solo">${ukLabeled(a, v => `<span class="uk-f${it.t === 'number' ? ' num' : ''}">${esc(v)}</span>`)}</div>`;
    case 'dropdown': return `<div class="uk-r solo">${ukLabeled(a, v => `<span class="uk-f dd">${esc(v)}</span>`)}</div>`;
    case 'color': return `<div class="uk-r solo">${ukLabeled(a, v => `<i class="uk-sw" style="background:${/^#[0-9a-f]{3,8}$/i.test(v) ? v : '#C98B62'}"></i><span class="uk-f">${esc(v)}</span>`)}</div>`;
    case 'xyz': case 'slider': return `<div class="solo-r">${ukRow(a)}</div>`;
    case 'checkbox': return `<div class="uk-r solo"><i class="uk-cb${ukChk(a) ? ' on' : ''}"></i><span>${esc(ukUnchk(a))}</span></div>`;
    case 'toggle': return `<div class="uk-r solo"><i class="uk-tg${ukChk(a) ? ' on' : ''}"><b></b></i><span>${esc(ukUnchk(a))}</span></div>`;
    case 'path': { const p = a.split('|'); return `<div class="uk-r solo"><span class="uk-f">${esc(p[0])}</span>${p[1] ? `<span class="uk-btn sec">${esc(p[1])}</span>` : ''}</div>`; }
    case 'curve': return `<div class="uk-box uk-curve"><div class="uk-bh">${esc(a)}</div><svg viewBox="0 0 100 60" preserveAspectRatio="none"><path d="M2 58 C 40 58, 45 4, 98 2" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg></div>`;
    case 'viewport': return `<div class="uk-vp"><span class="uk-vl">${esc(a)}</span><i class="uk-o o1"></i><i class="uk-o o2"></i><i class="uk-o o3"></i><i class="uk-gx"></i><i class="uk-gy"></i><span class="uk-axis">XYZ</span></div>`;
    case 'timeline': { const tr = L.filter(s => s.trim()); return `<div class="uk-tl"><div class="uk-tln"><div class="uk-rul"></div>${tr.map(t => `<div>${esc(t)}</div>`).join('')}</div><div class="uk-tlb"><div class="uk-rul g"></div>${tr.map((t, i) => `<div><i style="left:${(8 + i * 17) % 60}%;width:${22 + (i * 13) % 30}%"></i></div>`).join('')}<b class="uk-ph"></b></div></div>`; }
    case 'nodes': { const n = a.split('|').filter(Boolean); return `<div class="uk-nodes">${n.map((s, i) => `<div class="uk-node" style="left:${6 + i * (88 / Math.max(1, n.length)) }%;top:${i % 2 ? 46 : 18}%"><b>${esc(s)}</b><i></i><i></i></div>`).join('')}<svg viewBox="0 0 100 100" preserveAspectRatio="none">${n.slice(1).map((s, i) => { const x0 = 6 + i * (88 / n.length) + 22, x1 = 6 + (i + 1) * (88 / n.length), y0 = i % 2 ? 58 : 30, y1 = (i + 1) % 2 ? 58 : 30; return `<path d="M${x0} ${y0} C ${x0 + 8} ${y0}, ${x1 - 8} ${y1}, ${x1} ${y1}" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke"/>`; }).join('')}</svg></div>`; }
    case 'canvas2d': return `<div class="uk-box uk-c2d"><span class="uk-vl">${esc(a)}</span></div>`;
    case 'histogram': return `<div class="uk-box uk-hist"><div class="uk-bh">${esc(a)}</div><div class="uk-bars">${[22, 38, 55, 70, 62, 80, 58, 44, 30, 46, 64, 36].map(h => `<i style="height:${h}%"></i>`).join('')}</div></div>`;
    case 'gizmo': return `<div class="uk-giz"><i class="x"></i><i class="y"></i><i class="z"></i></div>`;
    case 'toast': return `<div class="uk-toast"><i class="uk-cb on"></i><span>${esc(a)}</span></div>`;
    case 'progress': { const sl = a.indexOf('~'), v = sl > 0 ? ukNum(a.slice(sl + 1)) : .5; return `<div class="uk-prog"><span>${esc(sl > 0 ? a.slice(0, sl) : a)}<b>${Math.round(v * 100)} %</b></span><span class="uk-tr"><i style="width:${(v * 100).toFixed(0)}%"></i></span></div>`; }
    case 'badge': return `<span class="uk-badge">${esc(a)}</span>`;
    case 'spinner': return `<i class="uk-spin"></i>`;
    case 'empty': return `<div class="uk-empty"><i></i><b>${esc(a)}</b><span>${esc(L[1] || '')}</span></div>`;
  }
  return `<div class="uk-box"></div>`;
}
/* the library tile: a small picture of the block */
function uicThumb(t) {
  const it = { t, txt: UIKIT[t].txt, w: UIKIT[t].w, h: UIKIT[t].h }, W = 96, H = 52, s = Math.min(W / it.w, H / it.h, 1);
  return `<span class="uk-thumb uic uf-wire" style="width:${it.w}px;height:${it.h}px;left:${((W - it.w * s) / 2).toFixed(1)}px;top:${((H - it.h * s) / 2).toFixed(1)}px;transform:scale(${s.toFixed(3)})">${uicHTML(it)}</span>`;
}

/* ---------- docking: panels snap to a side of a window and share it ---------- */
/* where a block dropped at (px, py) would dock in window W: 't' 'l' 'r' 'b' 'c', or null */
function uiDockSide(it, W, px, py) {
  const d = UIKIT[it.t]; if (!d || !d.dock || !W) return null;
  const top = W.y + UI_WIN_TOP, bot = W.y + W.h - UI_WIN_BOT; if (!inBox(px, py, [W.x, top, W.x + W.w, bot])) return null;
  const fx = (px - W.x) / W.w, fy = (py - top) / Math.max(1, bot - top), ok = s => d.dock.includes(s);
  if (fy < .18 && ok('t')) return 't';
  if (fx < .26 && ok('l')) return 'l';
  if (fx > .74 && ok('r')) return 'r';
  if (fy > .7 && ok('b')) return 'b';
  if (ok('c')) return 'c';
  return ok('b') ? 'b' : ok('l') ? 'l' : null;
}
/* lays out every docked block of every window: top bars, then bottom docks, then left / right columns, the centre takes what is left */
function uiDockLayout(arr) {
  const wins = arr.filter(i => i.k === 'uic' && i.t === 'window'); if (!wins.length && !arr.some(i => i.dock)) return arr;
  const pos = new Map(), byWin = new Map();
  for (const i of arr) if (i.k === 'uic' && i.dock) { const w = wins.find(x => x.id === i.dock.w); if (!w) { pos.set(i.id, { dock: undefined }); continue; } if (!byWin.has(w.id)) byWin.set(w.id, []); byWin.get(w.id).push(i); }
  for (const W of wins) {
    const list = byWin.get(W.id); if (!list) continue;
    let x0 = W.x, x1 = W.x + W.w, y0 = W.y + UI_WIN_TOP, y1 = W.y + W.h - UI_WIN_BOT;
    const side = s => list.filter(i => i.dock.s === s);
    for (const i of side('t').sort((a, b) => a.y - b.y)) { const h = clamp(i.h, 18, (y1 - y0) * .4); pos.set(i.id, { x: x0, y: y0, w: x1 - x0, h }); y0 += h; }
    for (const i of side('b').sort((a, b) => b.y - a.y)) { const h = clamp(i.h, 40, (y1 - y0) * .6); pos.set(i.id, { x: x0, y: y1 - h, w: x1 - x0, h }); y1 -= h; }
    for (const i of side('l').sort((a, b) => a.x - b.x)) { const w = clamp(i.w, 80, (x1 - x0) * .45); pos.set(i.id, { x: x0, y: y0, w, h: y1 - y0 }); x0 += w; }
    for (const i of side('r').sort((a, b) => b.x - a.x)) { const w = clamp(i.w, 80, (x1 - x0) * .45); pos.set(i.id, { x: x1 - w, y: y0, w, h: y1 - y0 }); x1 -= w; }
    const cs = side('c'); cs.forEach((i, k) => { const h = (y1 - y0) / cs.length; pos.set(i.id, { x: x0, y: y0 + k * h, w: x1 - x0, h }); });
  }
  if (!pos.size) return arr;
  return arr.map(i => { const p = pos.get(i.id); if (!p) return i; const r = (v, o) => v == null ? o : Math.round(v * 100) / 100; const n = { x: r(p.x, i.x), y: r(p.y, i.y), w: r(p.w, i.w), h: r(p.h, i.h) }; if ('dock' in p && !p.dock) return Object.assign({}, i, { dock: undefined }); return n.x === i.x && n.y === i.y && n.w === i.w && n.h === i.h ? i : Object.assign({}, i, n); });
}
/* the screens of a zone, for the test mode: its windows and dialogs, by rows then left to right */
function uiScreens(zone, arr) {
  const b = boxOf(zone), cIn = (i, q) => inBox(i.x + i.w / 2, i.y + i.h / 2, q);
  const wins = arr.filter(i => i.k === 'uic' && (i.t === 'window' || i.t === 'dialog' || i.t === 'alert') && !i.hid && cIn(i, b));
  const top = wins.filter(w => !wins.some(o => o !== w && o.t === 'window' && w.t !== 'window' && cIn(w, boxOf(o))));   // a dialog drawn inside a window belongs to that window's picture
  return top.sort((p, q) => Math.abs(p.y - q.y) > 120 ? p.y - q.y : p.x - q.x);
}
