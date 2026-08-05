export const RAID_PROFILES=[
  {id:'bellanoir',match:/bellanoir(?!.*libero)/i,name:'Bellanoir',level:30,hp:294000,timeLimit:600,elements:['Schatten'],phases:[{fromHpPct:100,toHpPct:0,elements:['Schatten']}],source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'bellanoir-libero',match:/bellanoir.*libero(?!.*ultra)/i,name:'Bellanoir Libero',level:50,hp:450000,timeLimit:600,elements:['Schatten','Eis'],phases:[{fromHpPct:100,toHpPct:0,elements:['Schatten']},{trigger:'revive-at-1-hp',elements:['Eis'],note:'Heilt sich und wechselt in die Eisphase.'}],source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'bellanoir-libero-ultra',match:/bellanoir.*libero.*ultra/i,name:'Bellanoir Libero (Ultra)',level:50,hp:900000,timeLimit:600,elements:['Schatten','Eis'],phases:[{fromHpPct:100,toHpPct:0,elements:['Schatten']},{trigger:'revive-at-1-hp',elements:['Eis'],note:'Heilt sich und wechselt in die Eisphase.'}],source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'blazamut-ryu',match:/blazamut.*ryu(?!.*ultra)/i,name:'Blazamut Ryu',level:55,hp:512680,timeLimit:600,elements:['Drache','Feuer'],phases:null,source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'blazamut-ryu-ultra',match:/blazamut.*ryu.*ultra/i,name:'Blazamut Ryu (Ultra)',level:55,hp:1025360,timeLimit:600,elements:['Drache','Feuer'],phases:null,source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'xenolord',match:/xenolord(?!.*ultra)/i,name:'Xenolord',level:60,hp:1316000,timeLimit:600,elements:['Schatten','Drache'],phases:null,source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'xenolord-ultra',match:/xenolord.*ultra/i,name:'Xenolord (Ultra)',level:60,hp:1974000,timeLimit:600,elements:['Schatten','Drache'],phases:null,source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'hartalis',match:/hartalis(?!.*ultra)/i,name:'Hartalis',level:65,hp:909000,timeLimit:600,elements:['Neutral','Gras','Wasser'],phases:null,source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'hartalis-ultra',match:/hartalis.*ultra/i,name:'Hartalis (Ultra)',level:65,hp:1212000,timeLimit:600,elements:['Neutral','Gras','Wasser'],phases:null,source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'moon-lord',match:/moon\s*lord(?!.*master)/i,name:'Moon Lord',level:50,hp:422500,timeLimit:600,elements:[],phases:null,source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'},
  {id:'moon-lord-master',match:/moon\s*lord.*master/i,name:'Moon Lord (Master)',level:65,hp:1956000,timeLimit:600,elements:[],phases:null,source:'palworld.wiki.gg Raid Bosses',verifiedAt:'2026-08-05'}
];

export const TOWER_PROFILES=[
  {id:'zoe-grizzbolt-normal',match:/grizzbolt/i,name:'Zoe & Grizzbolt',difficulty:'Normal',level:10,hp:30550,timeLimit:600,elements:['Elektro'],source:'palworld.wiki.gg Zoe and Grizzbolt',verifiedAt:'2026-08-05'},
  {id:'zoe-grizzbolt-hard',match:/grizzbolt/i,name:'Zoe & Grizzbolt',difficulty:'Schwer',level:55,hp:366200,timeLimit:300,elements:['Elektro'],adds:['Syndicate Crusher Lv. 55'],source:'palworld.wiki.gg Zoe and Grizzbolt',verifiedAt:'2026-08-05'},
  {id:'lily-lyleen-normal',match:/lyleen/i,name:'Lily & Lyleen',difficulty:'Normal',level:25,hp:69375,timeLimit:600,elements:['Gras'],source:'palworld.wiki.gg Lily and Lyleen',verifiedAt:'2026-08-05'},
  {id:'lily-lyleen-hard',match:/lyleen/i,name:'Lily & Lyleen',difficulty:'Schwer',level:55,hp:380000,timeLimit:300,elements:['Gras','Wasser'],adds:['2× Free Pal Alliance Devout Lv. 55'],source:'palworld.wiki.gg Lily and Lyleen',verifiedAt:'2026-08-05'},
  {id:'axel-orserk-normal',match:/orserk/i,name:'Axel & Orserk',difficulty:'Normal',level:40,hp:72900,timeLimit:600,elements:['Drache','Elektro'],source:'palworld.wiki.gg Axel and Orserk',verifiedAt:'2026-08-05'},
  {id:'axel-orserk-hard',match:/orserk/i,name:'Axel & Orserk',difficulty:'Schwer',level:55,hp:352200,timeLimit:300,elements:['Drache','Elektro'],adds:['Mossanda Lux Lv. 55','Relaxaurus Lux Lv. 55'],source:'palworld.wiki.gg Axel and Orserk',verifiedAt:'2026-08-05'},
  {id:'marcus-faleris-normal',match:/faleris/i,name:'Marcus & Faleris',difficulty:'Normal',level:45,hp:86275,timeLimit:600,elements:['Feuer'],source:'palworld.wiki.gg Marcus and Faleris',verifiedAt:'2026-08-05'},
  {id:'marcus-faleris-hard',match:/faleris/i,name:'Marcus & Faleris',difficulty:'Schwer',level:55,hp:352200,timeLimit:300,elements:['Feuer'],adds:['PIDF Infantry Lv. 55','PIDF Elite Lv. 55'],source:'palworld.wiki.gg Marcus and Faleris',verifiedAt:'2026-08-05'},
  {id:'victor-shadowbeak-normal',match:/shadowbeak/i,name:'Victor & Shadowbeak',difficulty:'Normal',level:50,hp:105000,timeLimit:600,elements:['Schatten'],source:'palworld.wiki.gg Victor and Shadowbeak',verifiedAt:'2026-08-05'},
  {id:'victor-shadowbeak-hard',match:/shadowbeak/i,name:'Victor & Shadowbeak',difficulty:'Schwer',level:55,hp:407500,timeLimit:300,elements:['Schatten'],phases:[{trigger:'30%-hp',note:'Beschwört einen gleich starken Klon.'}],source:'palworld.wiki.gg Victor and Shadowbeak',verifiedAt:'2026-08-05'}
];

export function profileForEncounter(encounter,difficulty='Normal'){
  const haystack=`${encounter?.name||''} ${encounter?.characterId||''} ${encounter?.catalogId||''}`;
  if(encounter?.type==='raid')return RAID_PROFILES.find(p=>p.match.test(haystack))||null;
  return TOWER_PROFILES.find(p=>p.difficulty===difficulty&&p.match.test(haystack))||null;
}
