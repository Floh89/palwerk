import { PAL_CATALOG } from '../catalog.js';

const text = value => String(value ?? '').trim();
const slug = value => text(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const parseDex = value => {
  const match = text(value).toUpperCase().match(/^(\d+)([A-Z]+)?$/);
  return match
    ? { number: Number(match[1]), suffix: match[2]?.toLowerCase() || null }
    : { number: null, suffix: null };
};
const BLOCKED = /astralym|amaterasuwolf|quest|avatar|enemy|friend|summon|tower|raid_|npc|human/i;
const CANONICAL_ALIASES = Object.freeze({ thunderdragonman: 'orserk', oserk: 'orserk' });

export const CANONICAL_PAL_SCHEMA = '1.2.0';

export function isPlayableCatalogPal(pal) {
  return Boolean(
    pal?.name &&
    !BLOCKED.test(`${pal.internalId || ''} ${pal.name}`) &&
    !pal.flags?.towerBoss &&
    !pal.flags?.raidBoss &&
    pal.rawRecord?.capture_rate_correct !== 0
  );
}

function technicalId(pal) {
  return text(pal?.internalId || pal?.key || pal?.rawRecord?.id || pal?.name);
}

function canonicalIdFor(pal) {
  const explicit = text(pal?.canonicalId);
  if (explicit) return slug(explicit);
  const name = slug(pal?.name);
  const technical = slug(technicalId(pal));
  return CANONICAL_ALIASES[technical] || CANONICAL_ALIASES[name] || name || technical;
}

function variantIdFor(pal, canonicalId, dexSuffix) {
  if (dexSuffix) return dexSuffix;
  const technical = slug(technicalId(pal));
  if (!technical || technical === canonicalId || CANONICAL_ALIASES[technical] === canonicalId) return 'base';
  const stripped = technical.replace(new RegExp(`^${canonicalId}-?`), '');
  return stripped || technical;
}

function sourceIds(pal) {
  return [...new Set([pal?.key, pal?.internalId, pal?.rawRecord?.id].map(text).filter(Boolean))];
}

function richness(pal) {
  return (pal?.skills?.length || 0) * 3 +
    Object.keys(pal?.work || {}).length * 2 +
    (pal?.stats?.attack ? 4 : 0) +
    (pal?.stats?.hp ? 2 : 0) +
    (pal?.partner?.effects?.length || 0) * 2 +
    (pal?.rawRecord ? 5 : 0) +
    (pal?.verified ? 1 : 0);
}

function buildRows(catalog) {
  return catalog.filter(isPlayableCatalogPal).map(pal => {
    const canonicalId = canonicalIdFor(pal);
    const dex = parseDex(pal.paldeck);
    const variantId = variantIdFor(pal, canonicalId, dex.suffix);
    const dexKey = dex.number == null
      ? `unlisted:${canonicalId}:${variantId}`
      : `${String(dex.number).padStart(3, '0')}:${variantId}`;
    return {
      canonicalId,
      dexNumber: dex.number,
      dexSuffix: dex.suffix,
      dexKey,
      variantId,
      displayNumber: dex.number == null
        ? null
        : `${String(dex.number).padStart(3, '0')}${dex.suffix?.toUpperCase() || ''}`,
      displayName: text(pal.name),
      sourceIds: sourceIds(pal),
      source: pal
    };
  });
}

function mergeRows(first, second) {
  const preferred = richness(second.source) > richness(first.source) ? second : first;
  const other = preferred === first ? second : first;
  const aliases = [...new Set([
    first.displayName,
    second.displayName,
    ...(first.aliases || []),
    ...(second.aliases || [])
  ].filter(Boolean))];
  const mergedSources = [
    ...(first.mergedSources || [first.source]),
    ...(second.mergedSources || [second.source])
  ];
  return Object.freeze({
    ...preferred,
    sourceIds: Object.freeze([...new Set([...first.sourceIds, ...second.sourceIds])]),
    aliases: Object.freeze(aliases),
    mergedSources: Object.freeze(mergedSources),
    source: preferred.source,
    displayName: preferred.displayName || other.displayName
  });
}

export function createCanonicalPalRegistry(catalog = PAL_CATALOG) {
  const rawRows = buildRows(catalog);
  const consolidated = new Map();
  const sourceDuplicates = [];

  for (const row of rawRows) {
    if (consolidated.has(row.dexKey)) {
      sourceDuplicates.push({ dexKey: row.dexKey, first: consolidated.get(row.dexKey), duplicate: row });
      consolidated.set(row.dexKey, mergeRows(consolidated.get(row.dexKey), row));
    } else {
      consolidated.set(row.dexKey, Object.freeze({
        ...row,
        sourceIds: Object.freeze(row.sourceIds),
        aliases: Object.freeze([row.displayName]),
        mergedSources: Object.freeze([row.source])
      }));
    }
  }

  const rows = [...consolidated.values()];
  const bySourceId = new Map();
  const byCanonicalId = new Map();
  const byDexKey = new Map();
  const duplicateSourceIds = [];

  for (const row of rows) {
    byDexKey.set(row.dexKey, row);
    for (const id of row.sourceIds) {
      const key = slug(id);
      if (bySourceId.has(key) && bySourceId.get(key).dexKey !== row.dexKey) {
        duplicateSourceIds.push({ id, first: bySourceId.get(key), duplicate: row });
      } else {
        bySourceId.set(key, row);
      }
    }
    if (!byCanonicalId.has(row.canonicalId)) byCanonicalId.set(row.canonicalId, []);
    byCanonicalId.get(row.canonicalId).push(row);
  }

  return Object.freeze({
    schemaVersion: CANONICAL_PAL_SCHEMA,
    rows: Object.freeze(rows),
    bySourceId,
    byCanonicalId,
    byDexKey,
    sourceDuplicates: Object.freeze(sourceDuplicates),
    duplicateSourceIds: Object.freeze(duplicateSourceIds),
    duplicateDexKeys: Object.freeze([]),
    exactDuplicates: Object.freeze([])
  });
}

export const CANONICAL_PALS = createCanonicalPalRegistry();

export function resolveCanonicalPal(id, { variantId = null } = {}) {
  const raw = slug(id);
  const key = CANONICAL_ALIASES[raw] || raw;
  const bySource = CANONICAL_PALS.bySourceId.get(raw);
  if (bySource) return bySource;
  const matches = CANONICAL_PALS.byCanonicalId.get(key) || [];
  if (variantId) return matches.find(row => row.variantId === slug(variantId)) || null;
  return matches.find(row => row.variantId === 'base') || matches[0] || null;
}

export function canonicalDataReport(registry = CANONICAL_PALS) {
  const dexGroups = new Map();
  for (const row of registry.rows) {
    if (row.dexNumber == null) continue;
    if (!dexGroups.has(row.dexNumber)) dexGroups.set(row.dexNumber, []);
    dexGroups.get(row.dexNumber).push(row);
  }
  return Object.freeze({
    total: registry.rows.length,
    uniqueCanonicalIds: registry.byCanonicalId.size,
    uniqueDexKeys: registry.byDexKey.size,
    sharedDexNumbers: [...dexGroups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([dexNumber, rows]) => ({
        dexNumber,
        variants: rows.map(row => ({
          canonicalId: row.canonicalId,
          variantId: row.variantId,
          displayName: row.displayName,
          dexKey: row.dexKey
        }))
      })),
    consolidatedSourceDuplicates: registry.sourceDuplicates.length,
    duplicateSourceIds: registry.duplicateSourceIds.length,
    duplicateDexKeys: registry.duplicateDexKeys.length,
    exactDuplicates: registry.exactDuplicates.length
  });
}
