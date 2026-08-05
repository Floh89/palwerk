import assert from 'node:assert/strict';
import fs from 'node:fs';
import { optimizeTeam, OPTIMIZER_API_VERSION } from '../src/optimizer/engine.js';

const tests=[];
const test=(name,fn)=>{try{fn();tests.push({name,ok:true});console.log(`✓ ${name}`);}catch(error){tests.push({name,ok:false,error:error.message});console.error(`✗ ${name}: ${error.message}`);}};
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../src/optimizer/engine.js',import.meta.url),'utf8');
const oldModules=['team-optimizer.js','optimizer-engine-v2.js','optimizer-composer-v3.js','optimizer-v2-ui.js','optimizer-v2-tests.js','combat-build-verifier.js','boss-selector-fix.js','boss-raid-selector-v2.js'];

test('index.html lädt genau einen JavaScript-Einstieg',()=>{const scripts=[...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x=>x[1]);assert.deepEqual(scripts,['src/main.js']);});
test('main.js lädt keine alte Optimierungsengine',()=>{for(const module of oldModules)assert.ok(!main.includes(module),`${module} ist produktiv eingebunden`);});
test('Produktiver Einstieg lädt keine Testdatei',()=>{assert.ok(!/test/i.test(main));assert.ok(!/test/i.test(index));});
test('Zentrale Engine exportiert die geforderte Schnittstelle',()=>{assert.equal(typeof optimizeTeam,'function');assert.match(engine,/export function optimizeTeam/);for(const key of ['activity','encounter','playerState','ownedPals','constraints','optimizationGoal'])assert.match(engine,new RegExp(key));assert.match(OPTIMIZER_API_VERSION,/^3\./);});
test('Fehlende Pflichtparameter werden nicht stillschweigend akzeptiert',()=>{assert.throws(()=>optimizeTeam({}),/activity is required/);assert.throws(()=>optimizeTeam({activity:'tower'}),/encounter is required/);});
test('Alte Engines sind nicht aus dem Produktpfad importiert',()=>{for(const module of oldModules)assert.ok(!engine.includes(module));});

const failed=tests.filter(x=>!x.ok);console.log(`\n${tests.length-failed.length}/${tests.length} Phase-1-Architekturtests bestanden.`);if(failed.length){console.error(JSON.stringify(failed,null,2));process.exit(1);}
