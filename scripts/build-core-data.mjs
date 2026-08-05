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
const normalize=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9äöüß]+/g,'');
const slug=value=>String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const forbiddenPrefixes=['gym_','predator_','raid_','summon_','police_','quest_','boss_','arena_','npc_','human_'];
const forbiddenParts=['_oilrig','_tower','_quest_','_avatar','_servant','_max','_enemy','_friend','_invader','_summon','_boss'];

function isPlayableId(rawId){
  const id=String(rawId).toLowerCase();
  return !forbiddenPrefixes.some(prefix=>id.startsWith(prefix))&&!forbiddenParts.some(part=>id.includes(part));
}
function localizedName(id){
  const row=dePals?.[id]||dePals?.[Object.keys(dePals||{}).find(key=>key.toLowerCase()===String(id).toLowerCase())];
  return row?.localized_name||row?.name||null;
}
function resolveFallbackName(id){
  const lower=String(id).toLowerCase();
  if(overrides[lower])return overrides[lower];
  const base=Object.keys(baseNames).filter(x=>lower===x||lower.startsWith(`${x}_`)).sort((a,b)=>b.length-a.length)[0];
  if(!base)return null;
  const rest=lower.slice(base.length).replace(/^_/,'');
  if(!rest)return baseNames[base];
  const parts=rest.split('_');
  return parts.length===1&&suffixes[parts[0]]?`${baseNames[base]} ${suffixes[parts[0]]}`:null;
}
function preferredName(id){return localizedName(id)||resolveFallbackName(id)||String(id).replaceAll('_',' ')}
function baseRow(id,elements){
  const name=preferredName(id);
  return {
    key:`canonical-${slug(id)}`,
    internalId:id,
    paldeck:null,
    name,
    element:(elements||[]).map(x=>deElement[x]||x).join('/'),
    work:{},
    partner:{name:'Partnerfähigkeit noch nicht normalisiert',description:'Der Originaldatensatz ist vorhanden, wird aber erst nach eindeutiger Zuordnung für Berechnungen verwendet.',effects:[{type:'pending_partner_text'}]},
    languageStatus:localizedName(id)?'de-confirmed':'de-pending',
    translationStatus:localizedName(id)?'de-official':'en-fallback',
    source:'canonical-1.0',
    verified:true,
    canonical:true
  };
}
function richness(row){
  return (row?.paldeck?2:0)+Object.keys(row?.work||{}).length*2+(row?.partner?.effects||[]).filter(e=>e.type!=='pending_partner_text').length*4+(row?.languageStatus==='de-confirmed'?2:0)+(row?.verified?1:0);
}
function mergeRows(primary,secondary){
  const richer=richness(primary)>=richness(secondary)?primary:secondary;
  const other=richer===primary?secondary:primary;
  const partnerEffects=[...(richer.partner?.effects||[]),...(other.partner?.effects||[])];
  const dedupedEffects=[...new Map(partnerEffects.map(effect=>[JSON.stringify(effect),effect])).values()];
  return {
    ...other,
    ...richer,
    internalId:richer.internalId||other.internalId,
    paldeck:richer.paldeck||other.paldeck||null,
    name:richer.name||other.name,
    element:richer.element||other.element||'',
    work:{...(other.work||{}),...(richer.work||{})},
    partner:{...(other.partner||{}),...(richer.partner||{}),effects:dedupedEffects.length?dedupedEffects:[{type:'pending_partner_text'}]},
    aliases:[...new Set([...(other.aliases||[]),...(richer.aliases||[]),other.name,richer.name].filter(Boolean))],
    canonical:true
  };
}

const expectedIds=Object.keys(types.elements||{}).filter(isPlayableId);
const generated=expectedIds.map(id=>baseRow(id,types.elements[id]));
const generatedById=new Map(generated.map(row=>[normalize(row.internalId),row]));
const duplicateGeneratedIds=generated.length-generatedById.size;
const generatedByName=new Map();
for(const row of generatedById.values()){
  const nameKey=normalize(row.name);
  if(!generatedByName.has(nameKey))generatedByName.set(nameKey,row);
  else generatedByName.set(nameKey,mergeRows(generatedByName.get(nameKey),row));
}
const canonical=[...generatedByName.values()].sort((a,b)=>a.name.localeCompare(b.name,'de'));
const missingIds=expectedIds.filter(id=>!generatedById.has(normalize(id)));
const duplicateLocalizedNames=[...generated.reduce((map,row)=>{const key=normalize(row.name);map.set(key,(map.get(key)||0)+1);return map},new Map())].filter(([,count])=>count>1).map(([name,count])=>({name,count}));

const moveList=Object.entries(moves.moves||{}).map(([key,value])=>({key,...value,languageStatus:'en-fallback'}));
const passiveList=Object.entries(passives.passives||passives||{}).filter(([key])=>!key.startsWith('_')).map(([key,value])=>({key,...value,languageStatus:'en-fallback'}));
const meta={
  generatedAt:new Date().toISOString(),
  expectedPlayableIds:expectedIds.length,
  palCount:canonical.length,
  missingIds,
  duplicateGeneratedIds,
  duplicateLocalizedNames,
  moveCount:moveList.length,
  passiveCount:passiveList.length,
  fullPalRecords:Array.isArray(fullPals)?fullPals.length:Object.keys(fullPals||{}).length,
  bossRecords:Array.isArray(bosses)?bosses.length:Object.keys(bosses||{}).length,
  source:'Noval1th/PalworldDashboard + oMaN-Rod/palworld-save-pal'
};

const runtime=`import { PAL_CATALOG } from './catalog.js';\n`+
`export const CANONICAL_META=${JSON.stringify(meta)};\n`+
`export const ACTIVE_SKILLS=${JSON.stringify(moveList)};\n`+
`export const PASSIVE_SKILLS=${JSON.stringify(passiveList)};\n`+
`export const PAL_GAME_RECORDS=${JSON.stringify(fullPals)};\n`+
`export const ACTIVE_SKILL_RECORDS=${JSON.stringify(fullActive)};\n`+
`export const PASSIVE_SKILL_RECORDS=${JSON.stringify(fullPassive)};\n`+
`export const BOSS_RECORDS=${JSON.stringify(bosses)};\n`+
`export const DE_PAL_TEXTS=${JSON.stringify(dePals)};\n`+
`export const DE_ACTIVE_SKILL_TEXTS=${JSON.stringify(deActive)};\n`+
`export const DE_PASSIVE_SKILL_TEXTS=${JSON.stringify(dePassive)};\n`+
`const CANONICAL=${JSON.stringify(canonical)};\n`+
`const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9äöüß]+/g,'');\n`+
`const score=row=>(row?.paldeck?2:0)+Object.keys(row?.work||{}).length*2+(row?.partner?.effects||[]).filter(e=>e.type!=='pending_partner_text').length*4+(row?.languageStatus==='de-confirmed'?2:0)+(row?.verified?1:0);\n`+
`const merge=(a,b)=>{const rich=score(a)>=score(b)?a:b,other=rich===a?b:a;const effects=[...(rich.partner?.effects||[]),...(other.partner?.effects||[])];return {...other,...rich,internalId:rich.internalId||other.internalId,paldeck:rich.paldeck||other.paldeck||null,work:{...(other.work||{}),...(rich.work||{})},partner:{...(other.partner||{}),...(rich.partner||{}),effects:[...new Map(effects.map(e=>[JSON.stringify(e),e])).values()]},aliases:[...new Set([...(other.aliases||[]),...(rich.aliases||[]),other.name,rich.name].filter(Boolean))],canonical:true}};\n`+
`const byId=new Map(),unmatched=[];\n`+
`for(const row of PAL_CATALOG){const id=norm(row.internalId);if(id)byId.set(id,byId.has(id)?merge(byId.get(id),row):row);else unmatched.push(row)}\n`+
`for(const row of CANONICAL){const id=norm(row.internalId);byId.set(id,byId.has(id)?merge(byId.get(id),row):row)}\n`+
`const byName=new Map();for(const row of [...byId.values(),...unmatched]){const key=norm(row.name);if(!key)continue;byName.set(key,byName.has(key)?merge(byName.get(key),row):row)}\n`+
`PAL_CATALOG.splice(0,PAL_CATALOG.length,...byName.values());\n`+
`PAL_CATALOG.sort((a,b)=>String(a.paldeck||'999Z').localeCompare(String(b.paldeck||'999Z'),undefined,{numeric:true})||a.name.localeCompare(b.name,'de'));\n`+
`const keys=new Set(),names=new Set();for(const row of PAL_CATALOG){const key=norm(row.key),name=norm(row.name);if(keys.has(key))throw new Error('Duplicate catalog key: '+row.key);if(names.has(name))throw new Error('Duplicate catalog name: '+row.name);keys.add(key);names.add(name)}\n`;

fs.writeFileSync('src/generated-core.js',runtime);
fs.writeFileSync('data-build-report.json',JSON.stringify(meta,null,2));
console.log(JSON.stringify(meta,null,2));
if(missingIds.length||duplicateGeneratedIds)process.exitCode=1;
