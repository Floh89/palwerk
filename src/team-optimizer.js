import { loadState, saveState } from './storage.js';
import { PAL_CATALOG } from './catalog.js';

const DEFAULT={schemaVersion:6,profile:{},pals:[],teamPlans:[]};
const app=document.querySelector('#app');
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const elements=['Neutral','Feuer','Wasser','Gras','Elektro','Eis','Erde','Schatten','Drache'];
let busy=false;

function catalogOwned(state){return (state.pals||[]).map(owned=>({owned,catalog:PAL_CATALOG.find(p=>p.key===owned.catalogId)})).filter(x=>x.catalog)}
function effects(p){return p.catalog.partner?.effects||[]}
function hasEffect(p,types){return effects(p).some(e=>types.includes(e.type))}
function matchesElement(p,element){return !element||p.catalog.element.split('/').includes(element)}
function strength(p){return Number(p.owned.stars||0)*1000+Number(p.owned.level||0)}
function sortOwned(list){return [...list].sort((a,b)=>strength(b)-strength(a)||a.catalog.name.localeCompare(b.catalog.name,'de'))}
function addUnique(team,p,reason){if(!p||team.some(x=>x.p.catalog.key===p.catalog.key)||team.length>=5)return;team.push({p,reason})}

function buildTeam(owned,element,mode){
  const team=[];
  const elementPals=sortOwned(owned.filter(p=>matchesElement(p,element)));
  const offensive=sortOwned(owned.filter(p=>hasEffect(p,['pal_element_attack','weakpoint_damage','player_attack','player_weapon_damage','player_attack_element_conversion','party_follow_attack'])));
  const sustain=sortOwned(owned.filter(p=>hasEffect(p,['heal_player','revive_player'])));
  const follow=sortOwned(owned.filter(p=>hasEffect(p,['party_follow_attack','active_weapon','active_launcher','active_grenade'])));
  const carry=elementPals[0]||sortOwned(owned)[0];
  addUnique(team,carry,element?`Stärkster erfasster eigener Pal mit Element ${element}; Reihenfolge nur nach Sternen und Level.`:'Stärkster erfasster eigener Pal nach Sternen und Level.');
  const matchingSupport=offensive.find(p=>effects(p).some(e=>(e.element===element||e.targetElement===element)&&['pal_element_attack','weakpoint_damage'].includes(e.type)));
  addUnique(team,matchingSupport,`Explizit strukturierter Angriffseffekt für ${element||'das gewählte Ziel'}.`);
  if(mode==='safe'){
    addUnique(team,sustain[0],'Automatische Heilung oder Wiederbelebung verbessert die Fehlertoleranz.');
    addUnique(team,sustain[1],'Zweite belegte Überlebensfunktion für längere Kämpfe.');
    addUnique(team,follow[0],'Zusätzliche aktive oder begleitende Angriffsquelle.');
  }else if(mode==='player'){
    offensive.filter(p=>hasEffect(p,['player_attack','player_weapon_damage','player_attack_element_conversion'])).forEach(p=>addUnique(team,p,'Expliziter Effekt auf den Spielerangriff oder die Schadensart.'));
    addUnique(team,sustain[0],'Absicherung durch belegte Heilung oder Wiederbelebung.');
  }else{
    offensive.forEach(p=>addUnique(team,p,'Explizit strukturierter offensiver Support-Effekt.'));
    follow.forEach(p=>addUnique(team,p,'Aktive oder begleitende zusätzliche Angriffsquelle.'));
  }
  sortOwned(owned).forEach(p=>addUnique(team,p,'Freier Platz: stärkster verbleibender eigener Pal nach Sternen und Level.'));
  return team.slice(0,5);
}

function effectNames(p){const labels={pal_element_attack:'Element-Angriff',weakpoint_damage:'Schwachpunktschaden',player_attack:'Spielerangriff',player_weapon_damage:'Waffenschaden',player_attack_element_conversion:'Elementumwandlung',party_follow_attack:'Begleitangriff',heal_player:'Heilung',revive_player:'Wiederbelebung',active_weapon:'Aktive Waffe',active_launcher:'Aktiver Werfer',active_grenade:'Aktive Granate'};return effects(p).map(e=>labels[e.type]).filter(Boolean).join(' · ')||'Keine kampfrelevante Wirkung strukturiert'}

async function renderTeamOptimizer(){
  if(busy)return;busy=true;
  const state=await loadState(DEFAULT);state.teamPlans=state.teamPlans||[];
  const owned=catalogOwned(state);
  app.innerHTML=`<button class="back-link" id="teamBack">‹ Optimieren</button><section class="hero compact-hero"><div><p class="eyebrow">TEAM & SUPPORT</p><h2>Nur baubare Teams</h2><p>Keine DPS-Schätzung ohne Kampfdaten. PALWERK nutzt ausschließlich Besitz, Sterne, Level und strukturierte Partnerfähigkeiten.</p></div></section>${owned.length?`<section class="card"><form id="teamOptimizerForm" class="form"><div class="field"><label>Hauptelement</label><select name="element"><option value="">Beliebig</option>${elements.map(e=>`<option>${e}</option>`).join('')}</select></div><div class="field"><label>Priorität</label><select name="mode"><option value="damage">Pal-Schaden und Support</option><option value="player">Spieler-Schaden</option><option value="safe">Sicherer Kampf</option></select></div><button class="primary">Team berechnen</button></form></section><div id="teamOptimizerResult"></div>`:`<section class="card"><h3>Kein Bestand</h3><p>Übernimm zuerst deine vorhandenen Pals aus dem Paldex.</p></section>`}${state.teamPlans.length?`<section class="card"><h3>Gespeicherte Teams</h3><div class="list">${state.teamPlans.slice(-5).reverse().map(t=>`<div class="list-item"><div><strong>${esc(t.name)}</strong><small>${(t.members||[]).map(m=>esc(m.name)).join(' · ')}</small></div><span class="badge">${esc(t.modeLabel||'Team')}</span></div>`).join('')}</div></section>`:''}`;
  document.querySelector('#teamBack')?.addEventListener('click',()=>document.querySelector('.tab[data-route="optimieren"]')?.click());
  document.querySelector('#teamOptimizerForm')?.addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));renderResult(buildTeam(owned,data.element,data.mode),data,state)});
  busy=false;
}

function renderResult(team,data,state){
  const labels={damage:'Pal-Support',player:'Spieler-Schaden',safe:'Sicher'};
  const result=document.querySelector('#teamOptimizerResult');
  result.innerHTML=`<section class="card result-card"><p class="eyebrow">BAUBARE EMPFEHLUNG</p><h3>${team.length} von 5 Plätzen</h3><div class="team-slots">${team.map((x,i)=>`<div class="team-slot"><span>${i+1}</span><div><strong>${esc(x.p.catalog.name)}</strong><small>${esc(x.p.catalog.element)} · ${x.p.owned.stars||0}★ · Level ${esc(x.p.owned.level||'offen')}</small><em>${esc(effectNames(x.p))}</em></div></div>`).join('')}</div><div class="reason-box"><strong>Auswahlbegründung</strong>${team.map(x=>`<p><b>${esc(x.p.catalog.name)}:</b> ${esc(x.reason)}</p>`).join('')}</div><p class="notice">Das ist eine Machbarkeits- und Synergieauswahl, keine behauptete DPS-Rangliste. Fehlende aktive Skills, Passivwerte und Basis-Kampfwerte werden nicht geschätzt.</p><button class="secondary" id="saveCalculatedTeam">Team speichern</button></section>`;
  document.querySelector('#saveCalculatedTeam')?.addEventListener('click',async()=>{const name=prompt('Name für das Team',state.profile?.goal||'Mein Team');if(!name)return;state.schemaVersion=6;state.teamPlans=state.teamPlans||[];state.teamPlans.push({id:crypto.randomUUID(),name,element:data.element,mode:data.mode,modeLabel:labels[data.mode],members:team.map(x=>({catalogId:x.p.catalog.key,name:x.p.catalog.name})),createdAt:new Date().toISOString()});await saveState(state);alert('Team lokal gespeichert.');});
}

function inject(){
  const grid=app.querySelector('.module-grid');
  if(!grid||grid.querySelector('[data-team-support]'))return;
  const button=document.createElement('button');button.className='module-card';button.dataset.teamSupport='';button.innerHTML='<div class="module-icon">◇</div><div><h3>Team & Support</h3><p>Baubare Synergien aus deinem Bestand</p></div><span class="badge">Aktiv</span>';button.addEventListener('click',renderTeamOptimizer);grid.prepend(button);
}

const style=document.createElement('style');style.textContent='.team-slots{display:grid;gap:10px;margin:14px 0}.team-slot{display:grid;grid-template-columns:38px 1fr;gap:12px;align-items:start;padding:14px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.04)}.team-slot>span{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;background:rgba(121,230,197,.12);color:var(--accent);font-weight:800}.team-slot strong,.team-slot small,.team-slot em{display:block}.team-slot small{color:var(--muted);margin-top:3px}.team-slot em{color:#cbd8f8;font-size:12px;margin-top:5px;font-style:normal}.reason-box{margin:14px 0;padding:15px;border-radius:16px;background:rgba(122,167,255,.08);border:1px solid rgba(122,167,255,.15)}.reason-box p{margin:9px 0 0!important}.notice{border-left:3px solid var(--accent2);padding:12px 14px;background:rgba(122,167,255,.08);border-radius:12px;color:#cbd8f8;font-size:13px;line-height:1.45}';document.head.appendChild(style);
new MutationObserver(inject).observe(app,{childList:true,subtree:true});inject();
