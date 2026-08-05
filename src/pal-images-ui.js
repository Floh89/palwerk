import { PAL_CATALOG } from './catalog.js';

const app=document.querySelector('#app');
let available=new Set();

const normalize=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9äöüß]+/g,'');
const normalizeDeck=value=>String(value||'').replace(/^#/,'').trim().toUpperCase();
const byKey=new Map(PAL_CATALOG.map(p=>[p.key,p]));
const byName=new Map(PAL_CATALOG.map(p=>[normalize(p.name),p]));

async function loadManifest(){
  try{
    const response=await fetch('./assets/pals/manifest.json',{cache:'no-cache'});
    if(response.ok)available=new Set(await response.json());
  }catch{}
  decorate();
}

function isVariant(p){
  if(!p)return false;
  if(/[A-Z]$/i.test(String(p.paldeck||''))&&!/^\d+$/.test(String(p.paldeck||'')))return true;
  const id=String(p.internalId||'').toLowerCase();
  return id.includes('_')&&!/(boss|raid|tower|quest|enemy|friend|oilrig|summon)/.test(id);
}

function imageFileForPal(p){
  if(!p)return null;
  const explicit=normalizeDeck(p.imageKey||p.imageDeck||p.paldeck);
  if(explicit&&available.has(`${explicit}.png`)){
    if(isVariant(p)&&/^\d+$/.test(explicit)&&available.has(`${explicit}B.png`))return `${explicit}B.png`;
    return `${explicit}.png`;
  }
  const numeric=String(p.paldeck||'').match(/^\d+/)?.[0];
  if(!numeric)return null;
  const base=numeric.padStart(3,'0');
  if(isVariant(p)&&available.has(`${base}B.png`))return `${base}B.png`;
  return available.has(`${base}.png`)?`${base}.png`:null;
}

function palForCard(card){
  const key=card?.querySelector('[data-detail]')?.dataset.detail;
  if(key&&byKey.has(key))return byKey.get(key);
  const name=card?.querySelector('h3,h2,strong')?.textContent;
  return byName.get(normalize(name));
}

function addImage(host,p,large=false){
  if(!host||host.querySelector(':scope > .pal-art'))return;
  const file=imageFileForPal(p);
  if(!file)return;
  const figure=document.createElement('div');
  figure.className=`pal-art${large?' pal-art-large':''}`;
  const image=document.createElement('img');
  image.src=`./assets/pals/${file}`;
  image.alt=p?.name||'';
  image.loading=large?'eager':'lazy';
  image.decoding='async';
  image.addEventListener('error',()=>figure.remove(),{once:true});
  figure.append(image);
  host.prepend(figure);
}

function repairTeamImage(slot){
  const p=byName.get(normalize(slot.querySelector('strong')?.textContent));
  const file=imageFileForPal(p);
  const img=slot.querySelector('.team-pal-image');
  if(!file){if(img)img.remove();return}
  if(img){img.src=`./assets/pals/${file}`;img.alt=p?.name||'';return}
  const marker=slot.querySelector(':scope > span');
  const image=document.createElement('img');
  image.className='team-pal-image';
  image.src=`./assets/pals/${file}`;
  image.alt=p?.name||'';
  image.loading='lazy';
  marker?.after(image);
}

function decorate(){
  if(!app||!available.size)return;
  for(const card of app.querySelectorAll('.catalog-card'))addImage(card,palForCard(card));
  const back=app.querySelector('[data-back-detail]');
  if(back){const detailCard=back.nextElementSibling;addImage(detailCard,palForCard(detailCard),true)}
  for(const slot of app.querySelectorAll('.team-slot'))repairTeamImage(slot);
}

let queued=false;
new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;decorate()});
}).observe(app,{childList:true,subtree:true});

loadManifest();
