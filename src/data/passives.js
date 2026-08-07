import { PASSIVE_SKILL_RECORDS, DE_PASSIVE_SKILL_TEXTS } from '../generated-core.js';

const text=value=>String(value??'').trim();
const slug=value=>text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const num=value=>Number.isFinite(Number(value))?Number(value):null;
const list=value=>Array.isArray(value)?value:[];

export const PASSIVE_SCHEMA_VERSION='1.0.0';
export const PASSIVE_STATUSES=Object.freeze(['verified','modelled','community-tested','provisional','missing']);

const TYPE_MAP=Object.freeze({
  ShotAttack:{stat:'attack',operation:'percent'},
  Defense:{stat:'defense',operation:'percent'},
  MaxHP:{stat:'hp',operation:'percent'},
  WorkSpeed:{stat:'workSpeed',operation:'percent'},
  MoveSpeed:{stat:'moveSpeed',operation:'percent'},
  CraftSpeed:{stat:'workSpeed',operation:'percent'},
  AutoHPRegeneRate:{stat:'hpRegen',operation:'percent'},
  FullStomachDecrease:{stat:'hungerRate',operation:'percent'},
  SanityDecrease:{stat:'sanityDrain',operation:'percent'},
  CoolTime:{stat:'cooldown',operation:'percent'},
  CoolTime_All:{stat:'cooldown',operation:'percent'},
  CoolTime_Skill:{stat:'cooldown',operation:'percent'}
});

const ELEMENT_PREFIX='ElementBoost_';
const RESIST_PREFIX='ElementResist_';

function localized(id){
  const row=DE_PASSIVE_SKILL_TEXTS?.[id]||DE_PASSIVE_SKILL_TEXTS?.[`EPalPassiveSkillID::${id}`]||null;
  return {
    name:text(row?.localized_name||row?.name||id),
    description:text(row?.description)||null,
    languageStatus:row?'de-official':'en-fallback'
  };
}

function activation(record){
  const modes=[];
  if(record?.invoke_always)modes.push('always');
  if(record?.invoke_active_party)modes.push('active_pal');
  if(record?.invoke_in_party)modes.push('in_party');
  if(record?.invoke_reserve)modes.push('reserve');
  if(record?.invoke_worker)modes.push('base_worker');
  if(record?.invoke_in_base)modes.push('in_base');
  if(record?.invoke_riding)modes.push('mounted');
  return modes.length?modes:['unknown'];
}

function normalizeEffect(effect,index,id){
  const rawType=text(effect?.type)||'Unknown';
  let mapped=TYPE_MAP[rawType]||null;
  let element=null;
  if(rawType.startsWith(ELEMENT_PREFIX)){
    mapped={stat:'elementDamage',operation:'percent'};
    element=rawType.slice(ELEMENT_PREFIX.length);
  }else if(rawType.startsWith(RESIST_PREFIX)){
    mapped={stat:'elementResistance',operation:'percent'};
    element=rawType.slice(RESIST_PREFIX.length);
  }
  const value=num(effect?.value);
  return Object.freeze({
    id:`${slug(id)}:${index}`,
    rawType,
    stat:mapped?.stat||null,
    operation:mapped?.operation||null,
    value,
    target:text(effect?.target)||null,
    element,
    source:'oMaN-Rod/palworld-save-pal',
    gameVersion:null,
    verifiedAt:null,
    confidence:mapped&&value!=null?'high':'low',
    status:mapped&&value!=null?'verified':'provisional'
  });
}

function isPalPassive(record){
  return Boolean(record&&!record.disabled&&(record.add_pal===true||record.add_rare_pal===true));
}

function node(id,record){
  const locale=localized(id);
  const effects=list(record?.effects).map((effect,index)=>normalizeEffect(effect,index,id));
  return Object.freeze({
    id:slug(id),
    sourceId:id,
    name:locale.name,
    description:locale.description,
    languageStatus:locale.languageStatus,
    rank:num(record?.rank),
    effects:Object.freeze(effects),
    activation:Object.freeze(activation(record)),
    eligibility:Object.freeze({
      pal:Boolean(record?.add_pal),
      rarePal:Boolean(record?.add_rare_pal),
      armor:Boolean(record?.add_armor),
      accessory:Boolean(record?.add_accessory),
      shotWeapon:Boolean(record?.add_shot_weapon),
      meleeWeapon:Boolean(record?.add_melee_weapon)
    }),
    source:'oMaN-Rod/palworld-save-pal',
    gameVersion:null,
    verifiedAt:null,
    confidence:effects.every(effect=>effect.status==='verified')?'high':'medium',
    status:effects.length&&effects.every(effect=>effect.status==='verified')?'verified':'provisional',
    rawRecord:record
  });
}

export function createPassiveRegistry(records=PASSIVE_SKILL_RECORDS){
  const rows=Object.entries(records||{}).filter(([,record])=>isPalPassive(record)).map(([id,record])=>node(id,record));
  const byId=new Map();
  const bySourceId=new Map();
  const duplicates=[];
  for(const row of rows){
    if(byId.has(row.id))duplicates.push({id:row.id,first:byId.get(row.id),duplicate:row});
    else byId.set(row.id,row);
    bySourceId.set(row.sourceId,row);
    bySourceId.set(`EPalPassiveSkillID::${row.sourceId}`,row);
  }
  return Object.freeze({schemaVersion:PASSIVE_SCHEMA_VERSION,rows:Object.freeze([...byId.values()]),byId,bySourceId,duplicates:Object.freeze(duplicates)});
}

export const PASSIVES=createPassiveRegistry();

export function resolvePassive(id){
  const raw=text(id);
  return PASSIVES.bySourceId.get(raw)||PASSIVES.byId.get(slug(raw.replace(/^EPalPassiveSkillID::/,'')))||null;
}

export function passiveDataReport(registry=PASSIVES){
  const effects=registry.rows.flatMap(row=>row.effects);
  return Object.freeze({
    total:registry.rows.length,
    duplicateIds:registry.duplicates.length,
    verified:registry.rows.filter(row=>row.status==='verified').length,
    provisional:registry.rows.filter(row=>row.status==='provisional').length,
    structuredEffects:effects.filter(effect=>effect.stat&&effect.value!=null).length,
    unresolvedEffects:effects.filter(effect=>!effect.stat||effect.value==null).length,
    officialGermanNames:registry.rows.filter(row=>row.languageStatus==='de-official').length
  });
}
