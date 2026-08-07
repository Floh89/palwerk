import { PAL_CATALOG } from '../catalog.js';
import { ACTIVE_SKILL_RECORDS, PASSIVE_SKILL_RECORDS } from '../generated-core.js';

export const KNOWLEDGE_SCHEMA_VERSION='1.0.0';
export const DATA_STATUSES=Object.freeze(['verified','modelled','community-tested','provisional','missing']);
export const ELEMENTS=Object.freeze(['Neutral','Feuer','Wasser','Gras','Elektro','Eis','Erde','Schatten','Drache']);

const ELEMENT_MAP=Object.freeze({Normal:'Neutral',Neutral:'Neutral',Fire:'Feuer',Water:'Wasser',Leaf:'Gras',Grass:'Gras',Electricity:'Elektro',Electric:'Elektro',Ice:'Eis',Ground:'Erde',Earth:'Erde',Dark:'Schatten',Dragon:'Drache'});
export const ELEMENT_COUNTER=Object.freeze({Feuer:'Wasser',Wasser:'Elektro',Gras:'Feuer',Elektro:'Erde',Eis:'Feuer',Erde:'Gras',Schatten:'Drache',Drache:'Eis',Neutral:'Schatten'});
const BLOCKED=/astralym|amaterasuwolf|quest|avatar|enemy|friend|summon|tower|raid_|npc|human/i;

const text=value=>String(value??'').trim();
const number=value=>Number.isFinite(Number(value))?Number(value):null;
const list=value=>Array.isArray(value)?value:[];
const slug=value=>text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function normalizeInternalId(value){
  return slug(text(value).replace(/^EPalWazaID::/,'').replace(/^EPalPassiveSkillID::/,''));
}

export function normalizeElement(value){
  const raw=text(value);
  return ELEMENT_MAP[raw]||raw||'Neutral';
}

export function field(value,{source='PALWERK',gameVersion=null,verifiedAt=null,confidence='low',status='missing'}={}){
  return Object.freeze({value:value??null,source,gameVersion,verifiedAt,confidence,status:DATA_STATUSES.includes(status)?status:'missing'});
}

export function isPlayablePal(pal){
  return Boolean(pal?.key&&pal?.name&&!BLOCKED.test(`${pal.internalId||''} ${pal.name}`)&&!pal.flags?.towerBoss&&!pal.flags?.raidBoss&&pal.rawRecord?.capture_rate_correct!==0);
}

function skillRecord(skill){
  return skill?.data||ACTIVE_SKILL_RECORDS?.[skill?.id]||ACTIVE_SKILL_RECORDS?.[`EPalWazaID::${skill?.id}`]||null;
}

function passiveRecord(id){
  return PASSIVE_SKILL_RECORDS?.[id]||PASSIVE_SKILL_RECORDS?.[`EPalPassiveSkillID::${id}`]||null;
}

function skillNode(skill){
  const record=skillRecord(skill)||{};
  const id=normalizeInternalId(skill?.id||record?.id||skill?.name);
  const rawPower=number(record.power??skill?.power);
  const cooldown=number(record.cool_time??record.cooldown??skill?.cooldown);
  const animation=number(record.animation);
  const hitRate=number(record.hit_rate);
  return Object.freeze({
    id,
    catalogId:text(skill?.id||record?.id),
    name:text(skill?.name||record?.name||skill?.id)||'Unbekannter Skill',
    element:normalizeElement(record.element??skill?.element),
    unlockLevel:number(skill?.level),
    rawPower:field(rawPower,{source:'generated-core',confidence:rawPower==null?'low':'high',status:rawPower==null?'missing':'verified'}),
    cooldown:field(cooldown,{source:'generated-core',confidence:cooldown==null?'low':'high',status:cooldown==null?'missing':'verified'}),
    animation:field(animation,{source:'generated-core',confidence:animation==null?'low':'medium',status:animation==null?'missing':'provisional'}),
    hitRate:field(hitRate,{source:'generated-core',confidence:hitRate==null?'low':'medium',status:hitRate==null?'missing':'provisional'}),
    multiHit:field(number(record.multi_hit),{source:'generated-core',status:record.multi_hit==null?'missing':'provisional'}),
    aoe:field(number(record.aoe),{source:'generated-core',status:record.aoe==null?'missing':'provisional'}),
    range:field(record.range??null,{source:'generated-core',status:record.range==null?'missing':'provisional'})
  });
}

function effectNode(effect,index,palId){
  return Object.freeze({
    id:normalizeInternalId(effect?.id||`${palId}-${effect?.type||'effect'}-${index}`),
    type:text(effect?.type)||'unknown',
    activation:text(effect?.activation)||'unknown',
    requiresEquipment:Boolean(effect?.requiresEquipment),
    equipmentId:effect?.equipmentId||null,
    stackingGroup:text(effect?.stackingGroup)||null,
    stackable:effect?.stackable===true?true:effect?.stackable===false?false:null,
    target:effect?.target||null,
    element:effect?.element?normalizeElement(effect.element):null,
    valuesByRank:Array.isArray(effect?.valuesByRank)?effect.valuesByRank.slice(0,5):null,
    appliesTo:list(effect?.appliesTo),
    conditions:list(effect?.conditions),
    source:effect?.source||null,
    gameVersion:effect?.gameVersion||null,
    verifiedAt:effect?.verifiedAt||null,
    confidence:effect?.confidence||'low',
    status:DATA_STATUSES.includes(effect?.status)?effect.status:'missing'
  });
}

function roleHints(pal,skills,effects){
  const roles=new Set();
  if(skills.some(skill=>(skill.rawPower.value||0)>0))roles.add('active_damage');
  for(const effect of effects){
    if(['pal_element_attack','weakpoint_damage','pal_attack','party_pal_attack'].includes(effect.type))roles.add('pal_damage_support');
    if(['cooldown_reduction','party_follow_attack'].includes(effect.type))roles.add('tempo_support');
    if(['player_attack','player_weapon_damage'].includes(effect.type))roles.add('player_support');
    if(['heal_player','revive_player','life_steal','damage_reduction'].includes(effect.type))roles.add('sustain_support');
    if(['pal_drop_bonus','loot_bonus','farm_drop','manual_duplicate'].includes(effect.type))roles.add('loot_support');
  }
  if(Object.values(pal?.work||{}).some(value=>Number(value)>0))roles.add('base_worker');
  return [...roles];
}

function palNode(pal){
  const id=normalizeInternalId(pal.internalId||pal.key||pal.name);
  const skills=list(pal.skills).map(skillNode).filter(skill=>skill.id);
  const effects=list(pal.partner?.effects).map((effect,index)=>effectNode(effect,index,id));
  const fixedPassives=list(pal.fixedPassives||pal.passives).map(passiveId=>{
    const record=passiveRecord(passiveId)||{};
    return Object.freeze({id:normalizeInternalId(passiveId),catalogId:text(passiveId),name:text(record.name||passiveId),effects:list(record.effects),status:record.effects?.length?'verified':'provisional',source:'generated-core'});
  });
  return Object.freeze({
    id,
    catalogId:text(pal.key||pal.internalId),
    internalId:text(pal.internalId||pal.key),
    name:text(pal.name),
    playable:isPlayablePal(pal),
    elements:text(pal.element).split('/').map(normalizeElement).filter(Boolean),
    stats:Object.freeze({hp:number(pal.stats?.hp),attack:number(pal.stats?.attack),defense:number(pal.stats?.defense)}),
    skills,
    fixedPassives,
    partner:Object.freeze({name:text(pal.partner?.name),effects}),
    roles:roleHints(pal,skills,effects),
    work:Object.freeze({...pal.work}),
    sourceRef:pal
  });
}

function relationNodes(pals){
  const relations=[];
  for(const pal of pals){
    for(const effect of pal.partner.effects){
      if(effect.element)relations.push(Object.freeze({from:pal.id,to:`element:${effect.element}`,type:'supports_element',effectId:effect.id,activation:effect.activation,status:effect.status}));
      if(effect.target)relations.push(Object.freeze({from:pal.id,to:`target:${normalizeInternalId(effect.target)}`,type:'supports_target',effectId:effect.id,activation:effect.activation,status:effect.status}));
      if(['player_attack','player_weapon_damage'].includes(effect.type))relations.push(Object.freeze({from:pal.id,to:'player',type:'supports_player',effectId:effect.id,activation:effect.activation,status:effect.status}));
      if(['heal_player','revive_player','life_steal','damage_reduction'].includes(effect.type))relations.push(Object.freeze({from:pal.id,to:'team',type:'supports_survival',effectId:effect.id,activation:effect.activation,status:effect.status}));
    }
  }
  return Object.freeze(relations);
}

export function createCombatKnowledgeGraph(catalog=PAL_CATALOG){
  const pals=Object.freeze(list(catalog).map(palNode).filter(pal=>pal.id));
  const byId=new Map(pals.map(pal=>[pal.id,pal]));
  const byCatalogId=new Map(pals.flatMap(pal=>[[pal.catalogId,pal],[pal.internalId,pal]].filter(([id])=>id)));
  return Object.freeze({schemaVersion:KNOWLEDGE_SCHEMA_VERSION,pals,relations:relationNodes(pals),byId,byCatalogId,createdFrom:'PAL_CATALOG'});
}

export const COMBAT_GRAPH=createCombatKnowledgeGraph();

export function getPalKnowledge(id){
  return COMBAT_GRAPH.byId.get(normalizeInternalId(id))||COMBAT_GRAPH.byCatalogId.get(id)||null;
}

export function encounterPhases(encounter={}){
  const phases=list(encounter.phases);
  if(!phases.length)return Object.freeze([{id:'phase-1',hpShare:1,elements:list(encounter.elements).map(normalizeElement),resistances:{},recommendedCounters:list(encounter.elements).map(normalizeElement).map(element=>ELEMENT_COUNTER[element]).filter(Boolean),status:'modelled'}]);
  const fallback=1/phases.length;
  return Object.freeze(phases.map((phase,index)=>Object.freeze({id:phase.id||`phase-${index+1}`,hpShare:number(phase.hpShare)??fallback,elements:list(phase.elements||encounter.elements).map(normalizeElement),adds:list(phase.adds),clone:Boolean(phase.clone),healing:phase.healing??null,transition:phase.transition??null,resistances:phase.resistances||{},recommendedCounters:list(phase.recommendedCounters).map(normalizeElement),status:phase.status||'provisional'})));
}

export function graphQualitySummary(graph=COMBAT_GRAPH){
  const skills=graph.pals.flatMap(pal=>pal.skills);
  const effects=graph.pals.flatMap(pal=>pal.partner.effects);
  return Object.freeze({
    playablePals:graph.pals.filter(pal=>pal.playable).length,
    totalPals:graph.pals.length,
    skills:skills.length,
    skillsWithPower:skills.filter(skill=>skill.rawPower.status==='verified').length,
    skillsWithAnimation:skills.filter(skill=>skill.animation.value!=null).length,
    partnerEffects:effects.length,
    verifiedPartnerEffects:effects.filter(effect=>effect.status==='verified').length,
    effectsWithRankValues:effects.filter(effect=>Array.isArray(effect.valuesByRank)).length
  });
}
