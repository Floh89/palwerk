import assert from 'node:assert/strict';
import { CANONICAL_PALS, canonicalDataReport, createCanonicalPalRegistry, resolveCanonicalPal } from '../src/data/canonical-pals.js';
import { COMBAT_GRAPH, getPalKnowledge } from '../src/knowledge/combat-graph.js';

const report=canonicalDataReport();
assert.ok(report.total>200,'Der kanonische Katalog muss den vollständigen spielbaren Bestand enthalten');
assert.equal(report.uniqueDexKeys,report.total,'Jede Form braucht einen eindeutigen dexKey');
assert.equal(report.duplicateDexKeys,0,'Doppelte dexKeys sind nicht zulässig');
assert.equal(report.exactDuplicates,0,'Dieselbe technische Form darf nicht doppelt vorhanden sein');

const orserk=resolveCanonicalPal('orserk');
assert.ok(orserk,'Orserk muss über die kanonische ID auflösbar sein');
assert.equal(orserk.canonicalId,'orserk');
assert.equal(resolveCanonicalPal('oserK')?.dexKey,orserk.dexKey,'Historische Schreibfehler müssen auf dieselbe Form zeigen');
assert.equal(getPalKnowledge('orserk')?.dexKey,orserk.dexKey,'Knowledge Graph und Registry müssen dieselbe Identität verwenden');

for(const row of CANONICAL_PALS.rows){
  assert.ok(row.canonicalId&&row.dexKey&&row.variantId&&row.displayName);
  assert.ok(Array.isArray(row.sourceIds)&&row.sourceIds.length>0);
}
for(const pal of COMBAT_GRAPH.pals){
  assert.ok(pal.canonicalId&&pal.dexKey&&pal.variantId);
  assert.equal(pal.id,pal.canonicalId);
}

const variants=createCanonicalPalRegistry([
  {key:'jolthog',internalId:'jolthog',paldeck:'012',name:'Jolthog'},
  {key:'jolthog-cryst',internalId:'jolthog-cryst',paldeck:'012B',name:'Jolthog Cryst'}
]);
assert.equal(variants.rows.length,2);
assert.equal(new Set(variants.rows.map(row=>row.dexKey)).size,2,'Varianten mit gleicher Grundnummer brauchen verschiedene dexKeys');

const duplicate=createCanonicalPalRegistry([
  {key:'same',internalId:'same',paldeck:'001',name:'Same'},
  {key:'same',internalId:'same',paldeck:'001',name:'Same'}
]);
assert.ok(duplicate.exactDuplicates.length>0,'Echte Quellduplikate müssen sichtbar werden');

console.log('Kanonische Pal-Datentests bestanden.');
