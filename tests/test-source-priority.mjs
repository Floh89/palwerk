import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FIELD_SOURCE_PRIORITY, SOURCE_PRIORITY_VERSION, mergePalRecordsByPriority, sourceRank } from '../src/data/source-priority.js';

assert.equal(SOURCE_PRIORITY_VERSION,'1.1.0');
assert.deepEqual(FIELD_SOURCE_PRIORITY.stats,['game_dump','wiki','legacy']);
assert.deepEqual(FIELD_SOURCE_PRIORITY.germanName,['official_localization','wiki','fallback','legacy']);
assert.ok(sourceRank('stats','game_dump')<sourceRank('stats','wiki'));
assert.ok(sourceRank('stats','wiki')<sourceRank('stats','legacy'));
assert.ok(sourceRank('partnerRankValues','wiki_cargo')<sourceRank('partnerRankValues','legacy'));

const game={
  key:'game-pal',internalId:'TestPal',paldeck:'042',name:'Offizieller Name',description:'Offizielle Beschreibung',element:'Elektro',
  stats:{hp:100,attack:120,defense:90},work:{generating:2},movement:{run:500},
  skills:[{id:'NewSkill',level:20}],fixedPassives:[{id:'CurrentPassive'}],
  partner:{name:'Game Semantic',description:'Game semantics description',effects:[{id:'game-effect',type:'raw_partner_data'}]},
  source:'game-dump-1.0',translationStatus:'de-official',languageStatus:'de-confirmed',
  fieldSources:{stats:'game_dump',elements:'game_dump',activeSkills:'game_dump',fixedPassives:'game_dump',work:'game_dump',movement:'game_dump',paldeck:'game_dump',germanName:'official_localization',description:'official_localization',partnerDescription:'game_semantics',partnerEffects:'game_semantics'}
};
const legacyRich={
  key:'legacy-pal',internalId:'TestPal',paldeck:'999',name:'Alter Wiki Name',description:'Alter Wiki Text',element:'Wasser',
  stats:{hp:999,attack:999,defense:999},work:{generating:8,mining:8,transporting:8},movement:{run:9999},
  skills:[{id:'OldSkillA'},{id:'OldSkillB'},{id:'OldSkillC'}],fixedPassives:[{id:'OldPassiveA'},{id:'OldPassiveB'}],
  drops:[{id:'legacy-drop'}],
  partner:{name:'Wiki Partner Name',description:'Aktuelle Wiki-Partnerbeschreibung',effects:[{id:'wiki-effect',type:'pal_element_attack'}]},
  source:'wiki-1.0',fieldSources:{stats:'wiki',elements:'wiki',activeSkills:'wiki',fixedPassives:'wiki',work:'wiki',movement:'wiki',paldeck:'wiki',germanName:'wiki',description:'wiki',partnerDescription:'wiki',partnerEffects:'wiki'}
};
const merged=mergePalRecordsByPriority(game,legacyRich);
assert.deepEqual(merged.stats,game.stats,'Game-Dump-Stats müssen einen reicheren Wiki/Legacy-Datensatz schlagen');
assert.equal(merged.element,'Elektro');
assert.equal(merged.paldeck,'042');
assert.equal(merged.name,'Offizieller Name');
assert.equal(merged.description,'Offizielle Beschreibung');
assert.deepEqual(merged.skills,game.skills,'Niedrig priorisierte alte Skills dürfen keine aktuelle Game-Dump-Liste erweitern');
assert.deepEqual(merged.fixedPassives,game.fixedPassives,'Niedrig priorisierte Passives dürfen keine aktuelle Game-Dump-Liste erweitern');
assert.equal(merged.partner.description,'Aktuelle Wiki-Partnerbeschreibung','Wiki-Partnerbeschreibung muss Game-Semantik überstimmen');
assert.deepEqual(merged.partner.effects,legacyRich.partner.effects,'Wiki-Partnerwirkung muss Game-Semantik überstimmen');
assert.equal(merged.drops[0].id,'legacy-drop','Nicht konkurrierende fehlende Felder dürfen ergänzt werden');
assert.equal(merged.fieldSources.stats,'game_dump');
assert.equal(merged.fieldSources.partnerDescription,'wiki');

const gameMissingSkills={...game,skills:[],fieldSources:{...game.fieldSources,activeSkills:'game_dump'}};
const fallbackSkills=mergePalRecordsByPriority(gameMissingSkills,legacyRich);
assert.deepEqual(fallbackSkills.skills,legacyRich.skills,'Niedrigere Quelle darf nur bei leerem höher priorisiertem Feld füllen');

const build=fs.readFileSync(new URL('../scripts/build-core-data.mjs',import.meta.url),'utf8');
assert.ok(!/function richness\s*\(/.test(build),'Core-Generator darf nicht mehr per Richness mergen');
assert.ok(!/const score=row=>/.test(build),'Generated Runtime darf keinen Richness-Score mehr enthalten');
assert.match(build,/mergePalRecordsByPriority/);

console.log('Phase-3-Source-Priority-Tests bestanden.');
