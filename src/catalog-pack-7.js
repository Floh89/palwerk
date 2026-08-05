import { PAL_CATALOG } from './catalog.js';

const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const core=name=>({
  key:`registry-${slug(name)}`,paldeck:null,name,element:'Wird geprüft',work:{},
  partner:{name:'Partnerfähigkeit wird geprüft',description:'Dieser Registry-Eintrag stellt sicher, dass die Pal-Art im Offline-Paldex auswählbar ist. Nummer, Elemente, Arbeitsfähigkeiten und Fähigkeitstexte werden separat verifiziert.',effects:[{type:'pending_partner_text'}]},
  languageStatus:'de-pending',source:'palworld-1.0-species-registry-2026-07',verified:false,coreOnly:true
});

const NAMES=[
'Amione','Anubis','Arsox','Astegon','Azurmane','Azurobe','Bastigor','Beakon','Beegarde','Bellanoir','Blazamut','Blazehowl','Braloha','Bristla','Broncherry','Bushi','Caprity','Cattiva','Cawgnito','Celaray','Celesdir','Chikipi','Chillet','Cinnamoth','Clovee','Cremis','Croajiro','Cryolinx','Daedream','Dazemu','Dazzi','Depresso','Digtoise','Dinossom','Direhowl','Dogen','Dualith','Dumud','Eikthyrdeer','Elgrove','Elizabee','Elphidran','Faleris','Felbat','Fenglope','Finsider','Flambelle','Flopie','Foxcicle','Foxparks','Frostallion','Frostplume','Fuack','Fuddler','Galeclaw','Ghangler','Gildane','Gildra','Gloopie','Gobfin','Gorirat','Grintale','Grizzbolt','Gumoss','Hangyu','Hartalis','Helzephyr','Herbil','Hoocrates','Icelyn','Incineram','Jelliette','Jellroy','Jetragon','Jolthog','Jormuntide','Katress','Kelpsea','Kikit','Killamari','Kingpaca','Kitsun','Knocklem','Lamball','Leafan','Leezpunk','Lifmunk','Loupmoon','Lovander','Lullu','Lunaris','Lyleen','Mammorest','Maraith','Mau','Melpaca','Menasting','Mimog','Mossanda','Mozzarina','Muffly','Munchill','Necromus','Neptilius','Nitemary','Nitewing','Nox','Nyafia','Omascul','Orserk','Paladius','Palumbra','Pengullet','Penking','Petallia','Polapup','Prixter','Prunelia','Puffolt','Pupperai','Pyrin','Quivern','Ragnahawk','Rayhound','Reindrix','Relaxaurus','Reptyro','Ribbuny','Robinquill','Rooby','Rushoar','Sekhmet','Selyne','Shadowbeak','Shroomer','Sibelyx','Silvegis','Smokie','Snugloo','Sootseer','Sparkit','Splatterina','Starryon','Surfent','Suzaku','Swee','Sweepa','Tanzee','Tarantriss','Teafant','Tocotoco','Tombat','Turtacle','Univolt','Vaelet','Vanwyrm','Verdash','Vixy','Warsect','Whalaska','Wispaw','Wixen','Woolipop','Wumpo','Xenogard','Xenolord','Xenovader','Yakumo'
];

const existing=new Set(PAL_CATALOG.flatMap(x=>[String(x.key).toLowerCase(),String(x.name).toLowerCase()]));
for(const name of NAMES){
  if(existing.has(name.toLowerCase())) continue;
  const row=core(name);
  if(existing.has(row.key)) continue;
  PAL_CATALOG.push(row);
  existing.add(row.key);
  existing.add(name.toLowerCase());
}
PAL_CATALOG.sort((a,b)=>String(a.paldeck||'999Z').localeCompare(String(b.paldeck||'999Z'),undefined,{numeric:true})||a.name.localeCompare(b.name,'de'));
