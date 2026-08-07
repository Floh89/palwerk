# PALWERK Optimizer – Phase 0 Research Matrix

Stand: 2026-08-07

Zweck: Verbindliche Research-Basis vor weiteren Änderungen an `src/optimizer/engine.js`.

## Source policy

Priorität für Optimizer-Fakten:

1. Pocketpair / offizielle Patchnotes
2. aktuelle strukturierte Game-Dumps
3. palworld.wiki.gg / strukturierte Wiki-Cargo-Daten
4. aktuelle Datamining-Projekte, sofern Build/Version genannt ist
5. reproduzierbare Community-Tests

Ein Konflikt zwischen Quellen wird nicht stillschweigend aufgelöst. Bis zur Klärung ist der betreffende Wert `provisional` und darf keine scheinbar exakte Empfehlung erzeugen.

Aktueller Baseline-Build: Palworld 1.0, Steam Build 24088745 (10.07.2026). Aktueller dokumentierter Maintenance-Patch: 1.0.2 (28.07.2026). 1.0 hat Pal-Stats, Fähigkeiten, aktive Skills und mehr als 200 Partner Skills umfangreich überarbeitet.

## Research matrix

| Mechanik | Aktueller Research-Stand | Primär-/Hauptquelle | Version / Datum | Confidence | Status | PALWERK-Konsequenz |
|---|---|---|---|---|---|---|
| Element-Matchup-Topologie | Wasser > Feuer; Feuer > Gras/Eis; Gras > Erde; Erde > Elektro; Elektro > Wasser; Eis > Drache; Drache > Schatten; Schatten > Neutral | palworld.wiki.gg Elements + Survival Guide | aktuell abgerufen 07.08.2026 | high | verified | Topologie kann verwendet werden. |
| Element-Multiplikator | Wiki nennt 2.0 / 0.5 / 1.0. Ein 1.0-Datamining-Tool für Build 24088745 nennt 1.5 pro Schwäche und 0.66 Resistenz; aktuelle Community-Tests stützen 1.5 / 2/3. | Wiki vs. palworld.tools Game-File Extraction | 1.0 / Juli 2026 | low wegen Konflikt | provisional | **Nicht** 2.0/0.5 hardcoden. Phase 1 muss den Konflikt aus Game-Daten lösen. |
| Dual-Element-Multiplikation | Datamining-Quelle beschreibt multiplikative 1.5² = 2.25 und 0.66² ≈ 0.44; Wiki dokumentiert stattdessen 4.0/0.25 theoretisch. | palworld.tools vs Wiki | 1.0 | low | provisional | Phase 1 braucht Game-Data-Golden-Master. |
| STAB / Same Element Bonus | +20 %, Faktor 1.2. Wiki und 1.0-Datamining stimmen überein. | palworld.wiki.gg Elements; palworld.tools build 24088745 | 1.0 | high | verified | 1.2 kann nach Phase-1-Test verwendet werden. |
| Pal Basiswerte | Level-0-Basis: HP 500, Attack 100, Defense 50. HP erhält zusätzlich 5 pro Level. Species scaling: HP ×0.5×Level, ATK/DEF ×0.075×Level. | palworld.wiki.gg Pal Stats | vor 1.0, aktuelle Species-Werte separat | medium | community-tested | Formelbasis brauchbar, aber 1.0-Erweiterungen müssen ergänzt werden. |
| Potential / IV | Hidden Potential 0–100; max. +30 % auf stat growth. Aktuelle 1.0-Datenbanken zeigen ebenfalls bis +30 %. | Wiki Pal Stats + palworld.tools 1.0 | 1.0 | high | verified | Aktuelle `IV * .003`-Idee trifft nur einen Teil; muss in echte Stat-Formel eingehen. |
| Levelskalierung | Dokumentierte Stat-Formel ist species-basiert und nicht linearer Multiplikator auf Gesamtattacke. | Wiki Pal Stats | aktuell verfügbar | high | verified | Aktueller `0.55 + level/...`-Factor ist unzulässig. |
| HP-Formel | `floor(floor(500 + 5L + HP_species*.5*L*(1+Potential)) * Bonusgruppen...)`; Trust verändert Species-Basis vor Bonus/rounding. | Wiki Pal Stats + Trust | bis 0.6/1.0 kompatibel, 1.0 Erweiterungen offen | medium | community-tested | Phase 2 muss Reihenfolge inkl. Awakening prüfen. |
| Attack-Formel | `floor(floor(100 + ATK_species*.075*L*(1+Potential)) * Bonusgruppen...)` als dokumentierte Grundlage. | Wiki Pal Stats | siehe oben | medium | community-tested | Phase 2 benötigt 1.0-Validierung. |
| Defense-Formel | `floor(floor(50 + DEF_species*.075*L*(1+Potential)) * Bonusgruppen...)` als dokumentierte Grundlage. | Wiki Pal Stats | siehe oben | medium | community-tested | Phase 2 benötigt 1.0-Validierung. |
| Pal Souls / Enhancement | Jede Stufe +3 %. Aktuelle Wiki-Tabelle geht bis Level 20 = +60 % pro Stat. | palworld.wiki.gg Pal Enhancement | zuletzt Feb 2026, in 1.0 weiterhin System | high | verified | Aktueller PALWERK-Cap 10/+30 % ist veraltet. |
| Condensation | 0–4 Sterne; pro Stern +5 % HP/Attack/Defense, max +20 %. Partner Skill Level steigt auf 1–5. | palworld.wiki.gg Pal Condensation | Jul/Aug 2026 | high für Statbonus | verified | Statbonus getrennt von Partner-Rank behandeln. |
| Condensation-Kosten | Wiki-Seite ist intern inkonsistent/legacy: Text nennt 116, aktuelle Tabelle zeigt 4/8/12/24 (=48). | palworld.wiki.gg | Jul/Aug 2026 | low | provisional | Für Combat-Optimizer zunächst irrelevant; keine Kostenbehauptung. |
| Trust | Level 0–10. `Friendship_Stat` wird je Trust-Level zu Species-Stats addiert, vor Bonusmultiplikatoren und vor initial rounding. 1.0-Dump bestätigt Rank-Tabelle. | Wiki Trust + palworld.tools 1.0 DT_FriendshipRankTable | 1.0 | high | verified | Muss in Phase 2 species-spezifisch eingehen, nicht als pauschaler Prozentwert. |
| Awakening | In 1.0 eingeführt; Awakening Crystals erhöhen permanent Base HP/Attack/Defense. Exakte numerische Statwirkung/Stacking-Reihenfolge in den geprüften öffentlichen Primärseiten nicht dokumentiert. | offizielle 1.0 Notes + Wiki Awakening Crystals | 1.0 | medium für Existenz, low für Formel | provisional | Kritischer Phase-2-Gate: keine erfundene Awakening-Skalierung. |
| Mutation | 1.0: mutierte Eier besitzen höhere Stats und eine einzigartige Passive. Exakte Statmodifikation noch nicht aus belastbarer Strukturquelle bestätigt. | offizielle 1.0 Notes | 1.0 | high für Mechanik, low für Formel | provisional | Mutation als eigene permanente Eigenschaft, nicht pauschal schätzen. |
| Implants | Surgery Table-Implants gewähren/ersetzen Passive Skills. Sie sind kein dokumentierter separater universeller Statmultiplikator. | palworld.wiki.gg Implant pages | 2026 | high | verified | Implants über resultierende Passives modellieren, nicht doppelt als Statfactor. |
| Passive Skills | Max. vier; identische Passive nicht doppelt auf demselben Pal. Mehrere unterschiedliche Passives derselben Statkategorie können additiv wirken. 1.0 hat neue/überarbeitete Passives. | Wiki Passive pages + offizielle 1.0 Notes + aktueller Dump | 1.0 | high | verified | Nur 1.0-Dump/aktuelle Werte verwenden. |
| Serenity | Cooldown -30 %, Attack +10 %. | Wiki / strukturierter Passive-Dump | aktuell | high | verified | Muss Rotation neu simulieren, nicht nur nachträglich Faktor multiplizieren. |
| Partner Skills allgemein | 1.0 hat >200 Partner Skills überarbeitet. Beschreibungen zeigen jetzt konkrete Werte/Rangänderungen. Fast alle identischen Pal-Arten sollen nicht mehrfach stacken. | offizielle 1.0 Notes | 1.0 | high | verified | Legacy Partnerdaten ohne 1.0-Abgleich sind ungültig. |
| Partner Rank Scaling | Skill-spezifische fünf Ränge. PALWERK lädt aktuell Wiki Cargo `PalPartnerSkillScale`; Werte müssen je kanonischem Effekt dedupliziert werden. | wiki Cargo / PartnerSkill module | Jul/Aug 2026 | high | verified | Cargo ist bevorzugte Rank-Quelle. |
| Partner Stacking | **Pro Partner Skill**, keine globale Regel. 1.0: fast alle gleichen Pal-Arten nicht stapelbar; einzelne Skills können andere Regeln haben. | offizielle 1.0 Notes + einzelne Partnerseiten | 1.0 | high | verified | `stackingRule` pro Effekt/Skill notwendig. |
| Sparkit | Static Electricity: Electric-Pal Attack +15/+17/+20/+24/+30; History 1.0: no longer stacks. | palworld.wiki.gg Sparkit | 1.0 | high | verified | Golden Master. |
| Menasting | Steel Scorpion: Electric-Pal Drop Bonus 40/50/60/70/80; zusätzlich Player Defense. Exact Defense ranks in Sekundärquellen konfliktbehaftet. | Wiki Cargo/page | 1.0 | high für Loot, medium Defense | verified/provisional | Loot-Effekt genau einmal kanonisch erzeugen. |
| Menasting Terra | Electric-Pal Drop Bonus 40/50/60/70/80; zusätzlich Player Defense. | Wiki Cargo/page | 1.0 | high für Loot | verified | Golden Master. |
| Orserk | 1.0 aktuelle Partnerfähigkeit: Treffer mit Bullet erhöht Attack und Defense des aktiven Pals für 5 s, bis zu 30 Stacks; Partnerfähigkeit selbst „does not stack“. Rank pro Stack laut 1.0-Datamining 1–5 %. | palworld.tools 1.0 + Wiki/Cargo noch zu kreuzvalidieren | 1.0 | medium-high | community-tested | Bedeutender universeller Carry-Support; braucht conditional stacking/uptime statt statischen Buff. |
| Mount-Boni | Mount-Skills können Player-Angriff, Elementkonvertierung, Pal-/Elementschaden oder andere Effekte haben. Effekt gilt nur bei konkreter Activation. | Wiki Partner/Condensation pages | aktuell | high | verified | Auto und mounted müssen getrennt bewertet werden. |
| Selyne mounted | Während mounted Neutral- und Dark-Element-Angriff +50/+55/+65/+80/+100. | Wiki Selyne/Condensation data | aktuell | high | verified | Golden Master für Auto-vs-Mounted-Modell. |
| Player Element Conversion | Z. B. Chillet/Ragnahawk/Kitsun Noct: beim Reiten wird Player Attack zum Pal-Element konvertiert und Player Attack zusätzlich erhöht. | aktuelle Wiki Partnerseiten | 1.0 | high | verified | Eigener Player/Hybrid-Damage-Pfad. |
| Player Attack Buffs | Gobfin/Gobfin Ignis in party; diverse mounted Partner Skills. Werte rankabhängig. | Wiki Condensation/Partner Cargo | aktuell | high | verified | Nicht auf Pal-DPS anwenden. |
| Pal Attack Buffs | Element-Supports und 1.0-neue conditional buffs. | offizielle Notes + Wiki Cargo | 1.0 | high | verified | Target/condition zwingend modellieren. |
| Partner-Skill Cooldown Reduction | Lapure reduziert Cooldowns anderer Partner Skills 10/15/20/30/50 %, does not stack. Das ist **nicht** Active-Skill-CDR. | palworld.wiki.gg Lapure | 1.0 | high | verified | Partner-CDR und Active-Skill-CDR strikt trennen. |
| Weakspot Bonus | Active damage calculator aus 1.0-Daten nennt weak-point factor 1.5. Partner-Skills wie Robinquill/Vanwyrm besitzen eigene Weakspot-Boni. Begriff kann physische Weakspots und elementare weakness in Beschreibungen vermischen. | palworld.tools build 24088745 + Wiki Partner data | 1.0 | medium | provisional | Zwei getrennte Konzepte im Datenmodell, bis Semantik je Skill bestätigt. |
| Aktive Skills | 1.0 rebalanced power, behavior, cooldown/usability of nearly all skills. Wiki listet element/power/CT und Skill-Fruit-Status. | offizielle 1.0 Notes + 1.0 Game Dump/Wiki | 1.0 | high | verified | Pre-1.0 Skillwerte verwerfen. |
| Skill Fruits | Skill Fruits können Skills Pal-unabhängig lehren, sofern Skill als Fruit verfügbar ist. | Wiki Active Skills / Skill Fruits | aktuell | high | verified | `skillFruitAvailable` separat. |
| Exclusive Skills | Eigene Liste; nicht frei auf andere Pals übertragbar. | Wiki Active Skills / Exclusive Active Skills | aktuell | high | verified | Carry-Skillpool muss Eligibility beachten. |
| Breeding-only/Egg Skills | Nachwuchs kann Active Skills erben; exklusive Skills können nicht vererbt werden. 1.0-Datenbanken zeigen Egg moves. | Wiki Breeding + 1.0 Datamining | aktuell | high | verified | `naturalLearners`, `egg/breeding`, `exclusive` getrennt. |
| Skill Animation / Projectile / Hit count | Power und CT sind strukturiert; exakte Animationsdauer, Projektilverhalten und Hit-Count liegen nicht für alle Skills als einheitliche öffentliche Tabelle vor. Holy Burst wurde in 1.0 explizit hit-count-capped. | offizielle 1.0 Notes + Skilldaten | 1.0 | medium/low je Feld | modelled wenn fehlend | Keine universellen Defaults als „verified“. Skill-Archetypen/Per-Skill-Modell nötig. |
| Boss Defensive Elements | Defensive Typisierung muss vom Boss-Pal bzw. Encounter-Datensatz kommen. | Game Dump / aktuelle Wiki Pal/Bossdaten | 1.0 | high | verified | Separates Feld `defensiveElements`. |
| Boss Attack Elements | Tower/Bosse können Skills anderer Elemente nutzen. Beispiel Lily Hard nutzt viel Water trotz Lyleen Grass; Zoe Hard nutzt Grass zusätzlich. | aktuelle Boss-Wiki-Seiten | 1.0 | high | verified | Darf Survival beeinflussen, **nicht** offensive Weakness. |
| Boss Resistances / Encounter scaling | Pal-/Boss-Daten besitzen Encounter Scaling wie Receive Damage Rate; Spezialresistenzen können encounter-spezifisch sein. Vollständige aktuelle Matrix noch nicht vereinheitlicht. | Game Dump / Wiki Pal pages | 1.0 | medium | provisional | Phase 12/13 muss strukturiert extrahieren. |
| Boss Phases | Nur echte Trigger/Phasen übernehmen. Victor Hard: Klon bei ca. 30 % HP ist dokumentiert. Bellanoir Libero besitzt Dark→Ice transition; genauer Trigger/heal muss strukturiert validiert werden. | aktuelle Wiki Boss/Raid pages | 1.0 | medium-high | verified/provisional je Boss | Niemals `1 / phaseCount` als Fakt. |
| Tower Time Limit | Offizielle 1.0 Notes: von 10 Minuten auf 5 Minuten reduziert. | Pocketpair 1.0 Changelog | 1.0, 10.07.2026 | high | verified | Alte 600-s-Towerwerte sind falsch. Standard 300 s. |
| Tower Roster | Aktuell mindestens Zoe, Lily, Axel, Marcus, Victor, Saya, Bjorn, Auri; 1.0 ergänzt außerdem final Zenara & Astralym. | Wiki Tower + 1.0 datamining | Jul 2026 | high | verified | Aktuelle PALWERK-Liste mit nur fünf Towerpaaren ist unvollständig. |
| Tower Levels | Wiki aktuell: Zoe 15/55, Lily 25/55, Axel 40/55, Marcus 45/55, Victor 50/55, Saya 55/55, Bjorn 58/60, Auri 70/80. Datamining-Seiten zeigen einzelne Konflikte (z. B. Auri 68 in Guide). | Wiki Tower vs 1.0 datamining | Jul 2026 | medium | provisional bei Konflikten | Phase 12 muss Boss-Record/Game-Dump gegen Wiki prüfen, bevor Level übernommen wird. |
| Lily Hard | Defensive Pal type = Grass. Water ist Teil ihres Attack-Kits, nicht zweites defensives Element. | Lyleen/Boss current wiki | 1.0 | high | verified | Golden Master: Water darf keine Electric offensive weakness erzeugen. |
| Raid Roster | Bellanoir, Bellanoir Libero/Ultra, Blazamut Ryu/Ultra, Xenolord/Ultra, Hartalis/Ultra, Moon Lord/Master. | current Raid Bosses wiki | aktuell | high | verified | Roster als eigene DB. |
| Raid Level/HP | Wiki bestätigt u.a. Bellanoir 30/294k, Libero 50/450k, Ultra 50/900k, Blazamut Ryu 55/512680, Ultra 1025360, Xenolord 60/1316000, Ultra 1974000; weitere Werte stehen in derselben Raidquelle. | Raid Bosses wiki | aktuell | high für sichtbare Werte | verified | Phase 15 vollständig strukturieren. |
| Moon Lord | Multipart boss; Körperteile haben eigene HP und werden nach Zerstörung nicht weiter getroffen. | Wiki Moon Lord | aktuell | high | verified | Kein normaler einteiliger Pal-Boss. |
| Alpha Bosses | Aktuelle 1.0 Game-Daten enthalten konkrete Alpha/Sealed-Realm-Spawns, Level und Positionen. | 1.0 datamining | Build 24088745 | high | verified | Keine Freitext-Bossdefinition im finalen Optimizer. |
| Player Carry Inputs | Player-Damage hängt an Weapon/Base Damage, Player Attack, equipment/food/partner effects, element conversion/mounted modifiers. Vollständige aktuelle Weapon-Formel noch nicht recherchiert. | Game data + Partner data | 1.0 | medium | provisional | Eigener Player-Carry-Pfad; nicht als Pal-DPS-Gewicht simulieren. |
| Damage/Defense engine formula | Öffentliche Community-Formeln existieren; ein 1.0-Datamining-Tool sagt explizit, finale Defense-Mitigation laufe in Engine-Code und liefert deshalb nur proportionalen Damage Score. | palworld.tools + Community | 1.0 | low-medium | provisional | Keine scheinbar exakten HP-DPS bis Engine-Formel verifiziert ist. |

## Repository audit – blockers discovered before Phase 1

1. `src/optimizer/engine.js` verwendet aktuell eine lineare Level-Approximation und pauschale IV/Soul-Faktoren. Das ist nicht mit der dokumentierten Statstruktur vereinbar.
2. Souls sind im theoretischen Profil aktuell auf 10 begrenzt; das aktuelle Enhancement-System geht bis 20 / +60 %.
3. Passives werden derzeit nach der Rotation als `powerGain` multipliziert statt gemeinsam mit Stats/CDR/Rotation optimiert.
4. Carry-Suche schneidet aktuell nach Roh-Combat-Value auf Top 16 ab. Das kann Synergy-Carrys vor der Teamsuche entfernen.
5. `src/encounter-overrides.js` enthält mehrere 600-s-Normal-Towerprofile; seit 1.0 gilt 300 s.
6. Lily Hard ist dort als `Grass + Water` defensiv modelliert. Water gehört in `attackElements`.
7. Encounter-Datenmodell trennt derzeit nicht sauber `defensiveElements` und `attackElements`.
8. `encounterPhases()` verteilt bei fehlendem `hpShare` automatisch gleichmäßig. Das ist laut Research nicht als Fakt zulässig.
9. Core-Data-Merge priorisiert aktuell ganze Datensätze nach „richness“. Das verletzt Field-Level Source Priority.
10. 1.0-Awakening ist in der aktuellen Statberechnung nicht belastbar integriert.
11. Partner-Stacking muss von einer generischen Boolean/Group-Logik zu einer expliziten `stackingRule` pro Partner Skill weiterentwickelt werden.
12. Partner-Skill-CDR (z. B. Lapure) und Active-Skill-CDR (z. B. Serenity) sind unterschiedliche Mechaniken und dürfen nicht zusammengeführt werden.
13. Der Towerbestand ist für 1.0 unvollständig; Zenara & Astralym existiert als finaler Boss zusätzlich zu den acht Fraktions-/Regionstürmen.

## Hard research gates before implementation

### Gate A – Phase 1 Element multiplier

Noch **nicht abgeschlossen**: Wiki dokumentiert 2.0 / 0.5, während eine aktuelle Game-File-Extraktion aus Build 24088745 1.5 / 0.66 meldet. STAB 1.2 ist konsistent. Phase 1 darf erst nach direkter Prüfung der aktuellen Game-Data/Param-Quelle implementieren.

### Gate B – Phase 2 full 1.0 stats

Noch **nicht abgeschlossen**: exakte Awakening-/Mutation-Auswirkung und Einordnung in die Stat-Reihenfolge. Trust, Potential, Souls, Condensation und Species Scaling sind deutlich besser belegt.

### Gate C – exact final damage

Die finale Defense-Mitigation ist noch nicht belastbar aus aktueller Engine-/Game-Data verifiziert. Bis dahin sind nur relative/modelled Damage Scores zulässig.

## Phase-0 decision

Keine der aktuellen Näherungsformeln wird als verifizierte 1.0-Mechanik übernommen. Phase 1 beginnt mit der Auflösung des Element-Multiplikator-Konflikts gegen aktuelle Game-Daten. Erst danach werden Element-Golden-Master-Tests geschrieben und die produktive Elementlogik ersetzt.
