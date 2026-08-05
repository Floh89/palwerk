import { loadState, saveState } from './storage.js';
import { PAL_CATALOG } from './catalog.js';
import { encounterOptions, estimatePalDps, combatStats, recommendPassives, DEFAULT_PLAYER, DEFAULT_PAL_PROFILE, requiredDps } from './optimizer-engine-v2.js';

const app=document.querySelector('#app');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v)||0;
const effects=p=>p?.partner?.effects||[];
const elements=p=>String(p?.element||'').split('/').map(x=>x.trim()).filter(Boolean);
const counter={Feuer:'Wasser',Wasser:'Elektro',Gras:'Feuer',Elektro:'Erde',Eis:'Feuer',Erde:'Gras',Schatten:'Drache',Drache:'Eis',Neutral:'Schatten'};
const blocked=/astralym|amaterasuwolf|quest|avatar|enemy|friend|summon|tower|raid_/i;
const image=p=>p?.imageKey?`assets/pals/${p.imageKey}.png`:p?.paldeck?`assets/pals/${String(p.paldeck).padStart(3,'0')}.png`:'';
const has=(p,type)=>effects(p).some(e=>e.type===type);
const effectValue=(p,type)=>effects(p).filter(e=>e.type===type).reduce((s,e)=>s+n(e.value??e.percent??e.amount),0);

function usable(p){
  if(!p?.name||blocked.test(`${p.name} ${p.internalId||''}`))return false;
  if(p.flags?.towerBoss||p.flags?.raidBoss)return false;
  if(p.rawRecord?.capture_rate_correct===0)return false;
  return (p.skills||[]).length>0&&n(p.stats?.attack)>0;
}
function profileFor(state,p){return state.palProfiles?.[p.key]||DEFAULT_PAL_PROFILE;}
function dpsRow(state,p,encounter){const profile=profileFor(state,p),estimate=estimatePalDps(p,profile,encounter),stats=combatStats(p,profile);return{pal:p,profile,dps:estimate.dps,rotation:estimate.rotation,stats};}
function rankDps(state,encounter,source){return source.map(p=>dpsRow(state,p,encounter)).filter(x=>x.dps>0&&x.rotation.length).sort((a,b)=>b.dps-a.dps);}
function partnerScore(p,types,carryElement){let score=0;for(const e of effects(p)){if(types.includes(e.type))score+=80+n(e.value??e.percent??e.amount);if(carryElement&&(e.element===carryElement||e.targetElement===carryElement))score+=100;}return score;}
function selectSupport(source,used,types,carryElement,state,encounter){
  const ranked=source.filter(p=>!used.has(p.key)).map(p=>({row:dpsRow(state,p,encounter),score:partnerScore(p,types,carryElement)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||b.row.dps-a.row.dps);
  return ranked[0]?.row||null;
}
function compose(state,encounter,scope){
  const owned=new Set((state.pals||[]).map(x=>x.catalogId));
  const source=PAL_CATALOG.filter(p=>usable(p)&&(scope!=='owned'||owned.has(p.key)));
  const ranked=rankDps(state,encounter,source);
  if(!ranked.length)return{members:[],owned};
  const carry=ranked[0],carryElement=elements(carry.pal)[0],used=new Set([carry.pal.key]);
  const slots=[{...carry,role:'Main Carry',kind:'carry',reason:`Höchster berechenbarer Schaden gegen ${encounter.name}; Rotation nutzt ${carry.rotation.map(x=>x.name).join(', ')}.`}];
  const configs=[
    {role:'Schadens-Buff',kind:'buff',types:['pal_element_attack','weakpoint_damage'],reason:p=>`${p.partner?.name||'Partnerfähigkeit'} verstärkt ${carryElement||'den Carry'} oder dessen Schwachpunktschaden.`},
    {role:'Cooldown',kind:'cooldown',types:['cooldown_reduction','party_follow_attack'],reason:p=>`${p.partner?.name||'Partnerfähigkeit'} erhöht Aktionsfrequenz oder ergänzt kontinuierlichen Schaden.`},
    {role:'Spieler-Buff',kind:'player',types:['player_attack','player_weapon_damage','player_attack_element_conversion'],reason:p=>`${p.partner?.name||'Partnerfähigkeit'} erhöht den Beitrag des Spieler-Loadouts.`},
    {role:'Überleben',kind:'sustain',types:['heal_player','revive_player','life_steal'],reason:p=>`${p.partner?.name||'Partnerfähigkeit'} stabilisiert das Team und reduziert Ausfallzeit.`}
  ];
  for(const c of configs){const found=selectSupport(source,used,c.types,carryElement,state,encounter);if(found){used.add(found.pal.key);slots.push({...found,role:c.role,kind:c.kind,reason:c.reason(found.pal)});}}
  for(const row of ranked){if(slots.length>=5)break;if(used.has(row.pal.key))continue;used.add(row.pal.key);slots.push({...row,role:'Sub-DPS',kind:'sub',reason:'Beste verbleibende Ergänzung mit berechenbarer Rotation und eigenem Schadensbeitrag.'});}
  return{members:slots.slice(0,5),owned};
}
function synergy(team){
  const carry=team[0],carryEl=elements(carry?.pal)[0];
  const elementBuff=team.reduce((s,x)=>s+effectValue(x.pal,'pal_element_attack')+effectValue(x.pal,'weakpoint_damage'),0);
  const playerBuff=team.reduce((s,x)=>s+effectValue(x.pal,'player_attack')+effectValue(x.pal,'player_weapon_damage'),0);
  const cooldown=team.reduce((s,x)=>s+effectValue(x.pal,'cooldown_reduction'),0);
  const sustain=team.filter(x=>has(x.pal,'heal_player')||has(x.pal,'revive_player')||has(x.pal,'life_steal')).length;
  return{carryEl,elementBuff,playerBuff,cooldown,sustain};
}
function teamDps(team,state){const pal=team.reduce((s,x)=>s+x.dps,0);const player=n(state.playerLoadout?.weaponDps);return{pal,player,total:pal+player};}
function card(x,i,owned,encounter){const src=image(x.pal),pass=recommendPassives(x.kind==='player'?'player':x.kind==='sustain'?'tank':x.kind==='cooldown'?'cooldown':'damage',encounter.elements);return`<article class="v3-pal ${x.kind}"><span class="v3-role">${esc(x.role)}</span><div class="v3-art">${src?`<img src="${src}" alt="" onerror="this.remove()">`:''}</div><h4>${esc(x.pal.name)}</h4><p class="v3-meta">${esc(x.pal.element||'Element offen')} · ${Math.round(x.dps)} Modell-DPS</p><div class="v3-tags"><span>${x.rotation[0]?.name?esc(x.rotation[0].name):'Rotation offen'}</span><span>${owned.has(x.pal.key)?'Vorhanden':'Ziel-Pal'}</span></div><p class="v3-why">${esc(x.reason)}</p><details><summary>Build</summary><p><b>Skills:</b> ${x.rotation.map(s=>esc(s.name)).join(' → ')}</p><p><b>Passives:</b> ${pass.map(esc).join(' · ')}</p><p><b>Seelen:</b> Angriff 10/10 · HP 10/10 · Verteidigung 10/10</p></details></article>`;}
function resultHtml(team,state,encounter,scope){
  if(!team.members.length)return`<section class="v3-panel"><p>Für diese Auswahl gibt es keine vollständig berechenbaren und verfügbaren Pals.</p></section>`;
  const sy=synergy(team.members),dps=teamDps(team.members,state),req=requiredDps(encounter),time=dps.total>0?encounter.hp/dps.total:null,margin=req?.target?dps.total/req.target:0;
  return`<section class="v3-kpis"><div><small>Boss-HP</small><strong>${n(encounter.hp).toLocaleString('de-DE')}</strong></div><div><small>Zeitlimit</small><strong>${Math.round(n(encounter.timeLimit)/60)} Min.</strong></div><div><small>Ziel-DPS</small><strong>${Math.ceil(req?.target||0).toLocaleString('de-DE')}/s</strong></div><div><small>Team-DPS</small><strong>${Math.round(dps.total).toLocaleString('de-DE')}/s</strong></div><div><small>Prognose</small><strong class="${margin>=1?'good':'bad'}">${margin>=1?'Sieg erwartet':'Ausbau nötig'}</strong></div></section><div class="v3-columns"><section class="v3-panel"><div class="v3-head"><div><p class="eyebrow">OPTIMALE KOMPOSITION</p><h3>${esc(encounter.name)}</h3></div><span class="badge">Synergie-Team</span></div><div class="v3-team">${team.members.map((x,i)=>card(x,i,team.owned,encounter)).join('')}</div><h4>Synergieübersicht</h4><div class="v3-synergy"><div><small>Carry-Element</small><strong>${esc(sy.carryEl||'offen')}</strong></div><div><small>Element-/Schwachpunktbuff</small><strong>+${sy.elementBuff||0}%</strong></div><div><small>Spielerbuff</small><strong>+${sy.playerBuff||0}%</strong></div><div><small>Cooldown</small><strong>-${sy.cooldown||0}%</strong></div><div><small>Sustain-Rollen</small><strong>${sy.sustain}</strong></div></div></section><aside class="v3-panel v3-analysis"><p class="eyebrow">ANALYSE</p><h3>Warum dieses Team?</h3>${team.members.map(x=>`<p class="v3-check">✓ <b>${esc(x.pal.name)}</b>: ${esc(x.reason)}</p>`).join('')}<hr><p class="eyebrow">BERECHNETE KAMPFZEIT</p><div class="v3-time">${time?`${Math.floor(time/60)}:${String(Math.round(time%60)).padStart(2,'0')} Min.`:'offen'}</div><p class="muted">Modellwert ohne vollständige Animations- und Trefferquotendaten.</p><button class="primary" id="v3Save">Team speichern</button></aside></div>`;
}
async function open(type='raid'){
  const state=await loadState({pals:[],palProfiles:{},playerLoadout:{...DEFAULT_PLAYER},teamPlans:[]});let difficulty='Normal';
  const render=()=>{const opts=encounterOptions(type,difficulty);app.innerHTML=`<button class="back-link" id="v3Back">‹ Optimierungszentrale</button><section class="v3-title"><div><p class="eyebrow">OPTIMIZER V3</p><h2>Team-Komposition statt Rangliste</h2><p>Carry, Buffs, Cooldown, Spieler-Support und Überleben werden gemeinsam optimiert.</p></div><span class="badge">Synergie-Engine</span></section><form id="v3Form" class="v3-controls"><div class="field"><label>Typ</label><select name="type"><option value="raid" ${type==='raid'?'selected':''}>Raid</option><option value="tower" ${type==='tower'?'selected':''}>Boss</option></select></div>${type==='tower'?`<div class="field"><label>Schwierigkeit</label><select name="difficulty"><option ${difficulty==='Normal'?'selected':''}>Normal</option><option ${difficulty==='Schwer'?'selected':''}>Schwer</option></select></div>`:''}<div class="field wide"><label>Gegner</label><select name="encounter">${opts.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · Lv. ${x.level} · ${n(x.hp).toLocaleString('de-DE')} HP</option>`).join('')}</select></div><div class="field"><label>Datenbasis</label><select name="scope"><option value="all">Alle fangbaren Pals</option><option value="owned">Nur mein Bestand</option></select></div><button class="primary">Komposition berechnen</button></form><div id="v3Result"></div>`;
    document.querySelector('#v3Back')?.addEventListener('click',()=>document.querySelector('[data-optimizer-hub]')?.click()||document.querySelector('.tab[data-route="optimieren"]')?.click());
    const form=document.querySelector('#v3Form');form.elements.type.addEventListener('change',e=>open(e.target.value));form.elements.difficulty?.addEventListener('change',e=>{difficulty=e.target.value;render();});form.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));const encounter=encounterOptions(type,difficulty).find(x=>x.id===d.encounter);const team=compose(state,encounter,d.scope);document.querySelector('#v3Result').innerHTML=resultHtml(team,state,encounter,d.scope);document.querySelector('#v3Save')?.addEventListener('click',async()=>{state.teamPlans=state.teamPlans||[];state.teamPlans.push({id:crypto.randomUUID(),name:`${encounter.name} · Synergie`,cluster:type,settings:d,members:team.members.map(x=>({catalogId:x.pal.key,name:x.pal.name,role:x.role})),createdAt:new Date().toISOString()});await saveState(state);alert('Synergie-Team lokal gespeichert.');});});
  };render();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-cluster="boss"],[data-cluster="raid"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();open(b.dataset.cluster==='raid'?'raid':'tower');},true);

const style=document.createElement('style');style.textContent=`.v3-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v3-title h2{margin:6px 0;font-size:28px}.v3-title p{color:var(--muted)}.v3-controls,.v3-panel,.v3-kpis{background:linear-gradient(145deg,rgba(30,36,51,.9),rgba(15,19,28,.92));border:1px solid var(--line);border-radius:22px;padding:16px}.v3-controls{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.v3-controls .wide{grid-column:1/-1}.v3-controls button{grid-column:1/-1}.v3-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:16px}.v3-kpis div{padding:10px;border-right:1px solid var(--line)}.v3-kpis div:last-child{border:0}.v3-kpis small,.v3-kpis strong{display:block}.v3-kpis small{color:var(--muted);font-size:11px}.v3-kpis strong{font-size:17px;margin-top:5px}.good{color:#7ee7a4}.bad{color:#ff9e9e}.v3-columns{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(250px,.8fr);gap:12px;margin-top:12px}.v3-head{display:flex;justify-content:space-between;align-items:start}.v3-head h3{margin:4px 0 12px}.v3-team{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.v3-pal{position:relative;min-width:0;padding:9px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.035);overflow:hidden}.v3-pal.carry{border-color:rgba(255,105,80,.55)}.v3-pal.buff{border-color:rgba(255,174,80,.5)}.v3-pal.cooldown{border-color:rgba(90,165,255,.5)}.v3-pal.player{border-color:rgba(105,220,125,.5)}.v3-pal.sustain{border-color:rgba(175,105,255,.5)}.v3-role{display:block;font-size:9px;font-weight:800;color:var(--accent);min-height:24px}.v3-art{height:92px;display:grid;place-items:center;background:radial-gradient(circle,rgba(121,230,197,.15),transparent 65%);border-radius:12px}.v3-art img{width:100%;height:100%;object-fit:contain}.v3-pal h4{font-size:14px;margin:8px 0 3px}.v3-meta,.v3-why{font-size:10px!important;margin:0!important;color:var(--muted)}.v3-why{margin-top:8px!important}.v3-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.v3-tags span{font-size:8px;padding:4px 6px;border-radius:8px;background:rgba(255,255,255,.07)}.v3-pal details{font-size:10px;margin-top:8px}.v3-synergy{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.v3-synergy div{padding:10px;background:rgba(255,255,255,.035);border-radius:12px}.v3-synergy small,.v3-synergy strong{display:block}.v3-synergy small{font-size:9px;color:var(--muted)}.v3-synergy strong{font-size:16px;margin-top:4px;color:var(--accent)}.v3-check{font-size:12px;line-height:1.4}.v3-time{font-size:30px;font-weight:850;color:#7ee7a4}.v3-analysis button{width:100%;margin-top:12px}@media(max-width:700px){.v3-columns{grid-template-columns:1fr}.v3-team{grid-template-columns:repeat(2,1fr)}.v3-pal:first-child{grid-column:1/-1}.v3-kpis{grid-template-columns:repeat(2,1fr)}.v3-synergy{grid-template-columns:repeat(2,1fr)}}`;
document.head.appendChild(style);
window.PALWERK_OPEN_BOSS_SELECTOR=()=>open('tower');window.PALWERK_OPEN_RAID_SELECTOR=()=>open('raid');
