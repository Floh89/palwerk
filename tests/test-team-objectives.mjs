import assert from 'node:assert/strict';
import '../src/catalog-pack-5.js';
import '../src/catalog-pack-6.js';
import '../src/catalog-pack-7.js';
import '../src/generated-core.js';
import '../src/generated-partner-data.js';
import { optimizeTeam, TEAM_OBJECTIVES } from '../src/optimizer/engine.js';

assert.deepEqual(Object.keys(TEAM_OBJECTIVES),['practical','element','safest','speedrun']);
assert.equal(new Set(Object.values(TEAM_OBJECTIVES).map(x=>x.passiveGoal)).size>=2,true,'Zielfunktionen müssen verschiedene Passive-Ziele verwenden');

const encounter={
  id:'objective-test-boss',
  name:'Objective Test Boss',
  elements:['Schatten'],
  timeLimit:180,
  phases:[
    {id:'dark',hpShare:.6,elements:['Schatten'],recommendedCounters:['Drache']},
    {id:'ice',hpShare:.4,elements:['Eis'],recommendedCounters:['Feuer']}
  ]
};
const result=optimizeTeam({activity:'tower',encounter,constraints:{ownedOnly:false}});
assert.equal(result.status,'ok');
const ids=result.teams.map(team=>team.objective);
assert.deepEqual(ids,['element','practical','safest','speedrun']);
assert.equal(new Set(ids).size,4,'Jede Teamvariante braucht eine eigene Zielfunktion');
for(const team of result.teams){
  assert.equal(team.members.length,5);
  assert.equal(team.members.filter(member=>member.estimatedDpsRange).length,1,'Nur der aktive Haupt-Pal darf eigenen Pal-DPS tragen');
  assert.ok(team.assumptions.some(text=>text.includes('Eigene Zielfunktion')),'Zielfunktion muss im Ergebnis nachvollziehbar sein');
  assert.ok(Number.isFinite(team.objectiveScore));
}
const element=result.teams.find(team=>team.objective==='element');
assert.ok(element.elementAlignment>=0,'Elementteam braucht eine explizite Phasen-/Counter-Ausrichtung');
console.log('Team-Zielfunktions-Tests bestanden.');
