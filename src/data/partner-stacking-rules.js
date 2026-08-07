export const PARTNER_STACKING_RULES_VERSION='1.0.0';

// Palworld 1.0 changed the default for duplicate-species Partner Skills:
// most effect rows no longer stack and only the strongest duplicate should count.
// The exceptions below are row-level exceptions from the current 1.0 data-backed
// stacking audit. A Pal can therefore contain both stackable and highest-only rows.
export const PARTNER_STACKING_SOURCE=Object.freeze({
  defaultRule:{
    id:'pocketpair-1.0-duplicate-species-default',
    source:'Pocketpair Palworld 1.0 official changelog',
    gameVersion:'1.0',
    rule:'highestOnly',
    scope:'same_species',
    confidence:'high'
  },
  exceptions:{
    id:'palmods-1.0-effect-row-stacking-audit',
    source:'PalMods 1.0 partner-skill effect-row dataset audit',
    gameVersion:'1.0',
    rule:'stack',
    scope:'effect_row',
    confidence:'medium'
  }
});

const rows=(palName,patterns)=>Object.freeze({palName,patterns:Object.freeze(patterns)});

// 25 Pal records with at least one explicitly stackable effect row in the 1.0 audit.
// Patterns target the raw Cargo scale effect type whenever available so mixed skills
// do not accidentally make unrelated rows stack.
export const SAME_SPECIES_STACKING_EXCEPTIONS=Object.freeze([
  rows('Kingpaca',[/movement.*speed/i,/defen/i]),
  rows('Kingpaca Cryst',[/movement.*speed/i,/defen/i]),
  rows('Sweepa',[/attack/i,/defen/i]),
  rows('Jelliette',[/work.*speed/i]),
  rows('Jellroy',[/work.*speed/i]),
  rows('Gobfin',[/attack/i]),
  rows('Gobfin Ignis',[/attack/i]),
  rows('Elizabee',[/attack/i,/defen/i]),
  rows('Leafan',[/attack/i,/defen/i]),
  rows('Beakon',[/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Beakon Cryst',[/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Ghangler',[/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Ghangler Ignis',[/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Rayhound',[/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Moldron',[/attack/i]),
  rows('Shroomer Noct',[/san.*deplet|san.*consum|san/i]),
  rows('Suzaku',[/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Suzaku Aqua',[/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Lullu',[/crop.*growth|growth.*speed/i]),
  rows('Starryon Primo',[/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Prunelia',[/crop.*harvest|harvest.*yield|harvest/i]),
  rows('Celesdir',[/attack/i,/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Eidrolon',[/attack/i,/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Eidrolon Ignis',[/attack/i,/movement.*speed|move.*speed|ride.*speed/i]),
  rows('Shaolong',[/attack/i])
]);

const normalize=value=>String(value??'').trim().toLowerCase();
const exceptionFor=palName=>SAME_SPECIES_STACKING_EXCEPTIONS.find(row=>normalize(row.palName)===normalize(palName))||null;

export function resolvePartnerStackingRule({palName,effect={},description=''}){
  const rawType=String(effect.scaleEffectType||effect.effectType||effect.type||'');
  const exception=exceptionFor(palName);
  if(exception&&exception.patterns.some(pattern=>pattern.test(rawType))){
    return Object.freeze({
      stackingRule:'stack',stackable:true,stackingScope:'same_species',
      stackingSource:PARTNER_STACKING_SOURCE.exceptions.source,
      stackingEvidenceId:PARTNER_STACKING_SOURCE.exceptions.id,
      stackingConfidence:PARTNER_STACKING_SOURCE.exceptions.confidence
    });
  }

  const type=String(effect.type||'');
  if(['mount','glider','active_weapon','active_launcher','active_grenade','heal_player','revive_player','double_jump','movement_speed','player_attack_element_conversion','base_work_suitability_boost','farm_drop'].includes(type)){
    return Object.freeze({
      stackingRule:'uniquePartnerSkill',stackable:false,stackingScope:'same_species',
      stackingSource:'Palwerk activation semantics + Palworld 1.0 duplicate-species rule',
      stackingEvidenceId:'palwerk-unique-partner-activation',stackingConfidence:'high'
    });
  }

  if(/does not stack with similar skills/i.test(description)){
    return Object.freeze({
      stackingRule:'nonStacking',stackable:false,stackingScope:'similar_effect',
      stackingSource:'Partner Skill description',stackingEvidenceId:'partner-description-similar-skill-exclusion',stackingConfidence:'high'
    });
  }

  return Object.freeze({
    stackingRule:'highestOnly',stackable:false,stackingScope:'same_species',
    stackingSource:PARTNER_STACKING_SOURCE.defaultRule.source,
    stackingEvidenceId:PARTNER_STACKING_SOURCE.defaultRule.id,
    stackingConfidence:PARTNER_STACKING_SOURCE.defaultRule.confidence
  });
}
