import assert from 'node:assert/strict';
import '../src/catalog-pack-5.js';
import '../src/catalog-pack-6.js';
import '../src/catalog-pack-7.js';
import '../src/generated-core.js';
import '../src/generated-partner-data.js';
import { COMBAT_GRAPH } from '../src/knowledge/combat-graph.js';
import { optimizeTeam, OPTIMIZER_API_VERSION } from '../src/optimizer/engine.js';

assert.match(OPTIMIZER_API_VERSION,/^3\./);

const encounter={
  id:'integration-boss',
  name:'Integration Boss',
  elements:['Schatten'],
  timeLimit:180,
  phases:[
    {id:'dark',hpShare:.6,elements:['Schatten'],recommendedCounters:['Drache']},
    {id:'ice',hpShare:.4,elements:['Eis'],recommendedCounters:['Feuer']}
  ]
};

const result=optimizeTeam({activity:'tower',encounter,constraints:{ownedOnly:false},optimizationGoal:'practical'});
assert.equal(result.model,'single-active-pal');
assert.ok(['ok','insufficient-data'].includes(result.status));

if(result.status==='ok'){
  assert.ok(result.teams.length>=1);
  const team=result.teams[0];
  assert.equal(team.members.length,5);
  assert.equal(team.members.filter(member=>member.estimatedDpsRange).length,1,'Nur ein aktiver Pal darf eigenen DPS tragen');
  const carry=team.members[0];
  assert.ok(carry.rotationModel?.events?.length>0,'Carry muss die ereignisbasierte Rotation verwenden');
  assert.equal(carry.rotation.length,3,'Carry muss eine Dreierrotation besitzen');
  assert.ok(carry.passiveBuild?.passives?.length===4,'Carry muss einen strukturierten Vierer-Passivbuild besitzen');
  assert.equal(carry.calculatedStats?.status,'ok','Carry muss die native-validierte Statfunktion verwenden');
  assert.ok(carry.calculatedStats.effectiveAttack>0,'Berechneter effektiver Angriff muss positiv sein');
  assert.equal(carry.calculatedStats.inputs.souls.attack,20,'Globales Endgame-Profil muss den aktuellen Soul-Maximalrang 20 verwenden');
  assert.equal(carry.calculatedStats.effectiveHP,null,'EHP darf vor validierter Defense-Mitigation nicht erfunden werden');
  assert.ok(Array.isArray(team.phaseCoverage)&&team.phaseCoverage.length===2,'Bossphasen müssen sichtbar bewertet werden');
  assert.ok(team.assumptions.some(value=>value.includes('Bossphase')),'Die Ergebnisannahmen müssen die Phasenlogik transparent erklären');
  if(team.unquantifiedSupportCount>0){
    assert.ok(team.assumptions.some(value=>value.includes('Nicht quantifizierte')),'Unquantifizierte Partnereffekte müssen transparent bleiben');
  }
  for(const support of team.members.slice(1)){
    assert.equal(support.relativeCombatValue,0);
    assert.equal(support.estimatedDpsRange,null);
    assert.deepEqual(support.rotation,[]);
  }
}

const damage=optimizeTeam({activity:'tower',encounter,constraints:{ownedOnly:false},optimizationGoal:'damage'});
assert.equal(damage.model,'single-active-pal');
assert.ok(['ok','insufficient-data'].includes(damage.status));

assert.ok(COMBAT_GRAPH.pals.length>200);
console.log('Integrierte Combat-Optimizer-Tests bestanden.');
