import { PASSIVES, resolvePassive } from '../data/passives.js';

const N=value=>Number.isFinite(Number(value))?Number(value):0;
const list=value=>Array.isArray(value)?value:[];

export const PASSIVE_OPTIMIZER_VERSION='1.0.0';

function combinations(items,choose,start=0,prefix=[],out=[]){
  if(prefix.length===choose){out.push(prefix);return out;}
  for(let index=start;index<=items.length-(choose-prefix.length);index++){
    combinations(items,choose,index+1,[...prefix,items[index]],out);
  }
  return out;
}

function effectApplies(effect,{element=null,mode='combat'}={}){
  if(!effect?.stat||effect.value==null)return false;
  if(effect.stat==='elementDamage'&&element&&String(effect.element).toLowerCase()!==String(element).toLowerCase())return false;
  if(mode==='combat'&&['workSpeed','hungerRate','sanityDrain'].includes(effect.stat))return false;
  if(mode==='base'&&!['workSpeed','moveSpeed','hungerRate','sanityDrain'].includes(effect.stat))return false;
  return true;
}

function aggregate(build,context){
  const totals={attack:0,defense:0,hp:0,cooldown:0,elementDamage:0,hpRegen:0,workSpeed:0,moveSpeed:0,hungerRate:0,sanityDrain:0};
  const applied=[];
  const unresolved=[];
  for(const passive of build){
    for(const effect of passive.effects){
      if(!effect.stat||effect.value==null){unresolved.push({passive,effect});continue;}
      if(!effectApplies(effect,context))continue;
      totals[effect.stat]=(totals[effect.stat]||0)+N(effect.value);
      applied.push({passive,effect});
    }
  }
  return {totals,applied,unresolved};
}

function metrics(totals,goal){
  const attackMultiplier=Math.max(0,1+totals.attack/100);
  const elementMultiplier=Math.max(0,1+totals.elementDamage/100);
  const cooldownMultiplier=Math.max(.05,1-totals.cooldown/100);
  const survivalMultiplier=Math.max(0,(1+totals.hp/100)*(1+totals.defense/100));
  const sustainMultiplier=Math.max(0,1+totals.hpRegen/100);
  const powerGain=attackMultiplier*elementMultiplier/cooldownMultiplier;
  const weights={
    damage:{power:1,survival:0,sustain:0},
    practical:{power:.7,survival:.2,sustain:.1},
    survival:{power:.2,survival:.6,sustain:.2},
    base:{power:0,survival:0,sustain:0}
  }[goal]||{power:.7,survival:.2,sustain:.1};
  const baseScore=goal==='base'
    ? 1+totals.workSpeed/100+totals.moveSpeed/200-Math.min(0,totals.hungerRate)/300-Math.min(0,totals.sanityDrain)/300
    : powerGain*weights.power+survivalMultiplier*weights.survival+sustainMultiplier*weights.sustain;
  return {attackMultiplier,elementMultiplier,cooldownMultiplier,survivalMultiplier,sustainMultiplier,powerGain,modelValue:baseScore};
}

function explain(build,aggregateResult,metricResult,context){
  const reasons=[];
  const t=aggregateResult.totals;
  if(t.attack)reasons.push(`${t.attack>0?'+':''}${t.attack}% Angriff`);
  if(t.elementDamage)reasons.push(`${t.elementDamage>0?'+':''}${t.elementDamage}% ${context.element||'Element'}-Schaden`);
  if(t.cooldown)reasons.push(`${t.cooldown>0?'+':''}${t.cooldown}% Cooldown-Modifikator`);
  if(t.hp)reasons.push(`${t.hp>0?'+':''}${t.hp}% LP`);
  if(t.defense)reasons.push(`${t.defense>0?'+':''}${t.defense}% Verteidigung`);
  if(t.hpRegen)reasons.push(`${t.hpRegen>0?'+':''}${t.hpRegen}% Regeneration`);
  if(t.workSpeed)reasons.push(`${t.workSpeed>0?'+':''}${t.workSpeed}% Arbeitstempo`);
  return {
    summary:reasons.length?reasons.join(' · '):'Keine für dieses Ziel strukturiert anwendbaren Effekte',
    assumptions:[
      'Die Bewertung verwendet ausschließlich strukturierte Effektfelder.',
      'Es wird keine Wirkung aus Namen oder Beschreibungstexten abgeleitet.',
      'Additive Prozentwerte werden innerhalb derselben Kennzahl summiert.',
      'Angriff, Elementbonus und Cooldown werden als getrennte Multiplikatoren modelliert.',
      aggregateResult.unresolved.length?'Mindestens ein Effekt ist semantisch noch nicht aufgelöst.':null
    ].filter(Boolean),
    modelValue:metricResult.modelValue
  };
}

export function evaluatePassiveBuild(passiveIds,{element=null,goal='practical',mode='combat'}={}){
  const passives=list(passiveIds).map(resolvePassive).filter(Boolean);
  if(passives.length!==4)return {status:'invalid',reason:'Ein Build muss aus vier eindeutigen, bekannten Pal-Passives bestehen.'};
  if(new Set(passives.map(passive=>passive.id)).size!==4)return {status:'invalid',reason:'Eine Passive darf innerhalb eines Builds nicht doppelt vorkommen.'};
  const context={element,goal,mode};
  const aggregation=aggregate(passives,context);
  const calculated=metrics(aggregation.totals,goal);
  return {
    status:'ok',
    passives,
    totals:aggregation.totals,
    appliedEffects:aggregation.applied,
    unresolvedEffects:aggregation.unresolved,
    metrics:calculated,
    explanation:explain(passives,aggregation,calculated,context),
    dataQuality:aggregation.unresolved.length?'provisional':passives.every(passive=>passive.status==='verified')?'verified':'provisional'
  };
}

export function optimizePassiveBuild({element=null,goal='practical',mode='combat',allowedPassiveIds=null,limit=5}={}){
  const allowed=allowedPassiveIds?new Set(allowedPassiveIds.map(id=>resolvePassive(id)?.id).filter(Boolean)):null;
  const pool=PASSIVES.rows.filter(passive=>!allowed||allowed.has(passive.id)).filter(passive=>passive.effects.some(effect=>effectApplies(effect,{element,mode})));
  if(pool.length<4)return {status:'insufficient-data',reason:'Weniger als vier strukturierte Passives passen zum gewählten Ziel.',builds:[]};
  const candidates=combinations(pool,4).map(build=>evaluatePassiveBuild(build.map(passive=>passive.id),{element,goal,mode})).filter(result=>result.status==='ok').sort((a,b)=>b.metrics.modelValue-a.metrics.modelValue);
  const builds=candidates.slice(0,Math.max(1,limit)).map((build,index)=>({...build,rank:index+1,label:`Build ${String.fromCharCode(65+index)}`}));
  if(builds.length>1){
    const winner=builds[0],runnerUp=builds[1];
    winner.whyWinner={
      modelValueGain:winner.metrics.modelValue-runnerUp.metrics.modelValue,
      powerGainDifference:winner.metrics.powerGain-runnerUp.metrics.powerGain,
      survivalDifference:winner.metrics.survivalMultiplier-runnerUp.metrics.survivalMultiplier,
      cooldownDifference:runnerUp.metrics.cooldownMultiplier-winner.metrics.cooldownMultiplier,
      comparedWith:runnerUp.label
    };
  }
  return {status:'ok',goal,mode,element,builds,poolSize:pool.length,dataQuality:builds.every(build=>build.dataQuality==='verified')?'verified':'provisional'};
}
