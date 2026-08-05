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
const samplePal=PAL_CATALOG.find(p=>p?.stats?.attack>0&&(p.skills||[]).length>1&&buildRotation(p,DEFAULT_PAL_PROFILE,raids[0]).length>0);

test('Raid-Auswahl enthält alle verifizierten Profile',()=>assert.ok(raids.length>=11));
test('Tower-Auswahl enthält fünf Normal-Bosse',()=>assert.equal(normalTowers.length,5));
test('Tower-Auswahl enthält fünf Hard-Bosse',()=>assert.equal(hardTowers.length,5));
test('Normal und Schwer liefern unterschiedliche Profile',()=>assert.notDeepEqual(normalTowers.map(x=>x.id),hardTowers.map(x=>x.id)));
test('Alle Encounter-IDs sind eindeutig',()=>{const ids=[...raids,...normalTowers,...hardTowers].map(x=>x.id);assert.equal(ids.length,new Set(ids).size);});
test('Jeder auswählbare Encounter hat HP, Level und Zeitlimit',()=>{for(const e of [...raids,...normalTowers,...hardTowers]){assert.ok(e.hp>0);assert.ok(e.level>0);assert.ok(e.timeLimit>0);}});
test('Schwerer Tower hat mehr HP als Normal',()=>{for(const normal of normalTowers){const hard=hardTowers.find(x=>x.name===normal.name);assert.ok(hard);assert.ok(hard.hp>normal.hp);}});
test('Test-Pal besitzt angereicherte Werte und Skills',()=>{assert.ok(samplePal);assert.ok(samplePal.stats.attack>0);assert.ok(samplePal.skills.length>1);});
test('Kampfwerte steigen durch Level, IVs, Seelen und Passives',()=>{const low=combatStats(samplePal,{...DEFAULT_PAL_PROFILE,level:20,ivs:{hp:0,attack:0,defense:0},souls:{hp:0,attack:0,defense:0},passives:[]});const high=combatStats(samplePal,{...DEFAULT_PAL_PROFILE,level:75,ivs:{hp:100,attack:100,defense:100},souls:{hp:10,attack:10,defense:10},passives:['Demon God','Legend']});assert.ok(high.attack>low.attack);assert.ok(high.hp>low.hp);assert.ok(high.defense>low.defense);});
test('Rotation enthält höchstens drei eindeutige Skills',()=>{const r=buildRotation(samplePal,DEFAULT_PAL_PROFILE,raids[0]);assert.ok(r.length>0&&r.length<=3);assert.equal(r.length,new Set(r.map(x=>x.s.id)).size);});
test('Aktive Skill-Auswahl wird respektiert',()=>{const chosen=samplePal.skills.find(s=>buildRotation({...samplePal,skills:[s]},DEFAULT_PAL_PROFILE,raids[0]).length)?.id;if(!chosen)return;const r=buildRotation(samplePal,{...DEFAULT_PAL_PROFILE,activeSkillIds:[chosen]},raids[0]);assert.ok(r.every(x=>x.s.id===chosen));});
test('Passivempfehlung liefert vier Plätze',()=>assert.equal(recommendPassives('damage',raids[0].elements).length,4));
test('Spieler-Support empfiehlt Vanguard und Stronghold',()=>{const p=recommendPassives('player',raids[0].elements);assert.ok(p.includes('Vanguard'));assert.ok(p.includes('Stronghold Strategist'));});
test('DPS-Anforderung entspricht HP geteilt durch Zeit',()=>{const e=raids[0],r=requiredDps(e,0.25);assert.equal(r.minimum,e.hp/e.timeLimit);assert.equal(r.target,r.minimum*1.25);});
test('Simulation lehnt Encounter ohne HP ab',()=>assert.equal(simulateBattle({encounter:{hp:null},members:[]}).ready,false));
test('Simulation liefert konsistente Sieg-/Rest-HP-Werte',()=>{const s=simulateBattle({encounter:normalTowers[0],members:[{pal:samplePal,profile:DEFAULT_PAL_PROFILE}],player:{...DEFAULT_PLAYER,weaponDps:5000}});assert.equal(s.ready,true);assert.equal(s.win,s.remainingHp===0);});
test('Raid-Armee respektiert gewünschte Größe',()=>{for(const slots of [5,20,50])assert.equal(optimizeRaidArmy({encounter:raids[0],maxSlots:slots}).army.length,slots);});
test('Bestandsmodus verwendet nur erlaubte kampffähige Pals',()=>{const owned=PAL_CATALOG.filter(p=>p.skills?.length&&p.stats?.attack>0).slice(0,3).map(p=>p.key);const r=optimizeRaidArmy({encounter:raids[0],maxSlots:12,ownedOnly:true,ownedIds:owned});assert.ok(r.army.length>0);assert.ok(r.army.every(x=>owned.includes(x.pal.key)));});
test('Leerer Bestand erzeugt keine erfundene Armee',()=>assert.equal(optimizeRaidArmy({encounter:raids[0],maxSlots:10,ownedOnly:true,ownedIds:[]}).army.length,0));
test('Gegner mit unterschiedlichen Elementen verändern Rotation oder Rangfolge',()=>{const a=optimizeRaidArmy({encounter:{...raids[0],elements:['Feuer']},maxSlots:5});const b=optimizeRaidArmy({encounter:{...raids[0],elements:['Schatten']},maxSlots:5});const sig=x=>x.army.map(m=>`${m.pal.key}:${m.rotation.map(s=>s.name).join('|')}`).join(',');assert.notEqual(sig(a),sig(b));});

const composer=fs.readFileSync(new URL('../src/optimizer-composer-v3.js',import.meta.url),'utf8');
const hub=fs.readFileSync(new URL('../src/optimizer-hub.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('Boss- und Raid-Karten besitzen feste Cluster-Attribute',()=>{assert.match(hub,/data-cluster="\$\{c\.id\}"/);assert.match(hub,/id:'boss'/);assert.match(hub,/id:'raid'/);});
test('V3 fängt Boss und Raid vor dem alten Handler ab',()=>{assert.match(composer,/addEventListener\('click',[\s\S]*,true\)/);assert.match(composer,/stopImmediatePropagation/);});
test('Nur der V3-Selektor ist aktiv eingebunden',()=>{assert.ok(index.includes('optimizer-composer-v3.js'));assert.ok(!index.includes('boss-raid-selector-v2.js'));assert.ok(!index.includes('boss-selector-fix.js'));});
test('V3 enthält echte Encounter-Auswahl',()=>{assert.match(composer,/name="encounter"/);assert.match(composer,/encounterOptions\(type,difficulty\)/);});
test('V3 baut fünf Teamrollen',()=>{for(const role of ['Main Carry','Schadens-Buff','Cooldown','Spieler-Buff','Überleben'])assert.ok(composer.includes(role));});
test('V3 filtert technische und nicht fangbare Sonderformen',()=>{assert.match(composer,/capture_rate_correct===0/);assert.match(composer,/towerBoss\|\|p\.flags\?\.raidBoss/);assert.match(composer,/astralym/);});
test('V3 zeigt Synergie und Begründungen',()=>{assert.match(composer,/Synergieübersicht/);assert.match(composer,/Warum dieses Team/);assert.match(composer,/x\.reason/);});

const failed=tests.filter(x=>!x.ok);
console.log(`\n${tests.length-failed.length}/${tests.length} Optimizer-Tests bestanden.`);
if(failed.length){console.error(JSON.stringify(failed,null,2));process.exit(1);}
