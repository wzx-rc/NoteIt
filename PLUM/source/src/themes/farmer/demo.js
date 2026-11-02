/* Farmer: the example boards, made once the first time the Farmer theme is on, in the current space; the user can
   delete them like any board. S.prefs.fmDemo counts what was made: 2 = the mind map "Ferme durable" like the concept
   close-up; 3 = "Plan de la ferme" redone (0.2.30) as four framed sections on a tidy grid: the plan (painted farm with
   one note per place around it, each arrow landing on its building), the four seasons, the work in progress as cards
   in three columns, and the budget with ideas and pieces left to place. Pictures come from assets/ (pr-*, sa-*,
   compass and farm-hd were painted with Gemini in the kit's style). A plan board from an older version goes to the
   trash, where it can be restored, and is made again. */
const FM_DEMO_IMG = {
  farm: 'asset:farm-hd.webp', idee: 'asset:idee.webp', leaf: 'asset:leaf-2.webp', compass: 'asset:compass.webp',
  barn: 'asset:st-barn.webp', house: 'asset:st-house.webp', chicken: 'asset:st-chicken.webp',
  greenhouse: 'asset:st-greenhouse.webp', well: 'asset:st-well.webp', tractor: 'asset:st-tractor.webp',
  sunflower: 'asset:st-sunflower.webp', crate: 'asset:st-crate.webp', ruche: 'asset:pr-ruche.webp',
  compost: 'asset:pr-compost.webp', solaire: 'asset:pr-solaire.webp', epouv: 'asset:pr-epouvantail.webp',
  pommier: 'asset:pr-pommier.webp', mare: 'asset:pr-mare.webp', brouette: 'asset:pr-brouette.webp',
  cuve: 'asset:pr-cuve.webp', panneau: 'asset:pr-panneau.webp', foin: 'asset:pr-foin.webp',
  printemps: 'asset:sa-printemps.webp', ete: 'asset:sa-ete.webp', automne: 'asset:sa-automne.webp',
  hiver: 'asset:sa-hiver.webp'
};
const FM_INK = '#3B2A1C';
async function fmDemo() {
  if (!S || !S.prefs || S.prefs.fmDemo >= 3 || theme().id !== 'farmer') return;
  const had = S.prefs.fmDemo || 0; S.prefs.fmDemo = 3; save();
  if (had) for (const d of S.docs) if (d.type === 'board' && d.title === 'Plan de la ferme' && !d.trash) d.trash = true;
  await fmDemoPlan(); if (had < 2) fmDemoMind(); save();
}
function fmDemoMind() {
  const it = mkMind(0, 0, 'Ferme durable', [
    { t: 'Production', side: -1, c: ['Cultures', 'Animaux', 'Transformation'] },
    { t: 'Objectifs', side: -1, c: ['Autonomie', 'Écologique', 'Agrandir'] },
    { t: 'Infrastructure', side: 1, c: ['Grange', 'Serre', 'Stockage'] },
    { t: 'Recherche', side: 1, c: ['Sols', 'Semences', 'Irrigation'] }
  ]);
  const d = newDoc('board', { title: 'Ferme durable', items: it, bg: 'grid' });
  toast(`Mind map d’exemple « ${d.title} » ajoutée`, { label: 'Ouvrir', run: () => go('doc:' + d.id) });
}
async function fmDemoPlan() {
  try {
    const img = {};
    for (const [k, u] of Object.entries(FM_DEMO_IMG)) {
      const b = await (await fetch(u)).blob();
      img[k] = await importImage(new File([b], k + '.webp', { type: 'image/webp' }));
    }
    const INK = FM_INK, G = '#5B8A3C', PAPER = '#EFE3C8', EDGE = '#D8C6A2';
    const C = { yellow: '#F8E7A8', green: '#D9E8B6', blue: '#C4DFF0', peach: '#F7C7A6', cream: '#F7F0E0', rose: '#F3D3D0' };
    const pic = (k, x, y, w, o = {}) => mkImage(x, y, w, Math.round(w * img[k].h / img[k].w), img[k].id, { frm: o.frm || 'none', cap: o.cap || '' });
    const note = (x, y, w, h, txt, c, fs = 28) => mkNote(x, y, txt, c, { w, h, fs, font: HAND, al: 'left' });
    const text = (x, y, txt, fs, o = {}) => mkText(x, y, txt, { fs, font: HAND, color: o.color || INK, bold: o.bold !== false, ...o });
    const strip = (x, y, w, h, c = PAPER) => mkShape(x, y, w, h, 'rect', { sc: EDGE, fc: c, sw: 1, sty: 'clean', fill: 'solid' });
    const pill = (x, y, w, h, c, txt) => mkShape(x, y, w, h, 'round', { sc: EDGE, fc: c, sw: 1, sty: 'clean', fill: 'solid', txt, fs: 24, font: HAND, color: INK });
    const arrow = (a, b, o = {}) => mkConn(a, b, { route: 'curve', sc: INK, sw: 3, sty: 'clean', ...o });
    const it = [];

    /* 1. the plan: the painted farm in the middle, one note per place around it, each arrow lands on its building */
    const F1 = { x: 0, y: 0, w: 1960, h: 1240 };
    it.push(mkFrame(F1.x, F1.y, F1.w, F1.h, 'Plan'));
    it.push(strip(60, 60, 520, 100), text(84, 74, 'Plan de la ferme', 54), pic('leaf', 526, 58, 50));
    it.push(text(64, 176, 'Saison 2027 · une ferme durable, autonome en eau', 24, { bold: false, color: '#6B5440' }));
    it.push(pic('compass', 1770, 50, 140));
    const farm = pic('farm', 400, 230, 1160);
    it.push(farm);
    const at = (fx, fy) => ({ id: farm.id, fx, fy });
    const place = [
      // note, sticker, where the arrow lands on the farm
      [note(60, 270, 290, 250, 'Grange & moulin\n- Foin, outils\n- Atelier\n- Éolienne à réviser', C.yellow), 'barn', at(.37, .42)],
      [note(60, 660, 290, 230, 'Poulailler\n- 12 poules\n- Œufs, engrais\n- Mangeoire auto ?', C.cream), 'chicken', at(.15, .66)],
      [note(1610, 270, 290, 250, 'Maison principale\n- Cuisine\n- Réserve\n- Agrandir ?', C.peach), 'house', at(.6, .26)],
      [note(1610, 660, 290, 230, 'Système d’eau\n- Récupérateur\n- Château d’eau\n- Irrigation', C.blue), 'well', at(.92, .42)],
      [note(560, 980, 300, 220, 'Potager\n- Salade, carotte\n- Tomate\n- Potiron', C.green), 'sunflower', at(.56, .66)],
      [note(1100, 980, 300, 220, 'Serre\n- Semis d’hiver\n- Agrandir en 2028\n- Bac à compost', C.yellow), 'greenhouse', at(.79, .5)]
    ];
    for (const [n, st, end] of place) {
      it.push(n, pic(st, n.x + n.w - 62, n.y - 26, 84));
      const side = n.y >= 980 ? { id: n.id, fx: .5, fy: 0 } : n.x < 400 ? { id: n.id, fx: 1, fy: .5 } : { id: n.id, fx: 0, fy: .5 };
      it.push(arrow(side, end));
    }
    /* the rotation, beside the garden, dashed because it is a rule and not a place */
    const rot = note(60, 980, 420, 220, 'Rotation (4 ans)\n1. Feuilles   2. Racines\n3. Fruits   4. Engrais vert', C.rose, 26);
    it.push(rot, pic('foin', 400, 952, 84), arrow({ id: rot.id, fx: 1, fy: .5 }, { id: place[4][0].id, fx: 0, fy: .5 }, { dash: 'dash', sc: G }));
    const later = note(1470, 980, 430, 220, 'Plus tard\n☐ Pompe solaire\n☐ Capteurs d’humidité\n☐ Arrosage auto', C.cream, 26);
    it.push(later, pic('solaire', 1826, 952, 80), arrow({ id: place[3][0].id, fx: .5, fy: 1 }, { id: later.id, fx: .7, fy: 0 }, { dash: 'dash', sc: G }));

    /* 2. the four seasons, one column each */
    const F2 = { x: 0, y: 1320, w: 1960, h: 600 };   // picture, then the season's note
    it.push(mkFrame(F2.x, F2.y, F2.w, F2.h, 'Saisons'));
    const seasons = [
      ['printemps', 'Printemps', C.green, '☐ Semer blé et carottes\n☐ Planter les tomates (mai)\n☐ Installer les ruches\n☐ Nettoyer le poulailler'],
      ['ete', 'Été', C.yellow, '☐ Arroser tôt le matin\n☐ Récolter salades, tomates\n☐ Faire les foins (juillet)\n☐ Vérifier la cuve'],
      ['automne', 'Automne', C.peach, '☐ Potirons et pommes\n☐ Semer l’engrais vert\n☐ Retourner le compost\n☐ Réparer les clôtures'],
      ['hiver', 'Hiver', C.blue, '☐ Tailler le verger\n☐ Rotation 2028\n☐ Entretenir les outils\n☐ Commander les semences']
    ];
    seasons.forEach(([k, t, c, body], i) => {
      const x = 60 + i * 470;
      it.push(pic(k, x + 120, F2.y + 50, 180));
      it.push(note(x, F2.y + 250, 420, 290, t + '\n' + body, c, 28));
    });

    /* 3. the work in progress, cards in three columns */
    const F3 = { x: 0, y: 2000, w: 1200, h: 740 };
    it.push(mkFrame(F3.x, F3.y, F3.w, F3.h, 'Chantier'));
    const cols = [
      ['À faire', C.yellow, [['Agrandir la serre', 'greenhouse'], ['Goutte à goutte', 'cuve'], ['Trois ruches', 'ruche'], ['Verger', 'pommier']]],
      ['En cours', C.blue, [['Potager en carrés', 'brouette'], ['Château d’eau', 'well'], ['Poulailler', 'chicken'], ['Composteur', 'compost']]],
      ['Fait', C.green, [['Plan du terrain', 'compass'], ['Grange', 'barn'], ['Clôtures', 'panneau'], ['Tracteur révisé', 'tractor']]]
    ];
    cols.forEach(([t, c, cards], i) => {
      const x = 60 + i * 370;
      it.push(pill(x, F3.y + 60, 340, 60, c, t));
      cards.forEach(([label, st], j) => {
        const y = F3.y + 140 + j * 146;
        it.push(note(x, y, 340, 126, label, C.cream, 26), pic(st, x + 252, y + 22, 76));
      });
    });

    /* 4. the money, the ideas and the pieces left to place on the plan */
    const F4 = { x: 1280, y: 2000, w: 680, h: 1200 };
    const f4 = mkFrame(F4.x, F4.y, F4.w, F4.h, 'Budget & idées');
    it.push(f4);
    const sheet = mkSheet(F4.x + 40, F4.y + 60, { title: 'Budget 2027', cols: 3, rows: 7, fs: 20, w: 600,
      cells: { A1: 'Poste', B1: 'Prévu (€)', C1: 'Dépensé (€)', A2: 'Serre', B2: '1200', C2: '0', A3: 'Irrigation', B3: '450', C3: '120',
        A4: 'Ruches', B4: '300', C4: '0', A5: 'Clôtures', B5: '380', C5: '380', A6: 'Semences', B6: '150', C6: '60', A7: 'Total', B7: '=SOMME(B2:B6)', C7: '=SOMME(C2:C6)' } });
    it.push(sheet);
    const iy = sheet.y + sheet.h + 50;
    it.push(text(F4.x + 40, iy, '💡 Idées', 40));
    const photo = pic('idee', F4.x + 40, iy + 70, 250, { frm: 'polaroid', cap: 'La ferme rêvée' });
    const ideas = note(F4.x + 330, iy + 70, 310, 230, 'À essayer\n☐ Une mare\n☐ Un chemin\n☐ Un épouvantail', C.cream, 26);
    it.push(photo, ideas, arrow({ id: photo.id, fx: 1, fy: .35 }, { id: ideas.id, fx: 0, fy: .35 }, { sc: G }));
    const py = iy + 340;
    it.push(text(F4.x + 40, py, 'À placer sur le plan', 26));
    ['mare', 'epouv', 'pommier', 'ruche', 'compost', 'crate'].forEach((k, i) => it.push(pic(k, F4.x + 40 + (i % 3) * 200, py + 56 + Math.floor(i / 3) * 150, 120)));
    f4.h = py + 56 + 150 + 150 - F4.y;   // the frame ends under the last row, whatever the sheet's height

    newDoc('board', { title: 'Plan de la ferme', items: it, bg: 'grid' });
    save();
  } catch (e) { console.warn('farmer demo board', e); }
}
