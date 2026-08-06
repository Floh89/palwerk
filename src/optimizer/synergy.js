const DIMENSIONS=Object.freeze({
  damage:{label:'Pal-Schaden',types:['pal_element_attack','weakpoint_damage','pal_attack','party_pal_attack']},
  tempo:{label:'Tempo',types:['cooldown_reduction','party_follow_attack','movement_speed']},
  player:{label:'Spieler-Support',types:['player_attack','player_weapon_damage','player_defense','player_attack_element_conversion']},
  sustain:{label:'Sustain',types:['heal_player','revive_player','life_steal','damage_reduction']},
  utility:{label:'Spezialnutzen',types:['carry_capacity','item_weight_reduction','capture_bonus','loot_bonus']}
});

const effectsOf=member=>Array.isArray(member?.appliedEffects)?member.appliedEffects:[];
const suppressedOf=member=>Array.isArray(member?.suppressedEffects)?member.suppressedEffects:[];
const elementsOf=pal=>String(pal?.element||'').split('/').map(value=>value.trim()).filter(Boolean);
const qualityOf=effect=>effect?.status==='verified'&&effect?.confidence==='high'?'verified':effect?.status==='community-tested'?'community-tested':effect?.status==='modelled'?'modelled':effect?.status==='provisional'?'provisional':'missing';
const rankValue=effect=>Array.isArray(effect?.valuesByRank)&&effect.valuesByRank.some(value=>value!=null);

function dimensionFor(type){
  return Object.entries(DIMENSIONS).find(([,definition])=>definition.types.includes(type))?.[0]||'utility';
}
function targetMatches(effect,carry){
  const target=effect?.element||effect?.targetElement||null;
  return !target||elementsOf(carry?.pal).includes(target);
}
function evidenceFor(member,effect,carry){
  return{
    palId:member.pal.key,
    palName:member.pal.name,
    effectType:effect.type,
    partnerName:member.pal.partner?.name||'Partnerfähigkeit',
    activation:effect.activation||'unknown',
    stackingGroup:effect.stackingGroup||`${effect.type}:general`,
    targetMatches:targetMatches(effect,carry),
    hasRankValues:rankValue(effect),
    quality:qualityOf(effect),
    status:effect.status||'missing'
  };
}
function dimensionState(evidence){
  if(!evidence.length)return'missing';
  if(evidence.some(item=>item.quality==='verified'))return'verified';
  if(evidence.some(item=>item.quality==='community-tested'))return'community-tested';
  if(evidence.some(item=>item.quality==='modelled'))return'modelled';
  return'provisional';
}

export function analyzeTeamSynergy(members=[],carry=null,stacking={applied:[],suppressed:[]}){
  const supports=members.filter(member=>member?.pal&&member.pal.key!==carry?.pal?.key);
  const dimensions={};
  for(const [id,definition] of Object.entries(DIMENSIONS))dimensions[id]={id,label:definition.label,state:'missing',evidence:[],memberCount:0,rankCoverage:0};
  for(const member of supports){
    const seen=new Set();
    for(const effect of effectsOf(member)){
      const id=dimensionFor(effect.type),evidence=evidenceFor(member,effect,carry);
      dimensions[id].evidence.push(evidence);
      seen.add(id);
    }
    for(const id of seen)dimensions[id].memberCount++;
  }
  for(const dimension of Object.values(dimensions)){
    dimension.state=dimensionState(dimension.evidence);
    dimension.rankCoverage=dimension.evidence.length?dimension.evidence.filter(item=>item.hasRankValues).length/dimension.evidence.length:0;
  }
  const appliedGroups=new Set((stacking.applied||[]).map(item=>item.group));
  const suppressedGroups=new Set((stacking.suppressed||[]).map(item=>item.group));
  const collisions=[...suppressedGroups].map(group=>({group,applied:appliedGroups.has(group),suppressedCount:(stacking.suppressed||[]).filter(item=>item.group===group).length}));
  const gaps=Object.values(dimensions).filter(dimension=>dimension.state==='missing').map(dimension=>dimension.label);
  const provisional=Object.values(dimensions).filter(dimension=>['provisional','modelled'].includes(dimension.state)).map(dimension=>dimension.label);
  const duplicateRoles=Object.values(dimensions).filter(dimension=>dimension.memberCount>1).map(dimension=>({label:dimension.label,memberCount:dimension.memberCount}));
  const suppressed=supports.flatMap(member=>suppressedOf(member).map(effect=>evidenceFor(member,effect,carry)));
  const evidenceCount=Object.values(dimensions).reduce((sum,dimension)=>sum+dimension.evidence.length,0);
  const verifiedCount=Object.values(dimensions).flatMap(dimension=>dimension.evidence).filter(item=>item.quality==='verified'||item.quality==='community-tested').length;
  return{
    version:'1.0.0',
    dimensions,
    gaps,
    provisional,
    duplicateRoles,
    collisions,
    suppressed,
    evidenceCount,
    verifiedEvidenceCount:verifiedCount,
    confidence:evidenceCount?verifiedCount/evidenceCount:0,
    summary:gaps.length?`Abgedeckt mit Lücken: ${gaps.join(', ')}`:'Alle Kernrollen sind strukturell abgedeckt.'
  };
}

export const SYNERGY_MODEL_VERSION='1.0.0';
