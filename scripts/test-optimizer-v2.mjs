import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAL_CATALOG } from '../src/catalog.js';
import {
  encounterOptions,
  combatStats,
  buildRotation,
  simulateBattle,
  optimizeRaidArmy,
  recommendPassives,
  requiredDps,
  DEFAULT_PLAYER,
  DEFAULT_PAL_PROFILE
} from '../src/optimizer-engine-v2.js';

const tests=[];
const test=(name,fn)=>{try{fn();tests.push({name,ok:true});console.log(`✓ ${name}`);}catch(error){tests.push({name,ok:false,error:error.message});console.error(`✗ ${name}: ${error.message}`);}};

const raids=encounterOptions('raid');
const normalTowers=encounterOptions('tower','Normal');
const hardTowers=encounterOptions('tower','Schwer');
const samplePal=PAL_CATALOG.find(p=>p?.stats?.attack>0&&(p.skills||[]).length>1);

// Auswahl und Encounter-Daten
test('Raid-Auswahl enthält alle verifizierten Profile',()=>assert.ok(raids.length>=11,`nur ${raids.length} Raids`));
test('Tower-Auswahl enthält fünf Normal-Bosse',()=>assert.equal(normalTowers.length,5));
test('Tower-Auswahl enthält fünf Hard-Bosse',()=>assert.equal(hardTowers.length,5));
test('Normal und Schwer liefern unterschiedliche Profile',()=>assert.notDeepEqual(normalTowers.map(x=>x.id),hardTowers.map(x=>x.id)));
test('Alle Encounter-IDs sind eindeutig',()=>{const ids=[...raids,...normalTowers,...hardTowers].map(x=>x.id);assert.equal(ids.length,new Set(ids).size);});
test('Jeder auswählbare Encounter hat HP, Level und Zeitlimit',()=>{for(const e of [...raids,...normalTowers,...hardTowers]){assert.ok(e.hp>0,`${e.id}: HP`);assert.ok(e.level>0,`${e.id}: Level`);assert.ok(e.timeLimit>0,`${e.id}: Zeitlimit`);}});
test('Schwerer Tower hat mehr HP als Normal',()=>{for(const normal of normalTowers){const hard=hardTowers.find(x=>x.name===normal.name);assert.ok(hard,`${normal.name}: Hard fehlt`);assert.ok(hard.hp>normal.hp,`${normal.name}: Hard-HP nicht höher`);}});

// Pal-Profil und Kampfwerte
test('Test-Pal besitzt angereicherte Werte und Skills',()=>{assert.ok(samplePal);assert.ok(samplePal.stats.attack>0);assert.ok(samplePal.skills.length>1);});
test('Kampfwerte steigen durch Level, IVs, Seelen und Passives',()=>{
  const low=combatStats(samplePal,{...DEFAULT_PAL_PROFILE,level:20,ivs:{hp:0,attack:0,defense:0},souls:{hp:0,attack:0,defense:0},passives:[]});
  const high=combatStats(samplePal,{...DEFAULT_PAL_PROFILE,level:75,ivs:{hp:100,attack:100,defense:100},souls:{hp:10,attack:10,defense:10},passives:['Demon God','Legend']});
  assert.ok(high.attack>low.attack);assert.ok(high.hp>low.hp);assert.ok(high.defense>low.defense);
});
test('Rotation enthält höchstens drei eindeutige Skills',()=>{const r=buildRotation(samplePal,DEFAULT_PAL_PROFILE,raids[0]);assert.ok(r.length>0&&r.length<=3);assert.equal(r.length,new Set(r.map(x=>x.s.id)).size);});
test('Aktive Skill-Auswahl wird respektiert',()=>{const chosen=samplePal.skills[0].id;const profile={...DEFAULT_PAL_PROFILE,activeSkillIds:[chosen]};const r=buildRotation(samplePal,profile,raids[0]);assert.ok(r.length<=1);assert.ok(r.every(x=>x.s.id===chosen));});
test('Passivempfehlung liefert vier Plätze',()=>assert.equal(recommendPassives('damage',raids[0].elements).length,4));
test('Spieler-Support empfiehlt Vanguard und Stronghold',()=>{const p=recommendPassives('player',raids[0].elements);assert.ok(p.includes('Vanguard'));assert.ok(p.includes('Stronghold Strategist'));});

// Simulation und Armee
test('DPS-Anforderung entspricht HP geteilt durch Zeit',()=>{const e=raids[0],r=requiredDps(e,0.25);assert.equal(r.minimum,e.hp/e.timeLimit);assert.equal(r.target,r.minimum*1.25);});
test('Simulation lehnt Encounter ohne HP ab',()=>assert.equal(simulateBattle({encounter:{hp:null},members:[]}).ready,false));
test('Simulation liefert konsistente Sieg-/Rest-HP-Werte',()=>{const e=normalTowers[0];const members=[{pal:samplePal,profile:DEFAULT_PAL_PROFILE}];const s=simulateBattle({encounter:e,members,player:{...DEFAULT_PLAYER,weaponDps:5000}});assert.equal(s.ready,true);assert.ok(s.totalDps>=s.playerDps);assert.equal(s.win,s.remainingHp===0);});
test('Raid-Armee respektiert gewünschte Größe',()=>{for(const slots of [5,20,50]){const r=optimizeRaidArmy({encounter:raids[0],maxSlots:slots});assert.equal(r.army.length,slots);assert.equal(r.waves.flat().length,slots);}});
test('Bestandsmodus verwendet nur erlaubte kampffähige Pals',()=>{const owned=PAL_CATALOG.filter(p=>p.skills?.length&&p.stats?.attack>0).slice(0,3).map(p=>p.key);const r=optimizeRaidArmy({encounter:raids[0],maxSlots:12,ownedOnly:true,ownedIds:owned});assert.ok(r.army.length>0);assert.ok(r.army.every(x=>owned.includes(x.pal.key)));});
test('Leerer Bestand erzeugt keine erfundene Armee',()=>{const r=optimizeRaidArmy({encounter:raids[0],maxSlots:10,ownedOnly:true,ownedIds:[]});assert.equal(r.army.length,0);});
test('Gegner mit unterschiedlichen Elementen verändern Rotation oder Rangfolge',()=>{const fire=normalTowers.find(x=>x.elements.includes('Feuer'));const dark=normalTowers.find(x=>x.elements.includes('Schatten'));const a=optimizeRaidArmy({encounter:fire,maxSlots:5});const b=optimizeRaidArmy({encounter:dark,maxSlots:5});const sig=x=>x.army.map(m=>`${m.pal.key}:${m.rotation.map(s=>s.name).join('|')}`).join(',');assert.notEqual(sig(a),sig(b));});

// UI-Verkabelung als statischer Smoke-Test
const selectorSource=fs.readFileSync(new URL('../src/boss-raid-selector-v2.js',import.meta.url),'utf8');
const hubSource=fs.readFileSync(new URL('../src/optimizer-hub.js',import.meta.url),'utf8');
const indexSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('Boss- und Raid-Karten besitzen feste Cluster-Attribute',()=>{assert.match(hubSource,/data-cluster="\$\{c\.id\}"/);assert.match(hubSource,/id:'boss'/);assert.match(hubSource,/id:'raid'/);});
test('Capture-Handler fängt Boss und Raid vor altem Handler ab',()=>{assert.match(selectorSource,/addEventListener\('click',[\s\S]*,true\)/);assert.match(selectorSource,/stopImmediatePropagation/);});
test('Selektor-Modul wird nach Optimizer-Modulen geladen',()=>{const hub=indexSource.indexOf('optimizer-hub.js');const selector=indexSource.indexOf('boss-raid-selector-v2.js');assert.ok(hub>=0&&selector>hub);});
test('Boss-Selektor enthält echte Encounter-Auswahl',()=>{assert.match(selectorSource,/name="encounter"/);assert.match(selectorSource,/encounterOptions\(type,difficulty\)/);});

const failed=tests.filter(x=>!x.ok);
console.log(`\n${tests.length-failed.length}/${tests.length} Optimizer-Tests bestanden.`);
if(failed.length){console.error(JSON.stringify(failed,null,2));process.exit(1);}
