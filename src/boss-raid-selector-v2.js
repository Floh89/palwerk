import { loadState } from './storage.js';
import { PAL_CATALOG } from './catalog.js';
import { encounterOptions, optimizeRaidArmy, DEFAULT_PLAYER } from './optimizer-engine-v2.js';

const app=document.querySelector('#app');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v)||0;

function renderResult(result,encounter){
  const sim=result.simulation;
  const waves=result.waves.map((wave,i)=>`<details class="wave"><summary>Gruppe ${i+1} · ${wave.length} Pals</summary>${wave.map(x=>`<div class="army-row"><div><strong>${esc(x.pal.name)}</strong><small>${Math.round(x.dps).toLocaleString('de-DE')} Modell-DPS</small><p>${x.rotation.map(s=>esc(s.name)).join(' → ')||'Keine Rotation berechenbar'}</p></div></div>`).join('')}</details>`).join('');
  return `<section class="card"><p class="eyebrow">ERGEBNIS</p><h3>${esc(encounter.name)}</h3><div class="metric-grid"><div><span>HP</span><strong>${n(encounter.hp).toLocaleString('de-DE')}</strong></div><div><span>Zeitlimit</span><strong>${Math.round(n(encounter.timeLimit)/60)} Min.</strong></div><div><span>Gesamt-DPS</span><strong>${Math.round(sim.totalDps).toLocaleString('de-DE')}</strong></div><div><span>Prognose</span><strong>${sim.win?'Sieg':'Nicht ausreichend'}</strong></div></div><p class="notice">Ziel-DPS mit Reserve: ${Math.round(sim.required?.target||0).toLocaleString('de-DE')} · Modellbandbreite ${Math.round(sim.range.low).toLocaleString('de-DE')}–${Math.round(sim.range.high).toLocaleString('de-DE')} DPS.</p>${waves}</section>`;
}

async function openSelector(type){
  const state=await loadState({pals:[],palProfiles:{},playerLoadout:{...DEFAULT_PLAYER}});
  let difficulty='Normal';
  const render=()=>{
    const options=encounterOptions(type,difficulty);
    app.innerHTML=`<button class="back-link" id="brBack">‹ Optimierungszentrale</button><section class="hero compact-hero"><div><p class="eyebrow">${type==='raid'?'RAID OPTIMIZER':'BOSS OPTIMIZER'}</p><h2>${type==='raid'?'Raid auswählen':'Boss auswählen'}</h2><p>Die Liste stammt direkt aus den verifizierten Encounter-Profilen.</p></div></section><form id="brForm"><section class="card"><div class="form">${type==='tower'?`<div class="field"><label>Schwierigkeit</label><select name="difficulty"><option ${difficulty==='Normal'?'selected':''}>Normal</option><option ${difficulty==='Schwer'?'selected':''}>Schwer</option></select></div>`:''}<div class="field wide"><label>${type==='raid'?'Raid':'Boss'}</label><select name="encounter" required>${options.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · Lv. ${x.level} · ${n(x.hp).toLocaleString('de-DE')} HP</option>`).join('')}</select></div><div class="field"><label>Armeegröße</label><input name="maxSlots" type="number" min="5" max="50" value="${type==='raid'?20:5}"></div><div class="field"><label>Quelle</label><select name="scope"><option value="all">Alle Pals</option><option value="owned">Nur mein Bestand</option></select></div></div><button class="primary">Team simulieren</button></section></form><div id="brResult"></div>`;
    document.querySelector('#brBack')?.addEventListener('click',()=>document.querySelector('[data-optimizer-hub]')?.click()||document.querySelector('.tab[data-route="optimieren"]')?.click());
    const form=document.querySelector('#brForm');
    form.elements.difficulty?.addEventListener('change',e=>{difficulty=e.target.value;render();});
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const data=Object.fromEntries(new FormData(form));
      const encounter=encounterOptions(type,difficulty).find(x=>x.id===data.encounter);
      const ownedIds=(state.pals||[]).map(x=>x.catalogId);
      const result=optimizeRaidArmy({encounter,profiles:state.palProfiles||{},player:{...DEFAULT_PLAYER,...(state.playerLoadout||{})},maxSlots:n(data.maxSlots),ownedOnly:data.scope==='owned',ownedIds});
      document.querySelector('#brResult').innerHTML=renderResult(result,encounter);
    });
  };
  render();
}

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-cluster="boss"],[data-cluster="raid"]');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openSelector(button.dataset.cluster==='raid'?'raid':'tower');
},true);

window.PALWERK_OPEN_BOSS_SELECTOR=()=>openSelector('tower');
window.PALWERK_OPEN_RAID_SELECTOR=()=>openSelector('raid');
