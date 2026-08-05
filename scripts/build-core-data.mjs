import fs from 'node:fs';

const names=JSON.parse(fs.readFileSync('data/upstream/pal-names.json','utf8'));
const types=JSON.parse(fs.readFileSync('data/upstream/pal-types.json','utf8'));
const moves=JSON.parse(fs.readFileSync('data/upstream/pal-moves.json','utf8'));
const passives=JSON.parse(fs.readFileSync('data/upstream/pal-passives.json','utf8'));

const deElement={Neutral:'Neutral',Fire:'Feuer',Water:'Wasser',Grass:'Gras',Electric:'Elektro',Ice:'Eis',Ground:'Erde',Dark:'Schatten',Dragon:'Drache'};
const suffixes=Object.fromEntries(Object.entries(names.suffixes||{}).map(([k,v])=>[k.toLowerCase(),v]));
const baseNames=Object.fromEntries(Object.entries(names.names||{}).map(([k,v])=>[k.toLowerCase(),v]));
const overrides=Object.fromEntries(Object.entries(names.overrides||{}).map(([k,v])=>[k.toLowerCase(),v]));
const forbiddenPrefixes=['gym_','predator_','raid_','summon_','police_','quest_'];
const forbiddenParts=['_oilrig','_tower','_quest_','_avatar','_servant','_max'];
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function resolveName(id){
  if(overrides[id]) return overrides[id];
  const bases=Object.keys(baseNames).filter(base=>id===base||id.startsWith(`${base}_`)).sort((a,b)=>b.length-a.length);
  const base=bases[0];
  if(!base) return null;
  const rest=id.slice(base.length).replace(/^_/,'');
  if(!rest) return baseNames[base];
  const parts=rest.split('_');
  if(parts.length!==1||!suffixes[parts[0]]) return null;
  return `${baseNames[base]} ${suffixes[parts[0]]}`;
}

const pals=[];
for(const [id,elements] of Object.entries(types.elements||{})){
  if(forbiddenPrefixes.some(prefix=>id.startsWith(prefix))) continue;
  if(forbiddenParts.some(part=>id.includes(part))) continue;
  const name=resolveName(id);
  if(!name) continue;
  pals.push({
    key:`canonical-${slug(name)}`,
    internalId:id,
    paldeck:null,
    name,
    element:(elements||[]).map(x=>deElement[x]||x).join('/'),
    work:{},
    partner:{name:'Partner Skill pending (EN)',description:'English fallback. The Partner Skill is not yet mapped to this Pal and is excluded from calculations.',effects:[{type:'pending_partner_text'}]},
    languageStatus:'de-pending',
    translationStatus:'en-fallback',
    source:'Noval1th/PalworldDashboard 2026-07',
    verified:true,
    canonical:true
  });
}

const unique=[...new Map(pals.map(p=>[p.name.toLowerCase(),p])).values()].sort((a,b)=>a.name.localeCompare(b.name,'en'));
const moveList=Object.entries(moves.moves||{}).map(([key,v])=>({key,...v,languageStatus:'en-fallback'}));
const passiveList=Object.entries(passives.passives||passives||{}).filter(([k])=>!k.startsWith('_')).map(([key,v])=>({key,...v,languageStatus:'en-fallback'}));

const out=`import { PAL_CATALOG } from './catalog.js';\n\nexport const CANONICAL_META=${JSON.stringify({generatedAt:new Date().toISOString(),palCount:unique.length,moveCount:moveList.length,passiveCount:passiveList.length,source:'Noval1th/PalworldDashboard'},null,2)};\nexport const ACTIVE_SKILLS=${JSON.stringify(moveList)};\nexport const PASSIVE_SKILLS=${JSON.stringify(passiveList)};\nconst PACK=${JSON.stringify(unique)};\nconst existing=new Set(PAL_CATALOG.flatMap(x=>[String(x.key).toLowerCase(),String(x.name).toLowerCase()]));\nfor(const row of PACK){if(existing.has(row.key.toLowerCase())||existing.has(row.name.toLowerCase()))continue;PAL_CATALOG.push(row);existing.add(row.key.toLowerCase());existing.add(row.name.toLowerCase())}\nPAL_CATALOG.sort((a,b)=>String(a.paldeck||'999Z').localeCompare(String(b.paldeck||'999Z'),undefined,{numeric:true})||a.name.localeCompare(b.name,'de'));\n`;
fs.writeFileSync('src/generated-core.js',out);
console.log(`Generated ${unique.length} Pals, ${moveList.length} active skills and ${passiveList.length} passive skills.`);
