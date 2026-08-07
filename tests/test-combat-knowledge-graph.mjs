import assert from 'node:assert/strict';
import { COMBAT_GRAPH, DATA_STATUSES, ELEMENT_COUNTER, createCombatKnowledgeGraph, encounterPhases, getPalKnowledge, graphQualitySummary, normalizeInternalId } from '../src/knowledge/combat-graph.js';

assert.equal(COMBAT_GRAPH.schemaVersion,'1.4.0');
assert.equal(COMBAT_GRAPH.createdFrom,'PAL_CATALOG_PLUS_PARTNER_DATA');
assert.ok(COMBAT_GRAPH.pals.length>200,'Der Graph muss den vollständigen Pal-Katalog abbilden');
assert.equal(COMBAT_GRAPH.registry.duplicateDexKeys.length,0,'Der produktive Graph darf keine doppelten dexKeys enthalten');
assert.equal(normalizeInternalId('EPalWazaID::FireBlast'),'fireblast');
assert.equal(ELEMENT_COUNTER.Wasser,'Elektro');

for(const pal of COMBAT_GRAPH.pals){
  assert.ok(pal.canonicalId&&pal.dexKey&&pal.catalogId&&pal.name,'Jeder Pal braucht kanonische ID, dexKey, Katalog-ID und Anzeigename');
  assert.ok(Array.isArray(pal.sourceIds)&&pal.sourceIds.length>0);
  assert.ok(Array.isArray(pal.roles));
  for(const skill of pal.skills){
    assert.ok(skill.id&&skill.name);
    for(const key of ['rawPower','cooldown','animation','hitRate','multiHit','aoe','range']){
      assert.ok(skill[key]&&'value' in skill[key],`Skillfeld ${key} muss Datenwert und Qualität tragen`);
      assert.ok(DATA_STATUSES.includes(skill[key].status));
    }
  }
  for(const passive of pal.fixedPassives)assert.ok(passive.id&&passive.sourceId&&Array.isArray(passive.effects),'Feste Passives müssen aus der kanonischen Passive-Datenquelle stammen');
  for(const effect of pal.partner.effects){
    for(const key of ['activation','stackingGroup','stackable','target','element','valuesByRank','appliesTo','conditions','source','verifiedAt','confidence','status'])assert.ok(key in effect,`Partnereffekt ohne ${key}`);
    assert.ok(DATA_STATUSES.includes(effect.status));
  }
}

const orserk=getPalKnowledge('orserk');
assert.ok(orserk,'Kanonische ID orserk muss auflösbar sein');
assert.equal(orserk.canonicalId,'orserk');
assert.equal(getPalKnowledge('oserK')?.dexKey,orserk.dexKey,'Historische Schreibweise muss auf dieselbe Form zeigen');
assert.ok(orserk.elements.includes('Elektro'));

const phases=encounterPhases({elements:['Dark'],phases:[{id:'dark',hpShare:.6,elements:['Dark']},{id:'ice',hpShare:.4,elements:['Ice'],healing:true}]});
assert.equal(phases.length,2);
assert.equal(phases[0].elements[0],'Schatten');
assert.equal(phases[1].elements[0],'Eis');
assert.equal(phases.reduce((sum,phase)=>sum+phase.hpShare,0),1);

const missingGraph=createCombatKnowledgeGraph([{
  key:'missing-metric-pal',internalId:'MissingMetricPal',paldeck:'999',name:'Missing Metric Pal',element:'Feuer',work:{},stats:{hp:100,attack:100,defense:100},
  skills:[{id:'SyntheticSkill',name:'Synthetic Skill',level:1,data:{power:100,cool_time:5,element:'Fire'}}],fixedPassives:[],partner:{name:'',effects:[]},verified:true,canonical:true
}]);
const missingNode=missingGraph.pals[0].skills[0];
assert.equal(missingNode.animation.value,null,'Fehlende Animation muss null bleiben');
assert.equal(missingNode.animation.status,'missing');
assert.equal(missingNode.hitRate.value,null,'Fehlende Trefferquote muss null bleiben');
assert.equal(missingNode.hitRate.status,'missing');
assert.equal(missingNode.multiHit.value,null,'Fehlende Mehrfachtreffer müssen null bleiben');
assert.equal(missingNode.aoe.value,null,'Fehlende AoE muss null bleiben');

const summary=graphQualitySummary();
assert.ok(summary.playablePals>0);
assert.ok(summary.skillsWithPower>0);
assert.ok(summary.partnerEffects>0);
assert.ok(summary.inPartyCombatEffects>=10,'Angereicherte kampfrelevante In-Party-Effekte müssen den Combat Graph erreichen');
assert.equal(summary.duplicateDexKeys,0);
assert.equal(summary.exactDuplicates,0);
assert.ok(summary.skillsWithAnimation<=summary.skills,'Fehlende Animationswerte dürfen nicht erfunden werden');
assert.ok(summary.effectsWithRankValues<=summary.partnerEffects,'Rangwerte dürfen nur gezählt werden, wenn sie wirklich vorhanden sind');
assert.ok(summary.structuredFixedPassives<=summary.fixedPassives);

const duplicateGraph=createCombatKnowledgeGraph([orserk.sourceRef,orserk.sourceRef]);
assert.equal(duplicateGraph.pals.length,1,'Doppelte Formen müssen vor Nutzung im Graphen konsolidiert werden');
assert.equal(duplicateGraph.registry.sourceDuplicates.length,1,'Die Quellduplikation muss im Qualitätsbericht sichtbar bleiben');

console.log('Combat-Knowledge-Graph-Tests bestanden.');
