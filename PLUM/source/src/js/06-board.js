/* ================= board view =================
   An infinite sheet in the spirit of Excalidraw: a tool island on top, a Style / Layers / Moodboard
   panel on the right, islands for zoom, undo and help, and everything else on the sheet itself.
   Items are DOM nodes under one transformed world; connectors and mind-map branches are one SVG. */
const Board = (() => {
  let D = null, items = [], byId = new Map();
  let host, world, framesL, edges, edgesTop, itemsL, labelsL, ovl, liveCv, ink, meas, wrap, toolsEl, optsEl, dockEl, trEl, propsEl, qbarEl, zoomEl, undoEl, brEl, hintEl;
  const view = { x: 0, y: 0, k: 1 };
  let tool = 'select', shapeKind = 'rect', penKind = 'pen', noteColor = NOTE_COLORS[0];
  let sel = new Set(), editing = null, editSub = null, hist = [], fut = [], op = null, guides = null, marquee = null, attachHi = null, eraserAt = null;
  let spaceDown = false, penSeen = false, clip = null, raf = 0, propSig = '', qSig = '', lastClient = null, mounted = false, propsTab = 'style', propsHold = false, liveBefore = null;
  const touches = new Map(), nodes = new Map(), fitCache = new Map(), measCache = new Map();
  const MINK = .08, MAXK = 8;

  /* ---------- coordinates ---------- */
  const hostRect = () => host.getBoundingClientRect();
  function toW(cx, cy) { const r = hostRect(); return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }; }
  const toS = (x, y) => ({ x: x * view.k + view.x, y: y * view.k + view.y });
  const reindex = () => { byId = new Map(items.map(i => [i.id, i])); };
  const selItems = () => [...sel].map(id => byId.get(id)).filter(Boolean);
  const visible = it => !it.hid;

  /* ---------- history ---------- */
  function commit(next, o = {}) {
    if (o.hist !== false) { hist.push(o.before || items); if (hist.length > 250) hist.shift(); fut.length = 0; }
    items = hasMind(next) ? relayout(next) : next; reindex();
    for (const id of [...sel]) if (!byId.has(id)) sel.delete(id);
    D.items = items; touch(D); updateUndo(); schedule();
  }
  function setLive(next) { items = next; reindex(); D.items = items; schedule(); }
  function silent(next) { items = next; reindex(); D.items = items; save(); }
  const hasMind = arr => arr.some(i => i.k === 'mind');
  function undo() { if (editing) finishEdit(); const p = hist.pop(); if (!p) return; fut.push(items); items = p; reindex(); sel = new Set([...sel].filter(id => byId.has(id))); D.items = items; touch(D); updateUndo(); schedule(); }
  function redo() { if (editing) finishEdit(); const p = fut.pop(); if (!p) return; hist.push(items); items = p; reindex(); D.items = items; touch(D); updateUndo(); schedule(); }
  function updateUndo() { if (!undoEl) return; $('[data-a="undo"]', undoEl).disabled = !hist.length; $('[data-a="redo"]', undoEl).disabled = !fut.length; }
  const replace = (arr, it, patch) => arr.map(x => x.id === it.id ? Object.assign({}, x, patch) : x);

  /* ---------- mind map layout ---------- */
  function measureMind(txt, lv) {
    const key = skin() + lv + '|' + txt; let m = measCache.get(key); if (m) return m;
    const maxW = lv === 0 ? 320 : lv === 1 ? 240 : 220;
    meas.className = 'it mind l' + Math.min(lv, 2); meas.style.cssText = 'left:-99999px;top:0;visibility:hidden;width:max-content;height:auto;--mc:#888';
    meas.innerHTML = mindIcon(txt, lv) + `<div class="txt" style="max-width:${maxW}px">${fmtText(txt || ' ')}</div>`;
    const t = meas.firstChild, vp = lv === 0 ? 36 : lv === 1 ? 20 : 12, minH = lv === 0 ? 64 : lv === 1 ? 42 : 32;
    m = { w: Math.ceil(Math.max(lv === 0 ? 140 : 48, meas.offsetWidth + 2)), h: Math.ceil(Math.max(minH, t.offsetHeight + vp)) };
    if (measCache.size > 2000) measCache.clear(); measCache.set(key, m); return m;
  }
  /* Inkspace: first-level branches carry a pictogram picked from their words */
  const MIND_ICONS = [[/r[ée]gion|lieu|monde|carte|map|territ|zone/i, 'compass'], [/faction|clan|guilde|royaume|alliance|camp/i, 'flag'], [/qu[êe]te|mission|histoire|sc[ée]nario|r[ée]cit|objectif/i, 'scroll'], [/gameplay|m[ée]cani|jeu|game|syst[èe]me/i, 'gamepad'], [/ressource|mat[ée]ri|nature|[ée]conomie|budget/i, 'leaf'], [/visuel|image|art|ambiance|moodboard|design|r[ée]f[ée]rence/i, 'image'], [/personnage|perso|h[ée]ros|pnj|[ée]quipe|people|client/i, 'users'], [/lore|chronique|mythe|croyance|biblio|wiki|savoir/i, 'book'], [/id[ée]e|question|brainstorm/i, 'spark'], [/t[âa]che|todo|planning|[ée]tape|court terme|long terme/i, 'tasks']];
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
      const walk = (n, l) => { lv.set(n.id, l); sz.set(n.id, measureMind(editing === n.id ? liveText(n) : n.txt, l)); for (const c of kids.get(n.id) || []) walk(c, l + 1); };
      walk(r, 0);
      const VG = l => l <= 1 ? 18 : 8, HG = l => l === 0 ? 70 : 46;
      const subH = n => { const ch = kids.get(n.id) || [], own = sz.get(n.id).h; let s = 0; ch.forEach((c, i) => { s += subH(c) + (i ? VG(lv.get(c.id)) : 0); }); const v = Math.max(own, s); sub.set(n.id, v); return v; };
      subH(r);
      const rs = sz.get(r.id), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      out.set(r.id, { x: Math.round(cx - rs.w / 2), y: Math.round(cy - rs.h / 2), w: rs.w, h: rs.h, lv: 0, parent: null, root: r.id });
      const place = (n, list, side) => {
        const np = out.get(n.id); let total = 0;
        list.forEach((c, i) => { total += sub.get(c.id) + (i ? VG(lv.get(c.id)) : 0); });
        let y = np.y + np.h / 2 - total / 2;
        for (const c of list) {
          const cs = sz.get(c.id), hh = sub.get(c.id), ccy = y + hh / 2, gap = HG(lv.get(n.id));
          out.set(c.id, { x: Math.round(side > 0 ? np.x + np.w + gap : np.x - gap - cs.w), y: Math.round(ccy - cs.h / 2), w: cs.w, h: cs.h, lv: lv.get(c.id), side, root: r.id });
          place(c, kids.get(c.id) || [], side);
          y += hh + VG(lv.get(c.id));
        }
      };
      const rk = kids.get(r.id) || [];
      place(r, rk.filter(c => c.side > 0), 1); place(r, rk.filter(c => c.side < 0), -1);
    }
    return arr.map(i => { const p = out.get(i.id); if (!p) return i; let same = true; for (const k in p) if (i[k] !== p[k]) { same = false; break; } return same ? i : Object.assign({}, i, p); });
  }
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
      case 'note': return `n${it.w}|${it.h}|${it.c}|${it.fs}|${it.font}|${it.al}|${it.txt}|${skin()}`;
      case 'text': return `t${it.fw ? it.w : ''}|${it.fs}|${it.font}|${it.color}|${it.bold}|${it.ital}|${it.al}|${it.txt}|${theme()}`;
      case 'shape': return `s${it.w}|${it.h}|${it.sh}|${it.sc}|${it.fc}|${it.sw}|${it.sty}|${it.dash}|${it.fill}|${it.txt}|${it.fs}|${it.font}|${it.color}|${theme()}`;
      case 'image': return `i${it.asset}|${it.frm}|${it.cap}|${Assets.has(it.asset)}`;
      case 'file': return `f${it.asset}|${it.name}|${it.mime}`;
      case 'link': return `l${Math.round(it.w)}|${Math.round(it.h)}|${it.url}|${it.title}|${it.asset || it.pic || ''}|${Assets.has(it.asset)}`;
      case 'ink': return `k${pv(it.p)}|${it.c}|${it.o}|${it.t}|${it.w0}|${it.h0}|${theme()}|${it.b ? JSON.stringify(it.b) : ''}`;
      case 'mind': return `m${it.lv}|${it.c}|${it.txt}|${skin()}`;
      case 'frame': return `r${it.title}|${it.nt ? 1 : 0}|${it.tfs || 1}`;
      case 'task': { const t = taskById(it.task) || {}; return `T${t.t}|${t.done}|${t.due}|${t.time}|${t.sp}`; }
      case 'doc': { const d = docById(it.doc) || {}; return `D${d.title}|${d.updated}|${d.trash}`; }
      case 'sheet': return `g${it.w}|${it.h}|${it.cols}|${it.rows}|${it.fs}|${it.title}|${JSON.stringify(it.cells)}|${JSON.stringify(it.cw || 0)}|${JSON.stringify(it.rh || 0)}|${theme()}`;
      case 'todo': return `o${it.w}|${it.c}|${it.font}|${it.fs}|${it.title}|${it.tasks.map(id => { const t = taskById(id); return t ? `${t.id}:${t.done ? 1 : 0}:${t.t}` : ''; }).join('§')}|${theme()}`;
    }
    return it.k;
  }
  function paint(n, it) {
    n._it = it;
    const s = n.style; s.left = it.x + 'px'; s.top = it.y + 'px';
    if (it.k === 'text' && !it.fw) { s.width = ''; s.height = ''; } else { s.width = it.w + 'px'; s.height = it.h + 'px'; }
    s.opacity = it.op != null && it.op < 1 ? it.op : '';
    if (editing === it.id && n._sig) { if (it.k === 'mind') { n.className = 'it mind editing l' + Math.min(it.lv || 0, 2); n.style.setProperty('--mc', it.c); } return; }
    const sig = sigOf(it); if (sig === n._sig) return; n._sig = sig;
    switch (it.k) {
      case 'note':
        n.className = 'it note'; s.background = it.c; s.setProperty('--tc', it.c);
        n.innerHTML = `<div class="txt l-${it.al || 'left'}" style="font-family:${fontCSS(it)}">${fmtText(it.txt)}</div>`;
        fitNote(n, it); break;
      case 'text':
        n.className = 'it text' + (it.fw ? '' : ' auto');
        n.innerHTML = `<div class="txt l-${it.al || 'left'}" style="font:${it.ital ? 'italic ' : ''}${it.bold ? 700 : 500} ${it.fs}px/1.12 ${fontCSS(it)};color:${textColor(it.color, (it.font || HAND) === HAND)};text-align:${it.al || 'left'}">${fmtText(it.txt) || '<div><br></div>'}</div>`;
        measureText(n, it); break;
      case 'shape':
        n.className = 'it shape';
        n.innerHTML = shapeSVG(it) + `<div class="txt" style="font:600 ${it.fs}px/1.12 ${fontCSS(it)};color:${inkColor(it.color || it.sc)}">${fmtText(it.txt)}</div>`;
        if (it.txt) fitShape(n, it); break;
      case 'image': {
        n.className = 'it image ' + (it.frm || 'shadow');
        const u = Assets.url(it.asset);
        n.innerHTML = u ? `<img src="${u}" alt="${esc(it.cap || 'Image')}" draggable="false">${it.frm === 'polaroid' && it.cap ? `<div class="cap">${esc(it.cap)}</div>` : ''}` : `<div class="ph"><div>${icon('image')}Glissez une image ici</div></div>`;
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
      case 'mind':
        n.className = 'it mind l' + Math.min(it.lv || 0, 2); n.style.setProperty('--mc', it.c);
        n.innerHTML = mindIcon(it.txt, it.lv || 0) + `<div class="txt">${fmtText(it.txt) || '<div><br></div>'}</div>`; break;
      case 'frame':
        n.className = 'frame-it' + (it.nt ? ' nt' : ''); n.innerHTML = `<div class="ftitle" style="font-size:${FRAME_TFS[it.tfs ?? 1]}px">${esc(it.title)}</div>`; break;
      case 'task': {
        const t = taskById(it.task);
        n.className = 'it card-it task' + (t && t.done ? ' done' : '');
        if (!t) { n.innerHTML = `<div class="fi"><small>Tâche supprimée</small></div>`; break; }
        const di = dueInfo(t.due), sp = spaceById(t.sp);
        n.innerHTML = `<button class="cb" role="checkbox" aria-checked="${t.done}" data-tdone="1" aria-label="Terminer">${icon('check')}</button><span class="tt">${esc(t.t)}</span>${t.time ? `<span class="chip time">${t.time}</span>` : ''}${di && !t.done ? `<span class="chip ${di.cls}">${di.label}</span>` : ''}${sp ? `<span class="sdot" style="background:${sp.color}"></span>` : ''}`;
        break;
      }
      case 'doc': {
        const d = docById(it.doc);
        n.className = 'it card-it docref';
        n.innerHTML = d && !d.trash ? `<div class="th">${Thumbs.svg(d)}</div><div class="fi">${icon(d.type === 'board' ? 'board' : 'note', 'sm')}<b>${esc(d.title)}</b></div>` : `<div class="fi"><small>Document introuvable</small></div>`;
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
      case 'todo': {
        n.className = 'it todo'; s.background = it.c || '#FFFFFF'; s.setProperty('--tc', it.c || '#FFFFFF');
        const sd = it.sd != null ? it.sd : hashStr(it.id), P = shapePoly('round', it.w, it.h), rough = roughD(P, true, sd, 2);
        const rows = it.tasks.map(id => { const t = taskById(id); if (!t) return ''; return `<div class="trw${t.done ? ' done' : ''}" data-task="${t.id}"><button class="tck" data-tck="${t.id}" role="checkbox" aria-checked="${t.done}" aria-label="Terminer"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button><span class="ttx" data-sub="${t.id}">${esc(t.t) || '&nbsp;'}</span></div>`; }).join('');
        n.innerHTML = `<svg class="sh" viewBox="0 0 ${it.w} ${it.h}" preserveAspectRatio="none">${rough.map((d, i) => `<path d="${d}" fill="none" stroke="${inkColor('#1E1E1E')}" stroke-width="${i ? 1.3 : 1.9}" stroke-linecap="round" opacity="${i ? .55 : .9}" vector-effect="non-scaling-stroke"/>`).join('')}</svg>
          <div class="tin" style="font-family:${fontCSS(it)};font-size:${it.fs}px"><div class="ttl" data-sub="title">${esc(it.title) || '&nbsp;'}</div><div class="trows">${rows}</div><button class="tadd" data-tadd="1">${icon('plus', 'sm')}<span>Ajouter</span></button></div>`;
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
    const h = Math.max(96, Math.ceil(tin.offsetHeight + 28));
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
    for (const it of items) { if (it.k === 'conn' || it.hid) continue; (it.k === 'frame' ? fr : ot).push(it); }
    reconcile(framesL, fr); reconcile(itemsL, ot);
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
    for (const it of items) if (it.k === 'mind' && it.parent && !it.hid) {
      const p = byId.get(it.parent); if (!p || p.hid) continue;
      const x1 = it.side > 0 ? p.x + p.w : p.x, y1 = p.y + p.h / 2, lv = it.lv || 1;
      const tag = THEMES[skin()] && THEMES[skin()].mindTags;
      const x2 = it.side > 0 ? it.x : it.x + it.w, y2 = lv >= 2 && !tag ? it.y + it.h - 1 : it.y + it.h / 2, mx = x1 + (x2 - x1) * .5;
      const ext = lv >= 2 && !tag ? `L${(it.side > 0 ? it.x + 4 : it.x + it.w - 4).toFixed(1)} ${y2.toFixed(1)}` : '';
      s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}C${mx.toFixed(1)} ${y1.toFixed(1)} ${mx.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}${ext}" fill="none" stroke="${it.c}" stroke-width="${lv === 1 ? 3.2 : 2.2}" stroke-linecap="round"/>`;
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
    if (marquee) { const a = toS(marquee[0], marquee[1]), b = toS(marquee[2], marquee[3]); h += `<div class="marquee" style="left:${Math.min(a.x, b.x)}px;top:${Math.min(a.y, b.y)}px;width:${Math.abs(b.x - a.x)}px;height:${Math.abs(b.y - a.y)}px"></div>`; }
    if (guides) for (const g of guides) { if (g.v != null) { const p = toS(g.v, 0); h += `<div class="guide v" style="left:${p.x}px;top:0;bottom:0"></div>`; } else { const p = toS(0, g.h); h += `<div class="guide h" style="top:${p.y}px;left:0;right:0"></div>`; } }
    if (attachHi) { const it = byId.get(attachHi); if (it) { const a = toS(it.x, it.y); h += `<div class="attach" style="left:${a.x - 4}px;top:${a.y - 4}px;width:${it.w * view.k + 8}px;height:${it.h * view.k + 8}px"></div>`; } }
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
        const a = toS(bb[0], bb[1]), b = toS(bb[2], bb[3]);
        h += `<div class="selbox${list.length > 1 ? ' multi' : ''}" style="left:${a.x - 3}px;top:${a.y - 3}px;width:${b.x - a.x + 6}px;height:${b.y - a.y + 6}px"></div>`;
        const one = list.length === 1 ? list[0] : null;
        if (!dragging && !editing && !(one && one.k === 'mind')) {
          const sides = one && (one.k === 'image' || one.k === 'ink' || one.k === 'doc') ? ['nw', 'ne', 'se', 'sw'] : one && one.k === 'text' ? ['nw', 'ne', 'se', 'sw', 'e', 'w'] : one && (one.k === 'todo' || one.k === 'sheet') ? ['e', 'w'] : ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'];
          const P = { nw: [a.x, a.y], ne: [b.x, a.y], se: [b.x, b.y], sw: [a.x, b.y], n: [(a.x + b.x) / 2, a.y], s: [(a.x + b.x) / 2, b.y], e: [b.x, (a.y + b.y) / 2], w: [a.x, (a.y + b.y) / 2] };
          for (const k of sides) h += `<div class="hdl ${k}" data-h="${k}" style="left:${P[k][0] + (k.includes('e') ? 3 : k.includes('w') ? -3 : 0)}px;top:${P[k][1] + (k.includes('s') ? 3 : k.includes('n') ? -3 : 0)}px"></div>`;
          // Excalidraw/Miro-like: a dot on each side, drag it to another item to link them, click it to add a linked item
          if (one && LINKABLE(one)) for (const [k, [dx, dy]] of Object.entries(DIRS)) h += `<div class="hdl cdot" data-cd="${k}" title="Glisser vers un élément pour le relier · clic : nouvel élément relié (Ctrl + flèche)" style="left:${P[k][0] + dx * 22}px;top:${P[k][1] + dy * 22}px"></div>`;
        }
        const tidy = canTidy(boxes) && (!dragging || op.kind === 'tidy') && !editing;
        if (tidy) h += `<div class="hdl tidy" data-tidy="1" title="Réorganiser : glissez à gauche ou à droite pour changer la largeur du bloc, cliquez pour ajuster. Ctrl + poignée d’échelle : le cadre change de ce côté et les images se réorganisent" style="left:${b.x + 20}px;top:${a.y - 20}px"><i></i><i></i><i></i><i></i></div>`;
        if (boxes.length > 1 && !dragging && !editing) h += `<button class="ovl-arr" data-arr="1" title="Ranger, aligner, répartir" style="left:${b.x + 20}px;top:${a.y + (tidy ? 14 : -20)}px">${icon('arrange')}</button>`;
      }
    }
    ovl.innerHTML = h;
    renderQuick(list, dragging);
    renderProps();
    $('.zv', zoomEl).textContent = Math.round(view.k * 100) + ' %';
  }

  /* ---------- quick bar: a few buttons over the selection when the panel is closed ---------- */
  const primaryProp = it => it.k === 'note' || it.k === 'todo' ? 'fc' : it.k === 'frame' || it.k === 'image' || it.k === 'file' || it.k === 'link' || it.k === 'doc' || it.k === 'task' ? null : 'sc';
  const propValue = (it, prop) => prop === 'fc' ? (it.k === 'shape' ? it.fc : it.c) : prop === 'sc' ? (it.k === 'text' ? it.color : it.k === 'ink' || it.k === 'mind' ? it.c : it.sc) : it[prop];
  function renderQuick(list, dragging) {
    const show = list.length && !dragging && !propsOpen() && !(op && op.kind === 'marquee') && !editing;
    if (!show) { qbarEl.hidden = true; qSig = ''; return; }
    const one = list[0], prop = list.length === 1 ? primaryProp(one) : null, cur = prop ? propValue(one, prop) : null;
    const sig = list.map(i => i.id).join(',') + '|' + prop + '|' + cur;
    if (sig !== qSig) {
      qSig = sig;
      qbarEl.innerHTML = (prop ? `<button class="qb" data-q="color" title="Couleur"><span class="sw${cur ? '' : ' fill-none'}" style="background:${cur || 'transparent'}"></span></button>` : '')
        + `<button class="qb" data-q="style" title="Style et calques">${icon('sliders')}<span>Style</span></button><span class="vs"></span><button class="qb" data-q="dup" title="Dupliquer (Ctrl D)">${icon('dup')}</button><button class="qb" data-q="del" title="Supprimer (Suppr)">${icon('trash')}</button>`;
    }
    qbarEl.hidden = false;
    const bb = unionBox(list.filter(i => i.k !== 'conn')) || (() => { const g = connGeom(list[0], byId); return [Math.min(g.a[0], g.b[0]), Math.min(g.a[1], g.b[1]), Math.max(g.a[0], g.b[0]), Math.max(g.a[1], g.b[1])]; })();
    const a = toS(bb[0], bb[1]), b = toS(bb[2], bb[3]), r = hostRect(), w = qbarEl.offsetWidth, hh = qbarEl.offsetHeight;
    let x = (a.x + b.x) / 2 - w / 2, y = a.y - hh - 14;
    if (y < 64) y = b.y + 14;
    if (y + hh > r.height - 70) y = Math.max(64, a.y - hh - 14);
    qbarEl.style.left = clamp(x, 8, Math.max(8, r.width - w - 8)) + 'px'; qbarEl.style.top = clamp(y, 8, Math.max(8, r.height - hh - 8)) + 'px';
  }
  function quickAction(a, btn) {
    const list = selItems(); if (!list.length) return;
    if (a === 'dup') duplicate(); else if (a === 'del') deleteSel();
    else if (a === 'style') { setProps(true); propsTab = 'style'; renderProps(true); }
    else if (a === 'color') { const prop = primaryProp(list[0]); Colors.open(btn, { value: propValue(list[0], prop), none: prop === 'fc', onPick: (c, final) => setProp(prop, c, !final) }); }
  }

  /* ---------- the Style / Layers / Moodboard panel ---------- */
  const propsOpen = () => propsEl && !propsEl.hidden && !wrap.classList.contains('drawing');
  function setProps(on) { S.prefs.props = on; save(); propsEl.hidden = !on; wrap.classList.toggle('props-open', on); $('[data-a="props"]', trEl).setAttribute('aria-pressed', on); propSig = ''; renderOverlay(); layoutChanged(); }
  const SW_OPTS = [[1, 'Fin'], [2, 'Moyen'], [4, 'Épais']];
  const FS_TABLE = { note: [22, 30, 40, 54], text: [20, 28, 40, 64], shape: [18, 26, 34, 46], todo: [18, 24, 30, 38], sheet: [12, 14, 17, 21] };
  const fsLevel = it => { const T = FS_TABLE[it.k] || FS_TABLE.text; let b = 0; for (let i = 0; i < T.length; i++) if (Math.abs(T[i] - it.fs) < Math.abs(T[b] - it.fs)) b = i; return b; };
  const sec = (l, body, cls = '') => `<div class="ps ${cls}"><div class="ps-l">${l}</div>${body}</div>`;
  const seg = (prop, cur, opts, cls = '') => `<div class="seg sm ${cls}" data-set="${prop}">${opts.map(([v, l, t]) => `<button data-v="${v}" aria-pressed="${String(cur) === String(v)}" title="${esc(t || l)}">${l}</button>`).join('')}</div>`;
  const pline = (d, extra = '') => `<svg viewBox="0 0 40 16" class="pl"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"${extra}/></svg>`;
  const headIcon = k => { const t = [1, 0]; const p = [34, 8]; return `<svg viewBox="0 0 40 16" class="pl" style="color:currentColor"><path d="M4 8H${k === 'none' ? 34 : 30}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><g stroke="currentColor" fill="currentColor" stroke-width="2">${headD(p, t, k, 1.2).replace(/class="hf"/g, 'fill="currentColor"').replace(/class="hs"/g, 'fill="none"').replace(/style="fill:var\(--paper\)"/g, 'fill="var(--card)"')}</g></svg>`; };
  const btnRow = (list) => `<div class="pbtns">${list.map(([a, ic, l, t]) => `<button class="pb" data-act="${a}" title="${esc(t || l)}" aria-label="${esc(t || l)}">${ic ? icon(ic) : ''}${l ? `<span>${l}</span>` : ''}</button>`).join('')}</div>`;
  function propsHTML() {
    if (propsTab === 'layers') return layersHTML();
    if (propsTab === 'media') return mediaHTML();
    const list = selItems();
    if (!list.length && (PENS[tool] || tool === 'eraser')) return `<div class="pp-wrap" data-pp="1">${PenPanel.html(tool === 'eraser' ? 'eraser' : penKind)}</div>`;
    const kinds = new Set(list.map(i => i.k)), has = (...ks) => ks.some(k => kinds.has(k)), only = (...ks) => list.length && [...kinds].every(k => ks.includes(k));
    const bd = BD(), one = list.length === 1 ? list[0] : null, out = [];
    const first = k => list.find(i => k ? i.k === k : true);
    const T = tool; const td = !list.length;
    if (td && T === 'select') {
      out.push(sec('Fond du board', seg('bg', D.bg || 'dots', [['plain', 'Uni'], ['dots', 'Points'], ['grid', 'Quadrillage']])));
      out.push(sec('Astuces', `<div class="pp-hint">Double-clic sur le vide : post-it. <b>V</b> sélection, <b>P</b> stylo, <b>A</b> flèche, <b>L</b> ligne, <b>C</b> liste à faire, <b>1</b>–<b>9</b> changent de pinceau, <b>K</b> pipette (ou <b>Alt</b> + clic en dessinant).<br>Glissez images et fichiers sur le board, ou depuis l’onglet Moodboard.</div>`));
      out.push(sec('Raccourcis', `<button class="btn sm" data-act="help">${icon('help', 'sm')}Tous les raccourcis</button>`));
      return out.join('');
    }
    /* which properties apply: from the selection, or from the tool about to draw */
    const want = td ? { sc: ['shape', 'conn', 'line', 'text'].includes(T), fc: ['shape', 'note', 'todo'].includes(T), fill: T === 'shape', sw: ['shape', 'conn', 'line'].includes(T), dash: ['shape', 'conn', 'line'].includes(T), sty: ['shape', 'conn', 'line'].includes(T), sh: T === 'shape', heads: T === 'conn', route: T === 'conn', font: ['text', 'note', 'todo', 'shape'].includes(T) }
      : { sc: has('shape', 'conn', 'text', 'ink', 'mind'), fc: has('shape', 'note', 'todo'), fill: has('shape') && list.some(i => i.k === 'shape' && i.fc), sw: has('shape', 'conn'), dash: has('shape', 'conn'), sty: has('shape', 'conn'), sh: only('shape'), heads: only('conn'), route: only('conn'), font: has('note', 'text', 'shape', 'todo'), fs: has('note', 'text', 'shape', 'todo', 'sheet'), al: has('note', 'text'), bold: only('text'), op: true };
    const val = (prop, def) => { if (td) return def; const it = first(); return propValue(list.find(i => propValue(i, prop) !== undefined) || it, prop) ?? def; };
    const scCur = td ? bd.sc : (list.some(i => ['shape', 'conn', 'text', 'ink', 'mind'].includes(i.k)) ? propValue(list.find(i => ['shape', 'conn', 'text', 'ink', 'mind'].includes(i.k)), 'sc') : bd.sc);
    const fcCur = td ? (T === 'note' ? noteColor : T === 'todo' ? '#FFFFFF' : bd.fc) : propValue(list.find(i => ['shape', 'note', 'todo'].includes(i.k)) || list[0], 'fc');
    if (want.sc) out.push(sec(has('ink') && only('ink') ? 'Couleur du trait' : has('text') && only('text') ? 'Couleur' : 'Contour', Colors.row(only('ink') ? themeColors('ink', INK_COLORS).slice(0, 5) : themeColors('stroke', STROKE_COLORS), scCur, 'sc')));
    if (want.fc) out.push(sec(only('note', 'todo') || (td && (T === 'note' || T === 'todo')) ? 'Couleur' : 'Fond', Colors.row(only('note', 'todo') || (td && T === 'note') ? themeColors('note', NOTE_COLORS).slice(0, 5) : themeColors('fill', FILL_COLORS), fcCur, 'fc', { none: !(only('note', 'todo') || (td && (T === 'note' || T === 'todo'))) })));
    if (want.fill && (td ? bd.fc : true)) out.push(sec('Remplissage', seg('fill', val('fill', bd.fill), [['solid', `<svg viewBox="0 0 20 20" class="pl sq"><rect x="3" y="3" width="14" height="14" rx="2" fill="currentColor"/></svg>`, 'Plein'], ['hachure', `<svg viewBox="0 0 20 20" class="pl sq"><rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor"/><path d="M3 11l8-8M3 17L17 3M9 17l8-8" stroke="currentColor"/></svg>`, 'Hachures'], ['cross', `<svg viewBox="0 0 20 20" class="pl sq"><rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor"/><path d="M3 11l8-8M9 17l8-8M3 9l8 8M9 3l8 8" stroke="currentColor"/></svg>`, 'Croisillons']], 'ic')));
    if (want.sw) out.push(sec('Épaisseur', seg('sw', val('sw', bd.sw), [[1, pline('M4 8h32', ' stroke-width="1.4"'), 'Fin'], [2, pline('M4 8h32', ' stroke-width="2.6"'), 'Moyen'], [4, pline('M4 8h32', ' stroke-width="4.2"'), 'Épais']], 'ic')));
    if (want.dash) out.push(sec('Style du trait', seg('dash', val('dash', bd.dash) || '', [['', pline('M4 8h32'), 'Continu'], ['dash', pline('M4 8h32', ' stroke-dasharray="6 4"'), 'Tirets'], ['dot', pline('M4 8h32', ' stroke-dasharray="1 4"'), 'Pointillés']], 'ic')));
    if (want.sty) out.push(sec('Tracé', seg('sty', val('sty', bd.sty), [['clean', pline('M4 8h32'), 'Net'], ['sketch', pline('M4 9c6-3 12 2 18-1s8-2 14 0'), 'Croquis'], ['wild', pline('M4 10c4-6 8 4 12-2s6 6 10-2 6 4 10 0'), 'Fou']], 'ic')));
    if (want.sh) { const cur = td ? shapeKind : one ? one.sh : first('shape').sh; out.push(sec('Forme', `<div class="shgrid" data-set="sh">${Object.entries(SHAPES).map(([k, l]) => `<button data-v="${k}" aria-pressed="${k === cur}" title="${l}">${icon(k)}</button>`).join('')}</div>`)); }
    if (want.heads) { const c = td ? { h0: 'none', h1: 'arrow' } : first('conn'); out.push(sec('Pointes', `<div class="heads"><div class="hrow"><small>Départ</small>${seg('h0', c.h0 || 'none', Object.keys(HEADS).map(k => [k, headIcon(k), HEADS[k]]), 'ic')}</div><div class="hrow"><small>Arrivée</small>${seg('h1', c.h1 || 'none', Object.keys(HEADS).map(k => [k, headIcon(k), HEADS[k]]), 'ic')}</div></div>`)); }
    if (want.route) out.push(sec('Tracé des flèches', seg('route', td ? bd.route : first('conn').route, [['curve', icon('conn'), 'Courbe'], ['straight', icon('line'), 'Droit'], ['elbow', icon('elbow'), 'Coudé']], 'ic') + `<div class="pp-hint">Glissez les ronds pour couder la flèche, double-clic sur un point pour le retirer. Clic sans glisser avec l’outil flèche : tracé point par point.</div>`));
    if (want.font) { const f = td ? bd.font : (first().font || HAND); out.push(sec('Police', seg('font', f, [[HAND, '<span style="font-family:var(--font-hand);font-size:17px">Aa</span>', 'Manuscrite'], [SANS, '<span>Aa</span>', 'Normale'], [MONO, '<span style="font-family:var(--font-mono);font-size:12px">Aa</span>', 'Code']], 'ic'))); }
    if (want.fs) out.push(sec('Taille du texte', seg('fs', fsLevel(first(has('text') ? 'text' : undefined) || first()), [[0, 'S'], [1, 'M'], [2, 'L'], [3, 'XL']])));
    if (want.al) out.push(sec('Alignement', seg('al', first().al || 'left', [['left', icon('al-l'), 'À gauche'], ['center', icon('al-c'), 'Centré'], ['right', icon('al-r'), 'À droite']], 'ic')));
    if (want.bold) out.push(sec('Graisse', seg('bold', one ? !!one.bold : false, [[false, 'Normal'], [true, '<b>Gras</b>']])));
    if (one && one.k === 'image') out.push(sec('Image', seg('frm', one.frm || 'shadow', [['shadow', 'Ombre'], ['polaroid', 'Polaroïd'], ['square', 'Carré'], ['none', 'Simple']]) + btnRow([['cap', 'text', 'Légende'], Assets.has(one.asset) ? ['view', 'focus', 'Voir en grand'] : null, one.href ? ['src', 'ext', isInsta(one.href) ? 'Voir sur Instagram' : 'Page d’origine'] : null].filter(Boolean))));
    if (one && one.k === 'shape') out.push(sec('Angles', seg('corner', one.sh === 'round' ? 'round' : 'sharp', [['sharp', icon('rect'), 'Vifs'], ['round', icon('round'), 'Arrondis']], 'ic')));
    if (list.length && list.every(i => i.k === 'frame')) { const f = first(); out.push(sec('Titre du cadre', seg('ftitle', !f.nt, [[true, 'Affiché'], [false, 'Masqué']]) + (f.nt ? '' : `<div style="height:8px"></div>` + seg('tfs', f.tfs ?? 1, [[0, 'S'], [1, 'M'], [2, 'L'], [3, 'XL']])))); }
    if (want.op) { const o = one ? (one.op ?? 1) : (first().op ?? 1); out.push(sec(`Opacité <b class="pv" data-v="op">${Math.round(o * 100)} %</b>`, `<input type="range" class="prange" data-prop="op" min=".05" max="1" step=".05" value="${o}" aria-label="Opacité">`)); }
    if (list.length) {
      out.push(sec('Calques', btnRow([['back', 'back', '', 'Tout en arrière'], ['bwd', 'down', '', 'Reculer'], ['fwd', 'up', '', 'Avancer'], ['front', 'front', '', 'Tout devant']])));
      const acts = [['dup', 'dup', 'Dupliquer', 'Dupliquer (Ctrl D)'], ['del', 'trash', 'Supprimer', 'Supprimer (Suppr)']];
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
  const ZICON = { note: 'sticky', text: 'text', shape: 'rect', image: 'image', file: 'file', link: 'link', ink: 'pen', mind: 'mind', frame: 'frame', task: 'tasks', doc: 'note', todo: 'todo', sheet: 'sheet', conn: 'conn' };
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
      else if (m.type === 'doc') { const d = docById(m.doc); if (!d || d.id === D.id) return ''; inner = `<div class="mth">${Thumbs.svg(d)}</div><span class="mn">${icon(d.type === 'board' ? 'board' : 'note', 'sm')}${esc(d.title)}</span>`; }
      return `<div class="mtile${used ? ' used' : ''}" draggable="true" data-media="${i}" title="${esc(m.name || m.title || '')} · glissez sur le board">${inner}${used ? `<span class="mused">${icon('check', 'sm')}</span>` : ''}</div>`;
    };
    return `<div class="mdrop" data-mdrop="1">${icon('upload')}<div>Déposez ici les documents du projet <b>${esc(sp ? sp.name : '')}</b> : images, PDF, fichiers.</div><button class="btn sm" data-madd="1">${icon('plus', 'sm')}Ajouter</button></div>
      <div class="mgrid">${media.map(tile).join('')}</div>
      ${media.length ? `<div class="pbtns"><button class="pb" data-mall="1">${icon('masonry')}<span>Tout placer sur le board</span></button></div>` : '<div class="pp-hint">Tout ce qui est déposé dans cet espace (notes, boards et ici) apparaît dans ce moodboard. Glissez une vignette sur le board pour l’y placer.</div>'}`;
  }
  function renderProps(force) {
    if (!propsOpen() || propsHold) return;
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
      case 'sc': return it.k === 'shape' || it.k === 'conn' ? { sc: v || '#1E1E1E' } : it.k === 'text' ? { color: v || '#1E1E1E' } : it.k === 'ink' || it.k === 'mind' ? { c: v || '#1E1E1E' } : null;
      case 'fc': return it.k === 'shape' ? { fc: v } : it.k === 'note' || it.k === 'todo' ? { c: v || '#FFFFFF' } : null;
      case 'fill': case 'sw': case 'dash': case 'sty': return it.k === 'shape' || it.k === 'conn' ? { [prop]: v } : null;
      case 'sh': return it.k === 'shape' ? { sh: v } : null;
      case 'corner': return it.k === 'shape' ? { sh: v === 'round' ? 'round' : 'rect' } : null;
      case 'h0': case 'h1': case 'route': return it.k === 'conn' ? { [prop]: v } : null;
      case 'font': return ['note', 'text', 'shape', 'todo'].includes(it.k) ? { font: v } : null;
      case 'fs': { const T = FS_TABLE[it.k]; return T ? { fs: T[clamp(+v, 0, 3)] } : null; }
      case 'al': return it.k === 'note' || it.k === 'text' ? { al: v } : null;
      case 'bold': return it.k === 'text' ? { bold: v === true || v === 'true' } : null;
      case 'ital': return it.k === 'text' ? { ital: v === true || v === 'true' } : null;
      case 'op': return { op: +v >= 1 ? undefined : +v };
      case 'frm': return it.k === 'image' ? { frm: v } : null;
      case 'ftitle': return it.k === 'frame' ? { nt: v === false || v === 'false' ? true : undefined } : null;
      case 'tfs': return it.k === 'frame' ? { tfs: clamp(+v, 0, 3) } : null;
    }
    return null;
  }
  function setProp(prop, v, live) {
    const list = selItems();
    const BDK = ['sc', 'fc', 'sw', 'sty', 'dash', 'fill', 'font', 'route'];
    if (BDK.includes(prop) && !live && !(prop === 'fc' && list.length && list.every(i => i.k === 'note' || i.k === 'todo'))) { S.prefs.bd = Object.assign({}, BD(), { [prop]: v }); save(); }
    if (prop === 'fc' && (!list.length ? tool === 'note' : list.every(i => i.k === 'note'))) noteColor = v || NOTE_COLORS[0];
    if (prop === 'sh' && !list.length) shapeKind = v;
    if (prop === 'bg') { D.bg = v; touch(D); host.className = host.className.replace(/bg-\w+/, 'bg-' + v); propSig = ''; renderProps(); return; }
    if (!list.length) { refreshTools(); propSig = ''; renderProps(); return; }
    const ids = new Set(list.map(i => i.id));
    if (prop === 'sc' && list.some(i => i.k === 'mind')) for (const i of list) if (i.k === 'mind') mindDesc(i.id, ids);
    const next = items.map(i => { if (!ids.has(i.id)) return i; const p = propPatch(i, prop, v); if (!p) return i; const o = Object.assign({}, i, p); if (p.op === undefined && 'op' in p) delete o.op; return o; });
    if (live) { if (!liveBefore) liveBefore = items; setLive(next); return; }
    commit(next, { before: liveBefore || items }); liveBefore = null;
  }
  function propsClick(e) {
    const t = e.target;
    const tab = t.closest('.ptab'); if (tab) { propsTab = tab.dataset.tab; propSig = ''; renderProps(); return; }
    if (t.closest('[data-a="close"]')) { setProps(false); return; }
    if (t.closest('[data-pp]')) return;
    const c = t.closest('[data-c]'); if (c) { const row = c.closest('[data-prop]'); if (row) { setProp(row.dataset.prop, c.dataset.c || null); return; } }
    const w = t.closest('[data-wheel]'); if (w) { const prop = w.dataset.wheel, list = selItems(); const cur = list.length ? propValue(list[0], prop) : (prop === 'fc' ? (tool === 'note' ? noteColor : BD().fc) : BD().sc); Colors.open(w, { value: cur || '#1E1E1E', none: prop === 'fc' && !(list.length && list.every(i => i.k === 'note' || i.k === 'todo')), onPick: (v, final) => setProp(prop, v, !final) }); return; }
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
    if (e.type === 'input') { propsHold = true; const lab = $(`[data-v="${r.dataset.prop}"]`, propsEl); if (lab) lab.textContent = Math.round(r.value * 100) + ' %'; setProp(r.dataset.prop, +r.value, true); }
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
    switch (a) {
      case 'help': helpModal(); return;
      case 'front': case 'back': case 'fwd': case 'bwd': zMove(a); return;
      case 'dup': duplicate(); return;
      case 'del': deleteSel(); return;
      case 'open': if (list[0]) openItem(list[0]); return;
      case 'view': if (list[0]) lightbox(list[0]); return;
      case 'src': if (list[0] && list[0].href) openItem({ k: 'link', url: list[0].href }); return;
      case 'label': if (list[0]) startEdit(list[0].id); return;
      case 'cap': { const it = list[0]; if (!it) return; const p = openPop(btn, `<div style="display:flex;gap:6px;padding:4px"><input id="capIn" value="${esc(it.cap)}" placeholder="Légende…" style="height:32px;border-radius:8px;border:1px solid var(--line-2);background:var(--raise);padding:0 10px;outline:0"><button class="btn sm pri" id="capOk">OK</button></div>`); const i = $('#capIn', p); i.focus(); const ok = () => { commit(replace(items, it, { cap: i.value, frm: i.value ? 'polaroid' : it.frm })); closePop(); }; $('#capOk', p).onclick = ok; i.onkeydown = e => { if (e.key === 'Enter') ok(); e.stopPropagation(); }; return; }
      case 'arrange': case 'arrangeIn': arrangeMenu(btn, a === 'arrangeIn'); return;
      case 'fitFrame': if (list[0]) fitFrame(list[0]); return;
      case 'frameSel': frameAround(list.filter(i => i.k !== 'conn')); return;
      case 'tasks': taskFilter = 'all'; go('tasks'); return;
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
    const K = [['Outils', [['V', 'Sélection'], ['H / Espace', 'Main'], ['R · O · D', 'Rectangle · Ellipse · Losange'], ['A', 'Flèche'], ['L', 'Ligne'], ['P', 'Stylo'], ['1 … 9', 'Choisir un pinceau (9 : crayon naturel)'], ['K / Alt + clic', 'Pipette sur le board'], ['E', 'Gomme'], ['T', 'Texte'], ['N', 'Post-it'], ['C', 'Liste à faire'], ['G', 'Tableur'], ['F', 'Zoom sur la sélection, ou tout voir'], ['I', 'Image ou fichier']]],
      ['Édition', [['Ctrl Z / Y', 'Annuler / Rétablir'], ['Ctrl D', 'Dupliquer'], ['Ctrl C / X / V', 'Copier, couper, coller'], ['Ctrl A', 'Tout sélectionner'], ['Suppr', 'Supprimer'], ['Entrée', 'Modifier le texte'], ['Flèches', 'Déplacer (Maj : par 10)'], ['Alt + glisser', 'Déplacer sans aimant'], ['Maj + glisser', 'Dupliquer et déplacer la copie'], ['Page ↑ / ↓', 'Avancer / reculer d’un plan'], ['Ctrl + Page ↑ / ↓', 'Tout devant / tout au fond'], ['Clic droit maintenu · appui long', 'Marking menu : outils, puis options (▸)'], ['Glisser un outil sur le board', 'Poser l’élément à cet endroit']]],
      ['Vue', [['Molette', S.prefs.wheel === 'zoom' ? 'Zoomer (Maj : défiler)' : 'Défiler (Ctrl : zoomer)'], ['Ctrl + / −', 'Zoomer / dézoomer'], ['0', 'Tout voir'], ['Ctrl 0', 'Zoom 100 %'], ['Ctrl .', 'Mode focus'], ['?', 'Cette aide']]],
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
    const scalable = i => i.k === 'image' || i.k === 'ink' || i.k === 'doc';
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
    const src = items.filter(i => ids.has(i.id) || (i.k === 'conn' && ids.has(i.a.id) && ids.has(i.b.id)));
    const map = new Map(src.map(i => [i.id, uid(i.id[0])]));
    return src.map(i => {
      const o = JSON.parse(JSON.stringify(i)); o.id = map.get(i.id);
      if (o.k === 'conn') { for (const e of ['a', 'b']) { if (o[e].id) { o[e].id = map.get(o[e].id) || null; if (!o[e].id) delete o[e].fx, delete o[e].fy; } else { if (o[e].on) { o[e].on = map.get(o[e].on); if (!o[e].on) delete o[e].on; } o[e].x += dx; o[e].y += dy; } } o.pts = (o.pts || []).map(p => [p[0] + dx, p[1] + dy]); o.sd = Math.random(); }
      else { o.x += dx; o.y += dy; }
      if (o.k === 'mind') { if (o.parent && map.has(o.parent)) o.parent = map.get(o.parent); else if (o.parent) o.parent = null; o.root = map.get(o.root) || o.id; if (!o.parent) o.root = o.id; }
      if (o.k === 'ink') o.p = i.p;
      if (o.k === 'shape') o.sd = Math.random();
      if (o.k === 'todo') { o.sd = Math.random(); o.tasks = o.tasks.map(id => { const t = taskById(id); if (!t) return null; const n = newTask({ t: t.t || 'Nouvelle tâche', sp: t.sp, due: t.due, time: t.time }); n.done = t.done; return n.id; }).filter(Boolean); }
      return o;
    });
  }
  function deleteSel() {
    if (!sel.size) return;
    const del = new Set(sel);
    for (const id of sel) { const i = byId.get(id); if (i && i.k === 'mind') mindDesc(id, del); }
    if (editing && del.has(editing)) { editing = null; editSub = null; }
    commit(items.filter(i => !del.has(i.id) && !(i.k === 'conn' && (del.has(i.a.id) || del.has(i.b.id)))));
    sel.clear(); schedule();
  }
  function toggleCheck(id, line) { const it = byId.get(id); if (!it) return; commit(replace(items, it, { txt: toggleLine(it.txt, line) })); }
  function openItem(it) {
    if (it.k === 'link') { const a = document.createElement('a'); a.href = it.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; document.body.append(a); a.click(); a.remove(); }
    if (it.k === 'doc' && docById(it.doc)) go('doc:' + it.doc);
    if (it.k === 'task') { taskFilter = 'all'; go('tasks'); }
    if (it.k === 'image' && Assets.has(it.asset)) lightbox(it);
  }
  function lightbox(it) { const u = Assets.url(it.asset); if (!u) return; const l = document.createElement('div'); l.className = 'lightbox'; l.innerHTML = `<img src="${u}" alt="${esc(it.cap || 'Image')}">`; l.onclick = () => l.remove(); document.body.append(l); }

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
    if (editing && (editing !== id || editSub !== (sub || null))) finishEdit();
    render();
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
      if (c0 && c0.k === 'mind' && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); finishEdit(); host.focus({ preventScroll: true }); return; }
      if ((c0 && (c0.k === 'frame' || c0.k === 'conn') && ev.key === 'Enter') || (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); finishEdit(); host.focus({ preventScroll: true }); }
    };
    const mySub = sub || null;
    el.onblur = () => setTimeout(() => { if (editing === id && editSub === mySub && el.isConnected && document.activeElement !== el) finishEdit(); }, 0);
    el.onpaste = ev => { ev.stopPropagation(); };
    schedule();
  }
  /* Enter adds a row under the current one, Backspace on an empty row removes it */
  function todoKey(ev, it, sub, el) {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); const after = sub === 'title' ? -1 : it.tasks.indexOf(sub); finishEdit(); todoAddRow(it.id, after); return; }
    if (ev.key === 'Backspace' && sub !== 'title' && !el.textContent.trim()) { ev.preventDefault(); const i = it.tasks.indexOf(sub); finishEdit(); const cur = byId.get(it.id); if (!cur) return; const prev = cur.tasks[Math.max(0, i - 1)]; if (prev && i > 0) startEdit(cur.id, null, prev); else startEdit(cur.id, null, 'title'); return; }
    if (ev.key === 'ArrowUp' && sub !== 'title') { const i = it.tasks.indexOf(sub); ev.preventDefault(); finishEdit(); const cur = byId.get(it.id); if (cur) startEdit(cur.id, null, i > 0 ? cur.tasks[i - 1] : 'title'); return; }
    if (ev.key === 'ArrowDown') { const i = sub === 'title' ? -1 : it.tasks.indexOf(sub); if (i < it.tasks.length - 1) { ev.preventDefault(); finishEdit(); const cur = byId.get(it.id); if (cur) startEdit(cur.id, null, cur.tasks[i + 1]); } return; }
  }
  function todoAddRow(id, after) {
    const it = byId.get(id); if (!it) return;
    const t = { id: uid('t'), t: '', sp: it.sp || D.sp, due: '', time: '', done: false, star: false, note: '', created: Date.now() };
    S.tasks.push(t);
    const tasks = it.tasks.slice(); tasks.splice(after + 1, 0, t.id);
    commit(replace(items, it, { tasks })); render(); startEdit(id, null, t.id);
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
      if (sub === 'title') { const v = raw.trim() || 'À faire'; if (v !== it.title) commit(replace(items, it, { title: v }), { before }); else schedule(); return; }
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
    if (kind === 'todo') it = mkTodo(w.x - 145 * s, w.y - 60 * s, 'À faire', [], { w: 290 * s, fs: Math.round(24 * s) });
    commit(items.concat(it)); sel = new Set([it.id]); setTool('select'); render(); startEdit(it.id);
    // a new text block starts with "Texte" selected, so typing replaces it
    if (kind === 'text' && editing === it.id) { const el = editEl(it); if (el) { const r = document.createRange(); r.selectNodeContents(el); const g = getSelection(); g.removeAllRanges(); g.addRange(r); } }
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
  function reveal(bb) { const r = hostRect(), a = toS(bb[0], bb[1]), b = toS(bb[2], bb[3]); if (a.x >= 20 && a.y >= 20 && b.x <= r.width - 20 && b.y <= r.height - 90) return; fitTo(bb, Math.min(1, view.k)); }
  function fitTo(bb, maxK = 1.2) {
    const r = hostRect(), pad = r.width < 600 ? 18 : 70, right = propsOpen() && r.width > 900 ? 300 : 0, W = Math.max(50, r.width - right - pad * 2), H = Math.max(50, r.height - pad * 2 - 60);
    const k = clamp(Math.min(W / Math.max(1, bb[2] - bb[0]), H / Math.max(1, bb[3] - bb[1]), maxK), MINK, MAXK);
    view.k = k; view.x = (r.width - right) / 2 - (bb[0] + bb[2]) / 2 * k; view.y = (r.height + 30) / 2 - (bb[1] + bb[3]) / 2 * k; viewChanged();
  }
  function fitAll() { const bb = unionBox(items.filter(i => i.k !== 'conn' && !i.hid)); if (bb) fitTo(bb); else { view.x = hostRect().width / 2; view.y = hostRect().height / 2; view.k = 1; viewChanged(); } }

  /* ---------- view ---------- */
  let viewT = 0;
  function viewChanged() {
    drawn++;
    world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
    world.style.setProperty('--iz', (1 / view.k).toFixed(4));
    let g = 24 * view.k; while (g < 12) g *= 4; while (g > 96) g /= 4;
    host.style.backgroundSize = `${g}px ${g}px`; host.style.backgroundPosition = `${view.x}px ${view.y}px`;
    renderOverlay();
    clearTimeout(viewT); viewT = setTimeout(() => { if (D) { D.view = { x: Math.round(view.x), y: Math.round(view.y), k: +view.k.toFixed(4) }; save(); } }, 300);
  }
  function zoomAt(sx, sy, f) { const k = clamp(view.k * f, MINK, MAXK); f = k / view.k; view.x = sx - (sx - view.x) * f; view.y = sy - (sy - view.y) * f; view.k = k; viewChanged(); }
  function zoomCenter(f) { const r = hostRect(); zoomAt(r.width / 2, r.height / 2, f); }
  function zoomTo(k) { const r = hostRect(), c = toW(r.left + r.width / 2, r.top + r.height / 2); view.k = clamp(k, MINK, MAXK); view.x = r.width / 2 - c.x * view.k; view.y = r.height / 2 - c.y * view.k; viewChanged(); }

  /* ---------- pointer interactions ---------- */
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
    if (e.button === 2 && !(op && op.keep) && e.pointerType !== 'touch') { e.preventDefault(); if (editing) finishEdit(); openMarking(e, hitAt(e)); return; }
    if (e.pointerType === 'touch' && !touches.size && !drawingTool()) holdFor(e);
    if (op && op.keep) { if (e.button === 0) { e.preventDefault(); op.click(e); } else if (e.button === 2) { e.preventDefault(); op.finish(); } return; }
    if (e.pointerType === 'touch') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2) { cancelOp(); startPinch(); return; } if (touches.size > 2) return; }
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
    const hd = t.closest('.hdl');
    if (hd) { e.preventDefault(); if (hd.dataset.ep) startEndpoint(e, hd.dataset.ep); else if ((hd.dataset.pt != null || hd.dataset.add != null) && (e.ctrlKey || e.metaKey)) startBranch(e); else if (hd.dataset.pt != null) { if (e.altKey) removePoint(+hd.dataset.pt); else startPoint(e, +hd.dataset.pt); } else if (hd.dataset.add != null) startPoint(e, +hd.dataset.add, true); else if (hd.dataset.tidy) startTidy(e); else if (hd.dataset.cd) startConn(e, toW(e.clientX, e.clientY), [...sel][0], hd.dataset.cd); else startResize(e, hd.dataset.h); return; }
    const ab = t.closest('[data-arr]'); if (ab) { e.preventDefault(); e.stopPropagation(); setTimeout(() => arrangeMenu(ab, false)); return; }
    if (e.pointerType === 'touch' && penSeen && (PENS[tool] || tool === 'eraser')) { startPan(e); return; }
    if (tool === 'pick' || (PENS[tool] && e.altKey)) { e.preventDefault(); pickAt(e); return; }
    if (PENS[tool]) { e.preventDefault(); startInk(e); return; }
    if (tool === 'eraser') { e.preventDefault(); startErase(e); return; }
    const w = toW(e.clientX, e.clientY), hit = hitAt(e);
    if (tool === 'select') {
      if (t.closest('a[href]') || t.closest('video,audio')) return;
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
      if (hit) {
        const was = sel.has(hit) && sel.size === 1;
        if (e.shiftKey && !e.ctrlKey && !e.metaKey) { startDupMove(e, w, hit); return; }
        if (e.ctrlKey || e.metaKey) { sel.has(hit) ? sel.delete(hit) : sel.add(hit); schedule(); return; }
        if (!sel.has(hit)) sel = new Set([hit]);
        startMove(e, w, was, t); return;
      }
      if (!e.shiftKey) sel.clear();
      if (e.pointerType === 'touch') startPan(e, true); else startMarquee(e, w, e.shiftKey);
      schedule(); return;
    }
    e.preventDefault();
    if (tool === 'note' || tool === 'text' || tool === 'mind' || tool === 'todo' || tool === 'sheet') { createAt(tool, w); return; }
    if (tool === 'shape' || tool === 'frame') { startRect(e, w); return; }
    if (tool === 'conn' || tool === 'line') { startConn(e, w, hit); return; }
  }
  function grab(e) { try { host.setPointerCapture(e.pointerId); } catch (_) {} }
  function cancelOp() { if (op && op.cancel) op.cancel(); op = null; marquee = null; guides = null; attachHi = null; host.classList.remove('panning'); schedule(); }
  function startPan(e, tapClear) {
    grab(e); host.classList.add('panning');
    const s = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; let moved = false;
    op = { id: e.pointerId, kind: 'pan', move(ev) { if (ev.pointerId !== this.id) return; const dx = ev.clientX - s.x, dy = ev.clientY - s.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; view.x = s.vx + dx; view.y = s.vy + dy; viewChanged(); },
      up() { host.classList.remove('panning'); if (tapClear && !moved) { sel.clear(); schedule(); } op = null; } };
  }
  function startPinch() {
    const [a, b] = [...touches.values()];
    const s = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, v: { ...view } };
    op = { kind: 'pinch', id: -1, move() { const [p, q] = [...touches.values()]; if (!q) return; const r = hostRect(), d = Math.hypot(p.x - q.x, p.y - q.y), cx = (p.x + q.x) / 2, cy = (p.y + q.y) / 2, k = clamp(s.v.k * d / s.d, MINK, MAXK);
      view.k = k; view.x = (cx - r.left) - ((s.cx - r.left) - s.v.x) * (k / s.v.k); view.y = (cy - r.top) - ((s.cy - r.top) - s.v.y) * (k / s.v.k); viewChanged(); },
      up() { if (touches.size < 2) op = null; } };
  }
  function moveSet() {
    const ids = new Set();
    for (const id of sel) {
      const it = byId.get(id); if (!it) continue; ids.add(id);
      if (it.k === 'frame') for (const c of frameChildren(it)) { ids.add(c.id); if (c.k === 'mind') mindDesc(c.id, ids); }
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
        if (!sel.has(hit)) sel = new Set([hit]);
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
    op = { id: e.pointerId, kind: 'move', moved: false,
      move(ev) {
        if (ev.pointerId !== this.id) return;
        const p = toW(ev.clientX, ev.clientY); let dx = p.x - w.x, dy = p.y - w.y;
        if (!this.moved) { if (Math.hypot(dx * view.k, dy * view.k) < 4) return; this.moved = true; cand = snapLines(ids); }
        guides = null;
        if (bb0 && !ev.altKey && !reparent) { const s = snap(bb0, dx, dy, cand); dx = s.dx; dy = s.dy; guides = s.g; }
        setLive(items.map(i => { const o = orig.get(i.id); if (!o) return i; if (o.k === 'conn') { const n = Object.assign({}, o); if (!o.a.id && !o.a.on) n.a = { x: o.a.x + dx, y: o.a.y + dy }; if (!o.b.id && !o.b.on) n.b = { x: o.b.x + dx, y: o.b.y + dy }; if (o.pts && o.pts.length && (!o.a.id || ids.has(o.a.id)) && (!o.b.id || ids.has(o.b.id))) n.pts = o.pts.map(q => [q[0] + dx, q[1] + dy]); return n; } return Object.assign({}, o, { x: o.x + dx, y: o.y + dy }); }));
        if (reparent) {
          const under = document.elementsFromPoint(ev.clientX, ev.clientY).map(el => el.closest && el.closest('.it.mind')).find(el => el && !ids.has(el.dataset.id));
          const tid = under ? under.dataset.id : null;
          if (tid !== dropT) { if (dropT && nodes.get(dropT)) nodes.get(dropT).classList.remove('drop'); dropT = tid; if (tid) nodes.get(tid).classList.add('drop'); }
        }
      },
      up(ev) {
        if (dropT && nodes.get(dropT)) nodes.get(dropT).classList.remove('drop');
        guides = null; const moved = this.moved; op = null;
        if (!moved) { const hitNow = one; if (wasSelected && hitNow && EDITABLE.includes(hitNow.k) && hitNow.k !== 'conn' && ev && ev.pointerType !== 'touch') startEdit(hitNow.id, null, hitNow.k === 'todo' ? (subKey || 'title') : undefined); schedule(); return; }
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
        commit(next, { before });
      },
      cancel() { setLive(before); } };
  }
  function snapLines(skip) {
    const xs = [], ys = [], r = hostRect(), vb = [toW(r.left, r.top).x, toW(r.left, r.top).y, toW(r.right, r.bottom).x, toW(r.right, r.bottom).y];
    for (const i of items) { if (skip.has(i.id) || i.k === 'conn' || i.k === 'ink' || i.hid || !boxHit(boxOf(i), vb)) continue; xs.push(i.x, i.x + i.w / 2, i.x + i.w); ys.push(i.y, i.y + i.h / 2, i.y + i.h); }
    return { xs, ys };
  }
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
    const list = selItems().filter(i => i.k !== 'conn' && i.k !== 'mind'); if (!list.length) return;
    const before = items, bb = unionBox(list), orig = new Map(list.map(i => [i.id, i]));
    const one = list.length === 1 ? list[0] : null;
    const lock = !one || ['image', 'ink', 'doc'].includes(one.k) || (one.k === 'text' && h.length === 2);
    const lay = canTidy(list) ? tidyPrep(list) : null;
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
          if (o.k === 'todo') { n.h = o.h; n.y = o.y; n.w = Math.max(160, n.w); }
          if (o.k === 'sheet') { const g = sheetGeom(o); if (one) { n.h = o.h; n.y = o.y; n.w = Math.max(g.hw + o.cols * (o.fs || 14) * 2.5, n.w); if (o.cw) { const kx = (n.w - g.hw) / (g.w - g.hw); n.cw = g.cws.map(v => v / g.fs * kx); } } else { n.fs = Math.max(8, Math.round((o.fs || 14) * sx)); n.h = sheetGeom(n).h; } }
          return n;
        }));
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
      up() { attachHi = null; op = null; commit(items, { before }); }, cancel() { attachHi = null; setLive(before); } };
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
      const id = underItem(ev, skip); attachHi = id;
      if (id) { const it = byId.get(id); return { id, fx: Math.round(clamp((p.x - it.x) / it.w, 0, 1) * 1000) / 1000, fy: Math.round(clamp((p.y - it.y) / it.h, 0, 1) * 1000) / 1000 }; }
    } else {
      const id = attachTarget(ev, skip); attachHi = id; if (id) return { id };
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
  const LINKABLE = it => it && !['conn', 'ink', 'mind'].includes(it.k);
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
    const from = pin ? { id: hit, fx: clamp((w.x - h.x) / h.w, 0, 1), fy: clamp((w.y - h.y) / h.h, 0, 1) } : h && h.k !== 'conn' && h.k !== 'ink' ? { id: hit } : { x: w.x, y: w.y };
    const before = items, c = mkConn(from, { x: w.x, y: w.y }, connOpts()), o = h ? [h.x + h.w / 2, h.y + h.h / 2] : [w.x, w.y];
    let moved = false;
    op = { id: e.pointerId, kind: 'conn', moved: false,
      move(ev) { const p = toW(ev.clientX, ev.clientY); if (!moved && Math.hypot((p.x - w.x) * view.k, (p.y - w.y) * view.k) < 6) return; moved = true; setLive(before.concat(Object.assign({}, c, { b: endFor(ev, from.id ? { id: from.id } : null, o, c.id) }))); },
      up() { attachHi = null; if (!moved) { if (side && h) { op = null; setLive(before); quickNode(h, side); return; } startPoly(c, from, before); return; } op = null; const last = items[items.length - 1]; commit(items, { before }); sel = new Set([last.id]); setTool('select'); },
      cancel() { attachHi = null; setLive(before); } };
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
    const before = items, fr = tool === 'frame', s = clamp(1 / view.k, .5, 4);
    const mk = (x, y, ww, hh) => fr ? mkFrame(x, y, ww, hh, 'Cadre') : mkShape(x, y, ww, hh, shapeKind, { fs: Math.round(26 * s) });
    const base = mk(w.x, w.y, 1, 1); let moved = false;
    op = { id: e.pointerId, kind: 'rect', moved: false,
      move(ev) { const p = toW(ev.clientX, ev.clientY); let dx = p.x - w.x, dy = p.y - w.y; if (!moved && Math.hypot(dx * view.k, dy * view.k) < 5) return; moved = true; if (ev.shiftKey) { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m; }
        const it = Object.assign({}, base, { x: Math.min(w.x, w.x + dx), y: Math.min(w.y, w.y + dy), w: Math.max(4, Math.abs(dx)), h: Math.max(4, Math.abs(dy)) }); setLive(fr ? [it].concat(before) : before.concat(it)); },
      up() { op = null; if (!moved) { const W = fr ? 480 : 180 * s, H = fr ? 320 : (shapeKind === 'pill' ? 70 : 120) * s; const it = Object.assign({}, base, { x: w.x - W / 2, y: w.y - H / 2, w: W, h: H }); setLive(fr ? [it].concat(before) : before.concat(it)); } commit(items, { before }); sel = new Set([base.id]); setTool('select'); if (fr) startEdit(base.id); },
      cancel() { setLive(before); } };
  }
  function startMarquee(e, w, add) {
    grab(e);
    const base = add ? new Set(sel) : new Set();
    op = { id: e.pointerId, kind: 'marquee', moved: false,
      move(ev) { const p = toW(ev.clientX, ev.clientY); this.moved = true; marquee = [w.x, w.y, p.x, p.y]; const b = [Math.min(w.x, p.x), Math.min(w.y, p.y), Math.max(w.x, p.x), Math.max(w.y, p.y)]; sel = new Set(base);
        for (const i of items) { if (i.hid) continue; if (i.k === 'conn') { const g = connGeom(i, byId); if (inBox(g.mid[0], g.mid[1], b)) sel.add(i.id); continue; } const q = boxOf(i); if (i.k === 'frame' ? (q[0] >= b[0] && q[1] >= b[1] && q[2] <= b[2] && q[3] <= b[3]) : boxHit(q, b)) { if (i.k === 'mind' && i.parent) continue; sel.add(i.id); } }
        schedule(); },
      up() { marquee = null; op = null; schedule(); } };
  }
  function startInk(e) {
    grab(e);
    const pk = penKind, pr = penPref(pk), def = PENS[pk];
    ink.begin(e, { t: pk, c: pr.c, s: pr.s / view.k, o: pr.o, smooth: pr.sm, k: view.k, b: brushOf(pr, view.k) });
    op = { id: e.pointerId, kind: 'ink', move(ev) { if (ev.pointerId === this.id) ink.feed(ev); },
      up() { op = null; const st = ink.end(); if (st && st.p.length >= 3) { if (st.p.length === 3) st.p.push(st.p[0] + .4 / view.k, st.p[1] + .2 / view.k, st.p[2]); commit(items.concat(mkInk(st))); useColor(st.c); if (Studio.on) Studio.refresh('history'); } },
      cancel() { ink.cancel(); } };
  }
  function startErase(e) {
    grab(e);
    const before = items; let gone = new Set();
    const at = ev => { const p = toW(ev.clientX, ev.clientY), r = 12 / view.k; const hit = items.filter(i => i.k === 'ink' && !i.hid && !gone.has(i.id) && inBox(p.x, p.y, [i.x - r, i.y - r, i.x + i.w + r, i.y + i.h + r]) && inkHit(i.p, i.s, (p.x - i.x) * i.w0 / i.w, (p.y - i.y) * i.h0 / i.h, r * i.w0 / i.w)); if (hit.length) { hit.forEach(i => gone.add(i.id)); setLive(items.filter(i => !gone.has(i.id))); } };
    at(e);
    op = { id: e.pointerId, kind: 'erase', move(ev) { if (ev.pointerId !== this.id) return; const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]; for (const x of evs.length ? evs : [ev]) at(x); eraserAt = clientToHost(ev); renderOverlay(); },
      up() { op = null; if (gone.size) commit(items, { before }); }, cancel() { setLive(before); } };
  }
  const clientToHost = ev => { const r = hostRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  function onMove(e) {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
  let pickBack = null;
  function pickAt(e) {
    const s = snapshot(); if (!s) return; const c = s.at(e.clientX - s.left, e.clientY - s.top);
    S.prefs.pens[penKind].c = c; save(); Studio.picked(c, e.clientX - 0, e.clientY - 0);
    if (tool === 'pick' && !e.shiftKey) { Studio.hideLoupe(); setTool(pickBack && (PENS[pickBack] || pickBack === 'eraser') ? (pickBack === 'eraser' ? penKind : pickBack) : penKind); }
    else refreshTools();
  }
  function onUp(e) {
    if (e.pointerType === 'touch') touches.delete(e.pointerId);
    if (op && op.keep) return;
    if (op && (op.id === e.pointerId || op.kind === 'pinch')) { const o = op; o.up(e); if (op === o) op = null; schedule(); }
  }
  function onCancel(e) { if (e.pointerType === 'touch') touches.delete(e.pointerId); if (op && op.id === e.pointerId) cancelOp(); }
  function onDbl(e) {
    if (op && op.keep) { e.preventDefault(); op.finish(); return; }
    if (tool !== 'select') return;
    const pt = e.target.closest('.hdl[data-pt]'); if (pt) { removePoint(+pt.dataset.pt); return; }
    const hit = hitAt(e);
    if (!hit) { const w = toW(e.clientX, e.clientY); createAt('note', w); return; }
    const it = byId.get(hit);
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
    else { view.x -= e.shiftKey && !dx ? dy : dx; view.y -= e.shiftKey && !dx ? 0 : dy; viewChanged(); }
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
    const types = [...(e.dataTransfer.types || [])]; if (types.includes(DRAG_T)) return;
    if (propsEl.contains(e.target)) { e.preventDefault(); e.dataTransfer.dropEffect = types.includes('Files') ? 'copy' : 'none'; const z = $('[data-mdrop]', propsEl); if (z) z.classList.toggle('over', types.includes('Files')); return; }
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    if (!mediaDrag) { let z = $('.dropzone', wrap); if (!z) { z = document.createElement('div'); z.className = 'dropzone'; z.innerHTML = `<div>${icon('upload')}Déposez ici : images, liens, fichiers ou texte</div>`; wrap.append(z); } }
    const ph = placeholderAt(e.clientX, e.clientY);
    if (ph !== dropHi) { if (dropHi && nodes.get(dropHi)) nodes.get(dropHi).classList.remove('over'); dropHi = ph; if (ph) nodes.get(ph).classList.add('over'); }
  }
  function clearDrop() { const z = $('.dropzone', wrap); if (z) z.remove(); if (dropHi && nodes.get(dropHi)) nodes.get(dropHi).classList.remove('over'); dropHi = null; const mz = $('[data-mdrop]', propsEl); if (mz) mz.classList.remove('over'); }
  function onDragLeave(e) { if (!e.relatedTarget || !wrap.contains(e.relatedTarget)) clearDrop(); }
  async function onDrop(e) {
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
  async function onPaste(e) {
    if (editing) return;
    const dt = e.clipboardData; if (!dt) return;
    const txt = dt.getData('text/plain'), hasFile = (dt.files && dt.files.length) || [...(dt.items || [])].some(i => i.kind === 'file');
    { const sh = sheetSelOf(); if (sh && txt && !hasFile) { e.preventDefault(); sheetPaste(sh, txt); return; } }
    if (!hasFile && clip && (!txt || txt === clip.text)) { e.preventDefault(); pasteClip(); return; }
    e.preventDefault(); await ingest(dt, centerW());
  }

  /* ---------- keyboard ---------- */
  const TOOL_KEYS = { v: 'select', h: 'hand', p: 'pen', e: 'eraser', n: 'note', t: 'text', r: 'shape', o: 'shape', d: 'shape', a: 'conn', l: 'line', c: 'todo', g: 'sheet', k: 'pick', b: 'pen' };
  function key(e) {
    if (!mounted || editing) return false;
    const t = e.target; if (t && (t.closest('input,textarea,select,[contenteditable="true"],[contenteditable="plaintext-only"]'))) return false;
    const mod = e.ctrlKey || e.metaKey, k = e.key;
    if (op && op.keep) { if (k === 'Enter') { op.finish(); e.preventDefault(); return true; } if (k === 'Escape') { cancelOp(); e.preventDefault(); return true; } }
    { const sh = sheetSelOf(); if (sh && sheetSelKey(e, sh)) return true; }
    /* layer order: Page Up / Down one step, with Ctrl all the way to the front / back */
    if ((k === 'PageUp' || k === 'PageDown') && sel.size) { e.preventDefault(); zMove(k === 'PageUp' ? (mod ? 'front' : 'fwd') : (mod ? 'back' : 'bwd')); return true; }
    if (k === ' ' && !e.repeat) { spaceDown = true; host.classList.add('t-hand'); e.preventDefault(); return true; }
    if (mod) {
      const lk = k.toLowerCase();
      if (lk === 'z') { e.shiftKey ? redo() : undo(); e.preventDefault(); return true; }
      if (lk === 'y') { redo(); e.preventDefault(); return true; }
      if (lk === 'a') { sel = new Set(items.filter(i => !(i.k === 'mind' && i.parent) && !i.hid).map(i => i.id)); schedule(); e.preventDefault(); return true; }
      if (lk === 'd') { duplicate(); e.preventDefault(); return true; }
      if (lk === 'c') { if (getSelection().toString()) return false; copy(false); return true; }
      if (lk === 'x') { copy(true); e.preventDefault(); return true; }
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
    if ((k === 'Enter' || k === 'F2') && one) { e.preventDefault(); startEdit(one.id); return true; }
    if (k.startsWith('Arrow') && sel.size) { e.preventDefault(); const d = e.shiftKey ? 10 : 1, dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, dy = k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0; const ids = moveSet(); commit(items.map(i => ids.has(i.id) && i.k !== 'conn' ? Object.assign({}, i, { x: i.x + dx, y: i.y + dy }) : i)); return true; }
    if ((k === 'f' || k === 'F') && !mod && !e.altKey) { if (sel.size) fitTo(unionBox(selItems())); else fitAll(); return true; }   // F: frame the selection, or the whole board
    if (one && k.length === 1 && !e.altKey && ['note', 'shape', 'mind', 'text', 'sheet'].includes(one.k)) { e.preventDefault(); startEdit(one.id, k); return true; }
    if (k === '0' || (e.shiftKey && k === '!')) { fitAll(); return true; }
    if (k === '+' || k === '=') { zoomCenter(1.25); return true; }
    if (k === '-') { zoomCenter(.8); return true; }
    if (/^[1-9]$/.test(k) && !e.altKey) { const pk = PEN_ORDER[+k - 1]; if (pk) { setTool(pk); return true; } }
    const lk = k.toLowerCase();
    if (lk === 'i') { pickFiles(); return true; }
    if (TOOL_KEYS[lk]) { if (lk === 'o') shapeKind = 'ellipse'; if (lk === 'r') shapeKind = 'rect'; if (lk === 'd') shapeKind = 'diamond'; setTool(TOOL_KEYS[lk] === 'pen' ? penKind : TOOL_KEYS[lk]); return true; }
    return false;
  }
  function keyUp(e) { if (e.key === ' ') { spaceDown = false; host.classList.toggle('t-hand', tool === 'hand'); } }

  /* ---------- tools and islands ---------- */
  function setTool(t) {
    if (editing) finishEdit();
    if (op && op.keep) cancelOp();
    attachHi = null;
    if (t === 'pick' && tool !== 'pick') pickBack = tool;
    tool = t; if (PENS[t]) penKind = t;
    if (!['select', 'hand', 'pick'].includes(t)) lastTool = t;
    host.className = 'bhost bg-' + (D.bg || 'dots') + ' t-' + (PENS[t] ? 'ink' : t);
    const was = wrap.classList.contains('drawing'); wrap.classList.toggle('drawing', drawingTool());
    if (t !== 'pick') Studio.hideLoupe();
    refreshTools(); eraserAt = null; propSig = ''; schedule(); Studio.sync();
    if (was !== drawingTool()) layoutChanged();
  }
  const drawingTool = () => !!(PENS[tool] || tool === 'eraser' || tool === 'pick');
  const TOOLS = [['select', 'cursor', 'Sélection', 'V'], ['hand', 'hand', 'Main', 'H'], '|', ['shape', 'rect', 'Forme', 'R'], ['conn', 'conn', 'Flèche', 'A'], ['line', 'line', 'Ligne', 'L'], ['pen', 'pen', 'Stylo', 'P'], ['eraser', 'eraser', 'Gomme', 'E'], '|', ['text', 'text', 'Texte', 'T'], ['note', 'sticky', 'Post-it', 'N'], ['todo', 'todo', 'Liste à faire', 'C'], ['sheet', 'sheet', 'Tableur', 'G'], ['frame', 'frame', 'Cadre', ''], ['upload', 'image', 'Image ou fichier', 'I'], '|', ['more', 'dots', 'Plus : tâches, liens', '']];
  function refreshTools() {
    toolsEl.innerHTML = TOOLS.map(d => d === '|' ? '<span class="vs"></span>' : (() => {
      const [id, ic, title, k] = d, on = id === 'pen' ? !!PENS[tool] : tool === id;
      const ico = id === 'pen' ? PENS[penKind].icon : id === 'shape' ? (shapeKind === 'starsh' ? 'starsh' : shapeKind) : ic;
      const dot = id === 'pen' ? `<span class="cdot" style="background:${penPref(penKind).c}"></span>` : id === 'note' ? `<span class="cdot" style="background:${noteColor}"></span>` : '';
      return `<button class="tl" data-tool="${id}" title="${title}${k ? ` (${k})` : ''}" aria-label="${title}" aria-pressed="${on}">${icon(ico)}${dot}${k ? `<kbd>${k}</kbd>` : ''}</button>`;
    })()).join('');
    renderOpts();
  }
  /* the second bar: the options of the tool chosen in the first one, for what it is about to draw
     (themes that float the dock show it under the tools; the others keep it hidden) */
  function renderOpts() {
    if (!optsEl) return;
    const bd = BD(), T = tool, L = (d, a) => `<span class="ol">${a}</span>${d}`;
    const pline = (d, extra = '') => `<svg viewBox="0 0 40 16" class="pl"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"${extra}/></svg>`;
    const sw = () => seg('sw', bd.sw || 2, [[1, pline('M4 8h32', ' stroke-width="1.4"'), 'Fin'], [2, pline('M4 8h32', ' stroke-width="2.6"'), 'Moyen'], [4, pline('M4 8h32', ' stroke-width="4.2"'), 'Épais']], 'ic');
    const dash = () => seg('dash', bd.dash || '', [['', pline('M4 8h32'), 'Continu'], ['dash', pline('M4 8h32', ' stroke-dasharray="6 4"'), 'Tirets'], ['dot', pline('M4 8h32', ' stroke-dasharray="1 4"'), 'Pointillés']], 'ic');
    const font = () => seg('font', bd.font || HAND, [[HAND, '<span style="font-family:var(--font-hand);font-size:16px">Aa</span>', 'Manuscrite'], [SANS, '<span>Aa</span>', 'Normale'], [MONO, '<span style="font-family:var(--font-mono);font-size:12px">Aa</span>', 'Code']], 'ic');
    const sc = () => Colors.row(themeColors('stroke', STROKE_COLORS), bd.sc || '#1E1E1E', 'sc');
    let h = '';
    if (T === 'shape') h = [seg('sh', shapeKind, Object.entries(SHAPES).map(([k, l]) => [k, icon(k), l]), 'ic'), sc(), Colors.row(themeColors('fill', FILL_COLORS), bd.fc, 'fc', { none: true }), sw()].join('<span class="vs"></span>');
    else if (T === 'conn') h = [sc(), seg('route', bd.route || 'curve', [['curve', icon('conn'), 'Courbe'], ['straight', icon('line'), 'Droit'], ['elbow', icon('elbow'), 'Coudé']], 'ic'), sw(), dash()].join('<span class="vs"></span>');
    else if (T === 'line') h = [sc(), sw(), dash()].join('<span class="vs"></span>');
    else if (T === 'text') h = [sc(), font()].join('<span class="vs"></span>');
    else if (T === 'note') h = [Colors.row(themeColors('note', NOTE_COLORS).slice(0, 6), noteColor, 'fc'), font()].join('<span class="vs"></span>');
    else if (T === 'todo') h = font();
    else if (PENS[T] || T === 'eraser') {
      const pr = penPref(penKind), cols = penKind === 'highlight' ? themeColors('hl', HL_COLORS) : themeColors('ink', INK_COLORS);
      h = `<div class="seg sm ic">${PEN_ORDER.slice(0, 8).map(k => `<button data-tool="${k}" title="${PENS[k].name}" aria-pressed="${T === k}">${icon(PENS[k].icon)}</button>`).join('')}<button data-tool="eraser" title="Gomme" aria-pressed="${T === 'eraser'}">${icon('eraser')}</button></div>`
        + (T === 'eraser' ? '' : `<span class="vs"></span><button class="pchip" data-opp="1" title="${PENS[penKind].name} : taille, flux, forme, texture">${brushPreview(penKind, Object.assign({}, pr, { s: Math.min(pr.s, 14) }), 72, 22)}<span>${pr.s}</span></button>
        <span class="vs"></span><div class="sws">${cols.slice(0, 6).map(c => `<button class="sw" data-pcol="${c}" style="background:${c}" aria-pressed="${pr.c.toUpperCase() === c.toUpperCase()}" aria-label="Couleur ${c}"></button>`).join('')}<button class="sw cur" data-pwheel="1" style="background:${pr.c}" title="Roue des couleurs" aria-label="Roue des couleurs">${icon('wheel', 'sm')}</button></div>`);
    }
    optsEl.innerHTML = h; optsEl.hidden = !h;
  }
  function optsClick(e) {
    const t = e.target;
    const tb = t.closest('[data-tool]'); if (tb) { setTool(tb.dataset.tool); return; }
    const pc = t.closest('[data-pcol]'); if (pc) { S.prefs.pens[penKind].c = pc.dataset.pcol; save(); refreshTools(); Studio.sync(); return; }
    const pw = t.closest('[data-pwheel]'); if (pw) { radialPop(pw, { get: () => penPref(penKind).c, set: (v, final) => { S.prefs.pens[penKind].c = v; save(); pw.style.background = v; if (final) { refreshTools(); Studio.sync(); } } }); return; }
    const pp = t.closest('[data-opp]'); if (pp) { const pop = openPop(pp, `<div class="pp-wrap">${PenPanel.html(penKind)}</div>`, { cls: 'pppop', focus: false }); PenPanel.bind(pop, { pen: () => penKind, setPen: k => { closePop(); setTool(k); }, changed: partial => { if (!partial) { refreshTools(); propSig = ''; renderProps(); } } }); return; }
    propsClick(e);
  }
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
      const mv = ev => { S.prefs.dock = { x: Math.round(clamp(ev.clientX - wr.left - dx, 8, wr.width - r.width - 8)), y: Math.round(clamp(ev.clientY - wr.top - dy, 8, wr.height - r.height - 8)) }; placeDock(); };
      const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); dockEl.classList.remove('dragging'); save(); };
      dockEl.classList.add('dragging'); grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
    });
    grip.addEventListener('dblclick', () => { delete S.prefs.dock; save(); placeDock(); });
    optsEl.addEventListener('pointerdown', e => { if (!e.target.closest('input')) e.preventDefault(); });
    optsEl.addEventListener('click', optsClick);
  }
  function pickFiles() { const i = $('#fileIn'); i.accept = ''; i.onchange = async () => { const files = [...i.files]; i.value = ''; if (files.length) await ingest({ files, getData: () => '' }, centerW()); }; i.click(); }
  function moreMenu(btn) {
    openPop(btn, [{ head: 'Insérer' }, { label: 'Tâche de l’espace', icon: 'tasks', run: () => insertTask() }, { label: 'Lien vers une note ou un board', icon: 'note', run: () => insertDocRef(btn) }, { label: 'Lien web…', icon: 'link', run: () => insertLink(btn) },
      '-', { head: 'Fond' }, ...[['dots', 'Points'], ['grid', 'Quadrillage'], ['plain', 'Uni']].map(([b, l]) => ({ label: l, small: (D.bg || 'dots') === b ? 'actuel' : '', run: () => setProp('bg', b) })),
      '-', { label: 'Raccourcis clavier', icon: 'help', small: '?', run: helpModal }]);
  }
  function insertTask() { const c = centerW(), t = newTask({ t: 'Nouvelle tâche', sp: D.sp }); const it = { id: uid('t'), k: 'task', x: c.x - 140, y: c.y - 28, w: 280, h: 56, task: t.id }; commit(items.concat(it)); sel = new Set([it.id]); renderSide(); toast('Tâche ajoutée à ' + ((spaceById(D.sp) || {}).name || 'la liste'), { label: 'La renommer', run: () => { go('tasks'); setTimeout(() => { const row = $(`[data-task="${t.id}"]`); if (row) toggleTaskEdit(row, t, () => go('tasks')); }, 30); } }); }
  function insertDocRef(btn) { const list = liveDocs().filter(d => d.id !== D.id).sort((a, b) => b.updated - a.updated); openPop(btn, list.length ? list.slice(0, 14).map(d => ({ label: d.title, icon: d.type === 'board' ? 'board' : 'note', run: () => { const c = centerW(); const it = { id: uid('d'), k: 'doc', x: c.x - 110, y: c.y - 90, w: 220, h: 180, doc: d.id }; commit(items.concat(it)); sel = new Set([it.id]); } })) : [{ label: 'Aucun autre document', run: () => {} }]); }
  function insertLink(btn) { const p = openPop(btn, `<div style="display:flex;gap:6px;padding:4px"><input id="lnIn" placeholder="https://…" style="height:34px;width:240px;border-radius:8px;border:1px solid var(--line-2);background:var(--raise);padding:0 10px;outline:0"><button class="btn sm pri" id="lnOk">Ajouter</button></div>`); const i = $('#lnIn', p); i.focus(); const ok = () => { let u = i.value.trim(); if (!u) return; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; closePop(); ingest({ getData: k => k === 'text/plain' ? u : '', files: [] }, centerW()); }; $('#lnOk', p).onclick = ok; i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ok(); }; }
  function layoutChanged() { if (mounted) setTimeout(() => { ink.resize(); renderOverlay(); }, 30); }

  /* ---------- mount ---------- */
  function mount(container, doc) {
    D = doc; items = (doc.items || []).slice(); reindex(); hist = []; fut = []; sel = new Set(); editing = null; editSub = null; op = null; nodes.clear(); fitCache.clear(); propSig = ''; qSig = ''; propsTab = 'style';
    const open = S.prefs.props == null ? innerWidth >= 1100 : !!S.prefs.props;
    container.innerHTML = `<div class="bwrap${open ? ' props-open' : ''}" style="position:absolute;inset:0">
      <div class="bhost bg-${doc.bg || 'dots'}" tabindex="-1" aria-label="Board ${esc(doc.title)}"><div class="world"><div class="layer"></div><svg class="edges"></svg><div class="layer"></div><svg class="edges"></svg><div class="layer"></div></div><canvas class="blive"></canvas><div class="ovl"></div><div class="measure it"></div></div>
      <div class="tdock"><div class="trow"><button class="tgrip" title="Glisser pour déplacer les barres · double-clic pour les remettre en place" aria-label="Déplacer les barres d’outils"></button><nav class="isl tools" aria-label="Outils"></nav></div><div class="isl topts" role="toolbar" aria-label="Options de l’outil" hidden></div></div>
      <div class="isl tr"><button class="tl" data-a="props" title="Style, calques et moodboard" aria-label="Panneau" aria-pressed="${open}">${icon('sliders')}<span>Style</span></button></div>
      <div class="qbar" hidden></div>
      <aside class="props"${open ? '' : ' hidden'} aria-label="Propriétés"><div class="phead"><button class="ptab" data-tab="style">Style</button><button class="ptab" data-tab="layers">Calques</button><button class="ptab" data-tab="media">Moodboard</button><button class="pclose" data-a="close" aria-label="Fermer">${icon('x', 'sm')}</button></div><div class="pbody"></div></aside>
      <div class="isl bl zoom"><button class="tl" data-a="zout" title="Dézoomer (−)" aria-label="Dézoomer">${icon('zout')}</button><button class="zv" data-a="z100" title="Revenir à 100 %">100 %</button><button class="tl" data-a="zin" title="Zoomer (+)" aria-label="Zoomer">${icon('zin')}</button></div>
      <div class="isl bl undo"><button class="tl" data-a="undo" title="Annuler (Ctrl Z)" aria-label="Annuler">${icon('undo')}</button><button class="tl" data-a="redo" title="Rétablir (Ctrl Y)" aria-label="Rétablir">${icon('redo')}</button></div>
      <div class="isl br"><button class="tl" data-a="fit" title="Tout voir (F ou 0)" aria-label="Tout voir">${icon('fit')}</button><button class="tl" data-a="help" title="Raccourcis (?)" aria-label="Aide">${icon('help')}</button></div></div>`;
    wrap = container.firstElementChild; host = $('.bhost', wrap); world = $('.world', host);
    [framesL, edges, itemsL, edgesTop, labelsL] = world.children; ovl = $('.ovl', host); liveCv = $('.blive', host); meas = $('.measure', host);
    toolsEl = $('.tools', wrap); optsEl = $('.topts', wrap); dockEl = $('.tdock', wrap); trEl = $('.tr', wrap); propsEl = $('.props', wrap); qbarEl = $('.qbar', wrap); zoomEl = $('.isl.zoom', wrap); undoEl = $('.isl.undo', wrap); brEl = $('.isl.br', wrap);
    ink = new InkCapture(liveCv, { toLocal: (x, y) => toW(x, y), xf: () => ({ k: view.k, ox: view.x, oy: view.y }) });
    mounted = true;
    Studio.mount(wrap, { drawing: drawingTool, tool: () => tool, pen: () => penKind, setTool, space: () => D && D.sp,
      color: () => penPref(penKind).c,
      setColor(c, final) { S.prefs.pens[penKind].c = c; save(); const d = $('[data-tool="pen"] .cdot', toolsEl); if (d) d.style.background = c; if (final) refreshTools(); },
      changed(partial) { propSig = ''; refreshTools(); if (!partial) Studio.sync(); } });
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
    trEl.onclick = e => { if (!e.target.closest('[data-a="props"]')) return; if (drawingTool()) { Studio.toggleCard('brush'); return; } setProps(!propsOpen()); };
    propsEl.addEventListener('click', propsClick);
    propsEl.addEventListener('input', propsInput); propsEl.addEventListener('change', propsInput);
    propsEl.addEventListener('keydown', e => e.stopPropagation());
    propsEl.addEventListener('dragstart', e => { const t = e.target.closest('[data-media]'); if (!t) return; const m = spaceMedia(D.sp)[+t.dataset.media]; if (!m) return; mediaDrag = true; e.dataTransfer.setData('application/x-notely', JSON.stringify(m)); e.dataTransfer.setData('text/plain', m.name || m.title || m.url || ''); e.dataTransfer.effectAllowed = 'copy'; });
    propsEl.addEventListener('dragend', () => { mediaDrag = false; clearDrop(); });
    propsEl.addEventListener('contextmenu', e => { const t = e.target.closest('[data-media]'); if (!t) return; e.preventDefault(); const m = spaceMedia(D.sp)[+t.dataset.media], sp = spaceById(D.sp); if (!m) return; openPop({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, [{ label: 'Placer sur le board', icon: 'board', run: () => placeMedia([m]) }, ...(sp && (sp.media || []).includes(m) ? [{ label: 'Retirer du moodboard', icon: 'trash', danger: true, run: () => { sp.media = sp.media.filter(x => x !== m); save(); propSig = ''; renderProps(); } }] : [])]); });
    qbarEl.addEventListener('pointerdown', e => e.preventDefault());
    qbarEl.onclick = e => { const b = e.target.closest('[data-q]'); if (b) quickAction(b.dataset.q, b); };
    undoEl.onclick = e => { const b = e.target.closest('[data-a]'); if (b) (b.dataset.a === 'undo' ? undo : redo)(); };
    zoomEl.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; if (a === 'zin') zoomCenter(1.25); if (a === 'zout') zoomCenter(.8); if (a === 'z100') zoomTo(1); };
    brEl.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'fit') fitAll(); if (b.dataset.a === 'help') helpModal(); };
    ro = new ResizeObserver(() => { if (mounted) { ink.resize(); renderOverlay(); placeDock(); } }); ro.observe(host);
    tool = 'select'; setTool('select');
    items = relayout(items); reindex(); D.items = items;
    render();
    if (doc.view && isFinite(doc.view.k)) { view.x = doc.view.x; view.y = doc.view.y; view.k = clamp(doc.view.k, MINK, MAXK); viewChanged(); } else fitAll();
    updateUndo();
    if (!S.prefs.boardHint) { S.prefs.boardHint = 1; save(); toolHint('Double-clic : post-it · P : stylo · A : flèche · glissez images et fichiers ici'); }
    setTimeout(() => { if (mounted) host.focus({ preventScroll: true }); }, 0);
  }
  let ro = null;
  function unmount() {
    if (!mounted) return;
    if (editing) finishEdit();
    if (op && op.keep) cancelOp();
    closeMarking(); mounted = false; cancelAnimationFrame(raf); raf = 0; Studio.unmount(); shot = null;
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onCancel);
    if (ro) ro.disconnect();
    if (D) { D.view = { x: Math.round(view.x), y: Math.round(view.y), k: +view.k.toFixed(4) }; D.items = items; save(); }
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
    return { text: 'Texte', note: 'Post-it', todo: 'Liste à faire', sheet: 'Tableur', frame: 'Cadre', line: 'Ligne', eraser: 'Gomme', mind: 'Mindmap' }[t] || t;
  }
  /* new items take the board defaults: an option chosen here becomes that default, then the tool is picked */
  const pickOpt = (t, prop, v) => () => { if (prop) setProp(prop, v); setTool(t); };
  function mmToolItems(w) {
    const canPaste = clip || (navigator.clipboard && navigator.clipboard.read);
    return around([
      lastTool ? { label: '↺ ' + toolLabel(lastTool), run: () => setTool(lastTool === 'pen' ? penKind : lastTool) } : { label: 'Main', run: () => setTool('hand') },
      { label: 'Texte', run: () => setTool('text'), sub: () => around(FONTS.map(([f, l]) => ({ label: l, on: (BD().font || HAND) === f, font: f, run: pickOpt('text', 'font', f) }))) },
      { label: SHAPES[shapeKind] || 'Forme', run: () => setTool('shape'), sub: () => around(['rect', 'round', 'ellipse', 'diamond', 'tri', 'hex', 'starsh', 'cloud'].map(k => ({ label: SHAPES[k], on: shapeKind === k, run: () => { shapeKind = k; setTool('shape'); } }))) },
      { label: 'Post-it', sw: noteColor, run: () => setTool('note'), sub: () => around(NOTE_COLORS.map((c, i) => ({ label: NOTE_NAMES[i] || c, sw: c, on: c === noteColor, run: () => { noteColor = c; setTool('note'); } }))) },
      { label: PENS[penKind].name, run: () => setTool(penKind), sub: () => around(PEN_ORDER.filter(k => PENS[k]).slice(0, 8).map(k => ({ label: PENS[k].name, on: k === penKind, run: () => setTool(k) }))) },
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
    const colors = list.every(i => i.k === 'note' || i.k === 'todo') ? ['fc', NOTE_COLORS] : list.some(i => propPatch(i, 'sc', '#000')) ? ['sc', themeColors('stroke', STROKE_COLORS)] : null;
    const sizeIt = sized ? { label: 'Taille', run: null, sub: () => around(['S', 'M', 'L', 'XL'].map((l, i) => ({ label: l, on: fsLevel(sized) === i, run: () => setProp('fs', i) }))) } : null;
    const fontIt = list.some(i => propPatch(i, 'font', HAND)) ? { label: 'Police', run: null, sub: () => around(FONTS.map(([f, l]) => ({ label: l, on: f0 === f, font: f, run: () => setProp('font', f) }))) } : null;
    const colorIt = colors ? { label: 'Couleur', run: null, sub: () => around(colors[1].map((c, i) => ({ label: (colors[0] === 'fc' ? NOTE_NAMES : ['Noir', 'Rouge', 'Vert', 'Bleu', 'Orange', 'Violet', 'Gris', 'Blanc'])[i] || 'Couleur', sw: c, on: one && propValue(one, colors[0]) === c, run: () => setProp(colors[0], c) }))) } : null;
    const alignIt = list.some(i => propPatch(i, 'al', 'left')) ? { label: 'Alignement', run: null, sub: () => around([['left', 'À gauche'], ['center', 'Centré'], ['right', 'À droite']].map(([v, l]) => ({ label: l, on: (one ? one.al || 'left' : '') === v, run: () => setProp('al', v) }))) } : null;
    const editIt = one && EDITABLE.includes(one.k) ? { label: one.k === 'frame' ? 'Renommer' : 'Modifier', run: () => startEdit(one.id) } : null;
    const hide = () => { const ids = new Set(sel); commit(items.map(i => ids.has(i.id) ? Object.assign({}, i, { hid: true }) : i)); sel.clear(); };
    const more = { label: 'Plus', run: null, sub: () => around([
      { label: 'Premier plan', run: () => zMove('front') }, { label: 'Avancer', run: () => zMove('fwd') }, { label: 'Style et calques', run: () => { setProps(true); propsTab = 'style'; renderProps(true); } },
      { label: 'Copier', run: () => copy(false) }, { label: 'Arrière-plan', run: () => zMove('back') }, { label: 'Reculer', run: () => zMove('bwd') },
      sel.size > 1 ? { label: 'Entourer d’un cadre', run: () => frameAround(selItems()) } : { label: 'Masquer', run: hide }]) };
    const del = { label: 'Supprimer', run: deleteSel }, dup = { label: 'Dupliquer', run: () => duplicate() };
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
  function openMarking(e, hit, sticky) {
    closeMarking(); cancelOp();
    if (hit && !sel.has(hit)) { sel = new Set([hit]); sheetSel = null; render(); }
    if (!hit && sel.size) { sel.clear(); schedule(); }
    if (hit && sel.size === 1 && e.target && e.target.closest) sheetCtx(e.target, byId.get(hit));
    const el = document.createElement('div'); el.className = 'mmenu'; wrap.append(el);
    el.addEventListener('pointerdown', e => mm && mmDown(e)); el.addEventListener('contextmenu', e => e.preventDefault());
    const items1 = hit ? mmItemItems(hit) : mmToolItems(toW(e.clientX, e.clientY));
    mm = { el, pid: e.pointerId, x: e.clientX, y: e.clientY, mx: e.clientX, my: e.clientY, hover: -1, shown: false, sticky: !!sticky, moved: false,
      title: hit ? (sel.size > 1 ? sel.size + ' éléments' : KIND_NAMES[(byId.get(hit) || {}).k] || 'Élément') : 'Outils', items: items1, lvl1: null };
    addEventListener('pointermove', mmMove, true); addEventListener('pointerup', mmUp, true); addEventListener('keydown', mmKey, true);
    if (sticky) mmShow(); else mm.t = setTimeout(() => mm && mmShow(), MM_DELAY);
  }
  function closeMarking() {
    if (!mm) return;
    clearTimeout(mm.t); clearTimeout(mm.subT); mm.el.remove(); mm = null;
    removeEventListener('pointermove', mmMove, true); removeEventListener('pointerup', mmUp, true); removeEventListener('keydown', mmKey, true);
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
    closeMarking();
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
    get mounted() { return mounted; }, get doc() { return D; },
    refreshRefs() { if (!mounted) return; for (const [id, n] of nodes) { const it = byId.get(id); if (it && (it.k === 'task' || it.k === 'doc' || it.k === 'todo')) { n._sig = ''; n._it = null; } } propSig = ''; schedule(); },
    retheme() { if (!mounted) return; Studio.retheme(); measCache.clear(); items = relayout(items); reindex(); D.items = items; for (const n of nodes.values()) { n._sig = ''; n._it = null; } propSig = ''; qSig = ''; schedule(); },
    layoutChanged,
    /* used by the assistant and the space page */
    items: () => items, select: ids => { sel = new Set(ids); schedule(); },
    addNotes(list) { const cols = Math.min(4, Math.ceil(Math.sqrt(list.length))); const out = list.map((n, i) => mkNote((i % cols) * 240, Math.floor(i / cols) * 240, String(n.texte || n.text || ''), NOTE_COLORS[(n.couleur != null ? NOTE_COLORS.indexOf(n.couleur) : -1) >= 0 ? NOTE_COLORS.indexOf(n.couleur) : colorIndex(n.couleur, i)])); return insert(out); },
    groupInFrames(groups) {
      let x = 0; const out = [], moved = new Map();
      const placed = new Set();
      for (const g of groups) {
        const its = (g.ids || []).map(id => byId.get(id)).filter(i => i && i.k !== 'conn' && !placed.has(i.id)); its.forEach(i => placed.add(i.id));
        const extra = (g.nouveaux || []).map(t => mkNote(0, 0, String(t), NOTE_COLORS[0]));
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
      const nb = unionBox(frames); if (nb) fitTo(nb, view.k);
      return frames.map(f => f.id);
    },
    arrangeAll(mode) { sel = new Set(items.filter(i => i.k !== 'conn' && i.k !== 'mind' && i.k !== 'frame' && !i.hid).map(i => i.id)); arrange(mode || 'grid'); },
    insert, fitAll, placeMedia, setTool, openPanel(tab) { setProps(true); propsTab = tab || 'style'; renderProps(true); },
    ingestFiles(files) { return ingest({ files, getData: () => '' }, centerW()); }
  };
  function colorIndex(name, i) { const n = norm(name); const m = { jaune: 0, orange: 1, rose: 2, violet: 3, bleu: 4, vert: 5, blanc: 6, gris: 7 }; return m[n] != null ? m[n] : i % 6; }
})();
