import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeTeamSynergy, SYNERGY_MODEL_VERSION } from '../src/optimizer/synergy.js';

const tests=[];
const test=(name,fn)=>{try{fn();tests.push({name,ok:true});console.log(`✓ ${name}`);}catch(error){tests.push({name,ok:false,error:error.message});console.error(`✗ ${name}: ${error.message}`);}};
const carry={pal:{key:'carry',name:'Carry',element:'Feuer'}};
const effect=(type,extra={})=>({type,activation:'in_party',stackingGroup:`${type}:Feuer`,stackable:false,element:'Feuer',valuesByRank:null,status:'provisional',confidence:'low',...extra});

test('Synergiemodell veröffentlicht eine Version',()=>assert.equal(SYNERGY_MODEL_VERSION,'1.0.0'));
test('Fehlende Rollen werden ausdrücklich ausgewiesen',()=>{const result=analyzeTeamSynergy([carry],carry);assert.ok(result.gaps.includes('Pal-Schaden'));assert.ok(result.gaps.includes('Sustain'));});
test('Passende Effekte werden der richtigen Dimension zugeordnet',()=>{const support={pal:{key:'s',name:'Support',partner:{name:'Buff'}},appliedEffects:[effect('pal_element_attack')],suppressedEffects:[]};const result=analyzeTeamSynergy([carry,support],carry);assert.equal(result.dimensions.damage.memberCount,1);assert.equal(result.dimensions.damage.state,'provisional');});
test('Bestätigte Evidenz erhöht die Vertrauensquote',()=>{const support={pal:{key:'s',name:'Support',partner:{name:'Buff'}},appliedEffects:[effect('pal_element_attack',{status:'verified',confidence:'high'})],suppressedEffects:[]};const result=analyzeTeamSynergy([carry,support],carry);assert.equal(result.confidence,1);});
test('Stacking-Kollisionen werden sichtbar',()=>{const result=analyzeTeamSynergy([carry],carry,{applied:[{group:'x'}],suppressed:[{group:'x'},{group:'x'}]});assert.equal(result.collisions[0].suppressedCount,2);});
test('Synergie-UI kennzeichnet Diagnose statt garantierter DPS',()=>{const source=fs.readFileSync(new URL('../src/optimizer/synergy-ui.js',import.meta.url),'utf8');assert.match(source,/strukturelle Synergie-Diagnose/);assert.match(source,/Fehlende Rangwerte werden nicht geschätzt/);});

const failed=tests.filter(item=>!item.ok);console.log(`\n${tests.length-failed.length}/${tests.length} Phase-4-Tests bestanden.`);if(failed.length){console.error(JSON.stringify(failed,null,2));process.exit(1);}
