/* ================= board view =================
   An infinite sheet in the spirit of Excalidraw: a tool island on top, a Style / Layers / Moodboard
   panel on the right, islands for zoom, undo and help, and everything else on the sheet itself.
   Items are DOM nodes under one transformed world; connectors and mind-map branches are one SVG. */
const Board = (() => {
  let D = null, items = [], byId = new Map();
  let stage = null, bgrid = null, host, world, framesL, edges, edgesTop, itemsL, labelsL, ovl, liveCv, ink, meas, wrap, toolsEl, optsEl, dockEl, trEl, propsEl, qbarEl, zoomEl, undoEl, brEl, hintEl;
  const view = { x: 0, y: 0, k: 1, r: 0 };   // r: the board turned by two fingers, in degrees (iPad, as in Concepts)
  let tool = 'select', shapeKind = 'rect', penKind = 'pen', noteColor = SCHEME_BASE[14];
  let lassoPts = null;
  let sel = new Set(), editing = null, editSub = null, hist = [], fut = [], op = null, guides = null, marquee = null, attachHi = null, attachSock = null, eraserAt = null, eraseAll = true;
  let uiIns = null, uiLib = null, uiInsp = null;
  let spaceDown = false, penSeen = false, clip = null, raf = 0, propSig = '', qSig = '', lastClient = null, mounted = false, propsTab = 'style', propsHold = false, liveBefore = null;
  const touches = new Map(), nodes = new Map(), fitCache = new Map(), measCache = new Map();
  const MINK = .08, MAXK = 8;

  /* ---------- coordinates ---------- */
  const hostRect = () => host.getBoundingClientRect();
  /* the stage (world, live ink, overlay) turns by view.r around the board's centre: a screen point back to the stage's own frame */
  function unrot(cx, cy) {
    const r = hostRect(); let x = cx - r.left, y = cy - r.top; if (!view.r) return { x, y };
    const a = -view.r * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), W = r.width / 2, H = r.height / 2; x -= W; y -= H;
    return { x: x * c - y * sn + W, y: x * sn + y * c + H };
  }
  const rotD = (dx, dy) => { if (!view.r) return [dx, dy]; const a = -view.r * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); return [dx * c - dy * sn, dx * sn + dy * c]; };
  function toW(cx, cy) { const p = unrot(cx, cy); return { x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k }; }
  const toS = (x, y) => ({ x: x * view.k + view.x, y: y * view.k + view.y });
  const reindex = () => { byId = new Map(items.map(i => [i.id, i])); };
  const selItems = () => [...sel].map(id => byId.get(id)).filter(Boolean);
  const visible = it => !it.hid;

  /* ---------- history ---------- */
  function commit(next, o = {}) {
    if (o.hist !== false) { hist.push(o.before || items); if (hist.length > 250) hist.shift(); fut.length = 0; }
    next = uiLayout(next); items = hasMind(next) ? relayout(next) : next; reindex();
    for (const id of [...sel]) if (!byId.has(id)) sel.delete(id);
    D.items = items; touch(D); updateUndo(); schedule();
  }
  function setLive(next) { items = uiLayout(next); reindex(); D.items = items; schedule(); }
  function silent(next) { items = next; reindex(); D.items = items; save(); }
  const hasMind = arr => arr.some(i => i.k === 'mind');
  function undo() { if (editing) finishEdit(); const p = hist.pop(); if (!p) return; fut.push(items); items = p; reindex(); sel = new Set([...sel].filter(id => byId.has(id))); D.items = items; touch(D); updateUndo(); schedule(); }
  function redo() { if (editing) finishEdit(); const p = fut.pop(); if (!p) return; hist.push(items); items = p; reindex(); D.items = items; touch(D); updateUndo(); schedule(); }
  function updateUndo() { if (!undoEl) return; $('[data-a="undo"]', undoEl).disabled = !hist.length; $('[data-a="redo"]', undoEl).disabled = !fut.length; }
  const replace = (arr, it, patch) => arr.map(x => x.id === it.id ? Object.assign({}, x, patch) : x);

  /* ---------- mind map layout ---------- */
  function measureMind(txt, lv) {
    const key = skin() + lv + '|' + txt; let m = measCache.get(key); if (m) return m;
    const mr = lv === 0 && MT().mindRoot, maxW = mr ? mr[3] : lv === 0 ? 320 : lv === 1 ? 240 : 220;
    meas.className = 'it mind l' + Math.min(lv, 2); meas.style.cssText = 'left:-99999px;top:0;visibility:hidden;width:max-content;height:auto;--mc:#888';
    meas.innerHTML = mindIcon(txt, lv) + `<div class="txt" style="max-width:${maxW}px">${fmtText(txt || ' ')}</div>`;
    const t = meas.firstChild, vp = mr ? mr[2] : lv === 0 ? 36 : lv === 1 ? 20 : 12, minH = mr ? mr[1] : lv === 0 ? 64 : lv === 1 ? 42 : 32;
    m = { w: Math.ceil(Math.max(mr ? mr[0] : lv === 0 ? 140 : 48, meas.offsetWidth + 2)), h: Math.ceil(Math.max(minH, t.offsetHeight + vp)) };
    if (measCache.size > 2000) measCache.clear(); measCache.set(key, m); return m;
  }
  /* Inkspace: first-level branches carry a pictogram picked from their words */
  const MIND_ICONS = [[/r[ée]gion|lieu|monde|carte|map|territ|zone/i, 'compass'], [/faction|clan|guilde|royaume|alliance|camp/i, 'flag'], [/qu[êe]te|mission|histoire|sc[ée]nario|r[ée]cit|objectif/i, 'scroll'], [/gameplay|m[ée]cani|jeu|game|syst[èe]me/i, 'gamepad'], [/ressource|mat[ée]ri|nature|[ée]conomie|budget/i, 'leaf'], [/visuel|image|art|ambiance|moodboard|design|r[ée]f[ée]rence/i, 'image'], [/personnage|perso|h[ée]ros|pnj|[ée]quipe|people|client/i, 'users'], [/lore|chronique|mythe|croyance|biblio|wiki|savoir/i, 'book'], [/id[ée]e|question|brainstorm/i, 'spark'], [/t[âa]che|todo|planning|[ée]tape|court terme|long terme/i, 'tasks']];
  /* the theme manifest can lay sub-ideas out as a list under their branch (mindList) and give first-level branches
     a picture picked from their words (mindArt: [[regex, url]…]) */
  const MT = () => THEMES[skin()] || {};
  const mindArt = txt => { const a = MT().mindArt, hit = a && a.find(([re]) => re.test(txt || '')); return hit ? hit[1] : ''; };
  const ART = 124, IND = 34, LG = 4;
  const mindIcon = (txt, lv) => { if (lv !== 1 || !(THEMES[skin()] || {}).mindTags) return ''; const hit = MIND_ICONS.find(([re]) => re.test(txt || '')); return `<span class="mic">${icon(hit ? hit[1] : 'spark')}</span>`; };
  function relayout(arr) {
    const minds = arr.filter(i => i.k === 'mind'); if (!minds.length) return arr;
    const ids = new Set(minds.map(m => m.id)), kids = new Map();
    const fixed = new Map();
    for (const m of minds) if (m.parent && !ids.has(m.parent)) fixed.set(m.id, { parent: null, root: m.id });
    const get = m => fixed.has(m.id) ? Object.assign({}, m, fixed.get(m.id)) : m;
    for (const m0 of minds) { const m = get(m0); if (m.parent) { if (!kids.has(m.parent)) kids.set(m.parent, []); kids.get(m.parent).push(m); } }
    for (const l of kids.values()) l.sort((a, b) => a.ord - b.ord);
    const out = new Map();
    for (const r0 of minds) {
      const r = get(r0); if (r.parent) continue;
      const lv = new Map(), sz = new Map(), sub = new Map();
      // the whole map can be scaled from its centre idea (msc, Réglages of the map box); every node keeps it as ms
      const K = clamp(+r.msc || 1, .25, 4), szK = m => ({ w: Math.ceil(m.w * K), h: Math.ceil(m.h * K) });
      const walk = (n, l) => { lv.set(n.id, l); sz.set(n.id, szK(measureMind(editing === n.id ? liveText(n) : n.txt, l))); for (const c of kids.get(n.id) || []) walk(c, l + 1); };
      walk(r, 0);
      const LIST = !!MT().mindList, listed = n => LIST && lv.get(n.id) >= 1;
      const VG = l => K * (l <= 1 ? (LIST ? 34 : 18) : 8), HG = l => K * (l === 0 ? (LIST ? 96 : 70) : 46), ART_ = ART * K, IND_ = IND * K, LG_ = LG * K;
      const subH = n => {
        const ch = kids.get(n.id) || [], own = sz.get(n.id).h; let s = 0, v;
        if (listed(n)) { v = own; for (const c of ch) v += LG_ + subH(c); if (lv.get(n.id) === 1 && mindArt(n.txt)) v = Math.max(v, ART_); }
        else { ch.forEach((c, i) => { s += subH(c) + (i ? VG(lv.get(c.id)) : 0); }); v = Math.max(own, s); }
        sub.set(n.id, v); return v;
      };
      const subW = n => { let w = sz.get(n.id).w; if (listed(n)) for (const c of kids.get(n.id) || []) w = Math.max(w, IND_ + subW(c)); return w; };
      subH(r);
      const rs = sz.get(r.id), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      out.set(r.id, { x: Math.round(cx - rs.w / 2), y: Math.round(cy - rs.h / 2), w: rs.w, h: rs.h, lv: 0, parent: null, root: r.id, ms: K });
      const place = (n, list, side) => {
        const np = out.get(n.id); let total = 0;
        if (listed(n)) {   // sub-ideas one under the other below their branch, a little indented
          let y = np.y + np.h + LG_;
          for (const c of list) { const cs = sz.get(c.id); out.set(c.id, { x: Math.round(np.x + IND_), y: Math.round(y), w: cs.w, h: cs.h, lv: lv.get(c.id), side, root: r.id, ms: K }); place(c, kids.get(c.id) || [], side); y += sub.get(c.id) + LG_; }
          return;
        }
        list.forEach((c, i) => { total += sub.get(c.id) + (i ? VG(lv.get(c.id)) : 0); });
        let y = np.y + np.h / 2 - total / 2;
        for (const c of list) {
          const cs = sz.get(c.id), hh = sub.get(c.id), ccy = y + hh / 2, gap = HG(lv.get(n.id)), top = listed(c);
          out.set(c.id, { x: Math.round(side > 0 ? np.x + np.w + gap : np.x - gap - (top ? subW(c) : cs.w)), y: Math.round(top ? y : ccy - cs.h / 2), w: cs.w, h: cs.h, lv: lv.get(c.id), side, root: r.id, ms: K });
          place(c, kids.get(c.id) || [], side);
          y += hh + VG(lv.get(c.id));
        }
      };
      const rk = kids.get(r.id) || [];
      place(r, rk.filter(c => c.side > 0), 1); place(r, rk.filter(c => c.side < 0), -1);
    }
    return arr.map(i => { const p = out.get(i.id); if (!p) return i; let same = true; for (const k in p) if (i[k] !== p[k]) { same = false; break; } return same ? i : Object.assign({}, i, p); });
  }
  /* how far a branch's list of sub-ideas reaches past its right edge: the picture goes beyond it */
  const artOff = it => { let r = it.x + it.w; for (const id of mindDesc(it.id)) { const c = byId.get(id); if (c) r = Math.max(r, c.x + c.w); } return Math.round(r - it.x - it.w); };
  const liveText = n => { const el = nodes.get(n.id); const t = el && el.querySelector('.txt'); return t ? t.innerText.replace(/\n$/, '') : n.txt; };
  const mindKids = id => items.filter(i => i.k === 'mind' && i.parent === id).sort((a, b) => a.ord - b.ord);
  function mindDesc(id, acc = new Set()) { for (const c of items) if (c.k === 'mind' && c.parent === id && !acc.has(c.id)) { acc.add(c.id); mindDesc(c.id, acc); } return acc; }

  /* ---------- painting ---------- */
  function schedule() { if (!raf && mounted) raf = requestAnimationFrame(render); }
  let inkVer = new WeakMap(), inkN = 0;
  const pv = p => { let v = inkVer.get(p); if (!v) { v = ++inkN; inkVer.set(p, v); } return v; };
  const theme = () => document.documentElement.dataset.resolved || 'light';
  const fontCSS = it => fontOf(it.font);
  function sigOf(it) {
    switch (it.k) {
      case 'note': return `n${it.w}|${it.h}|${it.c}|${it.fs}|${it.font}|${it.al}|${it.ls || ''}|${it.txt}|${skin()}`;
      case 'text': return `t${it.fw ? it.w : ''}|${it.fs}|${it.font}|${it.color}|${it.bold}|${it.ital}|${it.al}|${it.ls || ''}|${it.txt}|${theme()}`;
      case 'shape': return `s${it.w}|${it.h}|${it.sh}|${it.rad}|${it.fo}|${it.so}|${it.sc}|${it.fc}|${it.sw}|${it.sty}|${it.dash}|${it.fill}|${it.txt}|${it.fs}|${it.font}|${it.color}|${theme()}`;
      case 'image': return `i${it.asset}|${it.frm}|${it.cap}|${it.rad}|${Assets.has(it.asset)}`;
      case 'file': return `f${it.asset}|${it.name}|${it.mime}`;
      case 'dir': return `D${it.path}|${it.name}`;
      case 'link': return `l${Math.round(it.w)}|${Math.round(it.h)}|${it.url}|${it.title}|${it.asset || it.pic || ''}|${Assets.has(it.asset)}`;
      case 'paint': return `c${it.c}|${it.seed}|${theme()}`;
      case 'ink': return `k${pv(it.p)}|${it.c}|${it.o}|${it.t}|${it.w0}|${it.h0}|${theme()}|${it.b ? JSON.stringify(it.b) : ''}`;
      case 'mind': return `m${it.lv}|${it.c}|${it.txt}|${skin()}|${it.side}|${it.ms || 1}|${it.lv === 1 && MT().mindArt ? artOff(it) : ''}`;
      case 'frame': return `r${it.title}|${it.nt ? 1 : 0}|${it.tfs ?? 1}|${it.tc || ''}|${it.fc || ''}|${theme()}`;
      case 'uic': return `u${it.t}|${Math.round(it.w)}|${Math.round(it.h)}|${uiFid(it)}|${uiDir(it)}|${JSON.stringify([it.txt, it.b, it.bs, it.c, it.f, it.pv, it.dis])}`;
      case 'task': { const t = taskById(it.task) || {}; return `T${t.t}|${t.done}|${t.due}|${t.time}|${t.sp}`; }
      case 'doc': { const d = docById(it.doc) || {}; return `D${d.title}|${d.updated}|${d.trash}`; }
      case 'sheet': return `g${it.w}|${it.h}|${it.cols}|${it.rows}|${it.fs}|${it.title}|${JSON.stringify(it.cells)}|${JSON.stringify(it.cw || 0)}|${JSON.stringify(it.rh || 0)}|${theme()}`;
      case 'plan': return `P${Math.round(it.w)}|${Math.round(it.h)}|${it.fs}|${it.v}|${it.dim || 0}|${it.d0}|${it.d1}|${it.h0}|${it.h1}|${(it.we || []).join('')}|${it.ck || 0}|${JSON.stringify(it.cols || 0)}|${it.title}|${ymd(new Date())}|${new Date().getHours()}|${theme()}`;
      case 'todo': return `o${it.w}|${it.c}|${it.font}|${it.fs}|${it.ttc || ''}|${it.nt ? 1 : ''}|${it.noprog || ''}${it.hidedone || ''}${it.den || ''}|${it.title}|${it.tasks.map(id => { const t = taskById(id); return t ? `${t.id}:${t.done ? 1 : 0}:${t.t}` : ''; }).join('§')}|${theme()}`;
    }
    return it.k;
  }
  const lumOf = c => { const [r, g, b] = hex2rgb(c); return (.2126 * r + .7152 * g + .0722 * b) / 255; };
  /* the button on a block that points to another element (note, board, task): opens it in one click */
  const OPEN_BTN = `<button class="open iopen" data-iopen="1" title="Ouvrir" aria-label="Ouvrir">${icon('ext', 'sm')}</button>`;
  function paint(n, it) {
    n._it = it;
    const s = n.style; s.left = it.x + 'px'; s.top = it.y + 'px';
    if (it.k === 'text' && !it.fw) { s.width = ''; s.height = ''; } else { s.width = it.w + 'px'; s.height = it.h + 'px'; }
    if (it.k === 'mind') { const ms = it.ms || 1; if (ms !== 1) { s.width = it.w / ms + 'px'; s.height = it.h / ms + 'px'; } s.transform = ms !== 1 ? `scale(${ms})` : ''; s.transformOrigin = ms !== 1 ? '0 0' : ''; }
    s.opacity = it.op != null && it.op < 1 ? it.op : '';
    if (it.k !== 'mind') s.transform = it.rot ? `rotate(${it.rot}deg)` : '';
    if (editing === it.id && n._sig) { if (it.k === 'mind') { n.className = 'it mind editing l' + Math.min(it.lv || 0, 2) + (it.side < 0 ? ' s-l' : ' s-r'); n.style.setProperty('--mc', it.c); } return; }
    const sig = sigOf(it); if (sig === n._sig) return; n._sig = sig;
    switch (it.k) {
      case 'note':
        n.className = 'it note'; s.background = it.c; s.setProperty('--tc', it.c);
        n.innerHTML = `<div class="txt l-${it.al || 'left'}" style="font-family:${fontCSS(it)}">${fmtText(it.txt, it.ls)}</div>`;
        fitNote(n, it); break;
      case 'text':
        n.className = 'it text' + (it.fw ? '' : ' auto');
        n.innerHTML = `<div class="txt l-${it.al || 'left'}" style="font:${it.ital ? 'italic ' : ''}${it.bold ? 700 : 500} ${it.fs}px/1.12 ${fontCSS(it)};color:${textColor(it.color, (it.font || HAND) === HAND)};text-align:${it.al || 'left'}">${fmtText(it.txt, it.ls) || '<div><br></div>'}</div>`;
        measureText(n, it); break;
      case 'shape':
        n.className = 'it shape';
        n.innerHTML = shapeSVG(it) + `<div class="txt" style="font:600 ${it.fs}px/1.12 ${fontCSS(it)};color:${inkColor(it.color || it.sc)}">${fmtText(it.txt)}</div>`;
        if (it.txt) fitShape(n, it); break;
      case 'image': {
        n.className = 'it image ' + (it.frm || 'shadow'); n.style.borderRadius = it.rad != null && it.frm !== 'polaroid' ? imgRad(it) + 'px' : '';
        const u = Assets.url(it.asset);
        n.innerHTML = u ? `<img src="${u}" alt="${esc(it.cap || 'Image')}" draggable="false">${it.frm === 'polaroid' && it.cap ? `<div class="cap">${esc(it.cap)}</div>` : ''}` : `<div class="ph"><div>${icon('image')}Glissez une image ici${it.cap ? `<small class="ph-n">${esc(it.cap)}</small>` : ''}${it.miro && it.miro.i && miroCan() ? `<button class="ph-miro" data-miro="1">Récupérer depuis Miro</button>` : ''}</div></div>`;
        break;
      }
      case 'dir': {   // 0.2.84: a Windows folder from the moodboard, the same tile; double-click or Ouvrir opens it in the Explorer
        n.className = 'it card-it dir';
        n.innerHTML = `${Mood.FOLDER_SVG}<div class="fi"><b>${esc(it.name || 'Dossier')}</b><small>${esc(Mood.folderWhere(it.path || ''))}</small></div><button class="dir-open" data-diropen="1" title="Ouvrir dans l’Explorateur : ${esc(it.path || '')}">Ouvrir</button>`;
        break;
      }
      case 'file': {
        const u = Assets.url(it.asset), mime = it.mime || '';
        if (u && /^video\//.test(mime)) { n.className = 'it card-it media'; n.innerHTML = `<video src="${u}" controls preload="metadata"></video>`; break; }
        if (u && /^audio\//.test(mime)) { n.className = 'it card-it'; n.innerHTML = `<div class="ft" style="background:#22A6B3">${icon('play')}</div><div class="fi"><b>${esc(it.name)}</b><audio src="${u}" controls preload="metadata" style="width:100%;height:30px"></audio></div>`; break; }
        const ext = (it.name.split('.').pop() || 'fichier').slice(0, 4).toUpperCase(), col = FILE_COLORS[ext] || '#5E6B78';
        n.className = 'it card-it';
        n.innerHTML = `<div class="ft" style="background:${col}">${esc(ext)}</div><div class="fi"><b>${esc(it.name)}</b><small>${it.size ? fmtSize(it.size) : 'Fichier'}${u ? '' : ' · indisponible ici'}</small></div>${u ? `<a href="${u}" target="_blank" rel="noopener" download="${esc(it.name)}">Ouvrir</a>` : ''}`;
        break;
      }
      case 'link': {
        const dom = hostOf(it.url), ig = isInsta(it.url), pic = (it.asset && Assets.url(it.asset)) || it.pic || '';
        const fav = ig ? `<div class="fav ig">${IG_GLYPH}</div>` : `<div class="fav" style="background:${SPACE_COLORS[Math.floor(hashStr(dom) * SPACE_COLORS.length)]}">${esc((dom[0] || '?').toUpperCase())}</div>`;
        const row = `${fav}<div class="fi"><b>${esc(it.title || (ig ? instaTitle(it.url) : dom))}</b><small>${esc(pic ? dom : it.url)}</small></div><a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${icon('ext', 'sm')}</a>`;
        // drawn at 300 px wide then scaled to the item, so the card keeps its proportions at any size or zoom
        const z = it.w / 300;
        n.className = 'it lk';
        n.innerHTML = `<div class="card-it${pic ? ' lcard' : ''}" style="width:300px;height:${it.h / z}px;transform:scale(${z})">${pic ? `<div class="lpic"><img src="${esc(pic)}" alt="" draggable="false" referrerpolicy="no-referrer"></div><div class="lrow">${row}</div>` : row}</div>`;
        break;
      }
      case 'ink': {
        const def = PENS[it.t] || PENS.pen;
        n.className = 'it ink' + (def.multiply ? ' mul' : '');
        n.innerHTML = `<svg viewBox="0 0 ${it.w0} ${it.h0}" preserveAspectRatio="none">${inkSVG(it, '', { blend: false })}</svg>`;
        break;
      }
      case 'mind': {
        n.className = 'it mind l' + Math.min(it.lv || 0, 2) + (it.side < 0 ? ' s-l' : ' s-r'); n.style.setProperty('--mc', it.c);
        const art = it.lv === 1 ? mindArt(it.txt) : '';
        if (art) n.style.setProperty('--ao', artOff(it) / (it.ms || 1) + 'px');
        n.innerHTML = mindIcon(it.txt, it.lv || 0) + `<div class="txt">${fmtText(it.txt) || '<div><br></div>'}</div>` + (art ? `<img class="mart" src="${art}" alt="" draggable="false">` : ''); break;
      }
      case 'frame':
        /* 0.2.51: every frame is a container in the old UI Design zone's look: a header with its title as a coloured tag,
           an optional background colour (it.fc) and title colour (it.tc) */
        n.className = 'frame-it fz' + (it.nt ? ' nt' : '') + (it.fc ? ' filled' : '') + (it.tc ? ' tcol' : '');
        n.style.setProperty('--fzc', it.fc || ''); n.style.setProperty('--ftc', it.tc || ''); n.style.setProperty('--ftx', it.tc ? (lumOf(it.tc) > .6 ? '#1E1E1E' : '#FFFFFF') : '');
        n.innerHTML = `<div class="fzh"><div class="ftitle" style="font-size:${FRAME_TFS[it.tfs ?? 1]}px">${esc(it.title)}</div></div>`; break;
      case 'uic':
        n.className = 'it uic uf-' + uiFid(it) + ' ut-' + it.t + (it.p ? ' uin' : ''); n.innerHTML = uicHTML(it, uiDir(it)); break;
      case 'task': {
        const t = taskById(it.task);
        n.className = 'it card-it task' + (t && t.done ? ' done' : '');
        if (!t) { n.innerHTML = `<div class="fi"><small>Tâche supprimée</small></div>`; break; }
        n.innerHTML = `<button class="cb" role="checkbox" aria-checked="${t.done}" data-tdone="1" aria-label="Terminer">${icon('check')}</button><span class="tt">${esc(t.t)}</span>${OPEN_BTN}`;
        break;
      }
      case 'doc': {
        const d = docById(it.doc);
        n.className = 'it card-it docref';
        n.innerHTML = d && !d.trash ? `<div class="th">${Thumbs.svg(d)}</div><div class="fi">${icon(d.type === 'board' ? 'board' : 'note', 'sm')}<b>${esc(d.title)}</b>${OPEN_BTN}</div>` : `<div class="fi"><small>Document introuvable</small></div>`;
        break;
      }
      case 'sheet': {
        const g = sheetGeom(it), val = sheetEval(it.cells);
        n.className = 'it tsheet';
        s.setProperty('--sfs', g.fs + 'px'); s.setProperty('--srh', g.rh + 'px'); s.setProperty('--sth', g.th + 'px'); s.setProperty('--sadd', g.add + 'px');
        let h = `<div class="sht"><b data-cell="title">${esc(it.title) || '&nbsp;'}</b><span class="shfx"></span></div><div class="shg" style="grid-template-columns:${g.hw}px ${g.cws.map(v => v.toFixed(2) + 'px').join(' ')};grid-template-rows:${g.rh}px ${g.rhs.map(v => v.toFixed(2) + 'px').join(' ')}"><i class="shc" title="Tout sélectionner"></i>`;
        for (let c = 0; c < it.cols; c++) h += `<i class="shh" data-col="${c}">${colName(c)}<b class="shcz" data-cz="${c}"></b></i>`;
        for (let r = 0; r < it.rows; r++) {
          h += `<i class="shr" data-row="${r}">${r + 1}<b class="shrz" data-rz="${r}"></b></i>`;
          for (let c = 0; c < it.cols; c++) { const ref = colName(c) + (r + 1), raw = it.cells[ref], v = raw ? val(ref) : null; h += `<div class="cell${typeof v === 'number' ? ' num' : v && v.err ? ' er' : ''}${raw && raw[0] === '=' ? ' fx' : ''}" data-cell="${ref}"${v && v.err ? ` title="${esc(raw)}"` : ''}>${esc(sheetShow(v))}</div>`; }
        }
        n.innerHTML = h + `</div><div class="shadd"><button data-sadd="row">${icon('plus', 'sm')}<span>Ligne</span></button><button data-sadd="col">${icon('plus', 'sm')}<span>Colonne</span></button></div>`;
        if (Math.abs(g.h - it.h) > .5 || (it.cw && Math.abs(g.w - it.w) > .5)) { const nx = Object.assign({}, it, { h: g.h }, it.cw ? { w: g.w } : {}); n._it = nx; items = items.map(x => x.id === it.id ? nx : x); reindex(); D.items = items; save(); s.height = g.h + 'px'; s.width = nx.w + 'px'; n._sig = sigOf(nx); }
        break;
      }
      case 'plan':
        n.className = 'it tplan'; n.innerHTML = planHTML(it); break;
      case 'paint': {
        /* 0.2.51: a dab of paint left by a colour dropped on the board */
        const pb = paintBlob(it.seed), gid = 'pg' + it.id;
        n.className = 'it paint';
        n.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><radialGradient id="${gid}" cx=".36" cy=".32" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient></defs><g fill="${it.c}"><path d="${pb.d}"/>${pb.dr}</g><path d="${pb.d}" fill="url(#${gid})"/><path d="${pb.d}" fill="none" stroke="rgba(0,0,0,.14)" stroke-width=".7"/><ellipse cx="36" cy="31" rx="9" ry="4.6" fill="#fff" opacity=".4" transform="rotate(-32 36 31)"/></svg><b class="pt-l">${it.c}</b>`;
        break;
      }
      case 'todo': {
        /* 0.2.51: a cleaner list card — plain card (or the chosen colour), a counter and a progress line, round checks */
        const plain = !it.c || /^#?f{6}$/i.test(String(it.c).replace('#', '')) || it.c.toUpperCase() === '#FFFFFF';
        n.className = 'it todo' + (plain ? ' plain' : '') + (it.den ? ' den-' + it.den : ''); s.background = plain ? '' : it.c; s.setProperty('--tc', it.c || '#FFFFFF');
        const ts = it.tasks.map(id => taskById(id)).filter(Boolean), nd = ts.filter(t => t.done).length;
        const shown = it.hidedone ? ts.filter(t => !t.done) : ts;
        const rows = shown.map(t => `<div class="trw${t.done ? ' done' : ''}" data-task="${t.id}"><button class="tck" data-tck="${t.id}" role="checkbox" aria-checked="${t.done}" aria-label="Terminer"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4L18 8"/></svg></button><span class="ttx" data-sub="${t.id}">${esc(t.t) || '&nbsp;'}</span></div>`).join('');
        n.innerHTML = `<div class="tin" style="font-family:${fontCSS(it)};font-size:${it.fs}px"><div class="thd${it.nt ? ' nt' : ''}">${it.nt ? '' : `<div class="ttl" data-sub="title"${it.ttc ? ` style="color:${it.ttc}"` : ''}>${esc(it.title) || '&nbsp;'}</div>`}${ts.length && !it.noprog ? `<span class="tcnt">${nd}/${ts.length}</span>` : ''}</div>${ts.length && !it.noprog ? `<div class="tbar"><i style="width:${Math.round(nd / ts.length * 100)}%"></i></div>` : ''}<div class="trows">${rows}</div><button class="tadd" data-tadd="1">${icon('plus', 'sm')}<span>Ajouter une tâche</span></button></div>`;
        measureTodo(n, it); break;
      }
    }
  }
  const FILE_COLORS = { PDF: '#E5484D', DOC: '#3D7BD9', DOCX: '#3D7BD9', XLS: '#2E9E6A', XLSX: '#2E9E6A', CSV: '#2E9E6A', PPT: '#F2A33A', PPTX: '#F2A33A', ZIP: '#8B5E3C', TXT: '#5E6B78', MD: '#5E6B78', PSD: '#22A6B3', AI: '#F2A33A', BLEN: '#F5A524', FBX: '#6E56F0', OBJ: '#6E56F0', GLB: '#6E56F0', MP3: '#22A6B3', WAV: '#22A6B3' };
  /* sticky notes keep their size; the text shrinks to fit, as on a real board */
  function fitBox(t, maxFs, innerW, innerH, key) {
    let fs = fitCache.get(key);
    if (fs === undefined) {
      let lo = 9, hi = maxFs; t.style.fontSize = hi + 'px';
      if (t.scrollHeight > innerH + 1 || t.scrollWidth > innerW + 1) {
        for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; t.style.fontSize = mid + 'px'; if (t.scrollHeight > innerH + 1 || t.scrollWidth > innerW + 1) hi = mid; else lo = mid; }
        fs = Math.floor(lo * 2) / 2;
      } else fs = hi;
      if (fitCache.size > 3000) fitCache.clear(); fitCache.set(key, fs);
    }
    t.style.fontSize = fs + 'px';
  }
  function fitNote(n, it) { const t = n.firstChild; if (!t || !n.isConnected) return; fitBox(t, it.fs, it.w - 32, it.h - 28, n._sig); }
  function fitShape(n, it) { const t = n.querySelector('.txt'); if (!t || !n.isConnected) return; t.style.width = it.w * .84 + 'px'; fitBox(t, it.fs, it.w * .84, it.h * .84, n._sig); }
  function measureText(n, it) {
    if (!n.isConnected) return;
    const w = Math.ceil(n.offsetWidth), h = Math.ceil(n.offsetHeight);
    if (w && h && (Math.abs(w - it.w) > .5 || Math.abs(h - it.h) > .5)) { const nx = Object.assign({}, it, { w, h }); n._it = nx; items = items.map(x => x.id === it.id ? nx : x); reindex(); D.items = items; save(); }
  }
  /* a todo card grows with its rows */
  function measureTodo(n, it) {
    if (!n.isConnected) return;
    const tin = n.querySelector('.tin'); if (!tin) return;
    const h = Math.max(56, Math.ceil(tin.offsetHeight + 2));
    if (Math.abs(h - it.h) > .5) { const nx = Object.assign({}, it, { h }); n._it = nx; n._sig = ''; items = items.map(x => x.id === it.id ? nx : x); reindex(); D.items = items; save(); n.style.height = h + 'px'; n._sig = sigOf(nx); const svg = n.querySelector('svg.sh'); if (svg) { const P = shapePoly('round', nx.w, h); svg.setAttribute('viewBox', `0 0 ${nx.w} ${h}`); const rough = roughD(P, true, nx.sd != null ? nx.sd : hashStr(nx.id), 2); [...svg.children].forEach((p, i) => rough[i] && p.setAttribute('d', rough[i])); } }
  }
  function reconcile(layer, list) {
    let prev = null;
    for (const it of list) {
      let n = nodes.get(it.id);
      if (!n) { n = document.createElement('div'); n.dataset.id = it.id; nodes.set(it.id, n); n._sig = ''; n._it = null; }
      const next = prev ? prev.nextSibling : layer.firstChild;
      if (next !== n) layer.insertBefore(n, next);
      if (n._it !== it) paint(n, it);
      prev = n;
    }
  }
  function render() {
    raf = 0; if (!mounted) return; drawn++;
    const fr = [], ot = [];
    const pl = [];   // a planning sits under the other items, so what is written on it stays on top
    for (const it of items) { if (it.k === 'conn' || it.hid) continue; (it.k === 'frame' ? fr : it.k === 'plan' ? pl : ot).push(it); }
    reconcile(framesL, fr); reconcile(itemsL, pl.length ? pl.concat(ot) : ot);
    for (const [id, n] of nodes) { const it = byId.get(id); if (!it || it.k === 'conn' || it.hid) { n.remove(); nodes.delete(id); } }
    renderEdges(); renderOverlay();
  }
  function connSVG(c, on) {
    const g = connGeom(c, byId), col = inkColor(c.sc), dash = dashAttr(c.dash, c.sw), lvl = c.sty === 'wild' ? 2 : 1;
    let body = '';
    if (c.sty !== 'clean' && !g.bez && !(c.route === 'curve' && (c.pts || []).length)) {
      const rough = roughLineD(g.pts, c.sd || .41, c.sw, lvl);
      body = rough.map((d, i) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${(c.sw * (i ? .7 : 1)).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" opacity="${i ? .7 : 1}"${dash}/>`).join('');
    } else {
      body = `<path d="${g.d}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"${dash}/>` + (c.sty !== 'clean' ? `<path d="${g.d}" fill="none" stroke="currentColor" stroke-width="${(c.sw * .6).toFixed(2)}" opacity=".55" transform="translate(${lvl === 2 ? '1.8 1.4' : '.9 .7'})"${dash}/>` : '');
    }
    const op = c.op != null && c.op < 1 ? ` opacity="${c.op}"` : '';
    return { g, svg: `<g data-conn="${c.id}" style="color:${col}" stroke-width="${c.sw}"${op}>${body}${headD(g.b, g.tb, c.h1, c.sw)}${headD(g.a, g.ta, c.h0, c.sw)}${on ? `<path class="sel" d="${g.d}"/>` : ''}<path class="hit" d="${g.d}"/></g>` };
  }
  function renderEdges() {
    let s = '', top = '', L = '';
    const LIST = !!MT().mindList;
    for (const it of items) if (it.k === 'mind' && it.parent && !it.hid) {
      const p = byId.get(it.parent); if (!p || p.hid) continue;
      if (LIST) {
        const f = v => v.toFixed(1), K = it.ms || 1;
        if (p.parent) {   // a sub-idea: a bracket line down from its branch, a tick and a dot before the words
          const bx = p.x + 12 * K, y0 = p.y + p.h - 2 * K, cy = it.y + it.h / 2, ex = it.x - 5 * K;
          s += `<path d="M${f(bx)} ${f(y0)}V${f(cy - 7 * K)}Q${f(bx)} ${f(cy)} ${f(bx + 7 * K)} ${f(cy)}H${f(ex)}" fill="none" stroke="${it.c}" stroke-width="${f(1.7 * K)}" stroke-linecap="round" opacity=".85"/><circle cx="${f(ex)}" cy="${f(cy)}" r="${f(3 * K)}" fill="${it.c}"/>`;
        } else {          // a branch: a curve from the centre with a dot at the start and a little arrow into the pill
          const x1 = it.side > 0 ? p.x + p.w - 6 * K : p.x + 6 * K, y1 = p.y + p.h / 2, x2 = it.side > 0 ? it.x - 3 * K : it.x + it.w + 3 * K, y2 = it.y + it.h / 2, mx = x1 + (x2 - x1) * .55;
          s += `<g style="color:${it.c}"><path d="M${f(x1)} ${f(y1)}C${f(mx)} ${f(y1)} ${f(mx)} ${f(y2)} ${f(x2 - it.side * 4 * K)} ${f(y2)}" fill="none" stroke="currentColor" stroke-width="${f(2.4 * K)}" stroke-linecap="round"/><circle cx="${f(x1)}" cy="${f(y1)}" r="${f(4 * K)}" class="hf"/>${headD([x2, y2], [it.side, 0], 'tri', 1.2 * K)}</g>`;
        }
        continue;
      }
      const x1 = it.side > 0 ? p.x + p.w : p.x, y1 = p.y + p.h / 2, lv = it.lv || 1;
      const tag = THEMES[skin()] && THEMES[skin()].mindTags;
      const x2 = it.side > 0 ? it.x : it.x + it.w, y2 = lv >= 2 && !tag ? it.y + it.h - 1 : it.y + it.h / 2, mx = x1 + (x2 - x1) * .5;
      const ext = lv >= 2 && !tag ? `L${(it.side > 0 ? it.x + 4 : it.x + it.w - 4).toFixed(1)} ${y2.toFixed(1)}` : '';
      s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}C${mx.toFixed(1)} ${y1.toFixed(1)} ${mx.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}${ext}" fill="none" stroke="${it.c}" stroke-width="${((lv === 1 ? 3.2 : 2.2) * (it.ms || 1)).toFixed(2)}" stroke-linecap="round"/>`;
    }
    for (const c of items) if (c.k === 'conn' && !c.hid) {
      const A = c.a.id && byId.get(c.a.id), B = c.b.id && byId.get(c.b.id);
      if ((c.a.id && (!A || A.hid)) || (c.b.id && (!B || B.hid))) continue;
      // an arrow pinned inside an item is drawn above the items, or the picture would hide its end
      const r = connSVG(c, sel.has(c.id)); if (c.a.fx != null || c.b.fx != null) top += r.svg; else s += r.svg;
      if (c.txt || editing === c.id) L += `<div class="clabel" data-l="${c.id}" data-id="${c.id}" style="left:${r.g.mid[0].toFixed(1)}px;top:${r.g.mid[1].toFixed(1)}px">${editing === c.id ? '' : esc(c.txt)}</div>`;
    }
    edges.innerHTML = s; edgesTop.innerHTML = top;
    if (editing && byId.get(editing) && byId.get(editing).k === 'conn') { const ex = labelsL.querySelector(`[data-l="${editing}"]`); if (ex) { const g = connGeom(byId.get(editing), byId); ex.style.left = g.mid[0] + 'px'; ex.style.top = g.mid[1] + 'px'; } }
    else labelsL.innerHTML = L;
  }

  /* ---------- overlay: selection, handles, guides ---------- */
  function renderOverlay() {
    sheetSelPaint();
    let h = '';
    if (lassoPts && lassoPts.length >= 4) { let d = ''; for (let j = 0; j < lassoPts.length; j += 2) { const q = toS(lassoPts[j], lassoPts[j + 1]); d += (j ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1); } h += `<svg class="lassop"><path d="${d}Z"/></svg>`; }
    if (marquee) { const a = toS(marquee[0], marquee[1]), b = toS(marquee[2], marquee[3]); h += `<div class="marquee" style="left:${Math.min(a.x, b.x)}px;top:${Math.min(a.y, b.y)}px;width:${Math.abs(b.x - a.x)}px;height:${Math.abs(b.y - a.y)}px"></div>`; }
    if (guides) for (const g of guides) { if (g.v != null) { const p = toS(g.v, 0); h += `<div class="guide v" style="left:${p.x}px;top:0;bottom:0"></div>`; } else { const p = toS(0, g.h); h += `<div class="guide h" style="top:${p.y}px;left:0;right:0"></div>`; } }
    if (attachHi) { const it = byId.get(attachHi); if (it) { const a = toS(it.x, it.y); h += `<div class="attach" style="left:${a.x - 4}px;top:${a.y - 4}px;width:${it.w * view.k + 8}px;height:${it.h * view.k + 8}px"></div>`;
      if (op && (op.kind === 'conn' || op.kind === 'ep')) for (const [k, [fx, fy]] of Object.entries(SOCKS)) { const q = toS(it.x + fx * it.w, it.y + fy * it.h); h += `<div class="sock${attachSock === k ? ' on' : ''}" style="left:${q.x}px;top:${q.y}px"></div>`; } } }
    { const one = sel.size === 1 ? byId.get([...sel][0]) : null, lb = one && one.k === 'uic' ? (one.t === 'box' && ukBoxStyle(one).lay !== 'none' ? one : uiLaidOut(one) ? byId.get(one.p) : null) : null;
      if (lb && !uiIns) { const c = ukBoxStyle(lb), m = c.m.map(v => +v || 0), a = toS(lb.x + m[0], lb.y + m[1] + ukChrome(c)); h += `<div class="uilay" style="left:${a.x}px;top:${a.y}px;width:${Math.max(0, lb.w - m[0] - m[2]) * view.k}px;height:${Math.max(0, lb.h - m[1] - m[3] - ukChrome(c)) * view.k}px"></div>`; }
      if (uiIns) { const a = toS(uiIns.x, uiIns.y), w = uiIns.w * view.k, hh = uiIns.h * view.k; h += uiIns.box ? `<div class="uiins box" style="left:${a.x}px;top:${a.y}px;width:${w}px;height:${hh}px"></div>` : `<div class="uiins" style="left:${a.x - (w ? 0 : 1.5)}px;top:${a.y - (hh ? 0 : 1.5)}px;width:${w || 3}px;height:${hh || 3}px"></div>`; } }
    if (eraserAt && tool === 'eraser') { const r = 12; h += `<div class="erasecur" style="left:${eraserAt.x}px;top:${eraserAt.y}px;width:${r * 2}px;height:${r * 2}px"></div>`; }
    const list = selItems(), dragging = op && op.moved;
    if (list.length === 1 && list[0].k === 'conn') {
      const c = list[0], g = connGeom(c, byId), a = toS(g.a[0], g.a[1]), b = toS(g.b[0], g.b[1]);
      if (!dragging || (op && (op.kind === 'pt' || op.kind === 'ep'))) {
        const mids = c.pts || [];
        /* add handles between the points of the line; on a bare curve, one in the middle */
        const P = [g.a, ...mids, g.b];
        if (g.bez) { const m = toS(g.mid[0], g.mid[1]); h += `<div class="hdl add" data-add="0" title="Ajouter un point" style="left:${m.x}px;top:${m.y}px"></div>`; }
        else if (c.route !== 'elbow' || mids.length) for (let i = 0; i < P.length - 1; i++) { const m = toS((P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); h += `<div class="hdl add" data-add="${i}" title="Ajouter un point" style="left:${m.x}px;top:${m.y}px"></div>`; }
        mids.forEach((p, i) => { const q = toS(p[0], p[1]); h += `<div class="hdl pt" data-pt="${i}" title="Glisser, double-clic pour retirer" style="left:${q.x}px;top:${q.y}px"></div>`; });
      }
      const epc = e => (e.id || e.on ? ' on' : '') + (e.fx != null || e.on ? ' pin' : ''), ept = 'Glisser vers un élément · Ctrl : ancrer à cet endroit précis';
      h += `<div class="hdl ep${epc(c.a)}" data-ep="a" title="${ept}" style="left:${a.x}px;top:${a.y}px"></div><div class="hdl ep${epc(c.b)}" data-ep="b" title="${ept}" style="left:${b.x}px;top:${b.y}px"></div>`;
    } else if (list.length) {
      const boxes = list.filter(i => i.k !== 'conn'), bb = unionBox(boxes);
      if (bb) {
        const o1 = list.length === 1 ? list[0] : null, R = o1 && o1.rot && ROTABLE(o1) ? o1.rot : 0;
        /* one turned element: its own box, turned with it, and its handles around it */
        const a = R ? toS(o1.x, o1.y) : toS(bb[0], bb[1]), b = R ? toS(o1.x + o1.w, o1.y + o1.h) : toS(bb[2], bb[3]), locked = list.some(i => i.lock);
        const rcx = (a.x + b.x) / 2, rcy = (a.y + b.y) / 2, rc = Math.cos(R * Math.PI / 180), rs = Math.sin(R * Math.PI / 180);
        const rp = (x, y) => R ? [rcx + (x - rcx) * rc - (y - rcy) * rs, rcy + (x - rcx) * rs + (y - rcy) * rc] : [x, y];
        h += `<div class="selbox${list.length > 1 ? ' multi' : ''}${locked ? ' locked' : ''}" style="left:${a.x - 3}px;top:${a.y - 3}px;width:${b.x - a.x + 6}px;height:${b.y - a.y + 6}px${R ? `;transform:rotate(${R}deg)` : ''}"></div>`;
        if (locked && !dragging) { const [lx, ly] = rp(b.x + 3, a.y - 3); h += `<button class="lockb" data-unlock="1" title="Verrouillé · cliquer pour déverrouiller" aria-label="Déverrouiller" style="left:${lx}px;top:${ly}px">${icon('lock', 'sm')}</button>`; }
        if (!editing && !locked && list.some(ROTABLE) && (!dragging || op.kind === 'rot') && (b.x - a.x > 14 || b.y - a.y > 14)) {
          const [qx, qy] = rp(rcx, a.y - 30), [lx, ly] = rp(rcx, a.y - 4);
          h += `<div class="rotstem" style="left:${lx}px;top:${ly}px;transform:rotate(${R + 180}deg)"></div><div class="hdl rot" data-rot="1" title="Tourner · Maj : par pas de 15°" style="left:${qx}px;top:${qy}px">${icon('rotate', 'sm')}</div>`;
          if (op && op.kind === 'rot') h += `<div class="radtip" style="left:${qx + 16}px;top:${qy - 28}px">${Math.round(op.deg)}°</div>`;
        }

        const gs = new Set(list.map(i => i.g).filter(Boolean));
        if (list.length > 1) for (const g of gs) { const gb = unionBox(items.filter(i => i.g === g && i.k !== 'conn' && !i.hid)); if (!gb) continue; const ga = toS(gb[0], gb[1]), gz = toS(gb[2], gb[3]); h += `<div class="grpbox" style="left:${ga.x - 7}px;top:${ga.y - 7}px;width:${gz.x - ga.x + 14}px;height:${gz.y - ga.y + 14}px"></div>`; }
        const one = list.length === 1 ? list[0] : null;
        if (one && one.k === 'mind' && !dragging && !editing) h += mindHandles(one, a, b);
        if (!dragging && !editing && !(one && one.k === 'mind') && !locked) {
          const sides = one && (one.k === 'image' || one.k === 'ink' || one.k === 'doc' || one.k === 'paint') ? ['nw', 'ne', 'se', 'sw'] : one && (one.k === 'text' || one.k === 'todo') ? ['nw', 'ne', 'se', 'sw', 'e', 'w'] : one && one.k === 'sheet' ? ['e', 'w'] : ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
          const P = { nw: [a.x, a.y], ne: [b.x, a.y], se: [b.x, b.y], sw: [a.x, b.y], n: [(a.x + b.x) / 2, a.y], s: [(a.x + b.x) / 2, b.y], e: [b.x, (a.y + b.y) / 2], w: [a.x, (a.y + b.y) / 2] };
          for (const k of sides) { const [hx, hy] = rp(P[k][0] + (k.includes('e') ? 3 : k.includes('w') ? -3 : 0), P[k][1] + (k.includes('s') ? 3 : k.includes('n') ? -3 : 0)); h += `<div class="hdl ${k}" data-h="${k}" style="left:${hx}px;top:${hy}px${R ? `;transform:rotate(${R}deg)` : ''}"></div>`; }
          // Excalidraw/Miro-like: a dot on each side, drag it to another item to link them, click it to add a linked item
          if (one && LINKABLE(one)) for (const [k, [dx, dy]] of Object.entries(DIRS)) { if (R) continue; h += `<div class="hdl cdot" data-cd="${k}" title="Glisser vers un élément pour le relier · clic : nouvel élément relié (Ctrl + flèche)" style="left:${P[k][0] + dx * 22}px;top:${P[k][1] + dy * 22}px"></div>`; }
        }
        // a dot inside the top-left corner of a rectangle: drag it to round the corners (0.2.23)
        if (one && ((one.k === 'shape' && (one.sh === 'rect' || one.sh === 'round')) || (one.k === 'image' && one.frm !== 'polaroid')) && !editing && !locked && !R && (!dragging || op.kind === 'rad') && one.w * view.k > 56 && one.h * view.k > 56) {
          /* outside the top right corner, off the resize handles: pull it in towards the shape to round the corners */
          const r = (one.k === 'image' ? imgRad(one) : shapeRad(one.sh, one.w, one.h, one.rad)) * view.k, q = toS(one.x + one.w, one.y), hx = q.x + RAD_OFF, hy = q.y - RAD_OFF;
          h += `<div class="hdl crad" data-rad="1" title="Arrondir les angles · ${Math.round(r / view.k)} px : tirer vers la forme" style="left:${hx}px;top:${hy}px"></div>`;
          if (op && op.kind === 'rad') h += `<div class="radtip" style="left:${hx + 12}px;top:${hy - 26}px">${Math.round(r / view.k)} px</div>`;
        }
        const tidy = canTidy(boxes) && (!dragging || op.kind === 'tidy') && !editing && !locked;
        if (tidy) h += `<div class="hdl tidy" data-tidy="1" title="Réorganiser : glissez à gauche ou à droite pour changer la largeur du bloc, cliquez pour ajuster. Ctrl + poignée d’échelle : le cadre change de ce côté et les images se réorganisent" style="left:${b.x + 20}px;top:${a.y - 20}px"><i></i><i></i><i></i><i></i></div>`;
        if (boxes.length > 1 && !dragging && !editing) h += `<button class="ovl-arr" data-arr="1" title="Ranger, aligner, répartir" style="left:${b.x + 20}px;top:${a.y + (tidy ? 14 : -20)}px">${icon('arrange')}</button>`;
      }
    }
    if (h || ovl.firstChild) ovl.innerHTML = h;   // 0.3.4: an empty overlay is not rewritten at each frame of a pan
    renderQuick(list, dragging);
    renderProps();
    uiInspSync();
    { const zt = Math.round(view.k * uz() * 100) + ' %', zv = $('.zv', zoomEl); if (zv.textContent !== zt) zv.textContent = zt; }
  }

  /* a selected mind map idea: "+" buttons to add an idea under it (on its outer side; both sides for the centre) and
     one beside it (below); the centre idea also gets the box of the whole map, its corners scale the map */
  function mindHandles(one, a, b) {
    let h = '';
    const plus = (mode, x, y, tip) => `<button class="mplus" data-madd="${mode}" title="${tip}" style="left:${x}px;top:${y}px">${icon('plus')}</button>`;
    const my = (a.y + b.y) / 2;
    if (!one.parent) {
      const ids = mindDesc(one.id); ids.add(one.id);
      const bb = unionBox(items.filter(i => ids.has(i.id) && !i.hid)), A = toS(bb[0], bb[1]), B = toS(bb[2], bb[3]);
      h += `<div class="mbox" style="left:${A.x - 8}px;top:${A.y - 8}px;width:${B.x - A.x + 16}px;height:${B.y - A.y + 16}px"></div>`;
      for (const [k, x, y] of [['nw', A.x - 8, A.y - 8], ['ne', B.x + 8, A.y - 8], ['se', B.x + 8, B.y + 8], ['sw', A.x - 8, B.y + 8]]) h += `<div class="hdl ${k}" data-msc="${k}" title="Agrandir ou réduire toute la mind map" style="left:${x}px;top:${y}px"></div>`;
      h += plus('left', a.x - 22, my, 'Ajouter une idée à gauche (Tab)') + plus('right', b.x + 22, my, 'Ajouter une idée à droite (Tab)');
    } else {
      h += plus('child', one.side > 0 ? b.x + 20 : a.x - 20, my, 'Ajouter une idée dessous (Tab)');
      h += plus('sibling', (a.x + b.x) / 2, b.y + 16, 'Ajouter une idée voisine (Entrée)');
    }
    return h;
  }
  function startMindScale(e) {
    const r = byId.get([...sel][0]); if (!r || r.k !== 'mind' || r.parent) return;
    const before = items, cx = r.x + r.w / 2, cy = r.y + r.h / 2, w0 = toW(e.clientX, e.clientY), d0 = Math.max(8, Math.hypot(w0.x - cx, w0.y - cy)), k0 = +r.msc || 1;
    let moved = false;
    op = { id: e.pointerId, kind: 'mscale', moved: false,
      move(ev) { if (ev.pointerId !== this.id) return; moved = this.moved = true; const p = toW(ev.clientX, ev.clientY), k = clamp(Math.round(k0 * Math.hypot(p.x - cx, p.y - cy) / d0 * 100) / 100, .25, 4); setLive(relayout(before.map(i => i.id === r.id ? Object.assign({}, i, { msc: k }) : i))); },
      up() { op = null; if (moved) commit(items, { before }); else schedule(); },
      cancel() { setLive(before); } };
  }

  /* ---------- contextual bars, as in Miro: the options of the selection float over it (qbar), those of the chosen
     tool under the tools (topts). Colours open the colour popover, the rest small popovers; ⋯ has order, groups, opacity. ---------- */
  const primaryProp = it => it.k === 'note' || it.k === 'todo' ? 'fc' : it.k === 'frame' || it.k === 'image' || it.k === 'file' || it.k === 'dir' || it.k === 'link' || it.k === 'doc' || it.k === 'task' || it.k === 'sheet' ? null : 'sc';
  const propValue = (it, prop) => prop === 'fc' ? (it.k === 'shape' ? it.fc : it.c) : prop === 'sc' ? (it.k === 'text' ? it.color : it.k === 'ink' || it.k === 'mind' || it.k === 'paint' ? it.c : it.sc) : it[prop];
  const SC_KINDS = ['shape', 'conn', 'text', 'ink', 'mind'];
  const qsw = (prop, cur, title) => `<button class="qb qc" data-qc="${prop}" title="${esc(title)}" aria-label="${esc(title)}"><span class="qsw${prop === 'fc' || prop === 'ffc' ? ' fill' : ''}${cur ? '' : ' none'}" style="--c:${cur || 'transparent'}"></span></button>`;
  const qbtn = (id, inner, title, chev = true) => `<button class="qb" data-qp="${id}" title="${esc(title)}" aria-label="${esc(title)}">${inner}${chev ? '<svg class="qchev" viewBox="0 0 8 8"><path d="M1.5 3 4 5.5 6.5 3"/></svg>' : ''}</button>`;
  const qact = (a, ic, title, label) => `<button class="qb" data-qa="${a}" title="${esc(title)}" aria-label="${esc(title)}">${icon(ic)}${label ? `<span>${label}</span>` : ''}</button>`;
  /* what the bar is about: the selection, or (empty list) the tool about to draw */
  function ctxOf(list) {
    const td = !list.length, T = tool === 'line' ? 'conn' : tool, kinds = new Set(list.map(i => i.k));
    const has = (...ks) => td ? ks.includes(T) : ks.some(k => kinds.has(k)), only = (...ks) => td ? ks.includes(T) : [...kinds].every(k => ks.includes(k));
    const first = (...ks) => list.find(i => ks.includes(i.k));
    const val = (prop, def, ...ks) => { if (td) return def; const it = list.find(i => (!ks.length || ks.includes(i.k)) && propValue(i, prop) !== undefined); return it ? propValue(it, prop) ?? def : def; };
    return { td, T, has, only, first, val, one: list.length === 1 ? list[0] : null, bd: BD() };
  }
  function ctxHTML(list) {
    const c = ctxOf(list), { td, T, has, only, first, val, one, bd } = c, g = [];
    if (td && (PENS[tool] || tool === 'eraser' || tool === 'lasso') && !atelierFull()) {
      const pr = penPref(penKind), t = sizeT(penKind, pr.s), d = clamp(pr.s, 2, 22);
      g.push(`<div class="seg sm ic qpens">${FAST_PENS.map((k, i) => `<button data-tool="${k}" title="${PENS[k].name} (${i + 1})" aria-pressed="${tool === k}">${icon(PENS[k].icon)}</button>`).join('')}<button data-tool="eraser" title="Gomme à traits : n’efface que le dessin" aria-pressed="${tool === 'eraser' && !eraseAll}">${icon('eraser')}</button><button data-tool="lasso" title="Lasso : entourer des traits pour les sélectionner et les déplacer (Q)" aria-pressed="${tool === 'lasso'}">${icon('lasso')}</button></div>` + (tool === 'lasso' ? '' : BrushLib.chip(tool)));
      if (PENS[tool]) g.push(upBtn());
      if (PENS[tool]) g.push(`<label class="qsize" title="Taille du trait (Ctrl + glisser sur le board)"><span class="qdw"><i class="qdot" style="width:${d}px;height:${d}px;background:${pr.c}"></i></span><input type="range" class="prange" data-psize="1" min="0" max="1" step=".01" value="${t.toFixed(3)}" aria-label="Taille du trait"><b>${sizeText(pr.s)}</b></label>` + qsw('pen', pr.c, 'Couleur du trait'));
      return g.join('<span class="vs"></span>');
    }
    if (td && (PENS[tool] || tool === 'eraser' || tool === 'lasso')) {
      const pr = penPref(penKind);
      g.push(`<div class="seg sm ic qpens">${PEN_ORDER.slice(0, 8).map(k => `<button data-tool="${k}" title="${PENS[k].name} (${PEN_ORDER.indexOf(k) + 1})" aria-pressed="${tool === k}">${icon(PENS[k].icon)}</button>`).join('')}<button data-tool="eraser" title="Gomme à traits : n’efface que le dessin" aria-pressed="${tool === 'eraser' && !eraseAll}">${icon('eraser')}</button><button data-tool="lasso" title="Lasso : entourer des traits pour les sélectionner et les déplacer (Q)" aria-pressed="${tool === 'lasso'}">${icon('lasso')}</button></div>`);
      if (PENS[tool]) g.push(upBtn());
      if (PENS[tool]) g.push(`<button class="qb pchip" data-opp="1" title="${PENS[penKind].name} : taille, opacité, forme, texture">${brushPreview(penKind, Object.assign({}, pr, { s: Math.min(pr.s, 10) }), 64, 20, isDarkTheme())}<span>${sizeText(pr.s)}</span></button>` + qsw('pen', pr.c, 'Couleur du stylo'));
      return g.join('<span class="vs"></span>');
    }
    if (td && !['shape', 'conn', 'text', 'note', 'todo'].includes(T)) return '';
    /* colours */
    const cols = [];
    if (only('frame')) cols.push(qsw('ftc', list[0].tc, 'Couleur du titre du cadre'), qsw('ffc', list[0].fc, 'Fond du cadre'));
    if (only('todo') && list[0] && !list[0].nt) cols.push(qsw('ttc', list[0].ttc, 'Couleur du titre de la liste'));
    else if (only('mind')) cols.push(qsw('sc', val('sc', null, 'mind'), 'Couleur de la branche'));
    else if (only('note', 'todo')) cols.push(qsw('fc', td ? (T === 'note' ? noteColor : '#FFFFFF') : val('fc', null, 'note', 'todo'), 'Couleur'));
    else {
      if (has(...SC_KINDS)) cols.push(qsw('sc', td ? (T === 'conn' ? bd.csc : bd.sc) : val('sc', null, ...SC_KINDS), only('text') ? 'Couleur du texte' : only('ink') ? 'Couleur du trait' : 'Couleur du trait ou du contour'));
      if (has('shape')) cols.push(qsw('fc', td ? bd.fc : val('fc', null, 'shape'), 'Fond'));
      if (only('shape')) cols.push(qbtn('styles', styleThumb(td ? null : first('shape'), 18), 'Styles : réglages tout prêts (appui long : glisser sur un style et relâcher)', false));
    }
    if (cols.length) g.push(cols.join(''));
    /* shape, stroke, arrow heads, text */
    const st = [];
    if (only('shape')) { const sh = td ? shapeKind : val('sh', 'rect', 'shape'); st.push(qbtn('shape', icon(sh === 'starsh' ? 'starsh' : sh), 'Forme')); }
    if (has('shape', 'conn')) { const sw = val('sw', bd.sw || 2, 'shape', 'conn'), dash = val('dash', bd.dash || '', 'shape', 'conn'); st.push(qbtn('stroke', pline('M4 8h32', ` stroke-width="${sw >= 4 ? 4 : sw >= 2 ? 2.6 : 1.4}"${dash === 'dash' ? ' stroke-dasharray="6 4"' : dash === 'dot' ? ' stroke-dasharray="1 4"' : ''}`), 'Trait : épaisseur, style, tracé')); }
    if (only('conn')) st.push(qbtn('heads', td ? icon(T === 'conn' && tool === 'line' ? 'line' : (bd.route === 'elbow' ? 'elbow' : bd.route === 'straight' ? 'line' : 'conn')) : headIcon(val('h1', 'arrow', 'conn')), td ? 'Tracé des flèches' : 'Pointes et tracé'));
    if (has('note', 'text', 'shape', 'todo')) st.push(qbtn('text', `<span class="qaa" style="font-family:${fontOf(td ? bd.font || HAND : (first('note', 'text', 'shape', 'todo') || {}).font || HAND)}">Aa</span>`, 'Texte : police, taille, alignement'));
    if (one && one.k === 'image') st.push(qbtn('frm', icon('image'), 'Cadre de l’image'));
    if (st.length) g.push(st.join(''));
    if (td && T === 'text') g.push(qact('multitext', 'multitext', 'MultiText : écrire plusieurs blocs de texte avec la même mise en forme', 'MultiText'));
    if (upKind()) g.push(upBtn());
    if (td) return g.join('<span class="vs"></span>');
    /* actions */
    const ac = [];
    if (list.some(i => i.lock)) return (one && one.k === 'plan' ? qact('pdim', 'moon', 'Assombrir le planning') : '') + qact('unlock', 'unlock', 'Déverrouiller', 'Déverrouiller');
    if (one && one.k === 'plan') { ac.push(qact('pdim', 'moon', 'Assombrir le planning'), qact('pset', 'cal', 'Réglages du planning : lien iCal, période, heures, couleurs (double-clic)')); if (one.src) ac.push(qact('prefresh', 'restore', 'Mettre à jour depuis le lien iCal')); }
    if (false && one && one.k === 'frame' && one.ui) { g.push(`<div class="seg sm uqs">${UI_FIDS.map(([v, l]) => `<button data-qa="uif-${v}" aria-pressed="${one.ui === v}" title="Rendu de la zone : ${l}">${l}</button>`).join('')}</div>`); ac.push(qact('uilib', 'layout', 'Bibliothèque de blocs', 'Blocs'), qact('uitest', 'play', 'Tester les interactions de la zone', 'Tester')); }
    if (one && one.k === 'uic' && one.t === 'box') g.push(`<div class="seg sm uqs" title="Layout du conteneur">${UI_LAYS.map(([v, l, t]) => `<button data-qa="uil-${v}" aria-pressed="${ukBoxStyle(one).lay === v}" title="${esc(t)}">${l}</button>`).join('')}</div>`);
    if (list.length > 1 && list.every(i => i.k === 'uic')) g.push(`<div class="seg sm uqs" title="Mettre en layout, comme Qt Designer">${[['h', 'Ligne', 'Ctrl 1'], ['v', 'Colonne', 'Ctrl 2'], ['grid', 'Grille', 'Ctrl 5']].map(([v, l, k]) => `<button data-qa="uiwrap-${v}" title="Mettre en layout : ${l.toLowerCase()} (${k})">${l}</button>`).join('')}</div>`);
    if (one && one.k === 'uic' && one.t !== 'spacer') ac.push(qact('uiedit', 'text', 'Modifier le texte (double-clic, Entrée)', 'Texte'));
    if (one && one.k === 'mind') ac.push(qact('mchild', 'plus', 'Ajouter une idée (Tab)'));
    if (one && one.k === 'conn') ac.push(qact('label', 'text', 'Ajouter un texte sur la flèche'));
    if (one && ['link', 'doc', 'task'].includes(one.k)) ac.push(qact('open', 'ext', 'Ouvrir'));
    if (one && one.k === 'frame') ac.push(qact('frename', 'text', 'Renommer le cadre (ou touchez son titre)', 'Renommer'));
    if (one && one.k === 'paint') ac.push(qact('pinfo', 'drop', 'Infos couleur : codes, harmonies, utiliser pour dessiner', 'Infos'));
    if (list.some(i => i.g)) ac.push(qact('ungroup', 'ungroup', 'Dégrouper (Ctrl Alt G)'));
    else if (list.filter(i => !(i.k === 'mind' && i.parent)).length > 1) ac.push(qact('group', 'group', 'Grouper (Ctrl G)'));
    ac.push(qact('lock', 'lock', 'Verrouiller : l’élément ne bouge plus (Ctrl Maj L)'), qact('dup', 'dup', 'Dupliquer (Ctrl D)'), qact('del', 'trash', 'Supprimer (Suppr)'), qact('more', 'dots', 'Plus : ordre, opacité, ranger…'));
    g.push(ac.join(''));
    return g.join('<span class="vs"></span>');
  }
  let connMeas = null;
  function connBox(c) {
    const g = connGeom(c, byId), pad = 10 + (c.sw || 2) * 2;
    let x0 = Math.min(g.a[0], g.b[0]), y0 = Math.min(g.a[1], g.b[1]), x1 = Math.max(g.a[0], g.b[0]), y1 = Math.max(g.a[1], g.b[1]);
    for (const p of g.pts || []) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    try {
      if (!connMeas) { const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden'); connMeas = document.createElementNS('http://www.w3.org/2000/svg', 'path'); sv.append(connMeas); document.body.append(sv); }
      connMeas.setAttribute('d', g.d); const k = connMeas.getBBox(); if (k.width || k.height) { x0 = Math.min(x0, k.x); y0 = Math.min(y0, k.y); x1 = Math.max(x1, k.x + k.width); y1 = Math.max(y1, k.y + k.height); }
    } catch (e) {}
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }
  let qPin = null, qPinKey = '';
  function renderQuick(list, dragging) {
    const show = list.length && !dragging && !(op && op.kind === 'marquee') && !editing && !wrap.classList.contains('drawing');
    if (!show) { qbarEl.hidden = true; qSig = ''; return; }
    const html = ctxHTML(list);
    if (html !== qSig) { qSig = html; qbarEl.innerHTML = `<button class="qgrip" title="Glisser pour déplacer la barre (elle revient au-dessus à la prochaine sélection)" aria-label="Déplacer la barre"></button>` + html; }
    qbarEl.hidden = false; if (S.prefs.qbarPin) { delete S.prefs.qbarPin; save(); }
    /* 0.2.82: the grip moves the bar for the current selection only; a new selection puts it back above (qPin, not saved) */
    const qk = list.map(i => i.id).join(','); if (qk !== qPinKey) { qPin = null; qPinKey = qk; }
    if (qPin) { const W = wrap.clientWidth, H = wrap.clientHeight, w = qbarEl.offsetWidth, hh = qbarEl.offsetHeight; qbarEl.style.left = clamp(qPin.x, 8, Math.max(8, W - w - 8)) + 'px'; qbarEl.style.top = clamp(qPin.y, 8, Math.max(8, H - hh - 8)) + 'px'; return; }
    // the box of everything selected, arrows included with their curve, head and end handles (0.2.22)
    let bb = unionBox(list.filter(i => i.k !== 'conn'));
    for (const c of list.filter(i => i.k === 'conn')) { const q = connBox(c); bb = bb ? [Math.min(bb[0], q[0]), Math.min(bb[1], q[1]), Math.max(bb[2], q[2]), Math.max(bb[3], q[3])] : q; }
    let a = toS(bb[0], bb[1]), b = toS(bb[2], bb[3]); const r = hostRect(), w = qbarEl.offsetWidth, hh = qbarEl.offsetHeight, GAP = list.some(ROTABLE) ? 56 : 42;   // room for the turn handle (0.2.25)
    if (view.r) { const q = [[a.x, a.y], [b.x, a.y], [a.x, b.y], [b.x, b.y]].map(([x, y]) => { const t = view.r * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t), W = r.width / 2, H = r.height / 2; return [(x - W) * c - (y - H) * sn + W, (x - W) * sn + (y - H) * c + H]; }); a = { x: Math.min(...q.map(p => p[0])), y: Math.min(...q.map(p => p[1])) }; b = { x: Math.max(...q.map(p => p[0])), y: Math.max(...q.map(p => p[1])) }; }   // clears the side dots and the radius handle above the selection
    let x = (a.x + b.x) / 2 - w / 2, y = a.y - hh - GAP;
    if (y < 64) y = b.y + GAP;
    if (y + hh > r.height - 70) y = Math.max(64, a.y - hh - GAP);
    qbarEl.style.left = clamp(x, 8, Math.max(8, r.width - w - 8)) + 'px'; qbarEl.style.top = clamp(y, 8, Math.max(8, r.height - hh - 8)) + 'px';
  }
  /* a click in either bar */
  function ctxClick(e) {
    const t = e.target;
    const tb = t.closest('[data-tool]'); if (tb) { setTool(tb.dataset.tool); if (tb.dataset.tool === 'eraser') { eraseAll = false; refreshTools(); } return; }
    const qc = t.closest('[data-qc]'); if (qc) { ctxColor(qc.dataset.qc, qc); return; }
    const qp = t.closest('[data-qp]'); if (qp) { if (qp.dataset.qp === 'upreset') upSave(); else ctxPop(qp.dataset.qp, qp); return; }
    const qa = t.closest('[data-qa]'); if (qa) { if (qa.dataset.qa === 'more') ctxMore(qa); else action(qa.dataset.qa, qa); return; }
    const bl = t.closest('[data-blib]'); if (bl) { if (!ALPHA_PENS.includes(tool)) setTool(BrushLib.lastAlpha()); const btn = $('[data-blib]', optsEl) || bl; BrushLib.open(btn, { pen: () => tool, setPen: k => setTool(k), changed: final => { if (final) { if (optsEl) optsEl._h = ''; refreshTools(); Studio.sync(); } } }); return; }
    const pp = t.closest('[data-opp]'); if (pp) { const pop = openPop(pp, `<div class="pp-wrap">${PenPanel.html(penKind)}</div>`, { cls: 'pppop', focus: false }); PenPanel.bind(pop, { pen: () => penKind, setPen: k => { closePop(); setTool(k); }, changed: partial => { if (!partial) { refreshTools(); propSig = ''; renderProps(); const k = penKind; const w = $('.pp-wrap', pop); if (w && pop.isConnected) w.innerHTML = PenPanel.html(k); } } }); return; }
  }
  function ctxColor(prop, btn) {
    if (prop === 'pen') { Colors.open(btn, { value: penPref(penKind).c, onPick: (c, final) => { if (!c) return; S.prefs.pens[penKind].c = c; save(); const d = $('[data-tool="pen"] .cdot', toolsEl); if (d) d.style.background = c; if (final) { refreshTools(); propSig = ''; renderProps(); Studio.sync(); } } }); return; }
    const list = selItems(), notes = list.length ? list.every(i => i.k === 'note' || i.k === 'todo') : tool === 'note' || tool === 'todo';
    if (prop === 'ttc') { const f = list.find(i => i.k === 'todo'); Colors.open(btn, { value: f && f.ttc || '#1E1E1E', none: true, onPick: (v, final) => { setProp('ttc', v, !final); if (final) qSig = ''; } }); return; }
    if (prop === 'ftc' || prop === 'ffc') { const f = list.find(i => i.k === 'frame'); Colors.open(btn, { value: f && f[prop === 'ftc' ? 'tc' : 'fc'] || (prop === 'ftc' ? '#1E1E1E' : '#FFFFFF'), none: true, onPick: (v, final) => { setProp(prop, v, !final); if (final) qSig = ''; } }); return; }
    const it = list.find(i => (prop === 'fc' ? ['shape', 'note', 'todo'] : SC_KINDS).includes(i.k));
    const cur = it ? propValue(it, prop) : prop === 'fc' ? (tool === 'note' ? noteColor : BD().fc) : tool === 'conn' || tool === 'line' ? BD().csc : BD().sc;
    const ap = prop === 'fc' ? 'fo' : 'so', shp = list.find(i => i.k === 'shape');
    Colors.open(btn, { value: cur, none: prop === 'fc' && !notes, onPick: (v, final) => { if (!v && notes) return; setProp(prop, v, !final); if (final) qSig = ''; },
      alpha: shp ? { value: shp[ap] ?? 1, set: (a, final) => { setProp(ap, a, !final); if (final) qSig = ''; } } : null });
  }
  function ctxPop(id, btn) {
    const list = selItems(), c = ctxOf(list), { td, val, bd } = c;
    let h = '';
    if (id === 'shape') h = `<div class="shgrid" data-set="sh">${Object.entries(SHAPES).map(([k, l]) => `<button data-v="${k}" aria-pressed="${k === (td ? shapeKind : val('sh', 'rect', 'shape'))}" title="${l}">${icon(k)}</button>`).join('')}</div>`;
    if (id === 'stroke') h = sec(swLabel(+val('sw', bd.sw || 2, 'shape', 'conn') || 2), seg('sw', val('sw', bd.sw || 2, 'shape', 'conn'), [[1, pline('M4 8h32', ' stroke-width="1.4"'), 'Fin'], [2, pline('M4 8h32', ' stroke-width="2.6"'), 'Moyen'], [4, pline('M4 8h32', ' stroke-width="4.2"'), 'Épais']], 'ic') + swSlide(+val('sw', bd.sw || 2, 'shape', 'conn') || 2))
      + sec('Style', seg('dash', val('dash', bd.dash || '', 'shape', 'conn') || '', [['', pline('M4 8h32'), 'Continu'], ['dash', pline('M4 8h32', ' stroke-dasharray="6 4"'), 'Tirets'], ['dot', pline('M4 8h32', ' stroke-dasharray="1 4"'), 'Pointillés']], 'ic'))
      + sec('Tracé', seg('sty', val('sty', bd.sty || 'sketch', 'shape', 'conn'), [['clean', pline('M4 8h32'), 'Net'], ['sketch', pline('M4 9c6-3 12 2 18-1s8-2 14 0'), 'Croquis'], ['wild', pline('M4 10c4-6 8 4 12-2s6 6 10-2 6 4 10 0'), 'Fou']], 'ic'))
      + (c.has('shape') && (td ? bd.fc : list.some(i => i.k === 'shape' && i.fc)) ? sec('Remplissage', seg('fill', val('fill', bd.fill || 'solid', 'shape'), [['solid', 'Plein'], ['hachure', 'Hachures']])) : '')
      + (!td && c.has('shape') ? radSlide(list) : '');
    if (id === 'heads') h = (td ? '' : sec('Départ', seg('h0', val('h0', 'none', 'conn'), Object.keys(HEADS).map(k => [k, headIcon(k), HEADS[k]]), 'ic heads1')) + sec('Arrivée', seg('h1', val('h1', 'arrow', 'conn'), Object.keys(HEADS).map(k => [k, headIcon(k), HEADS[k]]), 'ic heads1')))
      + (td && tool === 'line' ? '' : sec('Tracé', seg('route', td ? bd.route || 'curve' : val('route', 'curve', 'conn'), [['curve', icon('conn'), 'Courbe'], ['straight', icon('line'), 'Droit'], ['elbow', icon('elbow'), 'Coudé']], 'ic')));
    if (id === 'text') {
      const f = c.first('note', 'text', 'shape', 'todo');
      h = sec('Police', seg('font', td ? bd.font || HAND : (f && f.font) || HAND, [[HAND, '<span style="font-family:var(--font-hand);font-size:17px">Aa</span>', 'Manuscrite'], [SANS, '<span>Aa</span>', 'Normale'], [MONO, '<span style="font-family:var(--font-mono);font-size:12px">Aa</span>', 'Code']], 'ic'));
      if (!td) {
        h += sec('Taille', seg('fs', fsLevel(f), [[0, 'S'], [1, 'M'], [2, 'L'], [3, 'XL']]));
        if (c.has('note', 'text')) h += sec('Alignement', seg('al', (c.first('note', 'text') || {}).al || 'left', [['left', icon('al-l'), 'À gauche'], ['center', icon('al-c'), 'Centré'], ['right', icon('al-r'), 'À droite']], 'ic'));
        if (c.has('note', 'text')) h += sec('Liste', seg('ls', (c.first('note', 'text') || {}).ls || '', [['', 'Aucune'], ['ul', '• Puces'], ['ol', '1. Numéros']]));
        if (c.only('text')) h += sec('Style', `<div class="qrow">${seg('bold', !!f.bold, [[false, 'Normal'], [true, '<b>Gras</b>']])}${seg('ital', !!f.ital, [[false, 'Droit'], [true, '<i>Italique</i>']])}</div>`);
      }
    }
    if (id === 'styles') {
      const mine = S.prefs.shStyles || [];
      h = sec('Styles', `<div class="stgrid">${SHAPE_STYLES.map((s, i) => `<button data-sty="${i}" title="${esc(s.n)}">${styleThumb(styleItem(s), 34)}<span>${esc(s.n)}</span></button>`).join('')}</div>`)
        + (mine.length ? sec('Mes styles', `<div class="stgrid">${mine.map((s, i) => `<button data-sty="m${i}" title="${esc(s.n)} · clic droit : retirer">${styleThumb(styleItem(s), 34)}<span>${esc(s.n)}</span></button>`).join('')}</div>`) : '')
        + (c.first('shape') ? `<button class="stsave" data-stsave="1">${icon('plus', 'sm')}<span>Enregistrer le style de la sélection</span></button>` : '');
      const p = openPop(btn, `<div class="qpop-b">${h}</div>`, { cls: 'qpop stpop', focus: false });
      p.addEventListener('click', e => {
        const b = e.target.closest('[data-sty]'); if (b) { const v = b.dataset.sty; applyStyle(v[0] === 'm' ? mine[+v.slice(1)] : SHAPE_STYLES[+v]); closePop(); return; }
        if (e.target.closest('[data-stsave]')) { const f = c.first('shape'); const st = { n: 'Style ' + (mine.length + 1), p: { sc: f.sc || null, fc: f.fc || null, sw: f.sw || 2, sty: f.sty || 'clean', dash: f.dash || '', fill: f.fill || 'solid', fo: f.fo ?? 1, so: f.so ?? 1 } }; S.prefs.shStyles = mine.concat(st).slice(-8); save(); closePop(); toast('Style enregistré dans « Mes styles »'); }
      });
      p.addEventListener('contextmenu', e => { const b = e.target.closest('[data-sty^="m"]'); if (!b) return; e.preventDefault(); S.prefs.shStyles = mine.filter((_, i) => i !== +b.dataset.sty.slice(1)); save(); closePop(); });
      return;
    }
    if (id === 'frm') h = seg('frm', val('frm', 'shadow', 'image'), [['shadow', 'Ombre'], ['polaroid', 'Polaroïd'], ['square', 'Carré'], ['none', 'Simple']]);
    if (!h) return;
    const p = openPop(btn, `<div class="qpop-b">${h}</div>`, { cls: 'qpop', focus: false });
    bindSlides(p);
    p.addEventListener('click', e => {
      if (e.target.closest('[data-set="sw"] [data-v]')) { const r = $('input[data-prop="sw"]', p), v = +e.target.closest('[data-v]').dataset.v; if (r) { r.value = v; const l = $('b[data-v="sw"]', p); if (l) l.textContent = fmtV(v, 'px'); } }
      const sv = e.target.closest('[data-set] [data-v]'); if (!sv) return;
      const box = sv.closest('[data-set]'), prop = box.dataset.set, v = sv.dataset.v;
      setProp(prop, v === 'true' ? true : v === 'false' ? false : v);
      box.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', b === sv));
      if (id === 'shape' || id === 'frm') closePop();
    });
  }
  /* shape styles (0.2.25): ready-made outline / fill / stroke sets; colours are numbers of the theme's scheme, so a style
     follows the theme. Mine are saved from a selection (S.prefs.shStyles, colours as they are) */
  const SHAPE_STYLES = [
    { n: 'Trait', p: { sc: 1, fc: null, sw: 2, sty: 'clean', dash: '', fill: 'solid', so: 1 } },
    { n: 'Croquis', p: { sc: 1, fc: null, sw: 2, sty: 'sketch', dash: '', fill: 'solid', so: 1 } },
    { n: 'Pastel', p: { sc: 2, fc: 15, sw: 1.5, sty: 'clean', dash: '', fill: 'solid', fo: 1, so: 1 } },
    { n: 'Teinte', p: { sc: 5, fc: 5, sw: 2, sty: 'clean', dash: '', fill: 'solid', fo: .18, so: 1 } },
    { n: 'Plein', p: { sc: 5, fc: 5, sw: 2, sty: 'clean', dash: '', fill: 'solid', fo: 1, so: 1 } },
    { n: 'Encre', p: { sc: 1, fc: 1, sw: 2, sty: 'clean', dash: '', fill: 'solid', fo: 1, so: 1 } },
    { n: 'Tirets', p: { sc: 3, fc: null, sw: 2, sty: 'clean', dash: 'dash', fill: 'solid', so: 1 } },
    { n: 'Hachures', p: { sc: 1, fc: 6, sw: 2, sty: 'sketch', dash: '', fill: 'hachure', fo: 1, so: 1 } },
    { n: 'Épais', p: { sc: 1, fc: null, sw: 5, sty: 'clean', dash: '', fill: 'solid', so: 1 } },
    { n: 'Fantôme', p: { sc: 3, fc: 4, sw: 1, sty: 'clean', dash: 'dot', fill: 'solid', fo: .6, so: .8 } }
  ];
  const styleHex = v => typeof v === 'number' ? schemeHex(v) : v;
  const styleItem = s => { const o = {}; for (const k in s.p) o[k] = k === 'sc' || k === 'fc' ? styleHex(s.p[k]) : s.p[k]; return o; };
  function styleThumb(it, sz) {
    const p = it || { sc: inkColor(BD().sc), fc: BD().fc, sw: BD().sw || 2, dash: BD().dash, fill: BD().fill };
    const sw = clamp((p.sw || 2) * sz / 34, 1, sz / 6), d = p.dash === 'dash' ? ` stroke-dasharray="${sw * 2.4} ${sw * 1.6}"` : p.dash === 'dot' ? ` stroke-dasharray="0.1 ${sw * 2}" stroke-linecap="round"` : '', m = sw / 2 + 1, w = sz - m * 2;
    const hatch = p.fill === 'hachure' && p.fc ? Array.from({ length: 5 }, (_, i) => `<path d="M${m + i * w / 4} ${m + w}l${w / 3} ${-w}" stroke="${p.fc}" stroke-width="${Math.max(1, sw * .7)}"/>`).join('') : '';
    return `<svg class="sthumb" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}"><rect x="${m}" y="${m}" width="${w}" height="${w}" rx="${sz / 7}" fill="${p.fc && p.fill !== 'hachure' ? p.fc : 'none'}" fill-opacity="${p.fo ?? 1}"/>${hatch}<rect x="${m}" y="${m}" width="${w}" height="${w}" rx="${sz / 7}" fill="none" stroke="${p.sc ? inkColor(p.sc) : 'none'}" stroke-opacity="${p.so ?? 1}" stroke-width="${sw}"${d}/></svg>`;
  }
  /* one undo step for the whole style */
  function applyStyle(s) {
    if (!s) return; const pr = Object.entries(styleItem(s)), list = selItems();
    if (!list.length) { for (const [k, v] of pr) if (k !== 'fo' && k !== 'so') setProp(k, v); return; }
    pr.forEach(([k, v], i) => setProp(k, v, i < pr.length - 1)); qSig = '';
  }
  /* ---------- user presets (0.2.48): the options of the element or tool at hand, saved per kind ----------
     S.prefs.upresets = { kind: [{ id, n, p }] }, S.prefs.updef = { kind: id } (the default template, in every board).
     Kinds: shape, conn (arrows and lines), text, note (post-its and lists) and pen:<brush>. */
  const UP_PROPS = { shape: ['sc', 'fc', 'sw', 'sty', 'dash', 'fill', 'fo', 'so', 'font'], conn: ['sc', 'sw', 'dash', 'sty', 'h0', 'h1', 'route'], text: ['sc', 'font', 'fs', 'al', 'bold', 'ital'], note: ['fc', 'font', 'fs', 'al'] };
  const UP_NAMES = { shape: 'formes', conn: 'flèches', text: 'textes', note: 'post-it' };
  const upOf = k => k === 'line' ? 'conn' : k === 'todo' ? 'note' : k;
  function upKind() {
    const list = selItems();
    if (!list.length) { if (PENS[tool]) return 'pen:' + penKind; const k = upOf(tool); return UP_PROPS[k] ? k : ''; }
    const ks = new Set(list.map(i => upOf(i.k))); if (ks.size !== 1) return ''; const k = [...ks][0]; return UP_PROPS[k] ? k : '';
  }
  const upList = k => ((S.prefs.upresets || {})[k] || []);
  const upBtn = () => `<button class="qb qup" data-qp="upreset" title="User Preset : clic = enregistrer ces options · appui long = mes presets" aria-label="User Preset">${icon('star')}<svg class="qchev" viewBox="0 0 8 8"><path d="M1.5 3 4 5.5 6.5 3"/></svg></button>`;
  function upCapture(k) {
    if (k.startsWith('pen:')) { const pk = k.slice(4); return JSON.parse(JSON.stringify(penPref(pk))); }
    const list = selItems(), bd = BD(), p = {};
    const it = list.find(i => upOf(i.k) === k);
    for (const prop of UP_PROPS[k]) {
      let v;
      if (it) v = prop === 'fs' ? it.fs : propValue(it, prop);
      else if (prop === 'sc') v = k === 'conn' ? bd.csc : bd.sc;
      else if (prop === 'fc') v = k === 'note' ? noteColor : bd.fc;
      else v = bd[prop];
      if (v !== undefined) p[prop] = v;
    }
    return p;
  }
  function upSave(name) {
    const k = upKind(); if (!k) return null;
    const all = S.prefs.upresets || (S.prefs.upresets = {}), l = all[k] || (all[k] = []);
    const pr = { id: uid('up'), n: name || 'Preset ' + (l.length + 1), p: upCapture(k) };
    l.push(pr); if (l.length > 24) l.shift(); save(); qSig = '';
    toast(`« ${pr.n} » enregistré · appui long sur ${'★'} pour vos presets`);
    return pr;
  }
  function upApply(k, pr) {
    if (!pr) return;
    if (k.startsWith('pen:')) { const pk = k.slice(4); S.prefs.pens[pk] = Object.assign({}, S.prefs.pens[pk] || {}, JSON.parse(JSON.stringify(pr.p))); save(); if (PENS[tool]) { refreshTools(); Studio.sync(); propSig = ''; renderProps(); } return; }
    const list = selItems(), ent = Object.entries(pr.p).filter(([prop]) => prop !== 'fs');
    if (!list.length) { for (const [prop, v] of ent) setProp(prop, v); if (pr.p.fs != null) S.prefs.bd = Object.assign({}, S.prefs.bd, { fs: pr.p.fs }); save(); qSig = ''; return; }
    if (pr.p.fs != null) ent.push(['fs', fsLevel(Object.assign({}, list[0], { fs: pr.p.fs }))]);
    ent.forEach(([prop, v], i) => setProp(prop, v, i < ent.length - 1)); qSig = '';
  }
  /* the default template: the preset's options become the defaults of new elements of that kind, in every board */
  function upDefault(k, pr) {
    const d = S.prefs.updef || (S.prefs.updef = {});
    if (!pr || d[k] === pr.id) { delete d[k]; save(); toast('Modèle par défaut retiré'); return; }
    d[k] = pr.id;
    if (k.startsWith('pen:')) { const pk = k.slice(4); S.prefs.pens[pk] = Object.assign({}, S.prefs.pens[pk] || {}, JSON.parse(JSON.stringify(pr.p))); }
    else {
      const bd = Object.assign({}, S.prefs.bd);
      for (const [prop, v] of Object.entries(pr.p)) {
        if (prop === 'sc') { const no = v ? schemeNo(v) : 0; bd[k === 'conn' ? 'csc' : 'sc'] = no ? '@' + no : v; }
        else if (prop === 'fc') { if (k === 'note') noteColor = v || noteColor; else { const no = v ? schemeNo(v) : 0; bd.fc = no ? '@' + no : v; } }
        else if (['sw', 'sty', 'dash', 'fill', 'font', 'route'].includes(prop)) bd[prop] = v;
      }
      S.prefs.bd = bd;
    }
    save(); refreshTools(); propSig = ''; renderProps(); qSig = '';
    toast(`« ${pr.n} » est le modèle par défaut des ${k.startsWith('pen:') ? PENS[k.slice(4)].name.toLowerCase() : UP_NAMES[k]}`);
  }
  function upThumb(k, p) {
    if (k === 'shape') return styleThumb({ sc: p.sc, fc: p.fc, sw: p.sw, dash: p.dash, fill: p.fill, fo: p.fo, so: p.so }, 30);
    if (k.startsWith('pen:')) { try { return brushPreview(k.slice(4), Object.assign({}, p, { s: Math.min(p.s || 3, 8) }), 44, 22, isDarkTheme()); } catch (e) { return `<i class="pm-sw" style="background:${p.c}"></i>`; } }
    if (k === 'conn') return `<svg viewBox="0 0 40 16" class="pl" style="color:${inkColor(p.sc || '#333')}"><path d="M4 8H30" fill="none" stroke="currentColor" stroke-width="${clamp(p.sw || 2, 1, 5)}"${p.dash === 'dash' ? ' stroke-dasharray="5 3"' : p.dash === 'dot' ? ' stroke-dasharray="1 3"' : ''} stroke-linecap="round"/><path d="M28 3l8 5-8 5z" fill="currentColor"/></svg>`;
    if (k === 'note') return `<span class="up-note" style="background:${p.fc || '#FFE58A'};font-family:${fontOf(p.font || HAND)}">Aa</span>`;
    return `<span class="up-txt" style="color:${inkColor(p.sc || '#222')};font-family:${fontOf(p.font || HAND)};font-weight:${p.bold ? 700 : 400};font-style:${p.ital ? 'italic' : 'normal'}">Aa</span>`;
  }
  function upGallery(btn) {
    const k = upKind(); if (!k) return;
    const l = upList(k), def = (S.prefs.updef || {})[k];
    const name = k.startsWith('pen:') ? PENS[k.slice(4)].name : UP_NAMES[k];
    const p = openPop(btn, `<div class="qpop-b uppop"><div class="ps"><div class="ps-l">Mes presets · ${esc(name)}</div>
      ${l.length ? `<div class="upgrid">${l.map(pr => `<button class="up-i${pr.id === def ? ' def' : ''}" data-up="${pr.id}" title="${esc(pr.n)}${pr.id === def ? ' (par défaut)' : ''} · clic droit : options">${upThumb(k, pr.p)}<span>${esc(pr.n)}</span>${pr.id === def ? `<b class="up-def">${icon('check', 'sm')}</b>` : ''}</button>`).join('')}</div>` : '<div class="pp-hint">Aucun preset pour l’instant. Un clic sur l’étoile enregistre les options actuelles.</div>'}</div>
      <button class="stsave" data-upadd="1">${icon('plus', 'sm')}<span>Ajouter un preset personnalisé</span></button>
      <button class="stsave" data-updef="1">${icon('check', 'sm')}<span>Utiliser comme modèle par défaut</span></button>
      <div class="pp-hint">« Modèle par défaut » : les options actuelles servent pour chaque nouvel élément, dans tous les boards.</div></div>`, { cls: 'qpop stpop', focus: false });
    p.addEventListener('click', e => {
      const b = e.target.closest('[data-up]'); if (b) { upApply(k, l.find(x => x.id === b.dataset.up)); closePop(); return; }
      if (e.target.closest('[data-upadd]')) { closePop(); upSave(); return; }
      if (e.target.closest('[data-updef]')) { closePop(); const cur = upCapture(k), same = l.find(x => JSON.stringify(x.p) === JSON.stringify(cur)); upDefault(k, same && same.id !== def ? same : same ? null : upSave('Par défaut')); }
    });
    p.addEventListener('contextmenu', e => {
      const b = e.target.closest('[data-up]'); if (!b) return; e.preventDefault(); const pr = l.find(x => x.id === b.dataset.up);
      openPop({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 }, [
        { label: pr.id === def ? 'Ne plus utiliser par défaut' : 'Utiliser comme modèle par défaut', icon: 'check', run: () => upDefault(k, pr) },
        { label: 'Renommer', icon: 'text', run: () => { const n = prompt('Nom du preset', pr.n); if (n && n.trim()) { pr.n = n.trim().slice(0, 40); save(); } } },
        { label: 'Supprimer', icon: 'trash', danger: true, run: () => { S.prefs.upresets[k] = l.filter(x => x !== pr); if (def === pr.id) delete S.prefs.updef[k]; save(); } }]);
    });
  }
  /* press and hold a colour or the styles in a bar: the choices open around the finger or the pencil without lifting it;
     slide onto one and let go to take it (lift elsewhere: nothing changes). A quick tap still opens the full popover. */
  const HOLD_MS = 170;
  let pressSkip = 0, pressBtn = null;
  function pressChoices(b) {
    if (b.dataset.qp === 'styles') return SHAPE_STYLES.map(s => ({ html: styleThumb(styleItem(s), 30), name: s.n, run: () => applyStyle(s) })).concat((S.prefs.shStyles || []).map(s => ({ html: styleThumb(styleItem(s), 30), name: s.n, run: () => applyStyle(s) })));
    const prop = b.dataset.qc, sch = scheme(), list = selItems();
    const out = sch.map((c, i) => ({ html: `<i class="pm-sw" style="background:${c}"></i>`, name: SCHEME_NAMES[i], run: () => {
      if (prop === 'pen') { if (!S.prefs.pens[penKind]) S.prefs.pens[penKind] = {}; S.prefs.pens[penKind].c = c; save(); refreshTools(); Studio.sync(); return; }
      setProp(prop, c); qSig = ''; } }));
    if (prop === 'fc' && !(list.length ? list.every(i => i.k === 'note' || i.k === 'todo') : tool === 'note' || tool === 'todo')) out.push({ html: '<i class="pm-sw none"></i>', name: 'Sans fond', run: () => { setProp('fc', null); qSig = ''; } });
    return out;
  }
  function bindPress(bar) {
    bar.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-qc],[data-qp="styles"],[data-qp="upreset"]'); if (!b || e.button !== 0) return;
      const pid = e.pointerId, x0 = e.clientX, y0 = e.clientY, up = b.dataset.qp === 'upreset';
      const off = () => { clearTimeout(t); removeEventListener('pointermove', mv, true); removeEventListener('pointerup', off, true); removeEventListener('pointercancel', off, true); };
      const go = ev => { off(); if (up) { pressSkip = performance.now() + 400; pressBtn = b; upGallery(b); return; } openPress(b, ev || e); };
      const mv = ev => { if (!up && ev.pointerId === pid && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 9) go(ev); };
      const t = setTimeout(() => go(), up ? 380 : HOLD_MS);
      addEventListener('pointermove', mv, true); addEventListener('pointerup', off, true); addEventListener('pointercancel', off, true);
    });
    bar.addEventListener('click', e => { if (performance.now() - pressSkip < 350 && pressBtn && pressBtn.contains(e.target)) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    bar.addEventListener('contextmenu', e => { const b = e.target.closest('[data-qp="upreset"]'); if (b) { e.preventDefault(); upGallery(b); } });
  }
  function openPress(b, e) {
    closePop(); const ch = pressChoices(b); if (!ch.length) return;
    const pid = e.pointerId, r = b.getBoundingClientRect(), cols = ch.length > 12 ? 5 : 4;
    const m = document.createElement('div'); m.className = 'pressm' + (b.dataset.qp === 'styles' ? ' sty' : '');
    m.innerHTML = `<div class="pm-l">${b.dataset.qp === 'styles' ? 'Styles' : 'Couleur'}</div><div class="pm-g" style="grid-template-columns:repeat(${cols},auto)">${ch.map((c, i) => `<button class="pm-i" data-pv="${i}" style="--d:${Math.min(i, 14) * 14}ms" aria-label="${esc(c.name)}">${c.html}</button>`).join('')}</div>`;
    document.body.append(m);
    const w = m.offsetWidth, h = m.offsetHeight, up = r.top - h - 12 > 8;
    const x = clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8), y = up ? r.top - h - 12 : Math.min(innerHeight - h - 8, r.bottom + 12);
    m.style.left = x + 'px'; m.style.top = y + 'px'; m.style.transformOrigin = `${r.left + r.width / 2 - x}px ${up ? h + 12 : -12}px`;
    b.classList.add('pressing');
    let hot = -1;
    const lab = $('.pm-l', m), base = lab.textContent;
    /* the nearest choice while the point is over the palette (gaps included), none once it leaves it */
    const cells = [...m.querySelectorAll('.pm-i')];
    const track = ev => { if (ev.pointerId !== pid) return; const mr = m.getBoundingClientRect(); let i = -1, best = 1e9;
      if (ev.clientX > mr.left - 10 && ev.clientX < mr.right + 10 && ev.clientY > mr.top - 10 && ev.clientY < mr.bottom + 10) for (const c of cells) { const q = c.getBoundingClientRect(), d = Math.hypot(ev.clientX - (q.left + q.width / 2), ev.clientY - (q.top + q.height / 2)); if (d < best) { best = d; i = +c.dataset.pv; } }
      const it = i >= 0 ? cells[i] : null; if (i === hot) return; if (hot >= 0) m.querySelector(`[data-pv="${hot}"]`).classList.remove('hot'); hot = i; if (i >= 0) { it.classList.add('hot'); lab.textContent = ch[i].name; } else lab.textContent = base; };
    const done = ev => {
      if (ev.pointerId !== pid) return; removeEventListener('pointermove', track, true); removeEventListener('pointerup', done, true); removeEventListener('pointercancel', done, true);
      pressSkip = performance.now(); pressBtn = b; b.classList.remove('pressing');
      if (ev.type === 'pointerup') track(ev);
      const pick = ev.type === 'pointerup' && hot >= 0 ? ch[hot] : null;
      if (pick) { m.querySelector(`[data-pv="${hot}"]`).classList.add('took'); pick.run(); }
      m.classList.add('out'); setTimeout(() => m.remove(), pick ? 260 : 160);
    };
    addEventListener('pointermove', track, true); addEventListener('pointerup', done, true); addEventListener('pointercancel', done, true);
    track(e);
  }
  /* the opacity of a shape's fill or outline, one thin line right under its colours (0.2.24) */
  const opRow = (prop, v) => `<label class="prow"><span>Opacité</span><input type="range" class="prange" data-prop="${prop}" data-u="%" min="0" max="1" step=".05" value="${v}" aria-label="Opacité"><b class="pv" data-v="${prop}">${fmtV(v, '%')}</b></label>`;
  function radSlide(list) {
    const r = list.find(i => i.k === 'shape' && (i.sh === 'rect' || i.sh === 'round')); if (!r) return '';
    return slide('rad', 'Arrondi', Math.round(shapeRad(r.sh, r.w, r.h, r.rad)), 0, Math.round(Math.min(r.w, r.h) / 2), 1, 'px');
  }
  function ctxMore(btn) {
    const list = selItems(); if (!list.length) return;
    const o = list[0].op ?? 1, items2 = [
      { head: 'Ordre' }, { label: 'Tout devant', icon: 'front', small: 'Ctrl Page préc.', run: () => zMove('front') }, { label: 'Avancer', icon: 'up', small: 'Page préc.', run: () => zMove('fwd') }, { label: 'Reculer', icon: 'down', small: 'Page suiv.', run: () => zMove('bwd') }, { label: 'Tout en arrière', icon: 'back', small: 'Ctrl Page suiv.', run: () => zMove('back') }, '-'];
    if (list.filter(i => i.k !== 'conn').length >= 2) items2.push({ label: 'Ranger, aligner, répartir', icon: 'arrange', run: () => arrangeMenu(btn) }, { label: 'Entourer d’un cadre', icon: 'frame', run: () => frameAround(list.filter(i => i.k !== 'conn')) });
    if (list.length === 1 && list[0].k === 'frame') items2.push({ label: 'Ranger le contenu', icon: 'arrange', run: () => arrangeMenu(btn, true) }, { label: 'Ajuster au contenu', icon: 'fit', run: () => fitFrame(list[0]) }, { label: list[0].nt ? 'Afficher le titre' : 'Masquer le titre', icon: 'text', run: () => setProp('ftitle', !!list[0].nt) });
    items2.push({ label: `Opacité · ${Math.round(o * 100)} %`, icon: 'drop', keep: true, run: () => {
      const p = openPop(btn, `<div class="qpop-b">${sec(`Opacité <b class="pv">${Math.round(o * 100)} %</b>`, `<input type="range" class="prange" min=".05" max="1" step=".05" value="${o}" aria-label="Opacité">`)}</div>`, { cls: 'qpop', focus: false });
      const r = $('input', p), lab = $('.pv', p);
      r.addEventListener('input', () => { lab.textContent = Math.round(r.value * 100) + ' %'; setProp('op', +r.value, true); });
      r.addEventListener('change', () => setProp('op', +r.value));
    } }, '-', { label: 'Panneau Attributs', icon: 'sliders', run: () => { setProps(true); propsTab = 'style'; renderProps(true); } });
    openPop(btn, items2, { align: 'right' });
  }

  /* ---------- the Style / Layers / Moodboard panel ---------- */
  const propsOpen = () => propsEl && !propsEl.hidden && !(wrap.classList.contains('drawing') && atelierFull());
  function setProps(on) { S.prefs.props = on; save(); propsEl.hidden = !on; wrap.classList.toggle('props-open', on); $('[data-a="props"]', trEl).setAttribute('aria-pressed', on); propSig = ''; renderOverlay(); layoutChanged(); }
  const SW_OPTS = [[1, 'Fin'], [2, 'Moyen'], [4, 'Épais']];
  const FS_TABLE = { note: [22, 30, 40, 54], text: [20, 28, 40, 64], shape: [18, 26, 34, 46], todo: [14, 17, 21, 27], sheet: [12, 14, 17, 21] };
  const fsLevel = it => { const T = FS_TABLE[it.k] || FS_TABLE.text; let b = 0; for (let i = 0; i < T.length; i++) if (Math.abs(T[i] - it.fs) < Math.abs(T[b] - it.fs)) b = i; return b; };
  const sec = (l, body, cls = '') => `<div class="ps ${cls}"><div class="ps-l">${l}</div>${body}</div>`;
  /* a slider for prop, its value shown in the label: in % (u '%') or in px (0.2.23) */
  const fmtV = (v, u) => u === '%' ? Math.round(v * 100) + ' %' : (Math.round(v * 10) / 10) + ' px';
  const slide = (prop, l, v, min, max, step, u, cls = '') => sec(`${l} <b class="pv" data-v="${prop}">${fmtV(v, u)}</b>`, `<input type="range" class="prange" data-prop="${prop}" data-u="${u}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${l}">`, cls);
  const swSlide = v => `<input type="range" class="prange sw" data-prop="sw" data-u="px" min=".5" max="20" step=".5" value="${v}" aria-label="Épaisseur">`;
  const swLabel = v => `Épaisseur <b class="pv" data-v="sw">${fmtV(v, 'px')}</b>`;
  /* the sliders of a popover: live while dragging, one undo step at the end */
  function bindSlides(p) {
    p.addEventListener('input', e => { const r = e.target; if (r.type !== 'range' || !r.dataset.prop) return; const lab = $(`b.pv[data-v="${r.dataset.prop}"]`, p); if (lab) lab.textContent = fmtV(+r.value, r.dataset.u); setProp(r.dataset.prop, +r.value, true); });
    p.addEventListener('change', e => { const r = e.target; if (r.type !== 'range' || !r.dataset.prop) return; setProp(r.dataset.prop, +r.value); qSig = ''; });
  }
  const seg = (prop, cur, opts, cls = '') => `<div class="seg sm ${cls}" data-set="${prop}">${opts.map(([v, l, t]) => `<button data-v="${v}" aria-pressed="${String(cur) === String(v)}" title="${esc(t || l)}">${l}</button>`).join('')}</div>`;
  const pline = (d, extra = '') => `<svg viewBox="0 0 40 16" class="pl"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"${extra}/></svg>`;
  const headIcon = k => { const t = [1, 0]; const p = [34, 8]; return `<svg viewBox="0 0 40 16" class="pl" style="color:currentColor"><path d="M4 8H${k === 'none' ? 34 : 30}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><g stroke="currentColor" fill="currentColor" stroke-width="2">${headD(p, t, k, 1.2).replace(/class="hf"/g, 'fill="currentColor"').replace(/class="hs"/g, 'fill="none"').replace(/style="fill:var\(--paper\)"/g, 'fill="var(--card)"')}</g></svg>`; };
  const btnRow = (list) => `<div class="pbtns">${list.map(([a, ic, l, t]) => `<button class="pb" data-act="${a}" title="${esc(t || l)}" aria-label="${esc(t || l)}">${ic ? icon(ic) : ''}${l ? `<span>${l}</span>` : ''}</button>`).join('')}</div>`;
  /* 0.2.48: the board's own style (background) moved out of the panel, under an icon left of the magnet */
  function boardStylePop(b) {
    const bg = D.bg || 'dots';
    const p = openPop(b, `<div class="bsty-pop"><div class="mh">Fond du board</div>${seg('bg', bg, [['plain', 'Uni'], ['dots', 'Points'], ['grid', 'Quadrillage']])}</div>`, { above: true, align: 'right', focus: false });
    p.onclick = ev => { const v = ev.target.closest('[data-v]'); if (!v) return; setProp('bg', v.dataset.v); $$('[data-v]', p).forEach(x => x.setAttribute('aria-pressed', x === v)); };
  }
  function propsHTML() {
    if (propsTab === 'layers') propsTab = 'style';   // 0.2.48: no more Calques tab
    if (propsTab === 'media') return mediaHTML();
    const list = selItems();
    if (!list.length && (PENS[tool] || tool === 'eraser')) return `<div class="pp-wrap" data-pp="1">${PenPanel.html(tool === 'eraser' ? 'eraser' : penKind)}</div>`;
    const kinds = new Set(list.map(i => i.k)), has = (...ks) => ks.some(k => kinds.has(k)), only = (...ks) => list.length && [...kinds].every(k => ks.includes(k));
    const bd = BD(), one = list.length === 1 ? list[0] : null, out = [];
    const first = k => list.find(i => k ? i.k === k : true);
    const T = tool; const td = !list.length;
    if (td && T === 'select') {
      out.push(sec('Attributs', `<div class="pp-hint">Sélectionnez un élément ou choisissez un outil : ses options s’affichent ici. Le fond du board est sous l’icône ${icon('styles', 'sm')} en bas à droite.</div>`));
      out.push(sec('Astuces', `<div class="pp-hint">Double-clic sur le vide : post-it. <b>V</b> sélection, <b>P</b> stylo, <b>A</b> flèche, <b>L</b> ligne, <b>C</b> liste à faire, <b>1</b>–<b>9</b> changent de pinceau, <b>K</b> pipette (ou <b>Alt</b> + clic en dessinant).<br>Glissez images et fichiers sur le board, ou depuis le Moodboard de la barre du haut.</div>`));
      out.push(sec('Raccourcis', `<button class="btn sm" data-act="help">${icon('help', 'sm')}Tous les raccourcis</button>`));
      return out.join('');
    }
    /* which properties apply: from the selection, or from the tool about to draw */
    const want = td ? { sc: ['shape', 'conn', 'line', 'text'].includes(T), fc: ['shape', 'note', 'todo'].includes(T), fill: T === 'shape', sw: ['shape', 'conn', 'line'].includes(T), dash: ['shape', 'conn', 'line'].includes(T), sty: ['shape', 'conn', 'line'].includes(T), sh: T === 'shape', heads: T === 'conn', route: T === 'conn', font: ['text', 'note', 'todo', 'shape'].includes(T) }
      : { sc: has('shape', 'conn', 'text', 'ink', 'mind'), fc: has('shape', 'note', 'todo'), fill: has('shape') && list.some(i => i.k === 'shape' && i.fc), sw: has('shape', 'conn'), dash: has('shape', 'conn'), sty: has('shape', 'conn'), sh: only('shape'), heads: only('conn'), route: only('conn'), font: has('note', 'text', 'shape', 'todo'), fs: has('note', 'text', 'shape', 'todo', 'sheet'), al: has('note', 'text'), bold: only('text'), op: true };
    const val = (prop, def) => { if (td) return def; const it = first(); return propValue(list.find(i => propValue(i, prop) !== undefined) || it, prop) ?? def; };
    const scCur = td ? (T === 'conn' || T === 'line' ? bd.csc : bd.sc) : (list.some(i => ['shape', 'conn', 'text', 'ink', 'mind'].includes(i.k)) ? propValue(list.find(i => ['shape', 'conn', 'text', 'ink', 'mind'].includes(i.k)), 'sc') : bd.sc);
    const fcCur = td ? (T === 'note' ? noteColor : T === 'todo' ? '#FFFFFF' : bd.fc) : propValue(list.find(i => ['shape', 'note', 'todo'].includes(i.k)) || list[0], 'fc');
    const shp = !td && list.find(i => i.k === 'shape');
    if (one && one.k === 'mind') out.push(sec('Branche', Colors.row(themeColors('mind', MIND_COLORS), one.c, 'sc') + btnRow([['mchild', 'plus', 'Idée', 'Ajouter une idée (Tab)'], one.parent ? ['msib', 'plus', 'Voisine', 'Ajouter une idée voisine (Entrée)'] : ['mtidy', 'wand', 'Équilibrer', 'Équilibrer les branches']])));
    else if (want.sc) out.push(sec(has('ink') && only('ink') ? 'Couleur du trait' : has('text') && only('text') ? 'Couleur' : 'Contour', Colors.row(only('ink') ? themeColors('ink', INK_COLORS).slice(0, 5) : themeColors('stroke', STROKE_COLORS), scCur, 'sc') + (shp ? opRow('so', shp.so ?? 1) : '')));
    if (want.fc) out.push(sec(only('note', 'todo') || (td && (T === 'note' || T === 'todo')) ? 'Couleur' : 'Fond', Colors.row(only('note', 'todo') || (td && T === 'note') ? themeColors('note', NOTE_COLORS).slice(0, 5) : themeColors('fill', FILL_COLORS), fcCur, 'fc', { none: !(only('note', 'todo') || (td && (T === 'note' || T === 'todo'))) }) + (shp && shp.fc ? opRow('fo', shp.fo ?? 1) : '')));
    if (want.fill && (td ? bd.fc : true)) out.push(sec('Remplissage', seg('fill', val('fill', bd.fill), [['solid', `<svg viewBox="0 0 20 20" class="pl sq"><rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor"/></svg>`, 'Plein'], ['hachure', `<svg viewBox="0 0 20 20" class="pl sq"><rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor"/><path d="M3 11l8-8M3 17L17 3M9 17l8-8" stroke="currentColor"/></svg>`, 'Hachures'], ['cross', `<svg viewBox="0 0 20 20" class="pl sq"><rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor"/><path d="M3 11l8-8M9 17l8-8M3 9l8 8M9 3l8 8" stroke="currentColor"/></svg>`, 'Croisillons']], 'ic')));
    if (want.sw) out.push(sec(swLabel(+val('sw', bd.sw) || 2), seg('sw', val('sw', bd.sw), [[1, pline('M4 8h32', ' stroke-width="1.4"'), 'Fin'], [2, pline('M4 8h32', ' stroke-width="2.6"'), 'Moyen'], [4, pline('M4 8h32', ' stroke-width="4.2"'), 'Épais']], 'ic') + swSlide(+val('sw', bd.sw) || 2)));
    if (want.dash) out.push(sec('Style du trait', seg('dash', val('dash', bd.dash) || '', [['', pline('M4 8h32'), 'Continu'], ['dash', pline('M4 8h32', ' stroke-dasharray="6 4"'), 'Tirets'], ['dot', pline('M4 8h32', ' stroke-dasharray="1 4"'), 'Pointillés']], 'ic')));
    if (want.sty) out.push(sec('Tracé', seg('sty', val('sty', bd.sty), [['clean', pline('M4 8h32'), 'Net'], ['sketch', pline('M4 9c6-3 12 2 18-1s8-2 14 0'), 'Croquis'], ['wild', pline('M4 10c4-6 8 4 12-2s6 6 10-2 6 4 10 0'), 'Fou']], 'ic')));
    if (want.sh) { const cur = td ? shapeKind : one ? one.sh : first('shape').sh; out.push(sec('Forme', `<div class="shgrid" data-set="sh">${Object.entries(SHAPES).map(([k, l]) => `<button data-v="${k}" aria-pressed="${k === cur}" title="${l}">${icon(k)}</button>`).join('')}</div>`)); }
    if (want.heads) { const c = td ? { h0: 'none', h1: 'arrow' } : first('conn'); out.push(sec('Pointes', `<div class="heads"><div class="hrow"><small>Départ</small>${seg('h0', c.h0 || 'none', Object.keys(HEADS).map(k => [k, headIcon(k), HEADS[k]]), 'ic')}</div><div class="hrow"><small>Arrivée</small>${seg('h1', c.h1 || 'none', Object.keys(HEADS).map(k => [k, headIcon(k), HEADS[k]]), 'ic')}</div></div>`)); }
    if (want.route) out.push(sec('Tracé des flèches', seg('route', td ? bd.route : first('conn').route, [['curve', icon('conn'), 'Courbe'], ['straight', icon('line'), 'Droit'], ['elbow', icon('elbow'), 'Coudé']], 'ic') + `<div class="pp-hint">Glissez les ronds pour couder la flèche, double-clic sur un point pour le retirer. Clic sans glisser avec l’outil flèche : tracé point par point.</div>`));
    if (want.font) { const f = td ? bd.font : (first().font || HAND); out.push(sec('Police', seg('font', f, [[HAND, '<span style="font-family:var(--font-hand);font-size:17px">Aa</span>', 'Manuscrite'], [SANS, '<span>Aa</span>', 'Normale'], [MONO, '<span style="font-family:var(--font-mono);font-size:12px">Aa</span>', 'Code']], 'ic'))); }
    if (want.fs) out.push(sec('Taille du texte', seg('fs', fsLevel(first(has('text') ? 'text' : undefined) || first()), [[0, 'S'], [1, 'M'], [2, 'L'], [3, 'XL']])));
    if (want.al) out.push(sec('Alignement', seg('al', first().al || 'left', [['left', icon('al-l'), 'À gauche'], ['center', icon('al-c'), 'Centré'], ['right', icon('al-r'), 'À droite']], 'ic')));
    if (list.length && list.every(i => i.k === 'text' || i.k === 'note')) out.push(sec('Liste', seg('ls', first().ls || '', [['', 'Aucune'], ['ul', '• Puces'], ['ol', '1. Numéros']])));
    if (want.bold) out.push(sec('Graisse', seg('bold', one ? !!one.bold : false, [[false, 'Normal'], [true, '<b>Gras</b>']])));
    if (one && one.k === 'image') out.push(sec('Image', seg('frm', one.frm || 'shadow', [['shadow', 'Ombre'], ['polaroid', 'Polaroïd'], ['square', 'Carré'], ['none', 'Simple']]) + (one.frm !== 'polaroid' ? slide('rad', 'Arrondi', Math.round(imgRad(one)), 0, Math.round(Math.min(one.w, one.h) / 2), 1, 'px') : '') + btnRow([['cap', 'text', 'Légende'], Assets.has(one.asset) ? ['view', 'focus', 'Voir en grand'] : null, one.href ? ['src', 'ext', isInsta(one.href) ? 'Voir sur Instagram' : 'Page d’origine'] : null].filter(Boolean))));
    if (one && one.k === 'shape' && (one.sh === 'rect' || one.sh === 'round')) out.push(sec('Angles', seg('corner', shapeRad(one.sh, one.w, one.h, one.rad) > 0 ? 'round' : 'sharp', [['sharp', icon('rect'), 'Vifs'], ['round', icon('round'), 'Arrondis']], 'ic')), radSlide(list));
    if (list.length && list.every(i => i.k === 'todo')) { const f = first();
      out.push(sec('Titre de la liste', seg('ttitle', !f.nt, [[true, 'Affiché'], [false, 'Masqué']])));
      if (!f.nt) out.push(sec('Couleur du titre', Colors.row(themeColors('stroke', STROKE_COLORS), f.ttc, 'ttc', { none: true })));
      out.push(sec('Liste', `<div class="pp-hint" style="margin:0 0 6px">Progression</div>` + seg('tprog', !f.noprog, [[true, 'Affichée'], [false, 'Masquée']])
        + `<div class="pp-hint" style="margin:10px 0 6px">Tâches terminées</div>` + seg('thide', !!f.hidedone, [[false, 'Visibles'], [true, 'Masquées']])
        + `<div class="pp-hint" style="margin:10px 0 6px">Espacement</div>` + seg('tden', f.den || '', [['c', 'Serré'], ['', 'Normal'], ['a', 'Aéré']])
        + `<div class="pp-hint" style="margin-top:10px">Les coins agrandissent toute la liste, les côtés changent sa largeur.</div>`)); }
    if (list.length && list.every(i => i.k === 'frame')) { const f = first();
      out.push(sec('Couleur du titre', Colors.row(themeColors('stroke', STROKE_COLORS), f.tc, 'ftc', { none: true })));
      out.push(sec('Fond du cadre', Colors.row(themeColors('note', NOTE_COLORS), f.fc, 'ffc', { none: true })));
      out.push(sec('Titre du cadre', seg('ftitle', !f.nt, [[true, 'Affiché'], [false, 'Masqué']]) + (f.nt ? '' : `<div style="height:8px"></div>` + seg('tfs', f.tfs ?? 1, [[0, 'S'], [1, 'M'], [2, 'L'], [3, 'XL']])))); }
    if (want.op) { const o = one ? (one.op ?? 1) : (first().op ?? 1); out.push(sec(`Opacité <b class="pv" data-v="op">${Math.round(o * 100)} %</b>`, `<input type="range" class="prange" data-prop="op" min=".05" max="1" step=".05" value="${o}" aria-label="Opacité">`)); }
    if (list.length) {
      out.push(sec('Calques', btnRow([['back', 'back', '', 'Tout en arrière'], ['bwd', 'down', '', 'Reculer'], ['fwd', 'up', '', 'Avancer'], ['front', 'front', '', 'Tout devant']])));
      const acts = [['dup', 'dup', 'Dupliquer', 'Dupliquer (Ctrl D)'], ['del', 'trash', 'Supprimer', 'Supprimer (Suppr)']];
      if (list.some(i => i.g)) acts.unshift(['ungroup', 'ungroup', 'Dégrouper', 'Dégrouper (Ctrl Alt G)']);
      else if (list.filter(i => !(i.k === 'mind' && i.parent)).length > 1) acts.unshift(['group', 'group', 'Grouper', 'Grouper (Ctrl G)']);
      if (one && ['link', 'doc', 'task', 'image'].includes(one.k)) acts.unshift(['open', 'ext', 'Ouvrir', 'Ouvrir']);
      if (one && one.k === 'conn') acts.unshift(['label', 'text', 'Texte', 'Ajouter un texte sur la flèche']);
      if (one && one.k === 'frame') acts.unshift(['arrangeIn', 'arrange', 'Ranger', 'Ranger le contenu du cadre'], ['fitFrame', 'fit', 'Ajuster', 'Ajuster au contenu']);
      if (list.filter(i => i.k !== 'conn').length >= 2) acts.unshift(['arrange', 'arrange', 'Ranger', 'Ranger, aligner, répartir'], ['frameSel', 'frame', 'Cadre', 'Entourer d’un cadre']);
      if (one && one.k === 'todo') acts.unshift(['tasks', 'tasks', 'Tâches', 'Voir dans les tâches']);
      out.push(sec('Actions', btnRow(acts)));
    }
    return out.join('');
  }
  const FRAME_TFS = [12, 14, 20, 28];
  const ZICON = { note: 'sticky', text: 'text', shape: 'rect', image: 'image', file: 'file', link: 'link', ink: 'pen', mind: 'mind', frame: 'frame', task: 'tasks', doc: 'note', todo: 'todo', sheet: 'sheet', plan: 'cal', conn: 'conn', uic: 'layout' };
  function layersHTML() {
    const rows = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]; if (it.k === 'mind' && it.parent) continue;
      const name = (itemText(it) || '').split('\n')[0].trim() || KIND_NAMES[it.k] || it.k;
      rows.push(`<div class="lrow${sel.has(it.id) ? ' on' : ''}${it.hid ? ' off' : ''}" data-lsel="${it.id}"><button class="leye" data-hide="${it.id}" title="${it.hid ? 'Afficher' : 'Masquer'}" aria-pressed="${!it.hid}">${icon(it.hid ? 'eye-off' : 'eye', 'sm')}</button>${icon(it.k === 'shape' ? (it.sh === 'starsh' ? 'starsh' : it.sh) : ZICON[it.k] || 'rect', 'sm')}<span class="ln">${esc(name)}</span><small>${KIND_NAMES[it.k] || ''}</small><button class="lmv" data-up="${it.id}" title="Avancer">${icon('up', 'sm')}</button><button class="lmv" data-down="${it.id}" title="Reculer">${icon('down', 'sm')}</button></div>`);
    }
    return `<div class="layers">${rows.join('') || '<div class="pp-hint">Le board est vide.</div>'}</div><div class="pp-hint">Le haut de la liste est devant. L’œil masque un élément sans le supprimer.</div>`;
  }
  function mediaHTML() {
    const sp = spaceById(D.sp), media = spaceMedia(D.sp), onBoard = new Set(items.map(i => i.url || i.asset || i.doc).filter(Boolean));
    const tile = (m, i) => {
      const used = onBoard.has(m.asset || m.url || m.doc);
      let inner = '';
      if (m.type === 'image') inner = `<img src="${Assets.url(m.asset)}" alt="${esc(m.name || '')}" loading="lazy" draggable="false">`;
      else if (m.type === 'file') { const ext = ((m.name || '').split('.').pop() || 'fichier').slice(0, 4).toUpperCase(); inner = `<div class="mft" style="background:${FILE_COLORS[ext] || '#5E6B78'}">${esc(ext)}</div><span class="mn">${esc(m.name || 'Fichier')}</span>`; }
      else if (m.type === 'link') { let dom = m.url; try { dom = new URL(m.url).hostname.replace(/^www\./, ''); } catch (e) {} inner = `<div class="mft" style="background:${SPACE_COLORS[Math.floor(hashStr(dom) * SPACE_COLORS.length)]}">${esc((dom[0] || '?').toUpperCase())}</div><span class="mn">${esc(m.title || dom)}</span>`; }
      else if (m.type === 'text') inner = `<div class="mtx">${esc((m.txt || '').slice(0, 90))}</div>`;
      else if (m.type === 'doc') { const d = docById(m.doc); if (!d || d.id === D.id) return ''; inner = `<div class="mth">${Thumbs.svg(d)}</div><span class="mn">${icon(d.type === 'board' ? 'board' : 'note', 'sm')}${esc(d.title)}</span>`; }
      return `<div class="mtile${used ? ' used' : ''}" draggable="true" data-media="${i}" title="${esc(m.name || m.title || '')} · glissez sur le board">${inner}${used ? `<span class="mused">${icon('check', 'sm')}</span>` : ''}</div>`;
    };
    return `<div class="mdrop" data-mdrop="1">${icon('upload')}<div>Déposez ici les documents du projet <b>${esc(sp ? sp.name : '')}</b> : images, PDF, fichiers.</div><button class="btn sm" data-madd="1">${icon('plus', 'sm')}Ajouter</button></div>
      <div class="mgrid">${media.map(tile).join('')}</div>
      ${media.length ? `<div class="pbtns"><button class="pb" data-mall="1">${icon('masonry')}<span>Tout placer sur le board</span></button></div>` : '<div class="pp-hint">Tout ce qui est déposé dans cet espace (notes, boards et ici) apparaît dans ce moodboard. Glissez une vignette sur le board pour l’y placer.</div>'}`;
  }
  /* a new selection always shows its attributes: it lifts a hold left by a pen setting dragged and not released here,
     and leaves the Moodboard tab for Style */
  let propSelKey = '';
  function renderProps(force) {
    if (!propsOpen()) return;
    const sk = [...sel].join(',');
    if (sk !== propSelKey) { propSelKey = sk; propsHold = false; propsTab = 'style'; }
    if (propsHold) return;
    const list = selItems();
    const sig = [propsTab, tool, penKind, shapeKind, noteColor, editing, D.bg, JSON.stringify(S.prefs.bd), JSON.stringify(S.prefs.pens[penKind] || {}), S.prefs.pressure, theme(), skin(),
      propsTab === 'layers' ? items.map(i => i.id + (i.hid ? '!' : '') + (i.k === 'mind' ? i.parent : '')).join(',') + '|' + [...sel].join(',') + '|' + items.map(i => (itemText(i) || '').slice(0, 20)).join('') : propsTab === 'media' ? spaceMedia(D.sp).map(m => m.asset || m.url || m.doc).join(',') + '|' + items.map(i => i.url || i.asset || i.doc || '').join('') + Assets.blobs.size : list.map(i => i.id + ':' + sigOf(i) + '|' + (i.op ?? 1) + (i.k === 'conn' ? i.route + i.h0 + i.h1 + i.sty + i.sw + i.dash + i.sc : '')).join(',')].join('#');
    if (sig === propSig && !force) return; propSig = sig;
    const body = $('.pbody', propsEl);
    body.innerHTML = propsHTML();
    $$('.ptab', propsEl).forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === propsTab));
    const pp = $('[data-pp]', body); if (pp) PenPanel.bind(pp, { pen: () => tool === 'eraser' ? 'eraser' : penKind, setPen: k => setTool(k), changed: partial => { propsHold = partial; if (!partial) { propsHold = false; propSig = ''; renderProps(); } refreshTools(); } });
  }
  /* apply a property to the selection (and remember it as the default for new items) */
  function propPatch(it, prop, v) {
    switch (prop) {
      case 'sc': return it.k === 'shape' || it.k === 'conn' ? { sc: v || '#1E1E1E' } : it.k === 'text' ? { color: v || '#1E1E1E' } : it.k === 'ink' || it.k === 'mind' ? { c: v || '#1E1E1E' } : it.k === 'paint' ? (v ? { c: v } : null) : null;
      case 'fc': return it.k === 'shape' ? { fc: v } : it.k === 'note' || it.k === 'todo' ? { c: v || '#FFFFFF' } : null;
      case 'fill': case 'sw': case 'dash': case 'sty': return it.k === 'shape' || it.k === 'conn' ? { [prop]: v } : null;
      case 'sh': return it.k === 'shape' ? { sh: v } : null;
      case 'corner': return it.k === 'shape' ? { sh: v === 'round' ? 'round' : 'rect', rad: undefined } : null;
      case 'h0': case 'h1': case 'route': return it.k === 'conn' ? { [prop]: v } : null;
      case 'font': return ['note', 'text', 'shape', 'todo'].includes(it.k) ? { font: v } : null;
      case 'fs': { const T = FS_TABLE[it.k]; return T ? { fs: T[clamp(+v, 0, 3)] } : null; }
      case 'al': return it.k === 'note' || it.k === 'text' ? { al: v } : null;
      case 'bold': return it.k === 'text' ? { bold: v === true || v === 'true' } : null;
      case 'ls': return it.k === 'text' || it.k === 'note' ? { ls: v || undefined } : null;
      case 'ital': return it.k === 'text' ? { ital: v === true || v === 'true' } : null;
      case 'op': return { op: +v >= 1 ? undefined : +v };
      case 'fo': case 'so': return it.k === 'shape' ? { [prop]: +v >= 1 ? undefined : +v } : null;
      case 'rad': return it.k === 'shape' && (it.sh === 'rect' || it.sh === 'round') ? { sh: 'rect', rad: Math.max(0, Math.round(+v)) } : it.k === 'image' && it.frm !== 'polaroid' ? { rad: Math.max(0, Math.round(+v)) } : null;
      case 'frm': return it.k === 'image' ? { frm: v, rad: undefined } : null;
      case 'ftc': return it.k === 'frame' ? { tc: v || undefined } : null;
      case 'ttc': return it.k === 'todo' ? { ttc: v || undefined } : null;
      case 'ttitle': return it.k === 'todo' ? { nt: v === false || v === 'false' ? 1 : undefined } : null;
      case 'ffc': return it.k === 'frame' ? { fc: v || undefined } : null;
      case 'ftitle': return it.k === 'frame' ? { nt: v === false || v === 'false' ? true : undefined } : null;
      case 'tfs': return it.k === 'frame' ? { tfs: clamp(+v, 0, 3) } : null;
      case 'tprog': return it.k === 'todo' ? { noprog: v === false || v === 'false' ? 1 : undefined } : null;
      case 'thide': return it.k === 'todo' ? { hidedone: v === true || v === 'true' ? 1 : undefined } : null;
      case 'tden': return it.k === 'todo' ? { den: v || undefined } : null;
    }
    return null;
  }
  function setProp(prop, v, live) {
    const list = selItems();
    const BDK = ['sc', 'fc', 'sw', 'sty', 'dash', 'fill', 'font', 'route'];
    if (BDK.includes(prop) && !live && !(prop === 'fc' && list.length && list.every(i => i.k === 'note' || i.k === 'todo'))) {
      // arrows and lines keep their own default colour (csc); a colour of the scheme is kept by its number
      const key = prop === 'sc' && (list.length ? list.every(i => i.k === 'conn') : tool === 'conn' || tool === 'line') ? 'csc' : prop;
      const no = (prop === 'sc' || prop === 'fc') && v ? schemeNo(v) : 0;
      S.prefs.bd = Object.assign({}, S.prefs.bd, { [key]: no ? '@' + no : v }); save();
    }
    if (prop === 'fc' && (!list.length ? tool === 'note' : list.every(i => i.k === 'note'))) noteColor = v || schemeHex(SCHEME_DEF.note);
    if (prop === 'sh' && !list.length) shapeKind = v;
    if (prop === 'bg') { D.bg = v; touch(D); host.className = host.className.replace(/bg-\w+/, 'bg-' + v); propSig = ''; renderProps(); return; }
    if (!list.length) { refreshTools(); propSig = ''; renderProps(); return; }
    const ids = new Set(list.map(i => i.id));
    if (prop === 'sc' && list.some(i => i.k === 'mind')) for (const i of list) if (i.k === 'mind') mindDesc(i.id, ids);
    const next = items.map(i => { if (!ids.has(i.id)) return i; const p = propPatch(i, prop, v); if (!p) return i; const o = Object.assign({}, i, p); for (const k in p) if (p[k] === undefined) delete o[k]; return o; });
    if (live) { if (!liveBefore) liveBefore = items; setLive(next); return; }
    commit(next, { before: liveBefore || items }); liveBefore = null;
  }
  function propsClick(e) {
    const t = e.target;
    const tab = t.closest('.ptab'); if (tab) { propsTab = tab.dataset.tab; propSig = ''; renderProps(); return; }
    if (t.closest('[data-a="close"]')) { setProps(false); return; }
    if (t.closest('[data-pp]')) return;
    const c = t.closest('[data-c]'); if (c) { const row = c.closest('[data-prop]'); if (row) { setProp(row.dataset.prop, c.dataset.c || null); return; } }
    const w = t.closest('[data-wheel]'); if (w) { const prop = w.dataset.wheel, list = selItems(); const cur = list.length ? propValue(list[0], prop) : (prop === 'fc' ? (tool === 'note' ? noteColor : BD().fc) : tool === 'conn' || tool === 'line' ? BD().csc : BD().sc); Colors.open(w, { value: cur || '#1E1E1E', none: prop === 'fc' && !(list.length && list.every(i => i.k === 'note' || i.k === 'todo')), onPick: (v, final) => setProp(prop, v, !final) }); return; }
    const sv = t.closest('[data-set] [data-v]'); if (sv) { const prop = sv.closest('[data-set]').dataset.set, v = sv.dataset.v; setProp(prop, v === 'true' ? true : v === 'false' ? false : v); return; }
    const act = t.closest('[data-act]'); if (act) { action(act.dataset.act, act); return; }
    const hide = t.closest('[data-hide]'); if (hide) { const it = byId.get(hide.dataset.hide); if (it) { const ids = new Set([it.id]); if (it.k === 'mind') mindDesc(it.id, ids); commit(items.map(i => ids.has(i.id) ? Object.assign({}, i, { hid: !it.hid }) : i)); if (!it.hid) sel.delete(it.id); } return; }
    const up = t.closest('[data-up],[data-down]'); if (up) { const id = up.dataset.up || up.dataset.down, dir = up.dataset.up ? 1 : -1; sel = new Set([id]); zMove(dir > 0 ? 'fwd' : 'bwd'); return; }
    const ls = t.closest('[data-lsel]'); if (ls) { const id = ls.dataset.lsel; if (e.shiftKey || e.ctrlKey || e.metaKey) { sel.has(id) ? sel.delete(id) : sel.add(id); } else sel = new Set([id]); const it = byId.get(id); if (it && !it.hid && it.k !== 'conn') panInto(it); schedule(); return; }
    if (t.closest('[data-madd]')) { pickMedia(); return; }
    if (t.closest('[data-mall]')) { placeMedia(spaceMedia(D.sp).filter(m => m.type !== 'doc' && !items.some(i => (i.url || i.asset) === (m.url || m.asset)))); return; }
    const mt = t.closest('[data-media]'); if (mt) { const m = spaceMedia(D.sp)[+mt.dataset.media]; if (m) placeMedia([m]); return; }
  }
  function propsInput(e) {
    const r = e.target; if (r.type !== 'range' || !r.dataset.prop) return;
    if (e.type === 'input') { propsHold = true; const lab = $(`b.pv[data-v="${r.dataset.prop}"]`, propsEl); if (lab) lab.textContent = fmtV(+r.value, r.dataset.u || '%'); setProp(r.dataset.prop, +r.value, true); }
    else { propsHold = false; setProp(r.dataset.prop, +r.value); propSig = ''; renderProps(); }
  }
  function zMove(how) {
    const list = selItems(); if (!list.length) return;
    const ids = new Set(list.map(i => i.id)); for (const i of list) if (i.k === 'mind') mindDesc(i.id, ids);
    const rest = items.filter(i => !ids.has(i.id)), mv = items.filter(i => ids.has(i.id));
    if (how === 'front') { commit(rest.concat(mv)); return; }
    if (how === 'back') { commit(mv.concat(rest)); return; }
    const idx = items.map((i, n) => ids.has(i.id) ? n : -1).filter(n => n >= 0);
    let next = items.slice();
    if (how === 'fwd') { for (let k = idx.length - 1; k >= 0; k--) { const i = idx[k]; let j = i + 1; while (j < next.length && ids.has(next[j].id)) j++; if (j < next.length) { const t = next[j]; next.splice(j, 1); next.splice(i, 0, t); } } }
    else { for (let k = 0; k < idx.length; k++) { const i = idx[k]; let j = i - 1; while (j >= 0 && ids.has(next[j].id)) j--; if (j >= 0) { const t = next[j]; next.splice(j, 1); next.splice(i, 0, t); } } }
    commit(next);
  }
  function action(a, btn) {
    const list = selItems();
    if (a.startsWith('uif-')) { if (list[0] && list[0].ui) uiSetFid(list[0], a.slice(4)); return; }
    if (a.startsWith('uil-')) { if (list[0] && list[0].k === 'uic' && list[0].t === 'box') uiSetLay(list[0], a.slice(4)); return; }
    if (a.startsWith('uiwrap-')) { uiWrap(a.slice(7)); return; }
    switch (a) {
      case 'help': helpModal(); return;
      case 'front': case 'back': case 'fwd': case 'bwd': zMove(a); return;
      case 'dup': duplicate(); return;
      case 'group': groupSel(); return;
      case 'ungroup': ungroupSel(); return;
      case 'mchild': mindAdd('child'); return;
      case 'msib': mindAdd('sibling'); return;
      case 'mtidy': { const r = list[0]; if (!r) return; const ks = mindKids(r.id), half = Math.ceil(ks.length / 2); commit(renumber(items.map(i => { const k = ks.indexOf(i); if (k < 0) return i; const side = k < half ? 1 : -1; return Object.assign({}, i, { side }); }).map(i => { const top = ks.find(k => mindDesc(k.id).has(i.id)); return top ? Object.assign({}, i, { side: ks.indexOf(top) < half ? 1 : -1 }) : i; }), r.id)); return; }
      case 'del': deleteSel(); return;
      case 'lock': case 'unlock': { const ids = new Set(list.filter(i => i.k !== 'conn' || a === 'unlock').map(i => i.id)); if (!ids.size) return; if (editing) finishEdit(); commit(items.map(i => ids.has(i.id) ? Object.assign({}, i, { lock: a === 'lock' ? true : undefined }) : i)); qSig = ''; tapFlash(a === 'lock' ? 'Verrouillé' : 'Déverrouillé'); return; }
      case 'open': if (list[0]) openItem(list[0]); return;
      case 'view': if (list[0]) lightbox(list[0]); return;
      case 'src': if (list[0] && list[0].href) openItem({ k: 'link', url: list[0].href }); return;
      case 'label': if (list[0]) startEdit(list[0].id); return;
      case 'cap': { const it = list[0]; if (!it) return; const p = openPop(btn, `<div style="display:flex;gap:6px;padding:4px"><input id="capIn" value="${esc(it.cap)}" placeholder="Légende…" style="height:32px;border-radius:8px;border:1px solid var(--line-2);background:var(--raise);padding:0 10px;outline:0"><button class="btn sm pri" id="capOk">OK</button></div>`); const i = $('#capIn', p); i.focus(); const ok = () => { commit(replace(items, it, { cap: i.value, frm: i.value ? 'polaroid' : it.frm })); closePop(); }; $('#capOk', p).onclick = ok; i.onkeydown = e => { if (e.key === 'Enter') ok(); e.stopPropagation(); }; return; }
      case 'arrange': case 'arrangeIn': arrangeMenu(btn, a === 'arrangeIn'); return;
      case 'fitFrame': if (list[0]) fitFrame(list[0]); return;
      case 'frameSel': frameAround(list.filter(i => i.k !== 'conn')); return;
      case 'tasks': go('tasks'); return;
      case 'multitext': multiText(); return;
      case 'uiedit': if (list[0] && list[0].k === 'uic') uiFocusText(list[0]); return;
      case 'uilib': uiLibOpen(list[0] && list[0].ui ? list[0].id : null); return;
      case 'uitest': if (list[0] && list[0].ui) uiTest(list[0]); return;
      case 'uiundock': if (list[0] && list[0].dock) { const it = list[0]; commit(replace(items, it, { dock: undefined, x: it.x + 24, y: it.y + 24 })); } return;
      case 'frename': if (list[0] && list[0].k === 'frame') startEdit(list[0].id); return;
      case 'pinfo': if (list[0] && list[0].k === 'paint') paintInfo(list[0]); return;
      case 'pdim': if (list[0] && list[0].k === 'plan') planDim(list[0], btn); return;
      case 'pset': if (list[0] && list[0].k === 'plan') planModal(list[0]); return;
      case 'prefresh': if (list[0] && list[0].k === 'plan') planRefresh(list[0]); return;
    }
  }
  function arrangeMenu(btn, inFrame) {
    const R2 = m => () => arrange(m, inFrame);
    openPop(btn, [
      { head: 'Ranger' }, { label: 'Grille', icon: 'grid', run: R2('grid') }, { label: 'Mosaïque (moodboard)', icon: 'masonry', run: R2('masonry') }, { label: 'En ligne', icon: 'row', run: R2('row') }, { label: 'En colonne', icon: 'col', run: R2('col') },
      ...(inFrame ? [] : ['-', { head: 'Aligner' }, { label: 'À gauche', icon: 'al-l', run: R2('left') }, { label: 'Au centre', icon: 'al-c', run: R2('hcenter') }, { label: 'À droite', icon: 'al-r', run: R2('right') }, { label: 'En haut', icon: 'al-t', run: R2('top') }, { label: 'Au milieu', icon: 'al-m', run: R2('vmiddle') }, { label: 'En bas', icon: 'al-b', run: R2('bottom') },
        '-', { label: 'Répartir horizontalement', icon: 'dist-h', run: R2('dist-h') }, { label: 'Répartir verticalement', icon: 'dist-v', run: R2('dist-v') }, { label: 'Même taille', icon: 'fit', run: R2('same') }])
    ], { align: 'right' });
  }
  function helpModal() {
    const K = [['Outils', [['V', 'Sélection'], ['H / Espace', 'Main'], ['R · O', 'Rectangle · Ellipse'], ['A', 'Flèche'], ['L', 'Ligne'], ['D ou P', 'Dessin'], ['Ctrl + glisser (clic ou molette)', 'Taille du pinceau (en dessin)'], [atelierFull() ? '1 … 9' : '1 · 2 · 3 · 4 … 9', atelierFull() ? 'Choisir un pinceau (9 : crayon naturel)' : 'Stylo · Feutre · Surligneur, puis les pinceaux (Graphite, Pinceau encre…)'], ['K · Alt maintenu', 'Pipette sur le board'], ['E', 'Gomme : efface tout élément touché (celle du dessin : les traits seulement)'], ['T', 'Texte'], ['N', 'Post-it'], ['C', 'Liste à faire'], ['G', 'Tableur'], ['F', 'Zoom sur la sélection, ou tout voir'], ['I', 'Image ou fichier']]],
      ['Édition', [['Ctrl Z / Y', 'Annuler / Rétablir'], ['Ctrl D', 'Dupliquer'], ['Ctrl G', 'Grouper (Alt + clic : un seul élément du groupe)'], ['Ctrl Alt G', 'Dégrouper'], ['Ctrl C / X / V', 'Copier, couper, coller'], ['Ctrl A', 'Tout sélectionner'], ['Ctrl Maj L', 'Verrouiller / déverrouiller'], ['Poignée ronde au-dessus', 'Tourner (Maj : par 15°)'], ['Suppr', 'Supprimer'], ['Entrée', 'Modifier le texte'], ['Flèches', 'Déplacer (Maj : par 10)'], ['Alt + glisser', 'Déplacer sans aimant'], ['Maj + glisser', 'Dupliquer et déplacer la copie'], ['Page ↑ / ↓', 'Avancer / reculer d’un plan'], ['Ctrl + Page ↑ / ↓', 'Tout devant / tout au fond'], ['Clic droit maintenu · appui long', 'Marking menu : outils, puis options (▸)'], ['Glisser un outil sur le board', 'Poser l’élément à cet endroit']]],
      ['Vue', [['Molette', S.prefs.wheel === 'zoom' ? 'Zoomer (Maj : défiler)' : 'Défiler (Ctrl : zoomer)'], ['Ctrl + / −', 'Zoomer / dézoomer'], ['0', 'Tout voir'], ['Ctrl 0', 'Zoom 100 %'], ['Ctrl .', 'Mode focus'], ['?', 'Cette aide']]],
      ['iPad', [['Toucher à deux doigts', 'Annuler'], ['Double tap au doigt', 'Modifier le texte'], ['Doigt sur un élément', 'Le prendre (outil Sélection)'], ['Deux doigts', 'Zoomer, tourner le board'], ['Appui long sur une couleur', 'Glisser sur la couleur, relâcher']]],
      ['Tableur', [['Clic · glisser', 'Choisir des cellules'], ['Maj + clic', 'Étendre la sélection'], ['En-tête', 'Ligne ou colonne entière'], ['Entrée · F2', 'Modifier la cellule'], ['Suppr', 'Vider les cellules'], ['Ctrl − / Ctrl +', 'Supprimer / insérer des lignes'], ['Ctrl C / V', 'Copier / coller des cellules'], ['Bord d’en-tête', 'Glisser pour redimensionner']]]];
    openModal(`<div class="mhd"><h2>Raccourcis du board</h2><button class="tb" data-close aria-label="Fermer">${icon('x')}</button></div><div class="keys">${K.map(([t, rows]) => `<div><h5>${t}</h5>${rows.map(([k, l]) => `<div class="krow"><span>${esc(l)}</span><kbd>${esc(k)}</kbd></div>`).join('')}</div>`).join('')}</div>`);
  }

  /* ---------- arranging ---------- */
  function frameChildren(f) { const b = boxOf(f); return items.filter(i => i.k !== 'frame' && i.k !== 'conn' && !i.hid && !(i.k === 'mind' && i.parent) && inBox(i.x + i.w / 2, i.y + i.h / 2, b)); }
  function arrange(mode, inFrame) {
    let list = selItems().filter(i => i.k !== 'conn' && !(i.k === 'mind'));
    let frame = null;
    if (inFrame || (list.length === 1 && list[0].k === 'frame')) { frame = list.find(i => i.k === 'frame'); list = frame ? frameChildren(frame).filter(i => i.k !== 'mind') : []; }
    else list = list.filter(i => i.k !== 'frame' || list.length > 1);
    if (list.length < (frame ? 1 : 2)) { toast('Sélectionnez au moins deux éléments à ranger'); return; }
    const bb = unionBox(list), G = 24, pos = new Map();
    const set = (it, x, y, w = it.w, h = it.h) => pos.set(it.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    const x0 = frame ? frame.x + 32 : bb[0], y0 = frame ? frame.y + 32 : bb[1], maxW = frame ? frame.w - 64 : Infinity;
    const reading = list.slice().sort((a, b) => (Math.abs(a.y - b.y) < Math.min(a.h, b.h) / 2 ? a.x - b.x : a.y - b.y));
    const scalable = i => i.k === 'image' || i.k === 'ink' || i.k === 'doc' || i.k === 'paint';
    switch (mode) {
      case 'grid': {
        let cols = Math.ceil(Math.sqrt(list.length * 1.25));
        const cw = Math.max(...list.map(i => i.w));
        if (frame) cols = clamp(Math.floor((maxW + G) / (cw + G)), 1, list.length);
        const rows = Math.ceil(list.length / cols), rh = [];
        for (let r = 0; r < rows; r++) rh.push(Math.max(...reading.slice(r * cols, r * cols + cols).map(i => i.h)));
        reading.forEach((it, i) => { const c = i % cols, r = Math.floor(i / cols); let y = y0; for (let k = 0; k < r; k++) y += rh[k] + G; set(it, x0 + c * (cw + G) + (cw - it.w) / 2, y); });
        break;
      }
      case 'masonry': {
        const sc = list.filter(scalable), ws = (sc.length ? sc : list).map(i => i.w).sort((a, b) => a - b);
        let cw = ws[Math.floor(ws.length / 2)];
        let cols = clamp(Math.round(Math.sqrt(list.length * 1.1)), 2, 6);
        if (frame) { cols = clamp(Math.floor((maxW + 16) / (cw + 16)), 1, 8); cw = (maxW - (cols - 1) * 16) / cols; }
        const hs = new Array(cols).fill(0);
        for (const it of reading) { const c = hs.indexOf(Math.min(...hs)), w = scalable(it) || it.k === 'note' ? cw : Math.min(it.w, cw), h = scalable(it) ? it.h * cw / it.w : it.k === 'note' ? it.h * cw / it.w : it.h; set(it, x0 + c * (cw + 16), y0 + hs[c], w, h); hs[c] += h + 16; }
        break;
      }
      case 'row': { const s = list.slice().sort((a, b) => a.x - b.x), imgs = s.filter(scalable), hh = imgs.length > 1 ? imgs.map(i => i.h).sort((a, b) => a - b)[Math.floor(imgs.length / 2)] : 0; let x = x0; for (const it of s) { const w = hh && scalable(it) ? it.w * hh / it.h : it.w, h = hh && scalable(it) ? hh : it.h; set(it, x, y0, w, h); x += w + G; } break; }
      case 'col': { const s = list.slice().sort((a, b) => a.y - b.y); let y = y0; for (const it of s) { set(it, x0, y); y += it.h + G; } break; }
      case 'left': list.forEach(i => set(i, bb[0], i.y)); break;
      case 'right': list.forEach(i => set(i, bb[2] - i.w, i.y)); break;
      case 'hcenter': list.forEach(i => set(i, (bb[0] + bb[2]) / 2 - i.w / 2, i.y)); break;
      case 'top': list.forEach(i => set(i, i.x, bb[1])); break;
      case 'bottom': list.forEach(i => set(i, i.x, bb[3] - i.h)); break;
      case 'vmiddle': list.forEach(i => set(i, i.x, (bb[1] + bb[3]) / 2 - i.h / 2)); break;
      case 'dist-h': { const s = list.slice().sort((a, b) => a.x - b.x), tot = s.reduce((t, i) => t + i.w, 0), gap = (bb[2] - bb[0] - tot) / Math.max(1, s.length - 1); let x = bb[0]; for (const i of s) { set(i, x, i.y); x += i.w + gap; } break; }
      case 'dist-v': { const s = list.slice().sort((a, b) => a.y - b.y), tot = s.reduce((t, i) => t + i.h, 0), gap = (bb[3] - bb[1] - tot) / Math.max(1, s.length - 1); let y = bb[1]; for (const i of s) { set(i, i.x, y); y += i.h + gap; } break; }
      case 'same': { const w = list[0].w, h = list[0].h; list.forEach(i => set(i, i.x, i.y, w, scalable(i) ? i.h * w / i.w : h)); break; }
    }
    let next = items.map(i => { const p = pos.get(i.id); if (!p) return i; const o = Object.assign({}, i, p); if (i.k === 'text' && p.w !== i.w) o.fs = Math.round(i.fs * p.w / i.w); if (i.k === 'todo') o.h = i.h; return o; });
    if (frame) { const nb = unionBox(next.filter(i => pos.has(i.id))); if (nb) next = next.map(i => i.id === frame.id ? Object.assign({}, i, { h: Math.max(i.h, nb[3] - i.y + 32), w: Math.max(i.w, nb[2] - i.x + 32) }) : i); }
    animate(); commit(next); toast('Rangé');
  }
  function animate() { world.classList.add('anim'); clearTimeout(animate.t); animate.t = setTimeout(() => world.classList.remove('anim'), 380); }
  function fitFrame(f) { const ch = frameChildren(f); if (!ch.length) return; const b = unionBox(ch); commit(replace(items, f, { x: b[0] - 32, y: b[1] - 32, w: b[2] - b[0] + 64, h: b[3] - b[1] + 64 })); }
  function frameAround(list) { const b = unionBox(list); if (!b) return; const f = mkFrame(b[0] - 32, b[1] - 32, b[2] - b[0] + 64, b[3] - b[1] + 64, 'Groupe'); commit([f, ...items]); sel = new Set([f.id]); startEdit(f.id); }

  /* ---------- mutations ---------- */
  function duplicate(dx = 32, dy = 32) {
    const list = selItems(); if (!list.length) return;
    const pasted = cloneItems(list, dx, dy); commit(items.concat(pasted)); sel = new Set(pasted.filter(i => !(i.k === 'mind' && i.parent) && i.k !== 'conn').map(i => i.id));
  }
  function cloneItems(list, dx, dy) {
    const ids = new Set(list.map(i => i.id));
    for (const i of list) if (i.k === 'mind') { const r = i.parent ? null : i; if (r) mindDesc(r.id, ids); }
    for (const i of list) if (i.k === 'uic' && i.t === 'box') uiDesc(items, i.id, ids);
    const src = items.filter(i => ids.has(i.id) || (i.k === 'conn' && ids.has(i.a.id) && ids.has(i.b.id)));
    const map = new Map(src.map(i => [i.id, uid(i.id[0])])), gmap = new Map();
    return src.map(i => {
      const o = JSON.parse(JSON.stringify(i)); o.id = map.get(i.id);
      if (o.g) { if (!gmap.has(o.g)) gmap.set(o.g, uid('g')); o.g = gmap.get(o.g); }
      if (o.k === 'conn') { for (const e of ['a', 'b']) { if (o[e].id) { o[e].id = map.get(o[e].id) || null; if (!o[e].id) delete o[e].fx, delete o[e].fy; } else { if (o[e].on) { o[e].on = map.get(o[e].on); if (!o[e].on) delete o[e].on; } o[e].x += dx; o[e].y += dy; } } o.pts = (o.pts || []).map(p => [p[0] + dx, p[1] + dy]); o.sd = Math.random(); }
      else { o.x += dx; o.y += dy; }
      if (o.k === 'mind') { if (o.parent && map.has(o.parent)) o.parent = map.get(o.parent); else if (o.parent) o.parent = null; o.root = map.get(o.root) || o.id; if (!o.parent) o.root = o.id; }
      if (o.k === 'uic' && o.p) { const m = map.get(o.p); if (m) o.p = m; else o.o = (o.o ?? 0) + .5; }
      if (o.k === 'ink') o.p = i.p;
      if (o.k === 'shape') o.sd = Math.random();
      if (o.k === 'todo') { o.sd = Math.random(); o.tasks = o.tasks.map(id => { const t = taskById(id); if (!t) return null; const n = newTask({ t: t.t || 'Nouvelle tâche', sp: t.sp, due: t.due, time: t.time }); n.done = t.done; return n.id; }).filter(Boolean); }
      return o;
    });
  }
  function deleteSel() {
    if (!sel.size) return;
    const del = new Set([...sel].filter(id => !(byId.get(id) || {}).lock)); if (!del.size) { toast('Élément verrouillé : déverrouillez-le pour le supprimer'); return; }
    for (const id of sel) { const i = byId.get(id); if (i && i.k === 'mind') mindDesc(id, del); if (i && i.k === 'uic' && i.t === 'box') uiDesc(items, id, del); }
    if (editing && del.has(editing)) { editing = null; editSub = null; }
    commit(items.filter(i => !del.has(i.id) && !(i.k === 'conn' && (del.has(i.a.id) || del.has(i.b.id)))));
    sel.clear(); schedule();
  }
  function toggleCheck(id, line) { const it = byId.get(id); if (!it) return; commit(replace(items, it, { txt: toggleLine(it.txt, line) })); }
  function openItem(it) {
    if (it.k === 'link') { const a = document.createElement('a'); a.href = it.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; document.body.append(a); a.click(); a.remove(); }
    if (it.k === 'doc' && docById(it.doc)) go('doc:' + it.doc);
    if (it.k === 'task') { const t = taskById(it.task); if (t) setCurSpace(t.sp); go('tasks'); }
    if (it.k === 'image' && Assets.has(it.asset)) lightbox(it);
    if (it.k === 'plan') planModal(it);
    if (it.k === 'paint') paintInfo(it);
    if (it.k === 'dir' && it.path) Mood.openFolder(it);
  }
  function lightbox(it) { const u = Assets.url(it.asset); if (!u) return; const l = document.createElement('div'); l.className = 'lightbox'; l.innerHTML = `<img src="${u}" alt="${esc(it.cap || 'Image')}">`; l.onclick = () => l.remove(); document.body.append(l); }

  /* ---------- mind map: add an idea under the selected one (Tab) or beside it (Enter), move with the arrows ---------- */
  function mindAdd(mode) {
    if (editing) finishEdit();
    const n = byId.get([...sel][0]); if (!n || n.k !== 'mind') return;
    let parent, side;
    if (mode === 'sibling' && n.parent) { parent = byId.get(n.parent); side = n.side; }
    else { parent = n; side = parent.parent ? parent.side : mode === 'left' ? -1 : mode === 'right' ? 1 : (mindKids(parent.id).filter(c => c.side > 0).length <= mindKids(parent.id).filter(c => c.side < 0).length ? 1 : -1); }
    if (!parent) return;
    const sibs = mindKids(parent.id), cols = themeColors('mind', MIND_COLORS);
    const ord = mode === 'sibling' ? n.ord + .5 : (sibs.length ? Math.max(...sibs.map(s => s.ord)) + 1 : 0);
    const c = parent.parent ? parent.c : cols[sibs.length % cols.length];
    const node = { id: uid('m'), k: 'mind', x: parent.x, y: parent.y, w: 80, h: 32, txt: '', root: parent.root || parent.id, parent: parent.id, side, c, ord, lv: (parent.lv || 0) + 1, ms: parent.ms || 1 };
    commit(renumber(items.concat(node), parent.id));
    sel = new Set([node.id]); render(); startEdit(node.id);
  }
  function renumber(arr, pid) { const ks = arr.filter(i => i.k === 'mind' && i.parent === pid).sort((a, b) => a.ord - b.ord); const m = new Map(ks.map((k, i) => [k.id, i])); return arr.map(i => m.has(i.id) && i.ord !== m.get(i.id) ? Object.assign({}, i, { ord: m.get(i.id) }) : i); }
  function mindNav(key) {
    const n = byId.get([...sel][0]); if (!n) return;
    let t = null;
    const ks = mindKids(n.id), dirOut = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
    if (dirOut) { if (!n.parent) t = ks.find(k => k.side === dirOut); else if (n.side === dirOut) t = ks[0]; else t = byId.get(n.parent); }
    else if (n.parent) { const sib = mindKids(n.parent).filter(s => s.side === n.side), i = sib.indexOf(n); t = sib[i + (key === 'ArrowDown' ? 1 : -1)]; if (!t && key === 'ArrowDown' && ks.length) t = ks[0]; }
    if (t) { sel = new Set([t.id]); schedule(); panInto(t); }
  }
  function panInto(it) { const r = hostRect(), a = toS(it.x, it.y), b = toS(it.x + it.w, it.y + it.h); const right = propsOpen() ? 330 : 40; let dx = 0, dy = 0; if (a.x < 40) dx = 40 - a.x; if (b.x > r.width - right) dx = r.width - right - b.x; if (a.y < 70) dy = 70 - a.y; if (b.y > r.height - 90) dy = r.height - 90 - b.y; if (dx || dy) { view.x += dx; view.y += dy; viewChanged(); } }

  /* ---------- text editing (notes, texts, shapes, mind nodes, frames, labels, todo rows) ---------- */
  function editEl(it, sub) {
    if (it.k === 'conn') { let el = labelsL.querySelector(`[data-l="${it.id}"]`); if (!el) { const g = connGeom(it, byId); el = document.createElement('div'); el.className = 'clabel'; el.dataset.l = it.id; el.dataset.id = it.id; el.style.left = g.mid[0] + 'px'; el.style.top = g.mid[1] + 'px'; labelsL.append(el); } return el; }
    const n = nodes.get(it.id); if (!n) return null;
    if (it.k === 'todo') return n.querySelector(`[data-sub="${sub || 'title'}"]`);
    if (it.k === 'sheet') return n.querySelector(`[data-cell="${sub || 'A1'}"]`);
    return it.k === 'frame' ? n.querySelector('.ftitle') : n.querySelector('.txt');
  }
  const EDITABLE = ['note', 'text', 'shape', 'mind', 'frame', 'conn', 'todo', 'sheet'];
  const sheetAt = new Map();   // the last cell edited in each sheet, where typing starts
  function startEdit(id, char, sub) {
    const it = byId.get(id); if (!it || !EDITABLE.includes(it.k)) return;
    if (it.lock) { toast('Élément verrouillé'); return; }
    if (editing && (editing !== id || editSub !== (sub || null))) finishEdit();
    render();
    if (it.k === 'todo' && (!sub || sub === 'title') && it.nt) { sub = it.tasks.find(x => taskById(x)); if (!sub) { todoAddRow(id, -1); return; } }
    if (it.k === 'todo' && !sub) sub = 'title';
    if (it.k === 'sheet' && !sub) sub = sheetAt.get(id) || 'A1';
    const el = editEl(it, sub); if (!el) return;
    editing = id; editSub = sub || null; sel = new Set([id]);
    const n = nodes.get(id); if (n) n.classList.add('editing');
    const cur = it.k === 'todo' ? (sub === 'title' ? it.title : ((taskById(sub) || {}).t || '')) : it.k === 'sheet' ? (sub === 'title' ? it.title : (it.cells[sub] || '')) : it.k === 'frame' ? it.title : (it.txt || '');
    if (it.k === 'sheet' && sub !== 'title') { sheetAt.set(id, sub); const rc = cellRC(sub); if (rc) sheetSel = { id, a: rc, b: rc }; fxRefs = []; fxIns = null; }
    el.textContent = char != null ? char : cur;
    try { el.contentEditable = 'plaintext-only'; } catch (e) { el.contentEditable = 'true'; }
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.style.userSelect = 'text';
    el.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(el); if (char != null || (it.k !== 'mind' && !(it.k === 'todo' && sub === 'title' && !char) && !(it.k === 'frame' && it.title === 'Cadre'))) r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    editStart = { id, items };
    if (it.k === 'sheet') sheetFx(id, el);
    el.oninput = () => editInput(it.id, el);
    el.onkeydown = ev => {
      ev.stopPropagation();
      const c0 = byId.get(id);
      if (ev.key === 'Escape') { ev.preventDefault(); finishEdit(); host.focus({ preventScroll: true }); return; }
      if (c0 && c0.k === 'todo') { todoKey(ev, c0, sub, el); return; }
      if (c0 && c0.k === 'sheet') { if (sheetAssistKey(ev, el)) return; sheetKey(ev, c0, sub); return; }
      if (c0 && c0.k === 'mind' && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); finishEdit(); host.focus({ preventScroll: true }); if (byId.has(id)) { sel = new Set([id]); mindAdd(c0.parent ? 'sibling' : 'child'); } return; }
      if (c0 && c0.k === 'mind' && ev.key === 'Tab') { ev.preventDefault(); finishEdit(); host.focus({ preventScroll: true }); if (byId.has(id)) { sel = new Set([id]); mindAdd('child'); } return; }
      if ((c0 && (c0.k === 'frame' || c0.k === 'conn') && ev.key === 'Enter') || (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); finishEdit(); host.focus({ preventScroll: true }); }
    };
    const mySub = sub || null;
    el.onblur = () => setTimeout(() => { if (editing === id && editSub === mySub && el.isConnected && document.activeElement !== el) finishEdit(); }, 0);
    el.onpaste = ev => {
      ev.stopPropagation();
      // 0.3.15: several lines pasted into a list: each line becomes a task, under the row being typed (or at the top)
      const c0 = byId.get(id), txt = ev.clipboardData && ev.clipboardData.getData('text/plain');
      if (c0 && c0.k === 'todo' && txt && /\n/.test(txt.trim())) { ev.preventDefault(); todoPaste(id, sub, txt); }
    };
    schedule();
  }
  /* Enter adds a row under the current one, Backspace on an empty row removes it */
  function todoKey(ev, it, sub, el) {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); const after = sub === 'title' ? -1 : it.tasks.indexOf(sub); finishEdit(); todoAddRow(it.id, after); return; }
    if (ev.key === 'Backspace' && sub !== 'title' && !el.textContent.trim()) { ev.preventDefault(); const i = it.tasks.indexOf(sub); finishEdit(); const cur = byId.get(it.id); if (!cur) return; const prev = cur.tasks[Math.max(0, i - 1)]; if (prev && i > 0) startEdit(cur.id, null, prev); else startEdit(cur.id, null, 'title'); return; }
    if (ev.key === 'ArrowUp' && sub !== 'title') { const i = it.tasks.indexOf(sub); ev.preventDefault(); finishEdit(); const cur = byId.get(it.id); if (cur) startEdit(cur.id, null, i > 0 ? cur.tasks[i - 1] : 'title'); return; }
    if (ev.key === 'ArrowDown') { const i = sub === 'title' ? -1 : it.tasks.indexOf(sub); if (i < it.tasks.length - 1) { ev.preventDefault(); finishEdit(); const cur = byId.get(it.id); if (cur) startEdit(cur.id, null, cur.tasks[i + 1]); } return; }
  }
  /* 0.3.16: a board list is also a CONTAINER of the space's tasks (same title), so its tasks show grouped in Tâches */
  function syncTodoBox(it) {
    const sp = spaceById(D && D.sp); if (!sp || !it || it.k !== 'todo') return;
    const L = boxesOf(sp); let b = L.find(x => x.todo === it.id), ch = false;
    if (!b) { b = { id: uid('b'), t: it.title || 'À faire', todo: it.id }; L.push(b); ch = true; }
    else if (b.t !== (it.title || 'À faire')) { b.t = it.title || 'À faire'; ch = true; }
    for (const id of it.tasks) { const t = taskById(id); if (t && t.sp === sp.id && t.box !== b.id) { t.box = b.id; ch = true; } }
    if (ch) save();
  }
  function todoPaste(id, sub, txt) {
    const lines = txt.replace(/\r/g, '').split('\n').map(l => { const s = l.trim(), m = s.match(PASTE_ITEM), b = !m && s.match(/^(?:[-*+•‣▪◦–—]|\d{1,3}[.)])\s+/);
      return m && m[0] ? { t: s.slice(m[0].length).trim(), done: !!(m[1] || m[3]) } : { t: (b ? s.slice(b[0].length) : s).replace(/\*\*(.+?)\*\*/g, '$1').trim(), done: false }; }).filter(x => x.t);
    if (!lines.length) return;
    finishEdit();
    const it = byId.get(id); if (!it) return;
    const tasks = it.tasks.filter(x => taskById(x)); let at = sub && sub !== 'title' ? tasks.indexOf(sub) : -1;
    // the row being typed, still empty, takes the first line
    const cur = at >= 0 && taskById(tasks[at]); let i0 = 0;
    if (cur && !cur.t.trim()) { cur.t = lines[0].t; cur.done = lines[0].done; i0 = 1; }
    const made = lines.slice(i0).map(x => { const t = { id: uid('t'), t: x.t, sp: it.sp || D.sp, due: '', time: '', done: x.done, star: false, note: '', created: Date.now() }; S.tasks.push(t); return t.id; });
    tasks.splice(at + 1, 0, ...made); save();
    commit(replace(items, it, { tasks })); render(); syncTodoBox(byId.get(id));
    toast(`${lines.length} tâche${lines.length > 1 ? 's' : ''} ajoutée${lines.length > 1 ? 's' : ''}`);
  }
  function todoAddRow(id, after) {
    const it = byId.get(id); if (!it) return;
    const t = { id: uid('t'), t: '', sp: it.sp || D.sp, due: '', time: '', done: false, star: false, note: '', created: Date.now() };
    S.tasks.push(t);
    const tasks = it.tasks.slice(); tasks.splice(after + 1, 0, t.id);
    commit(replace(items, it, { tasks })); render(); syncTodoBox(byId.get(id)); startEdit(id, null, t.id);
  }
  /* keys while a cell is typed in: Enter / Tab keep it and select the next cell (Shift: back), the arrows up and down too; a new row comes when Enter leaves the last one */
  let sheetTab = null;
  function sheetKey(ev, it, sub) {
    if (sub === 'title') { if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); finishEdit(); sheetSelect(byId.get(it.id) || it, [0, 0]); host.focus({ preventScroll: true }); } return; }
    const m = /^([A-Z]+)(\d+)$/.exec(sub); if (!m) return;
    let c = colIndex(m[1]), r = +m[2] - 1;
    const mv = { Enter: [0, ev.shiftKey ? -1 : 1], Tab: [ev.shiftKey ? -1 : 1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!mv || (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey))) return;
    ev.preventDefault(); finishEdit();
    let cur = byId.get(it.id); if (!cur) return;
    // as in Google Sheets, Enter after a run of Tabs goes back to the column the run started from
    const run = sheetTab && sheetTab.id === it.id && sheetTab.at === sub ? sheetTab.col : null;
    if (ev.key === 'Enter' && !ev.shiftKey && run != null) c = run; else c += mv[0];
    r += mv[1];
    if (c >= cur.cols) { c = 0; r++; } if (c < 0) { c = cur.cols - 1; r--; }
    sheetTab = ev.key === 'Tab' && !ev.shiftKey && c > 0 ? { id: it.id, col: run != null ? run : c - 1, at: colName(c) + (r + 1) } : null;
    if (r < 0) { startEdit(cur.id, null, 'title'); return; }
    if (r >= cur.rows) { if (ev.key !== 'Enter' && ev.key !== 'Tab') { r = cur.rows - 1; } else { sheetResize(cur, { rows: cur.rows + 1 }); cur = byId.get(it.id); } }
    render(); sheetSelect(cur, [c, r]); host.focus({ preventScroll: true });
  }
  function sheetResize(it, o) {
    if (o.rows != null && o.rows !== it.rows) sheetInsert(it, 'row', Math.min(it.rows, o.rows), o.rows - it.rows);
    else if (o.cols != null && o.cols !== it.cols) sheetInsert(it, 'col', Math.min(it.cols, o.cols), o.cols - it.cols);
  }
  function sheetTotal(it) {
    // the total goes just under the last filled row (into an empty row if there is one), summing everything above it
    const val = sheetEval(it.cells), cells = Object.assign({}, it.cells);
    const last = Object.keys(it.cells).reduce((m, k) => { const x = /^[A-Z]+(\d+)$/.exec(k); return x && String(it.cells[k]).trim() ? Math.max(m, +x[1]) : m; }, 0);
    const r = last + 1, rows = Math.max(it.rows, r);
    let any = false;
    for (let c = 0; c < it.cols; c++) { const L = colName(c), has = Array.from({ length: last }, (_, i) => val(L + (i + 1))).some(v => typeof v === 'number'); if (has) { cells[L + r] = `=SOMME(${L}1:${L}${last})`; any = true; } }
    if (!any) { toast('Aucune colonne de nombres à additionner'); return; }
    if (!cells['A' + r]) cells['A' + r] = 'Total';
    const nx = Object.assign({}, it, { rows, cells }); commit(replace(items, it, { rows, cells, h: sheetGeom(nx).h }));
  }  /* ---------- tableur as in Google Sheets: a cell or a range is selected (click, drag across the cells, Shift + click, the headers for whole
     rows / columns, the corner for everything); typing replaces the cell, Enter edits it, Suppr empties the range. Rows and columns are inserted or
     removed with the formulas following, the header edges resize them, and a formula being typed gets help and takes cells by click. ---------- */
  let sheetSel = null;   // { id, a: [col, row] anchor, b: [col, row] moving end }
  let fxRefs = [], fxIns = null, fxPop = null, fxPicking = false, sheetClip = null;
  const SH_COLORS = ['#4285F4', '#EA4335', '#E09A00', '#34A853', '#A142F4', '#12A4C4'];
  function sheetSelOf() { if (!sheetSel || sel.size !== 1 || !sel.has(sheetSel.id) || editing) return null; const it = byId.get(sheetSel.id); return it && it.k === 'sheet' ? it : null; }
  function sheetRange(it) {
    const s = sheetSel && sheetSel.id === it.id ? sheetSel : (() => { const rc = cellRC(sheetAt.get(it.id)) || [0, 0]; return { a: rc, b: rc }; })();
    const cl = (v, n) => clamp(v, 0, n - 1);
    return { c0: cl(Math.min(s.a[0], s.b[0]), it.cols), c1: cl(Math.max(s.a[0], s.b[0]), it.cols), r0: cl(Math.min(s.a[1], s.b[1]), it.rows), r1: cl(Math.max(s.a[1], s.b[1]), it.rows) };
  }
  function sheetSelect(it, a, b) { sheetSel = { id: it.id, a, b: b || a }; sheetAt.set(it.id, cellRef(a[0], a[1])); if (!sel.has(it.id) || sel.size !== 1) sel = new Set([it.id]); schedule(); }
  /* the selection frame and the lit headers; while a formula is typed, the cells it points to, each in its colour */
  function sheetSelPaint() {
    for (const [id, n] of nodes) {
      const it = byId.get(id); if (!it || it.k !== 'sheet') continue;
      const grid = n.querySelector('.shg'); if (!grid) continue;
      const g = sheetGeom(it), typing = editing === id && editSub && editSub !== 'title';
      const R = sheetSelOf() === it || typing ? sheetRange(it) : null;
      const box = (c0, r0, c1, r1) => {
        c0 = clamp(c0, 0, it.cols - 1); c1 = clamp(c1, 0, it.cols - 1); r0 = clamp(r0, 0, it.rows - 1); r1 = clamp(r1, 0, it.rows - 1);
        let x = g.hw, y = g.rh, w = 0, h = 0;
        for (let i = 0; i < c0; i++) x += g.cws[i]; for (let i = 0; i < r0; i++) y += g.rhs[i];
        for (let i = c0; i <= c1; i++) w += g.cws[i]; for (let i = r0; i <= r1; i++) h += g.rhs[i];
        return `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px`;
      };
      let html = '';
      if (R && !typing) html += `<div class="shsel${R.c0 === R.c1 && R.r0 === R.r1 ? '' : ' many'}" style="${box(R.c0, R.r0, R.c1, R.r1)}"></div>`;
      if (typing) html += fxRefs.filter(f => f.c0 < it.cols && f.r0 < it.rows).map(f => `<div class="shref" style="${box(f.c0, f.r0, f.c1, f.r1)};--rc:${f.color}"></div>`).join('');
      let ov = grid.querySelector('.shov'); if (!ov) { ov = document.createElement('div'); ov.className = 'shov'; grid.append(ov); ov._h = ''; }
      if (ov._h !== html) { ov.innerHTML = html; ov._h = html; }
      const lit = R && !typing;
      grid.querySelectorAll('.shh').forEach((h, i) => h.classList.toggle('on', !!lit && i >= R.c0 && i <= R.c1));
      grid.querySelectorAll('.shr').forEach((h, i) => h.classList.toggle('on', !!lit && i >= R.r0 && i <= R.r1));
    }
  }
  /* the cell under the pointer ([col, -1] on a column header, [-1, row] on a row number) */
  function sheetCellAt(it, cx, cy) {
    const n = nodes.get(it.id); if (!n) return null;
    for (const el of document.elementsFromPoint(cx, cy)) {
      if (!n.contains(el)) continue;
      const c = el.closest('[data-cell]'); if (c && c.dataset.cell !== 'title') return cellRC(c.dataset.cell);
      const h = el.closest('[data-col]'); if (h) return [+h.dataset.col, -1];
      const r = el.closest('[data-row]'); if (r) return [-1, +r.dataset.row];
    }
    return null;
  }
  function sheetPick(e, it, t) {
    const last = [it.cols - 1, it.rows - 1], cell = t.closest('[data-cell]'), hc = t.closest('[data-col]'), hr = t.closest('[data-row]');
    if (t.closest('.shc')) { sheetSelect(it, [0, 0], last); return; }
    const mode = hc ? 'col' : hr ? 'row' : 'cell';
    let a = hc ? [+hc.dataset.col, 0] : hr ? [0, +hr.dataset.row] : cellRC(cell.dataset.cell);
    let b = hc ? [a[0], last[1]] : hr ? [last[0], a[1]] : a;
    if (e.shiftKey && sheetSel && sheetSel.id === it.id) { const o = sheetSel.a; a = mode === 'col' ? [o[0], 0] : mode === 'row' ? [0, o[1]] : o; }
    sheetSelect(it, a, b);
    const pid = e.pointerId;
    const move = ev => {
      if (ev.pointerId !== pid || !sheetSel) return;
      const p = sheetCellAt(it, ev.clientX, ev.clientY), cur = byId.get(it.id); if (!p || !cur) return;
      const ob = sheetSel.b, nb = mode === 'col' ? [p[0] < 0 ? ob[0] : p[0], cur.rows - 1] : mode === 'row' ? [cur.cols - 1, p[1] < 0 ? ob[1] : p[1]] : [p[0] < 0 ? ob[0] : p[0], p[1] < 0 ? ob[1] : p[1]];
      if (nb[0] !== ob[0] || nb[1] !== ob[1]) { sheetSel.b = nb; schedule(); }
    };
    const up = ev => { if (ev.pointerId !== pid) return; removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); };
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true);
  }
  /* right click: the cell or header under the pointer becomes the selection, unless it is already in it */
  function sheetCtx(t, it) {
    if (!it || it.k !== 'sheet') return;
    const c = t.closest('[data-cell]'), hc = t.closest('[data-col]'), hr = t.closest('[data-row]'), on = sheetSelOf() === it, R = sheetRange(it);
    if (c && c.dataset.cell !== 'title') { const rc = cellRC(c.dataset.cell); if (!on || rc[0] < R.c0 || rc[0] > R.c1 || rc[1] < R.r0 || rc[1] > R.r1) sheetSelect(it, rc); }
    else if (hc) { const i = +hc.dataset.col; if (!on || i < R.c0 || i > R.c1 || R.r0 || R.r1 !== it.rows - 1) sheetSelect(it, [i, 0], [i, it.rows - 1]); }
    else if (hr) { const i = +hr.dataset.row; if (!on || i < R.r0 || i > R.r1 || R.c0 || R.c1 !== it.cols - 1) sheetSelect(it, [0, i], [it.cols - 1, i]); }
  }
  /* drag a header edge: that column (row) takes its own size */
  function sheetSizeDrag(e, it, axis, i) {
    const before = items, g = sheetGeom(it), x0 = axis === 'col' ? e.clientX : e.clientY, pid = e.pointerId;
    const base = (axis === 'col' ? g.cws : g.rhs).map(v => v / g.fs);
    host.classList.add(axis === 'col' ? 'sh-cz' : 'sh-rz');
    const move = ev => {
      if (ev.pointerId !== pid) return;
      const d = ((axis === 'col' ? ev.clientX : ev.clientY) - x0) / view.k / g.fs, arr = base.slice();
      arr[i] = Math.max(axis === 'col' ? 2.2 : 1.4, base[i] + d);
      const p = axis === 'col' ? { cw: arr } : { rh: arr }, ng = sheetGeom(Object.assign({}, it, p)); p.w = ng.w; p.h = ng.h;
      setLive(replace(before, it, p));
    };
    const up = ev => { if (ev.pointerId !== pid) return; removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); host.classList.remove('sh-cz', 'sh-rz'); if (items !== before) commit(items, { before }); };
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true);
  }
  /* n rows / columns inserted at `at` (n < 0: removed from `at`) */
  function sheetInsert(it, axis, at, n) {
    const cnt = axis === 'col' ? it.cols : it.rows;
    if (n < 0) { at = clamp(at, 0, cnt - 1); n = Math.max(n, -(cnt - at)); if (-n >= cnt) { toast(axis === 'col' ? 'Le tableau garde au moins une colonne' : 'Le tableau garde au moins une ligne'); return; } }
    if (!n) return;
    const g = sheetGeom(it), p = { cells: sheetShift(it.cells, axis, at, n) };
    if (axis === 'col') {
      p.cols = it.cols + n;
      if (it.cw) { const cw = g.cws.map(v => v / g.fs); if (n > 0) cw.splice(at, 0, ...Array(n).fill(cw[Math.min(at, cw.length - 1)] || 7)); else cw.splice(at, -n); p.cw = cw; }
      else p.w = it.w + g.cw * n;
    } else {
      p.rows = it.rows + n;
      if (it.rh) { const rh = Array.from({ length: it.rows }, (_, i) => it.rh[i] || null); if (n > 0) rh.splice(at, 0, ...Array(n).fill(null)); else rh.splice(at, -n); p.rh = rh; }
    }
    const ng = sheetGeom(Object.assign({}, it, p)); if (p.cw) p.w = ng.w; p.h = ng.h;
    commit(replace(items, it, p));
    const cur = byId.get(it.id);
    if (cur && sheetSel && sheetSel.id === it.id) { const cl = ([c, r]) => [clamp(c, 0, cur.cols - 1), clamp(r, 0, cur.rows - 1)]; sheetSel.a = cl(sheetSel.a); sheetSel.b = cl(sheetSel.b); }
  }
  function sheetClear(it, R) {
    const cells = Object.assign({}, it.cells); let any = false;
    for (let c = R.c0; c <= R.c1; c++) for (let r = R.r0; r <= R.r1; r++) { const k = cellRef(c, r); if (k in cells) { delete cells[k]; any = true; } }
    if (any) commit(replace(items, it, { cells }));
  }
  /* copy: the shown values as tab-separated text (for any other app), and the formulas for a paste back into a tableur */
  function sheetCopy(it, R, cut) {
    const val = sheetEval(it.cells), lines = [], raws = [];
    for (let r = R.r0; r <= R.r1; r++) {
      const line = [], raw = [];
      for (let c = R.c0; c <= R.c1; c++) { const k = cellRef(c, r), v = it.cells[k] || ''; raw.push(v); line.push(v[0] === '=' ? sheetShow(val(k)) : v); }
      lines.push(line.join('\t')); raws.push(raw);
    }
    const text = lines.join('\n'); sheetClip = { text, raws, from: [R.c0, R.r0] };
    try { navigator.clipboard.writeText(text).catch(() => {}); } catch (e) {}
    toast(cut ? 'Cellules coupées' : 'Cellules copiées');
    if (cut) sheetClear(it, R);
  }
  /* references move with a pasted formula, except the ones fixed with $ */
  const sheetMoveF = (f, dc, dr) => f.split(/("(?:[^"]|"")*")/).map((part, k) => k % 2 ? part : part.replace(/(?<![A-Za-z0-9_.])(\$?)([A-Za-z]{1,2})(\$?)(\d+)(?![A-Za-z0-9_(])/g, (all, d1, c, d2, r) => {
    const ci = d1 ? colIndex(c) : colIndex(c) + dc, ri = d2 ? +r - 1 : +r - 1 + dr; return ci < 0 || ri < 0 ? '#REF!' : d1 + colName(ci) + d2 + (ri + 1);
  })).join('');
  function sheetPaste(it, txt) {
    const R = sheetRange(it), mine = sheetClip && sheetClip.text === txt.replace(/\r/g, '').replace(/\n$/, '');
    const rows = mine ? sheetClip.raws : txt.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(l => l.split('\t'));
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const p = { cells: Object.assign({}, it.cells) };
    const addC = R.c0 + w - it.cols, addR = R.r0 + h - it.rows, g = sheetGeom(it);
    if (addC > 0) { p.cols = it.cols + addC; if (it.cw) p.cw = g.cws.map(v => v / g.fs).concat(Array(addC).fill(7)); else p.w = it.w + g.cw * addC; }
    if (addR > 0) p.rows = it.rows + addR;
    rows.forEach((row, r) => row.forEach((v, c) => {
      const k = cellRef(R.c0 + c, R.r0 + r); v = String(v).trim();
      if (mine && v[0] === '=') v = sheetMoveF(v, R.c0 - sheetClip.from[0], R.r0 - sheetClip.from[1]);
      if (v) p.cells[k] = v; else delete p.cells[k];
    }));
    const ng = sheetGeom(Object.assign({}, it, p)); if (p.cw) p.w = ng.w; p.h = ng.h;
    commit(replace(items, it, p));
    sheetSelect(byId.get(it.id), [R.c0, R.r0], [R.c0 + w - 1, R.r0 + h - 1]);
  }
  function sheetSelKey(e, it) {
    const k = e.key, mod = e.ctrlKey || e.metaKey, s = sheetSel, R = sheetRange(it);
    const go = (dc, dr, ext) => {
      const from = ext ? s.b : s.a, nb = [clamp(from[0] + dc, 0, it.cols - 1), clamp(from[1] + dr, 0, it.rows - 1)];
      if (ext) s.b = nb; else { s.a = nb; s.b = nb; sheetAt.set(it.id, cellRef(nb[0], nb[1])); }
      schedule();
    };
    if (k.startsWith('Arrow')) { e.preventDefault(); const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k]; const far = mod ? Math.max(it.cols, it.rows) : 1; go(d[0] * far, d[1] * far, e.shiftKey); return true; }
    if (k === 'Tab') { e.preventDefault(); go(e.shiftKey ? -1 : 1, 0); return true; }
    if ((k === 'Enter' || k === 'F2') && !mod) { e.preventDefault(); startEdit(it.id, null, cellRef(s.a[0], s.a[1])); return true; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); sheetClear(it, R); return true; }
    if (k === 'Escape') { e.preventDefault(); sheetSel = null; schedule(); return true; }
    if (mod && /^[cx]$/i.test(k) && !e.shiftKey) { e.preventDefault(); sheetCopy(it, R, k.toLowerCase() === 'x'); return true; }
    if (mod && /^a$/i.test(k)) { e.preventDefault(); s.a = [0, 0]; s.b = [it.cols - 1, it.rows - 1]; schedule(); return true; }
    // Ctrl - removes the selected rows (or columns), Ctrl + inserts one, as in Google Sheets
    if (mod && (k === '-' || k === '+' || k === '=')) {
      e.preventDefault();
      const rowsAll = R.c0 === 0 && R.c1 === it.cols - 1, colsAll = R.r0 === 0 && R.r1 === it.rows - 1;
      if (k === '-') { if (colsAll && !rowsAll) sheetInsert(it, 'col', R.c0, -(R.c1 - R.c0 + 1)); else sheetInsert(it, 'row', R.r0, -(R.r1 - R.r0 + 1)); }
      else if (colsAll && !rowsAll) sheetInsert(it, 'col', R.c0, 1); else sheetInsert(it, 'row', R.r0, 1);
      return true;
    }
    if (k.length === 1 && !mod && !e.altKey) { e.preventDefault(); startEdit(it.id, k, cellRef(s.a[0], s.a[1])); return true; }
    return false;
  }
  /* ---------- formula help ---------- */
  function caretOf(el) {
    const s = getSelection(); if (!s.rangeCount || !el.contains(s.anchorNode)) return el.textContent.length;
    const r = s.getRangeAt(0), pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.endContainer, r.endOffset); return pre.toString().length;
  }
  function setCellText(el, txt, caret) {
    el.textContent = txt;
    const node = el.firstChild, r = document.createRange();
    if (node && node.nodeType === 3) r.setStart(node, clamp(caret, 0, node.length)); else r.setStart(el, 0);
    r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  const fxNorm = t => t.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  /* the references of a formula, outside its quoted text, one colour per reference */
  function fxScan(txt) {
    const out = [], col = new Map(); let i = 0;
    txt.split(/("(?:[^"]|"")*")/).forEach((part, k) => {
      if (!(k % 2)) for (const m of part.matchAll(/(?<![A-Za-z0-9_.])\$?([A-Za-z]{1,2})\$?(\d+)(?::\$?([A-Za-z]{1,2})\$?(\d+))?(?![A-Za-z0-9_(])/g)) {
        const key = m[0].toUpperCase().replace(/\$/g, ''); if (!col.has(key)) col.set(key, SH_COLORS[col.size % SH_COLORS.length]);
        const a = [colIndex(m[1]), +m[2] - 1], b = m[3] ? [colIndex(m[3]), +m[4] - 1] : a;
        out.push({ s: i + m.index, e: i + m.index + m[0].length, c0: Math.min(a[0], b[0]), c1: Math.max(a[0], b[0]), r0: Math.min(a[1], b[1]), r1: Math.max(a[1], b[1]), color: col.get(key) });
      }
      i += part.length;
    });
    return out;
  }
  /* the formula bar in the title band: the cell being typed in and what it holds, references in their colours */
  function sheetFx(id, el) {
    const n = nodes.get(id), fx = n && n.querySelector('.shfx'); if (!fx) return;
    const ref = editSub && editSub !== 'title' ? editSub : ''; if (!ref) { fx.innerHTML = ''; return; }
    const txt = el.textContent; let h = '', p = 0;
    if (txt[0] === '=') for (const f of fxRefs) { h += esc(txt.slice(p, f.s)) + `<span style="color:${f.color}">${esc(txt.slice(f.s, f.e))}</span>`; p = f.e; }
    fx.innerHTML = `<em>${ref}</em>` + h + esc(txt.slice(p));
  }
  function sheetAssist(it, el) {
    const txt = el.textContent, isF = txt[0] === '=';
    fxRefs = isF ? fxScan(txt) : [];
    sheetFx(it.id, el); sheetSelPaint(); closeFxPop();
    if (!isF) return;
    const pos = caretOf(el), before = txt.slice(0, pos);
    const m = /(^=|[(;,+\-*/^&<>=\s])([A-Za-zÀ-ÿ]+)$/.exec(before);
    if (m) {
      const q = fxNorm(m[2]), list = SHEET_HELP.filter(h => h[0].startsWith(q) && h[0] !== q);
      if (list.length) { openFxPop(el, list.slice(0, 7), { from: pos - m[2].length, to: pos }); return; }
    }
    // inside a function's brackets: what it expects
    let depth = 0;
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before[i];
      if (ch === '"') break;
      if (ch === ')') depth++;
      else if (ch === '(') { if (depth) { depth--; continue; } const f = /([A-Za-zÀ-ÿ]+)\s*$/.exec(before.slice(0, i)), h = f && SHEET_HELP.find(x => x[0] === fxNorm(f[1])); if (h) openFxPop(el, null, null, h); break; }
    }
  }
  function openFxPop(el, list, span, hint) {
    const r = el.getBoundingClientRect(), p = document.createElement('div');
    p.className = 'shpop';
    p.innerHTML = list ? list.map((h, i) => `<div class="shpo${i ? '' : ' on'}" data-fn="${h[0]}"><b>${h[0]}</b><small>${esc(h[2])}</small></div>`).join('') + `<div class="shpsig">${esc(list[0][1])}</div>`
      : `<div class="shpsig">${esc(hint[1])}</div><div class="shpdesc">${esc(hint[2])}</div>`;
    p.style.left = Math.round(r.left) + 'px'; p.style.top = Math.round(r.bottom + 4) + 'px';
    p.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); const o = ev.target.closest('[data-fn]'); if (o) fxAccept(el, o.dataset.fn); });
    p.addEventListener('mousedown', ev => ev.preventDefault());
    document.body.append(p); fxPop = { el: p, list, span, i: 0 };
    const pr = p.getBoundingClientRect(); if (pr.bottom > innerHeight - 8) p.style.top = Math.round(r.top - pr.height - 4) + 'px';
  }
  function closeFxPop() { if (fxPop) { fxPop.el.remove(); fxPop = null; } }
  function fxAccept(el, name) {
    const txt = el.textContent, sp = fxPop.span, ins = name + '(';
    closeFxPop(); setCellText(el, txt.slice(0, sp.from) + ins + txt.slice(sp.to), sp.from + ins.length);
    if (editing) editInput(editing, el);
  }
  function sheetAssistKey(ev, el) {
    if (!fxPop) return false;
    if (ev.key === 'Escape') { ev.preventDefault(); closeFxPop(); return true; }
    if (!fxPop.list) return false;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault(); const L = fxPop.list.length; fxPop.i = (fxPop.i + (ev.key === 'ArrowDown' ? 1 : L - 1)) % L;
      fxPop.el.querySelectorAll('.shpo').forEach((o, i) => o.classList.toggle('on', i === fxPop.i)); fxPop.el.querySelector('.shpsig').textContent = fxPop.list[fxPop.i][1]; return true;
    }
    if (ev.key === 'Tab' || ev.key === 'Enter') { ev.preventDefault(); fxAccept(el, fxPop.list[fxPop.i][0]); return true; }
    return false;
  }
  /* a click on a cell while a formula waits for a value (after =, an operator, ( or ;) puts its reference in; dragging makes it a range;
     clicking again right after replaces it, as in Google Sheets */
  function fxCanRef(el) {
    const t = el.textContent; if (t[0] !== '=') return false;
    const pos = caretOf(el); if (fxIns && fxIns.el === el && pos === fxIns.e) return true;
    return /[=(;,+\-*/^&<>:]\s*$/.test(t.slice(0, pos));
  }
  function fxPick(e, it, ref) {
    const el = editEl(it, editSub); if (!el) return;
    const a = cellRC(ref), pid = e.pointerId;
    const put = b => {
      const txt = el.textContent, pos = caretOf(el), again = fxIns && fxIns.el === el && pos === fxIns.e, s0 = again ? fxIns.s : pos, e0 = again ? fxIns.e : pos;
      const r = cellRef(Math.min(a[0], b[0]), Math.min(a[1], b[1])) + (a[0] === b[0] && a[1] === b[1] ? '' : ':' + cellRef(Math.max(a[0], b[0]), Math.max(a[1], b[1])));
      setCellText(el, txt.slice(0, s0) + r + txt.slice(e0), s0 + r.length);
      fxIns = { el, s: s0, e: s0 + r.length };
      editInput(it.id, el);
    };
    put(a); fxPicking = true;
    const move = ev => { if (ev.pointerId !== pid) return; const p = sheetCellAt(byId.get(it.id) || it, ev.clientX, ev.clientY); if (p && p[0] >= 0 && p[1] >= 0) put(p); };
    const up = ev => { if (ev.pointerId !== pid) return; fxPicking = false; removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); el.focus({ preventScroll: true }); };
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true);
  }

  function editInput(id, el) {
    const it = byId.get(id); if (!it) return;
    if (it.k === 'note') { const t = el; t.style.fontSize = it.fs + 'px'; let lo = 9, hi = it.fs; if (t.scrollHeight > it.h - 27 || t.scrollWidth > it.w - 31) { for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; t.style.fontSize = m + 'px'; if (t.scrollHeight > it.h - 27 || t.scrollWidth > it.w - 31) hi = m; else lo = m; } t.style.fontSize = lo + 'px'; } }
    if (it.k === 'text') { const n = nodes.get(id); const w = Math.ceil(n.offsetWidth), h = Math.ceil(n.offsetHeight); if (w !== it.w || h !== it.h) { const nx = Object.assign({}, it, { w, h }); n._it = nx; items = items.map(x => x.id === id ? nx : x); reindex(); renderOverlay(); } }
    if (it.k === 'mind') { setLive(relayout(items)); }
    if (it.k === 'conn') renderOverlay();
    if (it.k === 'todo') { const n = nodes.get(id); if (n) measureTodo(n, byId.get(id)); renderOverlay(); }
    if (it.k === 'sheet') sheetAssist(it, el);
  }
  function finishEdit() {
    const id = editing, sub = editSub; if (!id) return;
    const it = byId.get(id); editing = null; editSub = null;
    if (!it) return;
    const el = editEl(it, sub); const n = nodes.get(id);
    const raw = el ? el.innerText.replace(/ /g, ' ').replace(/\n+$/, '') : '';
    if (el) { el.oninput = el.onkeydown = el.onblur = null; el.contentEditable = 'false'; el.removeAttribute('contenteditable'); el.style.userSelect = ''; }
    if (n) { n.classList.remove('editing'); n._sig = ''; }
    getSelection().removeAllRanges();
    const before = editStart.id === id ? editStart.items : undefined;
    if (it.k === 'todo') {
      if (sub === 'title') { const v = raw.trim() || 'À faire'; if (v !== it.title) { commit(replace(items, it, { title: v }), { before }); syncTodoBox(byId.get(id)); } else schedule(); return; }
      const t = taskById(sub);
      if (!t) { schedule(); return; }
      if (!raw.trim()) { const i = S.tasks.indexOf(t); if (i >= 0) S.tasks.splice(i, 1); save(); commit(replace(items, it, { tasks: it.tasks.filter(x => x !== sub) }), { before }); renderSide(); return; }
      if (t.t !== raw.trim()) { t.t = raw.trim(); save(); renderSide(); }
      n && (n._it = null); schedule(); return;
    }
    if (it.k === 'sheet') {
      closeFxPop(); fxRefs = []; fxIns = null;
      if (sub === 'title') { const v = raw.trim() || 'Tableau'; if (v !== it.title) commit(replace(items, it, { title: v }), { before }); else schedule(); return; }
      const cells = Object.assign({}, it.cells), v = raw.trim() ? raw.replace(/\n/g, ' ').trim() : '';
      if (v) cells[sub] = v; else delete cells[sub];
      if ((it.cells[sub] || '') !== v) commit(replace(items, it, { cells }), { before }); else schedule();
      return;
    }
    if (it.k === 'text' && !raw.trim()) { commit(items.filter(i => i.id !== id && !(i.k === 'conn' && (i.a.id === id || i.b.id === id)))); sel.delete(id); return; }
    if (it.k === 'mind' && !raw.trim() && it.parent && !mindKids(id).length) { commit(items.filter(i => i.id !== id)); sel = new Set([it.parent]); return; }
    const key = it.k === 'frame' ? 'title' : 'txt';
    const val = it.k === 'mind' && !raw.trim() ? 'Idée' : it.k === 'frame' && !raw.trim() ? 'Cadre' : raw;
    if (val !== it[key]) commit(replace(items, it, { [key]: val }), { before });
    else { items = relayout(items); reindex(); D.items = items; schedule(); }
  }
  let editStart = { id: null, items: null };

  /* ---------- creating ---------- */
  function createAt(kind, w) {
    let it;
    const k = view.k, s = clamp(1 / k, .5, 4);
    if (kind === 'note') it = mkNote(w.x - 110 * s, w.y - 110 * s, '', noteColor, { w: 220 * s, h: 220 * s, fs: Math.round(30 * s) });
    if (kind === 'text') it = mkText(w.x, w.y - 16 * s, 'Texte', { fs: Math.round(28 * s) });
    if (kind === 'sheet') { it = mkSheet(0, 0, { fs: Math.round(14 * s) }); it.x = w.x - it.w / 2; it.y = w.y - 40 * s; commit(items.concat(it)); sel = new Set([it.id]); setTool('select'); render(); startEdit(it.id, null, 'A1'); return; }
    if (kind === 'mind') { const t = mkMind(w.x - 80, w.y - 32, 'Idée centrale'); commit(items.concat(t)); sel = new Set([t[0].id]); setTool('select'); render(); startEdit(t[0].id); const el = editEl(byId.get(t[0].id)); if (el) { const r = document.createRange(); r.selectNodeContents(el); const g = getSelection(); g.removeAllRanges(); g.addRange(r); } return; }
    if (kind === 'todo') it = mkTodo(w.x - 120 * s, w.y - 50 * s, 'À faire', [], { w: 240 * s, fs: Math.round(17 * s), font: SANS });
    commit(items.concat(it)); sel = new Set([it.id]); setTool('select'); render(); startEdit(it.id);
    // a new text block starts with "Texte" selected, so typing replaces it
    if (kind === 'text' && editing === it.id) { const el = editEl(it); if (el) { const r = document.createRange(); r.selectNodeContents(el); const g = getSelection(); g.removeAllRanges(); g.addRange(r); } }
  }

  /* ---------- UI Design zones (0.2.42): Qt Designer–like blocks and layouts, a property inspector, a test mode ---------- */
  /* a block's rendering is its zone's: the frame with `ui` its centre falls in (visual outside any zone) */
  function uiZoneOf(it) { return null; }
  function uiZoneOfOld(it) { const cx = it.x + it.w / 2, cy = it.y + it.h / 2; let z = null; for (const f of items) if (f.k === 'frame' && f.ui && !f.hid && inBox(cx, cy, boxOf(f))) z = f; return z; }
  const uiFid = it => (uiZoneOf(it) || {}).ui || 'theme';
  function uzHeadHTML(z) {
    return `<div class="uzh"><span class="uztag">UI DESIGN</span><span class="uzinfo">Fenêtres et dialogues = écrans · flèches = clics</span><span class="uzsp"></span><div class="uzseg" role="group" aria-label="Rendu">${UI_FIDS.map(([v, l]) => `<button data-uz="${v}" aria-pressed="${z.ui === v}">${l}</button>`).join('')}</div><button class="uzb" data-uz="lib">${icon('layout')}Blocs</button><button class="uzb pri" data-uz="test">${icon('play')}Tester</button></div>`;
  }
  const uiKids = id => items.filter(i => i.k === 'uic' && i.p === id).sort((a, b) => (a.o ?? 0) - (b.o ?? 0));
  const uiLayOf = id => { const b = byId.get(id); return b && b.t === 'box' ? ukBoxStyle(b).lay : 'none'; };
  const uiLaidOut = it => !!(it && it.k === 'uic' && it.p && uiLayOf(it.p) !== 'none');
  const uiDir = it => it.p && uiLayOf(it.p) === 'v' ? 'v' : 'h';
  const uiName = it => it.t === 'box' ? (ukBoxStyle(it).title || 'Conteneur') : it.t === 'spacer' ? 'Espaceur' : String(it.txt || UI_TYPES[it.t] || 'Bloc').split('\n')[0].slice(0, 32) || UI_TYPES[it.t];
  const uiRoot = it => { let r = it, n = 0; while (r && r.p && byId.get(r.p) && n++ < 50) r = byId.get(r.p); return r; };
  /* where a block dropped at p would go: the deepest box under the pointer, and the place in its layout (a blue line) */
  function uiInsAt(p, skip) {
    let box = null;
    for (let k = items.length - 1; k >= 0; k--) { const i = items[k]; if (i.k !== 'uic' || i.t !== 'box' || i.hid || (skip && skip.has(i.id))) continue; if (inBox(p.x, p.y, [i.x, i.y, i.x + i.w, i.y + i.h])) { box = i; break; } }
    if (!box) return null;
    const c = ukBoxStyle(box), L = c.lay;
    if (L === 'none') return { c: box.id, idx: null, x: box.x, y: box.y, w: box.w, h: box.h, box: 1 };
    const m = c.m.map(v => +v || 0), ch = ukChrome(c), X = box.x + m[0], Y = box.y + m[1] + ch, W = box.w - m[0] - m[2], Hh = box.h - m[1] - m[3] - ch, sp = +c.sp || 0;
    const K = uiKids(box.id).filter(i => !(skip && skip.has(i.id)));
    if (L === 'h' || L === 'v') {
      const Hz = L === 'h', idx = K.filter(k => Hz ? k.x + k.w / 2 < p.x : k.y + k.h / 2 < p.y).length;
      let at; if (!K.length) at = Hz ? X : Y; else if (idx === 0) at = (Hz ? K[0].x : K[0].y) - sp / 2; else if (idx === K.length) { const l = K[K.length - 1]; at = (Hz ? l.x + l.w : l.y + l.h) + sp / 2; } else { const a = K[idx - 1], b = K[idx]; at = Hz ? (a.x + a.w + b.x) / 2 : (a.y + a.h + b.y) / 2; }
      return Hz ? { c: box.id, idx, x: at, y: Y, w: 0, h: Hh } : { c: box.id, idx, x: X, y: at, w: W, h: 0 };
    }
    if (!K.length) return { c: box.id, idx: 0, x: X, y: Y, w: 0, h: Math.min(Hh, 40) };
    let best = 0, bd = Infinity; K.forEach((k, q) => { const dx = Math.max(k.x - p.x, 0, p.x - k.x - k.w), dy = Math.max(k.y - p.y, 0, p.y - k.y - k.h), d = dx * dx + dy * dy; if (d < bd) { bd = d; best = q; } });
    const k = K[best], after = p.x > k.x + k.w / 2;
    return { c: box.id, idx: best + (after ? 1 : 0), x: after ? k.x + k.w + sp / 2 : k.x - sp / 2, y: k.y, w: 0, h: k.h };
  }
  /* put the blocks `roots` where the insertion says: in a layout (an order), in a free box, or loose on the board */
  function uiApplyIns(next, roots, ins) {
    const R = new Set(roots), s4 = v => Math.round(v / 4) * 4;
    if (!ins || ins.idx == null) { const pid = ins ? ins.c : undefined; return next.map(i => R.has(i.id) ? Object.assign({}, i, { p: pid, o: pid ? 1e6 : undefined, x: s4(i.x), y: s4(i.y) }) : i); }
    const L = ukBoxStyle(next.find(i => i.id === ins.c) || {}).lay;
    const sib = next.filter(i => i.k === 'uic' && i.p === ins.c && !R.has(i.id)).sort((a, b) => (a.o ?? 0) - (b.o ?? 0));
    const mv = next.filter(i => R.has(i.id)).sort((a, b) => L === 'v' ? a.y - b.y : a.x - b.x);
    const order = sib.slice(0, ins.idx).concat(mv, sib.slice(ins.idx)), o = new Map(order.map((i, k) => [i.id, k]));
    return next.map(i => o.has(i.id) ? Object.assign({}, i, { p: ins.c, o: o.get(i.id) }) : i);
  }
  /* the zone's rendering: its blocks are redrawn (a new object each, so they repaint) */
  function uiSetFid(z, v) {
    if (!z || !UI_FIDS.some(f => f[0] === v) || z.ui === v) return;
    const b = boxOf(z);
    commit(items.map(i => i.id === z.id ? Object.assign({}, i, { ui: v }) : i.k === 'uic' && inBox(i.x + i.w / 2, i.y + i.h / 2, b) ? Object.assign({}, i) : i));
    qSig = '';
  }
  /* Qt Designer's « Lay out horizontally / vertically / in a grid »: the selected blocks go into a new box with that layout;
     a single box selected gets the layout itself */
  function uiWrap(L) {
    let list = selItems().filter(i => i.k === 'uic'); list = list.filter(i => !list.some(o => o !== i && uiDesc(items, o.id).has(i.id)));
    if (!list.length) { toast('Sélectionnez des blocs UI'); return; }
    if (list.length === 1 && list[0].t === 'box') { uiSetLay(list[0], L); return; }
    const p = list[0].p; if (list.some(i => i.p !== p)) { toast('Ces blocs ne sont pas dans le même conteneur'); return; }
    let ord;
    if (L === 'grid') { const rows = []; for (const i of list.slice().sort((a, b) => a.y - b.y)) { const r = rows.find(r => Math.abs(r[0].y - i.y) < Math.min(r[0].h, i.h) / 2); r ? r.push(i) : rows.push([i]); } rows.forEach(r => r.sort((a, b) => a.x - b.x)); ord = rows.flat(); var cols = Math.max(...rows.map(r => r.length)); }
    else ord = list.slice().sort((a, b) => L === 'v' ? a.y - b.y : a.x - b.x);
    const bb = unionBox(list), o0 = Math.min(...list.map(i => i.o ?? 0));
    const box = Object.assign(mkUic('box', bb[0], bb[1], { w: bb[2] - bb[0], h: bb[3] - bb[1], c: { sk: 'none', title: L === 'h' ? 'Ligne' : L === 'v' ? 'Colonne' : 'Grille', lay: L, m: [0, 0, 0, 0], sp: 6, sv: 6, cols: cols || 2, bg: '#00000000', bw: 0, r: 0 } }), { x: bb[0], y: bb[1] });
    if (p) { box.p = p; box.o = o0; }
    const om = new Map(ord.map((i, k) => [i.id, k])), first = items.findIndex(i => om.has(i.id));
    const next = items.map(i => om.has(i.id) ? Object.assign({}, i, { p: box.id, o: om.get(i.id) }) : i); next.splice(first, 0, box);
    commit(next); sel = new Set([box.id]); qSig = ''; toast(`Mis en layout ${L === 'h' ? 'horizontal' : L === 'v' ? 'vertical' : 'en grille'}`);
  }
  /* a box's layout changes: coming from « none », its blocks are ordered by where they are */
  function uiSetLay(box, L) {
    const cur = ukBoxStyle(box); if (cur.lay === L) return;
    let next = replace(items, box, { c: Object.assign({}, box.c, { lay: L }) });
    if (cur.lay === 'none' && L !== 'none') { const K = uiKids(box.id).sort((a, b) => L === 'v' ? a.y - b.y || a.x - b.x : Math.abs(a.y - b.y) > 20 && L === 'grid' ? a.y - b.y : a.x - b.x), om = new Map(K.map((i, k) => [i.id, k])); next = next.map(i => om.has(i.id) ? Object.assign({}, i, { o: om.get(i.id) }) : i); }
    commit(next); qSig = '';
  }
  /* ---------- the block library: four tiles ---------- */
  function uiLibOpen(zid) {
    if (!wrap) return;
    if (!uiLib) { uiLib = { el: document.createElement('div') }; uiLib.el.className = 'uilib'; uiLib.el.setAttribute('role', 'dialog'); uiLib.el.setAttribute('aria-label', 'Blocs UI'); wrap.append(uiLib.el); uiLibBind(); }
    if (zid) uiLib.zone = zid;
    uiLib.el.innerHTML = `<div class="ulh"><b>Blocs</b><small>façon Qt Designer</small><button data-ulx="1" title="Fermer" aria-label="Fermer">${icon('x', 'sm')}</button></div>
      <div class="ulg">${Object.keys(UI_TYPES).map(t => `<div class="ult" data-ult="${t}" title="${esc(UI_HINTS[t])} · cliquer pour l’ajouter, ou glisser"><span class="ulp">${uicThumb(t)}</span><span class="ln">${UI_TYPES[t]}</span></div>`).join('')}</div>
      <div class="ulf"><b>Glisser</b> un bloc dans un conteneur : un trait bleu montre où il se range.<br><b>Ctrl 1 / 2 / 5</b> : mettre la sélection en ligne, en colonne ou en grille.<br>Le réglage de chaque bloc est dans l’<b>inspecteur</b> à droite.</div>`;
  }
  function uiLibClose() { if (uiLib) { uiLib.el.remove(); uiLib = null; } }
  function uiLibBind() {
    const el = uiLib.el;
    el.addEventListener('keydown', e => e.stopPropagation());
    el.addEventListener('click', e => { if (e.target.closest('[data-ulx]')) uiLibClose(); });
    el.addEventListener('pointerdown', e => {
      const tile = e.target.closest('[data-ult]'); if (!tile || e.button !== 0) return;
      e.preventDefault(); const t = tile.dataset.ult, x0 = e.clientX, y0 = e.clientY, pid = e.pointerId; let gh = null, ins = null;
      const over = ev => { const r = hostRect(), q = el.getBoundingClientRect(), x = ev.clientX, y = ev.clientY; return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && !(x >= q.left && x <= q.right && y >= q.top && y <= q.bottom); };
      const sample = mkUic(t, 0, 0, t === 'box' ? { w: 200, h: 120, c: { title: 'Panneau' } } : {}), hh = ukLeafHint(sample, 'h'); if (t !== 'box') { sample.w = hh.w; sample.h = hh.h; }
      const move = ev => {
        if (ev.pointerId !== pid) return;
        if (!gh) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; gh = document.createElement('div'); gh.className = 'uidrag'; gh.innerHTML = `<div class="it uic uf-theme ut-${t}" style="width:${sample.w}px;height:${sample.h}px">${uicHTML(sample, 'h')}</div>`; document.body.append(gh); }
        const k = view.k; gh.style.transform = `translate(${ev.clientX - sample.w * k / 2}px,${ev.clientY - sample.h * k / 2}px) scale(${k})`; gh.style.opacity = over(ev) ? .9 : .45;
        ins = over(ev) ? uiInsAt(toW(ev.clientX, ev.clientY), null) : null; uiIns = ins; renderOverlay();
      };
      const end = ev => {
        if (ev.pointerId !== pid) return;
        removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
        uiIns = null;
        if (!gh) { if (ev.type === 'pointerup') uiPlace(t, null, null); return; }
        gh.remove(); if (ev.type === 'pointerup' && over(ev)) uiPlace(t, toW(ev.clientX, ev.clientY), ins); else renderOverlay();
      };
      addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
    });
  }
  /* a new block: where it was dropped, else in the selected box (or after the selected block), else in the zone */
  function uiPlace(t, at, ins) {
    if (!UI_TYPES[t]) return;
    const s1 = sel.size === 1 ? byId.get([...sel][0]) : null;
    if (!at && !ins && s1 && s1.k === 'uic') {
      if (s1.t === 'box') ins = { c: s1.id, idx: ukBoxStyle(s1).lay === 'none' ? null : uiKids(s1.id).length };
      else if (s1.p) ins = { c: s1.p, idx: uiLayOf(s1.p) === 'none' ? null : uiKids(s1.p).indexOf(s1) + 1 };
    }
    const host0 = ins && byId.get(ins.c);
    if (!host0 && t === 'spacer') { toast('L’espaceur se pose dans un conteneur qui a un layout'); return; }
    const it = t === 'box' ? mkUic('box', 0, 0, host0 ? { w: 200, h: 120, c: { sk: 'panel', title: 'Panneau' } } : { w: 640, h: 420, c: { sk: 'window', title: 'Nouvelle fenêtre', bg: '#FAFAF8FF' } }) : mkUic(t, 0, 0);
    if (t !== 'box') { const h = ukLeafHint(it, 'h'); it.w = h.w; it.h = h.h; }
    if (at) { it.x = Math.round((at.x - it.w / 2) / 4) * 4; it.y = Math.round((at.y - it.h / 2) / 4) * 4; }
    else if (host0) { const c = ukBoxStyle(host0), n = uiKids(host0.id).length; it.x = host0.x + 16 + (n % 6) * 12; it.y = host0.y + ukChrome(c) + 16 + (n % 6) * 12; }
    else {
      const z = (uiLib && uiLib.zone && byId.get(uiLib.zone)) || (s1 && s1.ui ? s1 : s1 ? uiZoneOf(s1) : null);
      if (z) { const inZ = items.filter(i => i.k === 'uic' && !i.p && inBox(i.x + i.w / 2, i.y + i.h / 2, boxOf(z))), bb = unionBox(inZ); it.x = z.x + 32; it.y = bb ? bb[3] + 40 : z.y + 76; if (it.y + it.h > z.y + z.h - 16) { it.x = bb ? bb[2] + 40 : z.x + 32; it.y = z.y + 76; } }
      else { const c = centerW(); it.x = c.x - it.w / 2; it.y = c.y - it.h / 2; }
    }
    let next = items.concat(it); if (host0) next = uiApplyIns(next, [it.id], ins);
    commit(next); sel = new Set([it.id]); if (tool !== 'select') setTool('select'); render();
    const nb = byId.get(it.id); if (nb && !at) reveal(boxOf(nb));
  }
  /* ---------- the property inspector (Qt Designer's property editor) ---------- */
  const UI_STATES = [['n', 'Normal'], ['h', 'Survol'], ['p', 'Pressé'], ['d', 'Désactivé']];
  const UI_W8 = [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']];
  /* keys are paths: 'b.fills.0.s.1.1' is the colour of the second stop of the top fill; a state overrides a whole top-level key */
  const uiWalk = (o, ps) => { for (const p of ps) { if (o == null) return undefined; o = o[p]; } return o; };
  const uiSetDeep = (o, ps, v) => { let q = o; for (let i = 0; i < ps.length - 1; i++) { if (q[ps[i]] == null || typeof q[ps[i]] !== 'object') q[ps[i]] = /^\d+$/.test(ps[i + 1]) ? [] : {}; q = q[ps[i]]; } q[ps[ps.length - 1]] = v; return o; };
  function uiGet(it, k) {
    const ps = k.split('.'), [a, b] = ps;
    if (!b) return it[a];
    if (a === 'b') return uiWalk(ukBtnStyle(it, uiInsp && uiInsp.st || 'n'), ps.slice(1));
    if (a === 'f') return ukTxtStyle(it)[b];
    if (a === 'c') return ukBoxStyle(it)[b];
    if (a === 'lp') return ukLp(it, uiDir(it))[b];
  }
  const uiOver = (it, k) => { const [a, b] = k.split('.'), st = uiInsp && uiInsp.st || 'n'; return a === 'b' && st !== 'n' && it.bs && it.bs[st] && b in it.bs[st]; };
  function uiPatch(it, k, v) {
    const ps = k.split('.'), [a, b] = ps;
    if (!b) return { [a]: v };
    if (a === 'b') {
      const st = uiInsp && uiInsp.st || 'n';
      if (st === 'n') return { b: uiSetDeep(ukClone(Object.assign({}, UI_BTN, it.b)), ps.slice(1), v) };
      const bs = ukClone(it.bs || {}), o = bs[st] = bs[st] || {};
      if (ps.length > 2 && !(b in o)) o[b] = ukClone(ukBtnStyle(it, 'n')[b]);
      uiSetDeep(o, ps.slice(1), v); return { bs };
    }
    if (a === 'f') return { f: Object.assign({}, UI_TXT, it.f, { [b]: v }) };
    if (a === 'c') return { c: Object.assign({}, UI_BOX, it.c, { [b]: v }) };
    if (a === 'lp') return { lp: Object.assign({}, it.lp || {}, { [b]: v }) };
    return {};
  }
  function uiInspHTML(it) {
    const st = uiInsp.st, open = s => !((S.prefs.uiSec || {})[s]);
    const top = k => k.split('.').length <= 2;
    const ov = k => top(k) && uiOver(it, k) ? `<button class="urst" data-rst="${k}" title="Revenir à la valeur Normal">↺</button>` : '';
    const rst = k => uiOver(it, k) ? `<button class="urst" data-rst="${k}" title="Revenir à la valeur Normal">↺</button>` : '';
    const row = (k, lab, ctl, cls = '') => `<div class="uif${top(k) && uiOver(it, k) ? ' ov' : ''} ${cls}"><label${k ? ` data-scrub="${k}"` : ''}>${lab}</label><div class="uic2">${ctl}</div>${k ? ov(k) : ''}</div>`;
    const num = (k, lab, o = {}) => row(k, lab, `<span class="uin"><input type="number" data-k="${k}" data-ty="n" value="${+(+uiGet(it, k) || 0).toFixed(2)}" step="${o.step || 1}"${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''}${o.ph ? ` placeholder="${o.ph}"` : ''}><i>${o.u || ''}</i></span>`);
    const nums = (lab, list) => row('', lab, list.map(([k, u, o = {}]) => `<span class="uin sm" title="${o.t || ''}"><input type="number" data-k="${k}" data-ty="n" value="${+(+uiGet(it, k) || 0).toFixed(2)}" step="${o.step || 1}"${o.min != null ? ` min="${o.min}"` : ''}><i>${u}</i></span>`).join(''), 'multi');
    const sel = (k, lab, opts) => row(k, lab, `<select data-k="${k}" data-ty="${typeof opts[0][0] === 'number' ? 'n' : 's'}">${opts.map(([v, l]) => `<option value="${v}"${String(uiGet(it, k)) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`);
    const seg = (k, lab, opts) => row(k, lab, `<div class="useg" data-k="${k}">${opts.map(([v, l, t]) => `<button data-v="${v}" aria-pressed="${String(uiGet(it, k)) === String(v)}"${t ? ` title="${esc(t)}"` : ''}>${l}</button>`).join('')}</div>`);
    const tog = (k, lab) => row(k, lab, `<button class="utog" data-tog="${k}" aria-pressed="${!!+uiGet(it, k)}"><b></b></button>`);
    const colCtl = k => { const v = ukHex(uiGet(it, k)); return `<span class="ucol" data-k="${k}"><span class="usw" style="--c:${ukCss(v)}"><input type="color" data-cp value="${ukRgb(v)}"></span><input class="uhex" data-hx value="${v}" spellcheck="false" maxlength="9"><span class="uin al"><input type="number" data-al min="0" max="100" value="${Math.round(ukAlpha(v) * 100)}"><i>%</i></span></span>`; };
    const col = (k, lab) => row(k, lab, colCtl(k));
    const quad = (k, lab, names) => { const v = uiGet(it, k) || [0, 0, 0, 0], lk = uiInsp.link[k] !== false; return row(k, lab, `<span class="uquad${lk ? ' lk' : ''}">${names.map((n, i) => `<span class="uin sm" title="${n}"><input type="number" data-k="${k}" data-i="${i}" data-ty="n" value="${+v[i] || 0}" min="0"><i>${n[0]}</i></span>`).join('')}<button class="ulink" data-link="${k}" aria-pressed="${lk}" title="Lier les quatre valeurs">${icon('link', 'sm')}</button></span>`); };
    const txt = (k, lab, multi) => row(k, lab, multi ? `<textarea data-k="${k}" data-ty="s" rows="${Math.min(6, String(uiGet(it, k) || '').split('\n').length + 1)}" spellcheck="false">${esc(uiGet(it, k) || '')}</textarea>` : `<input data-k="${k}" data-ty="s" value="${esc(uiGet(it, k) || '')}" spellcheck="false">`);
    const sec = (id, title, body, extra = '') => `<section class="usec${open(id) ? ' open' : ''}"><h4 data-sec="${id}">${icon('chevd', 'sm')}<span>${title}</span>${extra ? `<span class="uhb">${extra}</span>` : ''}</h4><div class="usb">${body}</div></section>`;
    const font = k => row(k, 'Police', `<select data-k="${k}" data-ty="s">${(UI_FONTS.includes(uiGet(it, k)) ? UI_FONTS : [uiGet(it, k)].concat(UI_FONTS)).map(f => `<option value="${esc(f)}" style="font-family:${esc(ukFont(f))}"${uiGet(it, k) === f ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select>`);
    const typo = (p, extra = '') => sec('typo', 'Typographie', font(p + '.ff')
      + row('', 'Taille · graisse', `<span class="uin sm"><input type="number" data-k="${p}.fs" data-ty="n" value="${+uiGet(it, p + '.fs') || 0}" min="4" step="1"><i>px</i></span><select data-k="${p}.fw" data-ty="n">${UI_W8.map(([v, l]) => `<option value="${v}"${+uiGet(it, p + '.fw') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`, 'multi')
      + nums('Interlettrage · interligne', [[p + '.ls', 'px', { step: .1 }], [p + '.lh', '×', { step: .05, min: .5 }]])
      + seg(p + '.tt', 'Casse', [['none', 'Aa', 'Comme écrit'], ['uppercase', 'AA', 'Majuscules'], ['lowercase', 'aa', 'Minuscules'], ['capitalize', 'Ab Cd', 'Initiales']])
      + seg(p + '.td', 'Décoration', [['none', '—', 'Aucune'], ['underline', '<u>S</u>', 'Souligné'], ['line-through', '<s>S</s>', 'Barré']])
      + tog(p + '.fi', 'Italique')
      + seg(p + '.ta', 'Alignement', [['left', '⇤', 'Gauche'], ['center', '↔', 'Centre'], ['right', '⇥', 'Droite']]) + extra
      + col(p + '.fg', 'Couleur'));
    /* the structure: the window or box this block belongs to, as a tree */
    const root = uiRoot(it), tree = [];
    const walk = (n, d) => { tree.push([n, d]); for (const k of uiKids(n.id)) walk(k, d + 1); };
    if (root) walk(root, 0);
    const LB = { none: '', h: '▤ ligne', v: '▥ colonne', grid: '▦ grille' };
    const treeHTML = sec('tree', 'Structure', `<div class="utree">${tree.map(([n, d]) => `<button data-tsel="${n.id}" aria-pressed="${n.id === it.id}" style="padding-left:${8 + d * 14}px"><i class="ut-${n.t}"></i><span>${esc(uiName(n))}</span>${n.t === 'box' ? `<small>${LB[ukBoxStyle(n).lay]}</small>` : ''}</button>`).join('')}</div>`);
    let h = '';
    if (it.t === 'button') {
      /* a paint: plain colour or gradient with stops, opacity, blend */
      const swatch = p => `<span class="uisw"><span style="${ukBgDecl([Object.assign({}, p, { on: 1, bm: 'normal' })])}"></span></span>`;
      const paintEd = (P, blend) => {
        const p = uiGet(it, P) || ukP('#000000'), g = p.t !== 'solid', S = p.s || [];
        let e = row('', 'Type', `<div class="useg pt">${UI_PAINTS.map(([v, l]) => `<button data-act="ptype" data-p="${P}" data-v="${v}" aria-pressed="${p.t === v}" title="${l}">${{ solid: 'Uni', lin: 'Lin.', rad: 'Rad.', ang: 'Ang.', dia: 'Los.' }[v]}</button>`).join('')}</div>`);
        if (!g) e += col(P + '.c', 'Couleur');
        else {
          e += `<div class="ugbar" data-act="stopat" data-p="${P}" title="Cliquer pour ajouter un arrêt"><span style="background:linear-gradient(90deg, ${ukStops(p, 1)})"></span>${S.map(([q, c]) => `<i style="left:${clamp(+q || 0, 0, 100)}%;--c:${ukCss(c)}"></i>`).join('')}</div>`;
          e += S.map(([q], j) => `<div class="uif ustop"><span class="uin"><input type="number" data-k="${P}.s.${j}.0" data-ty="n" value="${+(+q || 0).toFixed(1)}" min="0" max="100"><i>%</i></span><div class="uic2">${colCtl(`${P}.s.${j}.1`)}</div><button class="urm" data-act="stopdel" data-p="${P}" data-j="${j}" title="Retirer cet arrêt"${S.length <= 2 ? ' disabled' : ''}>${icon('x', 'sm')}</button></div>`).join('');
          e += `<div class="uacts"><button data-act="stopadd" data-p="${P}">${icon('plus', 'sm')}Arrêt</button><button data-act="rev" data-p="${P}">⇄ Inverser</button></div>`;
          if (p.t === 'lin' || p.t === 'ang') e += num(P + '.a', 'Angle', { u: '°' });
          if (p.t === 'rad' || p.t === 'ang') e += nums('Centre X · Y', [[P + '.cx', '%'], [P + '.cy', '%']]);
          if (p.t === 'rad') e += num(P + '.sz', 'Taille', { u: '%', min: 1 });
        }
        e += num(P + '.op', 'Opacité', { u: '%', min: 0, max: 100 });
        if (blend) e += sel(P + '.bm', 'Fusion', UI_BLEND);
        return e;
      };
      const item = (P, list, j, name, on, sw, body) => `<div class="uitem${on ? '' : ' off'}"><div class="uith"><button class="ueye" data-act="eye" data-p="${P}" aria-pressed="${on}" title="${on ? 'Masquer' : 'Afficher'}">${icon(on ? 'eye' : 'eye-off', 'sm')}</button>${sw}<b>${name}</b><button data-act="mv" data-p="${list}" data-j="${j}" data-d="-1" title="Monter">${icon('up', 'sm')}</button><button data-act="mv" data-p="${list}" data-j="${j}" data-d="1" title="Descendre">${icon('down', 'sm')}</button><button data-act="del" data-p="${list}" data-j="${j}" title="Retirer">${icon('trash', 'sm')}</button></div><div class="uitb">${body}</div></div>`;
      h += `<div class="ustates" role="tablist">${UI_STATES.map(([v, l]) => `<button data-st="${v}" aria-pressed="${st === v}">${l}${v !== 'n' && it.bs && it.bs[v] && Object.keys(it.bs[v]).length ? '<b></b>' : ''}</button>`).join('')}</div>
        <p class="ustn">${st === 'n' ? 'Les réglages ci-dessous font le bouton au repos.' : `Ce qui est changé ici ne vaut que pour l’état <b>${UI_STATES.find(s => s[0] === st)[1]}</b> (● bleu ; ↺ revient à Normal). Le board montre cet état.`}</p>`;
      h += sec('content', 'Contenu', txt('txt', 'Texte') + row('b.ic', 'Icône', `<div class="uicons"><button data-ic="" aria-pressed="${!uiGet(it, 'b.ic')}" title="Aucune">—</button>${Object.keys(UI_ICONS).map(k => `<button data-ic="${k}" aria-pressed="${uiGet(it, 'b.ic') === k}" title="${k}">${ukIcon(k, 14)}</button>`).join('')}</div>`, 'tall')
        + seg('b.ip', 'Position', [['l', '◧ ', 'Icône à gauche'], ['r', ' ◨', 'Icône à droite'], ['t', '⬒', 'Icône au-dessus'], ['b', '⬓', 'Icône en dessous'], ['o', '●', 'Icône seule']])
        + nums('Taille · écart', [['b.isz', 'px', { min: 6 }], ['b.ig', 'px', { min: 0 }]]) + col('b.icc', 'Couleur icône') + `<p class="ustn">Couleur icône à 0 % : elle suit le texte.</p>` + tog('dis', 'Désactivé dans le test'));
      h += sec('layer', 'Calque', num('b.op', 'Opacité', { u: '%', min: 0, max: 100 }) + sel('b.bm', 'Fusion', UI_BLEND));
      h += sec('corners', 'Angles', quad('b.r', 'Rayons', ['Haut gauche', 'Haut droit', 'Bas droit', 'Bas gauche']) + num('b.sm', 'Lissage', { u: '%', min: 0, max: 100 }) + `<p class="ustn">Lissage : des angles continus façon iOS (squircle).</p>`);
      h += sec('pad', 'Marges internes', nums('Horiz. · vert.', [['b.px', 'px', { min: 0 }], ['b.py', 'px', { min: 0 }]]));
      h += sec('typo', 'Typographie', font('b.ff')
        + row('', 'Taille · graisse', `<span class="uin sm"><input type="number" data-k="b.fs" data-ty="n" value="${+uiGet(it, 'b.fs') || 0}" min="4" step="1"><i>px</i></span><select data-k="b.fw" data-ty="n">${UI_W8.map(([v, l]) => `<option value="${v}"${+uiGet(it, 'b.fw') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`, 'multi')
        + nums('Interligne · lettres', [['b.lh', '%', { min: 50, t: 'Interligne en % de la taille' }], ['b.ls', '%', { step: .5, t: 'Interlettrage en % de la taille' }]])
        + seg('b.ta', 'Alignement', [['left', '⇤', 'Gauche'], ['center', '↔', 'Centre'], ['right', '⇥', 'Droite']])
        + seg('b.tt', 'Casse', [['none', 'Aa', 'Comme écrit'], ['uppercase', 'AA', 'Majuscules'], ['lowercase', 'aa', 'Minuscules'], ['capitalize', 'Ab Cd', 'Initiales']])
        + seg('b.td', 'Décoration', [['none', '—', 'Aucune'], ['underline', '<u>S</u>', 'Souligné'], ['line-through', '<s>S</s>', 'Barré'], ['overline', '<span style="text-decoration:overline">S</span>', 'Surligné']])
        + tog('b.fi', 'Italique') + tog('b.smc', 'Petites capitales') + tog('b.tabs', 'Chiffres tabulaires') + tog('b.lig', 'Ligatures') + tog('b.trunc', 'Tronquer (…)')
        + `<div class="usub">Remplissage du texte ${rst('b.tp')}</div>` + paintEd('b.tp', false)
        + `<div class="usub">Contour du texte</div>` + num('b.tsw', 'Épaisseur', { u: 'px', min: 0, step: .25 }) + col('b.tsc', 'Couleur'));
      const fills = uiGet(it, 'b.fills') || [];
      h += sec('fill', 'Remplissage', (fills.length ? fills.map((p, j) => item('b.fills.' + j, 'b.fills', j, UI_PAINTS.find(x => x[0] === p.t)?.[1] || 'Uni', !!+ukN(p.on, 1), swatch(p), paintEd('b.fills.' + j, true))).join('') : '<p class="ustn">Aucun remplissage : le fond est transparent.</p>')
        + (fills.length > 1 ? `<p class="ustn">Le premier de la liste est au-dessus.</p>` : ''), rst('b.fills') + `<button data-act="add" data-p="b.fills" title="Ajouter un remplissage">${icon('plus', 'sm')}</button>`);
      const k = uiGet(it, 'b.stroke') || {};
      h += sec('stroke', 'Contour', tog('b.stroke.on', 'Afficher') + (+k.on ? paintEd('b.stroke.p', false)
        + seg('b.stroke.pos', 'Position', [['in', 'Intérieur'], ['center', 'Centre'], ['out', 'Extérieur']])
        + quad('b.stroke.w', 'Épaisseurs', ['Haut', 'Droite', 'Bas', 'Gauche'])
        + seg('b.stroke.st', 'Trait', [['solid', 'Plein'], ['dashed', 'Tirets'], ['dotted', 'Points']])
        + (k.st === 'dashed' ? nums('Tiret · écart', [['b.stroke.da', 'px', { min: .5, step: .5 }], ['b.stroke.ga', 'px', { min: .5, step: .5 }]]) + seg('b.stroke.cap', 'Extrémités', [['butt', 'Nettes'], ['round', 'Rondes'], ['square', 'Carrées']]) : '')
        + (k.st === 'dotted' ? num('b.stroke.ga', 'Écart', { u: 'px', min: .5, step: .5 }) : '') : ''), rst('b.stroke'));
      const fxs = uiGet(it, 'b.fx') || [];
      const fxBody = (e, j) => {
        const P = 'b.fx.' + j + '.';
        if (e.t === 'drop' || e.t === 'inner') return nums('X · Y', [[P + 'x', 'px'], [P + 'y', 'px']]) + nums('Flou · étendue', [[P + 'b', 'px', { min: 0 }], [P + 's', 'px']]) + col(P + 'c', 'Couleur');
        if (e.t === 'glow') return nums('Flou · étendue', [[P + 'b', 'px', { min: 0 }], [P + 's', 'px']]) + col(P + 'c', 'Couleur');
        if (e.t === 'ring') return nums('Épaisseur · halo', [[P + 's', 'px', { min: 0, step: .5 }], [P + 'b', 'px', { min: 0 }]]) + col(P + 'c', 'Couleur');
        if (e.t === 'bevel') return nums('Profondeur · flou', [[P + 'd', 'px', { step: .5 }], [P + 'b', 'px', { min: 0 }]]) + num(P + 'a', 'Lumière', { u: '°' }) + col(P + 'c', 'Reflet') + col(P + 'c2', 'Ombre');
        if (e.t === 'tshadow') return nums('X · Y · flou', [[P + 'x', 'px'], [P + 'y', 'px'], [P + 'b', 'px', { min: 0 }]]) + col(P + 'c', 'Couleur');
        if (e.t === 'shine') return col(P + 'c', 'Couleur') + nums('Largeur · angle', [[P + 'w', '%', { min: 1 }], [P + 'a', '°']]) + num(P + 'p', 'Position', { u: '%' }) + tog(P + 'anim', 'Balayage au survol');
        if (e.t === 'noise') return nums('Intensité · finesse', [[P + 'op', '%', { min: 0, max: 100 }], [P + 'f', '', { min: 5, max: 100 }]]) + sel(P + 'bm', 'Fusion', UI_BLEND);
        return num(P + 'b', 'Flou', { u: 'px', min: 0 });
      };
      h += sec('fx', 'Effets', (fxs.length ? fxs.map((e, j) => item('b.fx.' + j, 'b.fx', j, UI_FX[e.t] || e.t, !!+ukN(e.on, 1), '', fxBody(e, j))).join('') : '<p class="ustn">Aucun effet.</p>')
        + `<select class="uaddfx" data-addfx="1"><option value="">Ajouter un effet…</option>${Object.entries(UI_FX).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`, rst('b.fx'));
      h += sec('inter', 'Interaction', nums('Décalage Y · échelle', [['b.dy', 'px', { step: .5 }], ['b.sc', '%', { min: 10 }]]) + num('b.tr', 'Transition', { u: 'ms', min: 0, step: 10 }));
    }
    if (it.t === 'text') {
      h += sec('content', 'Contenu', txt('txt', 'Texte', true) + seg('f.wr', 'Retour', [['wrap', 'À la ligne'], ['elide', 'Couper…'], ['none', 'Aucun']]));
      h += typo('f', seg('f.va', 'Vertical', [['top', 'Haut'], ['center', 'Milieu'], ['bottom', 'Bas']]));
    }
    if (it.t === 'box') {
      const c = ukBoxStyle(it);
      h += sec('lay', 'Layout', seg('c.lay', 'Type', UI_LAYS.map(([v, l, t]) => [v, l, t])) + (c.lay !== 'none' ? quad('c.m', 'Marges', ['Gauche', 'Haut', 'Droite', 'Bas'])
        + (c.lay === 'grid' ? nums('Espacement H · V', [['c.sp', 'px', { min: 0 }], ['c.sv', 'px', { min: 0 }]]) + num('c.cols', 'Colonnes', { min: 1, max: 24 }) + txt('c.cst', 'Étirement colonnes') : num('c.sp', 'Espacement', { u: 'px', min: 0 }))
        + seg('c.ca', 'Place libre', [['start', 'Début'], ['center', 'Centre'], ['end', 'Fin'], ['between', 'Répartir']]) : ''));
      h += sec('look', 'Conteneur', seg('c.sk', 'Style', UI_SKINS) + (['window', 'dialog', 'group', 'panel'].includes(c.sk) ? txt('c.title', 'Titre') : '') + col('c.bg', 'Fond') + nums('Bordure · rayon', [['c.bw', 'px', { min: 0, step: .5 }], ['c.r', 'px', { min: 0 }]]) + col('c.bc', 'Couleur bordure')
        + (['window', 'dialog'].includes(c.sk) ? col('c.tb', 'Barre de titre') : '') + (['window', 'dialog', 'group'].includes(c.sk) ? col('c.tf', 'Couleur du titre') : '') + tog('c.sh', 'Ombre'));
    }
    /* how the block sits in its parent's layout (Qt: sizePolicy, minimumSize, maximumSize, stretch, alignment) */
    if (uiLaidOut(it)) {
      const L = uiLayOf(it.p), pol = UI_POL.map(([v, l, t]) => [v, l, t]), auto = ukLeafHint(it, uiDir(it));
      h += sec('pos', 'Disposition dans le layout', sel('lp.ph', 'Politique H', pol) + sel('lp.pv', 'Politique V', pol)
        + nums('Taille préférée', [['hw', 'L', { min: 0, t: '0 = d’après le contenu' }], ['hh', 'H', { min: 0, t: '0 = d’après le contenu' }]])
        + nums('Minimum', [['lp.mnw', 'L', { min: 0 }], ['lp.mnh', 'H', { min: 0 }]]) + nums('Maximum', [['lp.mxw', 'L', { min: 0, t: '0 = pas de maximum' }], ['lp.mxh', 'H', { min: 0, t: '0 = pas de maximum' }]])
        + nums('Étirement H · V', [['lp.sth', '', { min: 0 }], ['lp.stv', '', { min: 0 }]])
        + seg('lp.ah', 'Aligner H', [['auto', 'Auto', 'Remplit la case si sa politique le permet'], ['start', '⇤'], ['center', '↔'], ['end', '⇥']]) + seg('lp.av', 'Aligner V', [['auto', 'Auto'], ['start', '⤒'], ['center', '↕'], ['end', '⤓']])
        + (L === 'grid' ? nums('Cases occupées', [['lp.cs', 'col', { min: 1 }], ['lp.rs', 'rg', { min: 1 }]]) : '')
        + `<div class="uord"><button data-ord="-1">${icon(L === 'v' ? 'up' : 'chev', 'sm')}Avant</button><button data-ord="1">Après${icon(L === 'v' ? 'down' : 'chev', 'sm')}</button><button data-out="1" title="Sortir du layout">Sortir</button></div>`
        + `<p class="ustn">Taille calculée : ${Math.round(it.w)} × ${Math.round(it.h)} px${it.t !== 'box' ? ` · d’après le contenu ${auto.w} × ${auto.h}` : ''}</p>`);
    } else h += sec('geo', 'Position et taille', nums('X · Y', [['x', 'px'], ['y', 'px']]) + nums('L · H', [['w', 'px', { min: 4 }], ['h', 'px', { min: 4 }]]) + (it.p ? `<div class="uord"><button data-out="1">Sortir du conteneur</button></div>` : ''));
    return `<div class="uih"><i class="ut-${it.t}"></i><b>${UI_TYPES[it.t] || 'Bloc'}</b><small>${esc(uiName(it))}</small><button data-uix="1" title="Fermer l’inspecteur" aria-label="Fermer">${icon('x', 'sm')}</button></div><div class="uib">${treeHTML}${h}</div>`;
  }
  function uiInspSync(force) {
    const one = sel.size === 1 ? byId.get([...sel][0]) : null, show = one && one.k === 'uic' && mounted && UI_TYPES[one.t] && !(uiInsp && uiInsp.hide === one.id) && !(op && op.kind === 'move');
    if (!show) { if (uiInsp && uiInsp.el) { uiInsp.el.remove(); uiInsp.el = null; } if (uiInsp && one && uiInsp.hide !== (one && one.id)) uiInsp.hide = null; return; }
    if (!uiInsp) uiInsp = { st: 'n', link: {}, el: null, sig: '' };
    if (!uiInsp.el) { const el = document.createElement('aside'); el.className = 'uiinsp'; el.setAttribute('aria-label', 'Inspecteur'); wrap.append(el); uiInsp.el = el; uiInsp.sig = ''; uiInspBind(el); }
    if (uiInsp.id !== one.id) { uiInsp.id = one.id; uiInsp.st = one.t === 'button' ? one.pv || 'n' : 'n'; }
    uiInsp.el.classList.toggle('withprops', propsOpen());
    const par = one.p && byId.get(one.p), sig = [one.id, uiInsp.st, JSON.stringify(one), par ? JSON.stringify(par.c) : '', uiKids((uiRoot(one) || one).id).length, JSON.stringify(uiInsp.link), JSON.stringify(S.prefs.uiSec || {})].join('|');
    if (!force && sig === uiInsp.sig) return;
    if (!force && uiInsp.el.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')) { uiInsp.dirty = true; return; }
    uiInsp.sig = sig; uiInsp.dirty = false;
    const b0 = $('.uib', uiInsp.el), top = b0 ? b0.scrollTop : 0;
    uiInsp.el.innerHTML = uiInspHTML(one);
    const b1 = $('.uib', uiInsp.el); if (b1) b1.scrollTop = top;
  }
  function uiInspBind(el) {
    const cur = () => byId.get(uiInsp.id);
    const live = (patch) => { const it = cur(); if (!it) return; if (!uiInsp.before) uiInsp.before = items; setLive(replace(items, it, patch)); };
    const done = () => { if (uiInsp.before) { const b = uiInsp.before; uiInsp.before = null; commit(items, { before: b }); } };
    const now = (patch, o) => { const it = cur(); if (!it) return; commit(replace(items, it, patch), o); };
    const valOf = (inp) => {
      const k = inp.dataset.k, it = cur(); let v = inp.dataset.ty === 'n' ? (inp.value === '' ? 0 : parseFloat(inp.value)) : inp.value; if (inp.dataset.ty === 'n' && !isFinite(v)) v = 0;
      if (inp.dataset.i != null) { const arr = (uiGet(it, k) || [0, 0, 0, 0]).slice(); if (uiInsp.link[k] !== false) arr.fill(v); else arr[+inp.dataset.i] = v; v = arr; }
      return v;
    };
    const colOf = (inp) => { const w = inp.closest('.ucol'), it = cur(), old = ukHex(uiGet(it, w.dataset.k)); if (inp.matches('[data-cp]')) return ukMix(inp.value, ukAlpha(old)); if (inp.matches('[data-al]')) return ukMix(ukRgb(old), (+inp.value || 0) / 100); const t = inp.value.trim(); return /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t) ? ukHex(t[0] === '#' ? t : '#' + t) : null; };
    const apply = (inp) => {
      const it = cur(); if (!it) return;
      const cw = inp.closest('.ucol'); if (cw) { const v = colOf(inp); if (v) { live(uiPatch(it, cw.dataset.k, v)); const sw = $('.usw', cw); if (sw) sw.style.setProperty('--c', ukCss(v)); } return; }
      const k = inp.dataset.k; if (!k) return;
      if (['x', 'y', 'w', 'h'].includes(k)) { const v = valOf(inp), d = { [k]: k === 'w' || k === 'h' ? Math.max(4, v) : v }; if (it.t === 'box' && (k === 'x' || k === 'y')) { const dd = v - it[k], ds = uiDesc(items, it.id); if (!uiInsp.before) uiInsp.before = items; setLive(items.map(i => i.id === it.id ? Object.assign({}, i, d) : ds.has(i.id) ? Object.assign({}, i, { [k]: i[k] + dd }) : i)); return; } live(d); return; }
      live(uiPatch(it, k, valOf(inp)));
    };
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.matches('input')) { e.target.blur(); } if (e.key === 'Escape') { e.target.blur && e.target.blur(); host.focus({ preventScroll: true }); } });
    el.addEventListener('input', e => apply(e.target));
    el.addEventListener('change', e => {
      const af = e.target.closest('[data-addfx]'); if (af) { const it = cur(), v = af.value; af.value = ''; if (it && v) { const L = ukClone(uiGet(it, 'b.fx') || []); L.unshift(ukFx(v)); now(uiPatch(it, 'b.fx', L)); } return; }
      done();
    });
    /* the lists (fills, effects) and the gradient stops */
    const lerp = (a, b, f) => { const A = ukHex(a), B = ukHex(b), ch = i => Math.round(parseInt(A.slice(i, i + 2), 16) * (1 - f) + parseInt(B.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0'); return ('#' + ch(1) + ch(3) + ch(5) + ch(7)).toUpperCase(); };
    const colorAt = (p, q) => { const S = ukSorted(p); if (q <= S[0][0]) return S[0][1]; for (let i = 1; i < S.length; i++) if (q <= S[i][0]) return lerp(S[i - 1][1], S[i][1], (q - S[i - 1][0]) / Math.max(1e-6, S[i][0] - S[i - 1][0])); return S[S.length - 1][1]; };
    function uiAct(it, b, e) {
      const P = b.dataset.p, j = +b.dataset.j, a = b.dataset.act, v = ukClone(uiGet(it, P)), set = nv => now(uiPatch(it, P, nv));
      if (a === 'ptype') { const to = b.dataset.v; if (v.t === to) return; if (to === 'solid') v.c = ukSorted(v)[0][1]; else if (v.t === 'solid') v.s = [[0, ukHex(v.c)], [100, ukMix(ukRgb(v.c), 0)]]; v.t = to; return set(v); }
      if (a === 'stopat' || a === 'stopadd') {
        let q; if (a === 'stopat') { const r = b.getBoundingClientRect(); q = Math.round(clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1) * 100); }
        else { const S = ukSorted(v); let best = 0; q = 50; for (let i = 1; i < S.length; i++) if (S[i][0] - S[i - 1][0] > best) { best = S[i][0] - S[i - 1][0]; q = Math.round((S[i][0] + S[i - 1][0]) / 2); } }
        v.s = ukSorted(v).concat([[q, colorAt(v, q)]]).sort((x, y) => x[0] - y[0]); return set(v);
      }
      if (a === 'stopdel') { if ((v.s || []).length <= 2) return; v.s.splice(j, 1); return set(v); }
      if (a === 'rev') { v.s = (v.s || []).map(([q, c]) => [100 - q, c]).sort((x, y) => x[0] - y[0]); return set(v); }
      if (a === 'eye') { v.on = +ukN(v.on, 1) ? 0 : 1; return set(v); }
      if (a === 'add') { v.unshift(ukP('#D9D9D9FF')); return set(v); }
      if (a === 'del') { v.splice(j, 1); return set(v); }
      if (a === 'mv') { const k = j + +b.dataset.d; if (k < 0 || k >= v.length) return; [v[j], v[k]] = [v[k], v[j]]; return set(v); }
    }
    el.addEventListener('focusout', () => setTimeout(() => { if (uiInsp && uiInsp.dirty && uiInsp.el && !uiInsp.el.contains(document.activeElement)) uiInspSync(true); }, 0));
    el.addEventListener('click', e => {
      const t = e.target, it = cur(); if (!it) return;
      if (t.closest('[data-uix]')) { uiInsp.hide = it.id; uiInspSync(); return; }
      const ac = t.closest('[data-act]'); if (ac) { e.stopPropagation(); if (!ac.disabled) uiAct(it, ac, e); return; }
      const s = t.closest('[data-sec]'); if (s) { const m = S.prefs.uiSec = S.prefs.uiSec || {}; m[s.dataset.sec] = !m[s.dataset.sec]; save(); uiInspSync(true); return; }
      const ts = t.closest('[data-tsel]'); if (ts) { sel = new Set([ts.dataset.tsel]); schedule(); return; }
      const sg = t.closest('.useg [data-v]'); if (sg) { const k = sg.closest('.useg').dataset.k, raw = sg.dataset.v, v = /^-?\d+(\.\d+)?$/.test(raw) && !k.endsWith('.lay') ? +raw : raw; if (k === 'c.lay') { uiSetLay(it, v); return; } now(uiPatch(it, k, v)); return; }
      const tg = t.closest('[data-tog]'); if (tg) { const k = tg.dataset.tog; now(uiPatch(it, k, +uiGet(it, k) ? 0 : 1)); return; }
      const lk = t.closest('[data-link]'); if (lk) { const k = lk.dataset.link; uiInsp.link[k] = uiInsp.link[k] === false; uiInspSync(true); return; }
      const ic = t.closest('[data-ic]'); if (ic) { now(uiPatch(it, 'b.ic', ic.dataset.ic)); return; }
      const st = t.closest('[data-st]'); if (st) { uiInsp.st = st.dataset.st; commit(replace(items, it, { pv: uiInsp.st === 'n' ? undefined : uiInsp.st }), { hist: false }); uiInspSync(true); return; }
      const rs = t.closest('[data-rst]'); if (rs) { const b = rs.dataset.rst.split('.')[1], bs = Object.assign({}, it.bs || {}), o = Object.assign({}, bs[uiInsp.st] || {}); delete o[b]; bs[uiInsp.st] = o; now({ bs }); return; }
      const od = t.closest('[data-ord]'); if (od) { const sib = uiKids(it.p), i = sib.indexOf(it), j = i + +od.dataset.ord; if (j < 0 || j >= sib.length) return; const om = new Map(sib.map((x, k) => [x.id, k])); om.set(it.id, j); om.set(sib[j].id, i); commit(items.map(x => om.has(x.id) ? Object.assign({}, x, { o: om.get(x.id) }) : x)); return; }
      if (t.closest('[data-out]')) { const pp = byId.get(it.p), gp = pp && pp.p; commit(uiApplyIns(items.map(x => x.id === it.id ? Object.assign({}, x, { x: x.x + 24, y: x.y + 24 }) : x), [it.id], gp ? { c: gp, idx: uiLayOf(gp) === 'none' ? null : uiKids(gp).indexOf(pp) + 1 } : null)); return; }
    });
    /* drag a label to change a number, like Qt's spin boxes */
    el.addEventListener('pointerdown', e => {
      const lab = e.target.closest('label[data-scrub]'); if (!lab || e.button !== 0) return;
      const inp = $('input[type=number]', lab.parentNode); if (!inp) return;
      e.preventDefault(); const x0 = e.clientX, v0 = parseFloat(inp.value) || 0, step = parseFloat(inp.step) || 1, pid = e.pointerId;
      const mv = ev => { if (ev.pointerId !== pid) return; let v = v0 + Math.round((ev.clientX - x0) / (ev.shiftKey ? 1 : 4)) * step * (ev.shiftKey ? 10 : 1); if (inp.min !== '') v = Math.max(+inp.min, v); if (inp.max !== '') v = Math.min(+inp.max, v); inp.value = +v.toFixed(2); apply(inp); };
      const up = ev => { if (ev.pointerId !== pid) return; removeEventListener('pointermove', mv); removeEventListener('pointerup', up); done(); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
  }
  function uiInspClose() { if (uiInsp && uiInsp.el) uiInsp.el.remove(); uiInsp = null; }
  /* double-click or Enter on a block: its text in the inspector */
  function uiFocusText(it) {
    if (uiInsp) uiInsp.hide = null;
    sel = new Set([it.id]); render(); uiInspSync(true);
    const f = uiInsp && uiInsp.el && $(it.t === 'box' ? '[data-k="c.title"]' : '[data-k="txt"]', uiInsp.el);
    if (f) { f.focus(); f.select && f.select(); } else if (it.t === 'spacer') toast('Un espaceur n’a pas de texte');
  }
  /* a laid-out block resized by hand: that size becomes its preferred size, fixed on the dragged axis */
  function uiResizeChild(e, h, it) {
    grab(e);
    const before = items, b0 = [it.x, it.y, it.x + it.w, it.y + it.h];
    op = { id: e.pointerId, kind: 'resize', moved: true,
      move(ev) {
        if (ev.pointerId !== this.id) return;
        const p = toW(ev.clientX, ev.clientY), o = byId.get(it.id) || it, n = {}, lp = Object.assign({}, o.lp || {});
        if (/[ew]/.test(h)) { n.hw = Math.max(4, Math.round(h.includes('e') ? p.x - b0[0] : b0[2] - p.x)); lp.ph = 'fix'; }
        if (/[ns]/.test(h)) { n.hh = Math.max(4, Math.round(h.includes('s') ? p.y - b0[1] : b0[3] - p.y)); lp.pv = 'fix'; }
        n.lp = lp; setLive(replace(items, o, n));
      },
      up() { op = null; commit(items, { before }); },
      cancel() { setLive(before); } };
  }
  /* ---------- test mode: the zone's windows and dialogs become screens, its arrows become clicks ---------- */
  function uiTest(z) {
    const screens = uiScreens(z, items);
    if (!screens.length) { toast('Posez une fenêtre ou un dialogue (bloc Conteneur) dans la zone pour la tester'); return; }
    sel.clear(); render();
    const ov = document.createElement('div'); ov.className = 'uitest hot'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Test de la zone');
    const nameOf = s => (ukBoxStyle(s).title || 'Écran').slice(0, 40);
    ov.innerHTML = `<div class="uth"><span class="tag">TEST</span><b>${esc(z.title)}</b><div class="chips">${screens.map((s, i) => `<button data-scr="${i}">${esc(nameOf(s))}</button>`).join('')}</div><span class="sp"></span><button class="ub on" data-hot="1">Zones cliquables</button><button class="ub q" data-quit="1">Quitter · Échap</button></div><div class="utb"></div><div class="utf">Survolez et cliquez les boutons · zone bleue : suit une flèche · ← → : écran précédent / suivant · Échap : fermer le dialogue ou quitter</div>`;
    document.body.append(ov);
    const body = $('.utb', ov), st = { base: null, top: null };
    const scrOf = id => { const it = byId.get(id); if (!it) return null; const r = it.k === 'uic' ? uiRoot(it) : it; return screens.includes(r) ? r : screens.find(q => inBox(it.x + it.w / 2, it.y + it.h / 2, boxOf(q))) || null; };
    const isDlg = s => ukBoxStyle(s).sk === 'dialog';
    function stage(S, k) {
      const ds = uiDesc(items, S.id), inS = items.filter(i => i === S || ds.has(i.id)), ids = new Set(inS.map(i => i.id));
      const d = document.createElement('div'); d.className = 'uts'; d.style.width = S.w + 'px'; d.style.height = S.h + 'px';
      for (const i of inS) { const n = nodes.get(i.id); if (!n) continue; const c = n.cloneNode(true); c.removeAttribute('data-id'); c.classList.remove('sel', 'drop', 'editing'); c.style.left = i.x - S.x + 'px'; c.style.top = i.y - S.y + 'px'; d.append(c); }
      for (const c of items) if (c.k === 'conn' && c.a.id && ids.has(c.a.id) && c.b.id) {
        const to = scrOf(c.b.id), src = byId.get(c.a.id); if (!to || to === S || !src) continue;
        const b = document.createElement('button'); b.className = 'uthot'; b.title = 'Aller à : ' + nameOf(to); b.setAttribute('aria-label', b.title);
        Object.assign(b.style, { left: src.x - S.x + 'px', top: src.y - S.y + 'px', width: src.w + 'px', height: src.h + 'px' });
        b.onclick = ev => { ev.stopPropagation(); go(to); }; d.append(b);
      }
      d.style.transform = `translate(${(-S.w * k / 2).toFixed(1)}px,${(-S.h * k / 2).toFixed(1)}px) scale(${k})`;
      return d;
    }
    function paintT() {
      body.innerHTML = '';
      const W = body.clientWidth - 60, H = body.clientHeight - 30, fit = S => Math.min(W / S.w, H / S.h, 1.6);
      const base = st.base || screens[0], kb = fit(base);
      const bd = stage(base, kb); bd.classList.add('base'); body.append(bd);
      if (st.top) { const s = document.createElement('div'); s.className = 'utscrim'; body.append(s); const td = stage(st.top, Math.min(kb, fit(st.top))); body.append(td);
        td.addEventListener('click', e => { if ((e.target.closest('[data-ukbtn]') || e.target.closest('.uk-dx')) && !e.target.closest('.uthot')) { st.top = null; paintT(); } }); }
      const cur = st.top || base; $$('[data-scr]', ov).forEach(b => b.setAttribute('aria-pressed', screens[+b.dataset.scr] === cur));
    }
    function go(S) { if (isDlg(S) && st.base && st.base !== S) st.top = S; else { st.base = S; st.top = null; } paintT(); }
    const key = e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); if (st.top) { st.top = null; paintT(); } else quit(); } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const cur = st.top || st.base || screens[0], i = screens.indexOf(cur), n = screens[(i + (e.key === 'ArrowRight' ? 1 : screens.length - 1)) % screens.length]; st.top = null; st.base = n; paintT(); } };
    function quit() { removeEventListener('keydown', key, true); removeEventListener('resize', paintT); ov.remove(); host.focus({ preventScroll: true }); }
    ov.addEventListener('click', e => {
      if (e.target.closest('[data-quit]')) quit();
      const h = e.target.closest('[data-hot]'); if (h) { const on = ov.classList.toggle('hot'); h.classList.toggle('on', on); }
      const c = e.target.closest('[data-scr]'); if (c) { st.top = null; st.base = screens[+c.dataset.scr]; paintT(); }
    });
    addEventListener('keydown', key, true); addEventListener('resize', paintT);
    st.base = screens.find(s => !isDlg(s)) || screens[0]; paintT();
  }
  /* ---------- planning from an iCal feed (0.2.26): PRONOTE's "iCal" link or a .ics file, rebuilt as a timeline ---------- */
  const PLAN_ERR = r => r.error === 'blocked' ? 'Le navigateur bloque ce lien. Ouvrez-le, enregistrez le fichier .ics puis choisissez-le avec « Fichier .ics ». Dans l’app Windows, le lien marche directement.'
    : r.error === 'url' ? 'Ce n’est pas un lien http(s) ou webcal.' : r.error === 'notics' ? 'Ce lien ne renvoie pas un calendrier iCal.' : r.status ? `Le serveur a répondu ${r.status}. Le lien a peut-être expiré : recopiez-le depuis PRONOTE.` : 'Impossible de lire ce lien.';
  async function planLoad(src) { const r = await Net.ics(src); if (!r.ok) return { err: PLAN_ERR(r) }; const p = icsParse(r.text); return p ? p : { err: 'Ce fichier n’est pas un calendrier iCal.' }; }
  function planModal(it) {
    const st = it ? { src: it.src || '', ev: it.ev, name: '', title: it.title, d0: it.d0, d1: it.d1, h0: it.h0, h1: it.h1, we: (it.we || [1, 2, 3, 4, 5]).slice(), ck: it.ck || 0, cols: Object.assign({}, it.cols), auto: !!it.auto }
      : { src: S.prefs.planSrc || '', ev: null, name: '', title: 'Planning', ck: 0, cols: {}, auto: true };
    const m = openModal(`<div class="mhd"><h2>${it ? 'Réglages du planning' : 'Planning depuis un calendrier'}</h2><button class="tb" data-close aria-label="Fermer">${icon('x')}</button></div>
      <p class="mt-sub">Collez le lien iCal de PRONOTE (Emploi du temps, bouton iCal) ou de tout agenda, ou choisissez un fichier .ics. Le planning se recrée sur le board en frise : un jour par colonne, un bloc par cours.</p>
      <div class="pl-src"><input class="pl-url" type="url" placeholder="https://…pronote…/ical/Edt_….ics" value="${esc(st.src)}" spellcheck="false"><button class="btn sm pri" data-load="1">Charger</button><label class="btn sm">${icon('upload', 'sm')} Fichier .ics<input type="file" accept=".ics,text/calendar" hidden></label></div>
      <div class="pl-st" role="status"></div>
      <div class="pl-opts" hidden></div>
      <div class="mt-foot"><button class="btn sm" data-sample="1"${it ? ' hidden' : ''}>Essayer avec un exemple</button><span class="mt-gap"></span><button class="btn sm pri" data-ok="1" disabled>${it ? 'Enregistrer' : 'Créer le planning'}</button></div>`);
    m.classList.add('plmodal');
    const url = $('.pl-url', m), stEl = $('.pl-st', m), opts = $('.pl-opts', m), okB = $('[data-ok]', m);
    const say = (t, bad) => { stEl.textContent = t; stEl.classList.toggle('bad', !!bad); };
    const fmtD = s => { const d = dOf(s); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
    const got = (p, src) => {
      st.ev = p.ev; st.src = src; if (st.ev.some(e => e[6]) && typeof st.ck !== 'string') { st.ck = 'p'; st.cols = {}; } if (p.name && (!it || st.title === 'Planning')) st.title = p.name;
      if (st.auto || !st.d0) Object.assign(st, planAuto(st.ev));
      const n = st.ev.filter(e => !(e[4] & 2)).length;
      say(n ? `${n} cours lus, du ${fmtD(st.ev[0][0])} au ${fmtD(st.ev[st.ev.length - 1][0])}.` : 'Aucun cours dans ce calendrier.', !n);
      paintOpts();
    };
    function paintOpts() {
      if (!st.ev) { opts.hidden = true; okB.disabled = true; return; }
      st.cols = planAssign(st);
      const sample = (st.ev.find(e => planParts(e[2]).length > 1) || st.ev[0] || [0, 0, ''])[2], parts = planParts(sample), keys = planKeys(st).slice(0, 40);
      const wd = (st.we || []).join('');
      opts.hidden = false; okB.disabled = !st.ev.length;
      opts.innerHTML = `<label class="pl-f wide"><span>Titre</span><input data-k="title" value="${esc(st.title)}"></label>
        <label class="pl-f"><span>Du</span><input type="date" data-k="d0" value="${st.d0}"></label><label class="pl-f"><span>Au</span><input type="date" data-k="d1" value="${st.d1}"></label>
        <label class="pl-f sm"><span>De</span><input type="number" min="0" max="23" data-k="h0" value="${st.h0}"></label><label class="pl-f sm"><span>À</span><input type="number" min="1" max="24" data-k="h1" value="${st.h1}"></label>
        <div class="pl-f"><span>Jours</span>${seg('we', wd === '12345' ? 'w5' : wd === '123456' ? 'w6' : wd === '1234560' ? 'w7' : '', [['w5', 'Lun–ven'], ['w6', '+ sam'], ['w7', '7 j']])}</div>
        <button class="btn sm pl-reset" data-auto="1" title="Reprendre la période, les heures et les jours du calendrier">Auto</button>
        ${typeof st.ck === 'string' ? `<div class="pl-f wide"><span>Couleur selon</span>${seg('ck', st.ck, [['p', 'Classe'], ['m', 'Matière'], ['y', 'Type de cours']])}</div>` : parts.length > 1 ? `<div class="pl-f wide"><span>Couleur selon</span>${seg('ck', st.ck, parts.slice(0, 4).map((t, i) => [i, esc(t.length > 18 ? t.slice(0, 17) + '…' : t), `Partie ${i + 1} du titre`]))}</div>` : ''}
        <div class="pl-keys">${keys.map(([k, n]) => `<button class="pl-key" data-key="${esc(k)}" style="--pc:${planColor(st, k)}" title="${n} cours · cliquer pour choisir la couleur"><i></i>${esc(k)}</button>`).join('')}</div>`;
    }
    opts.addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; st[k] = k === 'h0' || k === 'h1' ? clamp(Math.round(+e.target.value || 0), 0, 24) : e.target.value; if (k !== 'title') st.auto = false; if (st.h1 <= st.h0) st.h1 = st.h0 + 1; });
    opts.addEventListener('keydown', e => e.stopPropagation());
    opts.addEventListener('click', e => {
      const sv = e.target.closest('[data-set] [data-v]');
      if (sv) { const k = sv.closest('[data-set]').dataset.set; if (k === 'ck') { st.ck = /^\d+$/.test(sv.dataset.v) ? +sv.dataset.v : sv.dataset.v; st.cols = {}; } else { st.we = { w5: [1, 2, 3, 4, 5], w6: [1, 2, 3, 4, 5, 6], w7: [1, 2, 3, 4, 5, 6, 0] }[sv.dataset.v]; st.auto = false; } paintOpts(); return; }
      if (e.target.closest('[data-auto]')) { st.auto = true; Object.assign(st, planAuto(st.ev)); paintOpts(); return; }
      const kb = e.target.closest('[data-key]'); if (kb) { const k = kb.dataset.key, cur = planColor(st, k);
        const set = c => { st.cols[k] = c; kb.style.setProperty('--pc', c); };
        const pp = openPop(kb, `<div class="pl-cpop">${PLAN_COLORS.map(c => `<button data-pc="${c}" style="--c:${c}" aria-pressed="${c === cur}" aria-label="${c}"></button>`).join('')}<label><input type="color" value="${cur}"> Autre couleur…</label></div>`, { cls: 'pl-cp' });
        pp.addEventListener('click', ev => { const b = ev.target.closest('[data-pc]'); if (!b) return; set(b.dataset.pc); closePop(); });
        $('input[type=color]', pp).addEventListener('input', ev => set(ev.target.value)); }
    });
    const load = async () => { const src = url.value.trim(); if (!src) { url.focus(); return; } say('Lecture du calendrier…'); okB.disabled = true; const p = await planLoad(src); if (!m.isConnected) return; if (p.err) { say(p.err, true); okB.disabled = !st.ev; return; } S.prefs.planSrc = src; save(); got(p, src); };
    $('[data-load]', m).onclick = load;
    url.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') load(); });
    $('input[type=file]', m).onchange = async e => { const f = e.target.files[0]; if (!f) return; const p = icsParse(await f.text()); if (!p) { say('Ce fichier n’est pas un calendrier iCal.', true); return; } got(p, url.value.trim() && st.src === url.value.trim() ? st.src : ''); };
    $('[data-sample]', m).onclick = () => { st.title = 'Planning (exemple)'; got(icsParse(planSample()), ''); };
    okB.onclick = () => {
      if (!st.ev) return;
      const o = { title: st.title || 'Planning', src: st.src, ev: st.ev, d0: st.d0, d1: st.d1 < st.d0 ? st.d0 : st.d1, h0: st.h0, h1: st.h1, we: st.we, ck: st.ck, cols: st.cols, auto: st.auto || undefined, at: Date.now() };
      closeModal();
      if (it) { const cur = byId.get(it.id) || it, nx = planRefit(cur, Object.assign({}, cur, o, { v: (cur.v || 1) + 1 })); commit(items.map(x => x.id === it.id ? nx : x)); return; }
      const c = centerW(), p = mkPlan(0, 0, Object.assign(o, { fs: Math.round(14 * clamp(1 / view.k, .5, 4)) }));
      p.x = c.x - Math.min(p.w, 1600) / 2; p.y = c.y - p.h / 2;
      setTool('select'); commit(items.concat(p)); sel = new Set([p.id]); render();
      toast('Planning créé. Verrouillez-le (Ctrl Maj L) puis annotez dessus.', { label: 'Verrouiller', run: () => { sel = new Set([p.id]); action('lock'); } });
    };
    if (it && !it.ev.length && it.src) load();
    else if (it) paintOpts();
    setTimeout(() => { if (!it) url.focus(); }, 30);
  }
  /* quiet: the automatic update when the board opens (no undo step, no message unless something changed) */
  async function planRefresh(it, quiet) {
    if (!quiet) tapFlash('Mise à jour…');
    const doc = D, p = await planLoad(it.src); if (!mounted || D !== doc) return;
    if (p.err) { if (!quiet) toast(p.err); return; }
    const cur = byId.get(it.id); if (!cur) return;
    const same = JSON.stringify(p.ev) === JSON.stringify(cur.ev);
    const nx = Object.assign({}, cur, same ? {} : { ev: p.ev, v: (cur.v || 1) + 1 }, { at: Date.now() }, cur.auto && !same ? planAuto(p.ev) : {});
    nx.cols = planAssign(nx);
    const next = items.map(x => x.id === cur.id ? (same ? nx : planRefit(cur, nx)) : x);
    if (quiet) { silent(next); schedule(); } else commit(next);
    const n = p.ev.filter(e => !(e[4] & 2)).length;
    if (!quiet) toast(same ? `Planning à jour : ${n} cours, rien n’a changé` : `Planning mis à jour : ${n} cours`);
    else if (!same) toast(`${cur.title || 'Planning'} mis à jour depuis le lien iCal`);
  }
  /* a planning with a link updates itself when its board opens, at most once an hour */
  function planAutoRefresh() { for (const it of items) if (it.k === 'plan' && it.src && Date.now() - (it.at || 0) > 36e5) planRefresh(it, true); }
  /* darker or lighter, so what is written on top stands out; the slider shows it live, the change is one undo step */
  function planDim(it, btn) {
    const v = it.dim || 0;
    const p = openPop(btn, `<div class="pl-dimp"><div class="seg sm">${[[0, 'Normal'], [.4, 'Sombre'], [.65, 'Nuit']].map(([d, l]) => `<button data-d="${d}" aria-pressed="${Math.abs(v - d) < .01}">${l}</button>`).join('')}</div><input type="range" min="0" max="85" step="1" value="${Math.round(v * 100)}" aria-label="Assombrir"><b>${Math.round(v * 100)} %</b></div>`);
    const r = $('input', p), lab = $('b', p);
    const live = d => { const n = nodes.get(it.id); if (!n) return; let o = n.querySelector('.pl-dim'); if (!o) { o = document.createElement('div'); o.className = 'pl-dim'; n.append(o); } o.style.opacity = d; lab.textContent = Math.round(d * 100) + ' %'; };
    const set = d => { const cur = byId.get(it.id); if (!cur || Math.abs((cur.dim || 0) - d) < .001) return; commit(replace(items, cur, { dim: d || undefined })); };
    r.oninput = () => live(+r.value / 100); r.onchange = () => set(+r.value / 100);
    p.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b) return; const d = +b.dataset.d; r.value = Math.round(d * 100); live(d); set(d); $$('[data-d]', p).forEach(x => x.setAttribute('aria-pressed', x === b)); });
  }
  /* MultiText (0.2.25): one window, the formatting once at the top, as many text slots as wanted; validating places one
     text block per slot on the board, all with the same formatting, in a column, a row or a grid */
  function multiText() {
    const bd = BD(), cols = [1, 2, 3, 5, 6, 7, 9, 11, 12, 14].map(n => schemeHex(n));
    const f = { font: bd.font || HAND, fs: 1, bold: false, ital: false, al: 'left', color: bd.sc || schemeHex(1), lay: S.prefs.mtLay || 'col' };
    let slots = ['', '', ''];
    const m = openModal(`<div class="mhd"><h2>MultiText</h2><button class="tb" data-close aria-label="Fermer">${icon('x')}</button></div>
      <p class="mt-sub">Une mise en forme, plusieurs blocs de texte. Collez une liste : chaque ligne devient un bloc.</p>
      <div class="mt-bar">
        ${seg('font', f.font, [[HAND, '<span style="font-family:var(--font-hand);font-size:17px">Aa</span>', 'Manuscrite'], [SANS, '<span>Aa</span>', 'Normale'], [MONO, '<span style="font-family:var(--font-mono);font-size:12px">Aa</span>', 'Code']], 'ic')}
        ${seg('fs', f.fs, [[0, 'S'], [1, 'M'], [2, 'L'], [3, 'XL']])}
        <div class="seg sm" data-tog="1"><button data-t="bold" aria-pressed="false" title="Gras"><b>G</b></button><button data-t="ital" aria-pressed="false" title="Italique"><i>I</i></button></div>
        ${seg('al', f.al, [['left', icon('al-l'), 'À gauche'], ['center', icon('al-c'), 'Centré'], ['right', icon('al-r'), 'À droite']], 'ic')}
        <div class="mt-cols">${cols.map(c => `<button class="mt-c" data-col="${c}" style="--c:${c}" aria-pressed="${c === f.color}" title="${SCHEME_NAMES[schemeNo(c) - 1] || ''}"></button>`).join('')}</div>
      </div>
      <div class="mt-list"></div>
      <div class="mt-foot">
        <button class="btn sm" data-add="1">${icon('plus', 'sm')} Ajouter un bloc</button>
        <span class="mt-n"><button class="tb" data-n="-1" aria-label="Un bloc de moins">−</button><b></b><button class="tb" data-n="1" aria-label="Un bloc de plus">+</button></span>
        <span class="mt-gap"></span>
        ${seg('lay', f.lay, [['col', 'Colonne'], ['row', 'Ligne'], ['grid', 'Grille']])}
        <button class="btn sm pri" data-ok="1">Créer les blocs</button>
      </div>`);
    m.classList.add('mtext');
    const list = $('.mt-list', m), nEl = $('.mt-n b', m);
    const look = () => `font-family:${fontOf(f.font)};font-weight:${f.bold ? 700 : 500};font-style:${f.ital ? 'italic' : 'normal'};text-align:${f.al};color:${textColor(f.color, f.font === HAND)};font-size:${[15, 18, 23, 29][f.fs]}px`;
    const grow = t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
    const paint = focusAt => {
      list.innerHTML = slots.map((v, i) => `<div class="mt-row" style="--i:${i}"><span class="mt-i">${i + 1}</span><textarea rows="1" data-s="${i}" placeholder="Texte ${i + 1}" style="${look()}">${esc(v)}</textarea><button class="tb" data-del="${i}" aria-label="Retirer ce bloc">${icon('x', 'sm')}</button></div>`).join('');
      $$('textarea', list).forEach(grow); nEl.textContent = slots.length;
      if (focusAt != null) { const t = $(`[data-s="${focusAt}"]`, list); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
    };
    const restyle = () => $$('textarea', list).forEach(t => { t.style.cssText = look(); grow(t); });
    paint(0);
    list.addEventListener('input', e => { const t = e.target.closest('textarea'); if (!t) return; slots[+t.dataset.s] = t.value; grow(t); });
    list.addEventListener('paste', e => { const t = e.target.closest('textarea'), txt = e.clipboardData && e.clipboardData.getData('text/plain'); if (!t || !txt || !/\n/.test(txt.trim())) return; e.preventDefault(); const i = +t.dataset.s, lines = txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean); slots.splice(i, slots[i] ? 0 : 1, ...lines); paint(i + lines.length - 1); });
    list.addEventListener('keydown', e => { const t = e.target.closest('textarea'); if (!t) return; e.stopPropagation(); const i = +t.dataset.s;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (e.ctrlKey || e.metaKey) { ok(); return; } slots.splice(i + 1, 0, ''); paint(i + 1); }
      else if (e.key === 'Backspace' && !t.value && slots.length > 1) { e.preventDefault(); slots.splice(i, 1); paint(Math.max(0, i - 1)); } });
    m.addEventListener('click', e => {
      const sv = e.target.closest('[data-set] [data-v]');
      if (sv) { const box = sv.closest('[data-set]'), k = box.dataset.set; f[k] = k === 'fs' ? +sv.dataset.v : sv.dataset.v; box.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', b === sv)); if (k === 'lay') { S.prefs.mtLay = f.lay; save(); } else restyle(); return; }
      const tg = e.target.closest('[data-t]'); if (tg) { f[tg.dataset.t] = !f[tg.dataset.t]; tg.setAttribute('aria-pressed', f[tg.dataset.t]); restyle(); return; }
      const c = e.target.closest('[data-col]'); if (c) { f.color = c.dataset.col; $$('[data-col]', m).forEach(b => b.setAttribute('aria-pressed', b === c)); restyle(); return; }
      const d = e.target.closest('[data-del]'); if (d) { if (slots.length > 1) { slots.splice(+d.dataset.del, 1); paint(); } else { slots[0] = ''; paint(0); } return; }
      if (e.target.closest('[data-add]')) { slots.push(''); paint(slots.length - 1); return; }
      const n = e.target.closest('[data-n]'); if (n) { if (+n.dataset.n > 0) slots.push(''); else if (slots.length > 1) slots.pop(); paint(); return; }
      if (e.target.closest('[data-ok]')) ok();
    });
    function ok() {
      const fs = Math.round(FS_TABLE.text[f.fs] / clamp(view.k, .5, 2)), c = centerW(), filled = slots.map(s => s.trim()).filter(Boolean), texts = filled.length ? filled : slots.map(() => 'Texte');   // empty slots only count when all are empty (x10 blank blocks)
      const made = texts.map(t => Object.assign(mkText(0, 0, t, { fs, font: f.font, color: f.color, bold: f.bold, al: f.al }), f.ital ? { ital: true } : {}));
      // a first guess of their sizes, corrected once they are drawn and measured
      for (const it of made) { const ls = it.txt.split('\n'); it.w = Math.max(...ls.map(l => l.length)) * fs * .55 + 8; it.h = ls.length * fs * 1.12 + 4; }
      closeModal(); setTool('select');
      place(made, c); commit(items.concat(made)); sel = new Set(made.map(i => i.id)); render();
      requestAnimationFrame(() => requestAnimationFrame(() => { if (!mounted) return; const cur = made.map(i => byId.get(i.id)).filter(Boolean); if (!cur.length) return; const pos = new Map(place(cur.map(i => Object.assign({}, i)), c).map(i => [i.id, i])); silent(items.map(i => pos.has(i.id) ? Object.assign({}, i, { x: pos.get(i.id).x, y: pos.get(i.id).y }) : i)); schedule(); }));
      toast(made.length > 1 ? `${made.length} blocs de texte créés` : 'Bloc de texte créé');
    }
    /* column, row or grid around the centre of the view, with a gap that follows the text size */
    function place(list, c) {
      const fs = list[0].fs, G = Math.round(fs * .7), n = list.length, cols = f.lay === 'row' ? n : f.lay === 'col' ? 1 : Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols), cw = [], rh = [];
      list.forEach((it, i) => { const r = Math.floor(i / cols), k = i % cols; cw[k] = Math.max(cw[k] || 0, it.w); rh[r] = Math.max(rh[r] || 0, it.h); });
      const W = cw.reduce((a, b) => a + b, 0) + G * (cols - 1), H = rh.reduce((a, b) => a + b, 0) + G * (rows - 1);
      list.forEach((it, i) => { const r = Math.floor(i / cols), k = i % cols; it.x = Math.round(c.x - W / 2 + cw.slice(0, k).reduce((a, b) => a + b + G, 0)); it.y = Math.round(c.y - H / 2 + rh.slice(0, r).reduce((a, b) => a + b + G, 0)); });
      return list;
    }
  }
  function freeSpot(w, h) {
    const content = items.filter(i => i.k !== 'conn'), bb = unionBox(content);
    if (!bb) { const r = hostRect(), c = toW(r.left + r.width / 2, r.top + r.height / 2); return { x: c.x - w / 2, y: c.y - h / 2 }; }
    const r = hostRect(), c = toW(r.left + r.width / 2, r.top + r.height / 2), probe = [c.x - w / 2, c.y - h / 2, c.x + w / 2, c.y + h / 2];
    if (!content.some(i => boxHit(boxOf(i), probe))) return { x: probe[0], y: probe[1] };
    return { x: bb[2] + 140, y: bb[1] };
  }
  function insert(list, o = {}) {
    if (!list.length) return [];
    let bb = unionBox(list);
    if (o.at !== false) { const sp = o.at || freeSpot(bb[2] - bb[0], bb[3] - bb[1]); const dx = sp.x - bb[0], dy = sp.y - bb[1]; list = list.map(i => i.k === 'conn' ? i : Object.assign({}, i, { x: i.x + dx, y: i.y + dy })); }
    const frames = list.filter(i => i.k === 'frame'), rest = list.filter(i => i.k !== 'frame');
    commit(frames.concat(items, rest));
    sel = new Set(list.filter(i => !(i.k === 'mind' && i.parent) && i.k !== 'conn').map(i => i.id));
    render(); bb = unionBox(list.map(i => byId.get(i.id) || i));
    if (o.reveal !== false && bb) reveal(bb);
    return list.map(i => i.id);
  }
  function reveal(bb) { const r = hostRect(), a = toS(bb[0], bb[1]), b = toS(bb[2], bb[3]); if (a.x >= 20 && a.y >= 20 && b.x <= r.width - 20 && b.y <= r.height - 90) return; fitTo(bb, Math.min(1, view.k * uz())); }
  /* maxK is a true zoom (what the eye sees), whatever the size of the interface (Réglages > UI) */
  function fitTo(bb, maxK = 1.2) {
    /* the theme manifest's boardInset: room a theme's own side rail takes on the left of the board */
    const r = hostRect(), pad = r.width < 600 ? 18 : 70, left = r.width > 760 ? (THEMES[skin()] || {}).boardInset || 0 : 0, right = (propsOpen() && r.width > 900 ? 300 : 0) + left, W = Math.max(50, r.width - right - pad * 2), H = Math.max(50, r.height - pad * 2 - 60);
    const k = clamp(Math.min(W / Math.max(1, bb[2] - bb[0]), H / Math.max(1, bb[3] - bb[1]), maxK / uz()), MINK, MAXK);
    view.k = k; view.x = left + (r.width - right) / 2 - (bb[0] + bb[2]) / 2 * k; view.y = (r.height + 30) / 2 - (bb[1] + bb[3]) / 2 * k; viewChanged();
  }
  function fitAll() { view.r = 0; const bb = unionBox(items.filter(i => i.k !== 'conn' && !i.hid)); if (bb) fitTo(bb); else { view.x = hostRect().width / 2; view.y = hostRect().height / 2; view.k = 1 / uz(); viewChanged(); } }

  /* ---------- view ---------- */
  let viewT = 0;
  /* the interface size (Réglages > UI) zooms the whole page: the board divides its own zoom by it, so what is drawn keeps
     its size on screen. view.* stays in page px; the saved view and the % shown are in screen px (z: 1 marks it) */
  const uz = () => { const v = +S.prefs.uiScale; return [50, 75, 85, 110, 125].includes(v) ? v / 100 : 1; };
  let uzNow = 1;
  const viewOut = () => { const z = uz(); return { x: Math.round(view.x * z), y: Math.round(view.y * z), k: +(view.k * z).toFixed(4), r: +view.r.toFixed(2), z: 1 }; };
  function uiScaled() { const z = uz(), f = uzNow / z; if (!mounted || f === 1) { uzNow = z; return; } uzNow = z; view.k = clamp(view.k * f, MINK, MAXK); view.x *= f; view.y *= f; viewChanged(); }
  /* 0.3.4 (big boards, iPad): a move of the view only writes the two transforms; the rest (frame titles, paper dots,
     handles, zoom %) is done once per frame. --iz used to be set on the whole world: every item had its style recomputed
     at each finger move, which was most of the lag when turning a big board. While the view moves (.vmove: pan, pinch,
     turn, wheel) nothing inside the world is repainted. On the iPad (.gpu) the world and the stage are then compositor
     layers, so Safari moves and turns them without repainting the items, and paints them sharp again at rest
     (Chromium on the PC is faster without them). */
  let vRaf = 0, vLast = 0, vmT = 0, izS = '';
  function viewChanged() {
    drawn++;
    world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
    if (stage) stage.style.transform = view.r ? `rotate(${view.r}deg)` : '';
    const now = performance.now();
    if (viewGesture() || now - vLast < 260) { if (!host.classList.contains('vmove')) host.classList.add('vmove'); clearTimeout(vmT); vmT = setTimeout(vmEnd, 240); }
    vLast = now;
    if (!vRaf) vRaf = requestAnimationFrame(viewFrame);
    clearTimeout(viewT); viewT = setTimeout(() => { if (D) { D.view = viewOut(); save(); }
      // zoomed in past what textured strokes were rasterised for: draw them again, sharp (0.2.24, iPad)
      if (view.k > inkZoom * 1.15 || view.k < inkZoom / 2) { setInkZoom(view.k); let n = 0; for (const it of items) if (it.k === 'ink' && it.b) { const nd = nodes.get(it.id); if (nd) { nd._sig = ''; nd._it = null; n++; } } if (n) schedule(); }
    }, 300);
  }
  const modp = (a, m) => ((a % m) + m) % m;
  const viewGesture = () => !!(op && (op.kind === 'pinch' || op.kind === 'pan' || op.kind === 'rot'));
  function vmEnd() {
    if (!host) return; if (viewGesture()) { vmT = setTimeout(vmEnd, 240); return; }
    host.classList.remove('vmove'); if (!vRaf && mounted) vRaf = requestAnimationFrame(viewFrame);
  }
  function viewFrame() {
    vRaf = 0; if (!mounted) return;
    if (stage) wrap.classList.toggle('turned', !!view.r);
    const moving = host.classList.contains('vmove'), paper = bgrid && (view.r || host.classList.contains('gpu'));
    const iz = clamp(1 / view.k, 1, 6).toFixed(3); if (!moving && (iz !== izS || framesL._iz !== iz)) { izS = framesL._iz = iz; framesL.style.setProperty('--iz', iz); }
    let g = 24 * view.k; while (g < 12) g *= 4; while (g > 96) g /= 4;
    if (!paper) { host.style.backgroundSize = `${g}px ${g}px`; host.style.backgroundPosition = `${view.x}px ${view.y}px`; }
    // turned: the paper's dots turn with the stage, on a square layer that covers the board's diagonal; it follows the view
    // by a small transform (less than one dot step), so it is never repainted while the board pans or turns
    if (bgrid) { if (paper) {
      const r = hostRect(), key = (host.className.match(/\bbg-\S+/) || [''])[0] + '|' + document.documentElement.dataset.skin + '|' + theme();
      if (bgrid._bg !== key) { bgrid._bg = key; host.style.backgroundImage = ''; bgrid.style.backgroundImage = getComputedStyle(host).backgroundImage; }
      host.style.backgroundImage = 'none'; bgrid.hidden = false;
      // the layer is drawn with dots of g0 and scaled to g: while the view moves it is repainted only when the zoom has
      // changed by a third (the layer is large enough to still cover the board at 0.7 of its size)
      if (!bgrid._g || !moving || g / bgrid._g < .72 || g / bgrid._g > 1.4) { if (bgrid._g !== g) { bgrid._g = g; bgrid.style.backgroundSize = `${g}px ${g}px`; } }
      const sc = g / bgrid._g;
      const Sz = Math.ceil((Math.hypot(r.width, r.height) / 2 + 100) / .7), L = Math.round(r.width / 2 - Sz), T = Math.round(r.height / 2 - Sz), geo = L + '|' + T + '|' + Sz;
      if (bgrid._geo !== geo) { bgrid._geo = geo; Object.assign(bgrid.style, { left: L + 'px', top: T + 'px', width: 2 * Sz + 'px', height: 2 * Sz + 'px' }); }
      // scaled about its centre, the layer's corner (where its dots start) lands at L + Sz - Sz * sc
      bgrid.style.transform = `translate(${modp(view.x - (L + Sz - Sz * sc), g).toFixed(2)}px,${modp(view.y - (T + Sz - Sz * sc), g).toFixed(2)}px)` + (sc !== 1 ? ` scale(${sc.toFixed(4)})` : '');
    } else if (!bgrid.hidden) { bgrid.hidden = true; host.style.backgroundImage = ''; bgrid._bg = ''; } }
    renderOverlay();
  }
  function zoomAt(sx, sy, f) { if (view.r) { const r = hostRect(), p = unrot(sx + r.left, sy + r.top); sx = p.x; sy = p.y; } const k = clamp(view.k * f, MINK, MAXK); f = k / view.k; view.x = sx - (sx - view.x) * f; view.y = sy - (sy - view.y) * f; view.k = k; viewChanged(); }
  function zoomCenter(f) { const r = hostRect(); zoomAt(r.width / 2, r.height / 2, f); }
  function zoomTo(k) { k /= uz(); const r = hostRect(), c = toW(r.left + r.width / 2, r.top + r.height / 2); view.k = clamp(k, MINK, MAXK); view.x = r.width / 2 - c.x * view.k; view.y = r.height / 2 - c.y * view.k; viewChanged(); }

  /* ---------- pointer interactions ---------- */
  /* 0.2.51: drawings are not taken by a click or a marquee of the selection tool (only by the lasso); a stroke already selected still moves */
  function hitSel(e) {
    const h = hitAt(e), it = h && byId.get(h);
    if (!it || it.k !== 'ink' || sel.has(h)) return h;
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      const n = el.closest && el.closest('[data-id],[data-conn]'); if (!n || !world.contains(n)) continue;
      const o = byId.get(n.dataset.id || n.dataset.conn); if (o && o.k !== 'ink' && !o.hid) return o.id;
    }
    return null;
  }
  function hitAt(e) {
    const t = e.target;
    const itEl = t.closest('[data-id]');
    if (itEl && world.contains(itEl)) return itEl.dataset.id;
    const c = t.closest('[data-conn]'); if (c) return c.dataset.conn;
    return null;
  }
  function onDown(e) {
    closePop(); lastClient = { x: e.clientX, y: e.clientY };
    if (mm) { mmDown(e); return; }
    // Ctrl + left or middle drag with a brush: its size (Photoshop, Substance)
    if (rotMode && e.button === 0 && !op) { e.preventDefault(); startRotate(e); return; }
    if ((e.ctrlKey || e.metaKey) && (e.button === 0 || e.button === 1) && !op && !(e.shiftKey && e.button === 0 && PENS[tool]) && (PENS[tool] || tool === 'pick' || tool === 'eraser')) { e.preventDefault(); Studio.hideLoupe(); startSize(e); return; }
    if (e.button === 2 && !(op && op.keep) && e.pointerType !== 'touch') { e.preventDefault(); if (editing) finishEdit(); openMarking(e, hitAt(e)); return; }
    if (e.pointerType === 'touch' && !touches.size && !drawingTool()) holdFor(e);
    if (op && op.keep) { if (e.button === 0) { e.preventDefault(); op.click(e); } else if (e.button === 2) { e.preventDefault(); op.finish(); } return; }
    if (e.pointerType === 'touch') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() }); if (touches.size === 2) { cancelOp(); startPinch(); return; } if (touches.size > 2) return; }
    /* iPad: a finger double tap opens the text of what it lands on (the page gets no dblclick from a finger) */
    if (e.pointerType === 'touch' && touches.size === 1 && lastTap && performance.now() - lastTap.t < 340 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      lastTap = null; const h0 = hitAt(e), it0 = h0 && byId.get(h0);
      if ((it0 && EDITABLE.includes(it0.k) && !it0.lock) || (!h0 && tool === 'select')) { e.preventDefault(); if (editing) finishEdit(); if (tool !== 'select') setTool('select'); if (h0) sel = new Set([h0]); touchDblAt = performance.now(); onDbl(e, true); return; }
    }
    if (e.pointerType === 'pen') penSeen = true;
    const t = e.target;
    if (editing && editSub && editSub !== 'title' && e.button === 0) {   // typing a formula: a click on a cell puts its reference in
      const it = byId.get(editing), el = it && it.k === 'sheet' && editEl(it, editSub), ce = t.closest && t.closest('[data-cell]'), nd = it && nodes.get(it.id);
      if (el && ce && nd && nd.contains(ce) && ce !== el && ce.dataset.cell !== 'title' && fxCanRef(el)) { e.preventDefault(); fxPick(e, it, ce.dataset.cell); return; }
    }
    if (editing) { const it = byId.get(editing), el = it && editEl(it, editSub); if (el && el.contains(t)) return; finishEdit(); }
    if (document.activeElement && document.activeElement !== host && !host.contains(document.activeElement)) document.activeElement.blur();
    if (!editing) host.focus({ preventScroll: true });
    if (e.button === 1 || (e.button === 0 && (spaceDown || tool === 'hand'))) { e.preventDefault(); startPan(e); return; }
    if (e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32)) && (PENS[tool] || tool === 'eraser')) { e.preventDefault(); startErase(e); return; }
    if (e.button !== 0) return;
    if (t.closest('[data-unlock]')) { e.preventDefault(); e.stopPropagation(); action('unlock'); return; }
    const ma = t.closest('[data-madd]'); if (ma) { e.preventDefault(); e.stopPropagation(); mindAdd(ma.dataset.madd); return; }
    const hd = t.closest('.hdl');
    if (hd && hd.dataset.msc) { e.preventDefault(); startMindScale(e); return; }
    if (hd) { e.preventDefault(); if (hd.dataset.ep) startEndpoint(e, hd.dataset.ep); else if ((hd.dataset.pt != null || hd.dataset.add != null) && (e.ctrlKey || e.metaKey)) startBranch(e); else if (hd.dataset.pt != null) { if (e.altKey) removePoint(+hd.dataset.pt); else startPoint(e, +hd.dataset.pt); } else if (hd.dataset.add != null) startPoint(e, +hd.dataset.add, true); else if (hd.dataset.tidy) startTidy(e); else if (hd.dataset.rot) startRotate(e); else if (hd.dataset.rad) startRadius(e); else if (hd.dataset.cd) startConn(e, toW(e.clientX, e.clientY), [...sel][0], hd.dataset.cd); else startResize(e, hd.dataset.h); return; }
    const ab = t.closest('[data-arr]'); if (ab) { e.preventDefault(); e.stopPropagation(); setTimeout(() => arrangeMenu(ab, false)); return; }
    /* with a pencil around, a finger never draws: on an element it switches to the selection tool and takes it, elsewhere it pans */
    if (tool === 'lasso') { e.preventDefault(); const w0 = toW(e.clientX, e.clientY), inSel = !e.shiftKey && lassoInSel(w0);
      if (inSel) { startMove(e, w0, true, t); return; }
      if (e.pointerType === 'touch' && (penSeen || penSeenGlobal)) { startPan(e); return; }
      startLasso(e, e.shiftKey); return; }
    if (e.pointerType === 'touch' && (penSeen || penSeenGlobal) && !['select', 'hand', 'pick'].includes(tool)) { const h0 = hitSel(e); if (h0) setTool('select'); else if (PENS[tool] || tool === 'eraser') { startPan(e); return; } }
    // 0.2.48: a finger or the pencil: press, slide with the loupe above it, let go to take the colour
    if (tool === 'pick' && e.pointerType !== 'mouse') { e.preventDefault(); startTouchPick(e); return; }
    if (tool === 'pick' || (PENS[tool] && e.altKey && !e.shiftKey)) { e.preventDefault(); pickAt(e); return; }
    if (PENS[tool]) { e.preventDefault(); startInk(e); return; }
    if (tool === 'eraser') { e.preventDefault(); startErase(e, eraseAll); return; }
    const w = toW(e.clientX, e.clientY), hit = tool === 'select' ? hitSel(e) : hitAt(e);
    if (tool === 'select') {
      if (t.closest('a[href]') || t.closest('video,audio')) return;
      if (t.closest('[data-iopen]') && hit) { e.preventDefault(); openItem(byId.get(hit)); return; }
      const ck = t.closest('.ck > i'); if (ck && hit) { e.preventDefault(); toggleCheck(hit, +ck.parentElement.dataset.line); return; }
      const td = t.closest('[data-tdone]'); if (td && hit) { e.preventDefault(); const tk = taskById(byId.get(hit).task); if (tk) { setTaskDone(tk, !tk.done); } return; }
      const tck = t.closest('[data-tck]'); if (tck && hit) { e.preventDefault(); const tk = taskById(tck.dataset.tck); if (tk) setTaskDone(tk, !tk.done); return; }
      const scell = t.closest('[data-cell]'), sadd = t.closest('[data-sadd]'), sit = hit && byId.get(hit);
      if (sit && sit.k === 'sheet' && !e.ctrlKey && !e.metaKey) {
        const one = sel.has(hit) && sel.size === 1;
        if (!one) sheetSel = null;
        if (sadd && !e.shiftKey) { e.preventDefault(); sel = new Set([hit]); sheetResize(sit, sadd.dataset.sadd === 'row' ? { rows: sit.rows + 1 } : { cols: sit.cols + 1 }); return; }
        const cz = t.closest('[data-cz]'), rz = t.closest('[data-rz]');
        if (one && (cz || rz)) { e.preventDefault(); sheetSizeDrag(e, sit, cz ? 'col' : 'row', +(cz ? cz.dataset.cz : rz.dataset.rz)); return; }
        if (one && ((scell && scell.dataset.cell !== 'title') || t.closest('[data-col],[data-row],.shc'))) { e.preventDefault(); sheetPick(e, sit, t); return; }
      }
      const tadd = t.closest('[data-tadd]'); if (tadd && hit) { e.preventDefault(); const it = byId.get(hit); sel = new Set([hit]); todoAddRow(hit, it.tasks.length - 1); return; }
      const uzb = t.closest('[data-uz]'); if (uzb && hit) { e.preventDefault(); e.stopPropagation(); const z = byId.get(hit); sel = new Set([hit]); if (uzb.dataset.uz === 'lib') uiLibOpen(hit); else if (uzb.dataset.uz === 'test') uiTest(z); else uiSetFid(z, uzb.dataset.uz); schedule(); return; }
      if (hit && (byId.get(hit) || {}).lock && !e.shiftKey && !e.ctrlKey && !e.metaKey) { sel = new Set([hit]); schedule(); if (e.pointerType === 'touch') startPan(e); else startMarquee(e, w, false); return; }
      if (hit) {
        const was = sel.has(hit) && sel.size === 1;
        if (e.shiftKey && !e.ctrlKey && !e.metaKey) { startDupMove(e, w, hit); return; }
        if (e.ctrlKey || e.metaKey) { const gm = grpOf(hit); if (sel.has(hit)) gm.forEach(id => sel.delete(id)); else gm.forEach(id => sel.add(id)); schedule(); return; }
        if (e.altKey) sel = new Set([hit]);
        else if (!sel.has(hit)) sel = new Set(grpOf(hit));
        startMove(e, w, was, t); return;
      }
      if (!e.shiftKey) sel.clear();
      if (e.pointerType === 'touch') startPan(e, true); else startMarquee(e, w, e.shiftKey);
      schedule(); return;
    }
    e.preventDefault();
    if (tool === 'note' || tool === 'text' || tool === 'mind' || tool === 'todo' || tool === 'sheet') { createAt(tool, w); return; }
    if (tool === 'shape' || tool === 'frame' || tool === 'uiz') { startRect(e, w); return; }
    if (tool === 'conn' || tool === 'line') { startConn(e, w, hit); return; }
  }
  function grab(e) { try { host.setPointerCapture(e.pointerId); } catch (_) {} }
  /* ---------- 0.2.51: colour dabs — a swatch dropped on the board leaves paint; a click gives its codes and harmonies ---------- */
  function mkPaint(c, cx, cy) { const W = Math.round(110 / clamp(view.k, .25, 4)); return { id: uid('c'), k: 'paint', x: cx - W / 2, y: cy - W / 2, w: W, h: W, c, seed: 1 + Math.floor(Math.random() * 2e9) }; }
  function dropPaint(c, cx, cy) {
    c = Colors.valid(c); if (!c || !D) return; closePop();
    const w = toW(cx, cy), it = mkPaint(c, w.x, w.y);
    commit(items.concat(it)); if (!PENS[tool] && tool !== 'eraser') sel = new Set([it.id]); schedule();
  }
  const overBoard = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY); return !!(el && host.contains(el) && !el.closest('.pop')); };
  const PAINT_SRC = '.blb[data-c], .cppop .sw[data-c], .sws .sw[data-c], .hn[data-c], .pinfo [data-c]';
  let paintDragBound = false;
  function bindPaintDrag() {
    if (paintDragBound) return; paintDragBound = true;
    document.addEventListener('pointerdown', e => {
      if (!mounted || e.button !== 0) return;
      const sw = e.target.closest && e.target.closest(PAINT_SRC), c = sw && Colors.valid(sw.dataset.c || ''); if (!c) return;
      const x0 = e.clientX, y0 = e.clientY, id = e.pointerId; let gh = null;
      const mv = ev => { if (ev.pointerId !== id) return;
        if (!gh) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 12) return; gh = document.createElement('div'); gh.className = 'paint-ghost'; gh.style.setProperty('--c', c); document.body.append(gh); }
        gh.style.left = ev.clientX + 'px'; gh.style.top = ev.clientY + 'px'; gh.classList.toggle('over', overBoard(ev)); };
      const off = () => { removeEventListener('pointermove', mv, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); };
      const up = ev => { if (ev.pointerId !== id) return; off(); if (!gh) return; gh.remove();
        if (ev.type === 'pointerup' && overBoard(ev)) { dropPaint(c, ev.clientX, ev.clientY); const eat = k => { k.stopPropagation(); k.preventDefault(); }; addEventListener('click', eat, { capture: true, once: true }); setTimeout(() => removeEventListener('click', eat, true), 400); } };
      addEventListener('pointermove', mv, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
    }, true);
  }
  function paintInfo(it) {
    const n = nodes.get(it.id); if (!n) return;
    const c = it.c, [r, g, b] = hex2rgb(c), [h, s, v] = Colors.hex2hsv(c), L = v * (1 - s / 2), SL = L === 0 || L === 1 ? 0 : (v - L) / Math.min(L, 1 - L);
    const no = schemeNo(c), name = no ? SCHEME_NAMES[no - 1] : 'Couleur';
    const hx = (hh, ss = s, vv = v) => Colors.hsv2hex(((hh % 360) + 360) % 360, clamp(ss, 0, 1), clamp(vv, 0, 1));
    const rows = [['HEX', c], ['RGB', `${r}, ${g}, ${b}`], ['HSL', `${Math.round(h)}°, ${Math.round(SL * 100)} %, ${Math.round(L * 100)} %`], ['HSV', `${Math.round(h)}°, ${Math.round(s * 100)} %, ${Math.round(v * 100)} %`]];
    const harm = [['Complémentaire', [hx(h + 180)]], ['Analogues', [hx(h - 30), hx(h + 30)]], ['Triade', [hx(h + 120), hx(h + 240)]], ['Nuances', [hx(h, s * .45, Math.min(1, v + .25)), hx(h, s, v * .72), hx(h, s, v * .45)]]];
    const chip = x => `<button class="pi-c" data-c="${x}" style="--c:${x}" title="${x} · clic : déposer à côté · glisser sur le board"></button>`;
    const p = openPop(n, `<div class="pinfo"><div class="pi-top"><span class="pi-sw" style="--c:${c}"></span><div><b>${esc(name)}</b><small>${c}</small></div></div>`
      + `<div class="pi-rows">${rows.map(([k, val]) => `<button class="pi-row" data-copy="${esc(val)}" title="Copier"><i>${k}</i><span>${esc(val)}</span>${icon('dup', 'sm')}</button>`).join('')}</div>`
      + `<div class="pi-hs">${harm.map(([l, cs]) => `<div class="pi-h"><small>${l}</small><span>${cs.map(chip).join('')}</span></div>`).join('')}</div>`
      + `<div class="pi-act"><button class="btn sm" data-pa="use">${icon('pen', 'sm')}Dessiner avec</button><button class="btn sm" data-pa="fav">${icon('star', 'sm')}Mes couleurs</button><button class="btn sm" data-pa="edit">${icon('drop', 'sm')}Modifier</button></div></div>`, { cls: 'pinfo-pop', focus: false });
    p.addEventListener('click', ev => {
      const cp = ev.target.closest('[data-copy]'); if (cp) { const val = cp.dataset.copy; try { navigator.clipboard.writeText(val); } catch (_) {} toast('Copié : ' + val); return; }
      const ch = ev.target.closest('.pi-c'); if (ch) { const cur = byId.get(it.id) || it, np = Object.assign(mkPaint(ch.dataset.c, 0, 0), { w: cur.w, h: cur.h }); np.x = cur.x + cur.w + cur.w * .15; np.y = cur.y; closePop(); commit(items.concat(np)); sel = new Set([np.id]); schedule(); return; }
      const a = ev.target.closest('[data-pa]'); if (!a) return;
      if (a.dataset.pa === 'use') { if (!S.prefs.pens[penKind]) S.prefs.pens[penKind] = {}; S.prefs.pens[penKind].c = c; useColor(c); save(); closePop(); refreshTools(); Studio.sync(); toast('Couleur du pinceau : ' + c); }
      if (a.dataset.pa === 'fav') { toggleFav(c); if (Studio.on) Studio.refresh('favs'); closePop(); toast('Mes couleurs mises à jour'); }
      if (a.dataset.pa === 'edit') { closePop(); Colors.open(n, { value: c, onPick: (nc, final) => { const cur = byId.get(it.id); if (!nc || !cur) return; commit(replace(items, cur, { c: nc }), final ? undefined : { hist: false }); } }); }
    });
  }
  function cancelOp() { if (op && op.cancel) op.cancel(); op = null; marquee = null; lassoPts = null; guides = null; attachHi = null; attachSock = null; host.classList.remove('panning'); schedule(); }
  function startPan(e, tapClear) {
    grab(e); host.classList.add('panning');
    const s = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; let moved = false;
    op = { id: e.pointerId, kind: 'pan', move(ev) { if (ev.pointerId !== this.id) return; const [dx, dy] = rotD(ev.clientX - s.x, ev.clientY - s.y); if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; view.x = s.vx + dx; view.y = s.vy + dy; viewChanged(); },
      up() { host.classList.remove('panning'); if (tapClear && !moved) { sel.clear(); schedule(); } op = null; } };
  }
  /* iPad: no keyboard, so Ctrl, Shift and Alt sit in a small floating rail on the left. A tap arms the key for the next
     gesture (it lets go when the finger or pencil lifts), a double tap locks it until tapped again. While armed, the
     board's pointer and wheel events read it as held, so every shortcut (Ctrl branch, Shift snap, Alt pipette...) works. */
  const vmods = { ctrl: 0, shift: 0, alt: 0 };   // 0 off, 1 next gesture, 2 locked
  let modsEl = null;
  const touchUI = () => IPAD || (matchMedia && matchMedia('(pointer: coarse)').matches);
  function mountMods() {
    if (!touchUI()) return;
    modsEl = document.createElement('div'); modsEl.className = 'vmods';
    // 0.2.48: Ctrl only (bigger), and under it a tall size slider for the left thumb while a drawing tool is on
    modsEl.innerHTML = [['ctrl', 'Ctrl', 'Ctrl : branche de flèche, point d’ancrage, taille du pinceau…']].map(([k, l, t]) => `<button data-vm="${k}" title="${t}" aria-pressed="false">${l}</button>`).join('')
      + `<div class="vsz" hidden title="Taille du pinceau"><b class="vsz-v"></b><div class="vsz-tr"><i class="vsz-fill"></i><i class="vsz-knob"></i></div><span class="vsz-dot"><i></i></span></div>`;
    wrap.append(modsEl);
    bindVsz($('.vsz', modsEl));
    let lastTap = {};
    modsEl.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
    modsEl.addEventListener('click', e => { const b = e.target.closest('[data-vm]'); if (!b) return; const k = b.dataset.vm, t = performance.now();
      vmods[k] = t - (lastTap[k] || 0) < 320 ? 2 : vmods[k] ? 0 : 1; lastTap[k] = t;
      if (k === 'alt' && (PENS[tool] || tool === 'eraser')) { if (vmods.alt) { altPick = true; setTool('pick'); } else endAltPick(); }
      syncMods(); });
    for (const ty of ['pointerdown', 'pointermove', 'pointerup', 'click', 'dblclick', 'wheel', 'contextmenu']) host.addEventListener(ty, armEvent, true);
    addEventListener('pointerup', releaseMods, true); addEventListener('pointercancel', releaseMods, true);
    syncMods();
  }
  function armEvent(e) {
    if (!vmods.ctrl && !vmods.shift && !vmods.alt) return;
    const def = (k, v) => { if (v && !e[k]) try { Object.defineProperty(e, k, { value: true }); } catch (_) {} };
    def('ctrlKey', vmods.ctrl); def('metaKey', vmods.ctrl); def('shiftKey', vmods.shift); def('altKey', vmods.alt);
  }
  function releaseMods(e) {
    if (!modsEl || (e.target instanceof Node && modsEl.contains(e.target))) return;
    let ch = false; for (const k in vmods) if (vmods[k] === 1) { vmods[k] = 0; ch = true; if (k === 'alt') setTimeout(endAltPick); }
    if (ch) setTimeout(syncMods);
  }
  function vszSet(t, final) {
    const k = penKind; if (!S.prefs.pens[k]) S.prefs.pens[k] = {};
    S.prefs.pens[k].s = sizeOf(k, clamp(t, 0, 1)); syncVsz();
    if (final) { save(); qSig = ''; propSig = ''; refreshTools(); Studio.sync(); renderProps(); }
  }
  function bindVsz(el) {
    const tr = $('.vsz-tr', el);
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); if (!PENS[tool]) return;
      const r = tr.getBoundingClientRect(), at = ev => 1 - (ev.clientY - r.top) / r.height;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.classList.add('on'); vszSet(at(e));
      const mv = ev => { if (ev.pointerId === e.pointerId) vszSet(at(ev)); };
      const up = ev => { if (ev.pointerId !== e.pointerId) return; el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('on'); vszSet(at(ev), true); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }
  function syncVsz() {
    const el = modsEl && $('.vsz', modsEl); if (!el) return;
    const on = !!PENS[tool]; el.hidden = !on; if (!on) return;
    const pr = penPref(penKind), t = sizeT(penKind, pr.s), d = clamp(pr.s, 2, 26);
    el.style.setProperty('--t', t.toFixed(3));
    $('.vsz-v', el).textContent = sizeText(pr.s);
    const dot = $('.vsz-dot i', el); dot.style.width = dot.style.height = d + 'px'; dot.style.background = pr.c;
  }
  function syncMods() { if (!modsEl) return; for (const b of modsEl.children) { const v = vmods[b.dataset.vm]; b.setAttribute('aria-pressed', v ? 'true' : 'false'); b.classList.toggle('lock', v === 2); } }
  /* two fingers: zoom, pan and turn the board (Concepts-like); the turn snaps to straight angles within 5°,
     the fit button (or F) puts it back straight */
  function startPinch() {
    const [a, b] = [...touches.values()];
    const s = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, v: { ...view } };
    const w0 = toW(s.cx, s.cy), t0 = performance.now(); let still = true, pz = 0;
    const me = op = { kind: 'pinch', id: -1, move() { if (!pz) pz = requestAnimationFrame(() => { pz = 0; if (op === me) me.step(); }); },
      step() { const [p, q] = [...touches.values()]; if (!q) return; const d = Math.hypot(p.x - q.x, p.y - q.y), cx = (p.x + q.x) / 2, cy = (p.y + q.y) / 2, k = clamp(s.v.k * d / s.d, MINK, MAXK);
      if (still && (Math.abs(d - s.d) > 14 || Math.hypot(cx - s.cx, cy - s.cy) > 12)) still = false;
      let r = s.v.r + (Math.atan2(q.y - p.y, q.x - p.x) - s.ang) * 180 / Math.PI; r = ((r % 360) + 540) % 360 - 180;
      const st = Math.round(r / 90) * 90; if (Math.abs(r - st) < 5) r = st; if (Math.abs(r) < .01 || Math.abs(Math.abs(r) - 360) < .01) r = 0;
      view.k = k; view.r = r === -180 ? 180 : r; const u = unrot(cx, cy); view.x = u.x - w0.x * k; view.y = u.y - w0.y * k; viewChanged(); },
      /* two fingers that tap and lift together: undo (Procreate, Concepts) */
      up() { if (touches.size >= 2) return; op = null; cancelAnimationFrame(pz); pz = 0; if (still && performance.now() - t0 < 320) { Object.assign(view, s.v); viewChanged(); undo(); tapFlash('Annulé'); } } };
  }
  let lastTap = null, touchDblAt = 0;
  function tapFlash(msg) { const f = document.createElement('div'); f.className = 'tapflash'; f.textContent = msg; wrap.append(f); setTimeout(() => f.remove(), 900); }
  /* groups (Ctrl G / Ctrl Alt G): items sharing a group id g are picked, moved, copied and deleted together;
     Alt + click picks one item inside its group */
  const grpOf = id => { const it = byId.get(id); return it && it.g ? items.filter(i => i.g === it.g && !i.hid).map(i => i.id) : [id]; };
  const growGroups = set => { for (const id of [...set]) for (const m of grpOf(id)) set.add(m); return set; };
  const groupable = () => selItems().filter(i => !(i.k === 'mind' && i.parent));
  /* 0.2.39: the strokes of one drawing session (drawing tools kept, from picking the pen until another tool) form one group,
     so a tap or a click takes the whole drawing, not one stroke; Ctrl+Alt+G (Dégrouper) still splits it */
  let inkSess = null;
  function inkSessionAdd(it) {
    const prev = inkSess && byId.get(inkSess.last);
    if (!prev || prev.hid) { inkSess = { g: null, last: it.id }; return items.concat(it); }
    const g = prev.g || uid('g'); it.g = g; inkSess.last = it.id;
    return items.map(i => i.id === prev.id && !i.g ? Object.assign({}, i, { g }) : i).concat(it);
  }
  function groupSel() {
    const list = groupable(); if (list.length < 2) { toast('Sélectionne au moins deux éléments à grouper'); return; }
    const ids = new Set(list.map(i => i.id)), g = uid('g');
    commit(items.map(i => ids.has(i.id) ? Object.assign({}, i, { g }) : i)); toast(`${list.length} éléments groupés`);
  }
  function ungroupSel() {
    const gs = new Set(groupable().map(i => i.g).filter(Boolean)); if (!gs.size) return;
    commit(items.map(i => gs.has(i.g) ? (({ g, ...rest }) => rest)(i) : i)); toast(gs.size > 1 ? 'Groupes défaits' : 'Groupe défait');
  }
  function moveSet() {
    const ids = new Set();
    for (const id of sel) {
      const it = byId.get(id); if (!it || it.lock) continue; ids.add(id);
      if (it.k === 'frame') for (const c of frameChildren(it)) { if (c.lock) continue; ids.add(c.id); if (c.k === 'mind') mindDesc(c.id, ids); }
      if (it.k === 'uic' && it.t === 'box') for (const cid of uiDesc(items, it.id)) { const c = byId.get(cid); if (c && !c.lock) ids.add(cid); }
      if (it.k === 'mind' && !it.parent) mindDesc(id, ids);
    }
    return ids;
  }
  /* Shift + drag: the item (or the selection it belongs to) is copied and the copy follows the pointer; Shift + click still adds to or removes from the selection */
  function startDupMove(e, w, hit) {
    grab(e);
    const x0 = e.clientX, y0 = e.clientY;
    op = { id: e.pointerId, kind: 'dupwait', moved: false,
      move(ev) {
        if (ev.pointerId !== this.id || Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        if (!sel.has(hit)) sel = new Set(grpOf(hit));
        duplicate(0, 0); render();
        startMove(e, w, true, null); op.move(ev);
      },
      up() { op = null; sel.has(hit) ? sel.delete(hit) : sel.add(hit); schedule(); } };
  }
  function startMove(e, w, wasSelected, target) {
    grab(e);
    const one = sel.size === 1 ? byId.get([...sel][0]) : null;
    const reparent = one && one.k === 'mind' && one.parent;
    const ids = moveSet(); if (reparent) mindDesc(one.id, ids);
    const before = items, orig = new Map([...ids].map(id => [id, byId.get(id)]));
    const moving = [...orig.values()].filter(i => i.k !== 'conn'), bb0 = unionBox(moving);
    const subEl = target && target.closest('[data-sub]'), subKey = subEl ? subEl.dataset.sub : null;
    let cand = null, dropT = null;
    const uiRoots = [...ids].filter(id => { const o = byId.get(id); return o && o.k === 'uic' && !(o.p && ids.has(o.p)); });
    op = { id: e.pointerId, kind: 'move', moved: false,
      move(ev) {
        if (ev.pointerId !== this.id) return;
        const p = toW(ev.clientX, ev.clientY); let dx = p.x - w.x, dy = p.y - w.y;
        if (!this.moved) { if (Math.hypot(dx * view.k, dy * view.k) < 4) return; this.moved = true; cand = snapLines(ids); if (uiRoots.length) uiFloat = new Set(uiRoots); }
        guides = null;
        if (bb0 && !ev.altKey && !reparent && S.prefs.snap !== false) { const s = snap(bb0, dx, dy, cand); dx = s.dx; dy = s.dy; guides = s.g; }
        setLive(items.map(i => { const o = orig.get(i.id); if (!o) return i; if (o.k === 'conn') { const n = Object.assign({}, o); if (!o.a.id && !o.a.on) n.a = { x: o.a.x + dx, y: o.a.y + dy }; if (!o.b.id && !o.b.on) n.b = { x: o.b.x + dx, y: o.b.y + dy }; if (o.pts && o.pts.length && (!o.a.id || ids.has(o.a.id)) && (!o.b.id || ids.has(o.b.id))) n.pts = o.pts.map(q => [q[0] + dx, q[1] + dy]); return n; } return Object.assign({}, o, { x: o.x + dx, y: o.y + dy }); }));
        if (uiRoots.length) uiIns = uiInsAt(p, ids);
        if (reparent) {
          const under = document.elementsFromPoint(ev.clientX, ev.clientY).map(el => el.closest && el.closest('.it.mind')).find(el => el && !ids.has(el.dataset.id));
          const tid = under ? under.dataset.id : null;
          if (tid !== dropT) { if (dropT && nodes.get(dropT)) nodes.get(dropT).classList.remove('drop'); dropT = tid; if (tid) nodes.get(tid).classList.add('drop'); }
        }
      },
      up(ev) {
        if (dropT && nodes.get(dropT)) nodes.get(dropT).classList.remove('drop');
        guides = null; const moved = this.moved; op = null; const ins = uiIns; uiIns = null;
        if (!moved) { uiFloat = null; const hitNow = one; if (hitNow && hitNow.k === 'paint' && ev && !ev.shiftKey) { schedule(); setTimeout(() => paintInfo(hitNow), 0); return; } if (wasSelected && hitNow && EDITABLE.includes(hitNow.k) && hitNow.k !== 'conn' && ev && ev.pointerType !== 'touch') startEdit(hitNow.id, null, hitNow.k === 'todo' ? (subKey || 'title') : undefined); schedule(); return; }
        let next = items;
        if (reparent) {
          const cur = byId.get(one.id), root = byId.get(cur.root) || byId.get(one.root);
          if (dropT) { const t = byId.get(dropT); const side = t.parent ? t.side : (cur.x + cur.w / 2 >= t.x + t.w / 2 ? 1 : -1); const c = t.parent ? t.c : cur.c; const desc = mindDesc(one.id); next = next.map(i => i.id === one.id ? Object.assign({}, i, { parent: t.id, root: t.root || t.id, side, ord: 1e6, c }) : desc.has(i.id) ? Object.assign({}, i, { side, root: t.root || t.id, c }) : i); next = renumber(next, t.id); }
          else if (root) {
            const side = !byId.get(cur.parent).parent ? (cur.x + cur.w / 2 >= root.x + root.w / 2 ? 1 : -1) : cur.side;
            const sibs = next.filter(i => i.k === 'mind' && i.parent === cur.parent && i.id !== cur.id && i.side === side).sort((a, b) => a.y - b.y);
            let ord = sibs.length ? sibs[sibs.length - 1].ord + 1 : 0; for (const s of sibs) if (cur.y + cur.h / 2 < s.y + s.h / 2) { ord = s.ord - .5; break; }
            const desc = mindDesc(one.id); next = next.map(i => i.id === one.id ? Object.assign({}, i, { side, ord }) : desc.has(i.id) ? Object.assign({}, i, { side }) : i); next = renumber(next, cur.parent);
          }
          animate();
        }
        if (uiRoots.length) { next = uiApplyIns(next, uiRoots, ins); uiFloat = null; }
        commit(next, { before });
      },
      cancel() { uiIns = null; uiFloat = null; setLive(before); } };
  }
  function snapLines(skip) {
    const xs = [], ys = [], r = hostRect(), vb = [toW(r.left, r.top).x, toW(r.left, r.top).y, toW(r.right, r.bottom).x, toW(r.right, r.bottom).y];
    for (const i of items) { if (skip.has(i.id) || i.k === 'conn' || i.k === 'ink' || i.hid || !boxHit(boxOf(i), vb)) continue; xs.push(i.x, i.x + i.w / 2, i.x + i.w); ys.push(i.y, i.y + i.h / 2, i.y + i.h); }
    return { xs, ys };
  }
  /* the magnet at the bottom right: guides and snapping on or off while moving items (Alt held also skips them) */
  function syncSnap() { const b = brEl && $('[data-a="snap"]', brEl); if (!b) return; const on = S.prefs.snap !== false; b.setAttribute('aria-pressed', on); b.title = 'Alignement auto (aimant) : ' + (on ? 'activé' : 'coupé'); }
  function snap(bb, dx, dy, c) {
    if (!c) return { dx, dy, g: null };
    const th = 6 / view.k, g = [];
    const tryAxis = (vals, lines) => { let best = null; for (const v of vals) for (const l of lines) { const d = l - v; if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, l }; } return best; };
    const bx = tryAxis([bb[0] + dx, (bb[0] + bb[2]) / 2 + dx, bb[2] + dx], c.xs), by = tryAxis([bb[1] + dy, (bb[1] + bb[3]) / 2 + dy, bb[3] + dy], c.ys);
    if (bx) { dx += bx.d; g.push({ v: bx.l }); } if (by) { dy += by.d; g.push({ h: by.l }); }
    return { dx, dy, g: g.length ? g : null };
  }
  function startResize(e, h) {
    grab(e);
    const list = selItems().filter(i => i.k !== 'conn' && i.k !== 'mind' && !i.lock); if (!list.length) return;
    const before = items, bb = unionBox(list), orig = new Map(list.map(i => [i.id, i]));
    const one = list.length === 1 ? list[0] : null;
    if (uiLaidOut(one)) { uiResizeChild(e, h, one); return; }
    const lock = !one || ['image', 'ink', 'doc'].includes(one.k) || ((one.k === 'text' || one.k === 'todo') && h.length === 2);
    const lay = canTidy(list) ? tidyPrep(list) : null;
    if (one && one.rot && ROTABLE(one)) {
      const o = one, th = o.rot * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), C = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
      op = { id: e.pointerId, kind: 'resize', moved: true,
        move(ev) {
          if (ev.pointerId !== this.id) return;
          const p = toW(ev.clientX, ev.clientY), dx = p.x - C.x, dy = p.y - C.y, qx = dx * c + dy * s + o.w / 2, qy = -dx * s + dy * c + o.h / 2;
          let x0 = 0, y0 = 0, x1 = o.w, y1 = o.h;
          if (h.includes('w')) x0 = Math.min(qx, x1 - 12); if (h.includes('e')) x1 = Math.max(qx, 12);
          if (h.includes('n')) y0 = Math.min(qy, y1 - 12); if (h.includes('s')) y1 = Math.max(qy, 12);
          let sx = (x1 - x0) / o.w, sy = (y1 - y0) / o.h;
          if ((lock || ev.shiftKey) && h.length === 2) { const m = Math.max(sx, sy); sx = sy = m; if (h.includes('w')) x0 = x1 - o.w * m; else x1 = x0 + o.w * m; if (h.includes('n')) y0 = y1 - o.h * m; else y1 = y0 + o.h * m; }
          const W = Math.max(8, x1 - x0), H0 = Math.max(8, y1 - y0), keepH = o.k === 'todo' || o.k === 'sheet' || (o.k === 'text' && h.length === 1), H = keepH ? o.h : H0;
          const lx = (x0 + x1) / 2 - o.w / 2, ly = keepH ? 0 : (y0 + y1) / 2 - o.h / 2, ncx = C.x + lx * c - ly * s, ncy = C.y + lx * s + ly * c;
          const n = Object.assign({}, o, { x: ncx - W / 2, y: ncy - H / 2, w: W, h: H });
          if (o.k === 'text') { if (h.length === 1) n.fw = 1; else { n.fs = Math.max(6, Math.round(o.fs * sy)); if (!o.fw) n.w = o.w; } }
          if (o.k === 'todo' && h.length === 2) n.fs = clamp(Math.round(o.fs * sx * 10) / 10, 8, 120);
          setLive(replace(items, o, n));
        },
        up() { op = null; commit(items, { before }); },
        cancel() { setLive(before); } };
      return;
    }
    op = { id: e.pointerId, kind: 'resize', moved: true,
      move(ev) {
        if (ev.pointerId !== this.id) return;
        const p = toW(ev.clientX, ev.clientY); let [x0, y0, x1, y1] = bb;
        if (h.includes('w')) x0 = Math.min(p.x, x1 - 12); if (h.includes('e')) x1 = Math.max(p.x, x0 + 12);
        if (h.includes('n')) y0 = Math.min(p.y, y1 - 12); if (h.includes('s')) y1 = Math.max(p.y, y0 + 12);
        // Ctrl: the frame changes on this handle's sides only and the pictures rearrange inside it
        if (lay && (ev.ctrlKey || ev.metaKey)) { setLive(lay(x0, y0, x1 - x0, y1 - y0)); return; }
        let sx = (x1 - x0) / (bb[2] - bb[0]), sy = (y1 - y0) / (bb[3] - bb[1]);
        if ((lock || ev.shiftKey) && h.length === 2) { const s = Math.max(sx, sy); sx = sy = s; if (h.includes('w')) x0 = bb[2] - (bb[2] - bb[0]) * s; else x1 = bb[0] + (bb[2] - bb[0]) * s; if (h.includes('n')) y0 = bb[3] - (bb[3] - bb[1]) * s; else y1 = bb[1] + (bb[3] - bb[1]) * s; }
        if (lock && h.length === 1) { if (h === 'e' || h === 'w') sy = sx; else sx = sy; }
        setLive(items.map(i => {
          const o = orig.get(i.id); if (!o) return i;
          const n = Object.assign({}, o, { x: x0 + (o.x - bb[0]) * sx, y: y0 + (o.y - bb[1]) * sy, w: Math.max(8, o.w * sx), h: Math.max(8, o.h * sy) });
          if (o.k === 'text') { if (one && h.length === 1) { n.fw = 1; n.h = o.h; n.y = o.y; } else { n.fs = Math.max(6, Math.round(o.fs * sy)); if (o.fw) n.w = o.w * sx; } }
          if (o.k === 'note' && !one) n.fs = Math.max(8, Math.round(o.fs * Math.min(sx, sy)));
          if (o.k === 'todo') { n.h = o.h; n.y = o.y; if (h.length === 2 || !one) { n.fs = clamp(Math.round(o.fs * sx * 10) / 10, 8, 120); n.w = Math.max(70, n.w); } else n.w = Math.max(Math.max(120, o.fs * 7), n.w); }
          if (o.k === 'sheet') { const g = sheetGeom(o); if (one) { n.h = o.h; n.y = o.y; n.w = Math.max(g.hw + o.cols * (o.fs || 14) * 2.5, n.w); if (o.cw) { const kx = (n.w - g.hw) / (g.w - g.hw); n.cw = g.cws.map(v => v / g.fs * kx); } } else { n.fs = Math.max(8, Math.round((o.fs || 14) * sx)); n.h = sheetGeom(n).h; } }
          return n;
        }));
      },
      up() { op = null; commit(items, { before }); },
      cancel() { setLive(before); } };
  }
  /* the round handle above the selection turns it: one element around its centre, several around the centre of the group
     (their places turn too); it catches the straight angles within 4°, Shift turns by 15° steps */
  function startRotate(e) {
    grab(e);
    const list = selItems().filter(i => ROTABLE(i) && !i.lock); if (!list.length) return;
    const before = items, bb = unionBox(list), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, orig = new Map(list.map(i => [i.id, i]));
    const w0 = toW(e.clientX, e.clientY), a0 = Math.atan2(w0.y - cy, w0.x - cx), r0 = list.length === 1 ? list[0].rot || 0 : 0;
    const norm = r => { r = ((r % 360) + 540) % 360 - 180; return Math.abs(r) < .01 ? 0 : r === -180 ? 180 : r; };
    op = { id: e.pointerId, kind: 'rot', moved: true, deg: r0,
      move(ev) {
        if (ev.pointerId !== this.id) return;
        const p = toW(ev.clientX, ev.clientY); let tgt = r0 + (Math.atan2(p.y - cy, p.x - cx) - a0) * 180 / Math.PI;
        if (ev.shiftKey) tgt = Math.round(tgt / 15) * 15; else { const st = Math.round(tgt / 45) * 45; if (Math.abs(tgt - st) < 4) tgt = st; }
        const d = tgt - r0, t = d * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); this.deg = norm(tgt);
        setLive(items.map(i => { const o = orig.get(i.id); if (!o) return i; const ox = o.x + o.w / 2 - cx, oy = o.y + o.h / 2 - cy, r = norm((o.rot || 0) + d);
          return Object.assign({}, o, { x: cx + ox * c - oy * s - o.w / 2, y: cy + ox * s + oy * c - o.h / 2, rot: r ? +r.toFixed(2) : undefined }); }));
      },
      up() { op = null; commit(items, { before }); },
      cancel() { setLive(before); } };
  }
  /* several pictures or cards selected: a handle at the top right rearranges them, freely, into the box between the
     selection's top left corner and the pointer: justified rows (like a photo wall), pictures scaled to fit, the row
     count that fills the box best; a click alone fits them into the current box */
  const TIDY_K = ['image', 'file', 'link', 'doc', 'note'];
  const canTidy = list => list.length > 1 && list.every(i => TIDY_K.includes(i.k));
  function splitRows(ar, r) {
    const tot = ar.reduce((a, b) => a + b, 0), rows = [[]]; let acc = 0;
    ar.forEach((v, i) => {
      const cut = tot * rows.length / r, left = ar.length - i;
      if (rows[rows.length - 1].length && rows.length < r && (acc + v / 2 > cut || left <= r - rows.length)) rows.push([]);
      rows[rows.length - 1].push(i); acc += v;
    });
    return rows;
  }
  function tidyFit(list, x0, y0, W, H, gap, area) {
    const ar = list.map(i => i.w / Math.max(1, i.h)); let best = null;
    for (let r = 1; r <= list.length; r++) {
      const rows = splitRows(ar, r); if (rows.length !== r) continue;
      const hs = rows.map(row => (W - gap * (row.length - 1)) / row.reduce((a, i) => a + ar[i], 0)); if (hs.some(h => h <= 2)) continue;
      const tot = hs.reduce((a, b) => a + b, 0) + gap * (r - 1);
      // no height given: the width alone decides and the pictures keep about their size (Miro-like)
      if (H == null) { const miss = Math.abs(Math.log(W * tot / area)); if (!best || miss < best.miss) best = { rows, hs, k: 1, miss }; continue; }
      const k = Math.min(1, H / tot), cover = k * k * W * tot;
      if (!best || cover > best.cover) best = { rows, hs, k, cover };
    }
    const out = new Map(); if (!best) return out;
    let y = y0;
    best.rows.forEach((row, ri) => {
      const h = best.hs[ri] * best.k; let x = x0;
      for (const i of row) { const it = list[i], w = h * ar[i]; out.set(it.id, { x, y, w, h }); x += w + gap * best.k; }
      y += h + gap * best.k;
    });
    return out;
  }
  /* the pictures of a selection in reading order, ready to be laid out again in any box */
  function tidyPrep(sel0) {
    // reading order: rows top to bottom (items whose middles are close count as one row), then left to right
    const rowOf = i => Math.round((i.y + i.h / 2) / (Math.min(...sel0.map(j => j.h)) * .6));
    const list = sel0.slice().sort((a, b) => rowOf(a) - rowOf(b) || a.x - b.x);
    const mid = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
    const gap = Math.max(6, mid(list.map(i => i.w)) * .04), area = list.reduce((a, i) => a + (i.w + gap) * (i.h + gap), 0), orig = new Map(list.map(i => [i.id, i]));
    return (x0, y0, W, H) => { const pos = tidyFit(list, x0, y0, Math.max(40, W), H == null ? null : Math.max(40, H), gap, area); return items.map(i => { const p = pos.get(i.id); if (!p) return i; const o = orig.get(i.id), n = Object.assign({}, i, p); if (o.k === 'note') n.fs = Math.max(6, Math.round(o.fs * p.w / o.w)); return n; }); };
  }
  /* the tidy handle moves along x only: the width of the block changes, the rows follow */
  const RAD_OFF = 18;   // screen px from the top right corner, outwards, to the radius dot
  function startRadius(e) {
    grab(e);
    const it0 = selItems()[0]; if (!it0 || (it0.k !== 'shape' && it0.k !== 'image')) return;
    const img = it0.k === 'image', before = items, r0 = img ? imgRad(it0) : shapeRad(it0.sh, it0.w, it0.h, it0.rad), x0 = e.clientX, y0 = e.clientY;
    op = { id: e.pointerId, kind: 'rad', moved: true,
      move(ev) {
        if (ev.pointerId !== this.id) return;
        /* towards the shape (left and down) rounds more, away from it less */
        const d = ((x0 - ev.clientX) + (ev.clientY - y0)) / 2 / view.k;
        const rad = Math.round(clamp(r0 + d, 0, Math.min(it0.w, it0.h) / 2));
        setLive(items.map(i => i.id === it0.id ? Object.assign({}, i, img ? { rad } : { sh: 'rect', rad }) : i));
      },
      up() { op = null; commit(items, { before }); },
      cancel() { setLive(before); } };
    renderOverlay();
  }
  function startTidy(e) {
    grab(e);
    const sel0 = selItems().filter(i => i.k !== 'conn'); if (!canTidy(sel0)) return;
    const before = items, bb = unionBox(sel0), lay = tidyPrep(sel0);
    let moved = false; const start = toW(e.clientX, e.clientY);
    op = { id: e.pointerId, kind: 'tidy', moved: true,
      move(ev) { if (ev.pointerId !== this.id) return; moved = true; const p = toW(ev.clientX, ev.clientY); setLive(lay(bb[0], bb[1], bb[2] - bb[0] + p.x - start.x, null)); },
      up() { op = null; commit(moved ? items : lay(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]), { before }); },
      cancel() { setLive(before); } };
  }
  function startEndpoint(e, end) {
    grab(e);
    const c0 = byId.get([...sel][0]); if (!c0 || c0.k !== 'conn') return;
    const before = items;
    op = { id: e.pointerId, kind: 'ep', moved: true,
      move(ev) { const g = connGeom(c0, byId), o = end === 'a' ? g.pts[g.pts.length - 1] : g.pts[0]; setLive(replace(items, c0, { [end]: endFor(ev, c0, o, c0.id) })); },
      up() { attachHi = null; attachSock = null; op = null; commit(items, { before }); }, cancel() { attachHi = null; setLive(before); } };
  }
  /* Ctrl + a handle of the selected connector: a new arrow branching off it at that spot, which stays on the curve */
  function startBranch(e) {
    const c0 = byId.get([...sel][0]); if (!c0 || c0.k !== 'conn') return;
    const p0 = toW(e.clientX, e.clientY), t = Math.round(connTOf(c0, byId, p0.x, p0.y) * 1000) / 1000, at = connPointAt(c0, byId, t);
    const from = { on: c0.id, t, x: at[0], y: at[1] };
    grab(e);
    const before = items, c = mkConn(from, { x: at[0], y: at[1] }, { route: c0.route, sc: c0.sc, sw: c0.sw, sty: c0.sty, dash: c0.dash, h1: c0.h1 || 'arrow' });
    let moved = false;
    op = { id: e.pointerId, kind: 'conn', moved: false,
      move(ev) { const p = toW(ev.clientX, ev.clientY); if (!moved && Math.hypot((p.x - p0.x) * view.k, (p.y - p0.y) * view.k) < 6) return; moved = true; setLive(before.concat(Object.assign({}, c, { b: endFor(ev, null, at, c.id) }))); },
      up() { attachHi = null; op = null; if (!moved) { setLive(before); schedule(); return; } commit(items, { before }); sel = new Set([c.id]); },
      cancel() { attachHi = null; setLive(before); } };
  }
  /* drag a bend point of a connector; insert=true starts from an "add" handle on segment i */
  function startPoint(e, i, insert) {
    grab(e);
    const c0 = byId.get([...sel][0]); if (!c0 || c0.k !== 'conn') return;
    const before = items, p0 = toW(e.clientX, e.clientY);
    let pts = (c0.pts || []).map(p => p.slice());
    if (insert) { pts.splice(i, 0, [p0.x, p0.y]); setLive(replace(items, c0, { pts })); }
    let moved = false;
    op = { id: e.pointerId, kind: 'pt', moved: true,
      move(ev) { const p = toW(ev.clientX, ev.clientY); if (!moved && Math.hypot((p.x - p0.x) * view.k, (p.y - p0.y) * view.k) < 3) return; moved = true; pts = pts.map((q, j) => j === i ? [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] : q); setLive(replace(items, byId.get(c0.id), { pts })); },
      up() { op = null; if (!moved && !insert) { setLive(before); schedule(); return; } commit(items, { before }); }, cancel() { setLive(before); } };
  }
  function removePoint(i) { const c0 = byId.get([...sel][0]); if (!c0 || c0.k !== 'conn') return; commit(replace(items, c0, { pts: (c0.pts || []).filter((_, j) => j !== i) })); }
  /* the item an arrow end binds to: the one under the pointer, else one whose edge is within a few pixels
     (Excalidraw-like); Ctrl or Cmd held keeps the end free, exactly at the pointer */
  const bindable = (it, skip) => it && it.k !== 'conn' && it.k !== 'ink' && !it.hid && !(skip && it.id === skip.id);
  function underItem(ev, skip) {
    for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
      const n = el.closest && el.closest('[data-id]'); if (!n || !world.contains(n)) continue;
      const it = byId.get(n.dataset.id); if (bindable(it, skip)) return it.id;
    }
    return null;
  }
  function attachTarget(ev, skip) {
    if (ev.ctrlKey || ev.metaKey) return null;
    const ok = it => bindable(it, skip), under = underItem(ev, skip); if (under) return under;
    const p = toW(ev.clientX, ev.clientY); let best = null, bd = 18 / view.k;
    for (const it of items) {
      if (!ok(it) || it.k === 'frame') continue;
      const d = Math.hypot(Math.max(it.x - p.x, 0, p.x - it.x - it.w), Math.max(it.y - p.y, 0, p.y - it.y - it.h));
      if (d < bd) { bd = d; best = it.id; }
    }
    return best;
  }
  /* the end of an arrow dropped here: bound to the item near the pointer; with Ctrl, pinned at this exact spot inside
     the item under the pointer (Miro-like anchor), or free on empty board; Shift snaps a free end to 15° around o */
  function endFor(ev, skip, o, own) {
    const p = toW(ev.clientX, ev.clientY);
    if (ev.ctrlKey || ev.metaKey) {
      const id = underItem(ev, skip); attachHi = id; attachSock = null;
      if (id) { const it = byId.get(id); return { id, fx: Math.round(clamp((p.x - it.x) / it.w, 0, 1) * 1000) / 1000, fy: Math.round(clamp((p.y - it.y) / it.h, 0, 1) * 1000) / 1000 }; }
    } else {
      const id = attachTarget(ev, skip); attachHi = id; attachSock = null;
      if (id) {
        /* near one of the four side sockets: the end sticks to that side's middle, else it picks the nearest side itself */
        const it = byId.get(id); let best = null, bd = 26 / view.k;
        for (const [k, [fx, fy]] of Object.entries(SOCKS)) { const d = Math.hypot(it.x + fx * it.w - p.x, it.y + fy * it.h - p.y); if (d < bd) { bd = d; best = k; } }
        // or along a side, close to its edge: that side
        if (!best) { const e = { n: Math.abs(p.y - it.y), s: Math.abs(p.y - it.y - it.h), w: Math.abs(p.x - it.x), e: Math.abs(p.x - it.x - it.w) }, k = Object.keys(e).reduce((a, b) => e[a] <= e[b] ? a : b); if (e[k] < 14 / view.k) best = k; }
        if (best) { attachSock = best; return { id, fx: SOCKS[best][0], fy: SOCKS[best][1] }; }
        return { id };
      }
      // dropped on another arrow: a branch of it, at that spot of its curve
      const cid = underConn(ev, own);
      if (cid) { const cc = byId.get(cid), t = Math.round(connTOf(cc, byId, p.x, p.y) * 1000) / 1000, at = connPointAt(cc, byId, t); return { on: cid, t, x: at[0], y: at[1] }; }
    }
    const q = snapAng(o, p, ev.shiftKey); return { x: q.x, y: q.y };
  }
  /* the arrow under the pointer, other than the one being drawn and its own branches */
  function underConn(ev, own) {
    for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
      const n = el.closest && el.closest('[data-conn]'); if (!n || !world.contains(n)) continue;
      const c = byId.get(n.dataset.conn); if (!c || c.hid || c.id === own || (own && (c.a.on === own || c.b.on === own))) continue;
      return c.id;
    }
    return null;
  }
  /* Shift: a free end snaps to 15° steps around the other end */
  const snapAng = (o, p, on) => { if (!on) return p; const dx = p.x - o[0], dy = p.y - o[1], L = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * Math.PI / 12; return { x: o[0] + Math.cos(a) * L, y: o[1] + Math.sin(a) * L }; };
  const DIRS = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
  const SOCKS = { n: [.5, 0], e: [1, .5], s: [.5, 1], w: [0, .5] };
  const LINKABLE = it => it && !['conn', 'ink', 'mind'].includes(it.k);
  const ROTABLE = it => !!it && !['conn', 'mind', 'frame', 'uic'].includes(it.k);
  /* a new item next to this one, in that direction, linked by an arrow (Excalidraw's flowchart: Ctrl + arrow keys) */
  function quickNode(src, side) {
    const [dx, dy] = DIRS[side], s = clamp(1 / view.k, .5, 4);
    let n;
    if (src.k === 'shape' || src.k === 'note') { n = JSON.parse(JSON.stringify(src)); n.id = uid(src.id[0]); n.txt = ''; if (n.k === 'shape') n.sd = Math.random(); }
    else n = mkShape(0, 0, 180 * s, 120 * s, 'rect', { fs: Math.round(26 * s) });
    const gap = Math.max(70, (dx ? src.w : src.h) * .45);
    const x0 = src.x + src.w / 2 - n.w / 2 + dx * (src.w / 2 + gap + n.w / 2), y0 = src.y + src.h / 2 - n.h / 2 + dy * (src.h / 2 + gap + n.h / 2);
    const free = (x, y) => !items.some(i => i.k !== 'conn' && i.k !== 'frame' && !i.hid && boxHit(boxOf(i), [x - 12, y - 12, x + n.w + 12, y + n.h + 12]));
    let x = x0, y = y0;
    // already taken (a second Ctrl + arrow): the next free place beside it, alternating sides
    for (let k = 1; k < 16 && !free(x, y); k++) { const off = Math.ceil(k / 2) * (k % 2 ? 1 : -1) * ((dx ? n.h : n.w) + 36); if (dx) y = y0 + off; else x = x0 + off; }
    n.x = x; n.y = y;
    const c = mkConn({ id: src.id }, { id: n.id }, { route: BD().route || 'curve' });
    commit(items.concat(n, c)); sel = new Set([n.id]); render(); reveal(boxOf(n)); startEdit(n.id);
  }
  const connOpts = () => tool === 'line' ? { route: 'straight', h0: 'none', h1: 'none' } : { route: BD().route || 'curve' };
  /* drag: a connector from here to there; a simple click starts a point-by-point line instead */
  function startConn(e, w, hit, side) {
    grab(e);
    if (!hit && !side) hit = attachTarget(e);
    const h = hit && byId.get(hit), pin = !side && (e.ctrlKey || e.metaKey) && h && bindable(h);
    const from = pin ? { id: hit, fx: clamp((w.x - h.x) / h.w, 0, 1), fy: clamp((w.y - h.y) / h.h, 0, 1) } : side && h && SOCKS[side] ? { id: hit, fx: SOCKS[side][0], fy: SOCKS[side][1] } : h && h.k !== 'conn' && h.k !== 'ink' ? { id: hit } : { x: w.x, y: w.y };
    const before = items, c = mkConn(from, { x: w.x, y: w.y }, connOpts()), o = h ? [h.x + h.w / 2, h.y + h.h / 2] : [w.x, w.y];
    let moved = false;
    op = { id: e.pointerId, kind: 'conn', moved: false,
      move(ev) { const p = toW(ev.clientX, ev.clientY); if (!moved && Math.hypot((p.x - w.x) * view.k, (p.y - w.y) * view.k) < 6) return; moved = true; setLive(before.concat(Object.assign({}, c, { b: endFor(ev, from.id ? { id: from.id } : null, o, c.id) }))); },
      up(ev) { attachHi = null; attachSock = null; if (!moved) { if (side && h) { op = null; setLive(before); quickNode(h, side); return; } startPoly(c, from, before); return; } op = null; const last = items[items.length - 1];
        // let go on empty board: a marking menu offers an item there, already linked (0.2.58); Escape keeps the free end
        if (ev && last && last.k === 'conn' && last.b && last.b.id && byId.get(last.b.id) && byId.get(last.b.id).k === 'frame') {
          const f = byId.get(last.b.id), p = toW(ev.clientX, ev.clientY), m = 16 / view.k;
          if (p.x > f.x + m && p.x < f.x + f.w - m && p.y > f.y + m && p.y < f.y + f.h - m) { last.b = { x: p.x, y: p.y }; setLive(items.slice()); }
        }
        if (ev && last && last.k === 'conn' && last.b && last.b.x != null && !last.b.id && !last.b.on) { dropMenu(ev, last, before, o); return; }
        commit(items, { before }); sel = new Set([last.id]); setTool('select'); },
      cancel() { attachHi = null; setLive(before); } };
  }
  /* the arrow end left on empty board: Rectangle, Texte, Post-it or Ellipse at that spot, its end bound to it */
  function dropMenu(ev, c, before, o) {
    const p = { x: c.b.x, y: c.b.y }, s = clamp(1 / view.k, .5, 4), dx = p.x - o[0], dy = p.y - o[1], horiz = Math.abs(dx) >= Math.abs(dy);
    const place = n => { if (horiz) { n.x = dx >= 0 ? p.x : p.x - n.w; n.y = p.y - n.h / 2; } else { n.y = dy >= 0 ? p.y : p.y - n.h; n.x = p.x - n.w / 2; } return n; };
    const add = mk => () => {
      const n = place(mk()), side = horiz ? (dx >= 0 ? 'w' : 'e') : (dy >= 0 ? 'n' : 's');
      const cc = Object.assign({}, c, { b: { id: n.id, fx: SOCKS[side][0], fy: SOCKS[side][1] } });
      commit(items.map(i => i.id === c.id ? cc : i).concat(n), { before }); sel = new Set([n.id]); setTool('select'); render(); startEdit(n.id);
    };
    const keep = () => { commit(items, { before }); sel = new Set([c.id]); setTool('select'); };
    /* 0.2.73: Rectangle straight ahead (right), Texte above it, Post-it below it, Flèche seule back left; no Ellipse / Losange */
    const list = [
      { dir: 2, label: 'Rectangle', run: add(() => mkShape(0, 0, 180 * s, 110 * s, 'rect', { fs: Math.round(26 * s) })) },
      { dir: 1, label: 'Texte', run: add(() => { const t = mkText(0, 0, '', { fs: Math.round(28 * s) }); t.w = 160 * s; t.h = 40 * s; return t; }) },
      { dir: 3, label: 'Post-it', sw: noteColor, run: add(() => mkNote(0, 0, '', noteColor, { w: 200 * s, h: 200 * s, fs: Math.round(30 * s) })) },
      { dir: 5, label: 'Flèche seule', run: keep }];
    openMarking({ clientX: ev.clientX, clientY: ev.clientY, pointerId: -1, button: 0 }, null, true, { items: list, title: 'Créer au bout', onClose: keep });
  }
  /* point-by-point: each click adds a corner, a click on an item binds the end, Enter or double-click finishes, Escape cancels */
  function startPoly(c, from, before) {
    const pts = [];
    const fh = from.id ? byId.get(from.id) : null;
    let cursor = fh ? [fh.x + fh.w / 2, fh.y + fh.h / 2] : [from.x, from.y];
    const show = (tail) => { const cur = pts.length ? pts : []; setLive(before.concat(Object.assign({}, c, { pts: cur, b: tail }))); };
    op = { id: -1, kind: 'poly', keep: true, moved: false,
      move(ev) { const p = toW(ev.clientX, ev.clientY); cursor = [p.x, p.y]; const tid = attachTarget(ev, from.id ? { id: from.id } : null); attachHi = tid; show(tid ? { id: tid } : { x: p.x, y: p.y }); },
      click(ev) { const p = toW(ev.clientX, ev.clientY), tid = attachTarget(ev, from.id ? { id: from.id } : null); if (tid) { attachHi = null; this.finish({ id: tid }); return; } const last = pts[pts.length - 1]; if (last && Math.hypot(last[0] - p.x, last[1] - p.y) * view.k < 4) { this.finish(); return; } pts.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]); show({ x: p.x, y: p.y }); },
      finish(b) { attachHi = null; op = null; if (!b) { if (!pts.length) { setLive(before); schedule(); toolHint('Cliquez pour poser des points, double-clic ou Entrée pour finir'); return; } b = { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] }; pts.pop(); } const it = Object.assign({}, c, { pts: pts.slice(), b }); commit(before.concat(it)); sel = new Set([it.id]); setTool('select'); },
      cancel() { attachHi = null; setLive(before); } };
    show({ x: cursor[0], y: cursor[1] });
    toolHint('Cliquez pour ajouter des points · double-clic ou Entrée pour terminer · Échap annule');
  }
  function toolHint(msg) { if (hintEl) hintEl.remove(); hintEl = document.createElement('div'); hintEl.className = 'bhint'; hintEl.textContent = msg; wrap.append(hintEl); clearTimeout(toolHint.t); toolHint.t = setTimeout(() => hintEl && hintEl.remove(), 4200); }
  function startRect(e, w) {
    grab(e);
    const before = items, uz = tool === 'uiz', fr = tool === 'frame' || uz, s = clamp(1 / view.k, .5, 4);
    const mk = (x, y, ww, hh) => uz ? Object.assign(mkFrame(x, y, ww, hh, 'UI Design'), { ui: 'theme' }) : fr ? mkFrame(x, y, ww, hh, 'Cadre') : mkShape(x, y, ww, hh, shapeKind, { fs: Math.round(26 * s) });
    const base = mk(w.x, w.y, 1, 1); let moved = false;
    op = { id: e.pointerId, kind: 'rect', moved: false,
      move(ev) { const p = toW(ev.clientX, ev.clientY); let dx = p.x - w.x, dy = p.y - w.y; if (!moved && Math.hypot(dx * view.k, dy * view.k) < 5) return; moved = true; if (ev.shiftKey) { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m; }
        const it = Object.assign({}, base, { x: Math.min(w.x, w.x + dx), y: Math.min(w.y, w.y + dy), w: Math.max(4, Math.abs(dx)), h: Math.max(4, Math.abs(dy)) }); setLive(fr ? [it].concat(before) : before.concat(it)); },
      up() { op = null; if (!moved) { const W = uz ? 1440 : fr ? 480 : 180 * s, H = uz ? 900 : fr ? 320 : (shapeKind === 'pill' ? 70 : 120) * s; const it = Object.assign({}, base, { x: w.x - W / 2, y: w.y - H / 2, w: W, h: H }); setLive(fr ? [it].concat(before) : before.concat(it)); } commit(items, { before }); sel = new Set([base.id]); setTool('select'); if (uz) { reveal(boxOf(byId.get(base.id))); uiLibOpen(base.id); } else if (fr) startEdit(base.id); },
      cancel() { setLive(before); } };
  }
  function startMarquee(e, w, add) {
    grab(e);
    const base = add ? new Set(sel) : new Set();
    op = { id: e.pointerId, kind: 'marquee', moved: false,
      move(ev) { const p = toW(ev.clientX, ev.clientY); this.moved = true; marquee = [w.x, w.y, p.x, p.y]; const b = [Math.min(w.x, p.x), Math.min(w.y, p.y), Math.max(w.x, p.x), Math.max(w.y, p.y)]; sel = new Set(base);
        for (const i of items) { if (i.hid || i.lock || i.k === 'ink') continue; if (i.k === 'conn') { const g = connGeom(i, byId); if (inBox(g.mid[0], g.mid[1], b)) sel.add(i.id); continue; } const q = boxOf(i); if (i.k === 'frame' ? (q[0] >= b[0] && q[1] >= b[1] && q[2] <= b[2] && q[3] <= b[3]) : boxHit(q, b)) { if (i.k === 'mind' && i.parent) continue; sel.add(i.id); } }
        growGroups(sel); schedule(); },
      up() { marquee = null; op = null; schedule(); } };
  }
  /* 0.2.51: the lasso — a free loop around strokes selects them (half their length inside), other elements only when wholly inside */
  function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 2; i < P.length; j = i, i += 2) { const xi = P[i], yi = P[i + 1], xj = P[j], yj = P[j + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function lassoInSel(w) { if (!sel.size) return false; const b = unionBox(selItems()); if (!b) return false; const pd = 10 / view.k; return inBox(w.x, w.y, [b[0] - pd, b[1] - pd, b[2] + pd, b[3] + pd]); }
  function lassoPick(P, add, base) {
    const s = add ? new Set(base || sel) : new Set(); if (P.length < 8) return s;
    let bb = [Infinity, Infinity, -Infinity, -Infinity]; for (let i = 0; i < P.length; i += 2) { bb[0] = Math.min(bb[0], P[i]); bb[1] = Math.min(bb[1], P[i + 1]); bb[2] = Math.max(bb[2], P[i]); bb[3] = Math.max(bb[3], P[i + 1]); }
    for (const i of items) {
      if (i.hid || i.lock || i.k === 'conn' || i.k === 'frame' || (i.k === 'mind' && i.parent)) continue;
      const q = boxOf(i); if (!boxHit(q, bb)) continue;
      if (i.k === 'ink') { const sx = i.w / i.w0, sy = i.h / i.h0, n = i.p.length / 3, st = Math.max(1, Math.floor(n / 400)); for (let j = 0; j < n; j += st) if (inPoly(i.x + i.p[j * 3] * sx, i.y + i.p[j * 3 + 1] * sy, P)) { s.add(i.id); break; } }
      else if (inPoly(q[0], q[1], P) && inPoly(q[2], q[1], P) && inPoly(q[2], q[3], P) && inPoly(q[0], q[3], P)) s.add(i.id);
    }
    return s;
  }
  function startLasso(e, add) {
    grab(e); const w = toW(e.clientX, e.clientY); lassoPts = [w.x, w.y]; const base0 = new Set(sel); let lp = 0;
    op = { id: e.pointerId, kind: 'lasso', moved: false,
      move(ev) { if (ev.pointerId !== this.id) return; const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : []; for (const x of evs.length ? evs : [ev]) { const p = toW(x.clientX, x.clientY), n = lassoPts.length; if (Math.hypot((p.x - lassoPts[n - 2]) * view.k, (p.y - lassoPts[n - 1]) * view.k) < 3) continue; lassoPts.push(p.x, p.y); } renderOverlay();
        if (!lp) lp = requestAnimationFrame(() => { lp = 0; if (lassoPts && op && op.kind === 'lasso') { sel = lassoPick(lassoPts, add, base0); schedule(); } }); },
      up() { op = null; cancelAnimationFrame(lp); const P = lassoPts; lassoPts = null; sel = lassoPick(P, add, base0); schedule(); },
      cancel() { lassoPts = null; } };
  }
  function startInk(e) {
    grab(e); if (sel.size) { sel.clear(); schedule(); }
    const pk = penKind, pr = penPref(pk), def = PENS[pk];
    ink.begin(e, { t: pk, c: pr.c, s: pr.s / view.k, o: pr.o, smooth: pr.sm, k: view.k, b: strokeBrush(pk, pr, view.k) });
    const ax = e.clientX, ay = e.clientY; let shp = null;
    const shapeOf = ev => ev.shiftKey ? (ev.ctrlKey || ev.metaKey ? 'rect' : ev.altKey ? 'snap' : 'line') : shp;
    op = { id: e.pointerId, kind: 'ink', move(ev) { if (ev.pointerId !== this.id) return; const m = shapeOf(ev); if (m) { shp = m; ink.shapeTo(ax, ay, ev.clientX, ev.clientY, m); } else ink.feed(ev); },
      up() { op = null; const st = ink.end(); if (st && st.p.length >= 3) { if (st.p.length === 3) st.p.push(st.p[0] + .4 / view.k, st.p[1] + .2 / view.k, st.p[2]); commit(inkSessionAdd(mkInk(st))); useColor(st.c); if (Studio.on) Studio.refresh('history'); } },
      cancel() { ink.cancel(); } };
  }
  /* Ctrl + left or middle drag, left or right: the brush size, a ring at the press point and the value beside it (as in Photoshop) */
  function startSize(e) {
    grab(e);
    const k = penKind, t0 = sizeT(k, penPref(k).s), x0 = e.clientX, r = wrap.getBoundingClientRect();
    const ring = document.createElement('div'); ring.className = 'bsz'; ring.style.left = (e.clientX - r.left) + 'px'; ring.style.top = (e.clientY - r.top) + 'px';
    ring.innerHTML = '<i></i><b></b>'; wrap.append(ring);
    const show = sz => { const d = Math.max(2, sz); ring.firstChild.style.cssText = `width:${d}px;height:${d}px;border-color:${penPref(k).c}`; ring.lastChild.style.left = (d / 2 + 10) + 'px'; ring.lastChild.textContent = sizeText(sz); };
    show(penPref(k).s);
    op = { id: e.pointerId, kind: 'size', move(ev) { if (ev.pointerId !== this.id) return; if (!S.prefs.pens[k]) S.prefs.pens[k] = {}; const sz = sizeOf(k, clamp(t0 + (ev.clientX - x0) / 480, 0, 1)); S.prefs.pens[k].s = sz; show(sz); },
      up() { op = null; ring.remove(); save(); propSig = ''; refreshTools(); renderProps(); Studio.sync(); }, cancel() { ring.remove(); } };
  }
  /* E (or the tool bar) erases any element it touches; the eraser of the drawing bar, or a stylus's eraser end, only strokes */
  function startErase(e, all) {
    grab(e);
    const before = items; let gone = new Set();
    const wipe = ev => {
      let hit = false;
      for (const el of document.elementsFromPoint(ev.clientX, ev.clientY)) {
        const n = el.closest && el.closest('[data-id],[data-conn]'); if (!n || !world.contains(n)) continue;
        const it = byId.get(n.dataset.id || n.dataset.conn); if (!it || it.hid || it.k === 'frame' || gone.has(it.id)) continue;
        gone.add(it.id); if (it.k === 'mind') mindDesc(it.id, gone); hit = true;
      }
      if (hit) { if (editing && gone.has(editing)) { editing = null; editSub = null; } setLive(items.filter(i => !gone.has(i.id) && !(i.k === 'conn' && (gone.has(i.a.id) || gone.has(i.b.id))))); }
    };
    const at = ev => { const p = toW(ev.clientX, ev.clientY), r = 12 / view.k; const hit = items.filter(i => i.k === 'ink' && !i.hid && !gone.has(i.id) && inBox(p.x, p.y, [i.x - r, i.y - r, i.x + i.w + r, i.y + i.h + r]) && inkHit(i.p, i.s, (p.x - i.x) * i.w0 / i.w, (p.y - i.y) * i.h0 / i.h, r * i.w0 / i.w)); if (hit.length) { hit.forEach(i => gone.add(i.id)); setLive(items.filter(i => !gone.has(i.id))); } };
    at(e); if (all) wipe(e);
    op = { id: e.pointerId, kind: 'erase', move(ev) { if (ev.pointerId !== this.id) return; const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]; for (const x of evs.length ? evs : [ev]) at(x); if (all) wipe(ev); eraserAt = clientToHost(ev); renderOverlay(); },
      up() { op = null; if (gone.size) commit(items, { before }); }, cancel() { setLive(before); } };
  }
  const clientToHost = ev => { const r = hostRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  function onMove(e) {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) { const tt = touches.get(e.pointerId); tt.x = e.clientX; tt.y = e.clientY; }
    if (op) { if (op.keep && !(e.target && host.contains(e.target))) return; op.move(e); return; }
    if (tool === 'eraser' && e.target && host.contains(e.target)) { eraserAt = clientToHost(e); renderOverlay(); }
    if (tool === 'conn' || tool === 'line') { const t = e.target && host.contains(e.target) ? attachTarget(e) : null; if (t !== attachHi) { attachHi = t; renderOverlay(); } }
    if (tool === 'pick') { if (e.target && host.contains(e.target)) Studio.showLoupe(e.clientX, e.clientY, snapshot()); else Studio.hideLoupe(); }
  }
  /* ---------- eyedropper: a picture of what the board shows, rebuilt when the board or the view changes ---------- */
  let shot = null, snapAt = -1, drawn = 0;
  function bgOf(el) { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c)) return c; } return isDarkTheme() ? '#141518' : '#F5F3EE'; }
  function snapshot(noImg) {
    if (shot && snapAt === drawn && !noImg) return shot;
    const r = hostRect(), dpr = Math.min(2, devicePixelRatio || 1), c = mkCanvas(r.width * dpr, r.height * dpr), x = c.getContext('2d', { willReadFrequently: true });
    x.scale(dpr, dpr); x.fillStyle = bgOf(host); x.fillRect(0, 0, r.width, r.height);
    const order = items.filter(i => i.k === 'frame').concat(items.filter(i => i.k !== 'frame' && i.k !== 'conn'));
    for (const it of order) {
      const n = nodes.get(it.id); if (it.hid || !n || !n.isConnected) continue;
      const b = n.getBoundingClientRect(); if (b.right < r.left || b.left > r.right || b.bottom < r.top || b.top > r.bottom) continue;
      const X = b.left - r.left, Y = b.top - r.top;
      try {
        if (it.k === 'paint') { x.save(); x.translate(X, Y); x.scale(b.width / 100, b.height / 100); x.fillStyle = it.c; x.fill(new Path2D(paintBlob(it.seed).d)); x.restore(); continue; }
        if (it.k === 'image') { const img = n.querySelector('img'); if (!noImg && img && img.complete && img.naturalWidth) x.drawImage(img, X, Y, b.width, b.height); continue; }
        if (it.k === 'ink') { x.save(); x.translate(X, Y); x.scale(b.width / it.w0, b.height / it.h0); x.globalAlpha = it.o ?? (PENS[it.t] || PENS.pen).o; if (it.b) { const v = stampPicture(it); x.drawImage(v.cv, v.x0, v.y0, v.W, v.H); } else { x.fillStyle = inkColor(it.c); x.fill(new Path2D(inkD(it))); } x.restore(); continue; }
        if (it.k === 'shape') { if (it.fc) { x.fillStyle = it.fc; x.beginPath(); if (it.shape === 'ellipse') x.ellipse(X + b.width / 2, Y + b.height / 2, b.width / 2, b.height / 2, 0, 0, 7); else x.rect(X, Y, b.width, b.height); x.fill(); } continue; }
        const bg = getComputedStyle(n).backgroundColor; if (bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg)) { x.fillStyle = bg; x.fillRect(X, Y, b.width, b.height); }
      } catch (er) {}
    }
    try { x.getImageData(0, 0, 1, 1); } catch (er) { return noImg ? null : snapshot(true); }
    shot = { cv: c, dpr, left: r.left, top: r.top, at(px, py) { const d = x.getImageData(clamp(Math.round(px * dpr), 0, c.width - 1), clamp(Math.round(py * dpr), 0, c.height - 1), 1, 1).data; return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase(); } };
    snapAt = drawn; return shot;
  }
  let pickBack = null, altPick = false;
  function startTouchPick(e) {
    const show = ev => Studio.showLoupe(ev.clientX, ev.clientY, snapshot(), -96);
    show(e);
    op = { id: e.pointerId, kind: 'pick', move(ev) { if (ev.pointerId === this.id) show(ev); }, up(ev) { op = null; Studio.hideLoupe(); pickAt(ev); } };
  }
  function pickAt(e) {
    const s = snapshot(); if (!s) return; const c = s.at(e.clientX - s.left, e.clientY - s.top);
    S.prefs.pens[penKind].c = c; save(); Studio.picked(c, e.clientX - 0, e.clientY - 0);
    if (tool === 'pick' && !e.shiftKey && !altPick) { Studio.hideLoupe(); setTool(pickBack && (PENS[pickBack] || pickBack === 'eraser') ? (pickBack === 'eraser' ? penKind : pickBack) : penKind); }
    else refreshTools();
  }
  function onUp(e) {
    if (e.pointerType === 'touch') { const tt = touches.get(e.pointerId); if (tt && tt.x0 != null && touches.size === 1) { const now = performance.now(); lastTap = now - tt.t0 < 300 && Math.hypot(e.clientX - tt.x0, e.clientY - tt.y0) < 12 ? { t: now, x: e.clientX, y: e.clientY } : null; } else lastTap = null; touches.delete(e.pointerId); }
    if (op && op.keep) return;
    if (op && (op.id === e.pointerId || op.kind === 'pinch')) { const o = op; o.up(e); if (op === o) op = null; schedule(); }
  }
  function onCancel(e) { if (e.pointerType === 'touch') touches.delete(e.pointerId); if (op && op.id === e.pointerId) cancelOp(); }
  function onDbl(e, touchTap) {
    if (!touchTap && performance.now() - touchDblAt < 700) return;   // the double tap was already handled from the touches
    if (op && op.keep) { e.preventDefault(); op.finish(); return; }
    if (tool !== 'select') return;
    const pt = e.target.closest('.hdl[data-pt]'); if (pt) { removePoint(+pt.dataset.pt); return; }
    /* the pointer was captured by the board on the way down: the double click then names the board, not what is under it */
    let hit = hitAt(e); if (!hit && e.target === host) { const u = document.elementFromPoint(e.clientX, e.clientY), n = u && u.closest('[data-id]'); if (n && world.contains(n)) hit = n.dataset.id; }
    if (!hit) { const w = toW(e.clientX, e.clientY); createAt('note', w); return; }
    const it = byId.get(hit); if (it.lock) return;
    if (it.k === 'uic') { uiFocusText(it); return; }
    if (it.k === 'frame' && it.ui && e.target.closest('.uzh')) return;
    if (it.k === 'frame' && e.target.closest('.fzh')) { e.preventDefault(); startEdit(it.id); return; }
    if (EDITABLE.includes(it.k)) { if (e.target.closest('.ck,[data-tck],[data-tadd]')) return; const sub = e.target.closest('[data-sub]'); startEdit(hit, null, it.k === 'todo' ? (sub ? sub.dataset.sub : 'title') : it.k === 'sheet' ? ((e.target.closest('[data-cell]') || {}).dataset || {}).cell : undefined); }
    else openItem(it);
  }
  function onWheel(e) {
    e.preventDefault();
    const r = hostRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
    const mouseWheel = e.deltaMode === 1 || (Math.abs(dx) < .5 && Math.abs(dy) >= 40 && Number.isInteger(dy));
    if (e.ctrlKey || e.metaKey) zoomAt(sx, sy, Math.exp(-dy * (mouseWheel ? .0018 : .01)));
    else if (S.prefs.wheel === 'zoom' && mouseWheel && !e.shiftKey) zoomAt(sx, sy, Math.exp(-dy * .0018));
    else { const [ux, uy] = rotD(e.shiftKey && !dx ? dy : dx, e.shiftKey && !dx ? 0 : dy); view.x -= ux; view.y -= uy; viewChanged(); }
    lastClient = { x: e.clientX, y: e.clientY };
  }

  /* ---------- drag & drop, moodboard media, paste, clipboard ---------- */
  const isUrl = s => /^https?:\/\/\S+$/i.test(String(s).trim());
  /* items from the space's moodboard library: images, files, links and documents */
  async function placeMedia(list, w, o = {}) {
    list = (list || []).filter(Boolean); if (!list.length) return [];
    const s = 1 / view.k, at = w || centerW(), added = [];
    const single = list.length === 1, colW = 260 * s, gap = 16 * s, cols = single ? 1 : clamp(Math.round(Math.sqrt(list.length * 1.3)), 2, 5), hs = new Array(cols).fill(0);
    const x0 = at.x - (cols * (colW + gap) - gap) / 2, y0 = at.y - 40 * s;
    for (const m of list) {
      let it = null;
      if (m.type === 'image' && m.asset && Assets.has(m.asset)) {
        let dw = m.w, dh = m.h; if (!dw || !dh) { const d = await imgSize(Assets.url(m.asset)); dw = d.w || 4; dh = d.h || 3; }
        const W = single ? Math.min(dw, 380 * s) : colW, H = W * dh / dw;
        const c = hs.indexOf(Math.min(...hs));
        it = mkImage(single ? at.x - W / 2 : x0 + c * (colW + gap), single ? at.y - H / 2 : y0 + hs[c], W, H, m.asset, { cap: m.name && !/\.[a-z0-9]{2,4}$/i.test(m.name) ? m.name : '' });
        hs[c] += H + gap;
      } else if (m.type === 'file' && m.asset) {
        const media = /^video\//.test(m.mime || ''), audio = /^audio\//.test(m.mime || ''), W = (media ? 360 : 280) * s, H = (media ? 202 : audio ? 86 : 78) * s, c = hs.indexOf(Math.min(...hs));
        it = { id: uid('f'), k: 'file', x: single ? at.x - W / 2 : x0 + c * (colW + gap), y: single ? at.y - H / 2 : y0 + hs[c], w: W, h: H, asset: m.asset, name: m.name || 'Fichier', size: m.size || 0, mime: m.mime || '' }; hs[c] += H + gap;
      } else if (m.type === 'link' && m.url) { const W = 300 * s, H = 80 * s, c = hs.indexOf(Math.min(...hs)); it = { id: uid('l'), k: 'link', x: single ? at.x - W / 2 : x0 + c * (colW + gap), y: single ? at.y - H / 2 : y0 + hs[c], w: W, h: H, url: m.url, title: m.title || '' }; hs[c] += H + gap; }
      else if (m.type === 'text' && m.txt) { const W = 220 * s, H = 220 * s, c = hs.indexOf(Math.min(...hs)); it = mkNote(single ? at.x - W / 2 : x0 + c * (colW + gap), single ? at.y - H / 2 : y0 + hs[c], m.txt, noteColor, { w: W, h: H, fs: m.txt.length > 120 ? 18 : 24 }); hs[c] += H + gap; }
      else if (m.type === 'folder' && m.path) { const W = 280 * s, H = 78 * s, c = hs.indexOf(Math.min(...hs)); it = { id: uid('D'), k: 'dir', x: single ? at.x - W / 2 : x0 + c * (colW + gap), y: single ? at.y - H / 2 : y0 + hs[c], w: W, h: H, path: m.path, name: m.name || 'Dossier' }; hs[c] += H + gap; }
      else if (m.type === 'doc' && docById(m.doc) && m.doc !== D.id) { const W = 220 * s, H = 180 * s, c = hs.indexOf(Math.min(...hs)); it = { id: uid('d'), k: 'doc', x: single ? at.x - W / 2 : x0 + c * (colW + gap), y: single ? at.y - H / 2 : y0 + hs[c], w: W, h: H, doc: m.doc }; hs[c] += H + gap; }
      if (it) added.push(it);
    }
    if (!added.length) return [];
    commit(items.concat(added)); sel = new Set(added.map(i => i.id)); render(); if (o.reveal !== false) reveal(unionBox(added));
    toast(added.length > 1 ? `${added.length} éléments placés` : 'Placé sur le board');
    return added.map(i => i.id);
  }
  async function ingest(dt, w, o = {}) {
    const notely = dt.getData && dt.getData('application/x-notely');
    if (notely) { try { const j = JSON.parse(notely); await placeMedia(Array.isArray(j) ? j : [j], w, { reveal: false }); return; } catch (e) {} }
    const seen = dropSummary(dt);
    let files = [...(dt.files || [])];
    if (!files.length && dt.items) files = [...dt.items].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
    files = files.map(asImageFile);
    if (files.length) {
      const imgs = files.filter(f => /^image\//.test(f.type)), rest = files.filter(f => !/^image\//.test(f.type));
      const added = [];
      if (imgs.length === 1 && o.placeholder) {
        try { const im = await importImage(imgs[0]); const ph = byId.get(o.placeholder); if (ph) { commit(replace(items, ph, { asset: im.id, h: ph.w * im.h / im.w })); toast('Image placée'); } } catch (e) { toast("Cette image n'a pas pu être lue"); }
        imgs.length = 0;
      }
      const s = 1 / view.k, colW = 260 * s, gap = 16 * s;
      const dims = [];
      for (const f of imgs) { try { dims.push(await importImage(f)); } catch (e) { toast(`« ${f.name} » n'a pas pu être lue`); } }
      if (dims.length) {
        const cols = dims.length === 1 ? 1 : clamp(Math.round(Math.sqrt(dims.length * 1.3)), 2, 5);
        const W1 = dims.length === 1 ? Math.min(dims[0].w, 380) * s : colW;
        const hs = new Array(cols).fill(0), x0 = w.x - (cols * (W1 + gap) - gap) / 2, y0 = w.y - (dims.length === 1 ? W1 * dims[0].h / dims[0].w / 2 : 40 * s);
        for (const d of dims) { const c = hs.indexOf(Math.min(...hs)), h = W1 * d.h / d.w; added.push(mkImage(x0 + c * (W1 + gap), y0 + hs[c], W1, h, d.id)); hs[c] += h + gap; }
      }
      let fy = added.length ? Math.max(...added.map(i => i.y + i.h)) + 24 * s : w.y;
      for (const f of rest) {
        if (f.size > 80e6) { toast(`« ${f.name} » dépasse 80 Mo`); continue; }
        const id = await Assets.put(f);
        const media = /^video\//.test(f.type), audio = /^audio\//.test(f.type);
        const W = (media ? 360 : 280) * s, H = (media ? 202 : audio ? 86 : 78) * s;
        added.push({ id: uid('f'), k: 'file', x: w.x - W / 2, y: fy, w: W, h: H, asset: id, name: f.name, size: f.size, mime: f.type });
        fy += H + 16 * s;
      }
      if (added.length) { commit(items.concat(added)); sel = new Set(added.map(i => i.id)); render(); reveal(unionBox(added)); toast(added.length > 1 ? `${added.length} éléments ajoutés` : 'Ajouté'); propSig = ''; }
      return;
    }
    const { imgs, links, text } = readDropText(dt);
    if (imgs.length || links.length) { await placeUrls(imgs, links, w, o); return; }
    const txt = text.trim();
    if (!txt) { lastDrop = seen; toast('Rien de lisible dans ce dépôt (ni image, ni lien)', { label: 'Copier le détail', run: () => copyText(seen) }); return; }
    const s = clamp(1 / view.k, .5, 4), it = mkNote(w.x - 110 * s, w.y - 110 * s, txt.slice(0, 1200), noteColor, { w: 220 * s, h: 220 * s, fs: Math.round(30 * s) });
    commit(items.concat(it)); sel = new Set([it.id]);
    // a drag that carries only text (the ChatGPT library does this): the picture itself comes with a copy
    if ('placeholder' in o) toast('Seul du texte est arrivé : pour une image, faites clic droit > Copier l’image puis Ctrl V', { label: 'Copier le détail', run: () => copyText(seen) });
  }
  /* a file without a type (some apps drop "image.webp" as application/octet-stream or nothing): typed from its name */
  const IMG_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp' };
  function asImageFile(f) {
    if (/^image\//.test(f.type)) return f;
    const t = IMG_TYPES[(String(f.name || '').split('.').pop() || '').toLowerCase()];
    return t && (!f.type || f.type === 'application/octet-stream') ? new File([f], f.name, { type: t }) : f;
  }
  /* what a drop carried, for the "Copier le détail" button when nothing could be used */
  let lastDrop = '';
  function dropSummary(dt) {
    const out = [];
    try { for (const t of dt.types || []) { let v = ''; try { v = t === 'Files' ? '' : dt.getData(t) || ''; } catch (e) {} out.push(`${t}: ${v.replace(/\s+/g, ' ').slice(0, 300)}`); } } catch (e) {}
    try { for (const f of dt.files || []) out.push(`fichier: ${f.name} (${f.type || 'sans type'}, ${f.size} o)`); } catch (e) {}
    try { for (const i of dt.items || []) out.push(`item: ${i.kind} ${i.type}`); } catch (e) {}
    return `PLUM ${APP_VERSION}, dépôt sur le board\n` + (out.join('\n') || '(aucune donnée)');
  }
  function copyText(t) { try { navigator.clipboard.writeText(t).then(() => toast('Détail copié : collez-le dans la discussion'), () => toast('Copie impossible')); } catch (e) { toast('Copie impossible'); } }
  /* the biggest picture of an <img>: its srcset when there is one (Instagram, most sites), else its src */
  function bestSrc(tag) {
    const attr = n => { const m = new RegExp(`\\s${n}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag); return m ? unEntity(m[1]) : ''; };
    const set = attr('srcset').split(/,\s+/).map(c => { const [u, d] = c.trim().split(/\s+/); return { u, n: parseFloat(d) || 1 }; }).filter(c => c.u && /^https?:/i.test(c.u));
    if (set.length) return set.sort((a, b) => b.n - a.n)[0].u;
    return attr('src');
  }
  /* what a browser, the ChatGPT app or Instagram puts in a drop or the clipboard: a picture (its <img> in the html),
     image addresses, page links, or plain text */
  function readDropText(dt) {
    const get = k => { try { return (dt.getData && dt.getData(k)) || ''; } catch (e) { return ''; } };
    const plain = get('text/plain').trim(), html = get('text/html');
    const uri = get('text/uri-list').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    // other ways apps hand over an address: Chromium's DownloadURL (mime:name:url), Firefox's x-moz-url, IE's URL
    const dl = /^[^:]+\/[^:]+:[^:]*:(https?:.+|file:.+)$/i.exec(get('DownloadURL')), moz = get('text/x-moz-url').split(/\r?\n/)[0], ie = get('URL');
    for (const u of [dl && dl[1], moz, ie]) if (u && !uri.includes(u.trim())) uri.push(u.trim());
    const words = plain.split(/\s+/).filter(Boolean);
    const okUrl = u => isUrl(u) || /^data:image\//i.test(u) || (Net.native() && /^file:\/\//i.test(u));
    const urls = (uri.length ? uri : words.length && words.length <= 40 && words.every(okUrl) ? words : []).filter(okUrl);
    const srcs = [...html.matchAll(/<img\b[^>]*>/gi)].map(m => bestSrc(m[0])).filter(u => /^(https?:|data:image\/|file:)/i.test(u));
    const htmlText = html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;|\s/g, '');
    // a dragged or copied picture: one <img> and no text around it; the address under it may be the link around the picture
    if (srcs.length === 1 && htmlText.length < 400 && urls.length <= 1) return { imgs: [{ src: srcs[0], link: urls[0] && urls[0] !== srcs[0] && !isImgUrl(urls[0]) ? urls[0] : '' }], links: [], text: plain };
    const img = u => isImgUrl(u) || /^file:\/\/.+\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(u);
    return { imgs: urls.filter(img).map(src => ({ src })), links: urls.filter(u => !img(u)), text: plain };
  }
  /* image addresses become images stored in the board; page links become link cards, filled in afterwards */
  async function placeUrls(imgs, links, w, o = {}) {
    const s = 1 / view.k, n = imgs.length + links.length, boxes = [], got = [];
    let busy = imgs.length ? setTimeout(() => toast(imgs.length > 1 ? `Import de ${imgs.length} images…` : 'Import de l’image…'), 400) : 0;
    for (const m of imgs) {
      const b = await Net.blob(m.src); let im = null;
      if (b && /^image\//.test(b.type)) { try { im = await importImage(b); } catch (e) {} }
      if (im) got.push(im); else links.push({ url: m.link || m.src, pic: /^https?:/i.test(m.src) ? m.src : '', failed: true });
    }
    // an Instagram post or reel: its picture, the post address kept on the image
    for (let i = links.length - 1; i >= 0; i--) {
      const u = typeof links[i] === 'string' ? links[i] : links[i].url;
      if (!isInstaPost(u)) continue;
      if (!busy) busy = setTimeout(() => toast('Import de la publication Instagram…'), 400);
      const b = await postPicture(u); let im = null;
      if (b) { try { im = await importImage(b); } catch (e) {} }
      if (im) { im.href = u; got.push(im); links.splice(i, 1); } else if (typeof links[i] === 'string') links[i] = { url: u, insta: true };
    }
    clearTimeout(busy);
    if (got.length === 1 && o.placeholder && !links.length) { const ph = byId.get(o.placeholder); if (ph) { commit(replace(items, ph, { asset: got[0].id, h: ph.w * got[0].h / got[0].w })); toast('Image placée'); return; } }
    const many = got.length + links.length > 1;
    for (const im of got) { const W = (many ? 260 : Math.min(im.w, 380)) * s; boxes.push({ w: W, h: W * im.h / im.w, make: (x, y, W, H) => Object.assign(mkImage(x, y, W, H, im.id), im.href ? { href: im.href } : {}) }); }
    for (const l of links) {
      const url = typeof l === 'string' ? l : l.url, pic = typeof l === 'string' ? '' : l.pic, W = 300 * clamp(s, 1, 3), H = W / 300 * (pic ? 300 * .75 + 64 : 80);
      boxes.push({ w: W, h: H, make: (x, y, W, H) => Object.assign({ id: uid('l'), k: 'link', x, y, w: W, h: H, url, title: '' }, pic ? { pic } : {}) });
    }
    const pos = gridAt(w, boxes), added = boxes.map((b, i) => b.make(pos[i].x, pos[i].y, b.w, b.h));
    if (!added.length) return;
    commit(items.concat(added)); sel = new Set(added.map(i => i.id)); render(); reveal(unionBox(added));
    const failed = links.filter(l => l && l.failed).length, igFail = links.some(l => l && l.insta);
    toast(igFail ? (Net.native() ? 'Instagram n’a pas donné l’image (publication privée ?) : gardée comme lien' : 'Instagram : l’image se récupère dans l’app Windows, ici c’est un lien') : failed ? (Net.native() ? 'Image introuvable : gardée comme lien' : 'Ce site ne laisse pas copier l’image : gardée comme lien (l’app Windows peut la récupérer)') : n > 1 ? `${added.length} éléments ajoutés` : got.length ? 'Image ajoutée' : 'Lien ajouté');
    for (const it of added) if (it.k === 'link' && !it.pic) unfurl(it.id);
  }
  const isInstaPost = u => isInsta(u) && /\/(p|reel|reels|tv)\/[\w-]+/.test(u);
  /* the picture of an Instagram post: the preview image its page publishes (Open Graph) */
  async function postPicture(u) {
    const ok = b => b && /^image\//.test(b.type) && b.size > 200 ? b : null;
    const m = await Net.meta(u);
    let b = m && m.image ? ok(await Net.blob(m.image)) : null;
    return b;
  }
  /* one item centred on the point, several in masonry columns under it */
  function gridAt(w, boxes) {
    const s = 1 / view.k, gap = 16 * s;
    if (boxes.length === 1) return [{ x: w.x - boxes[0].w / 2, y: w.y - boxes[0].h / 2 }];
    const cols = clamp(Math.round(Math.sqrt(boxes.length * 1.3)), 2, 5), colW = Math.max(...boxes.map(b => b.w)), hs = new Array(cols).fill(0);
    const x0 = w.x - (cols * (colW + gap) - gap) / 2, y0 = w.y - 40 * s;
    return boxes.map(b => { const c = hs.indexOf(Math.min(...hs)), p = { x: x0 + c * (colW + gap) + (colW - b.w) / 2, y: y0 + hs[c] }; hs[c] += b.h + gap; return p; });
  }
  /* link preview: title and picture of the page (Open Graph), kept in the board; an address that turns out to be
     an image becomes an image */
  async function unfurl(id) {
    const doc = D, first = byId.get(id); if (!first) return;
    const url = first.url, ig = isInsta(url);
    const m = await Net.meta(url);
    let im = null, patch = {};
    if (m && m.isImage) { const b = await Net.blob(url); if (b && /^image\//.test(b.type)) { try { im = await importImage(b); } catch (e) {} } }
    if (im) patch = { asImage: true, asset: im.id, h: first.w * im.h / im.w };
    else {
      let pic = m && m.image, b = null;
      if (pic) b = await Net.blob(pic);
      if (b && /^image\//.test(b.type)) { try { const t = await importImage(b, 900); patch.asset = t.id; patch.h = first.w * (clamp(t.h / t.w, .5, 1.25) + 64 / 300); } catch (e) {} }
      if (m && m.title) patch.title = cleanTitle(m.title, ig);
      if (m && m.desc) patch.desc = m.desc.slice(0, 300);
    }
    if (!Object.keys(patch).length) return;
    const apply = arr => arr.map(x => x.id !== id || x.url !== url ? x : patch.asImage ? Object.assign(mkImage(x.x, x.y, x.w, patch.h, patch.asset), { id: x.id }) : Object.assign({}, x, patch, x.title && patch.title ? { title: x.title } : {}));
    if (mounted && D === doc) { const cur = byId.get(id); if (cur && cur.url === url) commit(apply(items), { hist: false }); }
    else if (doc && doc.items) { doc.items = apply(doc.items); touch(doc); }
  }
  function placeholderAt(cx, cy) { for (const el of document.elementsFromPoint(cx, cy)) { const n = el.closest && el.closest('.it.image'); if (n) { const it = byId.get(n.dataset.id); if (it && !Assets.has(it.asset)) return it.id; } } return null; }
  let dropHi = null, mediaDrag = false;
  function onDragOver(e) {
    bindPaintDrag();
    const types = [...(e.dataTransfer.types || [])]; if (types.includes(DRAG_T)) { if (host.contains(e.target)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } return; }
    if (propsEl.contains(e.target)) { e.preventDefault(); e.dataTransfer.dropEffect = types.includes('Files') ? 'copy' : 'none'; const z = $('[data-mdrop]', propsEl); if (z) z.classList.toggle('over', types.includes('Files')); return; }
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    if (!mediaDrag) { let z = $('.dropzone', wrap); if (!z) { z = document.createElement('div'); z.className = 'dropzone'; z.innerHTML = `<div>${icon('upload')}Déposez ici : images, liens, fichiers ou texte</div>`; wrap.append(z); } }
    const ph = placeholderAt(e.clientX, e.clientY);
    if (ph !== dropHi) { if (dropHi && nodes.get(dropHi)) nodes.get(dropHi).classList.remove('over'); dropHi = ph; if (ph) nodes.get(ph).classList.add('over'); }
  }
  function clearDrop() { const z = $('.dropzone', wrap); if (z) z.remove(); if (dropHi && nodes.get(dropHi)) nodes.get(dropHi).classList.remove('over'); dropHi = null; const mz = $('[data-mdrop]', propsEl); if (mz) mz.classList.remove('over'); }
  function onDragLeave(e) { if (!e.relatedTarget || !wrap.contains(e.relatedTarget)) clearDrop(); }
  async function onDrop(e) {
    if ([...(e.dataTransfer.types || [])].includes(DRAG_T)) { e.preventDefault(); clearDrop(); let g = null; try { g = JSON.parse(e.dataTransfer.getData(DRAG_T)); } catch (_) {} if (g && g.c && host.contains(e.target)) dropPaint(g.c, e.clientX, e.clientY); return; }
    e.preventDefault(); const ph = dropHi; clearDrop(); mediaDrag = false;
    if (propsEl.contains(e.target)) { const files = [...(e.dataTransfer.files || [])]; if (files.length) { const n = await addMedia(D.sp, files); if (n.length) { toast(`${n.length} document${n.length > 1 ? 's' : ''} ajouté${n.length > 1 ? 's' : ''} au moodboard`); propSig = ''; renderProps(); } } return; }
    const w = toW(e.clientX, e.clientY); await ingest(e.dataTransfer, w, { placeholder: ph });
  }
  function pickMedia() { const i = $('#fileIn'); i.accept = ''; i.onchange = async () => { const files = [...i.files]; i.value = ''; if (!files.length) return; const n = await addMedia(D.sp, files); if (n.length) { toast(`${n.length} document${n.length > 1 ? 's' : ''} ajouté${n.length > 1 ? 's' : ''} au moodboard`); propSig = ''; renderProps(); } }; i.click(); }
  function centerW() { const r = hostRect(); const right = propsOpen() && r.width > 900 ? 300 : 0; return lastClient && lastClient.x >= r.left && lastClient.x <= r.right - right && lastClient.y >= r.top && lastClient.y <= r.bottom ? toW(lastClient.x, lastClient.y) : toW(r.left + (r.width - right) / 2, r.top + r.height / 2); }
  function copy(cut) {
    const list = selItems(); if (!list.length) return;
    const ids = new Set(list.map(i => i.id)); for (const i of list) if (i.k === 'mind' && !i.parent) mindDesc(i.id, ids);
    const src = items.filter(i => ids.has(i.id) || (i.k === 'conn' && ids.has(i.a.id) && ids.has(i.b.id)));
    clip = { items: JSON.parse(JSON.stringify(src)), text: src.map(itemText).filter(Boolean).join('\n') || ' ' };
    try { navigator.clipboard && navigator.clipboard.writeText(clip.text).catch(() => {}); } catch (e) {}
    if (cut) deleteSel(); else toast(list.length > 1 ? `${list.length} éléments copiés` : 'Copié');
  }
  function pasteClip(at) {
    if (!clip) return false;
    const bb = unionBox(clip.items) || [0, 0, 0, 0], w = at || centerW();
    const pasted = cloneItems(clip.items, w.x - (bb[0] + bb[2]) / 2, w.y - (bb[1] + bb[3]) / 2);
    commit(items.concat(pasted)); sel = new Set(pasted.filter(i => !(i.k === 'mind' && i.parent) && i.k !== 'conn').map(i => i.id)); return true;
  }
  /* the context menu's Coller: images and text from the system clipboard (an image copied in ChatGPT, a link…) */
  async function pasteSystem(w) {
    try {
      const files = [], texts = [];
      for (const ci of await navigator.clipboard.read()) {
        const t = ci.types.find(t => /^image\//.test(t));
        if (t) { const b = await ci.getType(t); files.push(new File([b], 'image.' + (t.split('/')[1] || 'png').replace('jpeg', 'jpg'), { type: t })); }
        else if (ci.types.includes('text/plain')) texts.push(await (await ci.getType('text/plain')).text());
      }
      if (!files.length && !texts.join('').trim()) { toast('Le presse-papiers est vide'); return; }
      await ingest({ files, getData: k => k === 'text/plain' ? texts.join('\n') : '' }, w || centerW());
    } catch (e) { toast('Collez avec Ctrl V'); }
  }
  /* 0.2.78 diagnostic (Miro paste study): what a paste from another app holds is saved next to PLUM.exe, in clipboard-dump\ */
  /* a copy from Miro (05d-miro.js): its elements land centred where the pointer is, selected; pictures as empty frames */
  function pasteMiro(r) {
    const list = r.items; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const it of list) { if (it.k === 'conn') { grow(it.a.x, it.a.y); grow(it.b.x, it.b.y); } else { grow(it.x, it.y); grow(it.x + it.w, it.y + it.h); } }
    const w = centerW(), dx = w.x - (x0 + x1) / 2, dy = w.y - (y0 + y1) / 2;
    for (const it of list) {
      if (it.k === 'conn') { it.a.x += dx; it.a.y += dy; it.b.x += dx; it.b.y += dy; it.pts = (it.pts || []).map(p => [p[0] + dx, p[1] + dy]); }
      else { it.x += dx; it.y += dy; }
    }
    commit(items.concat(list)); sel = new Set(list.filter(i => i.k !== 'conn').map(i => i.id)); schedule();
    const msg = `${list.length} élément${list.length > 1 ? 's' : ''} importé${list.length > 1 ? 's' : ''} de Miro`;
    if (!r.images) { toast(msg); return; }
    if (miroCan() && miroToken()) { toast(msg + ` · ${r.images} image${r.images > 1 ? 's' : ''} en cours de récupération…`); miroFill(); }
    else if (miroCan()) toast(msg + ` · images : connecte Miro pour les récupérer`, { label: 'Connecter Miro', run: () => miroSetup(miroFill) });
    else toast(msg + ` · ${r.images} image${r.images > 1 ? 's' : ''} à déposer dans ${r.images > 1 ? 'leurs cadres' : 'son cadre'}`);
  }
  /* the empty frames that came from Miro get their picture through the user's token (0.2.80) */
  let miroBusy = false;
  async function miroFill() {
    if (miroBusy || !miroCan()) return; const tok = miroToken(); if (!tok) return;
    const todo = items.filter(i => i.k === 'image' && !i.asset && i.miro && i.miro.b && i.miro.i); if (!todo.length) return;
    miroBusy = true; let got = 0, err = null;
    try {
      for (const ph of todo) {
        const r = await notely.miroImage({ board: ph.miro.b, item: ph.miro.i, token: tok }).catch(e => ({ ok: false, error: String(e) }));
        if (!r || !r.ok) { err = r; if (r && r.status === 401) break; continue; }
        try {
          const im = await importImage(new Blob([r.data], { type: r.type }));
          const cur = byId.get(ph.id); if (!cur || cur.asset) continue;
          const patch = { asset: im.id }; delete patch.miro;
          const next = items.map(x => { if (x.id !== cur.id) return x; const o = Object.assign({}, x, patch); delete o.miro; return o; });
          commit(next, { hist: false }); got++;
        } catch (e) { err = { error: 'lecture' }; }
      }
    } finally { miroBusy = false; }
    if (got) toast(`${got} image${got > 1 ? 's' : ''} récupérée${got > 1 ? 's' : ''} depuis Miro`);
    if (err) {
      if (err.status === 401) toast('Miro refuse le jeton (401)', { label: 'Changer le jeton', run: () => miroSetup(miroFill) });
      else if (err.status === 404 || err.status === 403) toast(`Miro ne donne pas ${got ? 'certaines images' : 'les images'} (${err.status}) : le jeton doit venir de l’équipe de ce board, avec boards:read`, { label: 'Jeton', run: () => miroSetup(miroFill) });
      else toast(`Images Miro : échec${err.status ? ' (' + err.status + ')' : err.error ? ' (' + err.error + ')' : ''}`);
    }
  }
  function clipDump(dt) {
    if (!(window.notely && notely.dumpClip)) return;
    try {
      const types = [...(dt.types || [])], data = {};
      for (const t of types) if (t !== 'Files') { try { data[t] = dt.getData(t); } catch (e) {} }
      const files = [...(dt.files || [])].map(f => ({ name: f.name, type: f.type, size: f.size }));
      if (!types.length) return;
      notely.dumpClip({ types, data, files, at: new Date().toISOString() }).then(r => { if (r && r.ok) toast('Presse-papiers enregistré pour l’étude du collage Miro'); }).catch(() => {});
    } catch (e) {}
  }
  async function onPaste(e) {
    if (editing) return;
    const dt = e.clipboardData; if (!dt) return;
    if (S.prefs.clipDump) clipDump(dt);   // the paste study (0.2.78), now off unless asked for
    { const mh = dt.getData('text/html'); if (mh && mh.includes('(miro-data-v1)')) { const r = miroItems(mh); if (r) { e.preventDefault(); pasteMiro(r); return; } } }
    const txt = dt.getData('text/plain'), hasFile = (dt.files && dt.files.length) || [...(dt.items || [])].some(i => i.kind === 'file');
    { const sh = sheetSelOf(); if (sh && txt && !hasFile) { e.preventDefault(); sheetPaste(sh, txt); return; } }
    if (!hasFile && clip && (!txt || txt === clip.text)) { e.preventDefault(); pasteClip(); return; }
    e.preventDefault(); await ingest(dt, centerW());
  }

  /* ---------- keyboard ---------- */
  const TOOL_KEYS = { u: 'frame', v: 'select', h: 'hand', p: 'pen', d: 'pen', e: 'eraser', n: 'note', t: 'text', r: 'shape', o: 'shape', a: 'conn', l: 'line', c: 'todo', g: 'sheet', m: 'mind', k: 'pick', b: 'pen', q: 'lasso' };
  function key(e) {
    if (!mounted || editing) return false;
    const t = e.target; if (t && (t.closest('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]'))) return false;
    const mod = e.ctrlKey || e.metaKey, k = e.key;
    // Alt held alone with a brush: the pipette while it is held (Photoshop)
    if (k === 'Shift' && altPick) { endAltPick(); return false; }
    if ((k === 's' || k === 'S') && !mod && !e.altKey) { e.preventDefault(); if (e.repeat) return true; if (rotMode && !rotHeld) { rotExit(); return true; } rotHeld = true; rotEnter(); rotDraw(); return true; }
    if (rotMode && (k === 'Escape' || k === '0')) { e.preventDefault(); if (k === '0') rotSet(0); else rotExit(); return true; }
    if (k === 'Alt' && !mod && !e.shiftKey && !op && (PENS[tool] || tool === 'eraser')) { e.preventDefault(); altPick = true; setTool('pick'); return true; }
    if (op && op.keep) { if (k === 'Enter') { op.finish(); e.preventDefault(); return true; } if (k === 'Escape') { cancelOp(); e.preventDefault(); return true; } }
    { const sh = sheetSelOf(); if (sh && sheetSelKey(e, sh)) return true; }
    /* layer order: Page Up / Down one step, with Ctrl all the way to the front / back */
    if ((k === 'PageUp' || k === 'PageDown') && sel.size) { e.preventDefault(); zMove(k === 'PageUp' ? (mod ? 'front' : 'fwd') : (mod ? 'back' : 'bwd')); return true; }
    if (k === ' ' && !e.repeat) { spaceDown = true; host.classList.add('t-hand'); e.preventDefault(); return true; }
    if (mod) {
      const lk = k.toLowerCase();
      if (e.code === 'KeyG' || lk === 'g') { e.preventDefault(); e.altKey ? ungroupSel() : groupSel(); return true; }
      if (lk === 'z') { e.shiftKey ? redo() : undo(); e.preventDefault(); return true; }
      if (lk === 'y') { redo(); e.preventDefault(); return true; }
      if (lk === 'a') { sel = new Set(items.filter(i => !(i.k === 'mind' && i.parent) && !i.hid).map(i => i.id)); schedule(); e.preventDefault(); return true; }
      if (lk === 'd') { duplicate(); e.preventDefault(); return true; }
      if (lk === 'l' && e.shiftKey && sel.size) { action(selItems().some(i => i.lock) ? 'unlock' : 'lock'); e.preventDefault(); return true; }
      if (lk === 'c') { if (getSelection().toString()) return false; copy(false); return true; }
      if (lk === 'x') { copy(true); e.preventDefault(); return true; }
      const dg = /^Digit([125])$/.exec(e.code || ''); if (dg && !e.shiftKey && selItems().some(i => i.k === 'uic')) { uiWrap({ 1: 'h', 2: 'v', 5: 'grid' }[dg[1]]); e.preventDefault(); return true; }
      if (k === '0') { zoomTo(1); e.preventDefault(); return true; }
      if (k === '=' || k === '+') { zoomCenter(1.25); e.preventDefault(); return true; }
      if (k === '-') { zoomCenter(.8); e.preventDefault(); return true; }
      const q = sel.size === 1 ? byId.get([...sel][0]) : null, dir = { ArrowUp: 'n', ArrowRight: 'e', ArrowDown: 's', ArrowLeft: 'w' }[k];
      if (dir && LINKABLE(q)) { e.preventDefault(); quickNode(q, dir); return true; }
      return false;
    }
    const one = sel.size === 1 ? byId.get([...sel][0]) : null;
    if (k === 'Escape') { if (tool === 'pick') setTool(penKind); else if (tool !== 'select') setTool('select'); else if (sel.size) { sel.clear(); schedule(); } else if (document.documentElement.hasAttribute('data-focus')) setFocus(false); return true; }
    if (k === 'Delete' || k === 'Backspace') { deleteSel(); e.preventDefault(); return true; }
    if (k === '?' || (e.shiftKey && k === '/')) { helpModal(); return true; }
    if (one && one.k === 'mind') {
      if (k === 'Tab') { e.preventDefault(); mindAdd('child'); return true; }
      if (k === 'Enter') { e.preventDefault(); one.parent ? mindAdd('sibling') : startEdit(one.id); return true; }
      if (k.startsWith('Arrow') && !e.shiftKey) { e.preventDefault(); mindNav(k); return true; }
    }
    if ((k === 'Enter' || k === 'F2') && one && one.k === 'uic') { e.preventDefault(); uiFocusText(one); return true; }
    if ((k === 'Enter' || k === 'F2') && one) { e.preventDefault(); startEdit(one.id); return true; }
    if (k.startsWith('Arrow') && sel.size) { e.preventDefault(); const d = e.shiftKey ? 10 : 1, dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, dy = k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0; const ids = moveSet(); commit(items.map(i => ids.has(i.id) && i.k !== 'conn' ? Object.assign({}, i, { x: i.x + dx, y: i.y + dy }) : i)); return true; }
    if ((k === 'f' || k === 'F') && !mod && !e.altKey) { if (sel.size) fitTo(unionBox(selItems())); else fitAll(); return true; }   // F: frame the selection, or the whole board
    /* D always goes to drawing, even over a selected shape (any other letter starts typing in it) */
    if (one && k.length === 1 && k.toLowerCase() !== 'd' && !e.altKey && ['note', 'shape', 'mind', 'text', 'sheet'].includes(one.k)) { e.preventDefault(); startEdit(one.id, k); return true; }
    if (k === '0' || (e.shiftKey && k === '!')) { fitAll(); return true; }
    if (k === '+' || k === '=') { zoomCenter(1.25); return true; }
    if (k === '-') { zoomCenter(.8); return true; }
    if (/^[1-9]$/.test(k) && !e.altKey) { const pk = (atelierFull() ? PEN_ORDER : LITE_PENS)[+k - 1]; if (pk) { setTool(pk); return true; } }
    const lk = k.toLowerCase();
    if (lk === 'i') { pickFiles(); return true; }
    if (TOOL_KEYS[lk]) { if (lk === 'o') shapeKind = 'ellipse'; if (lk === 'r') shapeKind = 'rect'; setTool(TOOL_KEYS[lk] === 'pen' ? penKind : TOOL_KEYS[lk]); return true; }
    return false;
  }
  /* ---------- 0.3.1: S turns the board (held: while held; tapped: until S again or Échap), around the middle of the view ---------- */
  let rotMode = false, rotHeld = false, rotUsed = false, rotEl = null, rotTap = 0;
  function rotEnter() {
    if (rotMode) return; rotMode = true; rotUsed = false; host.classList.add('t-rot');
    rotEl = document.createElement('div'); rotEl.className = 'rotgz'; wrap.append(rotEl); rotDraw();
  }
  function rotExit() { if (!rotMode) return; rotMode = false; rotHeld = false; host.classList.remove('t-rot'); if (rotEl) rotEl.remove(); rotEl = null; if (op && op.kind === 'rot') op = null; }
  function rotCenter() { const r = hostRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, R: Math.max(45, Math.min(r.width, r.height) * .15) }; }
  function rotDraw() {
    if (!rotEl) return;
    const c = rotCenter(), r = hostRect(), R = c.R, a = (view.r || 0) * Math.PI / 180, cx = c.x - r.left, cy = c.y - r.top;
    let ticks = '';
    for (let d = 0; d < 360; d += 15) { const t = (d - 90) * Math.PI / 180, big = d % 90 === 0, mid = d % 45 === 0, r0 = R - (big ? 8 : mid ? 6 : 3.5); ticks += `<line x1="${(cx + Math.cos(t + a) * r0).toFixed(1)}" y1="${(cy + Math.sin(t + a) * r0).toFixed(1)}" x2="${(cx + Math.cos(t + a) * R).toFixed(1)}" y2="${(cy + Math.sin(t + a) * R).toFixed(1)}" class="${big ? 'big' : mid ? 'mid' : ''}"/>`; }
    const hx = cx + Math.sin(a) * R, hy = cy - Math.cos(a) * R, deg = Math.round(((view.r || 0) + 360) % 360);
    rotEl.innerHTML = `<svg><circle cx="${cx}" cy="${cy}" r="${R}" class="ring"/>${ticks}<line x1="${cx}" y1="${cy - R - 9}" x2="${cx}" y2="${cy - R + 1}" class="north"/><line x1="${cx}" y1="${cy}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" class="arm"/><circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="6" class="knob"/><circle cx="${cx}" cy="${cy}" r="3" class="ctr"/></svg>
      <div class="rotgz-v" style="left:${cx}px;top:${cy + R + 10}px">${deg > 180 ? deg - 360 : deg}°</div>
      <div class="rotgz-h">Rotation du board · glisser pour tourner (Maj : par 15°) · double-clic ou 0 : remettre droit · ${rotHeld ? 'relâcher S pour sortir' : 'S ou Échap pour sortir'}</div>`;
  }
  function rotSet(r) {
    const c = rotCenter(), w0 = toW(c.x, c.y);
    r = ((r % 360) + 540) % 360 - 180; if (Math.abs(r) < .01) r = 0;
    view.r = r === -180 ? 180 : r; const u = unrot(c.x, c.y); view.x = u.x - w0.x * view.k; view.y = u.y - w0.y * view.k; viewChanged(); rotDraw();
  }
  function startRotate(e) {
    grab(e); rotUsed = true;
    const c = rotCenter(), a0 = Math.atan2(e.clientY - c.y, e.clientX - c.x), r0 = view.r || 0; let moved = false;
    op = { id: e.pointerId, kind: 'rot',
      move(ev) { if (ev.pointerId !== this.id) return; if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return; moved = true; let r = r0 + (Math.atan2(ev.clientY - c.y, ev.clientX - c.x) - a0) * 180 / Math.PI;
        if (ev.shiftKey) r = Math.round(r / 15) * 15; else { const st = Math.round(r / 45) * 45; if (Math.abs(r - st) < 3) r = st; }
        rotSet(r); },
      up() { op = null; if (moved) return; const t = performance.now(); if (t - rotTap < 330) { rotSet(0); rotTap = 0; } else rotTap = t; } };
  }
  function keyUp(e) { if ((e.key === 's' || e.key === 'S') && rotHeld) { rotHeld = false; if (rotUsed) rotExit(); else rotDraw(); }
    if (e.key === 'Shift' && altPick) endAltPick();
    if (e.key === ' ') { spaceDown = false; host.classList.toggle('t-hand', tool === 'hand'); } if (e.key === 'Alt') { e.preventDefault(); endAltPick(); } }
  function endAltPick() { if (!altPick) return; altPick = false; if (tool === 'pick') { Studio.hideLoupe(); setTool(pickBack && PENS[pickBack] ? pickBack : pickBack === 'eraser' ? 'eraser' : penKind); } }

  /* ---------- tools and islands ---------- */
  function setTool(t) {
    if (rotMode) rotExit();   // 0.3.2: another tool (D, P, V…) leaves the rotation
    if (PENS[t] && !LITE_PENS.includes(t) && !atelierFull()) t = 'pen';   // the simple drawing module: three quick pens and the alpha brushes
    if (t === 'eraser' && tool !== 'pick') eraseAll = true;   // E and the tool bar: everything; the drawing bar's eraser sets it back to strokes only
    if (editing) finishEdit();
    if (op && op.keep) cancelOp();
    attachHi = null;
    const newPick = t === 'pick' && tool !== 'pick';
    if (newPick) pickBack = tool;
    if (!PENS[t] && t !== 'eraser' && t !== 'pick' && t !== 'lasso') inkSess = null;   // leaving the drawing tools ends the drawing session
    tool = t; if (PENS[t]) penKind = t; if (ALPHA_PENS.includes(t)) S.prefs.lastAlpha = t;
    /* drawing never acts on a selection: a shape left selected would take the colour and size changes */
    if ((PENS[t] || t === 'eraser') && sel.size) sel.clear();
    if (!['select', 'hand', 'pick'].includes(t)) lastTool = t;
    host.className = 'bhost bg-' + (D.bg || 'dots') + ' t-' + (PENS[t] ? 'ink' : t) + (IPAD ? ' gpu' : '') + (host.classList.contains('vmove') ? ' vmove' : '');
    const was = wrap.classList.contains('drawing'); wrap.classList.toggle('drawing', drawingTool()); wrap.classList.toggle('lite', !atelierFull());
    if (t !== 'pick') Studio.hideLoupe();
    else if (newPick && touchUI() && !altPick) tapFlash('Touchez le board pour prendre une couleur');
    refreshTools(); eraserAt = null; propSig = ''; schedule(); Studio.sync();
    if (was !== drawingTool()) layoutChanged();
  }
  const drawingTool = () => !!(PENS[tool] || tool === 'eraser' || tool === 'pick');
  const TOOLS = [['select', 'cursor', 'Sélection', 'V'], ['hand', 'hand', 'Main', 'H'], '|', ['shape', 'rect', 'Forme', 'R'], ['conn', 'conn', 'Flèche', 'A'], ['line', 'line', 'Ligne', 'L'], ['pen', 'pen', 'Dessin', 'D'], ['eraser', 'eraser', 'Gomme', 'E'], '|', ['text', 'text', 'Texte', 'T'], ['note', 'sticky', 'Post-it', 'N'], ['todo', 'todo', 'Liste à faire', 'C'], ['sheet', 'sheet', 'Tableur', 'G'], ['mind', 'mind', 'Mind map', 'M'], ['frame', 'frame', 'Cadre : un conteneur qui garde ses éléments', 'U'], ['upload', 'image', 'Image ou fichier', 'I'], '|', ['more', 'dots', 'Plus : tâches, liens', '']];
  function refreshTools() {
    syncVsz();
    toolsEl.innerHTML = TOOLS.map(d => d === '|' ? '<span class="vs"></span>' : (() => {
      const [id, ic, title, k] = d, on = id === 'pen' ? !!PENS[tool] : tool === id;
      const ico = id === 'pen' ? PENS[penKind].icon : id === 'shape' ? (shapeKind === 'starsh' ? 'starsh' : shapeKind) : ic;
      const dot = id === 'pen' ? `<span class="cdot" style="background:${penPref(penKind).c}"></span>` : id === 'note' ? `<span class="cdot" style="background:${noteColor}"></span>` : '';
      return `<button class="tl" data-tool="${id}" title="${title}${k ? ` (${k})` : ''}" aria-label="${title}" aria-pressed="${on}">${icon(ico)}${dot}${k ? `<kbd>${k}</kbd>` : ''}</button>`;
    })()).join('');
    renderOpts(); Studio.wheel();
  }
  /* the second bar: the options of the tool chosen in the first one, for what it is about to draw (ctxHTML with no selection) */
  function renderOpts() {
    if (!optsEl) return;
    const h = ctxHTML([]);
    if (optsEl._h !== h) { optsEl._h = h; optsEl.innerHTML = h ? OGRIP + h : ''; }
    optsEl.hidden = !h;
    if (h) placeOpts();
  }
  /* the tool options bar has its own grip too (0.2.35): S.prefs.optsOff = { x, y } moves it from its usual place
     (under the tools, so it still follows the dock); double-click the grip to put it back */
  const OGRIP = '<button class="ogrip" title="Glisser pour déplacer cette barre · double-clic pour la remettre en place" aria-label="Déplacer la barre d’options"></button>';
  function placeOpts() {
    if (!optsEl) return; const o = S.prefs.optsOff;
    optsEl.classList.toggle('moved', !!o);
    optsEl.style.translate = '';
    if (!o || optsEl.hidden) return;
    const r = optsEl.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    const x = clamp(o.x, wr.left + 8 - r.left, Math.max(wr.left + 8 - r.left, wr.right - 8 - r.right)), y = clamp(o.y, wr.top + 8 - r.top, Math.max(wr.top + 8 - r.top, wr.bottom - 8 - r.bottom));
    optsEl.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
  }
  function optsClick(e) { ctxClick(e); }
  /* the dock floats where it was left (S.prefs.dock = { x, y } in px from the board's top left); double-click the grip to put it back */
  function placeDock() {
    if (!dockEl) return; const p = S.prefs.dock;
    dockEl.classList.toggle('moved', !!p);
    if (!p) { dockEl.style.left = dockEl.style.top = ''; return; }
    const W = wrap.clientWidth, H = wrap.clientHeight, w = dockEl.offsetWidth || 300, hh = dockEl.offsetHeight || 60;
    dockEl.style.left = clamp(p.x, 8, Math.max(8, W - w - 8)) + 'px'; dockEl.style.top = clamp(p.y, 8, Math.max(8, H - hh - 8)) + 'px';
  }
  function bindDock() {
    const grip = $('.tgrip', dockEl);
    grip.addEventListener('pointerdown', e => {
      e.preventDefault(); grip.setPointerCapture(e.pointerId);
      const r = dockEl.getBoundingClientRect(), wr = wrap.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      const mv = ev => { S.prefs.dock = { x: Math.round(clamp(ev.clientX - wr.left - dx, 8, wr.width - r.width - 8)), y: Math.round(clamp(ev.clientY - wr.top - dy, 8, wr.height - r.height - 8)) }; placeDock(); placeOpts(); };
      const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); dockEl.classList.remove('dragging'); save(); };
      dockEl.classList.add('dragging'); grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
    });
    grip.addEventListener('dblclick', () => { delete S.prefs.dock; save(); placeDock(); placeOpts(); });
    optsEl.addEventListener('pointerdown', e => {
      const g = e.target.closest('.ogrip');
      if (g) {
        e.preventDefault(); e.stopPropagation(); g.setPointerCapture(e.pointerId);
        const o0 = S.prefs.optsOff || { x: 0, y: 0 }, x0 = e.clientX, y0 = e.clientY;
        const mv = ev => { S.prefs.optsOff = { x: Math.round(o0.x + ev.clientX - x0), y: Math.round(o0.y + ev.clientY - y0) }; placeOpts(); };
        const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); optsEl.classList.remove('dragging'); save(); };
        optsEl.classList.add('dragging'); g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
        return;
      }
      if (!e.target.closest('input')) e.preventDefault();
    });
    optsEl.addEventListener('dblclick', e => { if (e.target.closest('.ogrip')) { delete S.prefs.optsOff; save(); placeOpts(); } });
    optsEl.addEventListener('click', optsClick);
    optsEl.addEventListener('input', e => { const r = e.target.closest('[data-psize]'); if (!r) return; const k = penKind; if (!S.prefs.pens[k]) S.prefs.pens[k] = {}; const sz = sizeOf(k, +r.value); S.prefs.pens[k].s = sz; const lab = r.parentElement, dot = $('.qdot', lab), d = clamp(sz, 2, 22); $('b', lab).textContent = sizeText(sz); dot.style.width = dot.style.height = d + 'px'; });
    optsEl.addEventListener('change', e => { if (!e.target.closest('[data-psize]')) return; save(); refreshTools(); Studio.sync(); });
  }
  function pickFiles() { const i = $('#fileIn'); i.accept = ''; i.onchange = async () => { const files = [...i.files]; i.value = ''; if (files.length) await ingest({ files, getData: () => '' }, centerW()); }; i.click(); }
  function moreMenu(btn) {
    openPop(btn, [{ head: 'Insérer' }, { label: 'Tâche de l’espace', icon: 'tasks', run: () => insertTask() }, { label: 'Lien vers une note ou un board', icon: 'note', run: () => insertDocRef(btn) }, { label: 'Lien web…', icon: 'link', run: () => insertLink(btn) }, { label: 'Planning (iCal, PRONOTE)…', icon: 'cal', run: () => planModal(null) },
      '-', { head: 'Fond' }, ...[['dots', 'Points'], ['grid', 'Quadrillage'], ['plain', 'Uni']].map(([b, l]) => ({ label: l, small: (D.bg || 'dots') === b ? 'actuel' : '', run: () => setProp('bg', b) })),
      '-', { label: 'Raccourcis clavier', icon: 'help', small: '?', run: helpModal }]);
  }
  function insertTask() { const c = centerW(), t = newTask({ t: 'Nouvelle tâche', sp: D.sp }); const it = { id: uid('t'), k: 'task', x: c.x - 140, y: c.y - 28, w: 280, h: 56, task: t.id }; commit(items.concat(it)); sel = new Set([it.id]); renderSide(); toast('Tâche ajoutée à ' + ((spaceById(D.sp) || {}).name || 'la liste'), { label: 'La renommer', run: () => { go('tasks'); setTimeout(() => { const row = $(`[data-task="${t.id}"]`); if (row) toggleTaskEdit(row, t, () => go('tasks')); }, 30); } }); }
  function insertDocRef(btn) { const list = liveDocs().filter(d => d.id !== D.id).sort((a, b) => b.updated - a.updated); openPop(btn, list.length ? list.slice(0, 14).map(d => ({ label: d.title, icon: d.type === 'board' ? 'board' : 'note', run: () => { const c = centerW(); const it = { id: uid('d'), k: 'doc', x: c.x - 110, y: c.y - 90, w: 220, h: 180, doc: d.id }; commit(items.concat(it)); sel = new Set([it.id]); } })) : [{ label: 'Aucun autre document', run: () => {} }]); }
  function insertLink(btn) { const p = openPop(btn, `<div style="display:flex;gap:6px;padding:4px"><input id="lnIn" placeholder="https://…" style="height:34px;width:240px;border-radius:8px;border:1px solid var(--line-2);background:var(--raise);padding:0 10px;outline:0"><button class="btn sm pri" id="lnOk">Ajouter</button></div>`); const i = $('#lnIn', p); i.focus(); const ok = () => { let u = i.value.trim(); if (!u) return; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; closePop(); ingest({ getData: k => k === 'text/plain' ? u : '', files: [] }, centerW()); }; $('#lnOk', p).onclick = ok; i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ok(); }; }
  function layoutChanged() { if (mounted) setTimeout(() => { ink.resize(); renderOverlay(); }, 30); }

  /* ---------- mount ---------- */
  function mount(container, doc) {
    inkSess = null;
    if (!noteColor || noteColor === SCHEME_BASE[14]) noteColor = schemeHex(SCHEME_DEF.note);
    D = doc; items = (doc.items || []).slice(); reindex(); hist = []; fut = []; sel = new Set(); editing = null; editSub = null; op = null; nodes.clear(); fitCache.clear(); propSig = ''; qSig = ''; propsTab = 'style';
    for (const it of items) if (it.k === 'todo') syncTodoBox(it);
    const open = S.prefs.props == null ? innerWidth >= 1100 : !!S.prefs.props;
    container.innerHTML = `<div class="bwrap${open ? ' props-open' : ''}" style="position:absolute;inset:0">
      <div class="bhost bg-${doc.bg || 'dots'}" tabindex="-1" aria-label="Board ${esc(doc.title)}"><div class="bstage"><div class="bgrid" hidden></div><div class="world"><div class="layer"></div><svg class="edges"></svg><div class="layer"></div><svg class="edges"></svg><div class="layer"></div></div><div class="ovl"></div></div><canvas class="blive"></canvas><div class="measure it"></div></div>
      <div class="tdock"><div class="trow"><button class="tgrip" title="Glisser pour déplacer les barres · double-clic pour les remettre en place" aria-label="Déplacer les barres d’outils"></button><nav class="isl tools" aria-label="Outils"></nav></div><div class="isl topts" role="toolbar" aria-label="Options de l’outil" hidden></div></div>
      <div class="isl tr"><button class="tl" data-a="props" title="Attributs et moodboard" aria-label="Panneau" aria-pressed="${open}">${icon('sliders')}<span>Attributs</span></button></div>
      <div class="qbar" hidden></div>
      <aside class="props"${open ? '' : ' hidden'} aria-label="Propriétés"><div class="phead"><button class="ptab" data-tab="style">Attributs</button><button class="pclose" data-a="close" aria-label="Fermer">${icon('x', 'sm')}</button></div><div class="pbody"></div></aside>
      <div class="isl bl zoom"><button class="tl" data-a="zout" title="Dézoomer (−)" aria-label="Dézoomer">${icon('zout')}</button><button class="zv" data-a="z100" title="Revenir à 100 %">100 %</button><button class="tl" data-a="zin" title="Zoomer (+)" aria-label="Zoomer">${icon('zin')}</button></div>
      <div class="isl bl undo"><button class="tl" data-a="undo" title="Annuler (Ctrl Z)" aria-label="Annuler">${icon('undo')}</button><button class="tl" data-a="redo" title="Rétablir (Ctrl Y)" aria-label="Rétablir">${icon('redo')}</button></div>
      <div class="isl br"><button class="tl" data-a="bstyle" title="Style du board" aria-label="Style du board">${icon('styles')}</button><button class="tl snapb" data-a="snap" title="Alignement auto (aimant) : activé" aria-label="Alignement automatique" aria-pressed="true">${icon('magnet')}</button><button class="tl" data-a="fit" title="Tout voir (F ou 0)" aria-label="Tout voir">${icon('fit')}</button><button class="tl" data-a="help" title="Raccourcis (?)" aria-label="Aide">${icon('help')}</button></div></div>`;
    wrap = container.firstElementChild; host = $('.bhost', wrap); world = $('.world', host); host.classList.toggle('gpu', IPAD);
    [framesL, edges, itemsL, edgesTop, labelsL] = world.children; ovl = $('.ovl', host); liveCv = $('.blive', host); stage = $('.bstage', host); bgrid = $('.bgrid', host); meas = $('.measure', host);
    // mind maps are laid out from the measured size of their words: again once the fonts are in
    setTimeout(() => { if (mounted && D === doc) planAutoRefresh(); }, 1200);
    const lay = () => { if (!mounted || D !== doc || !hasMind(items)) return; measCache.clear(); items = relayout(items); reindex(); D.items = items; schedule(); };
    toolsEl = $('.tools', wrap); optsEl = $('.topts', wrap); dockEl = $('.tdock', wrap); trEl = $('.tr', wrap); propsEl = $('.props', wrap); qbarEl = $('.qbar', wrap); zoomEl = $('.isl.zoom', wrap); undoEl = $('.isl.undo', wrap); brEl = $('.isl.br', wrap);
    /* the live stroke's canvas is not in the turned stage: a turned full-screen layer was slow to draw on (iPad) */
    ink = new InkCapture(liveCv, { toLocal: (x, y) => toW(x, y), xf: () => ({ k: view.k, ox: view.x, oy: view.y, r: view.r, W: host.clientWidth / 2, H: host.clientHeight / 2 }) });
    mounted = true; bindPaintDrag();
    lay(); if (document.fonts) document.fonts.ready.then(lay);
    Studio.mount(wrap, { drawing: drawingTool, tool: () => tool, pen: () => penKind, setTool, space: () => D && D.sp,
      color: () => penPref(penKind).c,
      setColor(c, final) { S.prefs.pens[penKind].c = c; save(); const d = $('[data-tool="pen"] .cdot', toolsEl); if (d) d.style.background = c; if (final) refreshTools(); },
      changed(partial) { propSig = ''; refreshTools(); if (!partial) { Studio.sync(); renderProps(); } } });
    mountMods();
    // « Récupérer depuis Miro » on an empty frame (0.2.80)
    host.addEventListener('pointerdown', e => { const dop = e.target.closest && e.target.closest('[data-diropen]'); if (dop && e.button === 0) { const n = dop.closest('[data-id]'), it = n && byId.get(n.dataset.id); if (it) { e.stopPropagation(); e.preventDefault(); Mood.openFolder(it); } } }, true);
    host.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.ph-miro')) { e.stopPropagation(); e.preventDefault(); if (miroToken()) { toast('Récupération des images Miro…'); miroFill(); } else miroSetup(miroFill); } }, true);
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('mousedown', e => { if (fxPicking) e.preventDefault(); });
    host.addEventListener('dblclick', onDbl);
    host.addEventListener('wheel', onWheel, { passive: false });
    host.addEventListener('contextmenu', onContext);
    wrap.addEventListener('dragover', onDragOver); host.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') lastClient = { x: e.clientX, y: e.clientY }; }, { passive: true }); wrap.addEventListener('dragleave', onDragLeave); wrap.addEventListener('drop', onDrop);
    host.addEventListener('pointerleave', () => { if (eraserAt) { eraserAt = null; renderOverlay(); } Studio.hideLoupe(); });
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onCancel);
    toolsEl.onclick = e => { const b = e.target.closest('[data-tool]'); if (!b || dragClick) return; const id = b.dataset.tool;
      if (id === 'upload') return pickFiles(); if (id === 'more') return moreMenu(b);
      if (id === 'pen') { if (PENS[tool]) { setProps(true); propsTab = 'style'; renderProps(true); return; } return setTool(penKind); }
      if (id === 'shape' && tool === 'shape') { const p = openPop(b, `<div class="shapes-pop">${Object.entries(SHAPES).map(([k, l]) => `<button class="db" data-sh="${k}" title="${l}" aria-pressed="${k === shapeKind}">${icon(k)}</button>`).join('')}</div>`, { focus: false }); p.onclick = ev => { const s = ev.target.closest('[data-sh]'); if (s) { shapeKind = s.dataset.sh; closePop(); refreshTools(); propSig = ''; renderProps(); } }; return; }
      if (id === 'note' && tool === 'note') { const p = openPop(b, `<div class="palette">${themeColors('note', NOTE_COLORS).map(c => `<button class="sw" data-col="${c}" style="background:${c}" aria-pressed="${c === noteColor}"></button>`).join('')}</div>`, { focus: false }); p.onclick = ev => { const s = ev.target.closest('[data-col]'); if (s) { noteColor = s.dataset.col; closePop(); refreshTools(); propSig = ''; renderProps(); } }; return; }
      setTool(id); };
    toolsEl.addEventListener('contextmenu', e => { const b = e.target.closest('[data-tool="shape"],[data-tool="note"],[data-tool="pen"]'); if (b) { e.preventDefault(); setTool(b.dataset.tool === 'pen' ? penKind : b.dataset.tool); b.click(); } });
    toolsEl.addEventListener('pointerdown', e => e.preventDefault());
    toolsEl.addEventListener('pointerdown', toolDragStart);
    toolsEl.addEventListener('dragstart', e => e.preventDefault());   // only our own drag: a native one would drop the button's text on the board
    toolsEl.addEventListener('mousedown', e => e.preventDefault());
    bindDock();
    trEl.onclick = e => { if (!e.target.closest('[data-a="props"]')) return; if (drawingTool() && atelierFull()) { Studio.toggleCard('brush'); return; } setProps(!propsOpen()); };
    propsEl.addEventListener('click', propsClick);
    propsEl.addEventListener('input', propsInput); propsEl.addEventListener('change', propsInput);
    propsEl.addEventListener('keydown', e => e.stopPropagation());
    propsEl.addEventListener('dragstart', e => { const t = e.target.closest('[data-media]'); if (!t) return; const m = spaceMedia(D.sp)[+t.dataset.media]; if (!m) return; mediaDrag = true; e.dataTransfer.setData('application/x-notely', JSON.stringify(m)); e.dataTransfer.setData('text/plain', m.name || m.title || m.url || ''); e.dataTransfer.effectAllowed = 'copy'; });
    propsEl.addEventListener('dragend', () => { mediaDrag = false; clearDrop(); });
    propsEl.addEventListener('contextmenu', e => { const t = e.target.closest('[data-media]'); if (!t) return; e.preventDefault(); const m = spaceMedia(D.sp)[+t.dataset.media], sp = spaceById(D.sp); if (!m) return; openPop({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, [{ label: 'Placer sur le board', icon: 'board', run: () => placeMedia([m]) }, ...(sp && (sp.media || []).includes(m) ? [{ label: 'Retirer du moodboard', icon: 'trash', danger: true, run: () => { sp.media = sp.media.filter(x => x !== m); save(); propSig = ''; renderProps(); } }] : [])]); });
    qbarEl.addEventListener('pointerdown', e => e.preventDefault());
    bindPress(qbarEl); bindPress(optsEl);
    qbarEl.addEventListener('pointerdown', e => {
      const g = e.target.closest('.qgrip'); if (!g) return; e.stopPropagation();
      const r = qbarEl.getBoundingClientRect(), wr = wrap.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, x0 = e.clientX, y0 = e.clientY; let moved = false;
      const mv = ev => { if (ev.pointerId !== e.pointerId) return; if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return; moved = true; qbarEl.classList.add('dragging'); qPin = { x: Math.round(ev.clientX - wr.left - dx), y: Math.round(ev.clientY - wr.top - dy) }; renderQuick(selItems(), false); };
      const up = ev => { if (ev.pointerId !== e.pointerId) return; removeEventListener('pointermove', mv, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); qbarEl.classList.remove('dragging');
        if (!moved) { qPin = null; renderQuick(selItems(), false); } };
      addEventListener('pointermove', mv, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
    });
    qbarEl.onclick = ctxClick;
    undoEl.onclick = e => { const b = e.target.closest('[data-a]'); if (b) (b.dataset.a === 'undo' ? undo : redo)(); };
    zoomEl.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; if (a === 'zin') zoomCenter(1.25); if (a === 'zout') zoomCenter(.8); if (a === 'z100') zoomTo(1); };
    brEl.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'fit') fitAll(); if (b.dataset.a === 'help') helpModal(); if (b.dataset.a === 'bstyle') boardStylePop(b); if (b.dataset.a === 'snap') { S.prefs.snap = S.prefs.snap === false; save(); syncSnap(); toast(S.prefs.snap ? 'Alignement automatique activé' : 'Alignement automatique coupé (Alt en glissant fait pareil)'); } };
    syncSnap();
    ro = new ResizeObserver(() => { if (mounted) { ink.resize(); renderOverlay(); placeDock(); placeOpts(); } }); ro.observe(host);
    tool = 'select'; setTool('select');
    items = uiLayout(relayout(items)); reindex(); D.items = items;
    if (document.fonts && items.some(i => i.k === 'uic')) document.fonts.ready.then(() => { if (!mounted || D !== doc) return; ukMeasured.clear(); items = uiLayout(items); reindex(); D.items = items; schedule(); });
    render();
    view.r = 0; uzNow = uz(); if (doc.view && isFinite(doc.view.k)) { const z = doc.view.z ? uzNow : 1; view.x = doc.view.x / z; view.y = doc.view.y / z; view.k = clamp(doc.view.k / z, MINK, MAXK); view.r = +doc.view.r || 0; viewChanged(); } else fitAll();
    updateUndo();
    if (!S.prefs.boardHint) { S.prefs.boardHint = 1; save(); toolHint('Double-clic : post-it · D : dessin · A : flèche · glissez images et fichiers ici'); }
    setTimeout(() => { if (mounted) host.focus({ preventScroll: true }); }, 0);
  }
  let ro = null;
  function unmount() {
    if (!mounted) return;
    if (editing) finishEdit();
    if (op && op.keep) cancelOp();
    closeMarking(); uiLibClose(); uiInspClose(); uiIns = null; uiFloat = null; mounted = false; cancelAnimationFrame(raf); raf = 0; Studio.unmount(); shot = null;
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onCancel);
    removeEventListener('pointerup', releaseMods, true); removeEventListener('pointercancel', releaseMods, true);
    if (modsEl) { modsEl.remove(); modsEl = null; } for (const k in vmods) vmods[k] = 0;
    if (ro) ro.disconnect();
    if (D) { D.view = viewOut(); D.items = items; save(); }
    nodes.clear(); D = null; op = null;
  }
  /* the browser menu never shows on the board: the right button opens the marking menu (onDown); the menu key opens it at the pointer */
  function onContext(e) {
    e.preventDefault();
    if (mm || (op && op.keep) || ['mouse', 'pen', 'touch'].includes(e.pointerType)) return;
    const r = hostRect(), c = lastClient || { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    openMarking({ clientX: c.x, clientY: c.y, pointerId: -1 }, sel.size ? [...sel][0] : null, true);
  }

  /* ---------- drag a tool from the dock onto the board: the item lands where it is let go ---------- */
  const DRAG_TOOLS = { shape: 1, note: 1, text: 1, todo: 1, frame: 1, sheet: 1 };
  let dragClick = false;
  /* what will land, at its real size on screen */
  function dragGhost(kind) {
    const k = view.k, s = clamp(1 / k, .5, 4) * k;
    if (kind === 'shape') { const W = 180 * s, H = (shapeKind === 'pill' ? 70 : 120) * s, r = shapeKind === 'ellipse' ? '50%' : shapeKind === 'round' || shapeKind === 'pill' ? Math.min(W, H) / 2 + 'px' : '6px'; return { w: W, h: H, html: `<i style="border-radius:${r}">${icon(shapeKind === 'starsh' ? 'starsh' : shapeKind)}</i>` }; }
    if (kind === 'note') return { w: 220 * s, h: 220 * s, html: `<i style="background:${noteColor}"></i>` };
    if (kind === 'todo') return { w: 290 * s, h: 110 * s, html: `<i><b>À faire</b><u></u><u></u></i>` };
    if (kind === 'frame') return { w: 480 * k, h: 320 * k, html: `<i><b>Cadre</b></i>` };
    if (kind === 'sheet') { const g = mkSheet(0, 0, { fs: Math.round(14 * clamp(1 / k, .5, 4)) }); return { w: g.w * k, h: g.h * k, html: `<i class="sgh"><b>Tableau</b></i>` }; }
    return { w: 120 * s, h: 40 * s, html: `<i><b>Texte</b></i>` };
  }
  function toolDragStart(e) {
    const b = e.target.closest('[data-tool]'); if (!b || !DRAG_TOOLS[b.dataset.tool] || e.button !== 0) return;
    const kind = b.dataset.tool, x0 = e.clientX, y0 = e.clientY, pid = e.pointerId;
    let gh = null;
    const over = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY); return !!el && host.contains(el); };
    const move = ev => {
      if (ev.pointerId !== pid) return;
      if (!gh) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 7) return;
        const g = dragGhost(kind); gh = document.createElement('div'); gh.className = 'tdrag k-' + kind;
        gh.innerHTML = `<span class="tdi">${b.innerHTML}</span><span class="tdp" style="width:${g.w}px;height:${g.h}px">${g.html}</span>`;
        document.body.append(gh); wrap.classList.add('tdragging');
      }
      gh.style.transform = `translate(${ev.clientX}px,${ev.clientY}px)`; gh.classList.toggle('on', over(ev));
    };
    const end = ev => {
      if (ev.pointerId !== pid) return;
      removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
      if (!gh) return;
      const drop = ev.type === 'pointerup' && over(ev);
      gh.remove(); gh = null; wrap.classList.remove('tdragging');
      dragClick = true; setTimeout(() => { dragClick = false; }, 0);
      if (drop) dropTool(kind, toW(ev.clientX, ev.clientY));
    };
    addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
  }
  function dropTool(kind, w) {
    if (kind === 'note' || kind === 'text' || kind === 'todo' || kind === 'sheet') { createAt(kind, w); return; }
    const s = clamp(1 / view.k, .5, 4);
    if (kind === 'frame') { const it = mkFrame(w.x - 240, w.y - 160, 480, 320, 'Cadre'); commit([it].concat(items)); sel = new Set([it.id]); setTool('select'); render(); startEdit(it.id); return; }
    const W = 180 * s, H = (shapeKind === 'pill' ? 70 : 120) * s, it = mkShape(w.x - W / 2, w.y - H / 2, W, H, shapeKind, { fs: Math.round(26 * s) });
    commit(items.concat(it)); sel = new Set([it.id]); setTool('select'); render();
  }

  /* ---------- marking menu, as in WZX Engine (Maya): hold the right button (or press and hold a finger), flick toward an item and let go.
     Level 1 = the tools (the first one is the last tool used, with its option) or, on an item, its actions.
     An item marked ▸ has a level 2 (its options): keep going past it, or rest on it, and the options open around the pointer.
     A quick flick does the item without waiting for the menu, which then shows that item alone for a moment.
     A plain right click leaves the menu open: click an item, or anywhere else to close it. ---------- */
  const MM_DELAY = 200, MM_FLASH = 150, MM_R = 92, MM_DEAD = 22, MM_HOLD = 450, MM_SUB = 280;
  let mm = null, lastTool = null;
  const mmDirOf = (dx, dy) => (Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) + 8) % 8;   // 0 = up, clockwise
  const around = list => list.filter(Boolean).slice(0, 8).map((it, i) => Object.assign(it, { dir: i }));
  const ROUTES = { curve: 'Courbe', straight: 'Droit', elbow: 'Coudé' }, FONTS = [[HAND, 'Manuscrite'], [SANS, 'Normale'], [MONO, 'Code']];
  const NOTE_NAMES = ['Jaune', 'Pêche', 'Rose', 'Lavande', 'Bleu', 'Vert', 'Blanc', 'Gris'];
  function toolLabel(t) {
    if (t === 'shape') return SHAPES[shapeKind] || 'Forme';
    if (PENS[t]) return PENS[t].name;
    if (t === 'conn') return 'Flèche ' + (ROUTES[BD().route || 'curve'] || '').toLowerCase();
    return { text: 'Texte', note: 'Post-it', todo: 'Liste à faire', sheet: 'Tableur', frame: 'Cadre', uiz: 'Zone UI Design', line: 'Ligne', eraser: 'Gomme', mind: 'Mind map' }[t] || t;
  }
  /* new items take the board defaults: an option chosen here becomes that default, then the tool is picked */
  const pickOpt = (t, prop, v) => () => { if (prop) setProp(prop, v); setTool(t); };
  function mmToolItems(w) {
    const canPaste = clip || (navigator.clipboard && navigator.clipboard.read);
    return around([
      lastTool ? { label: '↺ ' + toolLabel(lastTool), run: () => setTool(lastTool === 'pen' ? penKind : lastTool) } : { label: 'Main', run: () => setTool('hand') },
      { label: 'Texte', run: () => setTool('text'), sub: () => around(FONTS.map(([f, l]) => ({ label: l, on: (BD().font || HAND) === f, font: f, run: pickOpt('text', 'font', f) }))) },
      { label: SHAPES[shapeKind] || 'Forme', run: () => setTool('shape'), sub: () => around(['rect', 'round', 'ellipse', 'diamond', 'tri', 'hex', 'starsh', 'cloud'].map(k => ({ label: SHAPES[k], on: shapeKind === k, run: () => { shapeKind = k; setTool('shape'); } }))) },
      { label: 'Post-it', sw: noteColor, run: () => setTool('note'), sub: () => around(themeColors('note', NOTE_COLORS).map((c, i) => ({ label: SCHEME_NAMES[SCHEME_SETS.note[i] - 1] || c, sw: c, on: c === noteColor, run: () => { noteColor = c; setTool('note'); } }))) },
      { label: PENS[penKind].name, run: () => setTool(penKind), sub: () => around((atelierFull() ? PEN_ORDER : LITE_PENS).filter(k => PENS[k]).slice(0, 8).map(k => ({ label: PENS[k].name, on: k === penKind, run: () => setTool(k) }))) },
      { label: 'Flèche', run: () => setTool('conn'), sub: () => around([...Object.entries(ROUTES).map(([k, l]) => ({ label: l, on: tool === 'conn' && (BD().route || 'curve') === k, run: pickOpt('conn', 'route', k) })), { label: 'Ligne', on: tool === 'line', run: () => setTool('line') }]) },
      { label: 'Sélection', run: () => setTool('select') },
      { label: 'Plus', run: null, sub: () => around([
        { label: 'Liste à faire', run: () => setTool('todo') }, { label: 'Tableur', run: () => setTool('sheet') }, { label: 'Cadre', run: () => setTool('frame') }, { label: 'Gomme', run: () => setTool('eraser') }, { label: 'Main', run: () => setTool('hand') },
        { label: 'Image ou fichier…', run: pickFiles }, canPaste ? { label: 'Coller ici', run: () => clip ? pasteClip(w) : pasteSystem(w) } : null, { label: 'Tout voir', run: fitAll }]) }
    ]);
  }
  /* on an item, level 1 is that item's own options (text: B, I, size…; frame: title…); the rest sits in Plus ▸ */
  function mmItemItems(hit) {
    const list = selItems(), one = list.length === 1 ? list[0] : null, all = k => list.length && list.every(i => i.k === k);
    const sized = list.find(i => FS_TABLE[i.k]), f0 = (one && one.font) || (list.find(i => i.font) || {}).font || HAND;
    const colors = list.every(i => i.k === 'note' || i.k === 'todo') ? ['fc', themeColors('note', NOTE_COLORS)] : list.some(i => propPatch(i, 'sc', '#000')) ? ['sc', themeColors('stroke', STROKE_COLORS)] : null;
    const sizeIt = sized ? { label: 'Taille', run: null, sub: () => around(['S', 'M', 'L', 'XL'].map((l, i) => ({ label: l, on: fsLevel(sized) === i, run: () => setProp('fs', i) }))) } : null;
    const fontIt = list.some(i => propPatch(i, 'font', HAND)) ? { label: 'Police', run: null, sub: () => around(FONTS.map(([f, l]) => ({ label: l, on: f0 === f, font: f, run: () => setProp('font', f) }))) } : null;
    const colorIt = colors ? { label: 'Couleur', run: null, sub: () => around(colors[1].map((c, i) => ({ label: (colors[0] === 'fc' ? NOTE_NAMES : ['Noir', 'Rouge', 'Vert', 'Bleu', 'Orange', 'Violet', 'Gris', 'Blanc'])[i] || 'Couleur', sw: c, on: one && propValue(one, colors[0]) === c, run: () => setProp(colors[0], c) }))) } : null;
    const alignIt = list.some(i => propPatch(i, 'al', 'left')) ? { label: 'Alignement', run: null, sub: () => around([['left', 'À gauche'], ['center', 'Centré'], ['right', 'À droite']].map(([v, l]) => ({ label: l, on: (one ? one.al || 'left' : '') === v, run: () => setProp('al', v) }))) } : null;
    const editIt = one && EDITABLE.includes(one.k) ? { label: one.k === 'frame' ? 'Renommer' : 'Modifier', run: () => startEdit(one.id) } : null;
    const hide = () => { const ids = new Set(sel); commit(items.map(i => ids.has(i.id) ? Object.assign({}, i, { hid: true }) : i)); sel.clear(); };
    const more = { label: 'Plus', run: null, sub: () => around([
      { label: 'Premier plan', run: () => zMove('front') }, { label: 'Avancer', run: () => zMove('fwd') }, { label: 'Attributs', run: () => { setProps(true); propsTab = 'style'; renderProps(true); } },
      { label: 'Copier', run: () => copy(false) }, { label: 'Arrière-plan', run: () => zMove('back') }, { label: 'Reculer', run: () => zMove('bwd') },
      sel.size > 1 ? { label: 'Entourer d’un cadre', run: () => frameAround(selItems()) } : { label: 'Masquer', run: hide }, { label: 'Verrouiller', run: () => action('lock') }]) };
    const del = { label: 'Supprimer', run: deleteSel }, dup = { label: 'Dupliquer', run: () => duplicate() };
    if (list.some(i => i.lock)) return around([{ label: 'Déverrouiller', run: () => action('unlock') }, null, null, null, null, null, null, null]);
    if (all('text')) return around([
      { label: 'Gras', on: list.every(i => i.bold), run: () => setProp('bold', !list.every(i => i.bold)) }, sizeIt, colorIt, editIt || alignIt, del, fontIt, more,
      { label: 'Italique', on: list.every(i => i.ital), run: () => setProp('ital', !list.every(i => i.ital)) }]);
    if (all('frame')) { const f = list[0]; return around([
      editIt || { label: 'Ajuster', run: () => list.forEach(fitFrame) }, { label: f.nt ? 'Afficher le titre' : 'Masquer le titre', run: () => setProp('ftitle', !!f.nt) },
      { label: 'Taille du titre', run: null, sub: () => around(['S', 'M', 'L', 'XL'].map((l, i) => ({ label: l, on: (f.tfs ?? 1) === i, run: () => setProp('tfs', i) }))) },
      one ? { label: 'Ajuster au contenu', run: () => fitFrame(one) } : null, del, more, dup]); }
    if (one && one.k === 'sheet') { const sh = one, R = sheetRange(sh), nr = R.r1 - R.r0 + 1, nc = R.c1 - R.c0 + 1;
      const rowsL = nr > 1 ? `Lignes ${R.r0 + 1} à ${R.r1 + 1}` : `Ligne ${R.r0 + 1}`, colsL = nc > 1 ? `Colonnes ${colName(R.c0)} à ${colName(R.c1)}` : `Colonne ${colName(R.c0)}`;
      return around([
        { label: 'Insérer', run: null, sub: () => around([{ label: 'Ligne au-dessus', run: () => sheetInsert(sh, 'row', R.r0, 1) }, { label: 'Colonne à droite', run: () => sheetInsert(sh, 'col', R.c1 + 1, 1) }, { label: 'Ligne en dessous', run: () => sheetInsert(sh, 'row', R.r1 + 1, 1) }, { label: 'Colonne à gauche', run: () => sheetInsert(sh, 'col', R.c0, 1) }]) },
        { label: 'Ligne de total', run: () => sheetTotal(sh) }, { label: 'Effacer les cellules', run: () => sheetClear(sh, R) }, sizeIt,
        { label: 'Supprimer', run: null, sub: () => around([{ label: rowsL, run: () => sheetInsert(sh, 'row', R.r0, -nr) }, { label: colsL, run: () => sheetInsert(sh, 'col', R.c0, -nc) }, { label: 'Le tableau', run: deleteSel }]) },
        { label: 'Copier les cellules', run: () => sheetCopy(sh, R) }, more, { label: 'Modifier le titre', run: () => startEdit(sh.id, null, 'title') }]); }
    if (all('note') || all('todo')) return around([editIt, colorIt, sizeIt, alignIt, del, fontIt, more, dup]);
    if (all('shape')) return around([editIt, colorIt, { label: 'Forme', run: null, sub: () => around(Object.entries(SHAPES).slice(0, 8).map(([k, l]) => ({ label: l, on: one && one.sh === k, run: () => setProp('sh', k) }))) }, sizeIt, del, fontIt, more, dup]);
    if (all('conn')) return around([{ label: 'Texte', run: () => one && startEdit(one.id) }, colorIt, { label: 'Tracé', run: null, sub: () => around(Object.entries(ROUTES).map(([k, l]) => ({ label: l, on: one && one.route === k, run: () => setProp('route', k) }))) }, null, del, null, more, dup]);
    return around([editIt, colorIt, sizeIt, fontIt, del, list.some(i => i.k === 'frame') ? null : alignIt, more, dup]);
  }
  function openMarking(e, hit, sticky, custom) {
    closeMarking(); if (!custom) cancelOp();
    if (hit && !sel.has(hit)) { sel = new Set([hit]); sheetSel = null; render(); }
    if (!hit && sel.size) { sel.clear(); schedule(); }
    if (hit && sel.size === 1 && e.target && e.target.closest) sheetCtx(e.target, byId.get(hit));
    const el = document.createElement('div'); el.className = 'mmenu'; wrap.append(el);
    el.addEventListener('pointerdown', e => mm && mmDown(e)); el.addEventListener('contextmenu', e => e.preventDefault());
    const items1 = custom ? custom.items : hit ? mmItemItems(hit) : mmToolItems(toW(e.clientX, e.clientY));
    mm = { el, pid: e.pointerId, x: e.clientX, y: e.clientY, mx: e.clientX, my: e.clientY, hover: -1, shown: false, sticky: !!sticky, moved: false,
      title: custom ? custom.title : hit ? (sel.size > 1 ? sel.size + ' éléments' : KIND_NAMES[(byId.get(hit) || {}).k] || 'Élément') : 'Outils', items: items1, lvl1: null, quick: e.button === 2, onClose: custom && custom.onClose };
    addEventListener('pointermove', mmMove, true); addEventListener('pointerup', mmUp, true); addEventListener('keydown', mmKey, true);
    if (sticky) mmShow(); else mm.t = setTimeout(() => mm && mmShow(), MM_DELAY);
  }
  function closeMarking() {
    if (!mm) return;
    const cb = mm.onClose;
    clearTimeout(mm.t); clearTimeout(mm.subT); mm.el.remove(); mm = null;
    removeEventListener('pointermove', mmMove, true); removeEventListener('pointerup', mmUp, true); removeEventListener('keydown', mmKey, true);
    if (cb) cb();
  }
  /* level 2: the options of item it, around (x, y); level 1 stays behind, dimmed, its item lit */
  function mmOpenSub(it, x, y) {
    clearTimeout(mm.subT);
    mm.lvl1 = { x: mm.x, y: mm.y, items: mm.items, dir: it.dir, title: mm.title, parent: it };
    mm.x = clamp(x, MM_R + 120, innerWidth - MM_R - 120); mm.y = clamp(y, MM_R + 24, innerHeight - MM_R - 24); mm.items = it.sub(); mm.title = it.label; mm.hover = -1; mm.moved = false;   // the options fit on screen
    clearTimeout(mm.t); mmShow();
  }
  /* the pill of item dir: at MM_R from the centre (flattened vertically); the left and right ones grow away from it */
  function mmPill(it, hot, c, cls = '') {
    const a = it.dir * Math.PI / 4, sx = Math.sin(a), px = c.x + sx * MM_R, py = c.y - Math.cos(a) * MM_R * .82;
    const tx = sx > .3 ? 'translate(-8px,-50%)' : sx < -.3 ? 'translate(calc(8px - 100%),-50%)' : 'translate(-50%,-50%)';
    const label = (it.on ? '• ' : '') + it.label;
    return `<span class="mmp${hot ? ' hot' : ''}${cls}" data-dir="${it.dir}" style="left:${px}px;top:${py}px;transform:${tx}">${it.sw ? `<i style="background:${it.sw}"></i>` : ''}${esc(label)}${it.sub ? '<em>▸</em>' : ''}</span>`;
  }
  function mmShow() {
    if (!mm) return; mm.shown = true;
    const dx = mm.mx - mm.x, dy = mm.my - mm.y, L1 = mm.lvl1;
    mm.el.classList.toggle('sticky', mm.sticky);
    let h = '<svg class="mmg">';
    if (L1) h += `<line class="lv" x1="${L1.x}" y1="${L1.y}" x2="${mm.x}" y2="${mm.y}"/>`;
    h += `<circle cx="${mm.x}" cy="${mm.y}" r="${MM_DEAD}" class="ring"/>${mm.hover >= 0 ? `<line x1="${mm.x}" y1="${mm.y}" x2="${mm.x + dx}" y2="${mm.y + dy}"/>` : ''}<circle cx="${mm.x}" cy="${mm.y}" r="5" class="dot"/></svg>`;
    h += `<span class="mmt${L1 ? ' sub' : ''}" style="left:${mm.x}px;top:${mm.y + 26}px">${esc(mm.title)}</span>` + mm.items.map(it => mmPill(it, it.dir === mm.hover, mm)).join('');
    mm.el.innerHTML = h;
  }
  function mmTrack(ev) {
    mm.mx = ev.clientX; mm.my = ev.clientY;
    const dx = mm.mx - mm.x, dy = mm.my - mm.y, dist = Math.hypot(dx, dy), far = dist > MM_DEAD;
    if (far) mm.moved = true;
    const d = far ? mmDirOf(dx, dy) : -1, h = mm.items.some(it => it.dir === d) ? d : -1;
    const changed = h !== mm.hover; mm.hover = h;
    const it = h >= 0 && mm.items.find(i => i.dir === h);
    if (!mm.sticky && !mm.lvl1 && it && it.sub) {
      if (dist > MM_R + 18) { mmOpenSub(it, mm.mx, mm.my); return; }   // carried on past the item: its options
      if (changed) { clearTimeout(mm.subT); mm.subT = setTimeout(() => mm && !mm.lvl1 && mm.hover === it.dir && mmOpenSub(it, mm.mx, mm.my), MM_SUB); }
    } else if (changed) clearTimeout(mm.subT);
    if (mm.shown && (changed || h >= 0)) mmShow();
  }
  function mmMove(ev) { if (!mm) return; if (mm.sticky || ev.pointerId === mm.pid) mmTrack(ev); }
  function mmUp(ev) {
    if (!mm || mm.sticky || ev.pointerId !== mm.pid) return;
    ev.preventDefault(); mmTrack(ev); if (!mm) return;
    if (mm.hover >= 0) { mmRun(); return; }
    if (mm.lvl1) { const p = mm.lvl1.parent; closeMarking(); if (p.run) { p.run(); schedule(); } return; }   // let go at the centre of level 2: the tool itself
    if (mm.quick && !mm.moved && !mm.shown) { const { items, mx, my } = mm; closeMarking(); mmList(items, mx, my); return; }   // a quick right click: a classic menu (0.2.22); once the marking menu showed, letting go just closes it
    closeMarking();
  }
  /* the same items as a plain drop-down list at (x, y); an item with options opens them as a second list */
  function mmList(items, x, y) {
    const at = { left: x, right: x, top: y, bottom: y, width: 0, height: 0 };
    openPop(at, items.map(it => ({ label: it.label, dot: it.sw, small: it.sub ? '›' : it.on ? '•' : '',
      run: () => { if (it.sub) { const sub = it.sub(); setTimeout(() => mmList(it.run ? [{ label: it.label, run: it.run }, ...sub] : sub, x, y), 0); return; } it.run && it.run(); schedule(); } })), { cls: 'mmlist', focus: false });
  }
  function mmDown(e) {
    e.preventDefault(); e.stopPropagation();
    if (!mm.sticky) return;
    const p = e.target.closest && e.target.closest('.mmp');
    if (p && p.classList.contains('dim')) { const it = mm.lvl1.items.find(i => i.dir === +p.dataset.dir); const L1 = mm.lvl1; Object.assign(mm, { x: L1.x, y: L1.y, items: L1.items, title: L1.title, lvl1: null, hover: it ? it.dir : -1 }); if (it && it.sub) { mmSubAt(it); return; } if (it) mmRun(); return; }
    mmTrack(e); if (!mm) return;
    if (p) mm.hover = +p.dataset.dir;
    const it = mm.hover >= 0 && mm.items.find(i => i.dir === mm.hover);
    if (it && it.sub && e.button !== 2) { mmSubAt(it); return; }
    if (it && e.button !== 2) mmRun(); else closeMarking();
  }
  /* a click on an item with options: they open around that item */
  function mmSubAt(it) { const a = it.dir * Math.PI / 4; mmOpenSub(it, mm.x + Math.sin(a) * MM_R * 1.25, mm.y - Math.cos(a) * MM_R * 1.05); }
  function mmKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMarking(); } }
  function mmRun() {
    const it = mm.items.find(i => i.dir === mm.hover); if (!it || !it.run) { closeMarking(); return; }
    mm.onClose = null;
    const flash = !mm.shown && { x: mm.x, y: mm.y, it };
    closeMarking();
    if (flash) mmFlash(flash);
    it.run(); schedule();
  }
  /* after a quick flick: the chosen item alone, lit, fading out */
  function mmFlash(f) {
    const el = document.createElement('div'); el.className = 'mmenu flash';
    const a = f.it.dir * Math.PI / 4, tx = f.x + Math.sin(a) * MM_R, ty = f.y - Math.cos(a) * MM_R * .82;
    el.innerHTML = `<svg class="mmg"><line x1="${f.x}" y1="${f.y}" x2="${tx}" y2="${ty}"/><circle cx="${f.x}" cy="${f.y}" r="4" class="dot"/></svg>` + mmPill(f.it, true, f);
    wrap.append(el); el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MM_FLASH, easing: 'linear' }).onfinish = () => el.remove();
  }
  /* a finger held still on the board opens the marking menu; moving it first keeps the usual pan, move or marquee */
  function holdFor(e) {
    const x0 = e.clientX, y0 = e.clientY, pid = e.pointerId;
    const stop = () => { clearTimeout(t); removeEventListener('pointermove', mv, true); removeEventListener('pointerup', stop, true); removeEventListener('pointercancel', stop, true); };
    const mv = ev => { if (ev.pointerId === pid && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) stop(); };
    const t = setTimeout(() => { stop(); if (!mounted || touches.size > 1 || editing) return; const hit = hitAt(e); openMarking({ clientX: x0, clientY: y0, pointerId: pid }, hit); if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {} }, MM_HOLD);
    addEventListener('pointermove', mv, true); addEventListener('pointerup', stop, true); addEventListener('pointercancel', stop, true);
  }

  return { busy: () => !!(op || mm || editing),
    mount, unmount, key, keyUp, paste: onPaste,
    get mounted() { return mounted; }, get doc() { return D; }, get tool() { return tool; },
    refreshRefs() { if (!mounted) return; for (const [id, n] of nodes) { const it = byId.get(id); if (it && (it.k === 'task' || it.k === 'doc' || it.k === 'todo')) { n._sig = ''; n._it = null; } } propSig = ''; schedule(); },
    /* modeOnly: the same theme switched between light and dark; the fonts did not change, so nothing is measured again */
    retheme(from, modeOnly) {
      if (!mounted) return;
      if (from) { const m = schemeMapper(from, scheme()); hist = hist.map(m.list); fut = fut.map(m.list); noteColor = m.re(noteColor) || noteColor; items = D.items; closePop(); }
      if (optsEl) { optsEl._h = ''; refreshTools(); }
      Studio.retheme(); if (!modeOnly) { measCache.clear(); items = relayout(items); reindex(); D.items = items; } for (const n of nodes.values()) { n._sig = ''; n._it = null; } propSig = ''; qSig = ''; schedule(); },
    layoutChanged, uiScaled,
    /* used by the assistant and the space page */
    items: () => items, select: ids => { sel = new Set(ids); schedule(); },
    addNotes(list) { const cols = Math.min(4, Math.ceil(Math.sqrt(list.length))); const out = list.map((n, i) => mkNote((i % cols) * 240, Math.floor(i / cols) * 240, String(n.texte || n.text || ''), themeColors('note', NOTE_COLORS)[(n.couleur != null ? NOTE_COLORS.indexOf(n.couleur) : -1) >= 0 ? NOTE_COLORS.indexOf(n.couleur) : colorIndex(n.couleur, i)])); return insert(out); },
    groupInFrames(groups) {
      let x = 0; const out = [], moved = new Map();
      const placed = new Set();
      for (const g of groups) {
        const its = (g.ids || []).map(id => byId.get(id)).filter(i => i && i.k !== 'conn' && !placed.has(i.id)); its.forEach(i => placed.add(i.id));
        const extra = (g.nouveaux || []).map(t => mkNote(0, 0, String(t), noteColor));
        const all = its.concat(extra); if (!all.length) continue;
        const cols = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(all.length)))), rows = Math.ceil(all.length / cols);
        const cw = Math.max(220, ...all.map(i => i.w)) + 24, chh = Math.max(220, ...all.map(i => i.h)) + 24;
        const f = mkFrame(x, 0, cols * cw + 40, rows * chh + 40, g.titre || 'Groupe'); out.push(f);
        all.forEach((it, i) => { const nx = x + 32 + (i % cols) * cw, ny = 32 + Math.floor(i / cols) * chh; if (extra.includes(it)) out.push(Object.assign(it, { x: nx, y: ny })); else moved.set(it.id, { dx: nx - it.x, dy: ny - it.y }); });
        x += f.w + 60;
      }
      if (!out.length) return [];
      const bb = unionBox(items.filter(i => i.k !== 'conn')) || [0, 0, 0, 0], ox = bb[0], oy = bb[3] + 160;
      const frames = out.filter(i => i.k === 'frame').map(f => Object.assign(f, { x: f.x + ox, y: f.y + oy }));
      const newNotes = out.filter(i => i.k !== 'frame').map(n => Object.assign(n, { x: n.x + ox, y: n.y + oy }));
      animate();
      commit(frames.concat(items.map(i => { const m = moved.get(i.id); return m ? Object.assign({}, i, { x: i.x + m.dx + ox, y: i.y + m.dy + oy }) : i; }), newNotes));
      const nb = unionBox(frames); if (nb) fitTo(nb, view.k * uz());
      return frames.map(f => f.id);
    },
    arrangeAll(mode) { sel = new Set(items.filter(i => i.k !== 'conn' && i.k !== 'mind' && i.k !== 'frame' && !i.hid).map(i => i.id)); arrange(mode || 'grid'); },
    insert, fitAll, placeMedia, setTool, openPanel(tab) { setProps(true); propsTab = tab || 'style'; renderProps(true); },
    ingestFiles(files) { return ingest({ files, getData: () => '' }, centerW()); }
  };
  function colorIndex(name, i) { const n = norm(name); const m = { jaune: 0, orange: 1, rose: 2, violet: 3, bleu: 4, vert: 5, blanc: 6, gris: 7 }; return m[n] != null ? m[n] : i % 6; }
})();
