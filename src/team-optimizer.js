import { loadState, saveState } from './storage.js';
import { PAL_CATALOG } from './catalog.js';

const DEFAULT={schemaVersion:7,profile:{},pals:[],teamPlans:[]};
const app=document.querySelector('#app');
const esc=(v='')=>String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const elements=['Neutral','Feuer','Wasser','Gras','Elektro','Eis','Erde','Schatten','Drache'];
let busy=false;

const effectLabels={pal_element_attack:'Element-Angriff',weakpoint_damage:'Schwachpunktschaden',player_attack:'Spielerangriff',player_weapon_damage:'Waffenschaden',player_attack_element_conversion:'Elementumwandlung',party_follow_attack:'Begleitangriff',heal_player:'Heilung',revive_player:'Wiederbelebung',active_weapon:'Aktive Waffe',active_launcher:'Aktiver Werfer',active_grenade:'Aktive Granate',mount:'Reittier'};
const effects=p=>p.partner?.effects||[];
const hasEffect=(p,types)=>effects(p).some(e=>types.includes(e.type));
const matchesElement=(p,element)=>!element||String(p.element||'').split('/').includes(element);
const ownedMap=state=>new Map((state.pals||[]).map(p=>[p.catalogId,p]));
const detailScore=p=>Object.keys(p.work||{}).length+(effects(p).filter(e=>e.type!=='pending_partner_text').length*3)+(p.paldeck?1:0)+(p.languageStatus==='de-confirmed'?1:0);
const ownedStrength=(p,owned)=>Number(owned?.stars||0)*1000+Number(owned?.level||0);

function candidateScore(p,element,mode){
  let score=detailScore(p);
  if(matchesElement(p,element))score+=35;
  for(const e of effects(p)){
    if(e.element===element||e.targetElement===element)score+=30;
    if(mode==='damage'&&['pal_element_attack','weakpoint_damage','party_follow_attack','active_weapon','active_launcher','active_grenade'].includes(e.type))score+=22;
    if(mode==='player'&&['player_attack','player_weapon_damage','player_attack_element_conversion'].includes(e.type))score+=28;
    if(mode==='safe'&&['heal_player','revive_player'].includes(e.type))score+=35;
  }
  return score;
}
function reasonFor(p,element,mode,index){
  const named=effects(p).map(e=>effectLabels[e.type]).filter(Boolean);
  if(index===0&&matchesElement(p,element))return`Primärer Kandidat für ${element||'das gewählte Ziel'} mit der stärksten belegten Katalog-Synergie.`;
  if(named.length)return`${named.join(' · ')} ist als strukturierter Effekt belegt und passt zur gewählten Priorität.`;
  return'Bestbewerteter verbleibender Katalogkandidat anhand bestätigter Elemente und vorhandener Detaildaten.';
}
function uniquePush(team,p,reason){if(!p||team.some(x=>x.p.key===p.key)||team.length>=5)return;team.push({p,reason})}
function buildCatalogTeam(element,mode,source=PAL_CATALOG){
  const usable=source.filter(p=>p?.name&&p?.element&&p.partner&&!effects(p).every(e=>e.type==='pending_partner_text'));
  const ranked=[...usable].sort((a,b)=>candidateScore(b,element,mode)-candidateScore(a,element,mode)||a.name.localeCompare(b.name,'de'));
  const team=[];
  uniquePush(team,ranked.find(p=>matchesElement(p,element)),reasonFor(ranked.find(p=>matchesElement(p,element)),element,mode,0));
  const wanted=mode==='safe'?['heal_player','revive_player']:mode==='player'?['player_attack','player_weapon_damage','player_attack_element_conversion']:['pal_element_attack','weakpoint_damage','party_follow_attack','active_weapon','active_launcher','active_grenade'];
  ranked.filter(p=>hasEffect(p,wanted)).forEach(p=>uniquePush(team,p,reasonFor(p,element,mode,team.length)));
  ranked.forEach(p=>uniquePush(team,p,reasonFor(p,element,mode,team.length)));
  return team.slice(0,5);
}
function buildOwnedTeam(state,element,mode){
  const map=ownedMap(state);
  const source=PAL_CATALOG.filter(p=>map.has(p.key));
  const team=buildCatalogTeam(element,mode,source);
  return team.sort((a,b)=>ownedStrength(b.p,map.get(b.p.key))-ownedStrength(a.p,map.get(a.p.key))).map(x=>({...x,owned:map.get(x.p.key)}));
}
function effectNames(p){return effects(p).map(e=>effectLabels[e.type]).filter(Boolean).join(' · ')||'Keine kampfrelevante Wirkung strukturiert'}
function imageFor(p){return p.paldeck?`assets/pals/${String(p.paldeck).padStart(3,'0')}.png`:''}
function teamMarkup(team,state,target){const map=ownedMap(state);return team.map((x,i)=>{const own=x.owned||map.get(x.p.key);const src=imageFor(x.p);return`<div class="team-slot"><span>${i+1}</span>${src?`<img class="team-pal-image" src="${src}" alt="" onerror="this.remove()">`:''}<div><strong>${esc(x.p.name)}</strong><small>${esc(x.p.element)} · ${own?`${own.stars||0}★ · Level ${esc(own.level||'offen')}`:'Nicht im Bestand'}</small><em>${esc(effectNames(x.p))}</em>${target&&!own?'<b class="missing-label">Ziel-Pal</b>':''}</div></div>`}).join('')}

async function renderTeamOptimizer(){
  if(busy)return;busy=true;const state=await loadState(DEFAULT);state.teamPlans=state.teamPlans||[];
  app.innerHTML=`<button class="back-link" id="teamBack">‹ Optimieren</button><section class="hero compact-hero"><div><p class="eyebrow">TEAM & BUILD PLANER</p><h2>Ziel-Team oder sofort spielbar</h2><p>PALWERK kann den gesamten Katalog verwenden und zeigt zusätzlich die beste baubare Annäherung aus deinem Bestand.</p></div></section><section class="card"><form id="teamOptimizerForm" class="form"><div class="field"><label>Planungsbasis</label><select name="scope"><option value="all">Alle Pals · optimales Ziel-Team</option><option value="owned">Nur mein Bestand</option><option value="compare">Ziel-Team und Bestand vergleichen</option></select></div><div class="field"><label>Hauptelement</label><select name="element"><option value="">Beliebig</option>${elements.map(e=>`<option>${e}</option>`).join('')}</select></div><div class="field"><label>Priorität</label><select name="mode"><option value="damage">Pal-Schaden und Support</option><option value="player">Spieler-Schaden</option><option value="safe">Sicherer Kampf</option></select></div><button class="primary">Teams berechnen</button></form></section><div id="teamOptimizerResult"></div>${state.teamPlans.length?`<section class="card"><h3>Gespeicherte Pläne</h3><div class="list">${state.teamPlans.slice(-5).reverse().map(t=>`<div class="list-item"><div><strong>${esc(t.name)}</strong><small>${(t.members||[]).map(m=>esc(m.name)).join(' · ')}</small></div><span class="badge">${esc(t.scopeLabel||t.modeLabel||'Team')}</span></div>`).join('')}</div></section>`:''}`;
  document.querySelector('#teamBack')?.addEventListener('click',()=>document.querySelector('.tab[data-route="optimieren"]')?.click());
  document.querySelector('#teamOptimizerForm')?.addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));renderResult(data,state)});busy=false;
}
function renderResult(data,state){
  const target=buildCatalogTeam(data.element,data.mode);
  const owned=buildOwnedTeam(state,data.element,data.mode);
  const missing=target.filter(x=>!ownedMap(state).has(x.p.key));
  const sections=[];
  if(data.scope!=='owned')sections.push(`<section class="card result-card"><p class="eyebrow">OPTIMALES ZIEL-TEAM</p><h3>${target.length} von 5 Plätzen</h3><div class="team-slots">${teamMarkup(target,state,true)}</div><div class="reason-box">${target.map(x=>`<p><b>${esc(x.p.name)}:</b> ${esc(x.reason)}</p>`).join('')}</div>${missing.length?`<p class="notice"><b>${missing.length} Ziel-Pals fehlen:</b> ${missing.map(x=>esc(x.p.name)).join(' · ')}</p>`:'<p class="notice">Das vollständige Ziel-Team ist bereits in deinem Bestand.</p>'}</section>`);
  if(data.scope!=='all')sections.push(`<section class="card result-card"><p class="eyebrow">SOFORT SPIELBAR</p><h3>${owned.length} von 5 Plätzen</h3>${owned.length?`<div class="team-slots">${teamMarkup(owned,state,false)}</div><div class="reason-box">${owned.map(x=>`<p><b>${esc(x.p.name)}:</b> ${esc(x.reason)}</p>`).join('')}</div>`:'<p>Dein Bestand enthält noch keine verknüpften Pals.</p>'}</section>`);
  const result=document.querySelector('#teamOptimizerResult');result.innerHTML=sections.join('')+`<section class="card"><p class="notice">Die Rangfolge nutzt bestätigte Elemente und strukturierte Partner-Effekte. Solange aktive Skills, IVs, Passives und vollständige Kampfwerte nicht lückenlos normalisiert sind, wird keine erfundene exakte DPS behauptet.</p><button class="secondary" id="saveCalculatedTeam">Plan speichern</button></section>`;
  document.querySelector('#saveCalculatedTeam')?.addEventListener('click',async()=>{const selected=data.scope==='owned'?owned:target;const name=prompt('Name für den Teamplan',state.profile?.goal||'Ziel-Team');if(!name)return;state.schemaVersion=7;state.teamPlans.push({id:crypto.randomUUID(),name,element:data.element,mode:data.mode,scope:data.scope,scopeLabel:data.scope==='all'?'Alle Pals':data.scope==='owned'?'Mein Bestand':'Vergleich',members:selected.map(x=>({catalogId:x.p.key,name:x.p.name,owned:ownedMap(state).has(x.p.key)})),createdAt:new Date().toISOString()});await saveState(state);alert('Teamplan lokal gespeichert.');});
}
function inject(){const grid=app.querySelector('.module-grid');if(!grid||grid.querySelector('[data-team-support]'))return;const button=document.createElement('button');button.className='module-card';button.dataset.teamSupport='';button.innerHTML='<div class="module-icon">◇</div><div><h3>Team & Build Planer</h3><p>Ziel-Teams aus allen Pals und Bestandsvergleich</p></div><span class="badge">Neu</span>';button.addEventListener('click',renderTeamOptimizer);grid.prepend(button)}
const style=document.createElement('style');style.textContent='.team-slots{display:grid;gap:10px;margin:14px 0}.team-slot{display:grid;grid-template-columns:38px 58px 1fr;gap:10px;align-items:center;padding:14px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.04)}.team-slot>span{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:rgba(121,230,197,.12);color:var(--accent);font-weight:800}.team-pal-image{width:58px;height:58px;object-fit:contain}.team-slot strong,.team-slot small,.team-slot em{display:block}.team-slot small{color:var(--muted);margin-top:3px}.team-slot em{color:#cbd8f8;font-size:12px;margin-top:5px;font-style:normal}.missing-label{display:inline-flex;margin-top:7px;padding:4px 7px;border-radius:999px;background:rgba(255,183,77,.12);color:#ffd28b;font-size:10px}.reason-box{margin:14px 0;padding:15px;border-radius:16px;background:rgba(122,167,255,.08);border:1px solid rgba(122,167,255,.15)}.reason-box p{margin:9px 0 0!important}.notice{border-left:3px solid var(--accent2);padding:12px 14px;background:rgba(122,167,255,.08);border-radius:12px;color:#cbd8f8;font-size:13px;line-height:1.45}@media(max-width:420px){.team-slot{grid-template-columns:34px 50px 1fr}.team-pal-image{width:50px;height:50px}}';document.head.appendChild(style);
new MutationObserver(inject).observe(app,{childList:true,subtree:true});inject();
