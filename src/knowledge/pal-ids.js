import { COMBAT_GRAPH, normalizeInternalId } from './combat-graph.js';

const CANONICAL_OVERRIDES=Object.freeze({
  oserk:'orserk',
  orserk:'orserk'
});

const canonical=value=>CANONICAL_OVERRIDES[normalizeInternalId(value)]||normalizeInternalId(value);

const aliasEntries=[];
for(const pal of COMBAT_GRAPH.pals){
  const canonicalId=canonical(pal.name||pal.id);
  for(const alias of [canonicalId,pal.id,pal.catalogId,pal.internalId,pal.name]){
    const key=normalizeInternalId(alias);
    if(key)aliasEntries.push([key,{canonicalId,pal}]);
  }
}

export const PAL_ID_ALIASES=new Map(aliasEntries);

export function resolvePalId(value){
  const key=normalizeInternalId(value);
  return PAL_ID_ALIASES.get(key)?.canonicalId||canonical(key)||null;
}

export function resolvePalKnowledge(value){
  const key=normalizeInternalId(value);
  const direct=PAL_ID_ALIASES.get(key);
  if(direct)return direct.pal;
  const wanted=canonical(key);
  return COMBAT_GRAPH.pals.find(pal=>canonical(pal.name||pal.id)===wanted)||null;
}
