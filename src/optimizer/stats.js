import { resolvePassive } from '../data/passives.js';

export const STAT_MODEL_VERSION='2.0.0';
export const STAT_GAME_VERSION='1.0';
export const STAT_PROVENANCE=Object.freeze({
  source:'deafdudecomputers/PalworldSaveTools 1.0 stat breakdown; cross-checked with palworld.wiki.gg creature parameters and current 1.0 Awakening measurements',
  verifiedAt:'2026-08-07',
  confidence:'high',
  status:'community-tested',
  note:'Base/condensation/soul/passive order and current Trust/Awakening formulas are reproduced from the game-verified 1.0 breakdown. The upstream reference documents rare ±1–2 boundary differences for some Trust/Awakening cases, so those paths are not labelled exact-native.'
});

export const STAT_CONSTANTS=Object.freeze({
  talentRate:0.003,
  hpConstant:500,
  hpPerLevel:5,
  hpScaling:0.5,
  attackAdditivePerLevel:1.5,
  attackScaling:0.075,
  defenseAdditivePerLevel:0.75,
  defenseScaling:0.075,
  condenseRate:0.05,
  soulRateHp:0.03,
  soulRateAttack:0.03,
  soulRateDefense:0.03,
  trustHpRate:0.65,
  trustAttackDefenseDivisor:10.2,
  awakeningHpRate:0.065,
  awakeningAttackDefenseRate:0.009,
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
const roundPositive=value=>Math.floor(Math.max(0,N(value))+.5);

function sourcePal(pal){return pal?.sourceRef||pal||{};}
function speciesStats(pal){
  const src=sourcePal(pal),raw=src?.rawRecord||{};
  const pick=(...values)=>values.find(value=>value!=null&&Number.isFinite(Number(value)));
  return {
    hp:N(pick(pal?.stats?.hp,src?.stats?.hp,raw?.scaling?.hp,raw?.stats?.hp)),
    attack:N(pick(pal?.stats?.attack,src?.stats?.attack,raw?.scaling?.attack,raw?.stats?.shot_attack,raw?.stats?.attack)),
    defense:N(pick(pal?.stats?.defense,src?.stats?.defense,raw?.scaling?.defense,raw?.stats?.defense))
  };
}
function friendshipGrowth(pal){
  const src=sourcePal(pal),raw=src?.rawRecord||{},friend=pal?.friendship||src?.friendship||{};
  const pick=(...values)=>values.find(value=>value!=null&&Number.isFinite(Number(value)));
  return {
    hp:N(pick(friend.hp,friend.maxHp,raw.friendship_hp,raw.Friendship_HP,raw.stats?.friendship_hp)),
    attack:N(pick(friend.attack,friend.shotAttack,raw.friendship_shotattack,raw.friendship_shot_attack,raw.Friendship_ShotAttack,raw.Friendship_Attack,raw.stats?.friendship_shotattack)),
    defense:N(pick(friend.defense,raw.friendship_defense,raw.Friendship_Defense,raw.stats?.friendship_defense))
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
function normalizeFood(foodBonuses={}){
  return {
    hp:N(foodBonuses.hp??foodBonuses.hpPct)/100,
    attack:N(foodBonuses.attack??foodBonuses.attackPct)/100,
    defense:N(foodBonuses.defense??foodBonuses.defensePct)/100
  };
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
  mutation=false,
  globalBonuses={},
  foodBonuses={}
}={}){
  const species=speciesStats(pal),L=clamp(level,1,STAT_CONSTANTS.maxLevel);
  if(species.hp<=0||species.attack<=0||species.defense<=0)return {status:'insufficient-data',reason:'Species-HP, -Angriff und -Verteidigung werden für die Statberechnung benötigt.'};
  if(mutation)return {status:'insufficient-data',reason:'Die 1.0-Mutations-Statmodifikation ist noch nicht belastbar quantifiziert und wird nicht geschätzt.'};

  const F=clamp(trust,0,STAT_CONSTANTS.maxTrustRank),friendship=friendshipGrowth(pal);
  if(F>0&&friendship.hp===0&&friendship.attack===0&&friendship.defense===0)return {status:'insufficient-data',reason:'Trust wurde angegeben, aber species-spezifische Friendship-Statwerte fehlen.'};

  const IV=normalizePotential(potential,ivs),Soul=normalizeSouls(souls),Stars=clamp(stars??condensation,0,STAT_CONSTANTS.maxStars),condBonus=Stars*STAT_CONSTANTS.condenseRate,awake=Boolean(awakening),food=normalizeFood(foodBonuses);
  const hpIv=IV.hp*STAT_CONSTANTS.talentRate,attackIv=IV.attack*STAT_CONSTANTS.talentRate,defenseIv=IV.defense*STAT_CONSTANTS.talentRate;

  // Palworld 1.0 order: base -> condensation -> Trust/Awakening additive -> Souls/passives/food multiplicative.
  const hpBase=Math.floor(STAT_CONSTANTS.hpConstant+STAT_CONSTANTS.hpPerLevel*L+species.hp*STAT_CONSTANTS.hpScaling*L*(1+hpIv));
  const hpCondensed=Math.floor(hpBase*(1+condBonus));
  const hpTrust=F>0?roundPositive(L*F*friendship.hp*STAT_CONSTANTS.trustHpRate*(1+condBonus)):0;
  const hpAwakening=awake?Math.floor(species.hp*L*STAT_CONSTANTS.awakeningHpRate*(1+condBonus)):0;
  const hpSubtotal=hpCondensed+hpTrust+hpAwakening;

  const attackAdditive=Math.floor(STAT_CONSTANTS.attackAdditivePerLevel*L);
  const attackBase=Math.floor(attackAdditive+species.attack*STAT_CONSTANTS.attackScaling*L*(1+attackIv)*(1+condBonus));
  const attackTrustBase=F>0?L*F*friendship.attack/STAT_CONSTANTS.trustAttackDefenseDivisor:0;
  const attackTrust=F>0?Math.floor(attackTrustBase)+Math.floor(attackTrustBase*condBonus):0;
  const attackAwakening=awake?Math.floor(species.attack*L*(1+attackIv)*STAT_CONSTANTS.awakeningAttackDefenseRate):0;
  const attackSubtotal=attackBase+attackTrust+attackAwakening;

  const defenseAdditive=Math.floor(STAT_CONSTANTS.defenseAdditivePerLevel*L);
  const defenseBase=Math.floor(defenseAdditive+species.defense*STAT_CONSTANTS.defenseScaling*L*(1+defenseIv)*(1+condBonus));
  const defenseTrust=F>0?Math.floor(L*F*friendship.defense/STAT_CONSTANTS.trustAttackDefenseDivisor*(1+condBonus)):0;
  const defenseAwakening=awake?Math.floor(species.defense*L*(1+defenseIv)*STAT_CONSTANTS.awakeningAttackDefenseRate):0;
  const defenseSubtotal=defenseBase+defenseTrust+defenseAwakening;

  const passive=passivePercentages(passives,implants,globalBonuses),hpPassive=Math.max(.1,1+passive.totals.hp/100),attackPassive=Math.max(.1,1+passive.totals.attack/100),defensePassive=Math.max(.1,1+passive.totals.defense/100);
  const hpSoul=1+Soul.hp*STAT_CONSTANTS.soulRateHp,attackSoul=1+Soul.attack*STAT_CONSTANTS.soulRateAttack,defenseSoul=1+Soul.defense*STAT_CONSTANTS.soulRateDefense;
  const hp=Math.floor(hpSubtotal*hpSoul*hpPassive*(1+food.hp));
  const attack=Math.floor(attackSubtotal*attackSoul*attackPassive*(1+food.attack));
  const defense=Math.floor(defenseSubtotal*defenseSoul*defensePassive*(1+food.defense));

  const boundarySensitive=F>0||awake;
  return {
    status:'ok',
    hp,
    attack,
    defense,
    effectiveAttack:attack,
    effectiveHP:null,
    effectiveHpStat:floor3(hp),
    effectiveDefense:defense,
    effectiveHPStatus:'provisional',
    effectiveHPReason:'Die aktuelle Defense→Schadensminderung ist noch nicht native-validiert; deshalb wird kein erfundener EHP-Wert ausgegeben.',
    inputs:{level:L,potential:IV,souls:Soul,stars:Stars,trust:F,awakening:awake,mutation:false},
    breakdown:{
      hp:{base:hpBase,condensed:hpCondensed,trust:hpTrust,awakening:hpAwakening,subtotal:hpSubtotal,soulMultiplier:hpSoul,passiveMultiplier:hpPassive,foodMultiplier:1+food.hp,final:hp},
      attack:{additive:attackAdditive,base:attackBase,condensed:attackBase,trust:attackTrust,awakening:attackAwakening,subtotal:attackSubtotal,soulMultiplier:attackSoul,passiveMultiplier:attackPassive,foodMultiplier:1+food.attack,final:attack},
      defense:{additive:defenseAdditive,base:defenseBase,condensed:defenseBase,trust:defenseTrust,awakening:defenseAwakening,subtotal:defenseSubtotal,soulMultiplier:defenseSoul,passiveMultiplier:defensePassive,foodMultiplier:1+food.defense,final:defense}
    },
    permanentStages:{hp0:hpBase,hp1:hpCondensed,attack0:attackBase,attack1:attackSubtotal,defense0:defenseBase,defense1:defenseSubtotal},
    passivePercentages:passive.totals,
    passiveIds:passive.passives.map(row=>row.id),
    source:STAT_PROVENANCE.source,
    gameVersion:STAT_GAME_VERSION,
    confidence:boundarySensitive?'medium-high':'high',
    dataQuality:boundarySensitive?'community-tested':'verified',
    assumptions:boundarySensitive?['Trust/Awakening folgen der aktuellen 1.0-In-Game-Validierung; seltene Rundungsgrenzen können laut Referenz um 1–2 Statpunkte abweichen.']:[]
  };
}
