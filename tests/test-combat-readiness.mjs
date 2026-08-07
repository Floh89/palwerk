import assert from 'node:assert/strict';
import { PAL_COMBAT_READINESS, PAL_COMBAT_READINESS_REPORT, readinessForPal, isCarryEligiblePal, isSupportEligiblePal, isUtilityEligiblePal, isOptimizerEligiblePal } from '../src/generated-combat-readiness.js';

assert.equal(PAL_COMBAT_READINESS_REPORT.playablePalsTotal,PAL_COMBAT_READINESS.length,'Report und Readiness-Liste müssen dieselbe Pal-Anzahl haben');
assert.ok(PAL_COMBAT_READINESS.length>0,'Phase-4-Readiness darf nach dem Datenbuild nicht leer sein');
assert.equal(PAL_COMBAT_READINESS_REPORT.missingStats,0,'Kein Phase-4-Core-Datensatz darf fehlende Species-Kampfstats haben');
assert.equal(PAL_COMBAT_READINESS_REPORT.missingEnglishNames,0,'Jeder spielbare Pal braucht einen englischen Namen aus der Lokalisierung');
assert.ok(PAL_COMBAT_READINESS.every(row=>row.skillFruitEligibility?.mode==='all_pals_can_consume_available_skill_fruits'),'Skill-Fruit-Regel muss explizit pro Pal dokumentiert sein');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.exclusiveSkills)),'Exklusive Skills müssen als explizite Liste vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.naturalPassives)),'Natürliche Passives müssen als explizite Liste vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.partnerEffects)),'Partner-Effekte müssen als explizite Liste vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.partnerRankValues)),'Partner-Rangwerte müssen als explizite Liste vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.condensationEffects?.statMultiplierByStars)&&row.condensationEffects.statMultiplierByStars.length===5),'Kondensierungs-Statreihe muss vollständig vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.condensationEffects?.partnerSkillRankByStars)&&row.condensationEffects.partnerSkillRankByStars.join(',')==='1,2,3,4,5'),'Kondensierung muss Partner-Skill-Rang 1 bis 5 abbilden');

for(const row of PAL_COMBAT_READINESS){
  assert.equal(row.carryEligible,row.coreMissing.length===0,`${row.canonicalId}: Carry-Readiness muss direkt vom Kampf-Core-Gate abhängen`);
  assert.equal(row.optimizerEligible,row.carryEligible||row.supportEligible||row.utilityEligible,`${row.canonicalId}: Gesamt-Eligibility muss aus den Rollen abgeleitet werden`);
  if(row.carryEligible){
    assert.ok(row.hpScaling>0&&row.attackScaling>0&&row.defenseScaling>0,`${row.canonicalId}: Carry-eligible Pal ohne valide Stats`);
    assert.ok(row.activeSkills.length>0,`${row.canonicalId}: Carry-eligible Pal ohne natürliche Skills`);
    assert.equal(isCarryEligiblePal(row),true,`${row.canonicalId}: Carry-Lookup muss Eligibility erhalten`);
  }
  if(row.supportEligible){
    assert.ok(row.partnerEffects.some(effect=>effect.activation==='in_party'),`${row.canonicalId}: Support-eligible ohne In-Party-Effekt`);
    assert.equal(isSupportEligiblePal(row),true,`${row.canonicalId}: Support-Lookup muss Eligibility erhalten`);
  }
  if(row.utilityEligible)assert.equal(isUtilityEligiblePal(row),true,`${row.canonicalId}: Utility-Lookup muss Eligibility erhalten`);
  if(row.optimizerEligible)assert.equal(isOptimizerEligiblePal(row),true,`${row.canonicalId}: Gesamt-Lookup muss Eligibility erhalten`);
  if(row.completeCombatData){
    assert.ok(row.partnerSkill?.name&&row.partnerSkill?.description,`${row.canonicalId}: Vollständiger Datensatz ohne Partnerfähigkeit`);
    assert.ok(row.partnerEffects.length>0,`${row.canonicalId}: Vollständiger Datensatz ohne Partner-Effekt`);
    assert.ok(row.partnerRankValues.length>0,`${row.canonicalId}: Vollständiger Datensatz ohne Partner-Rangwerte`);
    assert.equal(row.partnerMissing.length,0,`${row.canonicalId}: Vollständiger Datensatz darf keine Partner-Lücke besitzen`);
  }
  assert.equal(readinessForPal(row)?.canonicalId,row.canonicalId,`${row.canonicalId}: Readiness-Lookup muss kanonisch auflösbar sein`);
}

assert.equal(PAL_COMBAT_READINESS_REPORT.completeCombatData,PAL_COMBAT_READINESS.filter(row=>row.completeCombatData).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.carryEligible,PAL_COMBAT_READINESS.filter(row=>row.carryEligible).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.supportEligible,PAL_COMBAT_READINESS.filter(row=>row.supportEligible).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.utilityEligible,PAL_COMBAT_READINESS.filter(row=>row.utilityEligible).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.missingSkills,PAL_COMBAT_READINESS.filter(row=>row.missingFields.includes('activeSkills')).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.missingPartnerEffects,PAL_COMBAT_READINESS.filter(row=>row.missingFields.includes('partnerEffects')).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.missingPartnerRankValues,PAL_COMBAT_READINESS.filter(row=>row.missingFields.includes('partnerRankValues')).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.ambiguousPartnerEffects,PAL_COMBAT_READINESS.filter(row=>row.ambiguousPartnerEffects.length>0).length);

console.log('Phase-4-Combat-Readiness-Tests bestanden.');
console.log(JSON.stringify({playablePalsTotal:PAL_COMBAT_READINESS_REPORT.playablePalsTotal,completeCombatData:PAL_COMBAT_READINESS_REPORT.completeCombatData,optimizerEligible:PAL_COMBAT_READINESS_REPORT.optimizerEligible,carryEligible:PAL_COMBAT_READINESS_REPORT.carryEligible,supportEligible:PAL_COMBAT_READINESS_REPORT.supportEligible,utilityEligible:PAL_COMBAT_READINESS_REPORT.utilityEligible,missingSkills:PAL_COMBAT_READINESS_REPORT.missingSkills,missingPartnerEffects:PAL_COMBAT_READINESS_REPORT.missingPartnerEffects,missingPartnerRankValues:PAL_COMBAT_READINESS_REPORT.missingPartnerRankValues,ambiguousPartnerEffects:PAL_COMBAT_READINESS_REPORT.ambiguousPartnerEffects},null,2));
