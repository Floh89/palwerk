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

const cases=[
  {name:'Water vs Fire',attack:'Wasser',strong:'Feuer',resisted:'Elektro',neutral:'Gras'},
  {name:'Fire vs Grass',attack:'Feuer',strong:'Gras',resisted:'Wasser',neutral:'Drache'},
  {name:'Ground vs Electric',attack:'Erde',strong:'Elektro',resisted:'Gras',neutral:'Wasser'},
  {name:'Dragon vs Dark',attack:'Drache',strong:'Schatten',resisted:'Eis',neutral:'Feuer'},
  {name:'Ice vs Dragon',attack:'Eis',strong:'Drache',resisted:'Feuer',neutral:'Wasser'},
  {name:'Dark vs Neutral',attack:'Schatten',strong:'Neutral',resisted:'Drache',neutral:'Wasser'}
];

for(const row of cases){
  close(elementEffectiveness(row.attack,[row.strong]),1.5,`${row.name} strong`);
  close(elementEffectiveness(row.attack,[row.resisted]),2/3,`${row.name} resisted`);
  close(elementEffectiveness(row.attack,[row.neutral]),1,`${row.name} neutral`);
  close(stabMultiplier(row.attack,[row.attack]),1.2,`${row.name} STAB`);
  close(stabMultiplier(row.attack,[row.neutral]),1,`${row.name} no STAB`);
  close(offensiveMultiplier({skillElement:row.attack,palElements:[row.attack],defensiveElements:[row.strong]}).total,1.8,`${row.name} strong + STAB`);
  close(offensiveMultiplier({skillElement:row.attack,palElements:[row.neutral],defensiveElements:[row.strong]}).total,1.5,`${row.name} strong without STAB`);
}

// Dual-element interactions use unique defensive elements only.
close(elementEffectiveness('Feuer',['Gras','Eis']),2.25,'Fire vs Grass/Ice dual weakness');
close(elementEffectiveness('Gras',['Erde','Feuer']),1,'One strong and one resisted interaction cancel');
close(elementEffectiveness('Wasser',['Feuer','Feuer']),1.5,'Duplicate defensive element must not be counted twice');

// Aliases must resolve identically.
close(elementEffectiveness('Water',['Fire']),1.5,'English aliases');
close(stabMultiplier('Dark',['Dark']),1.2,'English STAB alias');

// Integration: skill evaluation must use the same central formula, not a separate boss-fit heuristic.
const q=(value,status='verified')=>({value,status});
const waterSkill={id:'phase1-water',name:'Phase 1 Water',element:'Wasser',rawPower:q(100),cooldown:q(5),animation:q(1),projectileTime:q(0),multiHit:q(1),hitRate:q(1),aoe:q(0),range:q(null,'missing'),channeling:q(0)};
const strong=evaluateSkill(waterSkill,{pal:{elements:['Wasser']},encounter:{elements:['Feuer']}});
const resisted=evaluateSkill(waterSkill,{pal:{elements:['Wasser']},encounter:{elements:['Elektro']}});
const neutral=evaluateSkill(waterSkill,{pal:{elements:['Wasser']},encounter:{elements:['Gras']}});
const noStab=evaluateSkill(waterSkill,{pal:{elements:['Feuer']},encounter:{elements:['Feuer']}});
close(strong.elementMultiplier,1.5,'Skill integration strong');
close(resisted.elementMultiplier,2/3,'Skill integration resisted');
close(neutral.elementMultiplier,1,'Skill integration neutral');
close(strong.stab,1.2,'Skill integration STAB');
close(noStab.stab,1,'Skill integration no STAB');

console.log('Phase-1-Elementmechanik-Tests bestanden.');
