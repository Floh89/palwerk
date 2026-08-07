# PALWERK Optimizer — Phase 2 Stat Formula

Stand: 2026-08-07

## Entscheidung

PALWERK verwendet für Palworld 1.0 die native-validierte Stat-Reihenfolge aus der Arkive-Palworld-Data-Audit/Stat-Formula vom 19.07.2026, ergänzt am 23.07.2026 um die Passive-Schicht.

Primärquelle:
- `arkive-games/arkive/docs/superpowers/specs/2026-07-19-palworld-stat-formula.md`
- Rohquellen dort: `BP_PalGameSetting.json`, Palworld DataTables, JMAP und native Executable-Funktionen.
- Confidence: high
- Status: verified

Sekundärer Cross-Check:
- `deafdudecomputers/PalworldSaveTools/.opencode/skills/pst-stat-formula/SKILL.md`
- Diese Quelle nennt eine abweichende Zerlegung für Trust/Awakening und dokumentiert selbst ±1–2 Toleranzen sowie einen Anubis-Mismatch. Sie wird deshalb für die exakte PALWERK-Reihenfolge nicht priorisiert.

## Verifizierte Konstanten

- TalentRate = 0.003
- TribePlusHP = 10
- LevelMultiplierHP = 0.5
- ConstantHP = 500
- LevelMultiplierAttack = 0.075
- ConstantAttack = 100
- LevelMultiplierDefense = 0.075
- ConstantDefense = 50
- CondenseRate = 0.05 pro Stern
- SoulRate HP/ATK/DEF = 0.03 pro Soul-Rang
- Soul-Ränge = 0–20
- AwakeningMultiplier = 1.1
- Trust/Friendship-Rang positiv 0–10 für Statwachstum

## Reihenfolge

Für jeden Species-Stat:

1. Awakening multipliziert nur den ursprünglichen Species-Basewert.
2. Species-spezifisches Friendship-Wachstum × positiver Trust-Rang wird addiert.
3. Potential/IV wird auf diesen Basewert angewendet.
4. Level-Skalierung und jeweilige Konstante werden angewendet.
5. `floor`.
6. Condensation +5 % je Stern.
7. `floor`.
8. Souls +3 % je Rang.
9. `floor`.
10. Anwendbare statische Self-Passives werden als additive Prozentpunkte aggregiert und anschließend als Runtime-Buff-Layer angewendet.

Implants werden nicht als zusätzlicher universeller Multiplikator behandelt. Sie wirken über die Passive, die sie vergeben/ersetzen.

## Golden Master: Anubis

Species Stats: HP 100 / ATK 116 / DEF 100
Level 60, IV 100/100/100, 4 Sterne, Souls 20/20/20, Trust 0, nicht awakened.

Erwartet:
- HP0 = 4700
- HP1 = 5640
- HP = 9024
- ATK0 = 778
- ATK1 = 933
- ATK = 1492
- DEF0 = 635
- DEF1 = 762
- DEF = 1219

Mit +20 % ATK/+20 % DEF und +30 % ATK statischen Passives:
- effectiveAttack = 2238
- effectiveDefense = 1462

Diese Werte sind als verpflichtende Golden-Master-Tests in `tests/test-stat-formula.mjs` hinterlegt.

## Bewusste Grenze

`effectiveHP` wird in Phase 2 nicht numerisch ausgegeben. Die aktuelle Defense→Damage-Mitigation ist noch nicht mit derselben Confidence native-validiert. Bis dahin liefert `calculatePalStats()` `effectiveHP: null` plus einen expliziten provisional-Status.

## Engine-Integration

`src/optimizer/engine.js` verwendet ab API 3.14.0 `calculatePalStats()` statt der alten linearen Näherung `0.55 + level/...`.

Globale theoretische Endgame-Profile verwenden jetzt Soul-Rang 20 statt 10. Attack-Passives werden in der Statfunktion gerechnet und nicht nochmals als Attack-Multiplikator doppelt angewendet.

Element- und Active-Skill-Cooldown-Anteile des Passive-Builds bleiben bis Phase 11 eine separat als modelled gekennzeichnete Schicht; dort werden Passive-Kombination und Skillrotation gemeinsam optimiert.
