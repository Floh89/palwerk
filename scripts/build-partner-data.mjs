import fs from 'node:fs';

const readJson=(path,fallback)=>{try{return JSON.parse(fs.readFileSync(path,'utf8'))}catch{return fallback}};
const raw=readJson('data/upstream/partner-skills.json',{});
const scalesRaw=readJson('data/upstream/partner-scales.json',{});
const clean=value=>String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const num=value=>String(value??'').toUpperCase().replace(/[^0-9A-Z]/g,'');
const norm=value=>clean(value).toLowerCase();

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
function effectsFor(description){
  const t=norm(description),effects=[];
  const element=elementFrom(t);
  const push=(type,data={})=>{const key=JSON.stringify({type,...data});if(!effects.some(e=>JSON.stringify(e)===key))effects.push({type,...data})};
  if(/drop more items|more items when defeated|increases.*drops/.test(t))push('pal_drop_bonus',{targetElement:element,stackable:false});
  if(/increases attack power of .* pals|enhances .* attacks/.test(t))push('pal_element_attack',{element,stackable:false});
  if(/max carrying capacity|carry supplies|carrying capacity/.test(t))push('carry_capacity');
  if(/can be ridden as an? flying mount/.test(t))push('mount',{kind:'flying'});
  else if(/can be ridden/.test(t))push('mount',{kind:'ground'});
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
  const list=rowsOf(value);
  return list.map(row=>({
    skill:clean(row.skill||row.skill_name||row.Skill||row._pageName),
    effectType:clean(row.effect_type||row.Effect_Type||row.effect||row.Effect),
    target:clean(row.target||row.Target),
    level:Number(row.level||row.Level||row.rank||row.Rank||0),
    value:row.value??row.Value??row.scale??row.Scale??null
  })).filter(row=>row.skill&&row.level>0&&row.value!==null);
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
  const entry={palName:clean(row.pal_name),paldeck,skillName,description,effects:effectsFor(description),scales:(scaleIndex.get(norm(skillName))||[]).sort((a,b)=>a.level-b.level),source:'palworld-wiki-partner-data'};
  const existing=byPaldeck.get(paldeck);
  if(!existing||entry.description.length>existing.description.length)byPaldeck.set(paldeck,entry);
}

const partnerData=[...byPaldeck.values()].sort((a,b)=>a.paldeck.localeCompare(b.paldeck,undefined,{numeric:true}));
const report={generatedAt:new Date().toISOString(),partnerEntries:partnerData.length,withTypedEffects:partnerData.filter(x=>x.effects.length).length,withScaleValues:partnerData.filter(x=>x.scales.length).length};
const out=`import { PAL_CATALOG } from './catalog.js';\nexport const PARTNER_DATA=${JSON.stringify(partnerData)};\nexport const PARTNER_REPORT=${JSON.stringify(report)};\nconst normNum=v=>String(v??'').toUpperCase().replace(/[^0-9A-Z]/g,'');\nconst byNum=new Map(PARTNER_DATA.map(row=>[normNum(row.paldeck),row]));\nfor(const pal of PAL_CATALOG){const row=byNum.get(normNum(pal.paldeck));if(!row)continue;const prior=(pal.partner?.effects||[]).filter(e=>e.type!=='pending_partner_text');const effects=[...new Map([...prior,...row.effects].map(e=>[JSON.stringify(e),e])).values()];pal.partner={name:row.skillName,description:row.description,effects:effects.length?effects:[{type:'partner_description_only'}],source:row.source};pal.condensation={status:row.scales.length?'verified':'not-published',levels:row.scales,source:row.source};}\n`;
fs.writeFileSync('src/generated-partner-data.js',out);
fs.writeFileSync('partner-build-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
