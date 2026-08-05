import { PAL_CATALOG } from './catalog.js';
import { BOSS_RECORDS, PAL_GAME_RECORDS } from './generated-core.js';

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
  const entry=Object.entries(PAL_GAME_RECORDS||{}).find(([id])=>norm(id)===wanted||norm(id).endsWith(wanted));
  return entry?.[1]||null;
}

function normalizeBossRows(){
  const rows=[];
  for(const [sourceId,raw] of Object.entries(BOSS_RECORDS||{})){
    const characterId=raw?.character_id;
    if(!characterId||characterId==='None')continue;
    const pal=findCatalog(characterId);
    if(!pal)continue;
    const base=baseRecordFor(pal)||{};
    rows.push({
      id:`boss-${sourceId}`,
      type:'alpha',
      sourceId,
      characterId,
      catalogId:pal.key,
      name:pal.name,
      element:pal.element,
      level:number(raw.level),
      location:{x:number(raw.x),y:number(raw.y),z:number(raw.z),spawnerId:raw.spawner_id||null},
      baseStats:{hp:number(base?.scaling?.hp??pal.stats?.hp),attack:number(base?.scaling?.attack??pal.stats?.attack),defense:number(base?.scaling?.defense??pal.stats?.defense)},
      exact:{hp:null,attack:null,defense:null,timeLimit:null,resistances:null,statusImmunities:null,phases:null,skills:null},
      confidence:'partial',
      verifiedFields:['level','location','baseStats'],
      missingFields:['exact.hp','exact.attack','exact.defense','exact.timeLimit','exact.resistances','exact.statusImmunities','exact.phases','exact.skills']
    });
  }
  return rows;
}

function normalizeRaidRows(){
  return PAL_CATALOG.filter(p=>p.flags?.raidBoss||/bellanoir|blazamut ryu|xenolord/i.test(`${p.name} ${p.internalId||''}`)).map(p=>{
    const base=baseRecordFor(p)||{};
    return{
      id:`raid-${p.key}`,
      type:'raid',
      catalogId:p.key,
      characterId:p.internalId||null,
      name:p.name,
      element:p.element,
      level:number(base?.level??base?.enemy_level),
      location:null,
      baseStats:{hp:number(base?.scaling?.hp??p.stats?.hp),attack:number(base?.scaling?.attack??p.stats?.attack),defense:number(base?.scaling?.defense??p.stats?.defense)},
      exact:{hp:number(base?.hp),attack:number(base?.attack),defense:number(base?.defense),timeLimit:number(base?.time_limit),resistances:base?.resistances||null,statusImmunities:base?.status_immunities||null,phases:base?.phases||null,skills:base?.skill_set||null},
      confidence:'low',
      verifiedFields:['baseStats'],
      missingFields:['level','exact.hp','exact.attack','exact.defense','exact.timeLimit','exact.resistances','exact.statusImmunities','exact.phases']
    };
  });
}

export const BOSS_ENCOUNTERS=normalizeBossRows();
export const RAID_ENCOUNTERS=normalizeRaidRows();
export const ENCOUNTERS=[...BOSS_ENCOUNTERS,...RAID_ENCOUNTERS];

for(const encounter of ENCOUNTERS){
  const pal=PAL_CATALOG.find(p=>p.key===encounter.catalogId);
  if(!pal)continue;
  pal.encounters=pal.encounters||[];
  pal.encounters.push(encounter);
  const best=[...(pal.encounters||[])].sort((a,b)=>(b.level||0)-(a.level||0))[0];
  pal.encounter=best;
}

export const COMBAT_DATA_REPORT={
  generatedAt:new Date().toISOString(),
  bosses:BOSS_ENCOUNTERS.length,
  raids:RAID_ENCOUNTERS.length,
  withLevel:ENCOUNTERS.filter(x=>x.level!=null).length,
  withLocation:ENCOUNTERS.filter(x=>x.location?.x!=null).length,
  withExactHp:ENCOUNTERS.filter(x=>x.exact?.hp!=null).length,
  withTimeLimit:ENCOUNTERS.filter(x=>x.exact?.timeLimit!=null).length,
  withResistances:ENCOUNTERS.filter(x=>x.exact?.resistances).length,
  simulationReady:ENCOUNTERS.filter(x=>x.exact?.hp!=null&&x.exact?.defense!=null&&x.exact?.timeLimit!=null&&x.exact?.resistances).length
};

window.PALWERK_COMBAT_DATA={encounters:ENCOUNTERS,report:COMBAT_DATA_REPORT};
