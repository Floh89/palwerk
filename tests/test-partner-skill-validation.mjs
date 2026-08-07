import assert from 'node:assert/strict';
import { PARTNER_DATA, PARTNER_REPORT, PARTNER_EFFECT_SCHEMA_VERSION } from '../src/generated-partner-data.js';

assert.equal(PARTNER_EFFECT_SCHEMA_VERSION,'2.3.0');
assert.equal(PARTNER_REPORT.duplicateMechanics,0,'Parser und Cargo dürfen dieselbe Partnermechanik nicht doppelt erzeugen');
assert.ok(PARTNER_DATA.length>100,'Partnerdatenbasis ist unerwartet klein');

const required=['id','palId','name','description','activation','requiresEquipment','equipmentId','type','target','element','valuesByRank','stackingRule','stackingGroup','conditions','source','gameVersion','confidence'];
for(const row of PARTNER_DATA){
  for(const effect of row.effects||[]){
    for(const key of required)assert.ok(Object.hasOwn(effect,key),`${row.palName}: ${effect.type} ohne ${key}`);
    assert.ok(effect.id&&effect.palId&&effect.name,`${row.palName}: Partner-Effekt ohne stabile Identität`);
    assert.ok(['stack','highestOnly','uniquePartnerSkill','nonStacking','conditional'].includes(effect.stackingRule),`${row.palName}: ungültige stackingRule ${effect.stackingRule}`);
  }
  const keys=(row.effects||[]).map(effect=>JSON.stringify([effect.type,effect.element||null,effect.target||null]));
  assert.equal(new Set(keys).size,keys.length,`${row.palName}: doppelte kanonische Partnermechanik`);
}

function rowByName(name){return PARTNER_DATA.find(row=>String(row.palName).toLowerCase()===name.toLowerCase());}
function oneEffect(row,type){const matches=(row?.effects||[]).filter(effect=>effect.type===type);assert.equal(matches.length,1,`${row?.palName||'Pal'}: ${type} muss genau einmal kanonisch vorkommen`);return matches[0];}

for(const name of ['Menasting','Menasting Terra']){
  const row=rowByName(name);
  assert.ok(row,`${name} fehlt in PARTNER_DATA`);
  assert.match(row.skillName,/Steel Scorpion/i);
  const drop=oneEffect(row,'pal_drop_bonus');
  assert.deepEqual(drop.valuesByRank,[40,50,60,70,80],`${name}: Electric-Drop-Rangwerte falsch`);
  assert.equal(drop.element,'Elektro');
  assert.equal(drop.activation,'pal_defeats_target');
  const defense=oneEffect(row,'player_defense');
  assert.deepEqual(defense.valuesByRank,[7,8,10,12,14],`${name}: Player-Defense-Rangwerte falsch`);
  assert.equal(defense.target,'player');
  if(name==='Menasting'){
    assert.ok(String(drop.source).includes(':cargo')&&String(defense.source).includes(':cargo'),'Menasting: strukturierte Cargo-Werte müssen Vorrang haben');
  }else{
    assert.match(String(drop.source),/palworld\.wiki\.gg\/wiki\/Menasting_Terra/,'Menasting Terra: verifizierter Wiki-Override muss als Quelle erhalten bleiben');
    assert.match(String(defense.source),/palworld\.wiki\.gg\/wiki\/Menasting_Terra/,'Menasting Terra: Defense muss aus demselben verifizierten Override stammen');
    assert.equal(drop.status,'verified');
    assert.equal(defense.status,'verified');
  }
}

const sparkit=rowByName('Sparkit');
assert.ok(sparkit,'Sparkit fehlt in PARTNER_DATA');
const sparkitBuff=oneEffect(sparkit,'pal_element_attack');
assert.deepEqual(sparkitBuff.valuesByRank,[15,17,20,24,30],'Sparkit: aktuelle 1.0-Rangwerte müssen erhalten bleiben');
assert.equal(sparkitBuff.element,'Elektro');

console.log('Phase-5-Partner-Skill-Validierung bestanden.');
