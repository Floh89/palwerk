import { PAL_CATALOG } from '../catalog.js';
import { loadState } from '../storage.js';
import { analyzeTeamSynergy, SYNERGY_MODEL_VERSION } from './synergy.js';

const app=document.querySelector('#app');
const esc=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const BLOCKED=/astralym|amaterasuwolf|quest|avatar|enemy|friend|summon|tower|raid_|npc|human/i;
const QUALITY={verified:'Verifiziert','community-tested':'Community-geprüft',modelled:'Modelliert',provisional:'Vorläufig',missing:'Fehlend'};
const DIMENSION_ORDER=['damage','tempo','player','sustain','utility'];
const TYPE_WEIGHT={pal_element_attack:9,weakpoint_damage:9,pal_attack:8,party_pal_attack:8,cooldown_reduction:7,party_follow_attack:6,player_attack:6,player_weapon_damage:6,player_defense:4,heal_player:5,revive_player:5,life_steal:4,damage_reduction:5,carry_capacity:2,item_weight_reduction:2,capture_bonus:2,loot_bonus:2};

const usable=pal=>Boolean(pal?.key&&pal?.name&&!BLOCKED.test(`${pal.internalId||''} ${pal.name}`)&&!pal.flags?.towerBoss&&!pal.flags?.raidBoss&&pal.rawRecord?.capture_rate_correct!==0);
const elementsOf=pal=>String(pal?.element||'').split('/').map(value=>value.trim()).filter(Boolean);
const effectsOf=pal=>(pal.partner?.effects||[]).filter(effect=>effect.activation==='in_party'&&effect.status!=='missing');
const qualityWeight=effect=>effect.status==='verified'&&effect.confidence==='high'?1:effect.status==='community-tested'?.8:effect.status==='modelled'?.55:.3;
const targetMatches=(effect,carry)=>{const target=effect.element||effect.targetElement||effect.target;return !target||elementsOf(carry).includes(target)};
const groupOf=effect=>effect.stackingGroup||`${effect.type}:${effect.element||effect.target||'general'}`;

function profileStars(state,pal){return Number(state?.palProfiles?.[pal.key]?.stars||state?.palProfiles?.[pal.internalId]?.stars||0);}
function valueAtRank(effect,rank){if(!Array.isArray(effect.valuesByRank))return null;const value=effect.valuesByRank[Math.max(0,Math.min(4,rank))];return value==null?null:Number(value);}
function candidateFor(pal,carry,state){
  const stars=profileStars(state,pal);
  const effects=effectsOf(pal).filter(effect=>targetMatches(effect,carry));
  const score=effects.reduce((sum,effect)=>sum+(TYPE_WEIGHT[effect.type]||1)*qualityWeight(effect)*(valueAtRank(effect,stars)==null?.6:1),0);
  return{pal,stars,effects,score};
}
function resolveCandidates(candidates){
  const selected=[],usedGroups=new Set();
  const ordered=[...candidates].sort((a,b)=>b.score-a.score||a.pal.name.localeCompare(b.pal.name));
  while(selected.length<4&&ordered.length){
    let bestIndex=0,bestGain=-Infinity;
    for(let index=0;index<ordered.length;index++){
      const candidate=ordered[index];
      const unique=candidate.effects.filter(effect=>effect.stackable===true||!usedGroups.has(groupOf(effect))).length;
      const gain=candidate.score+unique*3-candidate.effects.length+unique;
      if(gain>bestGain){bestGain=gain;bestIndex=index;}
    }
    const [candidate]=ordered.splice(bestIndex,1);
    selected.push(candidate);
    for(const effect of candidate.effects)if(effect.stackable!==true)usedGroups.add(groupOf(effect));
  }
  const contributions=selected.flatMap(candidate=>candidate.effects.map(effect=>({candidate,effect,group:groupOf(effect),score:(TYPE_WEIGHT[effect.type]||1)*qualityWeight(effect)})));
  const applied=[],suppressed=[];
  for(const contribution of contributions){
    if(contribution.effect.stackable===true){applied.push(contribution);continue;}
    const prior=applied.find(item=>item.group===contribution.group&&item.effect.stackable!==true);
    if(!prior){applied.push(contribution);continue;}
    if(contribution.score>prior.score){applied.splice(applied.indexOf(prior),1,contribution);suppressed.push(prior);}else suppressed.push(contribution);
  }
  return{selected,applied,suppressed};
}
function memberFrom(candidate,resolution){
  return{pal:candidate.pal,appliedEffects:resolution.applied.filter(item=>item.candidate===candidate).map(item=>item.effect),suppressedEffects:resolution.suppressed.filter(item=>item.candidate===candidate).map(item=>item.effect)};
}
function badge(state){return`<span class="badge synergy-${esc(state)}">${esc(QUALITY[state]||state)}</span>`;}
function dimensionCard(dimension){
  const evidence=dimension.evidence.map(item=>`<li><strong>${esc(item.palName)}</strong>: ${esc(item.partnerName)} · ${esc(item.effectType)}${item.hasRankValues?'':' · Rangwert offen'}</li>`).join('');
  return`<article class="card synergy-dimension"><div class="synergy-head"><h3>${esc(dimension.label)}</h3>${badge(dimension.state)}</div><p>${dimension.memberCount?`${dimension.memberCount} Unterstützer · ${Math.round(dimension.rankCoverage*100)} % Rangabdeckung`:'Nicht abgedeckt'}</p>${evidence?`<ul>${evidence}</ul>`:''}</article>`;
}
function renderResult(carry,resolution,analysis){
  const members=resolution.selected.map(candidate=>memberFrom(candidate,resolution));
  const memberHtml=members.map(member=>`<article class="optimizer-member"><span class="badge">Support</span><h4>${esc(member.pal.name)}</h4><p>${esc(member.pal.element||'Element offen')}</p><p><strong>Aktiv:</strong> ${member.appliedEffects.length?member.appliedEffects.map(effect=>esc(effect.type)).join(', '):'Kein eindeutiger Effekt'}</p>${member.suppressedEffects.length?`<p><strong>Kollision:</strong> ${member.suppressedEffects.map(effect=>esc(groupOf(effect))).join(', ')}</p>`:''}</article>`).join('');
  return`<section class="card optimizer-sticky"><p class="eyebrow">SYNERGIE-DIAGNOSE ${SYNERGY_MODEL_VERSION}</p><h3>${esc(carry.name)} als Haupt-Pal</h3><p>${esc(analysis.summary)}</p><p>${analysis.evidenceCount} verwertbare Effekte · ${analysis.verifiedEvidenceCount} bestätigt oder community-geprüft · Vertrauensquote ${Math.round(analysis.confidence*100)} %</p></section><section class="optimizer-team-grid"><article class="optimizer-member synergy-carry"><span class="badge">Haupt-Pal</span><h4>${esc(carry.name)}</h4><p>${esc(carry.element||'Element offen')}</p><p>Die Unterstützer werden auf passende In-Party-Effekte und Stacking-Konflikte geprüft.</p></article>${memberHtml}</section><section class="synergy-dimension-grid">${DIMENSION_ORDER.map(id=>dimensionCard(analysis.dimensions[id])).join('')}</section>${analysis.collisions.length?`<section class="card warning"><h3>Stacking-Kollisionen</h3><ul>${analysis.collisions.map(item=>`<li>${esc(item.group)}: ${item.suppressedCount} Effekt(e) nicht zusätzlich gewertet</li>`).join('')}</ul></section>`:''}<section class="card"><h3>Einordnung</h3><p>Dies ist eine strukturelle Synergie-Diagnose, keine garantierte DPS-Rangliste. Fehlende Rangwerte werden nicht geschätzt.</p></section>`;
}

async function openSynergyLab(){
  const state=await loadState({pals:[],palProfiles:{}});
  const ownedIds=new Set((state.pals||[]).map(item=>item.catalogId||item.key||item.internalId));
  const all=PAL_CATALOG.filter(usable).sort((a,b)=>a.name.localeCompare(b.name));
  app.innerHTML=`<button class="back-link" data-synergy-back>‹ Optimieren</button><section class="hero compact-hero"><div><p class="eyebrow">PHASE 4</p><h2>Synergie-Labor</h2><p>Haupt-Pal auswählen und Teamabdeckung, Datenqualität sowie Stacking-Konflikte prüfen.</p></div></section><form class="card form" id="synergyForm"><div class="field wide"><label>Haupt-Pal</label><select name="carry">${all.map(pal=>`<option value="${esc(pal.key)}">${esc(pal.name)} · ${esc(pal.element||'Element offen')}</option>`).join('')}</select></div><div class="field"><label>Datenbasis</label><select name="scope"><option value="all">Alle fangbaren Pals</option><option value="owned">Nur mein Bestand</option></select></div><button class="primary">Synergie prüfen</button></form><div id="synergyResult"></div>`;
  document.querySelector('[data-synergy-back]')?.addEventListener('click',()=>document.querySelector('.tab[data-route="optimieren"]')?.click());
  document.querySelector('#synergyForm')?.addEventListener('submit',event=>{
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.currentTarget));
    const carry=all.find(pal=>pal.key===values.carry);
    const source=all.filter(pal=>pal.key!==carry.key&&(values.scope!=='owned'||ownedIds.has(pal.key)||ownedIds.has(pal.internalId)));
    const candidates=source.map(pal=>candidateFor(pal,carry,state)).filter(candidate=>candidate.effects.length&&candidate.score>0);
    const resolution=resolveCandidates(candidates);
    const carryMember={pal:carry,appliedEffects:[],suppressedEffects:[]};
    const supportMembers=resolution.selected.map(candidate=>memberFrom(candidate,resolution));
    const stacking={applied:resolution.applied.map(item=>({palId:item.candidate.pal.key,group:item.group,type:item.effect.type})),suppressed:resolution.suppressed.map(item=>({palId:item.candidate.pal.key,group:item.group,type:item.effect.type}))};
    const analysis=analyzeTeamSynergy([carryMember,...supportMembers],carryMember,stacking);
    const target=document.querySelector('#synergyResult');
    target.innerHTML=resolution.selected.length?renderResult(carry,resolution,analysis):'<section class="card warning"><h3>Keine belastbare Synergieauswahl</h3><p>Für diesen Haupt-Pal und die gewählte Datenbasis sind keine passenden strukturierten In-Party-Effekte vorhanden.</p></section>';
  });
}

function injectCard(){
  const grid=document.querySelector('.module-grid');
  if(!grid||grid.querySelector('[data-synergy-lab]'))return;
  const button=document.createElement('button');
  button.className='module-card';
  button.dataset.synergyLab='true';
  button.innerHTML='<div class="module-icon">◎</div><div><h3>Synergie-Labor</h3><p>Rollen, Stacking und Datenlücken eines Haupt-Pals</p></div><span class="badge">Phase 4</span>';
  button.addEventListener('click',openSynergyLab);
  grid.appendChild(button);
}

export function installSynergyUI(){
  new MutationObserver(injectCard).observe(app,{childList:true,subtree:true});
  injectCard();
}

const style=document.createElement('style');
style.textContent='.synergy-dimension-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:12px 0}.synergy-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.synergy-dimension ul{padding-left:18px;color:var(--muted);font-size:12px;line-height:1.5}.synergy-carry{border-color:rgba(255,255,255,.28)}@media(max-width:680px){.synergy-dimension-grid{grid-template-columns:1fr}}';
document.head.appendChild(style);
