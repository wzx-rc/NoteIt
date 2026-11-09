/* ================= paste from Miro (0.2.79) =================
   A copy in Miro puts in the clipboard's text/html a span whose data-meta holds
   "<--(miro-data-v1)BASE64(/miro-data-v1)-->": base64 of a JSON whose bytes are shifted by 59.
   The JSON lists the widgets: text, shape, image, line (type 14, widgetData.json) and groups (type 10, items = ids).
   Positions are in Miro board pixels: _position.offsetPx = the centre of the item, its size = size × scale (or crop × scale
   for images), rotation around the centre; lines carry absolute end points.
   Images only come with their file name and size (the picture stays on Miro's servers): they become empty image
   frames of the right size, named after the file, where an image dropped on them takes their place. */
const MIRO_SHIFT = 59;
function miroDecode(html) {
  const m = /\(miro-data-v1\)([A-Za-z0-9+/=\s]+)\(\/miro-data-v1\)/.exec(html || '');
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/\s+/g, '')), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = (bin.charCodeAt(i) - MIRO_SHIFT + 256) & 255;
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) { return null; }
}
const miroHex = n => typeof n === 'number' && n >= 0 ? '#' + n.toString(16).padStart(6, '0').toUpperCase() : null;
function miroText(h) {
  const d = new DOMParser().parseFromString(String(h || '').replace(/<\/p>\s*<p[^>]*>/gi, '\n').replace(/<br\s*\/?>/gi, '\n'), 'text/html');
  return (d.body.textContent || '').replace(/ /g, ' ').trim();
}
// Miro's fonts: a brush or hand script goes to the hand font, the rest to the plain one
const miroFont = f => /brush|script|hand|marker|caveat|patrick|kalam|permanent|indie/i.test(f || '') ? HAND : SANS;
const MIRO_SHAPES = { 3: 'rect', 7: 'rect', 4: 'ellipse', 5: 'tri', 6: 'diamond', 8: 'starsh', 10: 'pill', 11: 'hex', 18: 'cloud' };
function miroItems(html) {
  const j = miroDecode(html), objs = j && j.data && j.data.objects;
  if (!Array.isArray(objs) || !objs.length) return null;
  const st = s => { try { return typeof s === 'string' ? JSON.parse(s) : s || {}; } catch (e) { return {}; } };
  const out = { shape: [], image: [], conn: [], text: [] }, byMiro = new Map();
  let images = 0;
  for (const o of objs) {
    const w = o.widgetData; if (!w || !w.json) continue;
    const J = typeof w.json === 'string' ? st(w.json) : w.json, S = st(J.style), t = w.type;
    const off = J._position && J._position.offsetPx, sc = (J.scale && J.scale.scale) || 1, rot = (J.rotation && J.rotation.rotation) || 0;
    // Miro places an item by its centre (it turns around it too)
    const box = (bw, bh) => ({ x: off.x - bw / 2, y: off.y - bh / 2, w: bw, h: bh });
    let it = null;
    if (t === 'text' && off && J.size) {
      const b = box(J.size.width * sc, J.size.height * sc), txt = miroText(J.text); if (!txt) continue;
      it = mkText(b.x, b.y, txt, { w: b.w, h: b.h, fs: Math.max(6, Math.round(14 * sc * (S.fs || 1) * 10) / 10), font: miroFont(S.ffn), color: miroHex(S.tc) || '#1E1E1E', bold: !!S.b, fw: 1, al: S.ta === 'l' ? 'left' : S.ta === 'r' ? 'right' : 'center' });
      if (S.i) it.ital = true;
      out.text.push(it);
    } else if (t === 'shape' && off && J.size) {
      const b = box(J.size.width * sc, J.size.height * sc), fill = miroHex(S.bc), line = miroHex(S.brc);
      it = mkShape(b.x, b.y, b.w, b.h, MIRO_SHAPES[S.st] || 'rect', { sc: line || '#1E1E1E', fc: fill, sw: Math.max(.5, S.brw ?? 1), sty: 'clean', dash: S.brs === 0 ? 'dot' : S.brs === 1 ? 'dash' : '' });
      if (!line || !(S.brw > 0)) { it.sw = 1; it.so = 0; } else if (S.bro != null && S.bro < 1) it.so = S.bro;
      if (fill && S.bo != null && S.bo < 1) it.fo = S.bo;
      if (S.st === 7 || S.brr) it.rad = S.brr || 12;
      const txt = miroText(J.text); if (txt) { it.txt = txt; it.fs = Math.round(14 * sc * (S.fs || 1)); it.font = miroFont(S.ffn); it.color = miroHex(S.tc) || undefined; }
      out.shape.push(it);
    } else if (t === 'image' && off) {
      const cw = (J.crop && J.crop.width) || (J.resource && J.resource.width) || 400, ch = (J.crop && J.crop.height) || (J.resource && J.resource.height) || 300;
      const b = box(cw * sc, ch * sc);
      it = mkImage(b.x, b.y, b.w, b.h, '', { frm: 'none', cap: (J.resource && J.resource.name) || 'Image Miro' });
      it.miro = 1; images++;
      out.image.push(it);
    } else if (t === 'line' && J.primary && J.secondary) {
      const p = J.primary.point, q = J.secondary.point; if (!p || !q) continue;
      const heads = v => v ? 'arrow' : 'none';
      it = mkConn({ x: p.x, y: p.y }, { x: q.x, y: q.y }, { route: 'straight', sc: miroHex(S.lc) || '#1E1E1E', sw: Math.max(1, S.t || 2), sty: 'clean', h0: heads(S.a_start), h1: heads(S.a_end), dash: S.ls === 1 ? 'dash' : S.ls === 0 ? 'dot' : '' });
      it.pts = (J.points || []).map(pt => [pt.x, pt.y]).filter(pt => isFinite(pt[0]) && isFinite(pt[1]));
      out.conn.push(it);
    }
    if (it && o.id != null) { if (rot && it.k !== 'conn') it.rot = rot; byMiro.set(o.id, it); }
  }
  for (const o of objs) if (o.type === 10 && Array.isArray(o.items)) { const g = uid('g'); for (const id of o.items) { const it = byMiro.get(id); if (it) it.g = g; } }
  // Miro's own stacking is not in the list: cards under, then pictures, lines and texts on top
  const items = [...out.shape, ...out.image, ...out.conn, ...out.text];
  return items.length ? { items, images } : null;
}
