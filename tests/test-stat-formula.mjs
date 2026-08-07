import assert from 'node:assert/strict';
import { calculatePalStats, STAT_CONSTANTS, STAT_MODEL_VERSION } from '../src/optimizer/stats.js';

assert.equal(STAT_MODEL_VERSION,'1.0.0');
assert.equal(STAT_CONSTANTS.talentRate,.003);
assert.equal(STAT_CONSTANTS.condenseRate,.05);
assert.equal(STAT_CONSTANTS.maxSoulRank,20);
assert.equal(STAT_CONSTANTS.awakeningMultiplier,1.1);

// Native-validated worked example from the 2026-07-19/23 1.0 formula audit.
const anubis={stats:{hp:100,attack:116,defense:100}};
const maxed=calculatePalStats({
  pal:anubis,
  level:60,
  potential:{hp:100,attack:100,defense:100},
  condensation:4,
  souls:{hp:20,attack:20,defense:20}
});
assert.equal(maxed.status,'ok');
assert.equal(maxed.permanentStages.hp0,4700);
assert.equal(maxed.permanentStages.hp1,5640);
assert.equal(maxed.hp,9024);
assert.equal(maxed.permanentStages.attack0,778);
assert.equal(maxed.permanentStages.attack1,933);
assert.equal(maxed.attack,1492);
assert.equal(maxed.permanentStages.defense0,635);
assert.equal(maxed.permanentStages.defense1,762);
assert.equal(maxed.defense,1219);

// Static self-passives are additive percentage points and apply after permanent enhancements.
const legend={id:'legend-test',effects:[{stat:'attack',value:20},{stat:'defense',value:20}]};
const musclehead={id:'musclehead-test',effects:[{stat:'attack',value:30}]};
const buffed=calculatePalStats({
  pal:anubis,
  level:60,
  potential:{hp:100,attack:100,defense:100},
  condensation:4,
  souls:{hp:20,attack:20,defense:20},
  passives:[legend,musclehead]
});
assert.equal(buffed.effectiveAttack,2238);
assert.equal(buffed.effectiveDefense,1462);
assert.equal(buffed.passivePercentages.attack,50);
assert.equal(buffed.passivePercentages.defense,20);

// Awakening multiplies only the original species base before friendship / IV / level.
const plain=calculatePalStats({pal:anubis,level:60});
const awakened=calculatePalStats({pal:anubis,level:60,awakening:true});
assert.ok(awakened.hp>plain.hp);
assert.ok(awakened.attack>plain.attack);
assert.ok(awakened.defense>plain.defense);

// Trust is species-specific and must not be guessed when growth data are missing.
const missingTrust=calculatePalStats({pal:anubis,level:60,trust:5});
assert.equal(missingTrust.status,'insufficient-data');
const friendshipPal={stats:{hp:100,attack:100,defense:100},friendship:{hp:2,shotAttack:3,defense:4}};
const trust0=calculatePalStats({pal:friendshipPal,level:60,trust:0});
const trust5=calculatePalStats({pal:friendshipPal,level:60,trust:5});
assert.equal(trust5.status,'ok');
assert.ok(trust5.hp>trust0.hp);
assert.ok(trust5.attack>trust0.attack);
assert.ok(trust5.defense>trust0.defense);

// Caps are current 1.0 bounds: IV 100, 4 stars, soul rank 20, trust rank 10.
const capped=calculatePalStats({
  pal:friendshipPal,
  level:999,
  potential:{hp:999,attack:999,defense:999},
  condensation:99,
  souls:{hp:99,attack:99,defense:99},
  trust:99
});
assert.equal(capped.inputs.level,100);
assert.deepEqual(capped.inputs.potential,{hp:100,attack:100,defense:100});
assert.equal(capped.inputs.stars,4);
assert.deepEqual(capped.inputs.souls,{hp:20,attack:20,defense:20});
assert.equal(capped.inputs.trust,10);

// Implants are represented by their resulting passive, not as a second generic stat multiplier.
const implantPassive={id:'implant-passive',effects:[{stat:'attack',value:10}]};
const implant=calculatePalStats({pal:anubis,level:60,implants:[implantPassive]});
const directPassive=calculatePalStats({pal:anubis,level:60,passives:[implantPassive]});
assert.equal(implant.effectiveAttack,directPassive.effectiveAttack);

// Do not invent effective HP before the defense mitigation formula is validated.
assert.equal(maxed.effectiveHP,null);
assert.equal(maxed.effectiveHPStatus,'provisional');

assert.equal(calculatePalStats({pal:{stats:{hp:0,attack:100,defense:100}},level:60}).status,'insufficient-data');
console.log('Phase-2-Statformel Golden Master bestanden.');
