import { PAL_CATALOG, WORK_LABELS } from './catalog.js';
import {
  CANONICAL_META,
  PAL_GAME_RECORDS,
  ACTIVE_SKILL_RECORDS,
  PASSIVE_SKILL_RECORDS,
  BOSS_RECORDS,
  DE_PAL_TEXTS,
  DE_ACTIVE_SKILL_TEXTS,
  DE_PASSIVE_SKILL_TEXTS
} from './generated-core.js';

const app=document.querySelector('#app');
const esc=(value='')=>String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const normalize=value=>String(value??'').toLowerCase().replace(/[^a-z0-9äöüß]+/g,'');
const asArray=value=>Array.isArray(value)?value:value&&typeof value==='object'?Object.entries(value).map(([key,row])=>row&&typeof row==='object'?{__key:key,...row}:{__key:key,value:row}):[];
const palRecords=asArray(PAL_GAME_RECORDS);
const activeRecords=asArray(ACTIVE_SKILL_RECORDS);
const passiveRecords=asArray(PASSIVE_SKILL_RECORDS);
const bossRecords=asArray(BOSS_RECORDS);

function directIdentity(record){
  if(!record||typeof record!=='object')return[];
  const keys=['id','key','name','internalId','internal_id','characterId','character_id','characterID','codeName','code_name','assetName','asset_name','palName','pal_name','__key'];
  return keys.flatMap(key=>record[key]==null?[]:[normalize(record[key])]);
}

function findPalRecord(pal){
  const targets=[pal.internalId,pal.name,pal.key].filter(Boolean).map(normalize);
  return palRecords.find(record=>directIdentity(record).some(identity=>targets.some(target=>identity===target||identity.endsWith(target)||target.endsWith(identity))));
}

function findNamedValues(root,pattern,maxDepth=5){
  const found=[];
  const seen=new WeakSet();
  function walk(value,path,depth){
    if(value==null||depth>maxDepth)return;
    if(typeof value!=='object')return;
    if(seen.has(value))return;seen.add(value);
    for(const [key,child] of Object.entries(value)){
      const next=path?[...path,key]:[key];
      if(pattern.test(key))found.push({path:next.join('.'),value:child});
      if(child&&typeof child==='object')walk(child,next,depth+1);
    }
  }
  walk(root,[],0);
  return found;
}

function compact(value,limit=12){
  if(value==null)return[];
  if(Array.isArray(value))return value.slice(0,limit).map(item=>compactItem(item)).filter(Boolean);
  if(typeof value==='object')return Object.entries(value).slice(0,limit).map(([key,item])=>`${key}: ${compactItem(item)}`).filter(Boolean);
  return[String(value)];
}

function compactItem(value){
  if(value==null)return'';
  if(typeof value!=='object')return String(value);
  const preferred=['name','displayName','display_name','skillName','skill_name','id','key','level','rank','value','amount','power','cooldown','type'];
  const parts=preferred.filter(key=>value[key]!=null).slice(0,5).map(key=>`${key}: ${typeof value[key]==='object'?JSON.stringify(value[key]):value[key]}`);
  if(parts.length)return parts.join(' · ');
  return Object.entries(value).slice(0,4).map(([key,item])=>`${key}: ${typeof item==='object'?JSON.stringify(item):item}`).join(' · ');
}

function section(title,items,emptyText){
  const rows=items.flatMap(entry=>compact(entry.value)).slice(0,24);
  return`<section class="card data-enrichment-card"><div class="section-title"><h3>${esc(title)}</h3><span class="badge">${rows.length}</span></div>${rows.length?`<div class="list">${rows.map(row=>`<div class="list-item"><div><small>${esc(row)}</small></div></div>`).join('')}</div>`:`<p class="muted">${esc(emptyText)}</p>`}</section>`;
}

function localizedText(name){
  const candidates=[DE_PAL_TEXTS,DE_ACTIVE_SKILL_TEXTS,DE_PASSIVE_SKILL_TEXTS];
  const target=normalize(name);
  for(const source of candidates){
    for(const row of asArray(source)){
      if(directIdentity(row).some(identity=>identity===target))return compactItem(row);
    }
  }
  return'';
}

function relatedBosses(pal){
  const targets=[pal.internalId,pal.name].filter(Boolean).map(normalize);
  return bossRecords.filter(record=>{
    const text=normalize(JSON.stringify(record));
    return targets.some(target=>target&&text.includes(target));
  }).slice(0,12).map(record=>({value:record}));
}

function enrichDetail(){
  if(!app||app.querySelector('[data-pal-enrichment]'))return;
  const back=app.querySelector('[data-back-detail]');
  const heading=back?app.querySelector('h2'):null;
  if(!back||!heading)return;
  const pal=PAL_CATALOG.find(row=>normalize(row.name)===normalize(heading.textContent));
  if(!pal)return;
  const record=findPalRecord(pal);
  const wrapper=document.createElement('div');
  wrapper.dataset.palEnrichment='true';
  if(!record){
    wrapper.innerHTML=`<section class="card data-enrichment-card"><p class="eyebrow">KANONISCHE DATEN</p><h3>Noch nicht eindeutig verknüpft</h3><p class="muted">Für ${esc(pal.name)} wurde im Rohdatensatz noch kein sicherer interner Datensatz zugeordnet. Der Eintrag bleibt deshalb aus Berechnungen ausgeschlossen.</p></section>`;
  }else{
    const work=findNamedValues(record,/work|suitab|craft|watering|kindling|planting|mining|lumber|transport|cooling|medicine|gather/i);
    const skills=findNamedValues(record,/skill|move|learn|attack/i);
    const drops=findNamedValues(record,/drop|loot|item/i);
    const breeding=findNamedValues(record,/breed|egg|parent|child/i);
    const partner=findNamedValues(record,/partner|passive|ability/i);
    const stats=findNamedValues(record,/hp|health|attack|defen|stamina|speed|rarity|price|rank/i);
    const localized=localizedText(pal.name);
    wrapper.innerHTML=`<section class="card data-enrichment-card"><p class="eyebrow">KANONISCHE SPIELDATEN</p><h3>${esc(pal.name)}</h3><p>${localized?esc(localized):'Deutsche Texte werden bevorzugt; fehlende Felder erscheinen mit englischem Originalwert.'}</p><div class="work-chips"><span class="work-chip">Quelle <b>1.0</b></span><span class="work-chip">Datensatz <b>${esc(record.__key||record.id||record.internalId||pal.internalId||'verknüpft')}</b></span></div></section>${section('Arbeits- und Basiswerte',work,'Im Quelldatensatz wurde noch kein eindeutiges Arbeitsfeld erkannt.')}${section('Lernskills und Angriffe',skills,'Keine eindeutig zuordenbaren Lernskills erkannt.')}${section('Partner- und Passivdaten',partner,'Partnerfähigkeit noch nicht eindeutig zugeordnet.')}${section('Drops und Gegenstände',drops,'Keine eindeutig zuordenbaren Drops erkannt.')}${section('Zucht und Eier',breeding,'Keine eindeutig zuordenbaren Zuchtfelder erkannt.')}${section('Kampfwerte',stats,'Keine eindeutig zuordenbaren Kampfwerte erkannt.')}${section('Boss- und Spezialbezug',relatedBosses(pal),'Kein direkter Bossdatensatz gefunden.')}`;
  }
  const ownButton=[...app.querySelectorAll('button[data-own]')].at(-1);
  if(ownButton)ownButton.before(wrapper);else app.append(wrapper);
}

function enrichDashboard(){
  if(!app||app.querySelector('[data-core-meta]')||app.querySelector('[data-back-detail]'))return;
  const hero=app.querySelector('.hero');
  if(!hero)return;
  const card=document.createElement('section');
  card.className='card';card.dataset.coreMeta='true';
  card.innerHTML=`<p class="eyebrow">CORE DATABASE</p><h3>${Number(CANONICAL_META?.fullPalRecords||palRecords.length).toLocaleString('de-DE')} Rohdatensätze geladen</h3><p>${Number(CANONICAL_META?.moveCount||activeRecords.length).toLocaleString('de-DE')} aktive Skills · ${Number(CANONICAL_META?.passiveCount||passiveRecords.length).toLocaleString('de-DE')} passive Skills · ${Number(CANONICAL_META?.bossRecords||bossRecords.length).toLocaleString('de-DE')} Bossdatensätze</p>`;
  hero.after(card);
}

let queued=false;
const refresh=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enrichDetail();enrichDashboard()})};
new MutationObserver(refresh).observe(app,{childList:true,subtree:true});
refresh();
