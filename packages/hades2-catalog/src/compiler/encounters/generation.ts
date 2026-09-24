import type {
  EncounterEnemyChoice,
  GeneratedEncounterSelection,
} from '@run-planner/engine/catalog-schema';
import { requireNonEmpty } from '../common';
import { fail } from '../errors';

export function normalizeEncounterGeneration(
  raw: GeneratedEncounterSelection,
  path: string,
): GeneratedEncounterSelection {
  if (raw.preparation !== 'roomEntry' && raw.preparation !== 'rewardGeneration')
    fail(`${path}.preparation`, 'has unknown native preparation contact');
  const integer = (value: number, label: string, min = 1, max = 5): number => {
    if (!Number.isInteger(value) || value < min || value > max)
      fail(`${path}.${label}`, `must be an integer in ${min}..${max}`);
    return value;
  };
  const boolean = (value: boolean, label: string): boolean => {
    if (typeof value !== 'boolean') fail(`${path}.${label}`, 'must be boolean');
    return value;
  };
  const enemies = (values: readonly EncounterEnemyChoice[], field: string) => {
    const keys = new Set<string>();
    const natives = new Set<string>();
    return Object.freeze(
      values.map((value, index) => {
        const label = `${path}.${field}[${index}]`;
        const key = requireNonEmpty(value.key, `${label}.key`);
        const nativeId = requireNonEmpty(value.nativeId, `${label}.nativeId`);
        if (keys.has(key) || natives.has(nativeId))
          fail(label, 'must have distinct enemy identities');
        keys.add(key);
        natives.add(nativeId);
        if (new Set(value.excludes).size !== value.excludes.length || value.excludes.includes(key))
          fail(label, 'has invalid exclusions');
        if (
          value.group !== undefined &&
          value.group !== 'Automatons' &&
          value.group !== 'ChronosForces'
        )
          fail(label, 'has unknown enemy group');
        if (
          value.minimumDepth !== undefined &&
          !['biomeDepthCache', 'biomeEncounterDepth'].includes(value.minimumDepth.axis)
        )
          fail(label, 'has unsupported depth axis');
        return Object.freeze({
          key,
          nativeId,
          label: requireNonEmpty(value.label, `${label}.label`),
          elite: boolean(value.elite, `${field}[${index}].elite`),
          ...(value.menace === undefined
            ? {}
            : value.menace.kind === 'mapped'
              ? {
                  menace: Object.freeze({
                    kind: 'mapped' as const,
                    targetNativeId: requireNonEmpty(
                      value.menace.targetNativeId,
                      `${label}.menace.targetNativeId`,
                    ),
                    targetLabel: requireNonEmpty(
                      value.menace.targetLabel ?? '',
                      `${label}.menace.targetLabel`,
                    ),
                  }),
                }
              : value.menace.kind === 'random'
                ? {
                    menace: Object.freeze({
                      kind: 'random' as const,
                      targetNativeIds: Object.freeze(
                        value.menace.targetNativeIds.map((target) =>
                          requireNonEmpty(target, `${label}.menace.targetNativeIds`),
                        ),
                      ),
                      targetLabels: Object.freeze(
                        Object.fromEntries(
                          value.menace.targetNativeIds.map((target) => [
                            target,
                            requireNonEmpty(
                              value.menace?.kind === 'random'
                                ? (value.menace.targetLabels?.[target] ?? '')
                                : '',
                              `${label}.menace.targetLabels.${target}`,
                            ),
                          ]),
                        ),
                      ),
                    }),
                  }
                : { menace: Object.freeze({ kind: value.menace.kind }) }),
          ...(value.fangs === undefined
            ? {}
            : {
                fangs: Object.freeze({
                  options: Object.freeze(
                    value.fangs.options.map((option) =>
                      requireNonEmpty(option, `${label}.fangs.options`),
                    ),
                  ),
                  blockedOptions: Object.freeze(
                    value.fangs.blockedOptions.map((option) =>
                      requireNonEmpty(option, `${label}.fangs.blockedOptions`),
                    ),
                  ),
                  ...(value.fangs.caveat === undefined ? {} : { caveat: value.fangs.caveat }),
                }),
              }),
          blockSolo: boolean(value.blockSolo, `${field}[${index}].blockSolo`),
          blacklistAfterAppearance: boolean(
            value.blacklistAfterAppearance,
            `${field}[${index}].blacklistAfterAppearance`,
          ),
          difficultyRating: integer(value.difficultyRating, `${label}.difficultyRating`, 1, 1000),
          ...(value.unitGroupSize === undefined
            ? {}
            : { unitGroupSize: integer(value.unitGroupSize, `${label}.unitGroupSize`, 1, 1000) }),
          ...(value.maxCount === undefined
            ? {}
            : { maxCount: integer(value.maxCount, `${label}.maxCount`, 1, 1000) }),
          ...(value.fixedCount === undefined
            ? {}
            : { fixedCount: integer(value.fixedCount, `${label}.fixedCount`, 1, 1000) }),
          excludes: Object.freeze(
            value.excludes.map((excluded) => requireNonEmpty(excluded, `${label}.excludes`)),
          ),
          ...(value.group === undefined ? {} : { group: value.group }),
          ...(value.minimumDepth === undefined
            ? {}
            : {
                minimumDepth: Object.freeze({
                  axis: value.minimumDepth.axis,
                  value: integer(
                    value.minimumDepth.value,
                    `${field}[${index}].minimumDepth.value`,
                    0,
                    100,
                  ),
                }),
              }),
        });
      }),
    );
  };
  const choices = enemies(raw.choices, 'choices');
  const fixedEnemies = enemies(raw.fixedEnemies, 'fixedEnemies');
  if (
    choices.length === 0 ||
    fixedEnemies.length > 1 ||
    fixedEnemies.some((fixed) => choices.some((choice) => choice.key === fixed.key))
  )
    fail(
      path,
      'requires a nonempty generated pool separate from at most one fixed template member',
    );
  // The engine prices native wave patterns 1..4; a five-wave generator is unsupported.
  const min = integer(raw.waveCount.min, 'waveCount.min', 1, 4);
  const max = integer(raw.waveCount.max, 'waveCount.max', 1, 4);
  if (min > max || (fixedEnemies.length !== 0 && (min !== 1 || max !== 1)))
    fail(path, 'has incompatible wave bounds/template');
  if (!Number.isFinite(raw.types.depthRamp) || raw.types.depthRamp < 0 || raw.types.depthRamp > 1)
    fail(`${path}.types.depthRamp`, 'must be finite in 0..1');
  if (!['biomeDepthCache', 'biomeEncounterDepth'].includes(raw.types.depthAxis))
    fail(`${path}.types.depthAxis`, 'is unsupported');
  const minTypes = integer(raw.types.min, 'types.min');
  const maxTypes = integer(raw.types.max, 'types.max');
  if (minTypes > maxTypes) fail(path, 'has reversed type bounds');
  const groups: Partial<Record<'Automatons' | 'ChronosForces', number>> = {};
  for (const [key, value] of Object.entries(raw.maxTypesPerGroup)) {
    if (key !== 'Automatons' && key !== 'ChronosForces')
      fail(`${path}.maxTypesPerGroup`, 'has unknown group');
    groups[key] = integer(value, `maxTypesPerGroup.${key}`);
  }
  const budgetBase = raw.budget.base;
  const base =
    typeof budgetBase === 'number'
      ? integer(budgetBase, 'budget.base', 0, 10000)
      : Object.freeze({
          min: integer(budgetBase.min, 'budget.base.min', 0, 10000),
          max: integer(budgetBase.max, 'budget.base.max', 0, 10000),
        });
  if (typeof base !== 'number' && base.min > base.max)
    fail(`${path}.budget.base`, 'has reversed range');
  if (!Number.isFinite(raw.budget.multiplier) || raw.budget.multiplier <= 0)
    fail(`${path}.budget.multiplier`, 'must be finite and positive');
  if (!['biomeDepthCache', 'biomeEncounterDepth'].includes(raw.budget.depthAxis))
    fail(`${path}.budget.depthAxis`, 'is unsupported');
  return Object.freeze({
    kind: 'generated',
    preparation: raw.preparation,
    choices,
    fixedEnemies,
    ...(raw.fangs === undefined
      ? {}
      : {
          fangs: Object.freeze({
            perks: Object.freeze(
              Object.fromEntries(
                Object.entries(raw.fangs.perks).map(([key, perk]) => [
                  requireNonEmpty(key, `${path}.fangs.perks`),
                  Object.freeze({
                    label: requireNonEmpty(perk.label, `${path}.fangs.perks.${key}.label`),
                    excludes: Object.freeze(
                      perk.excludes.map((entry) =>
                        requireNonEmpty(entry, `${path}.fangs.perks.${key}.excludes`),
                      ),
                    ),
                    ...(perk.roomSets === undefined
                      ? {}
                      : { roomSets: Object.freeze(perk.roomSets) }),
                    ...(perk.maxPerRoom === undefined ? {} : { maxPerRoom: perk.maxPerRoom }),
                  }),
                ]),
              ),
            ),
          }),
        }),
    waveCount: Object.freeze({ min, max }),
    types: Object.freeze({
      min: minTypes,
      max: maxTypes,
      depthRamp: raw.types.depthRamp,
      depthAxis: raw.types.depthAxis,
      escalate: boolean(raw.types.escalate, 'types.escalate'),
      cap: integer(raw.types.cap, 'types.cap'),
      ...(raw.types.hardCap === undefined
        ? {}
        : { hardCap: integer(raw.types.hardCap, 'types.hardCap') }),
    }),
    maxEliteTypes: integer(raw.maxEliteTypes, 'maxEliteTypes', 0),
    blockHighlightElites: boolean(raw.blockHighlightElites, 'blockHighlightElites'),
    blockFangsAttributes: boolean(raw.blockFangsAttributes, 'blockFangsAttributes'),
    ...(raw.blockMenace === undefined
      ? {}
      : { blockMenace: boolean(raw.blockMenace, 'blockMenace') }),
    blockTypesAcrossWaves: boolean(raw.blockTypesAcrossWaves, 'blockTypesAcrossWaves'),
    maxTypesPerGroup: Object.freeze(groups),
    budget: Object.freeze({
      base,
      depthRamp: integer(raw.budget.depthRamp, 'budget.depthRamp', 0, 10000),
      depthAxis: raw.budget.depthAxis,
      modifier: integer(raw.budget.modifier, 'budget.modifier', -10000, 10000),
      multiplier: raw.budget.multiplier,
      minimum: integer(raw.budget.minimum, 'budget.minimum', 0, 10000),
      ...(raw.budget.hardDepthRamp === undefined
        ? {}
        : { hardDepthRamp: integer(raw.budget.hardDepthRamp, 'budget.hardDepthRamp', 0, 10000) }),
    }),
  });
}
