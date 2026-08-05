const app=document.querySelector('#app');
const esc=(v='')=>String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));

function selectedEncounter(){
  const select=app?.querySelector('select[name="target"]');
  if(!select?.value)return null;
  return window.PALWERK_COMBAT_DATA?.encounters?.find(x=>x.catalogId===select.value)||null;
}

function render(){
  const result=app?.querySelector('#hubResult');
  if(!result)return;
  const encounter=selectedEncounter();
  if(!encounter)return;
  result.querySelector('[data-combat-quality]')?.remove();
  const ready=encounter.exact?.hp!=null&&encounter.exact?.defense!=null&&encounter.exact?.timeLimit!=null&&encounter.exact?.resistances;
  const card=document.createElement('section');
  card.className='card';
  card.dataset.combatQuality='';
  const known=[encounter.level!=null?`Level ${encounter.level}`:null,encounter.location?.x!=null?'Koordinaten':null,encounter.baseStats?.hp!=null?'Pal-Basiswerte':null,encounter.exact?.hp!=null?'exakte HP':null,encounter.exact?.timeLimit!=null?'Zeitlimit':null,encounter.exact?.resistances?'Resistenzen':null].filter(Boolean);
  card.innerHTML=`<p class="eyebrow">DATENQUALITÄT DES GEGNERS</p><h3>${ready?'Simulationsfähig':'Noch keine vollständige Kampfsimulation'}</h3><p><b>${esc(encounter.name)}</b> · ${esc(encounter.type==='raid'?'Raid':'Boss')} ${encounter.level!=null?`· Level ${encounter.level}`:''}</p><p class="muted">Vorhanden: ${known.length?known.map(esc).join(' · '):'keine belastbaren Encounter-Werte'}</p>${encounter.missingFields?.length?`<p class="notice"><b>Noch fehlend:</b> ${encounter.missingFields.map(x=>esc(x.replace('exact.',''))).join(' · ')}</p>`:''}<p class="notice">${ready?'Die Werte können für eine numerische Kampfsimulation verwendet werden.':'PALWERK darf hier aktuell nur eine regelbasierte Empfehlung liefern, keine garantierte Kampfzeit oder Siegesschwelle.'}</p>`;
  result.prepend(card);
}

app?.addEventListener('change',e=>{if(e.target.matches('select[name="target"]'))setTimeout(render,0)});
app?.addEventListener('submit',e=>{if(e.target.matches('#clusterForm'))setTimeout(render,0)},true);
new MutationObserver(()=>{if(app.querySelector('#hubResult')&&!app.querySelector('[data-combat-quality]'))render()}).observe(app,{childList:true,subtree:true});
