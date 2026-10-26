/* Pokédex: the task page after the user's "Trainer Tasks" concept.
   A cream banner with the poké ball and the mascot talking in a bubble, big filter tabs with painted icons, the
   « Quêtes du jour » gauge (what is due today against what was ticked today), then the space casings, and at the foot
   the trainer card (streak, ticked tasks, level every 10 tasks) beside the day's chest, which opens once the day is done.
   Each row gets a painted object chosen from the words of its title. */
const PKT_TABS = { all: 'tab-toutes', today: 'tab-aujourdhui', week: 'tab-semaine', late: 'tab-retard', nodate: 'tab-sans-date', star: 'tab-importantes' };
// every painted picture of the page, written out so the build can inline them
const PKT_A = {
  'ball': 'asset:ball.webp',
  'mascotte-salut': 'asset:mascotte-salut.webp',
  'tab-toutes': 'asset:tab-toutes.webp',
  'tab-aujourdhui': 'asset:tab-aujourdhui.webp',
  'tab-semaine': 'asset:tab-semaine.webp',
  'tab-retard': 'asset:tab-retard.webp',
  'tab-sans-date': 'asset:tab-sans-date.webp',
  'tab-importantes': 'asset:tab-importantes.webp',
  'stat-flamme': 'asset:stat-flamme.webp',
  'stat-check': 'asset:stat-check.webp',
  'stat-medaille': 'asset:stat-medaille.webp',
  'stat-cadeau': 'asset:stat-cadeau.webp',
  'stat-drapeau': 'asset:stat-drapeau.webp',
  'obj-baie': 'asset:obj-baie.webp',
  'obj-telephone': 'asset:obj-telephone.webp',
  'obj-carnet': 'asset:obj-carnet.webp',
  'obj-sac': 'asset:obj-sac.webp',
  'obj-carte': 'asset:obj-carte.webp',
  'stat-barres': 'asset:stat-barres.webp',
  'coffre-ferme': 'asset:coffre-ferme.webp',
  'coffre-ouvert': 'asset:coffre-ouvert.webp'
};
const PKT_IMG = n => `<img src="${PKT_A[n]}" alt="" draggable="false">`;
// the object beside a task: the first rule whose words appear in the title, the map otherwise
const PKT_OBJ = [
  [/\b(achet|courses?|march[ée]|baies?|fruits?|manger|repas|cuisine|resto)/i, 'obj-baie'],
  [/\b(appel|t[ée]l[ée]phon|rdv|rendez|r[ée]union|meeting|mail|e-mail|message|contact|envoy)/i, 'obj-telephone'],
  [/\b(dessin|croquis|sketch|moodboard|design|note|[ée]crire|r[ée]dig|lire|cours|[ée]tud|planning|liste)/i, 'obj-carnet'],
  [/\b(rang|range|ranger|sac|valise|pack|pr[ée]par|maison|m[ée]nage|brosse)/i, 'obj-sac']
];
const pkTaskIcon = t => `<span class="pkt-obj" aria-hidden="true">${PKT_IMG((PKT_OBJ.find(([re]) => re.test(t.t || '')) || [0, 'obj-carte'])[1])}</span>`;

function pkTasks({ open, done, filters, today: T }) {
  const day = ts => isoOf(new Date(ts));
  const doneToday = done.filter(t => t.doneAt && day(t.doneAt) === T).length;
  const dueToday = open.filter(t => t.due && t.due <= T).length;
  const goal = doneToday + dueToday;
  // streak: days in a row with at least one ticked task, up to today (or yesterday while today is still empty)
  const days = new Set(done.filter(t => t.doneAt).map(t => day(t.doneAt)));
  let streak = 0, d = days.has(T) ? T : addDays(T, -1);
  while (days.has(d)) { streak++; d = addDays(d, -1); }
  const lvl = Math.floor(done.length / 10) + 1, inLvl = done.length % 10;
  const bar = (n, of, cls = '') => `<div class="pkt-bar${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="${of}" aria-valuenow="${n}"><i style="width:${of ? Math.round(n / of * 100) : 0}%"></i></div>`;
  const say = !goal ? 'Une belle journée pour avancer !'
    : doneToday === goal ? 'Tout est fait pour aujourd’hui. Bravo !'
    : dueToday === 1 ? 'Plus qu’une quête aujourd’hui, tu y es presque !'
    : `Encore ${dueToday} quêtes aujourd’hui. On y va ?`;
  const date = new Date(T + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const won = goal && doneToday === goal;
  return {
    head: `<header class="pkt-head">
      <span class="pkt-ball">${PKT_IMG('ball')}</span>
      <div class="pkt-title"><h1>Tâches</h1><div class="sub">${open.length} à faire · ${done.length} terminée${done.length > 1 ? 's' : ''}</div></div>
      <div class="pkt-mascot">${PKT_IMG('mascotte-salut')}</div>
      <p class="pkt-say">${say}</p>
    </header>`,
    tabs: `<nav class="pkt-tabs" id="tFil">${filters.map(f => `<button class="pkt-tab" data-f="${f.k}" aria-pressed="${f.on}">${PKT_IMG(PKT_TABS[f.k])}<span class="l">${f.label}</span><span class="n">${f.n}</span></button>`).join('')}</nav>`,
    before: `<section class="pkt-quest">
      <h2>${PKT_IMG('stat-drapeau')}Quêtes du jour<span class="pkt-date">${PKT_IMG('tab-aujourdhui')}${date}</span></h2>
      <div class="pkt-gauge">${bar(doneToday, goal)}<b>${goal ? `${doneToday} / ${goal}` : 'Rien de prévu'}</b></div>
    </section>`,
    after: `<div class="pkt-foot">
      <section class="pkt-card pkt-stats"><h2>${PKT_IMG('stat-barres')}Carte de dresseur</h2>
        <div class="pkt-grid">
          <div class="pkt-stat">${PKT_IMG('stat-flamme')}<b>${streak}</b><span>jour${streak > 1 ? 's' : ''} de suite</span></div>
          <div class="pkt-stat">${PKT_IMG('stat-check')}<b>${done.length}</b><span>tâches terminées</span></div>
          <div class="pkt-stat wide">${PKT_IMG('stat-medaille')}<b>Niveau ${lvl}</b><span>${inLvl} / 10 vers le niveau ${lvl + 1}</span>${bar(inLvl, 10, ' sm')}</div>
        </div>
      </section>
      <section class="pkt-card pkt-reward"><h2>${PKT_IMG('stat-cadeau')}Coffre du jour</h2>
        <div class="pkt-chest${won ? ' won' : ''}">${PKT_IMG(won ? 'coffre-ouvert' : 'coffre-ferme')}</div><p class="pkt-chest-say">${won ? 'Coffre ouvert. Belle journée !' : 'Termine les quêtes du jour pour ouvrir le coffre.'}</p>
        <div class="pkt-gauge">${bar(doneToday, goal, ' sm')}<b>${doneToday} / ${goal}</b></div>
      </section>
    </div>`
  };
}
