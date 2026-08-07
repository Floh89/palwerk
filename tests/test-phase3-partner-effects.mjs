import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../src/generated-core.js';
import { PARTNER_REPORT } from '../src/generated-partner-data.js';
import { PAL_CATALOG } from '../src/catalog.js';
import { resolveStacking, supportContribution, OPTIMIZER_API_VERSION } from '../src/optimizer/engine.js';

const tests=[];
const test=(name,fn)=>{try{fn();tests.push({name,ok:true});console.log(`✓ ${name}`);}catch(error){tests.push({name,ok:false,error:error.message});console.error(`✗ ${name}: ${error.message}`);}};
const effects=PAL_CATALOG.flatMap(pal=>(pal.partner?.effects||[]).map(effect=>({pal,effect})));
const required=['activation','requiresEquipment','equipmentId','stackingGroup','stackable','target','element','valuesByRank','appliesTo','conditions','source','gameVersion','verifiedAt','confidence','status'];

test('Optimizer API bleibt auf der konsolidierten 3.x-Schnittstelle',()=>assert.match(OPTIMIZER_API_VERSION,/^3\./));
test('Partnerdaten enthalten strukturierte Effekte',()=>assert.ok(effects.length>0));
test('Wiki-Cargo-Rangdaten werden tatsächlich eingelesen',()=>{
  assert.ok(PARTNER_REPORT.scaleRows>0,'Cargo-Quelle liefert keine verwertbaren Skalierungszeilen');
  assert.ok(PARTNER_REPORT.withRankValues>0,'Kein Partnereffekt besitzt echte Rangwerte');
});
test('Jeder Partnereffekt erfüllt den vollständigen Vertrag',()=>{
  for(const {pal,effect} of effects){
    for(const key of required)assert.ok(Object.hasOwn(effect,key),`${pal.name}: ${effect.type} ohne ${key}`);
    assert.ok(Array.isArray(effect.appliesTo),`${pal.name}: appliesTo`);
    assert.ok(Array.isArray(effect.conditions),`${pal.name}: conditions`);
    assert.equal(typeof effect.requiresEquipment,'boolean',`${pal.name}: requiresEquipment`);
    assert.ok(typeof effect.stackingGroup==='string'&&effect.stackingGroup.length>0,`${pal.name}: stackingGroup`);
    assert.ok(effect.stackable===true||effect.stackable===false||effect.stackable===null,`${pal.name}: stackable`);
  }
});
test('Rangwerte sind entweder offen oder exakt fünfstufig',()=>{
  for(const {pal,effect} of effects)assert.ok(effect.valuesByRank===null||(Array.isArray(effect.valuesByRank)&&effect.valuesByRank.length===5),`${pal.name}: ungültige valuesByRank`);
});
test('Unbekannte Rangwerte werden nicht aus generischen value-Feldern ersetzt',()=>{
  const source=fs.readFileSync(new URL('../src/optimizer/engine.js',import.meta.url),'utf8');
  assert.match(source,/if\(!Array\.isArray\(effect\?\.valuesByRank\)\)return null/);
  assert.ok(!/effect\?\.value\?\?effect\?\.percent/.test(source));
});
test('Unquantifizierter Support erhält keinen erfundenen Nutzwert',()=>{
  const carry={palKnowledge:{elements:['Feuer']}};
  const pal={partner:{name:'Test Support'}};
  const effect={type:'pal_attack',activation:'in_party',element:null,valuesByRank:null,stackingGroup:'pal_attack:general',stackable:true,status:'community-tested',confidence:'medium'};
  const row=supportContribution(effect,pal,carry,0,'practical');
  assert.ok(row);
  assert.equal(row.quantified,false);
  assert.equal(row.utility,0);
});
test('Echte Rangwerte dürfen den Support-Nutzwert beeinflussen',()=>{
  const carry={palKnowledge:{elements:['Feuer']}};
  const pal={partner:{name:'Test Support'}};
  const effect={type:'pal_attack',activation:'in_party',element:null,valuesByRank:[10,12,15,18,20],stackingGroup:'pal_attack:general',stackable:true,status:'community-tested',confidence:'medium'};
  const row=supportContribution(effect,pal,carry,4,'practical');
  assert.equal(row.quantified,true);
  assert.equal(row.numeric,20);
  assert.ok(row.utility>0);
});
test('Nicht stapelbare Effekte derselben Gruppe werden nur einmal angewendet',()=>{
  const rows=[
    {pal:{key:'a'},effect:{type:'x'},group:'party:x',stackable:false,utility:5,numeric:10,evidenceQuality:1},
    {pal:{key:'b'},effect:{type:'x'},group:'party:x',stackable:false,utility:8,numeric:20,evidenceQuality:1}
  ];
  const result=resolveStacking(rows);
  assert.equal(result.applied.length,1);
  assert.equal(result.applied[0].pal.key,'b');
  assert.equal(result.suppressed.length,1);
  assert.equal(result.totalUtility,8);
});
test('Explizit stapelbare Effekte derselben Gruppe werden gemeinsam angewendet',()=>{
  const rows=[
    {pal:{key:'a'},effect:{type:'x'},group:'party:x',stackable:true,utility:5,numeric:10,evidenceQuality:1},
    {pal:{key:'b'},effect:{type:'x'},group:'party:x',stackable:true,utility:8,numeric:20,evidenceQuality:1}
  ];
  const result=resolveStacking(rows);
  assert.equal(result.applied.length,2);
  assert.equal(result.suppressed.length,0);
  assert.equal(result.totalUtility,13);
});
test('Unbekannte Stapelbarkeit wird konservativ nicht gestapelt',()=>{
  const rows=[
    {pal:{key:'a'},effect:{type:'x'},group:'party:x',stackable:false,utility:0,numeric:null,evidenceQuality:.5},
    {pal:{key:'b'},effect:{type:'x'},group:'party:x',stackable:false,utility:0,numeric:null,evidenceQuality:.7}
  ];
  const result=resolveStacking(rows);
  assert.equal(result.applied.length,1);
  assert.equal(result.applied[0].pal.key,'b','Bei unquantifizierten Kollisionen darf nur die besser belegte Wirkung übrig bleiben');
});
test('Engine trennt Aktivierungen je Spielmodus',()=>{
  const source=fs.readFileSync(new URL('../src/optimizer/engine.js',import.meta.url),'utf8');
  assert.match(source,/activation==='in_party'/);
  assert.match(source,/activation==='raid_deployed'/);
  assert.match(source,/activation==='base_assigned'/);
  assert.match(source,/manual-interaction/);
});
test('Generator enthält keine pauschale Sternskalierung',()=>{
  const source=fs.readFileSync(new URL('../scripts/build-partner-data.mjs',import.meta.url),'utf8');
  assert.ok(!/1\s*\+\s*rank\s*\*\s*0\.1/.test(source));
  assert.match(source,/valuesByRank/);
});

const failed=tests.filter(item=>!item.ok);
console.log(`\n${tests.length-failed.length}/${tests.length} Phase-3-Tests bestanden.`);
if(failed.length){console.error(JSON.stringify(failed,null,2));process.exit(1);}
