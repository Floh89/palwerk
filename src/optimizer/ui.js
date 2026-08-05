import { loadState } from '../storage.js';
import { RAID_PROFILES, TOWER_PROFILES } from '../encounter-overrides.js';
import { optimizeTeam, OPTIMIZER_API_VERSION } from './engine.js';

const app = document.querySelector('#app');
const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function encounterList(activity, difficulty = 'Normal') {
  if (activity === 'raid') return RAID_PROFILES;
  return TOWER_PROFILES.filter(item => item.difficulty === difficulty);
}

function qualityLabel(value) {
  return ({ verified: 'Verifiziert', modelled: 'Modelliert', missing: 'Fehlend' })[value] || value || 'Offen';
}

function memberCard(member) {
  const rotation = member.rotation?.length
    ? member.rotation.map(skill => `${skill.name} (${skill.element})`).join(' → ')
    : 'Kein eigener DPS: wirkt nur über bestätigte In-Party-Effekte';
  const reasons = member.supportReasons?.length ? member.supportReasons.join(' · ') : '';
  return `<article class="optimizer-member">
    <span class="badge">${esc(member.role)}</span>
    <h4>${esc(member.pal.name)}</h4>
    <p class="element-line">${esc(member.pal.element || 'Element offen')}</p>
    <p><strong>Einsatz:</strong> ${esc(rotation)}</p>
    ${reasons ? `<p><strong>Nutzen:</strong> ${esc(reasons)}</p>` : ''}
  </article>`;
}

function resultView(result, encounter) {
  if (result.status !== 'ok') {
    return `<section class="card warning">
      <p class="eyebrow">NICHT FREIGEGEBEN</p>
      <h3>Keine Empfehlung ausgegeben</h3>
      <p>${esc(result.reason)}</p>
      <p class="muted">Datenqualität: ${esc(qualityLabel(result.dataQuality))}</p>
    </section>`;
  }

  const team = result.teams[0];
  const range = team.estimatedActivePalDpsRange;
  return `<section class="card optimizer-sticky">
    <p class="eyebrow">${esc(encounter.name)}</p>
    <h3>${esc(team.label)}</h3>
    <p>Modell: genau ein aktiver Pal verursacht eigenen Pal-Schaden. Support-Pals werden nur über anwendbare Partnerwirkungen bewertet.</p>
  </section>
  <section class="optimizer-team-grid">${team.members.map(memberCard).join('')}</section>
  <section class="card">
    <p class="eyebrow">MODELLERGEBNIS</p>
    <h3>Relativer Teamwert: ${team.relativeTeamValue.toFixed(1)}</h3>
    <p>${range ? `Geschätzter Bereich des aktiven Pals: ${Math.round(range.low)}–${Math.round(range.high)} Modell-DPS.` : 'Kein DPS-Bereich verfügbar.'}</p>
    <p><strong>Datenqualität:</strong> ${esc(qualityLabel(team.dataQuality))}</p>
    <details>
      <summary>Verwendete Annahmen</summary>
      <ul>${team.assumptions.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
    </details>
  </section>`;
}

async function openOptimizer(activity = 'tower') {
  const state = await loadState({ pals: [], palProfiles: {}, playerLoadout: {} });
  let difficulty = 'Normal';

  const render = () => {
    const encounters = encounterList(activity, difficulty);
    app.innerHTML = `<button class="back-link" data-central-back>‹ Optimieren</button>
      <section class="hero compact-hero">
        <div>
          <p class="eyebrow">ZENTRALE ENGINE ${esc(OPTIMIZER_API_VERSION)}</p>
          <h2>${activity === 'raid' ? 'Raid-Armee' : 'Boss-Team'}</h2>
          <p>Nur freigegebene Berechnungsmodelle liefern Empfehlungen.</p>
        </div>
      </section>
      <form class="card form" id="centralOptimizerForm">
        ${activity !== 'raid' ? `<div class="field"><label>Schwierigkeit</label><select name="difficulty"><option>Normal</option><option>Schwer</option></select></div>` : ''}
        <div class="field"><label>Gegner</label><select name="encounter">${encounters.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · Lv. ${item.level}</option>`).join('')}</select></div>
        <div class="field"><label>Datenbasis</label><select name="scope"><option value="all">Alle fangbaren Pals</option><option value="owned">Nur mein Bestand</option></select></div>
        <button class="primary">Berechnen</button>
      </form>
      <div id="centralOptimizerResult"></div>`;

    const form = document.querySelector('#centralOptimizerForm');
    form?.elements.difficulty?.addEventListener('change', event => {
      difficulty = event.target.value;
      render();
    });
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const encounter = encounterList(activity, difficulty).find(item => item.id === values.encounter);
      const result = optimizeTeam({
        activity,
        encounter,
        playerState: state,
        ownedPals: state.pals || [],
        constraints: { ownedOnly: values.scope === 'owned' },
        optimizationGoal: 'practical'
      });
      document.querySelector('#centralOptimizerResult').innerHTML = resultView(result, encounter);
    });
    document.querySelector('[data-central-back]')?.addEventListener('click', renderHub);
  };

  render();
}

function renderHub() {
  app.innerHTML = `<section class="hero">
    <div><p class="eyebrow">KONSOLIDIERTER OPTIMIERER</p><h2>Ein Einstieg, eine Engine</h2><p>Unzuverlässige Altberechnungen sind aus dem produktiven Pfad entfernt.</p></div>
  </section>
  <div class="module-grid">
    <button class="module-card" data-central-activity="tower"><div class="module-icon">⚔</div><div><h3>Tower & Boss</h3><p>Ein aktiver Pal, vier bestätigte Party-Supports</p></div><span class="badge">Freigegeben</span></button>
    <button class="module-card" data-central-activity="raid"><div class="module-icon">◈</div><div><h3>Raid-Armee</h3><p>Getrenntes Armee-Modell wird in Phase 2 konsolidiert</p></div><span class="badge pending">Gesperrt</span></button>
    <button class="module-card" data-central-activity="base"><div class="module-icon">⌂</div><div><h3>Basisarbeit</h3><p>Eigenes Modell folgt in Phase 2</p></div><span class="badge pending">Gesperrt</span></button>
    <button class="module-card" data-central-activity="farm"><div class="module-icon">◇</div><div><h3>Farm & Loot</h3><p>Eigene Aktivierungsbedingungen folgen in Phase 2 und 3</p></div><span class="badge pending">Gesperrt</span></button>
  </div>`;
  document.querySelectorAll('[data-central-activity]').forEach(button => button.addEventListener('click', () => openOptimizer(button.dataset.centralActivity)));
}

export function installOptimizerUI() {
  document.addEventListener('click', event => {
    const tab = event.target.closest('.tab[data-route="optimieren"]');
    const legacy = event.target.closest('[data-cluster="boss"],[data-cluster="raid"]');
    if (!tab && !legacy) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (legacy) openOptimizer(legacy.dataset.cluster === 'raid' ? 'raid' : 'tower');
    else renderHub();
  }, true);
}

const style = document.createElement('style');
style.textContent = `.optimizer-team-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.optimizer-member{background:linear-gradient(145deg,rgba(40,47,64,.82),rgba(20,24,34,.72));border:1px solid var(--line);border-radius:18px;padding:14px;min-width:0}.optimizer-member h4{margin:10px 0 6px}.optimizer-member p{font-size:12px;color:var(--muted);line-height:1.4}.optimizer-sticky{position:sticky;top:8px;z-index:3}@media(max-width:680px){.optimizer-team-grid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}.optimizer-member{min-width:78%;scroll-snap-align:start}}`;
document.head.appendChild(style);
