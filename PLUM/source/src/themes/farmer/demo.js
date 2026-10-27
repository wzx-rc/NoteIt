/* Farmer: the example boards, made once the first time the Farmer theme is on, in the current space; the user can
   delete them like any board. S.prefs.fmDemo counts what was made: 1 = "Plan de la ferme", laid out like the user's
   farm concept board (the painted farm, the doodles on the sticky notes, the pencil sketches and the polaroid come
   from assets/); 2 = also the mind map "Ferme durable" like the concept close-up. Going from 1 to 2, the older plan
   board (smaller notes, pencil arrows) goes to the trash, where it can be restored, and is made again. */
const FM_DEMO_IMG = {
  farm: 'asset:farm.webp', idee: 'asset:idee.webp', leaf: 'asset:leaf-2.webp',
  maison: 'asset:dd-maison.webp', carottes: 'asset:dd-carottes.webp', cuve: 'asset:dd-cuve.webp', robot: 'asset:dd-robot.webp',
  poule: 'asset:dd-poule.webp', panier: 'asset:dd-panier.webp',
  ghGrange: 'asset:gh-grange.webp', ghMoulin: 'asset:gh-moulin.webp', ghArbre: 'asset:gh-arbre.webp', ghMaison: 'asset:gh-maison.webp'
};
const FM_INK = '#3B2A1C';
async function fmDemo() {
  if (!S || !S.prefs || S.prefs.fmDemo >= 2 || theme().id !== 'farmer') return;
  const had = S.prefs.fmDemo || 0; S.prefs.fmDemo = 2; save();
  if (had === 1) for (const d of S.docs) if (d.type === 'board' && d.title === 'Plan de la ferme' && !d.trash) d.trash = true;
  await fmDemoPlan(); fmDemoMind(); save();
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
    const INK = FM_INK, G = '#5B8A3C';
    const pic = (k, x, y, w, o = {}) => mkImage(x, y, w, Math.round(w * img[k].h / img[k].w), img[k].id, { frm: o.frm || 'none', cap: o.cap || '' });
    const note = (x, y, w, h, txt, c) => mkNote(x, y, txt, c, { w, h, fs: 22, font: HAND, al: 'left' });
    const it = [];
    /* pencil sketches behind everything */
    it.push(pic('ghMaison', 470, 150, 150), pic('ghArbre', 300, 200, 120), pic('ghGrange', 880, 230, 170), pic('ghMoulin', 1000, 420, 120), pic('ghArbre', 240, 600, 110));
    const farm = pic('farm', 300, 150, 740);
    it.push(farm);
    /* the title on its strip of paper, a leaf after it */
    it.push(mkShape(100, 70, 430, 88, 'rect', { sc: '#D8C6A2', fc: '#EFE3C8', sw: 1, sty: 'clean', fill: 'solid' }));
    it.push(mkText(122, 84, 'Plan de la ferme', { fs: 44, font: HAND, color: INK, bold: true }));
    it.push(pic('leaf', 478, 68, 46));
    /* sticky notes with their doodles */
    const house = note(96, 212, 228, 196, 'Maison principale\n- Cuisine\n- Réserve\n- Atelier\n- Agrandir ?', '#F8E7A8');
    const crops = note(540, 64, 190, 178, 'Rotation\n- Blé\n- Carotte\n- Tomate\n- Potiron', '#D9E8B6');
    const water = note(746, 104, 228, 156, 'Système d’eau\n- Récupérateur\n- Réservoir\n- Irrigation', '#C4DFF0');
    const auto = note(996, 166, 238, 172, 'Plus tard\n☐ Pompe solaire\n☐ Capteurs\n☐ Arrosage auto', '#F8E7A8');
    const coop = note(116, 470, 206, 160, 'Poulailler\n- Œufs\n- Engrais\n- Mangeoire ?', '#F3E8CF');
    const garden = note(676, 482, 216, 178, 'Potager\n- Salade\n- Carotte\n- Tomate\n- Potiron', '#F7C7A6');
    it.push(house, crops, water, auto, coop, garden);
    it.push(pic('maison', 238, 262, 72), pic('carottes', 660, 130, 56), pic('cuve', 908, 178, 56), pic('robot', 1178, 232, 50), pic('poule', 252, 540, 56), pic('panier', 820, 560, 64));
    /* ideas: a lightbulb title, the polaroid and a list */
    it.push(mkText(1050, 352, '💡 Idées', { fs: 40, font: HAND, color: INK, bold: true }));
    const photo = pic('idee', 1050, 410, 165, { frm: 'polaroid' });
    const ideas = note(1036, 560, 228, 150, 'À essayer\n☐ Des arbres\n☐ Un chemin\n☐ Plus de détails', '#F7F0E0');
    it.push(photo, ideas);
    /* the arrows of the concept, in dark brown ink */
    const arrow = (a, b, o = {}) => mkConn({ id: a.id }, { id: b.id }, { route: 'curve', sc: INK, sw: 3, sty: 'clean', ...o });
    it.push(arrow(house, farm), arrow(water, auto), arrow(coop, farm), arrow(garden, farm), arrow(photo, auto, { sc: G }));
    newDoc('board', { title: 'Plan de la ferme', items: it, bg: 'grid' });
    save();
  } catch (e) { console.warn('farmer demo board', e); }
}
