import fs from 'node:fs';

const read=(name,fallback={})=>{try{return JSON.parse(fs.readFileSync(`data/upstream/${name}`,'utf8'))}catch{return fallback}};
await import('../src/generated-partner-data.js');
const { PAL_CATALOG }=await import('../src/catalog.js');
const { createCanonicalPalRegistry }=await import('../src/data/canonical-pals.js');

const enPals=read('pals-en.json',{});
const SCHEMA='palwerk-combat-readiness-1.0.0';
const GAME_VERSION='1.0';
const generatedAt=new Date().toISOString();
const norm=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
const num=value=>String(value??'').toUpperCase().replace(/[^0-9A-Z]/g,'');
const localized=(source,id)=>source?.[id]||source?.[Object.keys(source||{}).find(key=>key.toLowerCase()===String(id).toLowerCase())]||null;
const nonEmpty=value=>value!=null&&(Array.isArray(value)?value.length>0:typeof value==='object'?Object.keys(value).length>0:String(value).trim().length>0);
const verifiedStat=value=>Number.isFinite(Number(value))&&Number(value)>0;

function englishName(pal){const row=localized(enPals,pal.internalId);return row?.localized_name||row?.name||null;}
function activeSkills(pal){return (pal.skills||[]).map(skill=>({id:skill.id,level:Number(skill.level||0),nameDE:skill.name||skill.id,element:skill.data?.element||null,power:Number.isFinite(Number(skill.data?.power))?Number(skill.data.power):null,cooldown:Number.isFinite(Number(skill.data?.cool_time))?Number(skill.data.cool_time):null,source:'game_dump',gameVersion:GAME_VERSION}));}
function exclusiveSkills(pal){return activeSkills(pal).filter(skill=>/^unique_/i.test(String(skill.id)));}
function naturalPassives(pal){return (pal.fixedPassives||[]).map(passive=>({id:passive.id,nameDE:passive.name||passive.id,source:'game_dump',gameVersion:GAME_VERSION}));}
function partnerEffects(pal){return (pal.partner?.effects||[]).filter(effect=>effect?.type&&effect.type!=='pending_partner_text'&&effect.type!=='partner_description_only');}
function usefulRankEffects(effects){return effects.filter(effect=>Array.isArray(effect.valuesByRank)&&effect.valuesByRank.length===5&&effect.valuesByRank.every(value=>value!=null&&Number.isFinite(Number(value))));}
function ambiguousEffects(effects){return effects.filter(effect=>effect.status==='missing'||effect.activation==='unknown'||effect.confidence==='low'||effect.stackable==null);}
function mountRequirements(pal,effects){const mounts=effects.filter(effect=>effect.type==='mount'||effect.activation==='mounted');if(!mounts.length)return{required:false,status:'not_applicable',equipmentIds:[],source:'partner_semantics'};const equipmentIds=[...new Set(mounts.filter(effect=>effect.requiresEquipment).map(effect=>effect.equipmentId).filter(Boolean))];const concrete=equipmentIds.filter(id=>id!=='pal-specific-equipment');return{required:mounts.some(effect=>effect.requiresEquipment),status:mounts.some(effect=>effect.requiresEquipment)&&(concrete.length===0)?'provisional':'verified',equipmentIds,source:'wiki_partner_data'};}
function condensationEffects(pal,effects){return{statMultiplierByStars:[1,1.05,1.10,1.15,1.20],partnerSkillRankByStars:[1,2,3,4,5],partnerRankValues:usefulRankEffects(effects).map(effect=>({type:effect.type,element:effect.element||null,target:effect.target||null,valuesByRank:effect.valuesByRank,source:effect.source||pal.partner?.source||null,status:effect.status||'provisional',confidence:effect.confidence||'low'})),source:'palworld_wiki_condensation',gameVersion:GAME_VERSION,status:'verified_global_rule'};}
function skillFruitEligibility(){return{mode:'all_pals_can_consume_available_skill_fruits',status:'verified_general_rule',source:'palworld_wiki_skill_fruits',note:'Fruit availability is a property of the skill; Pal species does not restrict consumption.'};}
function fieldStatus(ok,source,status='verified'){return{ok:Boolean(ok),source:source||null,status:ok?status:'missing'};}

const registry=createCanonicalPalRegistry(PAL_CATALOG);
const rows=registry.rows.map(row=>{
  const pal=row.source;
  const skills=activeSkills(pal),exclusive=exclusiveSkills(pal),passives=naturalPassives(pal),effects=partnerEffects(pal),rankEffects=usefulRankEffects(effects),ambiguous=ambiguousEffects(effects),mount=mountRequirements(pal,effects),condensation=condensationEffects(pal,effects),nameEN=englishName(pal),elements=String(pal.element||'').split('/').filter(Boolean);
  const partnerSkill={id:norm(pal.partner?.name||row.canonicalId),name:pal.partner?.name||null,description:pal.partner?.description||null,source:pal.partner?.source||null,gameVersion:pal.partner?.gameVersion||null};
  const required={
    canonicalId:fieldStatus(nonEmpty(row.canonicalId),'canonical_registry'),
    paldeck:fieldStatus(nonEmpty(pal.paldeck),'game_dump'),
    nameDE:fieldStatus(nonEmpty(pal.name),pal.fieldSources?.germanName||'official_localization'),
    nameEN:fieldStatus(nonEmpty(nameEN),'official_localization_en'),
    elements:fieldStatus(elements.length>0,'game_dump'),
    hpScaling:fieldStatus(verifiedStat(pal.stats?.hp),'game_dump'),
    attackScaling:fieldStatus(verifiedStat(pal.stats?.attack),'game_dump'),
    defenseScaling:fieldStatus(verifiedStat(pal.stats?.defense),'game_dump'),
    naturalPassives:fieldStatus(Array.isArray(pal.rawRecord?.passive_skills),'game_dump'),
    activeSkills:fieldStatus(skills.length>0,'game_dump'),
    exclusiveSkills:fieldStatus(Array.isArray(pal.rawRecord?.skill_set),'game_dump'),
    skillFruitEligibility:fieldStatus(true,'palworld_wiki_skill_fruits'),
    partnerSkill:fieldStatus(nonEmpty(partnerSkill.name)&&nonEmpty(partnerSkill.description),partnerSkill.source),
    partnerEffects:fieldStatus(effects.length>0,pal.partner?.source),
    partnerRankValues:fieldStatus(rankEffects.length>0,pal.partner?.source),
    condensationEffects:fieldStatus(true,'palworld_wiki_condensation'),
    mountRequirements:fieldStatus(mount.status!=='provisional',mount.source,mount.status)
  };
  const missingFields=Object.entries(required).filter(([,state])=>!state.ok).map(([field])=>field);
  const criticalMissing=missingFields.filter(field=>['canonicalId','paldeck','nameDE','nameEN','elements','hpScaling','attackScaling','defenseScaling','activeSkills','partnerSkill','partnerEffects','partnerRankValues'].includes(field));
  const dataConfidence=criticalMissing.length?'low':ambiguous.length||mount.status==='provisional'?'medium':'high';
  return{
    canonicalId:row.canonicalId,paldeck:pal.paldeck||null,nameDE:pal.name||null,nameEN,elements,
    hpScaling:Number(pal.stats?.hp||0),attackScaling:Number(pal.stats?.attack||0),defenseScaling:Number(pal.stats?.defense||0),
    naturalPassives:passives,activeSkills:skills,exclusiveSkills:exclusive,skillFruitEligibility:skillFruitEligibility(),partnerSkill,partnerEffects:effects,partnerRankValues:rankEffects.flatMap(effect=>effect.valuesByRank||[]).length?rankEffects.map(effect=>({type:effect.type,element:effect.element||null,target:effect.target||null,valuesByRank:effect.valuesByRank})):[],condensationEffects:condensation,mountRequirements:mount,
    required,missingFields,criticalMissing,ambiguousPartnerEffects:ambiguous.map(effect=>({type:effect.type,activation:effect.activation,status:effect.status,confidence:effect.confidence,stackable:effect.stackable})),optimizerEligible:criticalMissing.length===0,dataConfidence,sourceIds:row.sourceIds,gameVersion:GAME_VERSION
  };
});

const listMissing=field=>rows.filter(row=>row.missingFields.includes(field)).map(row=>row.canonicalId);
const report={
  schemaVersion:SCHEMA,generatedAt,gameVersion:GAME_VERSION,
  playablePalsTotal:rows.length,
  completeCombatData:rows.filter(row=>row.missingFields.length===0).length,
  optimizerEligible:rows.filter(row=>row.optimizerEligible).length,
  highConfidence:rows.filter(row=>row.dataConfidence==='high').length,
  mediumConfidence:rows.filter(row=>row.dataConfidence==='medium').length,
  lowConfidence:rows.filter(row=>row.dataConfidence==='low').length,
  missingStats:rows.filter(row=>row.missingFields.some(field=>['hpScaling','attackScaling','defenseScaling'].includes(field))).length,
  missingSkills:listMissing('activeSkills').length,
  missingPartnerEffects:listMissing('partnerEffects').length,
  missingPartnerRankValues:listMissing('partnerRankValues').length,
  ambiguousPartnerEffects:rows.filter(row=>row.ambiguousPartnerEffects.length>0).length,
  missingMountRequirements:listMissing('mountRequirements').length,
  missingEnglishNames:listMissing('nameEN').length,
  details:{
    missingStats:rows.filter(row=>row.missingFields.some(field=>['hpScaling','attackScaling','defenseScaling'].includes(field))).map(row=>row.canonicalId),
    missingSkills:listMissing('activeSkills'),missingPartnerEffects:listMissing('partnerEffects'),missingPartnerRankValues:listMissing('partnerRankValues'),ambiguousPartnerEffects:rows.filter(row=>row.ambiguousPartnerEffects.length>0).map(row=>row.canonicalId),missingMountRequirements:listMissing('mountRequirements'),missingEnglishNames:listMissing('nameEN'),optimizerExcluded:rows.filter(row=>!row.optimizerEligible).map(row=>({canonicalId:row.canonicalId,criticalMissing:row.criticalMissing}))
  }
};

const runtime=`export const PAL_COMBAT_READINESS_SCHEMA=${JSON.stringify(SCHEMA)};\nexport const PAL_COMBAT_READINESS=${JSON.stringify(rows)};\nexport const PAL_COMBAT_READINESS_REPORT=${JSON.stringify(report)};\nconst norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');\nconst byCanonical=new Map(PAL_COMBAT_READINESS.map(row=>[norm(row.canonicalId),row]));\nconst bySource=new Map();for(const row of PAL_COMBAT_READINESS)for(const id of row.sourceIds||[])bySource.set(norm(id),row);\nexport function readinessForPal(pal){if(!pal)return null;for(const key of [pal.canonicalId,pal.id,pal.internalId,pal.key,pal.name]){const n=norm(key);if(!n)continue;const hit=byCanonical.get(n)||bySource.get(n);if(hit)return hit;}return null;}\nexport function isOptimizerEligiblePal(pal){return readinessForPal(pal)?.optimizerEligible===true;}\n`;
fs.writeFileSync('src/generated-combat-readiness.js',runtime);
fs.writeFileSync('combat-data-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,details:undefined},null,2));
if(report.missingStats>0)process.exitCode=1;
