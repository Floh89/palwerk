import assert from 'node:assert/strict';
import { calculatePalStats, STAT_CONSTANTS, STAT_MODEL_VERSION, STAT_PROVENANCE } from '../src/optimizer/stats.js';

assert.equal(STAT_MODEL_VERSION,'2.0.0');
assert.equal(STAT_PROVENANCE.status,'community-tested');
assert.equal(STAT_CONSTANTS.talentRate,.003);
assert.equal(STAT_CONSTANTS.condenseRate,.05);
assert.equal(STAT_CONSTANTS.maxSoulRank,20);
assert.equal(STAT_CONSTANTS.attackAdditivePerLevel,1.5);
assert.equal(STAT_CONSTANTS.defenseAdditivePerLevel,.75);
assert.equal(STAT_CONSTANTS.awakeningHpRate,.065);
assert.equal(STAT_CONSTANTS.awakeningAttackDefenseRate,.009);

// Palworld 1.0 golden master: base -> condensation -> Souls.
const anubis={stats:{hp:100,attack:116,defense:100}};
const maxed=calculatePalStats({
  pal:anubis,
  level:60,
  potential:{hp:100,attack:100,defense:100},
  condensation:4,
  souls:{hp:20,attack:20,defense:20}
});
assert.equal(maxed.status,'ok');
assert.equal(maxed.breakdown.hp.base,4700);
assert.equal(maxed.breakdown.hp.condensed,5640);
assert.equal(maxed.hp,9024);
assert.equal(maxed.breakdown.attack.additive,90);
assert.equal(maxed.breakdown.attack.base,904);
assert.equal(maxed.attack,1446);
assert.equal(maxed.breakdown.defense.additive,45);
assert.equal(maxed.breakdown.defense.base,747);
assert.equal(maxed.defense,1195);
assert.equal(maxed.dataQuality,'verified');

// Regression guard: obsolete pre-1.0 fixed +100/+50 ATK/DEF constants must never return.
assert.notEqual(maxed.attack,1492);
assert.notEqual(maxed.defense,1219);

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
assert.equal(buffed.attack,2169);
assert.equal(buffed.defense,1434);
assert.equal(buffed.effectiveAttack,2169);
assert.equal(buffed.effectiveDefense,1434);
assert.equal(buffed.passivePercentages.attack,50);
assert.equal(buffed.passivePercentages.defense,20);

// Awakening is an additive 1.0 stat component, not a blanket 1.10 multiplier on final stats.
const plain=calculatePalStats({pal:anubis,level:60});
const awakened=calculatePalStats({pal:anubis,level:60,awakening:true});
assert.deepEqual({hp:plain.hp,attack:plain.attack,defense:plain.defense},{hp:3800,attack:612,defense:495});
assert.deepEqual({hp:awakened.hp,attack:awakened.attack,defense:awakened.defense},{hp:4190,attack:674,defense:548});
assert.deepEqual({hp:awakened.breakdown.hp.awakening,attack:awakened.breakdown.attack.awakening,defense:awakened.breakdown.defense.awakening},{hp:390,attack:62,defense:53});
assert.equal(awakened.dataQuality,'community-tested');

// Trust is species-specific, additive before Soul/passive multiplication, and condensation-sensitive.
const missingTrust=calculatePalStats({pal:anubis,level:60,trust:5});
assert.equal(missingTrust.status,'insufficient-data');
const friendshipPal={stats:{hp:100,attack:100,defense:100},friendship:{hp:2,shotAttack:3,defense:4}};
const trust5=calculatePalStats({pal:friendshipPal,level:60,trust:5,condensation:4});
assert.equal(trust5.status,'ok');
assert.equal(trust5.breakdown.hp.trust,468);
assert.equal(trust5.breakdown.attack.trust,105);
assert.equal(trust5.breakdown.defense.trust,141);
assert.equal(trust5.hp,5028);
assert.equal(trust5.attack,735);
assert.equal(trust5.defense,726);
assert.equal(trust5.dataQuality,'community-tested');

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
assert.equal(implant.attack,directPassive.attack);
const duplicate=calculatePalStats({pal:anubis,level:60,passives:[implantPassive],implants:[implantPassive]});
assert.equal(duplicate.attack,directPassive.attack);

// Food is a separate final multiplier and must not be folded into permanent Pal stats silently.
const fed=calculatePalStats({pal:anubis,level:60,foodBonuses:{attackPct:20}});
assert.equal(fed.attack,Math.floor(plain.attack*1.2));
assert.equal(fed.breakdown.attack.foodMultiplier,1.2);

// Mutation exists in 1.0, but its exact stat modification remains unresolved: refuse to guess.
const mutated=calculatePalStats({pal:anubis,level:60,mutation:true});
assert.equal(mutated.status,'insufficient-data');
assert.match(mutated.reason,/Mutation/i);

// Do not invent effective HP before the defense mitigation formula is validated.
assert.equal(maxed.effectiveHP,null);
assert.equal(maxed.effectiveHPStatus,'provisional');
assert.equal(calculatePalStats({pal:{stats:{hp:0,attack:100,defense:100}},level:60}).status,'insufficient-data');

console.log('Phase-2-Statformel Golden Master bestanden.');
