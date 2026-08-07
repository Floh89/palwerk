import assert from 'node:assert/strict';
import { PAL_COMBAT_READINESS, PAL_COMBAT_READINESS_REPORT, readinessForPal, isOptimizerEligiblePal } from '../src/generated-combat-readiness.js';

assert.equal(PAL_COMBAT_READINESS_REPORT.playablePalsTotal,PAL_COMBAT_READINESS.length,'Report und Readiness-Liste müssen dieselbe Pal-Anzahl haben');
assert.ok(PAL_COMBAT_READINESS.length>0,'Phase-4-Readiness darf nach dem Datenbuild nicht leer sein');
assert.equal(PAL_COMBAT_READINESS_REPORT.missingStats,0,'Kein optimizerfähiger Pal-Datensatz darf fehlende Species-Kampfstats haben');
assert.equal(PAL_COMBAT_READINESS_REPORT.missingEnglishNames,0,'Jeder spielbare Pal braucht einen englischen Namen aus der Lokalisierung');
assert.ok(PAL_COMBAT_READINESS.every(row=>row.skillFruitEligibility?.mode==='all_pals_can_consume_available_skill_fruits'),'Skill-Fruit-Regel muss explizit pro Pal dokumentiert sein');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.exclusiveSkills)),'Exklusive Skills müssen als explizite Liste vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.naturalPassives)),'Natürliche Passives müssen als explizite Liste vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.partnerEffects)),'Partner-Effekte müssen als explizite Liste vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.partnerRankValues)),'Partner-Rangwerte müssen als explizite Liste vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.condensationEffects?.statMultiplierByStars)&&row.condensationEffects.statMultiplierByStars.length===5),'Kondensierungs-Statreihe muss vollständig vorliegen');
assert.ok(PAL_COMBAT_READINESS.every(row=>Array.isArray(row.condensationEffects?.partnerSkillRankByStars)&&row.condensationEffects.partnerSkillRankByStars.join(',')==='1,2,3,4,5'),'Kondensierung muss Partner-Skill-Rang 1 bis 5 abbilden');

for(const row of PAL_COMBAT_READINESS){
  assert.equal(row.optimizerEligible,row.criticalMissing.length===0,`${row.canonicalId}: Eligibility muss direkt vom Daten-Gate abhängen`);
  if(row.optimizerEligible){
    assert.ok(row.hpScaling>0&&row.attackScaling>0&&row.defenseScaling>0,`${row.canonicalId}: Eligible Pal ohne valide Stats`);
    assert.ok(row.activeSkills.length>0,`${row.canonicalId}: Eligible Pal ohne natürliche Skills`);
    assert.ok(row.partnerSkill?.name&&row.partnerSkill?.description,`${row.canonicalId}: Eligible Pal ohne Partnerfähigkeit`);
    assert.ok(row.partnerEffects.length>0,`${row.canonicalId}: Eligible Pal ohne Partner-Effekt`);
    assert.ok(row.partnerRankValues.length>0,`${row.canonicalId}: Eligible Pal ohne Partner-Rangwerte`);
    assert.equal(isOptimizerEligiblePal(row),true,`${row.canonicalId}: Lookup muss Eligibility erhalten`);
  }
  assert.equal(readinessForPal(row)?.canonicalId,row.canonicalId,`${row.canonicalId}: Readiness-Lookup muss kanonisch auflösbar sein`);
}

assert.equal(PAL_COMBAT_READINESS_REPORT.missingSkills,PAL_COMBAT_READINESS.filter(row=>row.missingFields.includes('activeSkills')).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.missingPartnerEffects,PAL_COMBAT_READINESS.filter(row=>row.missingFields.includes('partnerEffects')).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.missingPartnerRankValues,PAL_COMBAT_READINESS.filter(row=>row.missingFields.includes('partnerRankValues')).length);
assert.equal(PAL_COMBAT_READINESS_REPORT.ambiguousPartnerEffects,PAL_COMBAT_READINESS.filter(row=>row.ambiguousPartnerEffects.length>0).length);

console.log('Phase-4-Combat-Readiness-Tests bestanden.');
console.log(JSON.stringify({
  playablePalsTotal:PAL_COMBAT_READINESS_REPORT.playablePalsTotal,
  completeCombatData:PAL_COMBAT_READINESS_REPORT.completeCombatData,
  optimizerEligible:PAL_COMBAT_READINESS_REPORT.optimizerEligible,
  missingSkills:PAL_COMBAT_READINESS_REPORT.missingSkills,
  missingPartnerEffects:PAL_COMBAT_READINESS_REPORT.missingPartnerEffects,
  missingPartnerRankValues:PAL_COMBAT_READINESS_REPORT.missingPartnerRankValues,
  ambiguousPartnerEffects:PAL_COMBAT_READINESS_REPORT.ambiguousPartnerEffects
},null,2));
