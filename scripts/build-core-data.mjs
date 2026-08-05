import fs from 'node:fs';

const read=name=>JSON.parse(fs.readFileSync(`data/upstream/${name}`,'utf8'));
const names=read('pal-names.json');
const types=read('pal-types.json');
const moves=read('pal-moves.json');
const passives=read('pal-passives.json');
const fullPals=read('pals-full.json');
const fullActive=read('active-skills-full.json');
const fullPassive=read('passive-skills-full.json');
const bosses=read('bosses.json');
const dePals=read('pals-de.json');
const deActive=read('active-skills-de.json');
const dePassive=read('passive-skills-de.json');

const deElement={Neutral:'Neutral',Fire:'Feuer',Water:'Wasser',Grass:'Gras',Electric:'Elektro',Ice:'Eis',Ground:'Erde',Dark:'Schatten',Dragon:'Drache'};
const suffixes=Object.fromEntries(Object.entries(names.suffixes||{}).map(([k,v])=>[k.toLowerCase(),v]));
const baseNames=Object.fromEntries(Object.entries(names.names||{}).map(([k,v])=>[k.toLowerCase(),v]));
const overrides=Object.fromEntries(Object.entries(names.overrides||{}).map(([k,v])=>[k.toLowerCase(),v]));
const forbiddenPrefixes=['gym_','predator_','raid_','summon_','police_','quest_'];
const forbiddenParts=['_oilrig','_tower','_quest_','_avatar','_servant','_max'];
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function resolveName(id){
  if(overrides[id]) return overrides[id];
  const base=Object.keys(baseNames).filter(x=>id===x||id.startsWith(`${x}_`)).sort((a,b)=>b.length-a.length)[0];
  if(!base) return null;
  const rest=id.slice(base.length).replace(/^_/,'');
  if(!rest) return baseNames[base];
  const parts=rest.split('_');
  return parts.length===1&&suffixes[parts[0]]?`${baseNames[base]} ${suffixes[parts[0]]}`:null;
}

const pals=[];
for(const [id,elements] of Object.entries(types.elements||{})){
  if(forbiddenPrefixes.some(x=>id.startsWith(x))||forbiddenParts.some(x=>id.includes(x))) continue;
  const name=resolveName(id); if(!name) continue;
  pals.push({key:`canonical-${slug(name)}`,internalId:id,paldeck:null,name,element:(elements||[]).map(x=>deElement[x]||x).join('/'),work:{},partner:{name:'Partner Skill pending (EN)',description:'Noch nicht zuverlässig zugeordnet und daher von Berechnungen ausgeschlossen.',effects:[{type:'pending_partner_text'}]},languageStatus:'de-pending',translationStatus:'en-fallback',source:'canonical-1.0',verified:true,canonical:true});
}
const unique=[...new Map(pals.map(p=>[p.name.toLowerCase(),p])).values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));
const moveList=Object.entries(moves.moves||{}).map(([key,v])=>({key,...v,languageStatus:'en-fallback'}));
const passiveList=Object.entries(passives.passives||passives||{}).filter(([k])=>!k.startsWith('_')).map(([key,v])=>({key,...v,languageStatus:'en-fallback'}));

const meta={generatedAt:new Date().toISOString(),palCount:unique.length,moveCount:moveList.length,passiveCount:passiveList.length,fullPalRecords:Array.isArray(fullPals)?fullPals.length:Object.keys(fullPals||{}).length,bossRecords:Array.isArray(bosses)?bosses.length:Object.keys(bosses||{}).length,source:'Noval1th/PalworldDashboard + oMaN-Rod/palworld-save-pal'};
const out=`import { PAL_CATALOG } from './catalog.js';\nexport const CANONICAL_META=${JSON.stringify(meta)};\nexport const ACTIVE_SKILLS=${JSON.stringify(moveList)};\nexport const PASSIVE_SKILLS=${JSON.stringify(passiveList)};\nexport const PAL_GAME_RECORDS=${JSON.stringify(fullPals)};\nexport const ACTIVE_SKILL_RECORDS=${JSON.stringify(fullActive)};\nexport const PASSIVE_SKILL_RECORDS=${JSON.stringify(fullPassive)};\nexport const BOSS_RECORDS=${JSON.stringify(bosses)};\nexport const DE_PAL_TEXTS=${JSON.stringify(dePals)};\nexport const DE_ACTIVE_SKILL_TEXTS=${JSON.stringify(deActive)};\nexport const DE_PASSIVE_SKILL_TEXTS=${JSON.stringify(dePassive)};\nconst PACK=${JSON.stringify(unique)};\nconst existing=new Set(PAL_CATALOG.flatMap(x=>[String(x.key).toLowerCase(),String(x.name).toLowerCase()]));\nfor(const row of PACK){if(existing.has(row.key.toLowerCase())||existing.has(row.name.toLowerCase()))continue;PAL_CATALOG.push(row);existing.add(row.key.toLowerCase());existing.add(row.name.toLowerCase())}\nPAL_CATALOG.sort((a,b)=>String(a.paldeck||'999Z').localeCompare(String(b.paldeck||'999Z'),undefined,{numeric:true})||a.name.localeCompare(b.name,'de'));\n`;
fs.writeFileSync('src/generated-core.js',out);
fs.writeFileSync('data-build-report.json',JSON.stringify(meta,null,2));
console.log(JSON.stringify(meta,null,2));
