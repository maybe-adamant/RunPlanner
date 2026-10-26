import type { Catalog, TraitRarity } from '../catalog-schema';
import type { AuthoredKeepsakeEquipResults } from './model';
import {
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument as fail,
} from './validation';
import {
  isOutcomeCycleKey,
  normalizeAuthoredTranscendentEmbryoOutcome,
  type AuthoredTranscendentEmbryoOutcome,
} from './traits/state';

function decodeEmbryoOutcome(
  value: unknown,
  path: string,
  catalog: Catalog,
): AuthoredTranscendentEmbryoOutcome {
  const embryo = expectRecord(value, path);
  expectExactKeys(embryo, ['blessingKey', 'blessingValues'], path);
  const blessingKey = expectNonBlankString(embryo.blessingKey, `${path}.blessingKey`);
  const blessing = catalog.chaos.blessings.byKey[blessingKey];
  if (blessing === undefined) fail(`${path}.blessingKey`, 'must be a declared Chaos blessing');
  if (blessing.fixedRarity !== undefined)
    fail(`${path}.blessingKey`, 'must be a declared in-run Chaos blessing');
  const rawValues = expectRecord(embryo.blessingValues, `${path}.blessingValues`);
  const blessingValues: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(rawValues)) {
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue))
      fail(`${path}.blessingValues.${key}`, 'must be a finite number');
    blessingValues[key] = rawValue;
  }
  try {
    return normalizeAuthoredTranscendentEmbryoOutcome(catalog, { blessingKey, blessingValues });
  } catch (error) {
    return fail(
      `${path}.blessingValues`,
      error instanceof Error ? error.message : 'has an invalid declared operand value',
    );
  }
}

/** Decode the sparse immediate result of an authored keepsake selection. */
export function decodeKeepsakeEquipResults(
  value: unknown,
  path: string,
  catalog: Catalog,
): AuthoredKeepsakeEquipResults {
  const results = expectRecord(value, path);
  expectExactKeys(
    results,
    ['jeweledPom', 'experimentalHammer', 'transcendentEmbryo', 'transcendentEmbryoTransformations'],
    path,
  );
  if (
    results.jeweledPom === undefined &&
    results.experimentalHammer === undefined &&
    results.transcendentEmbryo === undefined &&
    results.transcendentEmbryoTransformations === undefined
  )
    return Object.freeze({});

  const embryoValue =
    results.transcendentEmbryo === undefined
      ? undefined
      : decodeEmbryoOutcome(results.transcendentEmbryo, `${path}.transcendentEmbryo`, catalog);
  let transformations: Record<string, AuthoredTranscendentEmbryoOutcome> | undefined;
  if (results.transcendentEmbryoTransformations !== undefined) {
    const raw = expectRecord(
      results.transcendentEmbryoTransformations,
      `${path}.transcendentEmbryoTransformations`,
    );
    transformations = {};
    for (const [cycle, value] of Object.entries(raw)) {
      if (!isOutcomeCycleKey(cycle))
        fail(`${path}.transcendentEmbryoTransformations.${cycle}`, 'unknown cycle');
      transformations[cycle] = decodeEmbryoOutcome(
        value,
        `${path}.transcendentEmbryoTransformations.${cycle}`,
        catalog,
      );
    }
    if (Object.keys(transformations).length === 0)
      fail(`${path}.transcendentEmbryoTransformations`, 'must not be empty');
  }
  const embryo = Object.freeze({
    ...(embryoValue === undefined ? {} : { transcendentEmbryo: embryoValue }),
    ...(transformations === undefined
      ? {}
      : { transcendentEmbryoTransformations: Object.freeze(transformations) }),
  });

  const hammer =
    results.experimentalHammer === undefined
      ? undefined
      : expectRecord(results.experimentalHammer, `${path}.experimentalHammer`);
  if (hammer !== undefined) {
    const kind = expectString(hammer.kind, `${path}.experimentalHammer.kind`);
    if (kind === 'selected') {
      expectExactKeys(hammer, ['kind', 'traitKey'], `${path}.experimentalHammer`);
      const traitKey = expectString(hammer.traitKey, `${path}.experimentalHammer.traitKey`);
      if (catalog.traits.byKey[traitKey]?.hammerCompatibility === undefined)
        fail(`${path}.experimentalHammer.traitKey`, 'must be a declared Hammer trait');
    } else if (kind === 'exhausted') {
      expectExactKeys(hammer, ['kind'], `${path}.experimentalHammer`);
    } else fail(`${path}.experimentalHammer.kind`, 'must be selected or exhausted');
  }

  if (results.jeweledPom === undefined) {
    if (hammer === undefined) return embryo;
    return Object.freeze({
      ...embryo,
      experimentalHammer: Object.freeze({
        ...(hammer.kind === 'selected'
          ? { kind: 'selected' as const, traitKey: hammer.traitKey as string }
          : { kind: 'exhausted' as const }),
      }),
    });
  }

  const pom = expectRecord(results.jeweledPom, `${path}.jeweledPom`);
  expectExactKeys(pom, ['traitKey', 'rarity'], `${path}.jeweledPom`);
  const traitKey = expectString(pom.traitKey, `${path}.jeweledPom.traitKey`);
  const descriptor = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'jeweledPom',
  )?.effect;
  if (descriptor === undefined || descriptor.kind !== 'jeweledPom')
    fail(`${path}.jeweledPom`, 'has no declared Jeweled Pom descriptor');
  if (!catalog.traitGivers.byKey[descriptor.giverKey]?.traitKeys.includes(traitKey))
    fail(
      `${path}.jeweledPom.traitKey`,
      `must be a ${descriptor.giverKey} trait, received ${traitKey}`,
    );
  const trait = catalog.traits.byKey[traitKey];
  const rarityPolicy = catalog.traitGivers.byKey[descriptor.giverKey]?.rarityPolicy;
  let rarity: TraitRarity | undefined;
  if (trait?.rarityDomain.kind === 'none') {
    if (rarityPolicy?.kind !== 'none')
      fail(`${path}.jeweledPom`, `${descriptor.giverKey} has inconsistent rarity declarations`);
    if (pom.rarity !== undefined)
      fail(`${path}.jeweledPom.rarity`, `rarityless trait ${traitKey} has no rarity`);
  } else {
    const authoredRarity = expectString(pom.rarity, `${path}.jeweledPom.rarity`);
    if (rarityPolicy?.kind !== 'fixed' || authoredRarity !== rarityPolicy.rarity)
      fail(`${path}.jeweledPom.rarity`, `must equal ${descriptor.giverKey}'s fixed result rarity`);
    if (!trait?.rarityDomain.freshOfferRarities.includes(authoredRarity as TraitRarity))
      fail(`${path}.jeweledPom.rarity`, `is not declared for ${traitKey}`);
    rarity = authoredRarity as TraitRarity;
  }
  return Object.freeze({
    ...embryo,
    jeweledPom: Object.freeze({
      traitKey,
      ...(rarity === undefined ? {} : { rarity }),
    }),
    ...(hammer === undefined
      ? {}
      : {
          experimentalHammer: Object.freeze(
            hammer.kind === 'selected'
              ? { kind: 'selected' as const, traitKey: hammer.traitKey as string }
              : { kind: 'exhausted' as const },
          ),
        }),
  });
}
