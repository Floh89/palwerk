// PALWERK Phase 1 — validated Palworld 1.0 element mechanics.
// Primary numeric source: palworld.tools extraction from Palworld 1.0 build 24088745 (2026-07-13).
// Cross-check: palworld.wiki.gg confirms the type chart and STAB, but currently documents conflicting 2.0/0.5 matchup multipliers.

export const ELEMENT_MODEL_VERSION='1.0.1';
export const ELEMENT_GAME_VERSION='1.0';

export const ELEMENT_PROVENANCE=Object.freeze({
  matchupMultipliers:Object.freeze({
    source:'Palworld 1.0 game-data extraction via palworld.tools',
    gameBuild:'24088745',
    verifiedAt:'2026-08-07',
    confidence:'high',
    status:'verified',
    note:'Current wiki text conflicts on numeric matchup values; extracted 1.0 game data is preferred for the numeric formula.'
  }),
  typeChart:Object.freeze({
    source:'palworld.wiki.gg/Elements + Palworld Survival Guide',
    gameVersion:'1.0',
    verifiedAt:'2026-08-07',
    confidence:'high',
    status:'verified'
  }),
  stab:Object.freeze({
    source:'Palworld 1.0 game-data extraction via palworld.tools; cross-checked with palworld.wiki.gg/Elements',
    gameBuild:'24088745',
    verifiedAt:'2026-08-07',
    confidence:'high',
    status:'verified'
  })
});

export const ELEMENT_MULTIPLIERS=Object.freeze({strong:1.5,resisted:2/3,neutral:1,stab:1.2});

export const ELEMENT_STRONG_AGAINST=Object.freeze({
  Neutral:Object.freeze([]),
  Feuer:Object.freeze(['Gras','Eis']),
  Wasser:Object.freeze(['Feuer']),
  Gras:Object.freeze(['Erde']),
  Elektro:Object.freeze(['Wasser']),
  Eis:Object.freeze(['Drache']),
  Erde:Object.freeze(['Elektro']),
  Schatten:Object.freeze(['Neutral']),
  Drache:Object.freeze(['Schatten'])
});

const ELEMENT_ALIASES=Object.freeze({
  Normal:'Neutral',Neutral:'Neutral',Fire:'Feuer',Feuer:'Feuer',Water:'Wasser',Wasser:'Wasser',
  Grass:'Gras',Leaf:'Gras',Gras:'Gras',Electric:'Elektro',Electricity:'Elektro',Elektro:'Elektro',
  Ice:'Eis',Eis:'Eis',Ground:'Erde',Earth:'Erde',Erde:'Erde',Dark:'Schatten',Schatten:'Schatten',Dragon:'Drache',Drache:'Drache'
});

export function normalizeCombatElement(value){const raw=String(value??'').trim();return ELEMENT_ALIASES[raw]||raw||'Neutral';}

export function singleTypeEffectiveness(attackElement,defenseElement){
  const attack=normalizeCombatElement(attackElement),defense=normalizeCombatElement(defenseElement);
  if((ELEMENT_STRONG_AGAINST[attack]||[]).includes(defense))return ELEMENT_MULTIPLIERS.strong;
  if((ELEMENT_STRONG_AGAINST[defense]||[]).includes(attack))return ELEMENT_MULTIPLIERS.resisted;
  return ELEMENT_MULTIPLIERS.neutral;
}

export function elementEffectiveness(attackElement,defensiveElements=[]){
  const raw=Array.isArray(defensiveElements)?defensiveElements:[defensiveElements];
  const targets=[...new Set(raw.map(normalizeCombatElement).filter(Boolean))];
  if(!targets.length)return ELEMENT_MULTIPLIERS.neutral;
  return targets.reduce((multiplier,target)=>multiplier*singleTypeEffectiveness(attackElement,target),1);
}

export function stabMultiplier(skillElement,palElements=[]){
  const skill=normalizeCombatElement(skillElement),elements=[...new Set((Array.isArray(palElements)?palElements:[palElements]).map(normalizeCombatElement))];
  return elements.includes(skill)?ELEMENT_MULTIPLIERS.stab:1;
}

export function offensiveMultiplier({skillElement,palElements=[],defensiveElements=[]}={}){
  const element=elementEffectiveness(skillElement,defensiveElements),stab=stabMultiplier(skillElement,palElements);
  return Object.freeze({element,stab,total:element*stab});
}
