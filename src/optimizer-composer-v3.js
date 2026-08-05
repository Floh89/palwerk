import { loadState, saveState } from './storage.js';
import { PAL_CATALOG } from './catalog.js';
import { encounterOptions, estimatePalDps, combatStats, recommendPassives, DEFAULT_PLAYER, DEFAULT_PAL_PROFILE, requiredDps } from './optimizer-engine-v2.js';

const app=document.querySelector('#app');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const n=v=>Number(v)||0;
const effects=p=>p?.partner?.effects||[];
const elements=p=>String(p?.element||'').split('/').map(x=>x.trim()).filter(Boolean);
const counter={Feuer:'Wasser',Wasser:'Elektro',Gras:'Feuer',Elektro:'Erde',Eis:'Feuer',Erde:'Gras',Schatten:'Drache',Drache:'Eis',Neutral:'Schatten'};
const blocked=/astralym|amaterasuwolf|quest|avatar|enemy|friend|summon|tower|raid_/i;
const image=p=>p?.imageKey?`assets/pals/${p.imageKey}.png`:p?.paldeck?`assets/pals/${String(p.paldeck).padStart(3,'0')}.png`:'';
const has=(p,type)=>effects(p).some(e=>e.type===type);
const rawValue=e=>n(e?.value??e?.percent??e?.amount);
const effectValue=(p,type)=>effects(p).filter(e=>e.type===type).reduce((s,e)=>s+rawValue(e),0);

function usable(p){
  if(!p?.name||blocked.test(`${p.name} ${p.internalId||''}`))return false;
  if(p.flags?.towerBoss||p.flags?.raidBoss)return false;
  if(p.rawRecord?.capture_rate_correct===0)return false;
  return (p.skills||[]).length>0&&n(p.stats?.attack)>0;
}
function profileFor(state,p){return state.palProfiles?.[p.key]||DEFAULT_PAL_PROFILE;}
function dpsRow(state,p,encounter){const profile=profileFor(state,p),estimate=estimatePalDps(p,profile,encounter),stats=combatStats(p,profile);return{pal:p,profile,dps:estimate.dps,rotation:estimate.rotation,stats};}
function rankDps(state,encounter,source){return source.map(p=>dpsRow(state,p,encounter)).filter(x=>x.dps>0&&x.rotation.length).sort((a,b)=>b.dps-a.dps);}
function partnerTypes(p){return new Set(effects(p).map(e=>e.type));}
function effectMatchesCarry(e,carryElement){return !e.element&&!e.targetElement||e.element===carryElement||e.targetElement===carryElement;}
function supportMetrics(p,carryElement){
  let element=0,general=0,cooldown=0,player=0,sustain=0,follow=0,defense=0;
  for(const e of effects(p)){
    const value=rawValue(e)||10;
    if((e.type==='pal_element_attack'||e.type==='weakpoint_damage')&&effectMatchesCarry(e,carryElement))element+=value;
    if(['pal_attack','party_pal_attack','all_pal_attack','pal_damage'].includes(e.type))general+=value;
    if(e.type==='cooldown_reduction')cooldown+=value;
    if(['player_attack','player_weapon_damage','player_attack_element_conversion'].includes(e.type))player+=value;
    if(['heal_player','revive_player','life_steal'].includes(e.type))sustain+=value;
    if(['party_follow_attack','active_weapon','active_launcher','active_grenade'].includes(e.type))follow+=value;
    if(['player_defense','pal_defense','damage_reduction'].includes(e.type))defense+=value;
  }
  return{element,general,cooldown,player,sustain,follow,defense};
}
function stackableFor(p,metric){
  const relevant={element:['pal_element_attack','weakpoint_damage'],general:['pal_attack','party_pal_attack','all_pal_attack','pal_damage'],cooldown:['cooldown_reduction'],player:['player_attack','player_weapon_damage','player_attack_element_conversion'],sustain:['heal_player','revive_player','life_steal'],follow:['party_follow_attack','active_weapon','active_launcher','active_grenade'],defense:['player_defense','pal_defense','damage_reduction']}[metric]||[];
  const rows=effects(p).filter(e=>relevant.includes(e.type));
  return rows.length&&!rows.some(e=>e.stackable===false);
}
function roleFor(member,carry){
  if(member.pal.key===carry.pal.key)return{role:'Main Carry',kind:'carry'};
  const m=member.metrics;
  const ranking=[['Element-Buff',m.element,'buff'],['Allgemeiner Buff',m.general,'buff'],['Cooldown',m.cooldown,'cooldown'],['Spieler-Buff',m.player,'player'],['Überleben',m.sustain+m.defense,'sustain'],['Zusatzangriff',m.follow+member.dps*.08,'sub'],['Sub-DPS',member.dps*.05,'sub']].sort((a,b)=>b[1]-a[1]);
  return{role:ranking[0][0],kind:ranking[0][2]};
}
function combinationScore(rows,carry,state,encounter){
  const carryElement=elements(carry.pal)[0];
  const playerBase=n(state.playerLoadout?.weaponDps);
  let palDps=0,elementBuff=0,generalBuff=0,cooldown=0,playerBuff=0,sustain=0,follow=0,defense=0;
  const seenNonStackable=new Set();
  for(const row of rows){
    palDps+=row.dps;
    for(const metric of ['element','general','cooldown','player','sustain','follow','defense']){
      const value=row.metrics[metric];if(!value)continue;
      const key=`${metric}:${row.pal.partner?.name||row.pal.key}`;
      if(!stackableFor(row.pal,metric)&&seenNonStackable.has(metric))continue;
      if(!stackableFor(row.pal,metric))seenNonStackable.add(metric);
      if(metric==='element')elementBuff+=value;
      if(metric==='general')generalBuff+=value;
      if(metric==='cooldown')cooldown+=value;
      if(metric==='player')playerBuff+=value;
      if(metric==='sustain')sustain+=value;
      if(metric==='follow')follow+=value;
      if(metric==='defense')defense+=value;
    }
  }
  const buffedCarry=carry.dps*(1+elementBuff/100+generalBuff/100)*(1+Math.min(60,cooldown)/200);
  const otherDps=Math.max(0,palDps-carry.dps);
  const playerDps=playerBase*(1+playerBuff/100);
  const sustainFactor=1+Math.min(45,sustain+defense)/300;
  const total=(buffedCarry+otherDps+follow*.6+playerDps)*sustainFactor;
  const diversity=new Set(rows.map(x=>roleFor(x,carry).role)).size;
  const score=total+diversity*3;
  return{score,total,palDps,playerDps,elementBuff,generalBuff,cooldown,playerBuff,sustain,follow,defense,carryElement};
}
function candidateRows(state,encounter,source,carry){
  const carryElement=elements(carry.pal)[0];
  return source.filter(p=>p.key!==carry.pal.key).map(p=>({...dpsRow(state,p,encounter),metrics:supportMetrics(p,carryElement)})).filter(x=>x.dps>0&&x.rotation.length).map(x=>{
    const utility=x.metrics.element*2.4+x.metrics.general*2.2+x.metrics.cooldown*1.8+x.metrics.player*1.4+x.metrics.sustain*.8+x.metrics.follow+x.metrics.defense*.6;
    return{...x,utility};
  }).sort((a,b)=>(b.utility+b.dps*.04)-(a.utility+a.dps*.04)).slice(0,18);
}
function searchForCarry(state,encounter,source,carry){
  const pool=candidateRows(state,encounter,source,carry);
  let best=null;
  const limit=Math.min(pool.length,18);
  for(let a=0;a<limit;a++)for(let b=a+1;b<limit;b++)for(let c=b+1;c<limit;c++)for(let d=c+1;d<limit;d++){
    const rows=[{...carry,metrics:supportMetrics(carry.pal,elements(carry.pal)[0])},pool[a],pool[b],pool[c],pool[d]];
    const metrics=combinationScore(rows,carry,state,encounter);
    if(!best||metrics.score>best.metrics.score)best={rows,carry,metrics};
  }
  return best;
}
function reasonFor(row,carry,metrics){
  if(row.pal.key===carry.pal.key)return`Stärkster Kern dieser Komposition gegen den gewählten Gegner. Die übrigen vier Plätze wurden speziell um ${row.pal.name} herum optimiert.`;
  const m=row.metrics,parts=[];
  if(m.element)parts.push(`${m.element}% passender Element-/Schwachpunktbuff`);
  if(m.general)parts.push(`${m.general}% allgemeiner Pal-Buff`);
  if(m.cooldown)parts.push(`${m.cooldown}% Cooldown-Effekt`);
  if(m.player)parts.push(`${m.player}% Spielerbuff`);
  if(m.sustain||m.defense)parts.push('reduziert Ausfallzeit');
  if(m.follow)parts.push('liefert zusätzlichen Begleitschaden');
  if(!parts.length)parts.push(`${Math.round(row.dps)} eigener Modell-DPS`);
  return `${row.pal.partner?.name||'Partnerfähigkeit'}: ${parts.join(' · ')}. Dieser Platz setzte sich gegen alternative Supports und Sub-DPS durch.`;
}
function compose(state,encounter,scope){
  const owned=new Set((state.pals||[]).map(x=>x.catalogId));
  const source=PAL_CATALOG.filter(p=>usable(p)&&(scope!=='owned'||owned.has(p.key)));
  const carries=rankDps(state,encounter,source).slice(0,10);
  if(!carries.length)return{members:[],owned};
  let best=null;
  for(const carry of carries){const candidate=searchForCarry(state,encounter,source,carry);if(candidate&&(!best||candidate.metrics.score>best.metrics.score))best=candidate;}
  if(!best)return{members:[],owned};
  const members=best.rows.map(row=>{const role=roleFor(row,best.carry);return{...row,...role,reason:reasonFor(row,best.carry,best.metrics)};});
  return{members,owned,metrics:best.metrics,carry:best.carry};
}
function synergy(team){
  if(team.metrics)return team.metrics;
  const carry=team.members?.[0],carryEl=elements(carry?.pal)[0];
  return{carryElement:carryEl,elementBuff:0,generalBuff:0,playerBuff:0,cooldown:0,sustain:0,follow:0,defense:0,total:team.members?.reduce((s,x)=>s+x.dps,0)||0};
}
function card(x,owned,encounter){
  const src=image(x.pal),pass=recommendPassives(x.kind==='player'?'player':x.kind==='sustain'?'tank':x.kind==='cooldown'?'cooldown':'damage',encounter.elements);
  return`<article class="v3-pal ${x.kind}"><span class="v3-role">${esc(x.role)}</span><div class="v3-art">${src?`<img src="${src}" alt="" onerror="this.remove()">`:''}</div><h4>${esc(x.pal.name)}</h4><p class="v3-meta">${esc(x.pal.element||'Element offen')} · ${Math.round(x.dps)} Modell-DPS</p><div class="v3-tags"><span>${x.rotation[0]?.name?esc(x.rotation[0].name):'Rotation offen'}</span><span>${owned.has(x.pal.key)?'Vorhanden':'Ziel-Pal'}</span></div><p class="v3-why">${esc(x.reason)}</p><details><summary>Build</summary><p><b>Skills:</b> ${x.rotation.map(s=>esc(s.name)).join(' → ')}</p><p><b>Passives:</b> ${pass.map(esc).join(' · ')}</p><p><b>Seelen:</b> Angriff 10/10 · HP 10/10 · Verteidigung 10/10</p></details></article>`;
}
function resultHtml(team,state,encounter){
  if(!team.members.length)return`<section class="v3-panel"><p>Für diese Auswahl gibt es keine vollständig berechenbaren und verfügbaren Pals.</p></section>`;
  const sy=synergy(team),req=requiredDps(encounter),dps=sy.total,time=dps>0?encounter.hp/dps:null,margin=req?.target?dps/req.target:0;
  const counts=team.members.reduce((m,x)=>(m[x.role]=(m[x.role]||0)+1,m),{});
  const structure=Object.entries(counts).map(([k,v])=>`${v}× ${k}`).join(' · ');
  return`<section class="v3-kpis"><div><small>Boss-HP</small><strong>${n(encounter.hp).toLocaleString('de-DE')}</strong></div><div><small>Zeitlimit</small><strong>${Math.round(n(encounter.timeLimit)/60)} Min.</strong></div><div><small>Ziel-DPS</small><strong>${Math.ceil(req?.target||0).toLocaleString('de-DE')}/s</strong></div><div><small>Team-DPS</small><strong>${Math.round(dps).toLocaleString('de-DE')}/s</strong></div><div><small>Prognose</small><strong class="${margin>=1?'good':'bad'}">${margin>=1?'Sieg erwartet':'Ausbau nötig'}</strong></div></section><div class="v3-columns"><section class="v3-panel"><div class="v3-head"><div><p class="eyebrow">DYNAMISCH OPTIMIERTE KOMPOSITION</p><h3>${esc(encounter.name)}</h3><p class="muted">${esc(structure)}</p></div><span class="badge">Kombinationssuche</span></div><div class="v3-team">${team.members.map(x=>card(x,team.owned,encounter)).join('')}</div><h4>Synergieübersicht</h4><div class="v3-synergy"><div><small>Carry-Element</small><strong>${esc(sy.carryElement||'offen')}</strong></div><div><small>Elementbuff</small><strong>+${Math.round(sy.elementBuff||0)}%</strong></div><div><small>Allgemeiner Buff</small><strong>+${Math.round(sy.generalBuff||0)}%</strong></div><div><small>Spielerbuff</small><strong>+${Math.round(sy.playerBuff||0)}%</strong></div><div><small>Cooldown</small><strong>-${Math.round(sy.cooldown||0)}%</strong></div></div></section><aside class="v3-panel v3-analysis"><p class="eyebrow">ANALYSE</p><h3>Warum diese Verteilung?</h3><p class="muted">PALWERK hat mehrere mögliche Carrys und Fünferkombinationen verglichen. Rollen wurden erst nach der Auswahl vergeben und nicht vorher festgelegt.</p>${team.members.map(x=>`<p class="v3-check">✓ <b>${esc(x.pal.name)}</b>: ${esc(x.reason)}</p>`).join('')}<hr><p class="eyebrow">BERECHNETE KAMPFZEIT</p><div class="v3-time">${time?`${Math.floor(time/60)}:${String(Math.round(time%60)).padStart(2,'0')} Min.`:'offen'}</div><p class="muted">Modellwert ohne vollständige Animations- und Trefferquotendaten.</p><button class="primary" id="v3Save">Team speichern</button></aside></div>`;
}
async function open(type='raid'){
  const state=await loadState({pals:[],palProfiles:{},playerLoadout:{...DEFAULT_PLAYER},teamPlans:[]});let difficulty='Normal';
  const render=()=>{const opts=encounterOptions(type,difficulty);app.innerHTML=`<button class="back-link" id="v3Back">‹ Optimierungszentrale</button><section class="v3-title"><div><p class="eyebrow">OPTIMIZER V3.1</p><h2>Dynamische Team-Komposition</h2><p>Keine festen Rollen: PALWERK testet Carry-, Support-, Buff-, Cooldown-, Sustain- und Sub-DPS-Mischungen gegeneinander.</p></div><span class="badge">Kombinationssuche</span></section><form id="v3Form" class="v3-controls"><div class="field"><label>Typ</label><select name="type"><option value="raid" ${type==='raid'?'selected':''}>Raid</option><option value="tower" ${type==='tower'?'selected':''}>Boss</option></select></div>${type==='tower'?`<div class="field"><label>Schwierigkeit</label><select name="difficulty"><option ${difficulty==='Normal'?'selected':''}>Normal</option><option ${difficulty==='Schwer'?'selected':''}>Schwer</option></select></div>`:''}<div class="field wide"><label>Gegner</label><select name="encounter">${opts.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · Lv. ${x.level} · ${n(x.hp).toLocaleString('de-DE')} HP</option>`).join('')}</select></div><div class="field"><label>Datenbasis</label><select name="scope"><option value="all">Alle fangbaren Pals</option><option value="owned">Nur mein Bestand</option></select></div><button class="primary">Beste Kombination suchen</button></form><div id="v3Result"></div>`;
    document.querySelector('#v3Back')?.addEventListener('click',()=>document.querySelector('[data-optimizer-hub]')?.click()||document.querySelector('.tab[data-route="optimieren"]')?.click());
    const form=document.querySelector('#v3Form');form.elements.type.addEventListener('change',e=>open(e.target.value));form.elements.difficulty?.addEventListener('change',e=>{difficulty=e.target.value;render();});form.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));const encounter=encounterOptions(type,difficulty).find(x=>x.id===d.encounter);const team=compose(state,encounter,d.scope);document.querySelector('#v3Result').innerHTML=resultHtml(team,state,encounter);document.querySelector('#v3Save')?.addEventListener('click',async()=>{state.teamPlans=state.teamPlans||[];state.teamPlans.push({id:crypto.randomUUID(),name:`${encounter.name} · Dynamische Synergie`,cluster:type,settings:d,members:team.members.map(x=>({catalogId:x.pal.key,name:x.pal.name,role:x.role})),createdAt:new Date().toISOString()});await saveState(state);alert('Dynamisches Synergie-Team lokal gespeichert.');});});
  };render();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-cluster="boss"],[data-cluster="raid"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();open(b.dataset.cluster==='raid'?'raid':'tower');},true);

const style=document.createElement('style');style.textContent=`.v3-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.v3-title h2{margin:6px 0;font-size:28px}.v3-title p{color:var(--muted)}.v3-controls,.v3-panel,.v3-kpis{background:linear-gradient(145deg,rgba(30,36,51,.9),rgba(15,19,28,.92));border:1px solid var(--line);border-radius:22px;padding:16px}.v3-controls{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.v3-controls .wide{grid-column:1/-1}.v3-controls button{grid-column:1/-1}.v3-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:16px}.v3-kpis div{padding:10px;border-right:1px solid var(--line)}.v3-kpis div:last-child{border:0}.v3-kpis small,.v3-kpis strong{display:block}.v3-kpis small{color:var(--muted);font-size:11px}.v3-kpis strong{font-size:17px;margin-top:5px}.good{color:#7ee7a4}.bad{color:#ff9e9e}.v3-columns{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(250px,.8fr);gap:12px;margin-top:12px}.v3-head{display:flex;justify-content:space-between;align-items:start}.v3-head h3{margin:4px 0 5px}.v3-team{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.v3-pal{position:relative;min-width:0;padding:9px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.035);overflow:hidden}.v3-pal.carry{border-color:rgba(255,105,80,.55)}.v3-pal.buff{border-color:rgba(255,174,80,.5)}.v3-pal.cooldown{border-color:rgba(90,165,255,.5)}.v3-pal.player{border-color:rgba(105,220,125,.5)}.v3-pal.sustain{border-color:rgba(175,105,255,.5)}.v3-role{display:block;font-size:9px;font-weight:800;color:var(--accent);min-height:24px}.v3-art{height:92px;display:grid;place-items:center;background:radial-gradient(circle,rgba(121,230,197,.15),transparent 65%);border-radius:12px}.v3-art img{width:100%;height:100%;object-fit:contain}.v3-pal h4{font-size:14px;margin:8px 0 3px}.v3-meta,.v3-why{font-size:10px!important;margin:0!important;color:var(--muted)}.v3-why{margin-top:8px!important}.v3-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.v3-tags span{font-size:8px;padding:4px 6px;border-radius:8px;background:rgba(255,255,255,.07)}.v3-pal details{font-size:10px;margin-top:8px}.v3-synergy{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.v3-synergy div{padding:10px;background:rgba(255,255,255,.035);border-radius:12px}.v3-synergy small,.v3-synergy strong{display:block}.v3-synergy small{font-size:9px;color:var(--muted)}.v3-synergy strong{font-size:16px;margin-top:4px;color:var(--accent)}.v3-check{font-size:12px;line-height:1.4}.v3-time{font-size:30px;font-weight:850;color:#7ee7a4}.v3-analysis button{width:100%;margin-top:12px}@media(max-width:700px){.v3-columns{grid-template-columns:1fr}.v3-team{grid-template-columns:repeat(2,1fr)}.v3-pal:first-child{grid-column:1/-1}.v3-kpis{grid-template-columns:repeat(2,1fr)}.v3-synergy{grid-template-columns:repeat(2,1fr)}}`;
document.head.appendChild(style);
window.PALWERK_OPEN_BOSS_SELECTOR=()=>open('tower');window.PALWERK_OPEN_RAID_SELECTOR=()=>open('raid');
