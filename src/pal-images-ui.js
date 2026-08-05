const app=document.querySelector('#app');
let available=new Set();

const normalizeDeck=value=>String(value||'').replace(/^#/,'').trim().toUpperCase();

async function loadManifest(){
  try{
    const response=await fetch('./assets/pals/manifest.json',{cache:'no-cache'});
    if(response.ok)available=new Set(await response.json());
  }catch{}
  decorate();
}

function imageForBadge(badge){
  const deck=normalizeDeck(badge?.textContent);
  return deck&&available.has(`${deck}.png`)?`./assets/pals/${deck}.png`:null;
}

function addImage(host,badge,large=false){
  if(!host||host.querySelector(':scope > .pal-art'))return;
  const source=imageForBadge(badge);
  if(!source)return;
  const figure=document.createElement('div');
  figure.className=`pal-art${large?' pal-art-large':''}`;
  const image=document.createElement('img');
  image.src=source;
  image.alt='';
  image.loading=large?'eager':'lazy';
  image.decoding='async';
  image.addEventListener('error',()=>figure.remove(),{once:true});
  figure.append(image);
  host.prepend(figure);
}

function decorate(){
  if(!app||!available.size)return;
  for(const card of app.querySelectorAll('.catalog-card')){
    addImage(card,card.querySelector('.badge'));
  }
  const back=app.querySelector('[data-back-detail]');
  if(back){
    const detailCard=back.nextElementSibling;
    addImage(detailCard,detailCard?.querySelector('.badge'),true);
  }
}

let queued=false;
new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;decorate()});
}).observe(app,{childList:true,subtree:true});

loadManifest();
