import assert from 'node:assert/strict';
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
import { optimizeTeam, TEAM_OBJECTIVES, switchUtility } from '../src/optimizer/engine.js';

assert.ok(COMBAT_GRAPH.pals.length>200,'Combat Graph muss vor der Optimierung aufgebaut sein');
assert.deepEqual(Object.keys(TEAM_OBJECTIVES),['practical','element','safest','speedrun']);
assert.ok(new Set(Object.values(TEAM_OBJECTIVES).map(x=>x.passiveGoal)).size>=2,'Zielfunktionen müssen verschiedene Passive-Ziele verwenden');

const encounter={id:'objective-test-boss',name:'Objective Test Boss',elements:['Schatten'],timeLimit:180,phases:[{id:'dark',hpShare:.6,elements:['Schatten'],recommendedCounters:['Drache']},{id:'ice',hpShare:.4,elements:['Eis'],recommendedCounters:['Feuer']}]};
const activeSynthetic={rotation:[{element:'Drache'}],palKnowledge:{elements:['Drache']},relativeCombatValue:100};
const redundantSwitch={rotation:[{element:'Drache'}],palKnowledge:{elements:['Drache']},relativeCombatValue:1000};
const complementarySwitch={rotation:[{element:'Feuer'}],palKnowledge:{elements:['Feuer']},relativeCombatValue:100};
assert.equal(switchUtility(activeSynthetic,redundantSwitch,encounter,'practical'),0,'Ein Reserve-Pal ohne zusätzliche Phasenabdeckung darf keinen erfundenen Nutzen erhalten');
assert.ok(switchUtility(activeSynthetic,complementarySwitch,encounter,'practical')>0,'Ein echter Phasen-Counter darf Wechselnutzen erhalten');

const zoe=TOWER_PROFILES.find(x=>x.id==='zoe-grizzbolt-normal');
const zoeResult=optimizeTeam({activity:'tower',encounter:zoe,constraints:{ownedOnly:false}});
assert.equal(zoeResult.status,'ok',`Zoe & Grizzbolt muss mit allen fangbaren Pals ein Team liefern: ${zoeResult.reason||''}`);
assert.ok(zoeResult.teams.every(team=>team.members.length===5),'Jede Zoe-Teamvariante muss fünf reale Partyplätze enthalten');
const neutralResult=optimizeTeam({activity:'normal_team',encounter:{id:'manual-neutral',name:'Bosskampf',elements:['Neutral']},constraints:{ownedOnly:false}});
assert.equal(neutralResult.status,'ok',`Manuelles neutrales Bossziel muss ein Team liefern: ${neutralResult.reason||''}`);
assert.ok(neutralResult.teams.every(team=>team.members.length===5),'Auch ohne vier quantifizierte Supports muss ein reales Fünferteam entstehen');
for(const team of [...zoeResult.teams,...neutralResult.teams]){
  assert.equal(team.members.filter(member=>member.estimatedDpsRange).length,1,'Reserveplätze dürfen keinen simultanen Pal-DPS erhalten');
  for(const member of team.members.slice(1))if(member.supportUtility===0&&member.switchPotential===0)assert.equal(member.relativeCombatValue,0,'Neutraler Reserve-Pal muss 0 zum gleichzeitigen Teamwert beitragen');
}

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
assert.deepEqual(ids,['element','practical','safest','speedrun']);
assert.equal(new Set(ids).size,4,'Jede Teamvariante braucht eine eigene Zielfunktion');
for(const team of result.teams){
  assert.equal(team.members.length,5);
  assert.equal(team.members.filter(member=>member.estimatedDpsRange).length,1,'Nur der aktive Haupt-Pal darf eigenen Pal-DPS tragen');
  assert.ok(team.assumptions.some(text=>text.includes('Eigene Zielfunktion')),'Zielfunktion muss im Ergebnis nachvollziehbar sein');
  assert.ok(team.assumptions.some(text=>text.includes('ohne belastbaren Rangwert')),'Nicht quantifizierte Supports müssen transparent ausgewiesen werden');
  assert.ok(Number.isFinite(team.objectiveScore));
  for(const applied of team.stacking.applied){
    if(applied.quantified===false)assert.equal(applied.value,null,'Unquantifizierte Partnereffekte dürfen keinen erfundenen Zahlenwert tragen');
  }
}
const element=result.teams.find(team=>team.objective==='element');
assert.ok(element.elementAlignment>=0,'Elementteam braucht eine explizite Phasen-/Counter-Ausrichtung');
console.log(`Team-Zielfunktions-Tests bestanden. Optimizer ${coldMs.toFixed(0)} ms kalt / ${warmMs.toFixed(0)} ms warm.`);
