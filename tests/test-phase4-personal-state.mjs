import assert from 'node:assert/strict';
import { migrateState, normalizeOwnedPal, STATE_SCHEMA_VERSION, validatePersonalState } from '../src/state-schema.js';

const legacy={
  schemaVersion:5,
  profile:{playerLevel:'70',world:'Main',goal:'Bellanoir',goalType:'raid'},
  pals:[{catalogId:'orserk',name:'Orserk',level:'65',stars:4,passives:['Legend'],activeSkillIds:['SkillA'],ivs:{attack:88},souls:{attack:10},saddleOwned:true,notes:'Main'}],
  equipment:[{id:'rocket-launcher',level:4}],
  materials:[{id:'chromite',amount:42}],
  bases:[{id:'base-1'}],
  teamPlans:[{id:'team-1'}]
};

const migrated=migrateState(legacy,{});
assert.equal(migrated.schemaVersion,STATE_SCHEMA_VERSION);
assert.equal(migrated.player.level,'70');
assert.equal(migrated.player.world,'Main');
assert.equal(migrated.player.weapons.length,1);
assert.equal(migrated.progress.materials.chromite.amount,42);
assert.equal(migrated.progress.bases.length,1);
assert.equal(migrated.teamPlans.length,1);
assert.equal(migrated.pals.length,1);
assert.ok(migrated.pals[0].uniqueId);
assert.equal(migrated.pals[0].catalogId,'orserk');
assert.deepEqual(migrated.pals[0].activeSkills,['SkillA']);
assert.equal(migrated.pals[0].ivs.attack,88);
assert.equal(migrated.pals[0].souls.attack,10);
assert.equal(migrated.pals[0].saddleOwned,true);
assert.equal(validatePersonalState(migrated).length,0);

const first=normalizeOwnedPal({catalogId:'orserk',name:'Orserk'});
const second=normalizeOwnedPal({catalogId:'orserk',name:'Orserk'});
assert.notEqual(first.uniqueId,second.uniqueId,'Mehrere Exemplare desselben Pals brauchen unterschiedliche IDs');

const roundTrip=migrateState(migrated,{});
assert.equal(roundTrip.pals[0].uniqueId,migrated.pals[0].uniqueId,'Erneute Migration darf uniqueId nicht ändern');
assert.equal(roundTrip.migration,null,'Bereits aktueller Zustand darf keine neue Migration vortäuschen');

for(const key of ['level','weapons','weaponLevel','armor','shields','accessories','food','statusPoints'])assert.ok(key in migrated.player,`player.${key}`);
for(const key of ['bosses','raids','towers','technologies','map','materials','bases'])assert.ok(key in migrated.progress,`progress.${key}`);
for(const key of ['uniqueId','catalogId','name','level','stars','alpha','lucky','gender','passives','activeSkills','ivs','souls','implants','trust','saddleOwned','favorite','role','notes'])assert.ok(key in migrated.pals[0],`pal.${key}`);

console.log('Phase-4-Personal-State-Tests bestanden.');
