import assert from 'node:assert/strict';
import '../src/catalog-pack-5.js';
import '../src/catalog-pack-6.js';
import '../src/catalog-pack-7.js';
import '../src/generated-core.js';
import '../src/generated-partner-data.js';
import { COMBAT_GRAPH } from '../src/knowledge/combat-graph.js';
import { resolveSkill } from '../src/data/skills.js';
import { optimizeSkillRotation } from '../src/optimizer/skill-rotations.js';
import { optimizeTeam, TEAM_OBJECTIVES } from '../src/optimizer/engine.js';

assert.ok(COMBAT_GRAPH.pals.length>200,'Combat Graph muss vor der Optimierung aufgebaut sein');
assert.deepEqual(Object.keys(TEAM_OBJECTIVES),['practical','element','safest','speedrun']);
assert.equal(new Set(Object.values(TEAM_OBJECTIVES).map(x=>x.passiveGoal)).size>=2,true,'Zielfunktionen müssen verschiedene Passive-Ziele verwenden');

const encounter={id:'objective-test-boss',name:'Objective Test Boss',elements:['Schatten'],timeLimit:180,phases:[{id:'dark',hpShare:.6,elements:['Schatten'],recommendedCounters:['Drache']},{id:'ice',hpShare:.4,elements:['Eis'],recommendedCounters:['Feuer']}]};
const playable=COMBAT_GRAPH.pals.filter(pal=>pal.playable);
const withThreeSkills=playable.filter(pal=>pal.skills.length>=3);
const withThreeResolved=withThreeSkills.filter(pal=>pal.skills.filter(skill=>resolveSkill(skill.id)).length>=3);
const rotationRows=withThreeResolved.map(pal=>({pal,rotation:optimizeSkillRotation({pal,encounter,availableSkillIds:pal.skills.map(skill=>skill.id),duration:60,limit:3})}));
const withRotation=rotationRows.filter(row=>row.rotation.status==='ok');
const positiveRotationDps=withRotation.filter(row=>Number.isFinite(row.rotation.winner?.simulation?.modelDps)&&row.rotation.winner.simulation.modelDps>0);
const positiveAttack=playable.filter(pal=>Number.isFinite(Number(pal.stats?.attack))&&Number(pal.stats.attack)>0);
console.log('Optimizer diagnostics',JSON.stringify({playable:playable.length,withThreeSkills:withThreeSkills.length,withThreeResolved:withThreeResolved.length,withRotation:withRotation.length,positiveRotationDps:positiveRotationDps.length,positiveAttack:positiveAttack.length,sample:positiveRotationDps.slice(0,3).map(row=>({id:row.pal.id,attack:row.pal.stats.attack,modelDps:row.rotation.winner.simulation.modelDps,skills:row.rotation.winner.skillIds}))}));
assert.ok(withRotation.length>=5,'Mindestens fünf Pals müssen eine vollständige Dreierrotation besitzen');
assert.ok(positiveRotationDps.length>=5,'Mindestens fünf Rotationen müssen einen positiven Modellwert besitzen');
assert.ok(positiveAttack.length>=5,'Mindestens fünf Pals müssen einen positiven Angriffswert besitzen');

const result=optimizeTeam({activity:'tower',encounter,constraints:{ownedOnly:false}});
assert.equal(result.status,'ok',`Optimizer muss ein Team liefern: ${result.reason||'kein Grund'}`);
const ids=result.teams.map(team=>team.objective);
assert.deepEqual(ids,['element','practical','safest','speedrun']);
assert.equal(new Set(ids).size,4,'Jede Teamvariante braucht eine eigene Zielfunktion');
for(const team of result.teams){assert.equal(team.members.length,5);assert.equal(team.members.filter(member=>member.estimatedDpsRange).length,1,'Nur der aktive Haupt-Pal darf eigenen Pal-DPS tragen');assert.ok(team.assumptions.some(text=>text.includes('Eigene Zielfunktion')),'Zielfunktion muss im Ergebnis nachvollziehbar sein');assert.ok(Number.isFinite(team.objectiveScore));}
const element=result.teams.find(team=>team.objective==='element');
assert.ok(element.elementAlignment>=0,'Elementteam braucht eine explizite Phasen-/Counter-Ausrichtung');
console.log('Team-Zielfunktions-Tests bestanden.');
