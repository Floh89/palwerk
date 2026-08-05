import { PAL_CATALOG } from './catalog.js';
import { BOSS_RECORDS, PAL_GAME_RECORDS } from './generated-core.js';
import { RAID_PROFILES, TOWER_PROFILES, profileForEncounter } from './encounter-overrides.js';

const norm=value=>String(value??'').toLowerCase().replace(/^boss_/,'').replace(/^raid_/,'').replace(/[^a-z0-9]+/g,'');
const number=value=>Number.isFinite(Number(value))?Number(value):null;

function findCatalog(characterId){
  const key=norm(characterId);
  return PAL_CATALOG.find(p=>norm(p.internalId)===key||norm(p.name)===key||norm(p.internalId).endsWith(key));
}
function baseRecordFor(pal){
  if(!pal)return null;
  const direct=PAL_GAME_RECORDS?.[pal.internalId];
  if(direct)return direct;
  const wanted=norm(pal.internalId||pal.name);
  return Object.entries(PAL_GAME_RECORDS||{}).find(([id])=>norm(id)===wanted||norm(id).endsWith(wanted))?.[1]||null;
}
function exactFromProfile(profile,base={}){
  return{
    hp:number(profile?.hp??base?.hp),
    attack:number(base?.attack),
    defense:number(base?.defense),
    timeLimit:number(profile?.timeLimit??base?.time_limit),
    resistances:profile?.resistances||base?.resistances||null,
    statusImmunities:profile?.statusImmunities||base?.status_immunities||null,
    phases:profile?.phases||base?.phases||null,
    skills:base?.skill_set||null,
    adds:profile?.adds||null
  };
}
function finalize(row,profile=null){
  const exact=exactFromProfile(profile,row._base||{});
  const verifiedFields=['baseStats'];
  if(row.level!=null||profile?.level!=null)verifiedFields.push('level');
  if(row.location?.x!=null)verifiedFields.push('location');
  if(exact.hp!=null)verifiedFields.push('exact.hp');
  if(exact.timeLimit!=null)verifiedFields.push('exact.timeLimit');
  if(exact.phases)verifiedFields.push('exact.phases');
  if(exact.adds)verifiedFields.push('exact.adds');
  const required=['exact.hp','exact.attack','exact.defense','exact.timeLimit','exact.resistances','exact.statusImmunities','exact.phases','exact.skills'];
  const missingFields=required.filter(path=>{
    const key=path.split('.')[1];
    return exact[key]==null;
  });
  const confidence=exact.hp!=null&&exact.timeLimit!=null?(missingFields.length<=3?'high':'medium'):'partial';
  return{...row,level:profile?.level??row.level,element:profile?.elements?.join('/')||row.element,exact,profileId:profile?.id||null,source:profile?.source||row.source||null,verifiedAt:profile?.verifiedAt||null,confidence,verifiedFields,missingFields,simulationReady:exact.hp!=null&&exact.defense!=null&&exact.timeLimit!=null&&exact.resistances!=null};
}

function normalizeBossRows(){
  const rows=[];
  for(const [sourceId,raw] of Object.entries(BOSS_RECORDS||{})){
    const characterId=raw?.character_id;
    if(!characterId||characterId==='None')continue;
    const pal=findCatalog(characterId);
    if(!pal)continue;
    const base=baseRecordFor(pal)||{};
    const seed={id:`boss-${sourceId}`,type:'alpha',sourceId,characterId,catalogId:pal.key,name:pal.name,element:pal.element,level:number(raw.level),location:{x:number(raw.x),y:number(raw.y),z:number(raw.z),spawnerId:raw.spawner_id||null},baseStats:{hp:number(base?.scaling?.hp??pal.stats?.hp),attack:number(base?.scaling?.attack??pal.stats?.attack),defense:number(base?.scaling?.defense??pal.stats?.defense)},_base:base};
    rows.push(finalize(seed,null));
  }
  return rows;
}
function normalizeTowerRows(){
  return TOWER_PROFILES.map(profile=>{
    const pal=PAL_CATALOG.find(p=>profile.match.test(`${p.name} ${p.internalId||''}`));
    const base=baseRecordFor(pal)||{};
    return finalize({id:`tower-${profile.id}`,type:'tower',difficulty:profile.difficulty,catalogId:pal?.key||null,characterId:pal?.internalId||null,name:profile.name,element:profile.elements.join('/'),level:profile.level,location:null,baseStats:{hp:number(base?.scaling?.hp??pal?.stats?.hp),attack:number(base?.scaling?.attack??pal?.stats?.attack),defense:number(base?.scaling?.defense??pal?.stats?.defense)},_base:base},profile);
  });
}
function normalizeRaidRows(){
  return RAID_PROFILES.map(profile=>{
    const pal=PAL_CATALOG.find(p=>profile.match.test(`${p.name} ${p.internalId||''}`));
    const base=baseRecordFor(pal)||{};
    return finalize({id:`raid-${profile.id}`,type:'raid',catalogId:pal?.key||null,characterId:pal?.internalId||null,name:profile.name,element:profile.elements.join('/'),level:profile.level,location:null,baseStats:{hp:number(base?.scaling?.hp??pal?.stats?.hp),attack:number(base?.scaling?.attack??pal?.stats?.attack),defense:number(base?.scaling?.defense??pal?.stats?.defense)},_base:base},profile);
  });
}

export const BOSS_ENCOUNTERS=normalizeBossRows();
export const TOWER_ENCOUNTERS=normalizeTowerRows();
export const RAID_ENCOUNTERS=normalizeRaidRows();
export const ENCOUNTERS=[...BOSS_ENCOUNTERS,...TOWER_ENCOUNTERS,...RAID_ENCOUNTERS].map(({_base,...row})=>row);

for(const encounter of ENCOUNTERS){
  const pal=PAL_CATALOG.find(p=>p.key===encounter.catalogId);
  if(!pal)continue;
  pal.encounters=pal.encounters||[];
  pal.encounters.push(encounter);
  pal.encounter=[...pal.encounters].sort((a,b)=>(b.level||0)-(a.level||0))[0];
}

const duplicateIds=ENCOUNTERS.length-new Set(ENCOUNTERS.map(x=>x.id)).size;
if(duplicateIds)throw new Error(`Duplicate encounter ids: ${duplicateIds}`);

export const COMBAT_DATA_REPORT={
  generatedAt:new Date().toISOString(),
  bosses:BOSS_ENCOUNTERS.length,
  towers:TOWER_ENCOUNTERS.length,
  raids:RAID_ENCOUNTERS.length,
  withLevel:ENCOUNTERS.filter(x=>x.level!=null).length,
  withLocation:ENCOUNTERS.filter(x=>x.location?.x!=null).length,
  withExactHp:ENCOUNTERS.filter(x=>x.exact?.hp!=null).length,
  withTimeLimit:ENCOUNTERS.filter(x=>x.exact?.timeLimit!=null).length,
  withResistances:ENCOUNTERS.filter(x=>x.exact?.resistances).length,
  withPhases:ENCOUNTERS.filter(x=>x.exact?.phases).length,
  simulationReady:ENCOUNTERS.filter(x=>x.simulationReady).length,
  duplicateIds,
  verifiedRaidProfiles:RAID_PROFILES.length,
  verifiedTowerProfiles:TOWER_PROFILES.length
};

export function encounterFor(target,difficulty='Normal'){
  const haystack=`${target?.name||''} ${target?.internalId||''} ${target?.key||''}`;
  const type=target?.flags?.raidBoss||/bellanoir|blazamut ryu|xenolord|hartalis|moon lord/i.test(haystack)?'raid':'tower';
  return ENCOUNTERS.find(x=>x.type===type&&(!x.difficulty||x.difficulty===difficulty)&&(x.catalogId===target?.key||norm(x.name)===norm(target?.name)||norm(haystack).includes(norm(x.characterId))))||null;
}

window.PALWERK_COMBAT_DATA={encounters:ENCOUNTERS,report:COMBAT_DATA_REPORT,encounterFor};
