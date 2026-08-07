import fs from 'node:fs';
import { PAL_CATALOG as STATIC_PAL_CATALOG } from '../src/catalog.js';

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

const SCHEMA_VERSION='palwerk-core-1.0.1';
const deElement={Normal:'Neutral',Neutral:'Neutral',Fire:'Feuer',Water:'Wasser',Grass:'Gras',Electric:'Elektro',Ice:'Eis',Ground:'Erde',Dark:'Schatten',Dragon:'Drache'};
const workMap={EmitFlame:'kindling',Watering:'watering',Seeding:'planting',GenerateElectricity:'generating',Handcraft:'handiwork',Collection:'gathering',Deforest:'lumbering',Mining:'mining',OilExtraction:'oilExtraction',ProductMedicine:'medicine',Cool:'cooling',Transport:'transporting',MonsterFarm:'farming'};
const suffixes=Object.fromEntries(Object.entries(names.suffixes||{}).map(([k,v])=>[k.toLowerCase(),v]));
const baseNames=Object.fromEntries(Object.entries(names.names||{}).map(([k,v])=>[k.toLowerCase(),v]));
const overrides=Object.fromEntries(Object.entries(names.overrides||{}).map(([k,v])=>[k.toLowerCase(),v]));
const normalize=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9äöüß]+/g,'');
const slug=value=>String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const forbiddenPrefixes=['gym_','predator_','raid_','summon_','police_','quest_','boss_','arena_','npc_','human_'];
const forbiddenParts=['_oilrig','_tower','_quest_','_avatar','_servant','_max','_enemy','_friend','_invader','_summon','_boss'];
const staticDeckByName=new Map(STATIC_PAL_CATALOG.filter(row=>row?.name&&row?.paldeck).map(row=>[normalize(row.name),String(row.paldeck)]));

function isPlayableId(rawId,record={}){
  const id=String(rawId).toLowerCase();
  return record.is_pal!==false&&!record.disabled&&Number(record.pal_deck_index??0)>=0&&!forbiddenPrefixes.some(prefix=>id.startsWith(prefix))&&!forbiddenParts.some(part=>id.includes(part));
}
function localizedRow(source,id){return source?.[id]||source?.[Object.keys(source||{}).find(key=>key.toLowerCase()===String(id).toLowerCase())]||null}
function localizedName(id){const row=localizedRow(dePals,id);return row?.localized_name||row?.name||null}
function localizedDescription(id){return localizedRow(dePals,id)?.description||null}
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
function localizedSkill(id){const row=localizedRow(deActive,id);return {name:row?.localized_name||row?.name||id,description:row?.description||null,languageStatus:row?'de-confirmed':'en-fallback'}}
function localizedPassive(id){const row=localizedRow(dePassive,id);return {name:row?.localized_name||row?.name||id,description:row?.description||null,languageStatus:row?'de-confirmed':'en-fallback'}}
function normalizedWork(record){const result={};for(const [source,target] of Object.entries(workMap)){const value=Number(record?.work_suitability?.[source]||0);if(value>0)result[target]=value}return result}
function normalizedSkills(record){return Object.entries(record?.skill_set||{}).map(([skillId,level])=>({id:skillId,level:Number(level),...localizedSkill(skillId),data:fullActive?.[skillId]||null})).sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name,'de'))}
function normalizedPassives(record){return (record?.passive_skills||[]).map(passiveId=>({id:passiveId,...localizedPassive(passiveId),data:fullPassive?.[passiveId]||null}))}
function firstField(record,patterns){for(const [key,value] of Object.entries(record||{})){if(patterns.some(pattern=>pattern.test(key)))return value}return null}
function allFields(record,patterns){return Object.entries(record||{}).filter(([key])=>patterns.some(pattern=>pattern.test(key))).map(([key,value])=>({key,value}))}
function normalizedDrops(record){const raw=firstField(record,[/drop/i,/loot/i,/item.*drop/i,/drop.*item/i]);if(!raw)return[];if(Array.isArray(raw))return raw;if(typeof raw==='object')return Object.entries(raw).map(([id,value])=>({id,value}));return[{value:raw}]}
function normalizedPartner(record){
  const raw=firstField(record,[/partner/i,/unique.*skill/i,/ability/i]);
  if(!raw)return{name:'Partnerfähigkeit noch nicht normalisiert',description:'In der verfügbaren Quelle wurde kein eindeutig zuordenbares Partnerfeld gefunden.',effects:[{type:'pending_partner_text'}],raw:null};
  return{name:'Partnerfähigkeit aus Rohdaten',description:'Rohdaten vorhanden; Wirkung noch nicht vollständig semantisch normalisiert.',effects:[{type:'raw_partner_data'}],raw};
}
function normalizedSpawn(record){const fields=allFields(record,[/spawn/i,/location/i,/map/i,/coordinate/i,/habitat/i]);return fields.length?fields:[]}
function normalizedBreeding(record){
  return{rank:Number(record?.combi_rank||0),maleProbability:Number(record?.male_probability??50),egg:record?.egg||record?.egg_type||null,parents:firstField(record,[/parent/i,/breeding.*combo/i,/breed.*pair/i])};
}
function normalizedProgression(record){return{condense:firstField(record,[/condens/i,/rankup/i,/star.*bonus/i]),implants:firstField(record,[/implant/i,/awak/i]),souls:firstField(record,[/soul/i])}}
function baseRow(id,record){
  const name=preferredName(id);
  const elements=record?.element_types||types.elements?.[id]||[];
  return {
    schemaVersion:SCHEMA_VERSION,
    key:`canonical-${slug(id)}`,
    internalId:id,
    paldeck:staticDeckByName.get(normalize(name))||null,
    sourcePalDeckIndex:Number(record?.pal_deck_index)>=0?Number(record.pal_deck_index):null,
    name,
    description:localizedDescription(id),
    element:elements.map(x=>deElement[x]||x).join('/'),
    work:normalizedWork(record),
    stats:{hp:Number(record?.scaling?.hp||0),attack:Number(record?.scaling?.attack||0),defense:Number(record?.scaling?.defense||0),stamina:Number(record?.stamina||0),rarity:Number(record?.rarity||0),size:record?.size||null},
    movement:{walk:Number(record?.walk_speed||0),run:Number(record?.run_speed||0),rideSprint:Number(record?.ride_sprint_speed||0),transport:Number(record?.transport_speed||0)},
    skills:normalizedSkills(record),
    fixedPassives:normalizedPassives(record),
    breeding:normalizedBreeding(record),
    drops:normalizedDrops(record),
    spawn:normalizedSpawn(record),
    progression:normalizedProgression(record),
    flags:{boss:Boolean(record?.is_boss),towerBoss:Boolean(record?.is_tower_boss),raidBoss:Boolean(record?.is_raid_boss),predator:Boolean(record?.predator),nocturnal:Boolean(record?.nocturnal),edible:Boolean(record?.edible)},
    economy:{price:Number(record?.price||0),food:Number(record?.food_amount||0)},
    iconId:record?.icon||null,
    partner:normalizedPartner(record),
    rawRecord:record,
    languageStatus:localizedName(id)?'de-confirmed':'de-pending',
    translationStatus:localizedName(id)?'de-official':'en-fallback',
    source:'canonical-1.0',verified:true,canonical:true
  };
}
function richness(row){return (row?.paldeck?2:0)+Object.keys(row?.work||{}).length*2+(row?.skills?.length||0)+(row?.drops?.length||0)+(row?.partner?.effects||[]).filter(e=>e.type!=='pending_partner_text').length*4+(row?.languageStatus==='de-confirmed'?2:0)+(row?.verified?1:0)}
function mergeRows(primary,secondary){
  const richer=richness(primary)>=richness(secondary)?primary:secondary,other=richer===primary?secondary:primary;
  const effects=[...(richer.partner?.effects||[]),...(other.partner?.effects||[])];
  const skills=[...(richer.skills||[]),...(other.skills||[])];
  return {...other,...richer,internalId:richer.internalId||other.internalId,paldeck:richer.paldeck||other.paldeck||null,name:richer.name||other.name,element:richer.element||other.element||'',work:{...(other.work||{}),...(richer.work||{})},stats:{...(other.stats||{}),...(richer.stats||{})},movement:{...(other.movement||{}),...(richer.movement||{})},skills:[...new Map(skills.map(x=>[x.id,x])).values()].sort((a,b)=>(a.level||0)-(b.level||0)),fixedPassives:[...new Map([...(richer.fixedPassives||[]),...(other.fixedPassives||[])].map(x=>[x.id,x])).values()],drops:[...new Map([...(richer.drops||[]),...(other.drops||[])].map(x=>[JSON.stringify(x),x])).values()],spawn:[...new Map([...(richer.spawn||[]),...(other.spawn||[])].map(x=>[JSON.stringify(x),x])).values()],partner:{...(other.partner||{}),...(richer.partner||{}),effects:[...new Map(effects.map(e=>[JSON.stringify(e),e])).values()]},aliases:[...new Set([...(other.aliases||[]),...(richer.aliases||[]),other.name,richer.name].filter(Boolean))],canonical:true};
}

const expectedEntries=Object.entries(fullPals||{}).filter(([id,record])=>isPlayableId(id,record));
const generated=expectedEntries.map(([id,record])=>baseRow(id,record));
const generatedById=new Map(generated.map(row=>[normalize(row.internalId),row]));
const duplicateGeneratedIds=generated.length-generatedById.size;
const generatedByName=new Map();
for(const row of generatedById.values()){const key=normalize(row.name);generatedByName.set(key,generatedByName.has(key)?mergeRows(generatedByName.get(key),row):row)}
const canonical=[...generatedByName.values()].sort((a,b)=>String(a.paldeck||'999').localeCompare(String(b.paldeck||'999'),undefined,{numeric:true})||a.name.localeCompare(b.name,'de'));
const missingIds=expectedEntries.map(([id])=>id).filter(id=>!generatedById.has(normalize(id)));
const coverage={
  total:canonical.length,
  withGermanName:canonical.filter(x=>x.languageStatus==='de-confirmed').length,
  withPaldeck:canonical.filter(x=>x.paldeck).length,
  withWork:canonical.filter(x=>Object.keys(x.work||{}).length).length,
  withSkills:canonical.filter(x=>x.skills?.length).length,
  withFixedPassives:canonical.filter(x=>x.fixedPassives?.length).length,
  withCombatStats:canonical.filter(x=>x.stats?.hp&&x.stats?.attack&&x.stats?.defense).length,
  withBreedingRank:canonical.filter(x=>x.breeding?.rank>0).length,
  withPartnerRaw:canonical.filter(x=>x.partner?.raw).length,
  withDrops:canonical.filter(x=>x.drops?.length).length,
  withSpawn:canonical.filter(x=>x.spawn?.length).length,
  withCondense:canonical.filter(x=>x.progression?.condense).length,
  withImplants:canonical.filter(x=>x.progression?.implants).length,
  withSouls:canonical.filter(x=>x.progression?.souls).length
};
const unresolved={
  partner:canonical.filter(x=>!x.partner?.raw).map(x=>x.internalId),
  drops:canonical.filter(x=>!x.drops?.length).map(x=>x.internalId),
  spawn:canonical.filter(x=>!x.spawn?.length).map(x=>x.internalId),
  breedingParents:canonical.filter(x=>!x.breeding?.parents).map(x=>x.internalId),
  progression:canonical.filter(x=>!x.progression?.condense&&!x.progression?.implants&&!x.progression?.souls).map(x=>x.internalId)
};
const moveList=Object.entries(moves.moves||{}).map(([key,value])=>({key,...value,...localizedSkill(key)}));
const passiveList=Object.entries(passives.passives||passives||{}).filter(([key])=>!key.startsWith('_')).map(([key,value])=>({key,...value,...localizedPassive(key)}));
const meta={schemaVersion:SCHEMA_VERSION,generatedAt:new Date().toISOString(),expectedPlayableIds:expectedEntries.length,palCount:canonical.length,missingIds,duplicateGeneratedIds,coverage,unresolvedCounts:Object.fromEntries(Object.entries(unresolved).map(([k,v])=>[k,v.length])),moveCount:moveList.length,passiveCount:passiveList.length,fullPalRecords:Object.keys(fullPals||{}).length,bossRecords:Object.keys(bosses||{}).length,source:'Noval1th/PalworldDashboard + oMaN-Rod/palworld-save-pal'};

const runtime=`import { PAL_CATALOG } from './catalog.js';\nexport const CANONICAL_META=${JSON.stringify(meta)};\nexport const CORE_SCHEMA_VERSION=${JSON.stringify(SCHEMA_VERSION)};\nexport const ACTIVE_SKILLS=${JSON.stringify(moveList)};\nexport const PASSIVE_SKILLS=${JSON.stringify(passiveList)};\nexport const PAL_GAME_RECORDS=${JSON.stringify(fullPals)};\nexport const ACTIVE_SKILL_RECORDS=${JSON.stringify(fullActive)};\nexport const PASSIVE_SKILL_RECORDS=${JSON.stringify(fullPassive)};\nexport const BOSS_RECORDS=${JSON.stringify(bosses)};\nexport const DE_PAL_TEXTS=${JSON.stringify(dePals)};\nexport const DE_ACTIVE_SKILL_TEXTS=${JSON.stringify(deActive)};\nexport const DE_PASSIVE_SKILL_TEXTS=${JSON.stringify(dePassive)};\nexport const PHASE1_UNRESOLVED=${JSON.stringify(unresolved)};\nconst CANONICAL=${JSON.stringify(canonical)};\nconst norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9äöüß]+/g,'');\nconst score=row=>(row?.paldeck?2:0)+Object.keys(row?.work||{}).length*2+(row?.skills?.length||0)+(row?.drops?.length||0)+(row?.partner?.effects||[]).filter(e=>e.type!=='pending_partner_text').length*4+(row?.languageStatus==='de-confirmed'?2:0);\nconst merge=(a,b)=>{const rich=score(a)>=score(b)?a:b,other=rich===a?b:a;const effects=[...(rich.partner?.effects||[]),...(other.partner?.effects||[])],skills=[...(rich.skills||[]),...(other.skills||[])];return {...other,...rich,internalId:rich.internalId||other.internalId,paldeck:rich.paldeck||other.paldeck||null,work:{...(other.work||{}),...(rich.work||{})},stats:{...(other.stats||{}),...(rich.stats||{})},movement:{...(other.movement||{}),...(rich.movement||{})},skills:[...new Map(skills.map(x=>[x.id,x])).values()],fixedPassives:[...new Map([...(rich.fixedPassives||[]),...(other.fixedPassives||[])].map(x=>[x.id,x])).values()],drops:[...new Map([...(rich.drops||[]),...(other.drops||[])].map(x=>[JSON.stringify(x),x])).values()],spawn:[...new Map([...(rich.spawn||[]),...(other.spawn||[])].map(x=>[JSON.stringify(x),x])).values()],partner:{...(other.partner||{}),...(rich.partner||{}),effects:[...new Map(effects.map(e=>[JSON.stringify(e),e])).values()]},aliases:[...new Set([...(other.aliases||[]),...(rich.aliases||[]),other.name,rich.name].filter(Boolean))],canonical:true}};\nconst byId=new Map(),unmatched=[];for(const row of PAL_CATALOG){const id=norm(row.internalId);if(id)byId.set(id,byId.has(id)?merge(byId.get(id),row):row);else unmatched.push(row)}for(const row of CANONICAL){const id=norm(row.internalId);byId.set(id,byId.has(id)?merge(byId.get(id),row):row)}const byName=new Map();for(const row of [...byId.values(),...unmatched]){const key=norm(row.name);if(!key)continue;byName.set(key,byName.has(key)?merge(byName.get(key),row):row)}PAL_CATALOG.splice(0,PAL_CATALOG.length,...byName.values());PAL_CATALOG.sort((a,b)=>String(a.paldeck||'999Z').localeCompare(String(b.paldeck||'999Z'),undefined,{numeric:true})||a.name.localeCompare(b.name,'de'));const keys=new Set(),names=new Set();for(const row of PAL_CATALOG){const key=norm(row.key),name=norm(row.name);if(keys.has(key))throw new Error('Duplicate catalog key: '+row.key);if(names.has(name))throw new Error('Duplicate catalog name: '+row.name);keys.add(key);names.add(name)}\n`;
fs.writeFileSync('src/generated-core.js',runtime);
fs.writeFileSync('data-build-report.json',JSON.stringify({...meta,unresolved},null,2));
console.log(JSON.stringify(meta,null,2));
if(missingIds.length||duplicateGeneratedIds)process.exitCode=1;