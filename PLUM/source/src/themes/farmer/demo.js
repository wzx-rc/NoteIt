/* Farmer: the example board "Plan de la ferme", laid out like the user's farm concept board. It is made once, the
   first time the Farmer theme is on (S.prefs.fmDemo), in the current space; the user can delete it like any board.
   The painted farm, the doodles on the sticky notes, the pencil sketches and the polaroid come from assets/. */
const FM_DEMO_IMG = {
  farm: 'asset:farm.webp', idee: 'asset:idee.webp', leaf: 'asset:leaf-2.webp',
  maison: 'asset:dd-maison.webp', carottes: 'asset:dd-carottes.webp', cuve: 'asset:dd-cuve.webp', robot: 'asset:dd-robot.webp',
  poule: 'asset:dd-poule.webp', panier: 'asset:dd-panier.webp',
  ghGrange: 'asset:gh-grange.webp', ghMoulin: 'asset:gh-moulin.webp', ghArbre: 'asset:gh-arbre.webp', ghMaison: 'asset:gh-maison.webp'
};
async function fmDemo() {
  if (!S || !S.prefs || S.prefs.fmDemo || theme().id !== 'farmer') return;
  S.prefs.fmDemo = 1; save();
  try {
    const img = {};
    for (const [k, u] of Object.entries(FM_DEMO_IMG)) {
      const b = await (await fetch(u)).blob();
      img[k] = await importImage(new File([b], k + '.webp', { type: 'image/webp' }));
    }
    const INK = '#3B2A1C', G = '#5B8A3C';
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
    const house = note(110, 230, 200, 150, 'Maison principale\n- Cuisine\n- Réserve\n- Atelier\n- Agrandir ?', '#F8E7A8');
    const crops = note(550, 100, 170, 128, 'Rotation des cultures\n- Blé\n- Carotte\n- Tomate\n- Potiron', '#D9E8B6');
    const water = note(720, 128, 185, 122, 'Système d’eau\n- Récupérateur\n- Réservoir\n- Irrigation', '#C4DFF0');
    const auto = note(990, 175, 195, 145, 'Automatiser plus tard\n☐ Pompe solaire\n☐ Capteurs\n☐ Arrosage auto', '#F8E7A8');
    const coop = note(130, 470, 170, 125, 'Poulailler\n- Œufs\n- Engrais\n- Mangeoire auto ?', '#F3E8CF');
    const garden = note(680, 478, 200, 128, 'Potager\n- Salade\n- Carotte\n- Tomate\n- Potiron', '#F7C7A6');
    it.push(house, crops, water, auto, coop, garden);
    it.push(pic('maison', 238, 250, 66), pic('carottes', 655, 150, 50), pic('cuve', 838, 185, 56), pic('robot', 1125, 222, 50), pic('poule', 240, 512, 48), pic('panier', 806, 520, 62));
    /* ideas: a lightbulb title, the polaroid and a list */
    it.push(mkText(1050, 352, '💡 Idées', { fs: 40, font: HAND, color: INK, bold: true }));
    const photo = pic('idee', 1050, 410, 165, { frm: 'polaroid' });
    const ideas = note(1040, 540, 185, 112, '☐ Ajouter des arbres\n☐ Meilleur chemin\n☐ Plus de détails', '#F7F0E0');
    it.push(photo, ideas);
    /* the arrows of the concept, in dark brown ink */
    const arrow = (a, b, o = {}) => mkConn({ id: a.id }, { id: b.id }, { route: 'curve', sc: INK, sw: 2, sty: 'sketch', ...o });
    it.push(arrow(house, farm), arrow(crops, water, { h1: 'none' }), arrow(water, auto), arrow(coop, farm), arrow(garden, farm), arrow(photo, auto, { sc: G }));
    const d = newDoc('board', { title: 'Plan de la ferme', items: it, bg: 'grid' });
    save();
    toast(`Board d’exemple « ${d.title} » ajouté`, { label: 'Ouvrir', run: () => go('doc:' + d.id) });
  } catch (e) { console.warn('farmer demo board', e); }
}
