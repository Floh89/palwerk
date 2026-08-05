import { PAL_CATALOG } from './catalog.js';
import { RAID_PROFILES, TOWER_PROFILES } from './encounter-overrides.js';

const app=document.querySelector('#app');
const esc=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const norm=value=>String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');

function findPal(profile){
  const direct=PAL_CATALOG.find(p=>profile.match?.test(`${p.name} ${p.internalId||''}`));
  if(direct)return direct;
  const words=norm(profile.name).replace(/ultra|master|zoe|lily|axel|marcus|victor/g,'');
  return PAL_CATALOG.find(p=>norm(`${p.name}${p.internalId||''}`).includes(words)||words.includes(norm(p.name)));
}

function alphaProfiles(){
  const encounters=window.PALWERK_COMBAT_DATA?.encounters||[];
  const seen=new Set();
  return encounters.filter(e=>e.type==='alpha'&&e.catalogId&&!seen.has(e.catalogId)&&seen.add(e.catalogId)).map(e=>({
    id:e.id,
    name:e.name,
    difficulty:'Normal',
    level:e.level,
    hp:e.exact?.hp??null,
    timeLimit:e.exact?.timeLimit??null,
    elements:String(e.element||'').split('/').filter(Boolean),
    catalogId:e.catalogId,
    verified:false,
    source:'Spieldaten: Boss-Level und Spawnpunkt'
  }));
}

function isRaidForm(form){
  const text=form.closest('main')?.textContent||'';
  return /raid optimizer|raid-optimizer|raid/i.test(text)&&!/boss optimizer/i.test(text);
}

function profilesFor(form){
  if(isRaidForm(form))return RAID_PROFILES.map(p=>({...p,difficulty:'Raid',verified:true}));
  const difficulty=form.elements.difficulty?.value||'Normal';
  const towers=TOWER_PROFILES.filter(p=>p.difficulty===difficulty).map(p=>({...p,verified:true}));
  return [...towers,...alphaProfiles()];
}

function optionFor(profile){
  const pal=profile.catalogId?PAL_CATALOG.find(p=>p.key===profile.catalogId):findPal(profile);
  if(!pal)return null;
  const details=[profile.level?`Lv. ${profile.level}`:'',profile.hp?`${profile.hp.toLocaleString('de-DE')} HP`:'HP offen'].filter(Boolean).join(' · ');
  return {profile,pal,label:`${profile.name} · ${details}`};
}

function populate(form){
  const select=form.elements.target;
  if(!select)return;
  const previousProfile=form.elements.encounterProfile?.value||select.selectedOptions[0]?.dataset.profileId||'';
  const entries=profilesFor(form).map(optionFor).filter(Boolean);
  select.innerHTML=entries.length?entries.map(({profile,pal,label})=>`<option value="${esc(pal.key)}" data-profile-id="${esc(profile.id)}">${esc(label)}</option>`).join(''):'<option value="">Keine passenden Gegnerdaten gefunden</option>';
  let hidden=form.elements.encounterProfile;
  if(!hidden){hidden=document.createElement('input');hidden.type='hidden';hidden.name='encounterProfile';form.append(hidden);}
  const previous=[...select.options].find(o=>o.dataset.profileId===previousProfile);
  if(previous)previous.selected=true;
  hidden.value=select.selectedOptions[0]?.dataset.profileId||'';
  select.disabled=!entries.length;
}

function selectedProfile(form){
  const id=form.elements.encounterProfile?.value||form.elements.target?.selectedOptions[0]?.dataset.profileId;
  return [...RAID_PROFILES,...TOWER_PROFILES,...alphaProfiles()].find(p=>p.id===id)||null;
}

function injectMetrics(form){
  const result=document.querySelector('#hubResult');
  if(!result)return;
  result.querySelector('[data-encounter-metrics]')?.remove();
  const profile=selectedProfile(form);
  if(!profile)return;
  const hp=Number(profile.hp)||0;
  const seconds=Number(profile.timeLimit)||0;
  const minimumDps=hp&&seconds?hp/seconds:null;
  const safeDps=minimumDps?minimumDps*1.25:null;
  const phases=Array.isArray(profile.phases)&&profile.phases.length?profile.phases.map((phase,index)=>`<li>Phase ${index+1}: ${esc((phase.elements||[]).join('/')||phase.note||phase.trigger||'Details offen')}</li>`).join(''):'';
  const card=document.createElement('section');
  card.className='card';
  card.dataset.encounterMetrics='';
  card.innerHTML=`<p class="eyebrow">KAMPFANFORDERUNG</p><h3>${esc(profile.name)}</h3><div class="grid"><article><span class="muted">Gegnerlevel</span><div class="metric">${profile.level??'offen'}</div></article><article><span class="muted">HP</span><div class="metric">${hp?hp.toLocaleString('de-DE'):'offen'}</div></article><article><span class="muted">Zeitlimit</span><div class="metric">${seconds?`${Math.round(seconds/60)} Min.`:'offen'}</div></article><article><span class="muted">Team-DPS Ziel</span><div class="metric">${safeDps?Math.ceil(safeDps).toLocaleString('de-DE'):'offen'}</div></article></div>${minimumDps?`<p class="notice">Rechnerisches Minimum: ${Math.ceil(minimumDps).toLocaleString('de-DE')} Schaden pro Sekunde. PALWERK plant mit 25 % Reserve: ${Math.ceil(safeDps).toLocaleString('de-DE')} DPS.</p>`:'<p class="notice">Für diesen Gegner fehlen verifizierte HP oder ein Zeitlimit. Eine echte DPS-Schwelle wird nicht behauptet.</p>'}${phases?`<h4>Bekannte Phasen</h4><ul>${phases}</ul>`:''}<small class="muted">Quelle: ${esc(profile.source||'Encounter-Daten')} · Status: ${profile.verified===false?'teilweise verifiziert':'verifiziert'}</small>`;
  result.prepend(card);
}

function wire(form){
  if(form.dataset.encounterSelectorWired)return;
  form.dataset.encounterSelectorWired='true';
  populate(form);
  form.elements.target?.addEventListener('change',()=>{
    const hidden=form.elements.encounterProfile;
    if(hidden)hidden.value=form.elements.target.selectedOptions[0]?.dataset.profileId||'';
  });
  form.elements.difficulty?.addEventListener('change',()=>populate(form));
  form.addEventListener('submit',()=>setTimeout(()=>injectMetrics(form),0));
}

function scan(){
  document.querySelectorAll('#clusterForm').forEach(form=>{
    if(form.elements.target)wire(form);
  });
}

new MutationObserver(scan).observe(app,{childList:true,subtree:true});
scan();
