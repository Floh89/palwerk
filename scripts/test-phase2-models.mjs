import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAL_CATALOG } from '../src/catalog.js';
import { optimizeTeam, ACTIVITY_MODELS, OPTIMIZER_API_VERSION } from '../src/optimizer/engine.js';
import { TOWER_PROFILES, RAID_PROFILES } from '../src/encounter-overrides.js';

const tests=[];
const test=(name,fn)=>{try{fn();tests.push({name,ok:true});console.log(`✓ ${name}`);}catch(error){tests.push({name,ok:false,error:error.message});console.error(`✗ ${name}: ${error.message}`);}};
const tower=TOWER_PROFILES.find(x=>x.difficulty==='Normal');
const raid=RAID_PROFILES[0];
const combatPals=PAL_CATALOG.filter(p=>p?.key&&p?.stats?.attack>0&&p?.skills?.length&&!p.flags?.towerBoss&&!p.flags?.raidBoss).slice(0,8);
const ownedCombat=combatPals.map((p,i)=>({uniqueId:`test-${i}`,catalogId:p.key,level:75,stars:0,ivs:{attack:0,hp:0,defense:0},souls:{attack:0,hp:0,defense:0}}));
const workPal=PAL_CATALOG.find(p=>Object.values(p.work||{}).some(v=>Number(v)>0));
const workType=workPal?Object.entries(workPal.work).find(([,v])=>Number(v)>0)?.[0]:null;

test('Engine veröffentlicht sechs getrennte Modellklassen',()=>assert.deepEqual(Object.keys(ACTIVITY_MODELS),['normal_team','tower','alpha_boss','raid','base','farm_loot','manual']));
test('API-Version bleibt auf konsolidierter Phase-3-Schnittstelle',()=>assert.match(OPTIMIZER_API_VERSION,/^3\./));
test('Normales Team verwendet immer das Single-Active-Modell',()=>{const r=optimizeTeam({activity:'normal_team',encounter:{name:'Test',elements:['Feuer']},ownedPals:ownedCombat,constraints:{ownedOnly:true}});assert.equal(r.model,'single-active-pal');assert.ok(['ok','insufficient-data'].includes(r.status));if(r.status==='ok'){assert.equal(r.teams[0].members.length,5);assert.equal(r.teams[0].members.filter(x=>x.estimatedDpsRange).length,1);}else{assert.match(r.reason,/In-Party|Fünferkombination|Skillrotation/);}});
test('Tower und Alpha verwenden keine Raid-Summenlogik',()=>{for(const activity of ['tower','alpha_boss']){const r=optimizeTeam({activity,encounter:tower,ownedPals:ownedCombat,constraints:{ownedOnly:true}});assert.equal(r.model,'single-active-pal');assert.ok(!('armies' in r));}});
test('Ausgegebene passive Partyplätze erhalten keinen eigenen Pal-DPS',()=>{const r=optimizeTeam({activity:'tower',encounter:tower,ownedPals:ownedCombat,constraints:{ownedOnly:true}});if(r.status!=='ok'){assert.equal(r.status,'insufficient-data');return;}for(const m of r.teams[0].members.slice(1)){assert.equal(m.relativeCombatValue,0);assert.equal(m.estimatedDpsRange,null);assert.equal(m.rotation.length,0);}});
test('Raid verweigert Berechnung ohne tatsächliches Basislimit',()=>{const r=optimizeTeam({activity:'raid',encounter:raid,ownedPals:ownedCombat});assert.equal(r.status,'insufficient-data');assert.equal(r.model,'multi-active-army');assert.match(r.reason,/Basislimit/);});
test('Raid verwendet konkrete Exemplare höchstens einmal',()=>{const r=optimizeTeam({activity:'raid',encounter:raid,ownedPals:ownedCombat,constraints:{baseLimit:3}});assert.equal(r.status,'ok');assert.equal(r.model,'multi-active-army');assert.equal(r.armies[0].deployed.length,3);const ids=[...r.armies[0].deployed,...r.armies[0].reserve].map(x=>x.instance.uniqueId);assert.equal(ids.length,new Set(ids).size);assert.equal(ids.length,ownedCombat.length);});
test('Raid und normales Team besitzen unterschiedliche Ergebnisverträge',()=>{const normal=optimizeTeam({activity:'normal_team',encounter:tower,ownedPals:ownedCombat,constraints:{ownedOnly:true}}),army=optimizeTeam({activity:'raid',encounter:raid,ownedPals:ownedCombat,constraints:{baseLimit:3}});assert.ok(!('armies'in normal));if(normal.status==='ok')assert.ok(Array.isArray(normal.teams));assert.ok(Array.isArray(army.armies));assert.ok(!('teams'in army));});
test('Basisarbeit verwendet Arbeitseignung statt Kampfscore',()=>{assert.ok(workPal&&workType,'Kein Arbeits-Pal im Katalog');const r=optimizeTeam({activity:'base',encounter:{workType},ownedPals:[{uniqueId:'worker-1',catalogId:workPal.key,stars:0}],constraints:{slots:1}});assert.equal(r.status,'ok');assert.equal(r.model,'base-assignment');assert.equal(r.assignments[0].pal.key,workPal.key);assert.ok(r.assignments[0].workLevel>0);assert.match(r.metric,/keine Produktionsrate/i);});
test('Farmmodell hat eigenen Vertrag und gibt keine erfundene Rate aus',()=>{const r=optimizeTeam({activity:'farm_loot',encounter:{target:'nicht-vorhandenes-testziel'},ownedPals:ownedCombat});assert.equal(r.model,'conditional-farm-team');assert.equal(r.status,'insufficient-data');assert.ok(!('estimatedDpsRange'in r));});
test('Manuelles Modell verlangt eine konkrete Aktivierungsart',()=>{const r=optimizeTeam({activity:'manual',encounter:{name:'Test'},ownedPals:ownedCombat});assert.equal(r.model,'manual-interaction');assert.equal(r.status,'insufficient-data');assert.match(r.reason,/Aktivierungsart/);});
test('Produktiver Einstieg bleibt bei genau einem main.js',()=>{const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const scripts=[...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x=>x[1]);assert.deepEqual(scripts,['src/main.js']);});
test('UI verwendet ausschließlich optimizeTeam',()=>{const ui=fs.readFileSync(new URL('../src/optimizer/ui.js',import.meta.url),'utf8');assert.match(ui,/optimizeTeam\(/);assert.ok(!ui.includes('optimizer-engine-v2'));assert.ok(!ui.includes('optimizer-composer-v3'));});

const failed=tests.filter(x=>!x.ok);console.log(`\n${tests.length-failed.length}/${tests.length} Phase-2-Tests bestanden.`);if(failed.length){console.error(JSON.stringify(failed,null,2));process.exit(1);}
