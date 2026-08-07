export const SOURCE_PRIORITY_VERSION='1.1.0';

export const FIELD_SOURCE_PRIORITY=Object.freeze({
  stats:Object.freeze(['game_dump','wiki','legacy']),
  elements:Object.freeze(['game_dump','wiki','legacy']),
  activeSkills:Object.freeze(['game_dump','wiki','legacy']),
  fixedPassives:Object.freeze(['game_dump','wiki','legacy']),
  work:Object.freeze(['game_dump','wiki','legacy']),
  movement:Object.freeze(['game_dump','wiki','legacy']),
  paldeck:Object.freeze(['game_dump','wiki','legacy']),
  germanName:Object.freeze(['official_localization','wiki','fallback','legacy']),
  description:Object.freeze(['official_localization','wiki','game_semantics','legacy','fallback']),
  partnerDescription:Object.freeze(['wiki','game_semantics','legacy','fallback']),
  partnerEffects:Object.freeze(['wiki_cargo','wiki','game_semantics','legacy']),
  partnerRankValues:Object.freeze(['wiki_cargo','verified_structured','legacy']),
  bossData:Object.freeze(['game_dump','wiki','legacy'])
});

const FIELD_ALIASES=Object.freeze({name:'germanName',element:'elements',skills:'activeSkills',partner:'partnerDescription'});

function nonEmpty(value){
  if(value==null)return false;
  if(typeof value==='string')return value.trim().length>0;
  if(Array.isArray(value))return value.length>0;
  if(typeof value==='object')return Object.keys(value).length>0;
  return true;
}

export function normalizeSourceTag(tag){
  const raw=String(tag??'').toLowerCase();
  if(!raw)return'legacy';
  if(raw.includes('official')||raw.includes('localization')||raw.includes('l10n'))return'official_localization';
  if(raw.includes('cargo'))return'wiki_cargo';
  if(raw.includes('wiki'))return'wiki';
  if(raw.includes('game')||raw.includes('dump')||raw.includes('canonical-1.0')||raw.includes('save-pal'))return'game_dump';
  if(raw.includes('semantic'))return'game_semantics';
  if(raw.includes('fallback')||raw.includes('pending'))return'fallback';
  if(raw.includes('verified_structured'))return'verified_structured';
  return'legacy';
}

export function fieldSource(row,field){
  const logical=FIELD_ALIASES[field]||field;
  const explicit=row?.fieldSources?.[logical]??row?.fieldSources?.[field];
  if(explicit)return normalizeSourceTag(explicit);
  if(logical==='germanName'){
    if(row?.translationStatus==='de-official'||row?.languageStatus==='de-confirmed')return'official_localization';
    if(String(row?.source||'').includes('wiki'))return'wiki';
    if(row?.translationStatus==='en-fallback'||row?.languageStatus==='de-pending')return'fallback';
  }
  if(logical==='partnerEffects'&&String(row?.partner?.source||row?.source||'').includes('cargo'))return'wiki_cargo';
  if(logical==='partnerDescription'&&String(row?.partner?.source||row?.source||'').includes('wiki'))return'wiki';
  return normalizeSourceTag(row?.source);
}

export function sourceRank(field,source){
  const logical=FIELD_ALIASES[field]||field;
  const order=FIELD_SOURCE_PRIORITY[logical]||['game_dump','wiki','legacy'];
  const normalized=normalizeSourceTag(source);
  const index=order.indexOf(normalized);
  return index<0?order.length+10:index;
}

export function chooseField(field,candidates=[]){
  const valid=candidates.filter(candidate=>candidate&&nonEmpty(candidate.value));
  if(!valid.length)return{value:null,source:null};
  valid.sort((a,b)=>sourceRank(field,a.source)-sourceRank(field,b.source));
  return valid[0];
}

function mergeSupplementalArray(primary=[],fallback=[]){
  const result=[],seen=new Set();
  for(const item of [...(Array.isArray(primary)?primary:[]),...(Array.isArray(fallback)?fallback:[])]){
    const key=String(item?.id??item?.key??JSON.stringify(item));
    if(seen.has(key))continue;
    seen.add(key);result.push(item);
  }
  return result;
}

function authoritativeArray(field,a,b,key){
  const selected=chooseField(field,[
    {value:a?.[key],source:fieldSource(a,field),owner:a},
    {value:b?.[key],source:fieldSource(b,field),owner:b}
  ]);
  return {value:Array.isArray(selected.value)?selected.value:[],source:selected.source,owner:selected.owner||null};
}

function pick(field,a,b,key=field){
  return chooseField(field,[
    {value:a?.[key],source:fieldSource(a,field),owner:a},
    {value:b?.[key],source:fieldSource(b,field),owner:b}
  ]);
}

export function mergePalRecordsByPriority(a={},b={}){
  const stats=pick('stats',a,b);
  const element=pick('elements',a,b,'element');
  const skills=authoritativeArray('activeSkills',a,b,'skills');
  const fixedPassives=authoritativeArray('fixedPassives',a,b,'fixedPassives');
  const work=pick('work',a,b);
  const movement=pick('movement',a,b);
  const name=pick('germanName',a,b,'name');
  const description=pick('description',a,b);
  const paldeck=pick('paldeck',a,b);
  const partnerDescription=chooseField('partnerDescription',[
    {value:a?.partner?.description,source:fieldSource(a,'partnerDescription'),owner:a},
    {value:b?.partner?.description,source:fieldSource(b,'partnerDescription'),owner:b}
  ]);
  const partnerName=chooseField('partnerDescription',[
    {value:a?.partner?.name,source:fieldSource(a,'partnerDescription'),owner:a},
    {value:b?.partner?.name,source:fieldSource(b,'partnerDescription'),owner:b}
  ]);
  const partnerEffects=chooseField('partnerEffects',[
    {value:a?.partner?.effects,source:fieldSource(a,'partnerEffects'),owner:a},
    {value:b?.partner?.effects,source:fieldSource(b,'partnerEffects'),owner:b}
  ]);
  const merged={
    ...b,...a,
    internalId:a.internalId||b.internalId,
    key:a.key||b.key,
    paldeck:paldeck.value??a.paldeck??b.paldeck??null,
    name:name.value??a.name??b.name,
    description:description.value??a.description??b.description??null,
    element:element.value??a.element??b.element??'',
    stats:stats.value??a.stats??b.stats??{},
    work:work.value??a.work??b.work??{},
    movement:movement.value??a.movement??b.movement??{},
    skills:skills.value,
    fixedPassives:fixedPassives.value,
    drops:mergeSupplementalArray(a.drops,b.drops),
    spawn:mergeSupplementalArray(a.spawn,b.spawn),
    partner:{
      ...(b.partner||{}),...(a.partner||{}),
      name:partnerName.value??a.partner?.name??b.partner?.name??null,
      description:partnerDescription.value??a.partner?.description??b.partner?.description??null,
      effects:Array.isArray(partnerEffects.value)?partnerEffects.value:[]
    },
    aliases:[...new Set([...(a.aliases||[]),...(b.aliases||[]),a.name,b.name].filter(Boolean))],
    canonical:true,
    fieldSources:{
      ...(b.fieldSources||{}),...(a.fieldSources||{}),
      stats:stats.source,
      elements:element.source,
      activeSkills:skills.source,
      fixedPassives:fixedPassives.source,
      work:work.source,
      movement:movement.source,
      germanName:name.source,
      description:description.source,
      paldeck:paldeck.source,
      partnerDescription:partnerDescription.source,
      partnerEffects:partnerEffects.source
    }
  };
  return merged;
}
