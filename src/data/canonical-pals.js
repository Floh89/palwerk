import { PAL_CATALOG } from '../catalog.js';

const text=value=>String(value??'').trim();
const slug=value=>text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const numericDex=value=>{const match=text(value).match(/\d+/);return match?Number(match[0]):null;};
const BLOCKED=/astralym|amaterasuwolf|quest|avatar|enemy|friend|summon|tower|raid_|npc|human/i;

export const CANONICAL_PAL_SCHEMA='1.0.0';

export function isPlayableCatalogPal(pal){
  return Boolean(pal?.name&&!BLOCKED.test(`${pal.internalId||''} ${pal.name}`)&&!pal.flags?.towerBoss&&!pal.flags?.raidBoss&&pal.rawRecord?.capture_rate_correct!==0);
}

function technicalId(pal){return text(pal?.internalId||pal?.key||pal?.rawRecord?.id||pal?.name);}
function canonicalIdFor(pal){
  const explicit=text(pal?.canonicalId);
  if(explicit)return slug(explicit);
  const name=slug(pal?.name);
  const technical=slug(technicalId(pal));
  const aliases={thunderdragonman:'orserk'};
  return aliases[technical]||name||technical;
}
function variantIdFor(pal,canonicalId){
  const technical=slug(technicalId(pal));
  if(!technical||technical===canonicalId)return'base';
  const stripped=technical.replace(new RegExp(`^${canonicalId}-?`),'');
  return stripped||technical;
}
function sourceIds(pal){return [...new Set([pal?.key,pal?.internalId,pal?.rawRecord?.id].map(text).filter(Boolean))];}

function buildRows(catalog){
  return catalog.filter(isPlayableCatalogPal).map(pal=>{
    const canonicalId=canonicalIdFor(pal);
    const dexNumber=numericDex(pal.paldeck);
    const variantId=variantIdFor(pal,canonicalId);
    const dexKey=dexNumber==null?`unlisted:${canonicalId}:${variantId}`:`${String(dexNumber).padStart(3,'0')}:${variantId}`;
    return Object.freeze({
      canonicalId,
      dexNumber,
      dexKey,
      variantId,
      displayNumber:dexNumber==null?null:`${String(dexNumber).padStart(3,'0')}${variantId==='base'?'':` · ${variantId}`}`,
      displayName:text(pal.name),
      sourceIds:Object.freeze(sourceIds(pal)),
      source:pal
    });
  });
}

export function createCanonicalPalRegistry(catalog=PAL_CATALOG){
  const rows=buildRows(catalog);
  const bySourceId=new Map();
  const byCanonicalId=new Map();
  const byDexKey=new Map();
  const duplicateSourceIds=[];
  const duplicateDexKeys=[];
  for(const row of rows){
    for(const id of row.sourceIds){
      const key=slug(id);
      if(bySourceId.has(key)&&bySourceId.get(key)!==row)duplicateSourceIds.push({id,first:bySourceId.get(key),duplicate:row});
      else bySourceId.set(key,row);
    }
    if(byDexKey.has(row.dexKey))duplicateDexKeys.push({dexKey:row.dexKey,first:byDexKey.get(row.dexKey),duplicate:row});
    else byDexKey.set(row.dexKey,row);
    if(!byCanonicalId.has(row.canonicalId))byCanonicalId.set(row.canonicalId,[]);
    byCanonicalId.get(row.canonicalId).push(row);
  }
  const exactDuplicates=duplicateSourceIds.filter(item=>item.first.dexKey===item.duplicate.dexKey);
  return Object.freeze({schemaVersion:CANONICAL_PAL_SCHEMA,rows:Object.freeze(rows),bySourceId,byCanonicalId,byDexKey,duplicateSourceIds:Object.freeze(duplicateSourceIds),duplicateDexKeys:Object.freeze(duplicateDexKeys),exactDuplicates:Object.freeze(exactDuplicates)});
}

export const CANONICAL_PALS=createCanonicalPalRegistry();

export function resolveCanonicalPal(id,{variantId=null}={}){
  const key=slug(id);
  const bySource=CANONICAL_PALS.bySourceId.get(key);
  if(bySource)return bySource;
  const matches=CANONICAL_PALS.byCanonicalId.get(key)||[];
  if(variantId)return matches.find(row=>row.variantId===slug(variantId))||null;
  return matches.find(row=>row.variantId==='base')||matches[0]||null;
}

export function canonicalDataReport(registry=CANONICAL_PALS){
  const dexGroups=new Map();
  for(const row of registry.rows){if(row.dexNumber!=null){if(!dexGroups.has(row.dexNumber))dexGroups.set(row.dexNumber,[]);dexGroups.get(row.dexNumber).push(row);}}
  return Object.freeze({
    total:registry.rows.length,
    uniqueCanonicalIds:registry.byCanonicalId.size,
    uniqueDexKeys:registry.byDexKey.size,
    sharedDexNumbers:[...dexGroups.entries()].filter(([,rows])=>rows.length>1).map(([dexNumber,rows])=>({dexNumber,variants:rows.map(row=>({canonicalId:row.canonicalId,variantId:row.variantId,displayName:row.displayName}))})),
    duplicateSourceIds:registry.duplicateSourceIds.length,
    duplicateDexKeys:registry.duplicateDexKeys.length,
    exactDuplicates:registry.exactDuplicates.length
  });
}
