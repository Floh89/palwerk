import { PAL_CATALOG } from '../catalog.js';
import { ACTIVE_SKILL_RECORDS } from '../generated-core.js';

const NUMBER = value => Number(value) || 0;
const normalize = value => String(value ?? '').trim().toLowerCase();
const ELEMENT_MAP = {
  Normal: 'Neutral', Neutral: 'Neutral', Fire: 'Feuer', Water: 'Wasser',
  Leaf: 'Gras', Grass: 'Gras', Electricity: 'Elektro', Electric: 'Elektro',
  Ice: 'Eis', Ground: 'Erde', Earth: 'Erde', Dark: 'Schatten', Dragon: 'Drache'
};
const COUNTER = {
  Feuer: 'Wasser', Wasser: 'Elektro', Gras: 'Feuer', Elektro: 'Erde',
  Eis: 'Feuer', Erde: 'Gras', Schatten: 'Drache', Drache: 'Eis', Neutral: 'Schatten'
};
const BLOCKED_ID = /astralym|amaterasuwolf|quest|avatar|enemy|friend|summon|tower|raid_|npc|human/i;
const DEFAULT_PROFILE = Object.freeze({
  level: 75,
  stars: 0,
  passives: [],
  activeSkills: [],
  activeSkillIds: [],
  ivs: { hp: 0, attack: 0, defense: 0 },
  souls: { hp: 0, attack: 0, defense: 0, work: 0 }
});

function elementsOf(pal) {
  return String(pal?.element || '').split('/').map(value => value.trim()).filter(Boolean);
}

function skillRecord(skill) {
  return skill?.data
    || ACTIVE_SKILL_RECORDS?.[skill?.id]
    || ACTIVE_SKILL_RECORDS?.[`EPalWazaID::${skill?.id}`]
    || null;
}

function skillMetrics(skill, pal, encounter, profile) {
  const record = skillRecord(skill);
  const rawPower = NUMBER(record?.power ?? skill?.power);
  const cooldown = Math.max(0.5, NUMBER(record?.cool_time ?? record?.cooldown ?? skill?.cooldown) || 10);
  const rawElement = record?.element ?? skill?.element ?? 'Neutral';
  const element = ELEMENT_MAP[rawElement] || rawElement;
  const targetElements = encounter?.phases?.length
    ? encounter.phases.flatMap(phase => phase.elements || [])
    : encounter?.elements || [];
  const wanted = new Set(targetElements.map(value => COUNTER[value]).filter(Boolean));
  const counterFit = wanted.has(element) ? 1.5 : 1;
  const stab = elementsOf(pal).includes(element) ? 1.2 : 1;

  // Animation, projectile travel and hit rate are not consistently available yet.
  // Conservative assumptions are explicit and returned to the caller.
  const animation = NUMBER(record?.animation) || 1.25;
  const hitRate = NUMBER(record?.hit_rate) || 0.72;
  const practicalScore = rawPower > 0
    ? (rawPower * counterFit * stab * hitRate) / (cooldown + animation)
    : 0;

  return {
    id: skill?.id,
    name: skill?.name || skill?.id || 'Unbekannter Skill',
    element,
    rawPower,
    cooldown,
    animation,
    hitRate,
    practicalScore,
    assumptions: [
      record?.animation ? null : 'Animationsdauer konservativ mit 1,25 s modelliert',
      record?.hit_rate ? null : 'Trefferquote konservativ mit 72 % modelliert'
    ].filter(Boolean)
  };
}

function profileFor(playerState, pal) {
  const source = playerState?.palProfiles?.[pal.key] || playerState?.palProfiles?.[pal.internalId] || {};
  return {
    ...DEFAULT_PROFILE,
    ...source,
    ivs: { ...DEFAULT_PROFILE.ivs, ...(source.ivs || {}) },
    souls: { ...DEFAULT_PROFILE.souls, ...(source.souls || {}) }
  };
}

function availableSkills(pal, profile, encounter) {
  const selected = new Set(profile.activeSkills || profile.activeSkillIds || []);
  return (pal?.skills || [])
    .filter(skill => NUMBER(skill.level) <= NUMBER(profile.level || 75))
    .filter(skill => !selected.size || selected.has(skill.id))
    .map(skill => skillMetrics(skill, pal, encounter, profile))
    .filter(skill => skill.rawPower > 0)
    .sort((a, b) => b.practicalScore - a.practicalScore);
}

function isUsablePal(pal) {
  if (!pal?.key || !pal?.name || BLOCKED_ID.test(`${pal.internalId || ''} ${pal.name}`)) return false;
  if (pal.flags?.towerBoss || pal.flags?.raidBoss) return false;
  if (pal.rawRecord?.capture_rate_correct === 0) return false;
  return NUMBER(pal.stats?.attack) > 0 && Array.isArray(pal.skills) && pal.skills.length > 0;
}

function partnerEffects(pal) {
  return Array.isArray(pal?.partner?.effects) ? pal.partner.effects : [];
}

function effectQuality(effect) {
  if (effect?.status === 'verified' || effect?.confidence === 'high') return 1;
  if (effect?.status === 'community-tested' || effect?.confidence === 'medium') return 0.7;
  if (effect?.status === 'modelled') return 0.45;
  return 0.25;
}

function supportUtility(pal, carry, activity) {
  let utility = 0;
  const reasons = [];
  const carryElements = new Set(elementsOf(carry.pal));

  for (const effect of partnerEffects(pal)) {
    const activation = effect.activation || 'unknown';
    const appliesInParty = activation === 'in_party' || effect.appliesTo === 'party' || !effect.activation;
    if (!appliesInParty && activity !== 'raid') continue;

    const numeric = NUMBER(effect.value ?? effect.percent ?? effect.amount);
    const quality = effectQuality(effect);
    const targetElement = effect.element || effect.targetElement;
    const matchingElement = !targetElement || carryElements.has(targetElement);
    let weight = 0;

    if (['pal_element_attack', 'weakpoint_damage', 'pal_attack', 'party_pal_attack'].includes(effect.type) && matchingElement) weight = 8;
    if (['cooldown_reduction', 'party_follow_attack'].includes(effect.type)) weight = 6;
    if (['player_attack', 'player_weapon_damage'].includes(effect.type)) weight = 5;
    if (['heal_player', 'revive_player', 'life_steal', 'damage_reduction'].includes(effect.type)) weight = 4;

    if (weight) {
      const contribution = weight * quality * (numeric ? Math.min(3, numeric / 10) : 0.5);
      utility += contribution;
      reasons.push(`${pal.partner?.name || 'Partnerfähigkeit'}: ${effect.type}${numeric ? ` (${numeric})` : ' (Wert offen)'}`);
    }
  }

  return { utility, reasons };
}

function carryModel(pal, profile, encounter) {
  const rotation = availableSkills(pal, profile, encounter).slice(0, 3);
  if (!rotation.length) return null;

  const levelFactor = 0.55 + Math.min(75, Math.max(1, NUMBER(profile.level || 75))) / 75 * 0.45;
  const ivFactor = 1 + Math.min(100, Math.max(0, NUMBER(profile.ivs?.attack))) * 0.003;
  const soulFactor = 1 + Math.min(10, Math.max(0, NUMBER(profile.souls?.attack))) * 0.03;
  const attackModel = NUMBER(pal.stats?.attack) * levelFactor * ivFactor * soulFactor;
  const practical = rotation.reduce((sum, skill) => sum + skill.practicalScore, 0) * attackModel / 100;

  return {
    pal,
    profile,
    rotation,
    relativeCombatValue: practical,
    estimatedDpsRange: {
      low: practical * 0.55,
      high: practical * 0.95
    },
    assumptions: [...new Set(rotation.flatMap(skill => skill.assumptions))]
  };
}

function combinations(items, choose, start = 0, prefix = [], output = []) {
  if (prefix.length === choose) {
    output.push(prefix);
    return output;
  }
  for (let index = start; index <= items.length - (choose - prefix.length); index += 1) {
    combinations(items, choose, index + 1, [...prefix, items[index]], output);
  }
  return output;
}

function describeRole(member, carry) {
  if (member.pal.key === carry.pal.key) return 'Aktiver Haupt-Pal';
  const types = partnerEffects(member.pal).map(effect => effect.type);
  if (types.some(type => ['pal_element_attack', 'weakpoint_damage', 'pal_attack', 'party_pal_attack'].includes(type))) return 'Schadensverstärker';
  if (types.some(type => ['cooldown_reduction', 'party_follow_attack'].includes(type))) return 'Tempo-/Begleitsupport';
  if (types.some(type => ['player_attack', 'player_weapon_damage'].includes(type))) return 'Spieler-Support';
  if (types.some(type => ['heal_player', 'revive_player', 'life_steal', 'damage_reduction'].includes(type))) return 'Sustain-Support';
  return 'Alternative / Wechsel-Pal';
}

function optimizeFivePalTeam({ encounter, playerState, ownedPals, constraints = {}, optimizationGoal = 'practical' }) {
  const ownedIds = new Set((ownedPals || []).map(item => item.catalogId || item.key || item.internalId));
  const ownedOnly = constraints.ownedOnly === true;
  const source = PAL_CATALOG.filter(pal => isUsablePal(pal) && (!ownedOnly || ownedIds.has(pal.key) || ownedIds.has(pal.internalId)));
  const carries = source
    .map(pal => carryModel(pal, profileFor(playerState, pal), encounter))
    .filter(Boolean)
    .sort((a, b) => b.relativeCombatValue - a.relativeCombatValue)
    .slice(0, 8);

  if (!carries.length) {
    return { status: 'insufficient-data', reason: 'Kein Pal mit auswertbarer Skillrotation verfügbar.', teams: [] };
  }

  let best = null;
  for (const carry of carries) {
    const supportPool = source
      .filter(pal => pal.key !== carry.pal.key)
      .map(pal => ({ pal, ...supportUtility(pal, carry, 'five_pal_team') }))
      .sort((a, b) => b.utility - a.utility)
      .slice(0, 14);

    const candidateGroups = combinations(supportPool, Math.min(4, supportPool.length));
    for (const group of candidateGroups) {
      const supportScore = group.reduce((sum, member) => sum + member.utility, 0);
      const qualitativeSurvival = group.filter(member => member.reasons.some(reason => /heal|revive|damage_reduction|life_steal/i.test(reason))).length * 2;
      const score = carry.relativeCombatValue + supportScore + qualitativeSurvival;
      if (!best || score > best.score) best = { carry, group, score };
    }
  }

  if (!best) return { status: 'insufficient-data', reason: 'Keine vollständige Fünferkombination berechenbar.', teams: [] };

  const members = [best.carry, ...best.group.map(member => ({
    pal: member.pal,
    profile: profileFor(playerState, member.pal),
    rotation: [],
    relativeCombatValue: 0,
    estimatedDpsRange: null,
    assumptions: [],
    supportUtility: member.utility,
    supportReasons: member.reasons
  }))].map(member => ({ ...member, role: describeRole(member, best.carry) }));

  return {
    status: 'ok',
    model: 'single-active-pal',
    optimizationGoal,
    teams: [{
      id: 'best-practical',
      label: 'Bestes nachvollziehbares Team',
      members,
      relativeTeamValue: best.score,
      estimatedActivePalDpsRange: best.carry.estimatedDpsRange,
      dataQuality: 'modelled',
      assumptions: [
        ...best.carry.assumptions,
        'Nur der aktive Haupt-Pal trägt eigenen Pal-Schaden bei.',
        'Support-Effekte ohne verifizierten Zahlenwert werden nur qualitativ gewichtet.',
        'Keine sekundengenaue Schadensgarantie.'
      ]
    }]
  };
}

/**
 * Single public optimization entry point.
 */
export function optimizeTeam({
  activity,
  encounter,
  playerState = {},
  ownedPals = [],
  constraints = {},
  optimizationGoal = 'practical'
} = {}) {
  if (!activity) throw new TypeError('activity is required');
  if (!encounter) throw new TypeError('encounter is required');

  if (activity === 'raid') {
    return {
      status: 'unsupported',
      model: 'raid-pending',
      reason: 'Die frühere Fünferteam-Summenlogik ist deaktiviert. Das getrennte Raid-Armee-Modell wird in Phase 2 konsolidiert.',
      teams: [],
      dataQuality: 'missing'
    };
  }

  if (['normal_team', 'tower', 'alpha_boss'].includes(activity)) {
    return optimizeFivePalTeam({ encounter, playerState, ownedPals, constraints, optimizationGoal });
  }

  return {
    status: 'unsupported',
    reason: `Für ${activity} existiert noch kein freigegebenes Berechnungsmodell.`,
    teams: [],
    dataQuality: 'missing'
  };
}

export const OPTIMIZER_API_VERSION = '1.0.0';
