import { resolvePassive } from '../data/passives.js';

export const STAT_MODEL_VERSION='1.0.0';
export const STAT_GAME_VERSION='1.0';
export const STAT_PROVENANCE=Object.freeze({
  source:'arkive-games/arkive Palworld stat formula audit',
  validatedAt:'2026-07-19/2026-07-23',
  verifiedAt:'2026-08-07',
  confidence:'high',
  status:'verified',
  note:'Calculation order and truncation were validated against Palworld 1.0 DataTables/Blueprint exports and native executable functions.'
});

export const STAT_CONSTANTS=Object.freeze({
  talentRate:0.003,
  tribePlusHp:10,
  levelMultiplierHp:0.5,
  constantHp:500,
  levelMultiplierAttack:0.075,
  constantAttack:100,
  levelMultiplierDefense:0.075,
  constantDefense:50,
  condenseRate:0.05,
  soulRateHp:0.03,
  soulRateAttack:0.03,
  soulRateDefense:0.03,
  awakeningMultiplier:1.1,
  maxLevel:100,
  maxPotential:100,
  maxStars:4,
  maxSoulRank:20,
  maxTrustRank:10
});

const N=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,N(value)));
const list=value=>Array.isArray(value)?value:[];
const floor3=value=>Math.floor(value*1000)/1000;

function sourcePal(pal){return pal?.sourceRef||pal||{};}
function speciesStats(pal){
  const src=sourcePal(pal);
  return {
    hp:N(pal?.stats?.hp??src?.stats?.hp),
    attack:N(pal?.stats?.attack??src?.stats?.attack),
    defense:N(pal?.stats?.defense??src?.stats?.defense)
  };
}
function friendshipGrowth(pal){
  const src=sourcePal(pal),raw=src?.rawRecord||{},friend=pal?.friendship||src?.friendship||{};
  const pick=(...values)=>values.find(value=>value!=null&&Number.isFinite(Number(value)));
  return {
    hp:N(pick(friend.hp,friend.maxHp,raw.Friendship_HP,raw.friendship_hp)),
    attack:N(pick(friend.attack,friend.shotAttack,raw.Friendship_ShotAttack,raw.Friendship_Attack,raw.friendship_shot_attack)),
    defense:N(pick(friend.defense,raw.Friendship_Defense,raw.friendship_defense))
  };
}
function normalizePotential(potential,ivs){
  const src=(potential&&typeof potential==='object')?potential:(ivs&&typeof ivs==='object')?ivs:{};
  const scalar=typeof potential==='number'?potential:null;
  return {
    hp:clamp(src.hp??scalar??0,0,STAT_CONSTANTS.maxPotential),
    attack:clamp(src.attack??src.atk??scalar??0,0,STAT_CONSTANTS.maxPotential),
    defense:clamp(src.defense??src.def??scalar??0,0,STAT_CONSTANTS.maxPotential)
  };
}
function normalizeSouls(souls={}){
  return {
    hp:clamp(souls.hp,0,STAT_CONSTANTS.maxSoulRank),
    attack:clamp(souls.attack??souls.atk,0,STAT_CONSTANTS.maxSoulRank),
    defense:clamp(souls.defense??souls.def,0,STAT_CONSTANTS.maxSoulRank)
  };
}
function resolvePassiveNode(value){
  if(value&&typeof value==='object'&&Array.isArray(value.effects))return value;
  return resolvePassive(value);
}
function passivePercentages(passives=[],implants=[],globalBonuses={}){
  const unique=new Map();
  for(const item of [...list(passives),...list(implants)]){
    const passive=resolvePassiveNode(item);
    if(passive?.id&&!unique.has(passive.id))unique.set(passive.id,passive);
  }
  const totals={hp:0,attack:0,defense:0};
  for(const passive of unique.values())for(const effect of list(passive.effects)){
    if(effect?.value==null)continue;
    if(effect.stat==='hp')totals.hp+=N(effect.value);
    if(effect.stat==='attack')totals.attack+=N(effect.value);
    if(effect.stat==='defense')totals.defense+=N(effect.value);
  }
  totals.hp+=N(globalBonuses.hp??globalBonuses.hpPct);
  totals.attack+=N(globalBonuses.attack??globalBonuses.attackPct);
  totals.defense+=N(globalBonuses.defense??globalBonuses.defensePct);
  return {totals,passives:[...unique.values()]};
}

export function calculatePalStats({
  pal,
  level=1,
  potential=null,
  ivs=null,
  souls={},
  condensation=0,
  stars=null,
  passives=[],
  implants=[],
  trust=0,
  awakening=false,
  globalBonuses={}
}={}){
  const species=speciesStats(pal),L=clamp(level,1,STAT_CONSTANTS.maxLevel);
  if(species.hp<=0||species.attack<=0||species.defense<=0)return {status:'insufficient-data',reason:'Species-HP, -Angriff und -Verteidigung werden für die Statberechnung benötigt.'};
  const F=clamp(trust,0,STAT_CONSTANTS.maxTrustRank),friendship=friendshipGrowth(pal);
  if(F>0&&friendship.hp===0&&friendship.attack===0&&friendship.defense===0)return {status:'insufficient-data',reason:'Trust wurde angegeben, aber species-spezifische Friendship-Statwerte fehlen.'};
  const IV=normalizePotential(potential,ivs),Soul=normalizeSouls(souls),Stars=clamp(stars??condensation,0,STAT_CONSTANTS.maxStars),awake=Boolean(awakening),awakeMultiplier=awake?STAT_CONSTANTS.awakeningMultiplier:1;
  const baseHp=species.hp*awakeMultiplier+friendship.hp*F;
  const baseAttack=species.attack*awakeMultiplier+friendship.attack*F;
  const baseDefense=species.defense*awakeMultiplier+friendship.defense*F;

  const hp0=Math.floor(((baseHp*(1+IV.hp*STAT_CONSTANTS.talentRate)+STAT_CONSTANTS.tribePlusHp)*STAT_CONSTANTS.levelMultiplierHp*L)+STAT_CONSTANTS.constantHp);
  const attack0=Math.floor(baseAttack*(1+IV.attack*STAT_CONSTANTS.talentRate)*STAT_CONSTANTS.levelMultiplierAttack*L+STAT_CONSTANTS.constantAttack);
  const defense0=Math.floor(baseDefense*(1+IV.defense*STAT_CONSTANTS.talentRate)*STAT_CONSTANTS.levelMultiplierDefense*L+STAT_CONSTANTS.constantDefense);
  const hp1=Math.floor(hp0*(1+Stars*STAT_CONSTANTS.condenseRate));
  const attack1=Math.floor(attack0*(1+Stars*STAT_CONSTANTS.condenseRate));
  const defense1=Math.floor(defense0*(1+Stars*STAT_CONSTANTS.condenseRate));
  const hp=Math.floor(hp1*(1+Soul.hp*STAT_CONSTANTS.soulRateHp));
  const attack=Math.floor(attack1*(1+Soul.attack*STAT_CONSTANTS.soulRateAttack));
  const defense=Math.floor(defense1*(1+Soul.defense*STAT_CONSTANTS.soulRateDefense));

  const passive=passivePercentages(passives,implants,globalBonuses),hpMultiplier=Math.max(.1,1+passive.totals.hp/100),attackMultiplier=Math.max(.1,1+passive.totals.attack/100),defenseMultiplier=Math.max(.1,1+passive.totals.defense/100);
  const effectiveHpStat=floor3(hp*hpMultiplier),effectiveAttack=Math.floor(attack*attackMultiplier),effectiveDefense=Math.floor(defense*defenseMultiplier);

  return {
    status:'ok',
    hp,
    attack,
    defense,
    effectiveAttack,
    effectiveHP:null,
    effectiveHpStat,
    effectiveDefense,
    effectiveHPStatus:'provisional',
    effectiveHPReason:'Die aktuelle Defense→Schadensminderung ist in Phase 2 noch nicht native-validiert; deshalb wird kein erfundener EHP-Wert ausgegeben.',
    inputs:{level:L,potential:IV,souls:Soul,stars:Stars,trust:F,awakening:awake},
    permanentStages:{hp0,hp1,attack0,attack1,defense0,defense1},
    passivePercentages:passive.totals,
    passiveIds:passive.passives.map(row=>row.id),
    source:STAT_PROVENANCE.source,
    gameVersion:STAT_GAME_VERSION,
    confidence:'high',
    dataQuality:'verified',
    assumptions:[]
  };
}
