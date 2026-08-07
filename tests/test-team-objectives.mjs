import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/catalog-pack-5.js';
import '../src/catalog-pack-6.js';
import '../src/catalog-pack-7.js';
import '../src/generated-core.js';
import '../src/generated-partner-data.js';
import { performance } from 'node:perf_hooks';
import { COMBAT_GRAPH } from '../src/knowledge/combat-graph.js';
import { resolveSkill } from '../src/data/skills.js';
import { TOWER_PROFILES } from '../src/encounter-overrides.js';
import { optimizeSkillRotation, rotationOptimizationCacheSize } from '../src/optimizer/skill-rotations.js';
import { passiveOptimizationCacheSize } from '../src/optimizer/passive-builds.js';
import { optimizeTeam, TEAM_OBJECTIVES, switchUtility, supportContribution, resolveStacking } from '../src/optimizer/engine.js';

assert.ok(COMBAT_GRAPH.pals.length>200,'Combat Graph muss vor der Optimierung aufgebaut sein');
assert.deepEqual(Object.keys(TEAM_OBJECTIVES),['practical','element','safest','speedrun']);
assert.ok(new Set(Object.values(TEAM_OBJECTIVES).map(x=>x.passiveGoal)).size>=2,'Zielfunktionen müssen verschiedene Passive-Ziele verwenden');

const encounter={id:'objective-test-boss',name:'Objective Test Boss',elements:['Schatten'],timeLimit:180,phases:[{id:'dark',hpShare:.6,elements:['Schatten'],recommendedCounters:['Drache']},{id:'ice',hpShare:.4,elements:['Eis'],recommendedCounters:['Feuer']}]};
const activeSynthetic={rotation:[{element:'Drache'}],palKnowledge:{elements:['Drache']},relativeCombatValue:100};
const redundantSwitch={rotation:[{element:'Drache'}],palKnowledge:{elements:['Drache']},relativeCombatValue:1000};
const complementarySwitch={rotation:[{element:'Feuer'}],palKnowledge:{elements:['Feuer']},relativeCombatValue:100};
assert.equal(switchUtility(activeSynthetic,redundantSwitch,encounter,'practical'),0,'Ein Reserve-Pal ohne zusätzliche Phasenabdeckung darf keinen erfundenen Nutzen erhalten');
assert.ok(switchUtility(activeSynthetic,complementarySwitch,encounter,'practical')>0,'Ein echter Phasen-Counter darf Wechselnutzen erhalten');

const stackingCarry={palKnowledge:{elements:['Elektro']}};
const supportEffect={type:'pal_element_attack',activation:'in_party',element:'Elektro',target:'Elektro',valuesByRank:[15,17,20,24,30],stackingGroup:'pal_element_attack:Elektro',stackable:false,status:'community-tested',confidence:'high'};
const sparkitLike={id:'sparkit-like',dexKey:'42:base',partner:{name:'Static Electricity'}};
const secondSpecies={id:'other-electric-support',dexKey:'999:base',partner:{name:'Different Electric Aura'}};
const sameSkillCopy={id:'sparkit-copy',dexKey:'42:copy',partner:{name:'Static Electricity'}};
const contributionA=supportContribution(supportEffect,sparkitLike,stackingCarry,4,'practical');
const contributionB=supportContribution(supportEffect,secondSpecies,stackingCarry,4,'practical');
const contributionCopy=supportContribution(supportEffect,sameSkillCopy,stackingCarry,4,'practical');
const differentSkills=resolveStacking([contributionA,contributionB]);
assert.equal(differentSkills.applied.length,2,'Verschiedene Partnerfähigkeiten mit gleichem Effekt müssen in Palworld 1.0 gemeinsam wirken können');
const sameSkill=resolveStacking([contributionA,contributionCopy]);
assert.equal(sameSkill.applied.length,1,'Dieselbe nicht stapelbare Partnerfähigkeit darf nur einmal angewendet werden');

const sameEffect=(a,b)=>a?.type===b?.type&&(a?.element||null)===(b?.element||null)&&(a?.target||null)===(b?.target||null)&&(a?.stackingGroup||null)===(b?.stackingGroup||null);
const validateGlobalCarrySupportTeam=(result,label)=>{
  assert.equal(result.status,'ok',`${label} muss mit allen fangbaren Pals ein Team liefern: ${result.reason||''}`);
  const practical=result.teams.find(team=>team.objective==='practical')||result.teams[0];
  assert.equal(practical.objective,'practical','Standardteam muss das praktische Carry-Support-Team sein');
  assert.equal(practical.members.length,5);
  assert.equal(practical.members.filter(member=>member.estimatedDpsRange).length,1,`${label}: genau ein Pal darf aktiven Pal-DPS tragen`);
  assert.ok(practical.members.every(member=>member.profile?.stars===4),`${label}: globale Optimierung muss alle fünf Pals mit 4★-Referenzprofil bewerten`);
  assert.ok(practical.effectiveSupportSlots>=2,`${label}: das praktische Team braucht mehrere tatsächlich angewendete Supportslots`);
  assert.ok(practical.supportModel?.multiplier>1,`${label}: Supportgruppe muss den Haupt-Pal messbar verstärken`);
  const ids=practical.members.map(member=>member.palKnowledge?.dexKey||member.pal?.key||member.pal?.name);
  assert.equal(new Set(ids).size,ids.length,`${label}: eine Pal-Form darf nicht versehentlich doppelt als mehrere verschiedene Slots erscheinen`);
  for(const member of practical.members.slice(1)){
    for(const effect of member.suppressedEffects||[]){
      const sameKindApplied=(member.appliedEffects||[]).some(applied=>sameEffect(applied,effect));
      if(!sameKindApplied)assert.ok(!(member.supportReasons||[]).some(reason=>reason.includes(effect.type)&&reason.includes(' · ')),`${label}: vollständig unterdrückter Effekt ${effect.type} darf nicht als aktive Support-Begründung erscheinen`);
    }
  }
  return practical;
};

const zoe=TOWER_PROFILES.find(x=>x.id==='zoe-grizzbolt-normal');
const zoeResult=optimizeTeam({activity:'tower',encounter:zoe,constraints:{ownedOnly:false}});
validateGlobalCarrySupportTeam(zoeResult,'Zoe & Grizzbolt');
assert.ok(zoeResult.teams.every(team=>team.members.length===5),'Jede Zoe-Teamvariante muss fünf reale Partyplätze enthalten');
assert.ok(zoeResult.teams[0].members.slice(1).some(member=>member.supportReasons?.length),'Das praktische Team braucht nachvollziehbare Support-Begründungen');

const lilyHard=TOWER_PROFILES.find(x=>x.id==='lily-lyleen-hard');
const lilyResult=optimizeTeam({activity:'tower',encounter:lilyHard,constraints:{ownedOnly:false}});
validateGlobalCarrySupportTeam(lilyResult,'Lily & Lyleen Schwer');

for(const profile of TOWER_PROFILES){
  const towerResult=optimizeTeam({activity:'tower',encounter:profile,constraints:{ownedOnly:false}});
  const practical=validateGlobalCarrySupportTeam(towerResult,`${profile.name} ${profile.difficulty}`);
  assert.ok(practical.members.slice(1).some(member=>(member.appliedEffects||[]).length>0),`${profile.name} ${profile.difficulty}: mindestens ein Supporteffekt muss tatsächlich angewendet werden`);
  const elementTeam=towerResult.teams.find(team=>team.objective==='element');
  assert.ok(elementTeam&&Number.isFinite(elementTeam.elementAlignment),`${profile.name} ${profile.difficulty}: Elementteam braucht eine nachvollziehbare Counter-Ausrichtung`);
}

const neutralResult=optimizeTeam({activity:'normal_team',encounter:{id:'manual-neutral',name:'Bosskampf',elements:['Neutral']},constraints:{ownedOnly:false}});
assert.equal(neutralResult.status,'ok',`Manuelles neutrales Bossziel muss ein Team liefern: ${neutralResult.reason||''}`);
assert.ok(neutralResult.teams.every(team=>team.members.length===5),'Auch bei lückenhaften Supportdaten muss ein reales Fünferteam entstehen');
for(const team of [...zoeResult.teams,...lilyResult.teams,...neutralResult.teams]){
  assert.equal(team.members.filter(member=>member.estimatedDpsRange).length,1,'Supportplätze dürfen keinen simultanen Pal-DPS erhalten');
}

const uiSource=fs.readFileSync(new URL('../src/optimizer/ui.js',import.meta.url),'utf8');
assert.ok(uiSource.includes("find(item=>item.objective==='practical')"),'UI muss das praktische Team standardmäßig anzeigen');
assert.ok(uiSource.includes('1 Haupt-Pal + 4 Supportplätze'),'UI muss das Carry-Support-Modell sichtbar machen');

const playable=COMBAT_GRAPH.pals.filter(pal=>pal.playable);
const sample=playable.filter(pal=>pal.skills.length>=3&&pal.skills.filter(skill=>resolveSkill(skill.id)).length>=3).slice(0,32);
assert.ok(sample.length>=24,'Breite Stichprobe mit vollständigen Skilldaten erforderlich');
for(const pal of sample){
  const rotation=optimizeSkillRotation({pal,encounter,availableSkillIds:pal.skills.map(skill=>skill.id),duration:60,limit:3});
  assert.equal(rotation.status,'ok',`${pal.id}: Rotation muss auswertbar sein`);
  assert.ok(Number.isFinite(rotation.winner?.simulation?.modelDps)&&rotation.winner.simulation.modelDps>0,`${pal.id}: Rotation braucht positiven Modellwert`);
}

const coldStart=performance.now();
const result=optimizeTeam({activity:'tower',encounter,constraints:{ownedOnly:false}});
const coldMs=performance.now()-coldStart;
assert.equal(result.status,'ok',`Optimizer muss ein Team liefern: ${result.reason||'kein Grund'}`);

const warmStart=performance.now();
const repeated=optimizeTeam({activity:'tower',encounter,constraints:{ownedOnly:false}});
const warmMs=performance.now()-warmStart;
assert.equal(repeated.status,'ok');
assert.ok(rotationOptimizationCacheSize()>0,'Rotationsergebnisse müssen wiederverwendet werden');
assert.ok(passiveOptimizationCacheSize()>0,'Passive-Build-Suchen müssen wiederverwendet werden');
assert.ok(warmMs<=coldMs*1.35+25,`Warmer Optimizerlauf darf nicht deutlich langsamer werden (${coldMs.toFixed(0)} ms -> ${warmMs.toFixed(0)} ms)`);

const ids=result.teams.map(team=>team.objective);
assert.deepEqual(ids,['practical','element','safest','speedrun']);
assert.equal(new Set(ids).size,4,'Jede Teamvariante braucht eine eigene Zielfunktion');
for(const team of result.teams){
  assert.equal(team.members.length,5);
  assert.equal(team.members.filter(member=>member.estimatedDpsRange).length,1,'Nur der aktive Haupt-Pal darf eigenen Pal-DPS tragen');
  assert.ok(team.assumptions.some(text=>text.includes('Eigene Zielfunktion')),'Zielfunktion muss im Ergebnis nachvollziehbar sein');
  assert.ok(team.assumptions.some(text=>text.includes('4★')),'Globale Endgame-Annahme muss transparent sein');
  assert.ok(team.assumptions.some(text=>text.includes('Partnerfähigkeit')),'1.0-Stackingregel muss transparent sein');
  assert.ok(Number.isFinite(team.objectiveScore));
  assert.ok(team.supportModel&&team.supportModel.multiplier>=1,'Team muss ein explizites Carry-Support-Modell besitzen');
  assert.ok(Number.isInteger(team.effectiveSupportSlots)&&team.effectiveSupportSlots>=1,'Wirksame Supportslots müssen ausgewiesen werden');
  for(const applied of team.stacking.applied){
    if(applied.quantified===false)assert.equal(applied.value,null,'Unquantifizierte Partnereffekte dürfen keinen erfundenen Zahlenwert tragen');
  }
}
const element=result.teams.find(team=>team.objective==='element');
assert.ok(element.elementAlignment>=0,'Elementteam braucht eine explizite Phasen-/Counter-Ausrichtung');
console.log(`Team-Zielfunktions-Tests bestanden. Alle ${TOWER_PROFILES.length} Towerprofile geprüft. Optimizer ${coldMs.toFixed(0)} ms kalt / ${warmMs.toFixed(0)} ms warm.`);
