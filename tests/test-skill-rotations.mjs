import assert from 'node:assert/strict';
import '../src/catalog-pack-5.js';
import '../src/catalog-pack-6.js';
import '../src/catalog-pack-7.js';
import '../src/generated-core.js';
import { SKILLS, createSkillRegistry, resolveSkill, skillDataReport } from '../src/data/skills.js';
import { evaluateSkill, simulateRotation, optimizeSkillRotation } from '../src/optimizer/skill-rotations.js';

const report=skillDataReport();
assert.ok(report.total>200,'Die Skill-Registry muss den breiten aktiven Skillbestand enthalten');
assert.equal(report.duplicateIds,0,'Kanonische Skill-IDs müssen eindeutig sein');
assert.ok(report.withPower>0&&report.withCooldown>0,'Power und Cooldown müssen strukturiert verfügbar sein');

for(const skill of SKILLS.rows){
  assert.ok(skill.id&&skill.sourceId&&skill.name);
  for(const key of ['rawPower','cooldown','animation','projectileTime','multiHit','hitRate','aoe','range','channeling']){
    assert.ok(skill[key]&&'value' in skill[key]&&'status' in skill[key],`Skillfeld ${key} braucht Wert und Qualität`);
  }
}
const first=SKILLS.rows.find(skill=>skill.rawPower.value>0&&skill.cooldown.value!=null);
assert.ok(first);
assert.equal(resolveSkill(first.id)?.sourceId,first.sourceId);
assert.equal(resolveSkill(first.sourceId)?.id,first.id);

const q=(value,status='verified')=>({value,status});
const fire={id:'fire',name:'Fire',element:'Feuer',rawPower:q(100),cooldown:q(5),animation:q(1),projectileTime:q(0),multiHit:q(1),hitRate:q(1),aoe:q(0),range:q(null,'missing'),channeling:q(0)};
const water={id:'water',name:'Water',element:'Wasser',rawPower:q(100),cooldown:q(5),animation:q(1),projectileTime:q(0),multiHit:q(1),hitRate:q(1),aoe:q(0),range:q(null,'missing'),channeling:q(0)};
const fast={id:'fast',name:'Fast',element:'Feuer',rawPower:q(55),cooldown:q(1),animation:q(.4),projectileTime:q(0),multiHit:q(1),hitRate:q(1),aoe:q(0),range:q(null,'missing'),channeling:q(0)};
const multi={id:'multi',name:'Multi',element:'Feuer',rawPower:q(30),cooldown:q(3),animation:q(.8),projectileTime:q(0),multiHit:q(4),hitRate:q(1),aoe:q(0),range:q(null,'missing'),channeling:q(0)};
const pal={elements:['Feuer']};
const grassBoss={elements:['Gras']};
const fireBoss={elements:['Feuer']};

const stab=evaluateSkill(fire,{pal,encounter:grassBoss});
const noStab=evaluateSkill(fire,{pal:{elements:['Wasser']},encounter:grassBoss});
assert.equal(stab.stab,1.2,'Gleiches Element muss STAB erhalten');
assert.ok(stab.modelDps>noStab.modelDps,'STAB muss den Modellwert erhöhen');
assert.ok(evaluateSkill(water,{pal:{elements:['Wasser']},encounter:fireBoss}).bossFit>1,'Wasser muss gegen Feuer als Counter gewertet werden');
assert.equal(evaluateSkill(multi,{pal,encounter:grassBoss}).hits,4,'Mehrfachtreffer müssen strukturiert eingehen');

const assumed={...fire,id:'assumed',name:'Assumed',animation:q(null,'missing'),projectileTime:q(null,'missing'),hitRate:q(null,'missing'),multiHit:q(null,'missing')};
const assumedResult=evaluateSkill(assumed,{pal,encounter:grassBoss});
assert.equal(assumedResult.dataQuality,'modelled');
assert.ok(assumedResult.assumptions.length>=3,'Fehlende praktische Werte müssen als Annahmen erscheinen');

const simulation=simulateRotation([fire,fast,multi],{pal,encounter:grassBoss,duration:30});
assert.equal(simulation.status,'ok');
assert.ok(simulation.events.length>3,'Die Rotation muss ereignisbasiert mehrere Einsätze erzeugen');
assert.ok(simulation.modelDpsRange.low<simulation.modelDpsRange.high);

const optimized=optimizeSkillRotation({pal,encounter:grassBoss,availableSkillIds:[fire,water,fast,multi],duration:30});
assert.equal(optimized.status,'ok');
assert.equal(optimized.winner.skillIds.length,3);
assert.ok(optimized.whyWinner&&optimized.assumptions.some(value=>value.includes('keine sekundengenaue')));
assert.equal(optimizeSkillRotation({pal,encounter:grassBoss,availableSkillIds:[fire,fast]}).status,'insufficient-data');

const synthetic=createSkillRegistry({
  Test:{power:100,cool_time:5,element:'Fire'},
  'EPalWazaID::Test':{power:200,cool_time:5,element:'Fire'}
});
assert.equal(synthetic.duplicates.length,1,'Identische normalisierte Skill-IDs müssen als Duplikat sichtbar sein');

console.log('Skill-Daten- und Rotationstests bestanden.');
