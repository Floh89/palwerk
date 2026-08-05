import fs from 'node:fs';

const readJson=(path,fallback)=>{try{return JSON.parse(fs.readFileSync(path,'utf8'))}catch{return fallback}};
const raw=readJson('data/upstream/partner-skills.json',{});
const scalesRaw=readJson('data/upstream/partner-scales.json',{});
const clean=value=>String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const num=value=>String(value??'').toUpperCase().replace(/[^0-9A-Z]/g,'');
const norm=value=>clean(value).toLowerCase();
const generatedAt=new Date().toISOString();
const GAME_VERSION='1.0';
const SOURCE='palworld-wiki-partner-data';

function rowsOf(value){
  if(Array.isArray(value))return value.flatMap(rowsOf);
  if(!value||typeof value!=='object')return [];
  if(value.pal_name||value.pal_num||value.skill_name)return [value];
  return Object.values(value).flatMap(rowsOf);
}
function elementFrom(text){
  const map=[['fire','Feuer'],['water','Wasser'],['grass','Gras'],['electric','Elektro'],['electricity','Elektro'],['ice','Eis'],['ground','Erde'],['earth','Erde'],['dark','Schatten'],['dragon','Drache'],['normal','Neutral']];
  for(const [key,value] of map)if(text.includes(key))return value;
  return null;
}
function activationFrom(text,type){
  if(/while in team|while in party|in your party|when in team/.test(text))return'in_party';
  if(/while mounted|when mounted|can be ridden|riding/.test(text))return'mounted';
  if(/when assigned to .*base|while assigned to .*base/.test(text))return'base_assigned';
  if(/assigned to .*ranch|assigned to .*farm/.test(text))return'ranch';
  if(/when bred|breeding parent|while breeding/.test(text))return'breeding_parent';
  if(/when deployed in a raid|raid deployed/.test(text))return'raid_deployed';
  if(/when fighting together|when summoned|while active|follows up player attacks|attacks targeted enemy/.test(text))return'summoned';
  if(/when it defeats|when .* defeats|more items when defeated/.test(text))return'pal_defeats_target';
  if(/when picked up|manual pickup|while gathering eggs|collecting eggs/.test(text))return'manual_pickup';
  if(/player attacks|player's attacks|changes the player's attack type/.test(text))return'player_attack';
  if(['mount','glider','active_weapon','active_launcher','active_grenade','double_jump'].includes(type))return'mounted';
  if(['farm_drop'].includes(type))return'ranch';
  if(['base_work_suitability_boost'].includes(type))return'base_assigned';
  return'unknown';
}
function equipmentFor(text,type){
  const required=/requires .*saddle|with .*saddle|using .*saddle|can be ridden|mount/.test(text)||['mount','active_weapon','active_launcher','active_grenade','glider','double_jump'].includes(type);
  return{requiresEquipment:required,equipmentId:required?'pal-specific-equipment':null};
}
function stackingFor(type,element,target){
  const group=[type,element||target||'general'].join(':');
  const knownNonStackable=['mount','glider','active_weapon','active_launcher','active_grenade','heal_player','revive_player','double_jump','movement_speed','player_attack_element_conversion','base_work_suitability_boost','farm_drop'];
  return{stackingGroup:group,stackable:knownNonStackable.includes(type)?false:null};
}
function appliesToFor(type){
  if(['player_attack','player_defense','player_weapon_damage','player_attack_element_conversion','heal_player','revive_player','carry_capacity','item_weight_reduction'].includes(type))return['player'];
  if(['pal_element_attack','pal_attack','party_pal_attack','cooldown_reduction'].includes(type))return['party_pals'];
  if(['pal_drop_bonus'].includes(type))return['loot'];
  if(['base_work_suitability_boost','farm_drop'].includes(type))return['base'];
  if(['mount','glider','movement_speed','double_jump'].includes(type))return['movement'];
  return['special'];
}
function makeEffect(type,text,data={}){
  const activation=activationFrom(text,type);
  const equipment=equipmentFor(text,type);
  const target=data.targetElement||data.target||null;
  return{
    type,
    activation,
    requiresEquipment:equipment.requiresEquipment,
    equipmentId:equipment.equipmentId,
    ...stackingFor(type,data.element,target),
    target:data.target||null,
    element:data.element||data.targetElement||null,
    valuesByRank:null,
    appliesTo:appliesToFor(type),
    conditions:[],
    source:SOURCE,
    gameVersion:GAME_VERSION,
    verifiedAt:null,
    confidence:'low',
    status:'provisional',
    ...data
  };
}
function effectsFor(description){
  const t=norm(description),effects=[];
  const element=elementFrom(t);
  const push=(type,data={})=>{const effect=makeEffect(type,t,data);const key=JSON.stringify([effect.type,effect.activation,effect.element,effect.target]);if(!effects.some(e=>JSON.stringify([e.type,e.activation,e.element,e.target])===key))effects.push(effect)};
  if(/drop more items|more items when defeated|increases.*drops/.test(t))push('pal_drop_bonus',{targetElement:element,target:element});
  if(/increases attack power of .* pals|enhances .* attacks/.test(t))push('pal_element_attack',{element});
  if(/max carrying capacity|carry supplies|carrying capacity/.test(t))push('carry_capacity');
  if(/can be ridden as an? flying mount/.test(t))push('mount',{target:'flying'});
  else if(/can be ridden/.test(t))push('mount',{target:'ground'});
  if(/glider|gliding/.test(t))push('glider');
  if(/restore.*hp|heals? the player|restore the player's hp/.test(t))push('heal_player');
  if(/revive|resuscitate/.test(t))push('revive_player');
  if(/life steal|absorbs some.*damage.*restores/.test(t))push('life_steal');
  if(/player's defense|increases the player's defense/.test(t))push('player_defense');
  if(/player's attack|increases attack/.test(t)&&!/attack power of .* pals/.test(t))push('player_attack');
  if(/applies .* damage to the player's attacks|changes the player's attack type/.test(t))push('player_attack_element_conversion',{element});
  if(/double jump/.test(t))push('double_jump');
  if(/cutting trees|destroying boulders|mining efficiency/.test(t))push(/tree/.test(t)?'logging_efficiency':'mining_efficiency');
  if(/when assigned to .*farm|assigned to .*ranch|sometimes produces|sometimes drops|digs up/.test(t))push('farm_drop');
  if(/base.*work suitability|increases .* work suitability level/.test(t))push('base_work_suitability_boost');
  if(/submachine gun|assault rifle|gatling|launcher|grenade|flamethrower/.test(t))push('active_weapon');
  if(/follows up player attacks|additional attack|attacks targeted enemy/.test(t))push('party_follow_attack');
  if(/cooldown/.test(t))push('cooldown_reduction');
  if(/movement speed|move speed|faster while mounted/.test(t))push('movement_speed');
  return effects;
}
function scaleRows(value){
  return rowsOf(value).map(row=>({
    skill:clean(row.skill||row.skill_name||row.Skill||row._pageName),
    effectType:clean(row.effect_type||row.Effect_Type||row.effect||row.Effect),
    target:clean(row.target||row.Target),
    level:Number(row.level||row.Level||row.rank||row.Rank||0),
    value:row.value??row.Value??row.scale??row.Scale??null
  })).filter(row=>row.skill&&row.level>0&&row.value!==null);
}
function valuesByRank(rows){
  if(!rows.length)return null;
  const values=Array(5).fill(null);
  for(const row of rows){const index=Math.max(0,Math.min(4,row.level-1));const numeric=Number(row.value);values[index]=Number.isFinite(numeric)?numeric:row.value;}
  return values.some(value=>value!==null)?values:null;
}

const scaleIndex=new Map();
for(const row of scaleRows(scalesRaw)){
  const key=norm(row.skill);
  if(!scaleIndex.has(key))scaleIndex.set(key,[]);
  scaleIndex.get(key).push(row);
}

const byPaldeck=new Map();
for(const row of rowsOf(raw)){
  const paldeck=num(row.pal_num||row.paldeck||row.pal_number);
  if(!paldeck||paldeck==='NA')continue;
  const skillName=clean(row.skill_name||row.skill||'Partner Skill');
  const description=clean(row.description);
  const scales=(scaleIndex.get(norm(skillName))||[]).sort((a,b)=>a.level-b.level);
  const rankValues=valuesByRank(scales);
  const effects=effectsFor(description).map(effect=>rankValues?{...effect,valuesByRank:rankValues,confidence:'medium',status:'community-tested',verifiedAt:generatedAt}:effect);
  const entry={palName:clean(row.pal_name),paldeck,skillName,description,effects,scales,source:SOURCE,gameVersion:GAME_VERSION,generatedAt};
  const existing=byPaldeck.get(paldeck);
  if(!existing||entry.description.length>existing.description.length)byPaldeck.set(paldeck,entry);
}

const partnerData=[...byPaldeck.values()].sort((a,b)=>a.paldeck.localeCompare(b.paldeck,undefined,{numeric:true}));
const allEffects=partnerData.flatMap(row=>row.effects);
const report={generatedAt,partnerEntries:partnerData.length,effectCount:allEffects.length,withTypedEffects:partnerData.filter(x=>x.effects.length).length,withRankValues:allEffects.filter(x=>Array.isArray(x.valuesByRank)).length,unknownActivation:allEffects.filter(x=>x.activation==='unknown').length,unknownStackability:allEffects.filter(x=>x.stackable===null).length};
const out=`import { PAL_CATALOG } from './catalog.js';\nexport const PARTNER_EFFECT_SCHEMA_VERSION='2.0.0';\nexport const PARTNER_DATA=${JSON.stringify(partnerData)};\nexport const PARTNER_REPORT=${JSON.stringify(report)};\nconst normNum=v=>String(v??'').toUpperCase().replace(/[^0-9A-Z]/g,'');\nconst byNum=new Map(PARTNER_DATA.map(row=>[normNum(row.paldeck),row]));\nfor(const pal of PAL_CATALOG){const row=byNum.get(normNum(pal.paldeck));if(!row)continue;const prior=(pal.partner?.effects||[]).filter(e=>e.type!=='pending_partner_text');const normalized=prior.map(e=>({activation:'unknown',requiresEquipment:false,equipmentId:null,stackingGroup:e.stackingGroup||[e.type,e.element||e.targetElement||e.target||'general'].join(':'),stackable:e.stackable??null,target:e.target||e.targetElement||null,element:e.element||e.targetElement||null,valuesByRank:Array.isArray(e.valuesByRank)?e.valuesByRank:null,appliesTo:Array.isArray(e.appliesTo)?e.appliesTo:['special'],conditions:Array.isArray(e.conditions)?e.conditions:[],source:e.source||'legacy-palwerk-data',gameVersion:e.gameVersion||null,verifiedAt:e.verifiedAt||null,confidence:e.confidence||'low',status:e.status||'provisional',...e}));const effects=[...new Map([...normalized,...row.effects].map(e=>[JSON.stringify([e.type,e.activation,e.element,e.target,e.stackingGroup]),e])).values()];pal.partner={name:row.skillName,description:row.description,effects:effects.length?effects:[{type:'partner_description_only',activation:'unknown',requiresEquipment:false,equipmentId:null,stackingGroup:'partner_description_only',stackable:false,target:null,element:null,valuesByRank:null,appliesTo:['special'],conditions:[],source:row.source,gameVersion:row.gameVersion,verifiedAt:null,confidence:'low',status:'missing'}],source:row.source,gameVersion:row.gameVersion};pal.condensation={status:row.scales.length?'community-tested':'missing',levels:row.scales,source:row.source,gameVersion:row.gameVersion};}\n`;
fs.writeFileSync('src/generated-partner-data.js',out);
fs.writeFileSync('partner-build-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
