import fs from 'node:fs';
import { PARTNER_STACKING_RULES_VERSION, resolvePartnerStackingRule } from '../src/data/partner-stacking-rules.js';

const path='src/generated-partner-data.js';
const source=fs.readFileSync(path,'utf8');
const dataMatch=source.match(/export const PARTNER_DATA=(\[.*?\]);\nexport const PARTNER_REPORT=(\{.*?\});\n/s);
if(!dataMatch)throw new Error('PARTNER_DATA/PARTNER_REPORT konnten nicht aus generated-partner-data.js gelesen werden');

const partnerData=JSON.parse(dataMatch[1]);
const report=JSON.parse(dataMatch[2]);
let changed=0;
for(const row of partnerData){
  for(const effect of row.effects||[]){
    const rule=resolvePartnerStackingRule({palName:row.palName,effect,description:row.description||effect.description||''});
    Object.assign(effect,rule);
    changed++;
  }
}

const effects=partnerData.flatMap(row=>row.effects||[]);
const nextReport={
  ...report,
  stackingRulesVersion:PARTNER_STACKING_RULES_VERSION,
  stackingResolved:effects.length,
  stackableRows:effects.filter(effect=>effect.stackingRule==='stack').length,
  highestOnlyRows:effects.filter(effect=>effect.stackingRule==='highestOnly').length,
  uniquePartnerSkillRows:effects.filter(effect=>effect.stackingRule==='uniquePartnerSkill').length,
  nonStackingRows:effects.filter(effect=>effect.stackingRule==='nonStacking').length,
  unknownStackability:effects.filter(effect=>!['stack','highestOnly','uniquePartnerSkill','nonStacking'].includes(effect.stackingRule)).length
};

let output=source.replace("export const PARTNER_EFFECT_SCHEMA_VERSION='2.3.0';","export const PARTNER_EFFECT_SCHEMA_VERSION='2.4.0';");
output=output.replace(dataMatch[0],`export const PARTNER_DATA=${JSON.stringify(partnerData)};\nexport const PARTNER_REPORT=${JSON.stringify(nextReport)};\n`);
fs.writeFileSync(path,output);
fs.writeFileSync('partner-build-report.json',JSON.stringify(nextReport,null,2));
console.log(JSON.stringify({stackingRulesVersion:PARTNER_STACKING_RULES_VERSION,effectsProcessed:changed,stackableRows:nextReport.stackableRows,highestOnlyRows:nextReport.highestOnlyRows,uniquePartnerSkillRows:nextReport.uniquePartnerSkillRows,nonStackingRows:nextReport.nonStackingRows,unknownStackability:nextReport.unknownStackability},null,2));
