import assert from 'node:assert/strict';
import { PARTNER_DATA, PARTNER_REPORT, PARTNER_EFFECT_SCHEMA_VERSION } from '../src/generated-partner-data.js';
import { PARTNER_STACKING_RULES_VERSION, SAME_SPECIES_STACKING_EXCEPTIONS, resolvePartnerStackingRule } from '../src/data/partner-stacking-rules.js';
import { resolveStacking, supportContribution } from '../src/optimizer/engine.js';

assert.equal(PARTNER_EFFECT_SCHEMA_VERSION,'2.4.0','Phase 6 benötigt das Partner-Schema 2.4.0');
assert.equal(PARTNER_STACKING_RULES_VERSION,'1.0.0');
assert.equal(SAME_SPECIES_STACKING_EXCEPTIONS.length,25,'Die aktuelle 1.0-Ausnahmeliste muss 25 Pal-Datensätze enthalten');
assert.equal(PARTNER_REPORT.unknownStackability,0,'Nach Phase 6 darf keine Partner-Effektzeile ohne Stacking-Entscheidung bleiben');
assert.equal(PARTNER_REPORT.stackingResolved,PARTNER_REPORT.effectCount,'Jede Partner-Effektzeile muss eine Stacking-Regel besitzen');

const rowByName=name=>PARTNER_DATA.find(row=>String(row.palName).toLowerCase()===name.toLowerCase());
const effectByType=(row,type)=>row?.effects?.find(effect=>effect.type===type);

const sparkit=rowByName('Sparkit');
assert.ok(sparkit,'Sparkit fehlt');
const sparkitBuff=effectByType(sparkit,'pal_element_attack');
assert.ok(sparkitBuff,'Sparkits Elektro-Buff fehlt');
assert.equal(sparkitBuff.stackingRule,'highestOnly','Sparkit darf seit 1.0 nicht mehr mit derselben Spezies stapeln');
assert.equal(sparkitBuff.stackable,false);
assert.equal(sparkitBuff.stackingScope,'same_species');

const gobfin=rowByName('Gobfin');
assert.ok(gobfin,'Gobfin fehlt');
const gobfinAttack=effectByType(gobfin,'player_attack');
assert.ok(gobfinAttack,'Gobfins Player-Attack-Zeile fehlt');
assert.equal(gobfinAttack.stackingRule,'stack','Gobfins Attack-Zeile ist eine bestätigte 1.0-Stacking-Ausnahme');
assert.equal(gobfinAttack.stackable,true);
assert.match(gobfinAttack.stackingEvidenceId,/palmods-1\.0-effect-row-stacking-audit/);

const defaultRule=resolvePartnerStackingRule({palName:'Synthetic Pal',effect:{type:'pal_attack',scaleEffectType:'Attack'},description:'While in party, increases attack.'});
assert.equal(defaultRule.stackingRule,'highestOnly');
const explicitSimilar=resolvePartnerStackingRule({palName:'Synthetic Pal',effect:{type:'pal_attack',scaleEffectType:'Attack'},description:'Does not stack with similar skills.'});
assert.equal(explicitSimilar.stackingRule,'nonStacking');
assert.equal(explicitSimilar.stackingScope,'similar_effect');

const carry={palKnowledge:{elements:['Elektro']}};
const sparkitPal={partner:{name:sparkit.skillName}};
const lowSparkit=supportContribution(sparkitBuff,sparkitPal,carry,0,'practical');
const highSparkit=supportContribution(sparkitBuff,sparkitPal,carry,4,'practical');
assert.ok(lowSparkit&&highSparkit);
const duplicateSparkit=resolveStacking([lowSparkit,highSparkit]);
assert.equal(duplicateSparkit.applied.length,1,'Zwei Sparkits dürfen denselben Buff nicht doppelt anwenden');
assert.equal(duplicateSparkit.applied[0].numeric,30,'Bei nicht stapelbaren Duplikaten muss der höchste Rang gewinnen');
assert.equal(duplicateSparkit.suppressed.length,1);

const gobfinPal={partner:{name:gobfin.skillName}};
const playerCarry={palKnowledge:{elements:['Neutral']}};
const lowGobfin=supportContribution(gobfinAttack,gobfinPal,playerCarry,0,'practical');
const highGobfin=supportContribution(gobfinAttack,gobfinPal,playerCarry,4,'practical');
assert.ok(lowGobfin&&highGobfin);
const duplicateGobfin=resolveStacking([lowGobfin,highGobfin]);
assert.equal(duplicateGobfin.applied.length,2,'Gobfins explizit stapelbare Attack-Zeile muss mehrfach zählen');
assert.equal(duplicateGobfin.suppressed.length,0);

const shared={type:'player_attack',activation:'in_party',element:null,target:'player',valuesByRank:[10,10,10,10,10],stackingGroup:'player_attack:player',stackable:false,stackingRule:'highestOnly',status:'community-tested',confidence:'high'};
const speciesA=supportContribution(shared,{partner:{name:'Skill A'}},playerCarry,0,'practical');
const speciesB=supportContribution(shared,{partner:{name:'Skill B'}},playerCarry,0,'practical');
const crossSpecies=resolveStacking([speciesA,speciesB]);
assert.equal(crossSpecies.applied.length,2,'Verschiedene Partnerfähigkeiten dürfen trotz gleicher Wirkungsart gemeinsam beitragen');

console.log('Phase-6-Stacking-Tests bestanden.');
