export const STATE_SCHEMA_VERSION=6;

const clone=value=>value==null?value:structuredClone(value);
const arr=value=>Array.isArray(value)?value:[];
const obj=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const uid=()=>globalThis.crypto?.randomUUID?.()||`pal-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const EMPTY_PLAYER=Object.freeze({
  level:null,
  weapons:[],
  weaponLevel:null,
  armor:[],
  shields:[],
  accessories:[],
  food:[],
  statusPoints:{hp:0,stamina:0,attack:0,workSpeed:0,weight:0},
  world:'',
  goal:'',
  goalType:'boss'
});

export const EMPTY_PROGRESS=Object.freeze({
  bosses:{},
  raids:{},
  towers:{},
  technologies:{},
  map:{},
  materials:{},
  bases:[]
});

export function normalizeOwnedPal(input={},index=0){
  const source=obj(input);
  return{
    uniqueId:String(source.uniqueId||uid()),
    catalogId:String(source.catalogId||source.key||source.internalId||''),
    name:String(source.name||''),
    level:source.level==null||source.level===''?null:Number(source.level),
    stars:Math.max(0,Math.min(4,Number(source.stars)||0)),
    alpha:Boolean(source.alpha),
    lucky:Boolean(source.lucky),
    gender:source.gender||null,
    passives:arr(source.passives).map(String),
    activeSkills:arr(source.activeSkills?.length?source.activeSkills:source.activeSkillIds).map(String).slice(0,3),
    ivs:{hp:Number(source.ivs?.hp)||0,attack:Number(source.ivs?.attack)||0,defense:Number(source.ivs?.defense)||0},
    souls:{hp:Number(source.souls?.hp)||0,attack:Number(source.souls?.attack)||0,defense:Number(source.souls?.defense)||0,work:Number(source.souls?.work)||0},
    implants:arr(source.implants).map(String),
    trust:source.trust==null?null:Number(source.trust),
    saddleOwned:Boolean(source.saddleOwned),
    favorite:Boolean(source.favorite),
    role:String(source.role||''),
    notes:String(source.notes||''),
    createdAt:source.createdAt||null,
    updatedAt:source.updatedAt||null,
    legacyIndex:index
  };
}

function migrateTo6(input){
  const state=obj(clone(input));
  const legacyProfile=obj(state.profile);
  const player={...EMPTY_PLAYER,...obj(state.player),...legacyProfile};
  player.level=state.player?.level??legacyProfile.playerLevel??null;
  player.weapons=arr(state.player?.weapons?.length?state.player.weapons:state.equipment);
  player.armor=arr(state.player?.armor);
  player.shields=arr(state.player?.shields);
  player.accessories=arr(state.player?.accessories);
  player.food=arr(state.player?.food);
  player.statusPoints={...EMPTY_PLAYER.statusPoints,...obj(state.player?.statusPoints)};

  const progress={...EMPTY_PROGRESS,...obj(state.progress)};
  progress.materials={...obj(progress.materials),...Object.fromEntries(arr(state.materials).map(item=>[item.id||item.name,item]))};
  progress.bases=arr(state.progress?.bases?.length?state.progress.bases:state.bases);

  return{
    ...state,
    schemaVersion:STATE_SCHEMA_VERSION,
    player,
    progress,
    pals:arr(state.pals).map(normalizeOwnedPal),
    teamPlans:arr(state.teamPlans),
    migration:{from:Number(state.schemaVersion)||1,to:STATE_SCHEMA_VERSION,migratedAt:new Date().toISOString()},
    updatedAt:state.updatedAt||null
  };
}

export function migrateState(input,fallback={}){
  const source={...clone(fallback),...obj(clone(input))};
  if(Number(source.schemaVersion)===STATE_SCHEMA_VERSION){
    const normalized=migrateTo6(source);
    normalized.migration=source.migration||null;
    return normalized;
  }
  return migrateTo6(source);
}

export function validatePersonalState(state){
  const errors=[];
  if(Number(state?.schemaVersion)!==STATE_SCHEMA_VERSION)errors.push('schemaVersion');
  if(!state?.player||typeof state.player!=='object')errors.push('player');
  if(!state?.progress||typeof state.progress!=='object')errors.push('progress');
  const ids=new Set();
  for(const pal of arr(state?.pals)){
    for(const key of ['uniqueId','catalogId','name','passives','activeSkills','ivs','souls','implants','saddleOwned','favorite','role','notes'])if(!(key in pal))errors.push(`pal.${key}`);
    if(ids.has(pal.uniqueId))errors.push(`duplicate:${pal.uniqueId}`);else ids.add(pal.uniqueId);
  }
  return [...new Set(errors)];
}
