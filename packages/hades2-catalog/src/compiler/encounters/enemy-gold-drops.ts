import type {
  CatalogCollection,
  EncounterDefinition,
  EnemyGoldDrop,
} from '@run-planner/engine/catalog-schema';

import type { RawEnemyGoldDropDeclaration } from '../../declarations/index';
import { createCollection, requireNonEmpty, requirePositiveInteger } from '../common';
import { fail } from '../errors';

/**
 * A parcel's integer draw range. Native `RandomInt` receives the unrounded
 * products in double arithmetic and the engine binding truncates them.
 */
function parcelValue(
  raw: Extract<RawEnemyGoldDropDeclaration, { readonly kind: 'parcel' }>['value'],
  path: string,
): { readonly min: number; readonly max: number } {
  if (raw.kind === 'fixed') {
    const min = requirePositiveInteger(raw.min, `${path}.min`);
    const max = requirePositiveInteger(raw.max, `${path}.max`);
    if (max < min) fail(`${path}.max`, 'must not precede min');
    return Object.freeze({ min, max });
  }
  if (!(raw.valuePerDifficulty > 0)) fail(`${path}.valuePerDifficulty`, 'must be positive');
  if (!(raw.maxValueVariance >= 1)) fail(`${path}.maxValueVariance`, 'must be at least 1');
  const rating = requirePositiveInteger(raw.difficultyRating, `${path}.difficultyRating`);
  return Object.freeze({
    min: Math.trunc(raw.valuePerDifficulty * rating),
    max: Math.trunc(raw.valuePerDifficulty * rating * raw.maxValueVariance),
  });
}

function normalizeDrop(raw: RawEnemyGoldDropDeclaration, path: string): EnemyGoldDrop {
  const key = requireNonEmpty(raw.key, `${path}.key`);
  switch (raw.kind) {
    case 'none':
      return Object.freeze({ key, kind: 'none' });
    case 'unitGroup':
      return Object.freeze({
        key,
        kind: 'unitGroup',
        unitKey: requireNonEmpty(raw.unitKey, `${path}.unitKey`),
        size: requirePositiveInteger(raw.size, `${path}.size`),
      });
    case 'parcel':
      if (!(raw.chance > 0 && raw.chance <= 1)) fail(`${path}.chance`, 'must be in (0, 1]');
      // A parcel budget of one gold stops native's loop after one parcel
      // (RoomLogic.lua:2367-2376); a larger budget is not modelled.
      if (raw.minParcels !== 1 || raw.maxParcels !== 1)
        fail(`${path}.maxParcels`, 'must be a single parcel per kill');
      return Object.freeze({
        key,
        kind: 'parcel',
        chance: raw.chance,
        value: parcelValue(raw.value, `${path}.value`),
      });
  }
}

/** Every enemy identity a fully determined roster of the encounter can field. */
function rosterEnemyKeys(definition: EncounterDefinition): readonly {
  readonly key: string;
  readonly unitGroupSize?: number;
}[] {
  const keys: { key: string; unitGroupSize?: number }[] = [];
  for (const wave of definition.fixedRoster ?? [])
    for (const spawn of wave) keys.push({ key: spawn.enemyKey });
  for (const decision of definition.customization ?? []) {
    if (decision.selection.kind !== 'generated') continue;
    const selection = decision.selection;
    for (const choice of [
      ...selection.choices,
      ...selection.fixedEnemies,
      ...(selection.generatedSeeds ?? []),
      ...(selection.fixedWaves ?? []).flat(),
    ]) {
      keys.push({
        key: choice.nativeId,
        ...(choice.unitGroupSize === undefined ? {} : { unitGroupSize: choice.unitGroupSize }),
      });
      if (choice.menace?.kind === 'mapped') keys.push({ key: choice.menace.targetNativeId });
      if (choice.menace?.kind === 'random')
        for (const target of choice.menace.targetNativeIds) keys.push({ key: target });
    }
  }
  return keys;
}

/**
 * Normalizes the enemy drop table and closes it over the encounters: every
 * enemy a generated composition, a fixed roster or a Menace conversion can
 * field has exactly one row, a unit group's members have theirs, and no row
 * is unreachable.
 */
export function normalizeEnemyGoldDrops(
  raw: readonly RawEnemyGoldDropDeclaration[],
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
): CatalogCollection<EnemyGoldDrop> {
  const drops = createCollection(
    raw.map((entry, index) => normalizeDrop(entry, `enemyGoldDrops[${index}]`)),
    'enemyGoldDrops',
    (drop) => drop.key,
  );
  const reached = new Set<string>();
  const reach = (key: string, path: string, unitGroupSize?: number) => {
    const drop = drops.byKey[key];
    if (drop === undefined) fail(path, `${key} has no enemy gold drop`);
    if (unitGroupSize !== undefined && (drop.kind !== 'unitGroup' || drop.size !== unitGroupSize))
      fail(`enemyGoldDrops.${key}`, `must drop through a unit group of ${unitGroupSize}`);
    reached.add(key);
    if (drop.kind === 'unitGroup') {
      const unit = drops.byKey[drop.unitKey];
      if (unit === undefined || unit.kind === 'unitGroup')
        fail(`enemyGoldDrops.${key}.unitKey`, `${drop.unitKey} must be a single enemy's drop`);
      reached.add(drop.unitKey);
    }
  };
  for (const definition of encounterDefinitions.values)
    for (const { key, unitGroupSize } of rosterEnemyKeys(definition))
      reach(key, `encounterDefinitions.${definition.key}`, unitGroupSize);
  for (const drop of drops.values)
    if (!reached.has(drop.key))
      fail(`enemyGoldDrops.${drop.key}`, 'no modelled roster fields this enemy');
  return drops;
}
