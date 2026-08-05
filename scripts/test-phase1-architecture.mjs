import assert from 'node:assert/strict';
import fs from 'node:fs';
import { optimizeTeam, OPTIMIZER_API_VERSION } from '../src/optimizer/engine.js';
import { TOWER_PROFILES, RAID_PROFILES } from '../src/encounter-overrides.js';

const tests = [];
const test = (name, fn) => {
  try {
    fn();
    tests.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    tests.push({ name, ok: false, error: error.message });
    console.error(`✗ ${name}: ${error.message}`);
  }
};

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../src/optimizer/engine.js', import.meta.url), 'utf8');

const oldProductiveModules = [
  'team-optimizer.js',
  'optimizer-engine-v2.js',
  'optimizer-composer-v3.js',
  'optimizer-v2-ui.js',
  'optimizer-v2-tests.js',
  'combat-build-verifier.js',
  'boss-selector-fix.js',
  'boss-raid-selector-v2.js'
];

test('index.html lädt genau einen JavaScript-Einstieg', () => {
  const scripts = [...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(scripts, ['src/main.js']);
});

test('main.js lädt keine alte Optimierungsengine', () => {
  for (const module of oldProductiveModules) assert.ok(!main.includes(module), `${module} ist noch produktiv eingebunden`);
});

test('Produktiver Einstieg lädt keine Testdatei', () => {
  assert.ok(!/test/i.test(main));
  assert.ok(!/test/i.test(index));
});

test('Zentrale Engine exportiert die geforderte Schnittstelle', () => {
  assert.equal(typeof optimizeTeam, 'function');
  assert.match(engine, /export function optimizeTeam/);
  assert.match(engine, /activity/);
  assert.match(engine, /encounter/);
  assert.match(engine, /playerState/);
  assert.match(engine, /ownedPals/);
  assert.match(engine, /constraints/);
  assert.match(engine, /optimizationGoal/);
  assert.equal(OPTIMIZER_API_VERSION, '1.0.0');
});

test('Fehlende Pflichtparameter werden nicht stillschweigend akzeptiert', () => {
  assert.throws(() => optimizeTeam({}), /activity is required/);
  assert.throws(() => optimizeTeam({ activity: 'tower' }), /encounter is required/);
});

test('Tower-Modell liefert höchstens einen aktiven Pal-DPS-Träger', () => {
  const encounter = TOWER_PROFILES.find(item => item.difficulty === 'Normal');
  const result = optimizeTeam({ activity: 'tower', encounter, playerState: {}, ownedPals: [] });
  assert.equal(result.status, 'ok');
  const team = result.teams[0];
  assert.equal(team.members.length, 5);
  assert.equal(team.members.filter(member => member.estimatedDpsRange).length, 1);
  assert.equal(team.members[0].role, 'Aktiver Haupt-Pal');
});

test('Support-Pals erhalten keinen erfundenen eigenen DPS', () => {
  const encounter = TOWER_PROFILES.find(item => item.difficulty === 'Normal');
  const result = optimizeTeam({ activity: 'tower', encounter, playerState: {}, ownedPals: [] });
  for (const member of result.teams[0].members.slice(1)) {
    assert.equal(member.estimatedDpsRange, null);
    assert.equal(member.relativeCombatValue, 0);
  }
});

test('Raid verwendet nicht die normale Fünferteam-Summenlogik', () => {
  const result = optimizeTeam({ activity: 'raid', encounter: RAID_PROFILES[0], playerState: {}, ownedPals: [] });
  assert.equal(result.status, 'unsupported');
  assert.equal(result.model, 'raid-pending');
  assert.deepEqual(result.teams, []);
});

test('Modell-DPS wird nur als Bereich mit Annahmen ausgegeben', () => {
  const encounter = TOWER_PROFILES.find(item => item.difficulty === 'Normal');
  const result = optimizeTeam({ activity: 'tower', encounter, playerState: {}, ownedPals: [] });
  const team = result.teams[0];
  assert.ok(team.estimatedActivePalDpsRange.low < team.estimatedActivePalDpsRange.high);
  assert.ok(team.assumptions.some(item => /Keine sekundengenaue Schadensgarantie/.test(item)));
  assert.equal(team.dataQuality, 'modelled');
});

const failed = tests.filter(item => !item.ok);
console.log(`\n${tests.length - failed.length}/${tests.length} Phase-1-Tests bestanden.`);
if (failed.length) {
  console.error(JSON.stringify(failed, null, 2));
  process.exit(1);
}
