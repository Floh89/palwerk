# PALWERK Architecture

## Product rule

PALWERK is a local decision system, not a wiki. Every feature must produce a recommended next action, its reason, prerequisites and the expected measurable effect when confirmed game data allows that calculation.

## Runtime

- iPhone-first progressive web app
- static files only
- no backend, accounts, telemetry, APIs or recurring costs
- service worker provides offline app shell
- browser storage is the current persistence adapter
- JSON export is the first backup mechanism

## Layers

1. **Presentation**: mobile views and navigation. Views never own game logic.
2. **Application**: use cases such as profile completion, team building and farm prioritization.
3. **Domain**: deterministic rules, constraints, formulas and explanations.
4. **Data**: versioned confirmed game data and the user's local game state.
5. **Infrastructure**: storage, backup, service worker and future migration handlers.

## Data integrity

- Unknown values remain unknown; they are not replaced by guessed defaults.
- Recommendations must include the source data version used by the calculation.
- Scores are allowed only when every contributing factor is documented and reproducible.
- A recommendation that uses unavailable Pals, equipment or technology is invalid.
- User-owned data and canonical game data must remain separate.

## Persistence roadmap

The bootstrap uses localStorage to keep the first version dependency-free. Before the full Paldex dataset is integrated, persistence will move behind an adapter to IndexedDB with explicit schema migrations. Exported backups remain plain JSON and versioned.

## Planned domain modules

- player state and inventory
- canonical Pal, skill, passive, item, boss and material data
- build feasibility engine
- team synergy and damage model
- boss preparation gap analysis
- breeding path optimizer
- material and farming route optimizer
- disassembly value calculator
- base throughput planner

## Definition of done for a feature

A feature is accepted only when it:

- works fully offline after installation
- uses no invented values
- respects the actual user inventory
- explains the recommendation
- handles missing input explicitly
- is usable on an iPhone within three interactions from the home screen
- has deterministic test cases for calculations
