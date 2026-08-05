import { loadState, saveState as persistState } from './storage.js';

const defaultState = {
  schemaVersion: 1,
  profile: { playerLevel: '', world: '', goal: '', goalType: 'boss' },
  pals: [], equipment: [], materials: [], bases: [],
  updatedAt: null
};

const modules = [
  ['team','Team Builder','Baubare Teams aus deinem Bestand'],
  ['boss','Boss Planner','Lücken vor dem nächsten Kampf'],
  ['material','Material Optimizer','Engpässe und nächste Farmaktion'],
  ['breed','Zucht','Kürzester später bestätigter Zuchtpfad'],
  ['farm','Farm','Basen und Arbeitsrollen strukturieren'],
  ['disassembly','Disassembly','Zerlegen nur bei belegbarem Vorteil']
];

let state = await loadState(defaultState);
let route = 'dashboard';
const app = document.querySelector('#app');

async function save() {
  state.updatedAt = new Date().toISOString();
  await persistState(state);
}

function readiness() {
  return [state.profile.playerLevel, state.profile.goal, state.pals.length, state.equipment.length, state.materials.length, state.bases.length].filter(Boolean).length;
}

function decision() {
  if (!state.profile.playerLevel) return ['Spielerlevel ergänzen','Nur erreichbare Technologien und Inhalte dürfen berücksichtigt werden.','bestand'];
  if (!state.profile.goal) return ['Ziel festlegen','Ohne konkretes Ziel gibt es keine sinnvolle Optimierung.','bestand'];
  if (!state.pals.length) return ['Pal-Bestand erfassen','PALWERK schlägt keine Pals vor, die du nicht besitzt.','bestand'];
  if (state.profile.goalType === 'boss' && !state.equipment.length) return ['Kampfausrüstung erfassen','Boss-Planung ohne Waffen und Rüstung wäre unvollständig.','bestand'];
  if (state.profile.goalType === 'farm' && !state.bases.length) return ['Erste Basis erfassen','Farm-Empfehlungen brauchen verfügbare Arbeitsplätze und Pals.','bestand'];
  return [`${state.profile.goal} vorbereiten`,'Die Voraussetzungen sind erfasst. Öffne die Analyse der noch belegbaren Lücken.','optimieren'];
}

function dashboard() {
  const [title,why,target] = decision();
  return `<section class="hero"><div><p class="eyebrow">NÄCHSTER BESTER SCHRITT</p><h2>${esc(title)}</h2><p>${esc(why)}</p></div><button class="primary" data-go="${target}">Jetzt bearbeiten</button></section>
  <div class="grid"><article class="card"><span class="muted">Datenbasis</span><div class="metric">${readiness()}/6</div><p>Bereiche belastbar erfasst</p></article><article class="card"><span class="muted">Eigene Pals</span><div class="metric">${state.pals.length}</div><p>für baubare Vorschläge</p></article></div>
  <div class="section-title"><h2>Status</h2></div>${statusRows()}`;
}

function statusRows() {
  const rows = [
    ['Ziel',state.profile.goal || 'Noch nicht festgelegt'],
    ['Ausrüstung',state.equipment.length ? `${state.equipment.length} Einträge` : 'Fehlt'],
    ['Materialien',state.materials.length ? `${state.materials.length} Einträge` : 'Fehlt'],
    ['Basen',state.bases.length ? `${state.bases.length} erfasst` : 'Fehlt']
  ];
  return `<div class="list">${rows.map(([a,b])=>`<div class="list-item"><strong>${a}</strong><span class="badge">${esc(b)}</span></div>`).join('')}</div>`;
}

function bestand() {
  return `<section class="card"><p class="eyebrow">MEIN SPIELSTAND</p><h3>Berechnungsgrundlage</h3><form id="profileForm" class="form">
  <div class="field"><label>Spielerlevel</label><input name="playerLevel" type="number" min="1" value="${esc(state.profile.playerLevel)}"></div>
  <div class="field"><label>Welt</label><input name="world" value="${esc(state.profile.world)}"></div>
  <div class="field"><label>Zieltyp</label><select name="goalType"><option value="boss" ${sel('boss')}>Boss / Raid</option><option value="farm" ${sel('farm')}>Material / Farm</option><option value="build" ${sel('build')}>Team / Build</option></select></div>
  <div class="field"><label>Aktuelles Ziel</label><input name="goal" value="${esc(state.profile.goal)}" placeholder="z. B. Lily Hard besiegen"></div><button class="primary">Speichern</button></form></section>
  ${collectionCard('Meine Pals','pal',state.pals,p=>`${p.stars}★ · Level ${p.level||'offen'}`)}
  ${collectionCard('Ausrüstung','equipment',state.equipment,x=>x.detail||'ohne Detail')}
  ${collectionCard('Materialien','material',state.materials,x=>`${x.amount||0} vorhanden`)}
  ${collectionCard('Basen','base',state.bases,x=>x.purpose||'Zweck offen')}`;
}

function sel(value){ return state.profile.goalType===value?'selected':''; }
function collectionCard(title,type,items,subtitle) {
  return `<section class="card"><div class="section-title"><h2>${title}</h2><button data-add="${type}">Hinzufügen</button></div>${items.length?`<div class="list">${items.map((x,i)=>`<div class="list-item"><div><strong>${esc(x.name)}</strong><small>${esc(subtitle(x))}</small></div><button class="secondary compact" data-remove="${type}:${i}">×</button></div>`).join('')}</div>`:`<div class="empty"><strong>Noch nichts erfasst</strong><p class="muted">Nur tatsächliche Spieldaten eintragen.</p></div>`}</section>`;
}

function optimieren() {
  const [title,why] = decision();
  const blockers = [];
  if (!state.pals.length) blockers.push('Pal-Bestand');
  if (state.profile.goalType==='boss' && !state.equipment.length) blockers.push('Ausrüstung');
  if (state.profile.goalType==='farm' && !state.materials.length) blockers.push('Materialbestand');
  return `<section class="hero"><div><p class="eyebrow">ENTSCHEIDUNGSENGINE</p><h2>${esc(title)}</h2><p>${esc(why)}</p></div>${blockers.length?`<button class="primary" data-go="bestand">${blockers.join(', ')} ergänzen</button>`:'<button class="primary" data-go="bestand">Daten prüfen</button>'}</section>
  <div class="section-title"><h2>Module</h2></div><div class="module-grid">${modules.map(([id,name,desc])=>`<article class="module-card"><div class="module-icon">${icon(id)}</div><div><h3>${name}</h3><p>${desc}</p></div><span class="badge">Grundlage</span></article>`).join('')}</div>
  <p class="notice">Es werden erst dann Stärke-, Zeit- oder DPS-Werte angezeigt, wenn dafür bestätigte Spieldaten und reproduzierbare Formeln integriert sind.</p>`;
}

function mehr() {
  return `<section class="card"><p class="eyebrow">LOKALE DATEN</p><h3>Backup und Datenschutz</h3><p>Dein Spielstand liegt ausschließlich in der IndexedDB dieses Geräts.</p><div class="button-stack"><button class="secondary" data-export>Backup exportieren</button><label class="secondary file-button">Backup importieren<input type="file" accept="application/json" data-import></label></div></section>
  <section class="card"><h3>Version</h3><p>PALWERK Foundation v0.2 · Datenschema ${state.schemaVersion}</p></section>`;
}

function render(){ app.innerHTML=({dashboard,bestand,optimieren,mehr})[route](); document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.route===route)); bind(); }
function bind(){
  document.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>navigate(x.dataset.go));
  document.querySelector('#profileForm')?.addEventListener('submit',async e=>{e.preventDefault();state.profile=Object.fromEntries(new FormData(e.currentTarget));await save();render();});
  document.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>add(x.dataset.add));
  document.querySelectorAll('[data-remove]').forEach(x=>x.onclick=async()=>{const[t,i]=x.dataset.remove.split(':'); const key={pal:'pals',equipment:'equipment',material:'materials',base:'bases'}[t];state[key].splice(+i,1);await save();render();});
  document.querySelector('[data-export]')?.addEventListener('click',exportBackup);
  document.querySelector('[data-import]')?.addEventListener('change',importBackup);
}

async function add(type){
  const name=prompt(type==='pal'?'Pal-Name':type==='base'?'Name der Basis':type==='material'?'Material':'Ausrüstung'); if(!name?.trim())return;
  if(type==='pal'){const level=prompt('Level (optional)')||'';const stars=Math.max(0,Math.min(4,Number(prompt('Sterne 0–4')||0)));state.pals.push({id:crypto.randomUUID(),name:name.trim(),level,stars,passives:[],skills:[],implants:[]});}
  if(type==='equipment')state.equipment.push({id:crypto.randomUUID(),name:name.trim(),detail:prompt('Qualität / Stufe')||''});
  if(type==='material')state.materials.push({id:crypto.randomUUID(),name:name.trim(),amount:Math.max(0,Number(prompt('Menge')||0))});
  if(type==='base')state.bases.push({id:crypto.randomUUID(),name:name.trim(),purpose:prompt('Zweck der Basis')||''});
  await save();render();
}

function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`palwerk-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);}
async function importBackup(e){try{const parsed=JSON.parse(await e.target.files[0].text());if(!parsed.profile||!Array.isArray(parsed.pals))throw new Error();state={...defaultState,...parsed,schemaVersion:1};await save();render();}catch{alert('Das Backup ist ungültig.');}}
function icon(id){return({team:'◇',boss:'⚔',material:'▦',breed:'∞',farm:'⌂',disassembly:'⌁'})[id];}
function navigate(next){route=next;render();scrollTo({top:0,behavior:'smooth'});}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

document.querySelectorAll('.tab').forEach(x=>x.onclick=()=>navigate(x.dataset.route));
function connection(){document.querySelector('#offlineStatus').textContent=navigator.onLine?'Lokal bereit':'Offline aktiv';}
addEventListener('online',connection);addEventListener('offline',connection);
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');
connection();render();
