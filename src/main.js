import './catalog-pack-5.js';
import './catalog-pack-6.js';
import './catalog-pack-7.js';
import './generated-core.js';
import './generated-partner-data.js';
import './combat-data.js';

import './app.js';
import './data-enrichment-ui.js';
import './pal-images-ui.js';
import { installOptimizerUI } from './optimizer/ui.js';
import { installSynergyUI } from './optimizer/synergy-ui.js';

installOptimizerUI();
installSynergyUI();

window.PALWERK_RUNTIME = Object.freeze({
  bootstrap: 'src/main.js',
  optimizer: 'src/optimizer/engine.js',
  synergy: 'src/optimizer/synergy.js',
  architectureVersion: '1.1.0'
});
