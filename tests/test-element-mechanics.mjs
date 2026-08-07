import assert from 'node:assert/strict';
import { ELEMENT_MULTIPLIERS, ELEMENT_PROVENANCE, elementEffectiveness, offensiveMultiplier, singleTypeEffectiveness, stabMultiplier } from '../src/optimizer/elements.js';
import { evaluateSkill } from '../src/optimizer/skill-rotations.js';

const close=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,`${message}: ${actual} !== ${expected}`);

assert.equal(ELEMENT_PROVENANCE.matchupMultipliers.status,'verified');
assert.equal(ELEMENT_PROVENANCE.matchupMultipliers.gameBuild,'24088745');
close(ELEMENT_MULTIPLIERS.strong,1.5,'Strong multiplier');
close(ELEMENT_MULTIPLIERS.resisted,2/3,'Resisted multiplier');
close(ELEMENT_MULTIPLIERS.neutral,1,'Neutral multiplier');
close(ELEMENT_MULTIPLIERS.stab,1.2,'STAB multiplier');

// Required current type-chart golden masters.
close(elementEffectiveness('Wasser',['Feuer']),1.5,'Water vs Fire');
close(elementEffectiveness('Feuer',['Gras']),1.5,'Fire vs Grass');
close(elementEffectiveness('Erde',['Elektro']),1.5,'Ground vs Electric');
close(elementEffectiveness('Drache',['Schatten']),1.5,'Dragon vs Dark');
close(elementEffectiveness('Eis',['Drache']),1.5,'Ice vs Dragon');
close(elementEffectiveness('Schatten',['Neutral']),1.5,'Dark vs Neutral');

// Resisted and neutral interactions.
close(singleTypeEffectiveness('Feuer','Wasser'),2/3,'Fire is resisted by Water');
close(singleTypeEffectiveness('Wasser','Elektro'),2/3,'Water is resisted by Electric');
close(singleTypeEffectiveness('Wasser','Gras'),1,'Water vs Grass is neutral in current chart');
close(singleTypeEffectiveness('Neutral','Feuer'),1,'Neutral vs Fire is neutral');

// Dual-element interactions multiply per defensive type.
close(elementEffectiveness('Wasser',['Feuer','Feuer']),2.25,'Two weaknesses multiply to 2.25');
close(elementEffectiveness('Gras',['Erde','Feuer']),1,'One strong and one resisted interaction cancel');

// STAB is independent from elemental effectiveness.
close(stabMultiplier('Feuer',['Feuer']),1.2,'Fire STAB');
close(stabMultiplier('Feuer',['Wasser']),1,'No Fire STAB on Water pal');
const strongWithStab=offensiveMultiplier({skillElement:'Wasser',palElements:['Wasser'],defensiveElements:['Feuer']});
close(strongWithStab.element,1.5,'Strong component');
close(strongWithStab.stab,1.2,'STAB component');
close(strongWithStab.total,1.8,'Strong + STAB total');

// Integration: skill evaluation must use the same central formula, not a separate boss-fit heuristic.
const q=(value,status='verified')=>({value,status});
const waterSkill={id:'phase1-water',name:'Phase 1 Water',element:'Wasser',rawPower:q(100),cooldown:q(5),animation:q(1),projectileTime:q(0),multiHit:q(1),hitRate:q(1),aoe:q(0),range:q(null,'missing'),channeling:q(0)};
const strong=evaluateSkill(waterSkill,{pal:{elements:['Wasser']},encounter:{elements:['Feuer']}});
const resisted=evaluateSkill(waterSkill,{pal:{elements:['Wasser']},encounter:{elements:['Elektro']}});
const neutral=evaluateSkill(waterSkill,{pal:{elements:['Wasser']},encounter:{elements:['Gras']}});
close(strong.elementMultiplier,1.5,'Skill integration strong');
close(resisted.elementMultiplier,2/3,'Skill integration resisted');
close(neutral.elementMultiplier,1,'Skill integration neutral');
close(strong.stab,1.2,'Skill integration STAB');

console.log('Phase-1-Elementmechanik-Tests bestanden.');
