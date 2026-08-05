const STORAGE_KEY = 'palwerk-state-v1';

const defaultState = {
  profile: { playerLevel: '', world: '', goal: '' },
  pals: [],
  equipment: [],
  materials: [],
  updatedAt: null
};

const modules = [
  ['Paldex', 'Alle Pals mit Besitz- und Ausbauzustand'],
  ['Loadouts', 'Spieler- und Pal-Ausrüstung abstimmen'],
  ['Team Builder', 'Baubare Teams nach Ziel optimieren'],
  ['Boss Planner', 'Vorbereitungslücken vor dem Kampf finden'],
  ['Material Optimizer', 'Engpässe und beste nächste Farmroute'],
  ['Disassembly', 'Zerlegen nach realem Nettovorteil priorisieren'],
  ['Zucht', 'Kürzesten baubaren Zuchtpfad berechnen'],
  ['Farm', 'Basen nach Output und Zeitverlust optimieren'],
  ['Karte', 'Ziele und Routen aus dem Spielstand ableiten']
];

let state = loadState();
let route = 'dashboard';

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function completeness() {
  const checks = [
    Boolean(state.profile.playerLevel),
    Boolean(state.profile.goal),
    state.pals.length > 0,
    state.equipment.length > 0,
    state.materials.length > 0
  ];
  return checks.filter(Boolean).length;
}

function nextDecision() {
  if (!state.profile.playerLevel) return { title: 'Spielerlevel eintragen', why: 'Ohne Level kann PALWERK keine erreichbaren Technologien, Bosse oder Ausrüstung abgrenzen.', action: 'Spielstand öffnen', route: 'bestand' };
  if (!state.profile.goal) return { title: 'Aktuelles Ziel festlegen', why: 'Optimierung braucht ein konkretes Ziel wie Boss, Material oder Base-Ausbau.', action: 'Ziel festlegen', route: 'bestand' };
  if (!state.pals.length) return { title: 'Erste Pals erfassen', why: 'Teams werden ausschließlich aus deinem tatsächlich verfügbaren Bestand gebaut.', action: 'Pal hinzufügen', route: 'bestand' };
  if (!state.equipment.length) return { title: 'Ausrüstung ergänzen', why: 'Ohne Waffen und Rüstung bleibt jede Kampfempfehlung unvollständig.', action: 'Ausrüstung ergänzen', route: 'bestand' };
  return { title: `„${state.profile.goal}“ optimieren`, why: 'Die Grunddaten sind vorhanden. Als Nächstes wird die regelbasierte Optimierungsengine je Modul erweitert.', action: 'Optimierung öffnen', route: 'optimieren' };
}

function dashboard() {
  const decision = nextDecision();
  const done = completeness();
  return `
    <section class="hero">
      <div>
        <p class="eyebrow">NÄCHSTER BESTER SCHRITT</p>
        <h2>${escapeHtml(decision.title)}</h2>
        <p>${escapeHtml(decision.why)}</p>
      </div>
      <div class="hero-actions"><button class="primary" data-go="${decision.route}">${decision.action}</button></div>
    </section>
    <div class="grid">
      <article class="card"><span class="muted">Datenbasis</span><div class="metric">${done}/5</div><p>notwendige Bereiche erfasst</p></article>
      <article class="card"><span class="muted">Verfügbare Pals</span><div class="metric">${state.pals.length}</div><p>für baubare Teams</p></article>
    </div>
    <div class="section-title"><h2>Prioritäten</h2></div>
    <div class="list">
      ${priorityRows()}
    </div>`;
}

function priorityRows() {
  const rows = [];
  if (!state.profile.goal) rows.push(['Ziel fehlt', 'Erst Ziel setzen, dann optimieren', 'Blockiert']);
  if (!state.pals.length) rows.push(['Bestand fehlt', 'Keine belastbaren Teamvorschläge möglich', 'Blockiert']);
  if (!state.materials.length) rows.push(['Materialien fehlen', 'Farm- und Bauprioritäten noch nicht berechenbar', 'Offen']);
  if (!rows.length) rows.push(['Grundlage vollständig', 'Module können jetzt mit echten Spieldaten erweitert werden', 'Bereit']);
  return rows.map(([a,b,c]) => `<div class="list-item"><div><strong>${a}</strong><small>${b}</small></div><span class="badge">${c}</span></div>`).join('');
}

function bestand() {
  return `
    <section class="card">
      <p class="eyebrow">MEIN SPIELSTAND</p>
      <h3>Grundlage für jede Berechnung</h3>
      <form id="profileForm" class="form">
        <div class="field"><label for="playerLevel">Spielerlevel</label><input id="playerLevel" name="playerLevel" inputmode="numeric" min="1" type="number" value="${escapeHtml(state.profile.playerLevel)}" placeholder="z. B. 70"></div>
        <div class="field"><label for="world">Welt / Spielstand</label><input id="world" name="world" value="${escapeHtml(state.profile.world)}" placeholder="z. B. Hauptwelt"></div>
        <div class="field"><label for="goal">Aktuelles Ziel</label><input id="goal" name="goal" value="${escapeHtml(state.profile.goal)}" placeholder="z. B. Lily besiegen"></div>
        <button class="primary" type="submit">Spielstand speichern</button>
      </form>
    </section>
    <section class="card">
      <div class="section-title"><h2>Meine Pals</h2><button type="button" data-action="add-pal">Hinzufügen</button></div>
      ${state.pals.length ? `<div class="list">${state.pals.map((pal, i) => `<div class="list-item"><div><strong>${escapeHtml(pal.name)}</strong><small>${pal.stars} Sterne · Level ${pal.level || 'offen'}</small></div><button class="secondary" data-remove-pal="${i}">Entfernen</button></div>`).join('')}</div>` : `<div class="empty"><div class="symbol">◇</div><strong>Noch keine Pals</strong><p class="muted">Erfasse nur Pals, die du wirklich besitzt.</p></div>`}
    </section>
    <section class="card">
      <div class="section-title"><h2>Ausrüstung</h2><button type="button" data-action="add-equipment">Hinzufügen</button></div>
      ${simpleItems(state.equipment, 'equipment')}
    </section>
    <section class="card">
      <div class="section-title"><h2>Materialien</h2><button type="button" data-action="add-material">Hinzufügen</button></div>
      ${simpleItems(state.materials, 'materials')}
    </section>`;
}

function simpleItems(items, type) {
  if (!items.length) return '<p class="muted">Noch nichts erfasst.</p>';
  return `<div class="list">${items.map((x,i) => `<div class="list-item"><div><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(String(x.amount || ''))}</small></div><button class="secondary" data-remove-item="${type}:${i}">Entfernen</button></div>`).join('')}</div>`;
}

function optimieren() {
  const ready = completeness() >= 4;
  return `
    <section class="hero">
      <div><p class="eyebrow">ENTSCHEIDUNGSENGINE</p><h2>${ready ? 'Grunddaten bereit' : 'Erst Datenbasis schließen'}</h2><p>${ready ? 'Die nächsten Versionen erweitern diese Basis um bestätigte Pal-, Skill-, Boss- und Materialdaten.' : 'PALWERK zeigt keine erfundenen Scores. Fehlende Daten werden klar als Voraussetzung markiert.'}</p></div>
      <div class="hero-actions"><button class="primary" data-go="bestand">Spielstand prüfen</button></div>
    </section>
    <div class="grid">${modules.slice(2,8).map(([name,desc]) => `<article class="card"><span class="badge">Geplant</span><h3>${name}</h3><p>${desc}</p></article>`).join('')}</div>`;
}

function mehr() {
  return `<div class="section-title"><h2>Alle Bereiche</h2></div><div class="list">${modules.map(([name,desc]) => `<div class="list-item"><div><strong>${name}</strong><small>${desc}</small></div><span>›</span></div>`).join('')}</div><section class="card"><h3>Lokale Daten</h3><p>Alle Eingaben bleiben ausschließlich in diesem Browser auf diesem Gerät.</p><button class="secondary" data-action="export" style="margin-top:14px">Backup exportieren</button></section>`;
}

function render() {
  document.querySelector('#app').innerHTML = ({ dashboard, bestand, optimieren, mehr })[route]();
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.route === route));
  bindPageEvents();
}

function bindPageEvents() {
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.go)));
  document.querySelector('#profileForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    state.profile = Object.fromEntries(data.entries());
    saveState(); render();
  });
  document.querySelector('[data-action="add-pal"]')?.addEventListener('click', addPal);
  document.querySelector('[data-action="add-equipment"]')?.addEventListener('click', () => addSimple('equipment', 'Ausrüstung'));
  document.querySelector('[data-action="add-material"]')?.addEventListener('click', () => addSimple('materials', 'Material'));
  document.querySelector('[data-action="export"]')?.addEventListener('click', exportBackup);
  document.querySelectorAll('[data-remove-pal]').forEach(b => b.addEventListener('click', () => { state.pals.splice(Number(b.dataset.removePal),1); saveState(); render(); }));
  document.querySelectorAll('[data-remove-item]').forEach(b => b.addEventListener('click', () => { const [type,index] = b.dataset.removeItem.split(':'); state[type].splice(Number(index),1); saveState(); render(); }));
}

function addPal() {
  const name = prompt('Name des Pals');
  if (!name?.trim()) return;
  const level = prompt('Level (optional)') || '';
  const stars = Math.max(0, Math.min(4, Number(prompt('Sterne 0–4') || 0)));
  state.pals.push({ name: name.trim(), level, stars, passives: [], implants: [], skills: [] });
  saveState(); render();
}

function addSimple(type, label) {
  const name = prompt(`${label}: Name`);
  if (!name?.trim()) return;
  const amount = prompt(type === 'materials' ? 'Menge' : 'Qualität / Stufe (optional)') || '';
  state[type].push({ name: name.trim(), amount });
  saveState(); render();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `palwerk-backup-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function navigate(next) { route = next; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.route)));
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
function updateConnection() { document.querySelector('#offlineStatus').textContent = navigator.onLine ? 'Lokal bereit' : 'Offline aktiv'; }

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
updateConnection();
render();
