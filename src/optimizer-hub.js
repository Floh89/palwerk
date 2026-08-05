import { loadState, saveState } from './storage.js';
import { PAL_CATALOG, WORK_LABELS } from './catalog.js';

const app=document.querySelector('#app');
const esc=(v='')=>String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const elements=['Neutral','Feuer','Wasser','Gras','Elektro','Eis','Erde','Schatten','Drache'];
const counters={Feuer:'Wasser',Wasser:'Elektro',Gras:'Feuer',Elektro:'Erde',Eis:'Feuer',Erde:'Gras',Schatten:'Drache',Drache:'Eis',Neutral:'Schatten'};
const effectLabels={pal_element_attack:'Elementschaden',weakpoint_damage:'Schwachpunktschaden',pal_drop_bonus:'Beutebonus',player_attack:'Spielerangriff',player_weapon_damage:'Waffenschaden',player_attack_element_conversion:'Elementumwandlung',party_follow_attack:'Begleitangriff',heal_player:'Heilung',revive_player:'Wiederbelebung',active_weapon:'Aktive Waffe',active_launcher:'Aktiver Werfer',active_grenade:'Aktive Granate',mount:'Mobilität',item_weight_reduction:'Traglast',cooldown_reduction:'Cooldown',base_work_suitability_boost:'Basisverstärker',life_steal:'Lebensraub'};
const effects=p=>p.partner?.effects||[];
const ownedMap=state=>new Map((state.pals||[]).map(p=>[p.catalogId,p]));
const has=(p,types)=>effects(p).some(e=>types.includes(e.type));
const splitElements=p=>String(p?.element||'').split('/').map(x=>x.trim()).filter(Boolean);
const num=v=>Number(v)||0;
const skillPower=s=>num(s?.data?.power??s?.data?.Power??s?.power);
const skillCooldown=s=>num(s?.data?.cooldown??s?.data?.cool_time??s?.data?.CoolTime??s?.cooldown);
const skillElement=s=>String(s?.data?.element??s?.data?.type??s?.type??'');
const offensiveSkills=p=>(p.skills||[]).filter(s=>skillPower(s)>0);
const counterSkills=(p,counter)=>offensiveSkills(p).filter(s=>skillElement(s).toLowerCase().includes(String(counter).toLowerCase()));
const dpsSkillScore=(p,counter)=>{
  const skills=counterSkills(p,counter);
  const pool=skills.length?skills:offensiveSkills(p);
  return pool.sort((a,b)=>(skillPower(b)/(Math.max(1,skillCooldown(b))))-(skillPower(a)/(Math.max(1,skillCooldown(a))))).slice(0,3).reduce((sum,s)=>sum+skillPower(s)/Math.max(1,skillCooldown(s)),0);
};
const detail=p=>Object.keys(p.work||{}).length*2+effects(p).filter(e=>!['pending_partner_text','raw_partner_data'].includes(e.type)).length*5+(p.paldeck?2:0);
const roleDefs={
  damage:{label:'Haupt-DPS',types:['pal_element_attack','weakpoint_damage','active_weapon','active_launcher','active_grenade','party_follow_attack']},
  subdamage:{label:'Schnelle Angriffe',types:['pal_element_attack','party_follow_attack']},
  loot:{label:'Beutebonus',types:['pal_drop_bonus']},
  cooldown:{label:'Cooldown/Tempo',types:['cooldown_reduction','party_follow_attack']},
  sustain:{label:'Überleben',types:['heal_player','revive_player','life_steal']},
  carry:{label:'Traglast',types:['item_weight_reduction']},
  mobility:{label:'Mobilität',types:['mount']},
  player:{label:'Spieler-DPS',types:['player_attack','player_weapon_damage','player_attack_element_conversion','active_weapon','active_launcher']},
  tank:{label:'Tank',types:['heal_player','revive_player','life_steal']},
  utility:{label:'Utility',types:['base_work_suitability_boost']}
};
const clusters=[
  {id:'boss',title:'Boss Optimizer',icon:'⚔',desc:'Tower-, Alpha- und Spezialbosse',needsTarget:true,targetType:'boss',needsDifficulty:true,presets:['Schnellster Kill','Sicherster Kill','Spieler-DPS','Pal-DPS','Hybrid']},
  {id:'raid',title:'Raid Optimizer',icon:'◈',desc:'Bellanoir, Blazamut Ryu, Xenolord und weitere Raids',needsTarget:true,targetType:'raid',needsDifficulty:true,presets:['Solo','Multiplayer','Burst','Sustain','Ultra sicher']},
  {id:'element',title:'Element-Farming',icon:'◎',desc:'Pals eines Elements schnell und mit mehr Beute farmen',needsElement:true,presets:['Maximale Beute','Maximale Geschwindigkeit','Ausgewogen','Sicher']},
  {id:'worldtree',title:'World Tree',icon:'♧',desc:'Holz, Elite, Truhen, Materialien und längere Runs',presets:['Holz-Fokus','Elite-Fokus','Truhen-Fokus','Allround']},
  {id:'materials',title:'Material-Farming',icon:'◆',desc:'Erz, Holz, Stein, Kohle, Schwefel, Öl, Quarz und Chromit',needsMaterial:true,presets:['Base-Produktion','Aktiv farmen','Transport','Maximale Ausbeute']},
  {id:'fishing',title:'Angeln',icon:'≈',desc:'Angel-Runs, Transport, Sicherheit und Rückweg',presets:['Schnellste Route','Maximale Ausbeute','Sicher']},
  {id:'carry',title:'Traglast & Transport',icon:'▣',desc:'Maximales Gewicht, Rückweg und Ressourcentransport',presets:['Maximale Traglast','Schnellster Rückweg','Ausgewogen']},
  {id:'base',title:'Base & Arbeit',icon:'⌂',desc:'Holz, Erz, Transport, Strom, Handwerk, Medizin und Kochen',needsWork:true,presets:['Maximale Produktion','Stabile Basis','Spezialteam']},
  {id:'archetype',title:'Team-Archetypen',icon:'◇',desc:'Hyper Carry, Full Support, Burst, Sustain, Tank und Mobility',needsArchetype:true,presets:['Hyper Carry','Full Support','Spieler-DPS','Pal-DPS','Burst','Sustain','Crowd Control','Tank','Mobility']}
];
const materialOptions=['Holz','Stein','Erz','Kohle','Schwefel','Rohöl','Quarz','Chromit','Hexolith','Pal-Flüssigkeit','Feuerdrüsen','Eisdrüsen','Elektroorgane'];
const workOptions=Object.entries(WORK_LABELS);
const bossCandidates=()=>PAL_CATALOG.filter(p=>p.flags?.boss||p.flags?.towerBoss).sort((a,b)=>a.name.localeCompare(b.name,'de'));
const raidCandidates=()=>PAL_CATALOG.filter(p=>p.flags?.raidBoss||/bellanoir|blazamut ryu|xenolord/i.test(`${p.name} ${p.internalId||''}`)).sort((a,b)=>a.name.localeCompare(b.name,'de'));

function rolesFor(cluster,data){
  const p=data.preset||data.archetype||'';
  if(cluster.id==='boss'){
    if(p==='Sicherster Kill')return['damage','tank','sustain','cooldown','player'];
    if(p==='Spieler-DPS')return['player','player','damage','cooldown','sustain'];
    if(p==='Pal-DPS')return['damage','subdamage','damage','cooldown','sustain'];
    if(p==='Hybrid')return['damage','player','subdamage','sustain','cooldown'];
    return['damage','subdamage','damage','cooldown','player'];
  }
  if(cluster.id==='raid'){
    if(p==='Sustain'||p==='Ultra sicher')return['damage','tank','sustain','sustain','cooldown'];
    if(p==='Multiplayer')return['damage','subdamage','player','sustain','cooldown'];
    if(p==='Burst')return['damage','damage','subdamage','player','cooldown'];
    return['damage','subdamage','player','sustain','cooldown'];
  }
  if(cluster.id==='element')return p==='Maximale Beute'?['damage','loot','loot','cooldown','mobility']:p==='Maximale Geschwindigkeit'?['damage','subdamage','cooldown','mobility','loot']:p==='Sicher'?['damage','loot','sustain','tank','mobility']:['damage','loot','subdamage','cooldown','mobility'];
  if(cluster.id==='worldtree')return p==='Holz-Fokus'?['utility','carry','mobility','sustain','damage']:['damage','carry','mobility','sustain','subdamage'];
  if(cluster.id==='materials')return['utility','carry','mobility','damage','cooldown'];
  if(cluster.id==='fishing')return['mobility','carry','sustain','cooldown','utility'];
  if(cluster.id==='carry')return['carry','carry','mobility','sustain','damage'];
  if(cluster.id==='base')return['utility','utility','carry','cooldown','sustain'];
  return p==='Full Support'?['cooldown','sustain','player','utility','tank']:p==='Tank'?['tank','sustain','damage','cooldown','player']:p==='Mobility'?['mobility','mobility','carry','damage','sustain']:['damage','player','subdamage','cooldown','sustain'];
}
function roleScore(p,role,ctx){
  let score=detail(p);
  const def=roleDefs[role];
  const pEls=splitElements(p);
  for(const e of effects(p)){
    if(def.types.includes(e.type))score+=55;
    if(ctx.counter&&(e.element===ctx.counter||e.targetElement===ctx.counter))score+=35;
    if(ctx.targetElement&&e.targetElement===ctx.targetElement)score+=role==='loot'?95:25;
  }
  const stats=p.stats||{};
  const difficulty=ctx.difficulty==='Ultra'?1.35:ctx.difficulty==='Schwer'?1.18:1;
  const dps=dpsSkillScore(p,ctx.counter);
  if(['damage','subdamage'].includes(role)){
    score+=num(stats.attack)*0.7+dps*18;
    if(ctx.counter&&pEls.includes(ctx.counter))score+=110;
    if(role==='subdamage')score+=offensiveSkills(p).filter(s=>skillCooldown(s)>0&&skillCooldown(s)<=8).length*28;
  }
  if(role==='tank')score+=(num(stats.hp)*0.7+num(stats.defense)*0.9)*difficulty;
  if(role==='sustain')score+=(num(stats.hp)+num(stats.defense))*0.35*difficulty;
  if(role==='player'&&has(p,roleDefs.player.types))score+=120;
  if(role==='utility'&&ctx.work&&p.work?.[ctx.work])score+=90+p.work[ctx.work]*18;
  if(role==='carry'&&has(p,['item_weight_reduction']))score+=110;
  if(role==='loot'&&effects(p).some(e=>e.type==='pal_drop_bonus'&&(!ctx.targetElement||e.targetElement===ctx.targetElement)))score+=150;
  if(role==='cooldown'&&has(p,['cooldown_reduction']))score+=120;
  if(role==='mobility'&&has(p,['mount']))score+=100+num(p.movement?.rideSprint)*0.03;
  return score;
}
function pickTeam(source,cluster,ctx,data){const team=[];for(const role of rolesFor(cluster,data)){const ranked=source.filter(p=>!team.some(x=>x.p.key===p.key)).map(p=>({p,score:roleScore(p,role,ctx)})).sort((a,b)=>b.score-a.score||a.p.name.localeCompare(b.p.name,'de'));const best=ranked[0];if(best)team.push({p:best.p,role,score:Math.round(best.score),reason:reason(best.p,role,ctx)});}return team.slice(0,5)}
function reason(p,role,ctx){
  const relevant=effects(p).filter(e=>roleDefs[role].types.includes(e.type)).map(e=>effectLabels[e.type]).filter(Boolean);
  if(['damage','subdamage'].includes(role)&&ctx.counter){const skills=counterSkills(p,ctx.counter);const fast=skills.filter(s=>skillCooldown(s)>0&&skillCooldown(s)<=8);return`${ctx.counter}-Counter gegen ${ctx.targetElement}; ${skills.length} passende Angriffe${fast.length?`, davon ${fast.length} mit kurzem Cooldown`:''}.`;}
  if(role==='tank')return`Hohe Haltbarkeit aus HP ${num(p.stats?.hp)} und Verteidigung ${num(p.stats?.defense)}.`;
  if(role==='utility'&&ctx.work&&p.work?.[ctx.work])return`${WORK_LABELS[ctx.work]} Stufe ${p.work[ctx.work]} ist strukturiert erfasst.`;
  if(relevant.length)return`${roleDefs[role].label}: ${[...new Set(relevant)].join(' · ')}.`;
  return`${roleDefs[role].label}: beste Kombination aus Kampfwerten, Skills und verfügbaren Effekten.`;
}
function image(p){return p.imageKey?`assets/pals/${p.imageKey}.png`:p.paldeck?`assets/pals/${String(p.paldeck).padStart(3,'0')}.png`:''}
function teamHtml(team,state,target){const own=ownedMap(state);return team.map((x,i)=>{const src=image(x.p),hasPal=own.has(x.p.key);return`<div class="hub-team-row"><span>${i+1}</span>${src?`<img src="${src}" alt="" onerror="this.remove()">`:''}<div><strong>${esc(x.p.name)}</strong><small>${esc(roleDefs[x.role].label)} · ${esc(x.p.element||'Element offen')} · Score ${x.score}${target&&!hasPal?' · fehlt':''}</small><p>${esc(x.reason)}</p></div></div>`}).join('')}
function contextFrom(data){const target=PAL_CATALOG.find(p=>p.key===data.target);const targetElement=data.element||splitElements(target)[0]||'';return{target,targetElement,element:targetElement,counter:counters[targetElement]||'',material:data.material||'',work:data.work||'',difficulty:data.difficulty||'',preset:data.preset||'',archetype:data.archetype||''}}

async function openHub(){const state=await loadState({schemaVersion:8,pals:[],teamPlans:[]});app.innerHTML=`<button class="back-link" id="hubBack">‹ Optimieren</button><section class="hero compact-hero"><div><p class="eyebrow">OPTIMIERUNGSZENTRALE</p><h2>Was willst du erreichen?</h2><p>Wähle Ziel, Gegner und Schwerpunkt. PALWERK bewertet Elemente, Kampfwerte, aktive Skills und Partnerfähigkeiten.</p></div></section><div class="hub-clusters">${clusters.map(c=>`<button class="module-card hub-cluster" data-cluster="${c.id}"><div class="module-icon">${c.icon}</div><div><h3>${c.title}</h3><p>${c.desc}</p></div><span class="badge">${c.presets.length}</span></button>`).join('')}</div>`;document.querySelector('#hubBack')?.addEventListener('click',()=>document.querySelector('.tab[data-route="optimieren"]')?.click());document.querySelectorAll('[data-cluster]').forEach(b=>b.addEventListener('click',()=>openCluster(b.dataset.cluster,state)))}
function openCluster(id,state){
  const c=clusters.find(x=>x.id===id);const targets=c.targetType==='raid'?raidCandidates():bossCandidates();
  app.innerHTML=`<button class="back-link" id="clusterBack">‹ Optimierungszentrale</button><section class="hero compact-hero"><div><p class="eyebrow">${esc(c.title.toUpperCase())}</p><h2>${esc(c.desc)}</h2><p>Jeder Platz erfüllt eine konkrete Rolle. Änderungen am Gegner oder Schwerpunkt führen zu einer neuen Berechnung.</p></div></section><section class="card"><form id="clusterForm" class="form"><div class="field"><label>Planungsbasis</label><select name="scope"><option value="compare">Ziel-Team und Bestand vergleichen</option><option value="all">Alle Pals</option><option value="owned">Nur mein Bestand</option></select></div>${c.needsTarget?`<div class="field wide"><label>${c.targetType==='raid'?'Raid':'Boss'}</label><select name="target" required>${targets.map(x=>`<option value="${x.key}">${esc(x.name)} · ${esc(x.element)}</option>`).join('')}</select></div>`:''}${c.needsDifficulty?`<div class="field"><label>Schwierigkeit</label><select name="difficulty"><option>Normal</option><option>Schwer</option><option>Ultra</option></select></div>`:''}${c.needsElement?`<div class="field"><label>Zu farmendes Element</label><select name="element">${elements.map(x=>`<option>${x}</option>`).join('')}</select></div>`:''}${c.needsMaterial?`<div class="field"><label>Material</label><select name="material">${materialOptions.map(x=>`<option>${x}</option>`).join('')}</select></div>`:''}${c.needsWork?`<div class="field"><label>Arbeitsrolle</label><select name="work">${workOptions.map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>`:''}${c.needsArchetype?`<div class="field"><label>Archetyp</label><select name="archetype">${c.presets.map(x=>`<option>${x}</option>`).join('')}</select></div>`:`<div class="field"><label>Schwerpunkt</label><select name="preset">${c.presets.map(x=>`<option>${x}</option>`).join('')}</select></div>`}<button class="primary">Optimales Team berechnen</button></form></section><div id="hubResult"></div>`;
  document.querySelector('#clusterBack')?.addEventListener('click',openHub);
  document.querySelector('#clusterForm')?.addEventListener('submit',e=>{e.preventDefault();renderResult(c,Object.fromEntries(new FormData(e.currentTarget)),state)});
}
function renderResult(c,data,state){
  const ctx=contextFrom(data);const pool=PAL_CATALOG.filter(p=>p?.partner&&p?.name&&p.key!==ctx.target?.key);const all=pickTeam(pool,c,ctx,data);const ownSet=ownedMap(state);const own=pickTeam(pool.filter(p=>ownSet.has(p.key)),c,ctx,data);const missing=all.filter(x=>!ownSet.has(x.p.key));const sections=[];const targetLabel=ctx.target?`${ctx.target.name} · ${ctx.target.element}`:(data.element||data.material||'Optimiert');
  if(data.scope!=='owned')sections.push(`<section class="card"><p class="eyebrow">OPTIMALES ZIEL-TEAM</p><h3>${esc(targetLabel)} · ${esc(data.difficulty||data.preset||data.archetype||'Optimiert')}</h3><div class="hub-team">${teamHtml(all,state,true)}</div>${missing.length?`<p class="notice"><b>${missing.length} Ziel-Pals fehlen:</b> ${missing.map(x=>esc(x.p.name)).join(' · ')}</p>`:'<p class="notice">Das Ziel-Team ist vollständig vorhanden.</p>'}</section>`);
  if(data.scope!=='all')sections.push(`<section class="card"><p class="eyebrow">SOFORT SPIELBAR</p><h3>Beste Annäherung aus deinem Bestand</h3><div class="hub-team">${own.length?teamHtml(own,state,false):'<p>Noch keine passenden Bestands-Pals verknüpft.</p>'}</div></section>`);
  document.querySelector('#hubResult').innerHTML=sections.join('')+`<section class="card"><p class="notice">Berechnet aus Gegner-Element, Element-Counter, Basiswerten, Skill-Stärke pro Cooldown, Partnerfähigkeiten, Rollen und Schwierigkeit.</p><button class="secondary" id="saveHubTeam">Teamplan speichern</button></section>`;
  document.querySelector('#saveHubTeam')?.addEventListener('click',async()=>{const selected=data.scope==='owned'?own:all;const name=prompt('Name für den Teamplan',`${c.title} · ${ctx.target?.name||data.element||data.material||data.preset||data.archetype||''}`);if(!name)return;state.schemaVersion=8;state.teamPlans=state.teamPlans||[];state.teamPlans.push({id:crypto.randomUUID(),name,cluster:c.id,clusterLabel:c.title,settings:data,members:selected.map(x=>({catalogId:x.p.key,name:x.p.name,role:x.role,score:x.score,owned:ownSet.has(x.p.key)})),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});await saveState(state);alert('Teamplan lokal gespeichert.')});
}
function inject(){const grid=app.querySelector('.module-grid');if(!grid||grid.querySelector('[data-optimizer-hub]'))return;const b=document.createElement('button');b.className='module-card';b.dataset.optimizerHub='';b.innerHTML='<div class="module-icon">✦</div><div><h3>Optimierungszentrale</h3><p>Boss, Raid, Farming, World Tree, Angeln und mehr</p></div><span class="badge">Neu</span>';b.addEventListener('click',openHub);grid.prepend(b)}
const style=document.createElement('style');style.textContent='.hub-clusters,.hub-team{display:grid;gap:10px}.hub-team-row{display:grid;grid-template-columns:34px 58px 1fr;gap:10px;align-items:center;padding:13px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.04)}.hub-team-row>span{width:32px;height:32px;border-radius:11px;display:grid;place-items:center;background:rgba(121,230,197,.12);color:var(--accent);font-weight:800}.hub-team-row img{width:58px;height:58px;object-fit:contain}.hub-team-row strong,.hub-team-row small{display:block}.hub-team-row small{color:var(--muted);margin-top:3px}.hub-team-row p{font-size:12px;margin:6px 0 0!important}.hub-cluster{text-align:left}@media(max-width:410px){.hub-team-row{grid-template-columns:32px 48px 1fr}.hub-team-row img{width:48px;height:48px}}';document.head.appendChild(style);new MutationObserver(inject).observe(app,{childList:true,subtree:true});inject();
