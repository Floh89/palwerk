import assert from 'node:assert/strict';
import '../src/catalog-pack-5.js';
import '../src/catalog-pack-6.js';
import '../src/catalog-pack-7.js';
import '../src/generated-core.js';
import { PASSIVES, createPassiveRegistry, passiveDataReport, resolvePassive } from '../src/data/passives.js';
import { evaluatePassiveBuild, optimizePassiveBuild } from '../src/optimizer/passive-builds.js';

const report=passiveDataReport();
assert.ok(report.total>50,'Die Pal-Passive-Datenquelle muss einen breiten Build-Pool enthalten');
assert.equal(report.duplicateIds,0,'Kanonische Passive-IDs müssen eindeutig sein');
assert.ok(report.structuredEffects>0,'Strukturierte Passive-Effekte müssen vorhanden sein');

for(const passive of PASSIVES.rows){
  assert.ok(passive.id&&passive.sourceId&&passive.name);
  assert.ok(passive.eligibility.pal||passive.eligibility.rarePal,'Ausrüstungs-Passives dürfen nicht in den Pal-Build-Pool gelangen');
  assert.ok(Array.isArray(passive.effects));
  for(const effect of passive.effects){
    assert.ok('stat' in effect&&'value' in effect&&'target' in effect&&'status' in effect);
  }
}

const first=PASSIVES.rows[0];
assert.equal(resolvePassive(first.id)?.sourceId,first.sourceId);
assert.equal(resolvePassive(first.sourceId)?.id,first.id);

const synthetic=createPassiveRegistry({
  A:{rank:1,effects:[{type:'ShotAttack',value:10,target:'ToSelf'}],add_pal:true,disabled:false},
  B:{rank:1,effects:[{type:'Defense',value:20,target:'ToSelf'}],add_pal:true,disabled:false},
  C:{rank:1,effects:[{type:'MaxHP',value:15,target:'ToSelf'}],add_pal:true,disabled:false},
  D:{rank:1,effects:[{type:'ElementBoost_Fire',value:20,target:'ToSelf'}],add_pal:true,disabled:false},
  ArmorOnly:{rank:1,effects:[{type:'Defense',value:99,target:'ToSelf'}],add_armor:true,disabled:false}
});
assert.equal(synthetic.rows.length,4,'Nicht für Pals bestimmte Effekte müssen ausgeschlossen werden');

const candidates=PASSIVES.rows.filter(passive=>passive.effects.some(effect=>effect.stat&&effect.value!=null)).slice(0,8);
assert.ok(candidates.length>=4);
const evaluated=evaluatePassiveBuild(candidates.slice(0,4).map(passive=>passive.id),{goal:'practical'});
assert.equal(evaluated.status,'ok');
assert.equal(evaluated.passives.length,4);
assert.ok(evaluated.explanation.assumptions.some(text=>text.includes('keine Wirkung aus Namen')));
assert.equal(evaluatePassiveBuild([candidates[0].id,candidates[0].id,candidates[1].id,candidates[2].id]).status,'invalid');

const optimized=optimizePassiveBuild({allowedPassiveIds:candidates.map(passive=>passive.id),goal:'practical',limit:2});
assert.equal(optimized.status,'ok');
assert.ok(optimized.builds.length>=1);
assert.equal(optimized.builds[0].passives.length,4);
if(optimized.builds.length>1)assert.ok(optimized.builds[0].whyWinner,'Der Sieger muss gegenüber Build B erklärt werden');

console.log('Passive-Daten- und Build-Tests bestanden.');
