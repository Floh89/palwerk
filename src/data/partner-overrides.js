// Verified exceptions for partner skills that are documented on current wiki pages
// but absent from the structured Module:PartnerSkills dataset consumed by CI.
// These records must never be inferred. Each entry needs an explicit source and verification metadata.

export const PARTNER_OVERRIDES_VERSION='1.0.0';

export const PARTNER_OVERRIDES=Object.freeze([
  Object.freeze({
    palId:'menasting-terra',
    palName:'Menasting Terra',
    paldeck:'099B',
    skillName:'Steel Scorpion',
    description:"While fighting together, increases the player's defense and Electric Pals drop more items when defeated.",
    source:'https://palworld.wiki.gg/wiki/Menasting_Terra',
    gameVersion:'1.0',
    verifiedAt:'2026-08-07',
    confidence:'high',
    status:'verified',
    effects:Object.freeze([
      Object.freeze({
        type:'player_defense',activation:'in_party',requiresEquipment:false,equipmentId:null,
        target:'player',element:null,valuesByRank:Object.freeze([7,8,10,12,14]),
        stackingRule:'conditional',stackingGroup:'player_defense:player',stackable:null,
        appliesTo:Object.freeze(['player']),conditions:Object.freeze([]),
        source:'https://palworld.wiki.gg/wiki/Menasting_Terra',gameVersion:'1.0',verifiedAt:'2026-08-07',confidence:'high',status:'verified'
      }),
      Object.freeze({
        type:'pal_drop_bonus',activation:'pal_defeats_target',requiresEquipment:false,equipmentId:null,
        target:'Elektro',element:'Elektro',valuesByRank:Object.freeze([40,50,60,70,80]),
        stackingRule:'conditional',stackingGroup:'pal_drop_bonus:Elektro',stackable:null,
        appliesTo:Object.freeze(['loot']),conditions:Object.freeze(['target_element:Elektro']),
        source:'https://palworld.wiki.gg/wiki/Menasting_Terra',gameVersion:'1.0',verifiedAt:'2026-08-07',confidence:'high',status:'verified'
      })
    ])
  })
]);
