import './generated-core.js';
import './generated-partner-data.js';
import { PAL_CATALOG } from './catalog.js';
import { RAID_PROFILES, TOWER_PROFILES } from './encounter-overrides.js';

const N=v=>Number(v)||0;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const els=p=>String(p?.element||'').split('/').map(x=>x.trim()).filter(Boolean);
const counters={Feuer:'Wasser',Wasser:'Elektro',Gras:'Feuer',Elektro:'Erde',Eis:'Feuer',Erde:'Gras',Schatten:'Drache',Drache:'Eis',Neutral:'Schatten'};
const skillPower=s=>N(s?.data?.power??s?.data?.Power??s?.power);
const skillCd=s=>Math.max(.5,N(s?.data?.cooldown??s?.data?.cool_time??s?.data?.CoolTime??s?.cooldown)||10);
const skillElement=s=>String(s?.data?.element??s?.data?.type??s?.type??'Neutral');
const skillName=s=>s?.name||s?.id||'Unbekannter Skill';

export const ENGINE_VERSION='2.0.1-core-bound';
export const DEFAULT_PLAYER={level:75,attack:100,weaponName:'Nicht erfasst',weaponDps:0,reloadFactor:1,element:'Neutral',foodMultiplier:1,accessoryMultiplier:1};
export const DEFAULT_PAL_PROFILE={level:75,stars:0,ivs:{hp:0,attack:0,defense:0},souls:{hp:0,attack:0,defense:0,work:0},passives:[],activeSkillIds:[],implants:[],alpha:false,lucky:false};

export const PASSIVE_RULES={
  legend:{names:['Legend','Legendär'],attack:0.20,defense:0.20,speed:0.15,inherit:true},
  demonGod:{names:['Demon God','Dämonengott'],attack:0.30,defense:0.05,inherit:true},
  musclehead:{names:['Musclehead','Muskelkopf'],attack:0.30,work:-0.50,inherit:true},
  serenity:{names:['Serenity','Gelassenheit'],attack:0.10,cooldown:0.30,inherit:true},
  impatient:{names:['Impatient','Ungeduldig'],cooldown:0.15,inherit:true},
  burlyBody:{names:['Burly Body','Robuster Körper'],defense:0.20,inherit:true},
  diamondBody:{names:['Diamond Body','Diamantkörper'],defense:0.30,inherit:true},
  vanguard:{names:['Vanguard','Vorhut'],playerAttack:0.10,inherit:true},
  stronghold:{names:['Stronghold Strategist','Festungsstratege'],playerDefense:0.10,inherit:true}
};

function passiveEffects(names=[]){
  const out={attack:0,defense:0,hp:0,cooldown:0,playerAttack:0,playerDefense:0,element:0};
  for(const name of names){
    const rule=Object.values(PASSIVE_RULES).find(r=>r.names.some(n=>n.toLowerCase()===String(name).toLowerCase()));
    if(!rule)continue;
    for(const k of Object.keys(out))out[k]+=N(rule[k]);
  }
  return out;
}

function partnerEffects(pal,stars=0){
  const result={attack:0,playerAttack:0,cooldown:0,element:0,loot:0};
  const rank=clamp(N(stars),0,4);
  for(const e of pal?.partner?.effects||[]){
    const base=N(e.value??e.percent??e.amount)/100;
    const scaled=base*(1+rank*0.1);
    if(e.type==='player_attack'||e.type==='player_weapon_damage')result.playerAttack+=scaled||0.1;
    if(e.type==='pal_element_attack'||e.type==='weakpoint_damage')result.element+=scaled||0.1;
    if(e.type==='cooldown_reduction')result.cooldown+=scaled||0.1;
    if(e.type==='pal_drop_bonus')result.loot+=scaled||0.1;
  }
  return result;
}

export function normalizeProfile(pal,profile={}){
  return {...DEFAULT_PAL_PROFILE,...profile,ivs:{...DEFAULT_PAL_PROFILE.ivs,...profile.ivs},souls:{...DEFAULT_PAL_PROFILE.souls,...profile.souls},passives:[...(profile.passives||[])],activeSkillIds:[...(profile.activeSkillIds||[])]};
}

export function combatStats(pal,profile={}){
  const p=normalizeProfile(pal,profile), pass=passiveEffects(p.passives), partner=partnerEffects(pal,p.stars);
  const levelScale=0.55+clamp(p.level,1,75)/75*0.45;
  const ivAtk=1+clamp(N(p.ivs.attack),0,100)/100*0.30;
  const ivHp=1+clamp(N(p.ivs.hp),0,100)/100*0.30;
  const ivDef=1+clamp(N(p.ivs.defense),0,100)/100*0.30;
  const soulAtk=1+clamp(N(p.souls.attack),0,10)*0.03;
  const soulHp=1+clamp(N(p.souls.hp),0,10)*0.03;
  const soulDef=1+clamp(N(p.souls.defense),0,10)*0.03;
  return{
    attack:N(pal?.stats?.attack)*levelScale*ivAtk*soulAtk*(1+pass.attack+partner.attack),
    hp:N(pal?.stats?.hp)*levelScale*ivHp*soulHp*(1+pass.hp),
    defense:N(pal?.stats?.defense)*levelScale*ivDef*soulDef*(1+pass.defense),
    cooldownMultiplier:clamp(1-pass.cooldown-partner.cooldown,.35,1),
    playerAttackBonus:pass.playerAttack+partner.playerAttack,
    elementBonus:pass.element+partner.element,
    confidence:['level-scale:model','iv-scale:model','soul-scale:verified-rule','passives:partial','partner:partial']
  };
}

export function availableSkills(pal,profile={}){
  const p=normalizeProfile(pal,profile);
  const natural=(pal?.skills||[]).filter(s=>N(s.level)<=p.level);
  if(!p.activeSkillIds.length)return natural;
  return natural.filter(s=>p.activeSkillIds.includes(s.id));
}

export function buildRotation(pal,profile,encounter){
  const stats=combatStats(pal,profile), targetElements=encounter?.elements||[], preferred=[...new Set(targetElements.map(e=>counters[e]).filter(Boolean))];
  const rows=availableSkills(pal,profile).filter(s=>skillPower(s)>0).map(s=>{
    const cd=skillCd(s)*stats.cooldownMultiplier, power=skillPower(s), element=skillElement(s);
    const counter=preferred.some(e=>element.toLowerCase().includes(e.toLowerCase()));
    const stab=els(pal).some(e=>element.toLowerCase().includes(e.toLowerCase()));
    const effectivePower=power*(counter?1.5:1)*(stab?1.2:1)*(1+stats.elementBonus);
    return{s,name:skillName(s),element,power,cd,counter,stab,throughput:effectivePower/cd,effectivePower};
  }).sort((a,b)=>b.throughput-a.throughput);
  const fast=[...rows].sort((a,b)=>a.cd-b.cd||b.effectivePower-a.effectivePower)[0];
  const burst=[...rows].sort((a,b)=>b.effectivePower-a.effectivePower)[0];
  const sustain=rows.find(x=>x!==fast&&x!==burst)||rows[1];
  return[fast,sustain,burst].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,3);
}

export function estimatePalDps(pal,profile,encounter){
  const stats=combatStats(pal,profile), rotation=buildRotation(pal,profile,encounter);
  if(!rotation.length)return{dps:0,rotation,confidence:'low'};
  const cycle=Math.max(...rotation.map(x=>x.cd),1);
  const casts=rotation.reduce((sum,x)=>sum+Math.max(1,Math.floor(cycle/x.cd)),0);
  const power=rotation.reduce((sum,x)=>sum+x.effectivePower*Math.max(1,Math.floor(cycle/x.cd)),0);
  const raw=(stats.attack*power/100)/cycle;
  return{dps:raw,rotation,cycle,casts,confidence:'modelled-no-animation-data'};
}

export function estimatePlayerDps(player=DEFAULT_PLAYER,team=[]){
  const buffs=team.reduce((s,m)=>s+combatStats(m.pal,m.profile).playerAttackBonus,0);
  return N(player.weaponDps)*(1+buffs)*N(player.reloadFactor||1)*N(player.foodMultiplier||1)*N(player.accessoryMultiplier||1);
}

export function requiredDps(encounter,reserve=.25){
  if(!encounter?.hp||!encounter?.timeLimit)return null;
  const minimum=encounter.hp/encounter.timeLimit;
  return{minimum,target:minimum*(1+reserve)};
}

export function simulateBattle({encounter,members=[],player=DEFAULT_PLAYER,tick=.5}){
  const limit=N(encounter?.timeLimit)||600, hp=N(encounter?.hp);
  if(!hp)return{ready:false,reason:'Keine verifizierten HP vorhanden.'};
  const palRows=members.map(m=>({...m,estimate:estimatePalDps(m.pal,m.profile,encounter)}));
  const palDps=palRows.reduce((s,x)=>s+x.estimate.dps,0), playerDps=estimatePlayerDps(player,members), total=palDps+playerDps;
  let remaining=hp,time=0;
  while(remaining>0&&time<limit){remaining-=total*tick;time+=tick;}
  const req=requiredDps(encounter);
  return{ready:true,win:remaining<=0,time:Math.min(time,limit),remainingHp:Math.max(0,remaining),palDps,playerDps,totalDps:total,required:req,margin:req?total/req.target:null,confidence:'range-model',range:{low:total*.65,high:total*1.15},members:palRows};
}

export function optimizeRaidArmy({encounter,profiles={},player=DEFAULT_PLAYER,maxSlots=20,ownedOnly=false,ownedIds=[]}){
  const source=PAL_CATALOG.filter(p=>(p.skills||[]).length&&p?.stats?.attack>0&&(!ownedOnly||ownedIds.includes(p.key)));
  const ranked=source.map(p=>{const profile=profiles[p.key]||DEFAULT_PAL_PROFILE;const est=estimatePalDps(p,profile,encounter);const stats=combatStats(p,profile);return{pal:p,profile,dps:est.dps,survival:stats.hp+stats.defense*1.5,rotation:est.rotation};}).sort((a,b)=>(b.dps+b.survival*.02)-(a.dps+a.survival*.02));
  const army=[];
  for(let i=0;i<maxSlots&&ranked.length;i++)army.push(ranked[i%Math.min(ranked.length,8)]);
  const members=army.map(x=>({pal:x.pal,profile:x.profile}));
  const simulation=simulateBattle({encounter,members,player});
  return{army,simulation,waves:Array.from({length:Math.ceil(army.length/5)},(_,i)=>army.slice(i*5,i*5+5))};
}

export function recommendPassives(role='damage',targetElements=[]){
  const element=targetElements.map(e=>counters[e]).find(Boolean);
  if(role==='player')return['Vanguard','Stronghold Strategist','Flexibel','Flexibel'];
  if(role==='tank')return['Diamond Body','Legend','Serenity','Demon God'];
  if(role==='cooldown')return['Serenity','Impatient','Demon God',element?`${element}-Schadenspassiv`:'Legend'];
  return['Demon God','Serenity','Musclehead',element?`${element}-Schadenspassiv`:'Legend'];
}

export function encounterOptions(type='raid',difficulty='Normal'){
  return(type==='raid'?RAID_PROFILES:TOWER_PROFILES.filter(x=>x.difficulty===difficulty)).map(x=>({...x,type}));
}
