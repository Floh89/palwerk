import { PAL_CATALOG } from './catalog.js';
import { encounterOptions, combatStats, buildRotation, simulateBattle, optimizeRaidArmy, recommendPassives } from './optimizer-engine-v2.js';

const tests=[];
const test=(name,fn)=>{try{fn();tests.push({name,ok:true});}catch(error){tests.push({name,ok:false,error:String(error?.message||error)});}};
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

const raids=encounterOptions('raid');
const towers=encounterOptions('tower','Normal');
const pal=PAL_CATALOG.find(p=>(p.skills||[]).length&&p.stats?.attack)||PAL_CATALOG[0];

test('Raid-Auswahl vorhanden',()=>assert(raids.length>=5,`Nur ${raids.length} Raids`));
test('Tower-Auswahl vorhanden',()=>assert(towers.length>=5,`Nur ${towers.length} Tower`));
test('Encounter-IDs eindeutig',()=>{const ids=[...raids,...towers].map(x=>x.id);assert(new Set(ids).size===ids.length,'Doppelte Encounter-ID')});
test('Kampfwerte positiv',()=>{const s=combatStats(pal,{level:75,stars:0,ivs:{hp:0,attack:0,defense:0},souls:{hp:0,attack:0,defense:0},passives:[]});assert(s.attack>=0&&s.hp>=0&&s.defense>=0,'Negative Kampfwerte')});
test('Rotation maximal drei Skills',()=>assert(buildRotation(pal,{level:75},raids[0]).length<=3,'Mehr als drei Skills'));
test('Simulation erkennt fehlende HP',()=>assert(simulateBattle({encounter:{hp:null},members:[]}).ready===false,'Fehlende HP akzeptiert'));
test('Raid-Armee respektiert Slots',()=>{const r=optimizeRaidArmy({encounter:raids[0],maxSlots:10});assert(r.army.length===10,`Armee ${r.army.length}`)});
test('Passivprofil hat vier Plätze',()=>assert(recommendPassives('damage',raids[0].elements).length===4,'Passivzahl falsch'));

window.PALWERK_OPTIMIZER_TESTS={version:'2.0.0',passed:tests.filter(x=>x.ok).length,failed:tests.filter(x=>!x.ok).length,tests};
if(tests.some(x=>!x.ok))console.error('PALWERK Optimizer V2 tests failed',tests.filter(x=>!x.ok));else console.info('PALWERK Optimizer V2 tests passed',tests.length);
