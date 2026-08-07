import './catalog-pack-5.js';
import './catalog-pack-6.js';
import './catalog-pack-7.js';
import './generated-core.js';
import './generated-partner-data.js';
import './combat-data.js';
import { CANONICAL_PALS, canonicalDataReport } from './data/canonical-pals.js';
import { PASSIVES, passiveDataReport } from './data/passives.js';
import { SKILLS, skillDataReport } from './data/skills.js';
import { COMBAT_GRAPH, graphQualitySummary } from './knowledge/combat-graph.js';

import './app.js';
import './data-enrichment-ui.js';
import './pal-images-ui.js';
import { installOptimizerUI } from './optimizer/ui.js';
import { installSynergyUI } from './optimizer/synergy-ui.js';

installOptimizerUI();
installSynergyUI();

window.PALWERK_CANONICAL_PALS = CANONICAL_PALS;
window.PALWERK_PASSIVES = PASSIVES;
window.PALWERK_SKILLS = SKILLS;
window.PALWERK_COMBAT_GRAPH = COMBAT_GRAPH;
window.PALWERK_RUNTIME = Object.freeze({
  bootstrap: 'src/main.js',
  optimizer: 'src/optimizer/engine.js',
  passiveOptimizer: 'src/optimizer/passive-builds.js',
  skillOptimizer: 'src/optimizer/skill-rotations.js',
  canonicalData: 'src/data/canonical-pals.js',
  canonicalReport: canonicalDataReport(CANONICAL_PALS),
  passiveData: 'src/data/passives.js',
  passiveReport: passiveDataReport(PASSIVES),
  skillData: 'src/data/skills.js',
  skillReport: skillDataReport(SKILLS),
  knowledgeGraph: 'src/knowledge/combat-graph.js',
  knowledgeQuality: graphQualitySummary(COMBAT_GRAPH),
  synergy: 'src/optimizer/synergy.js',
  architectureVersion: '1.5.0'
});
