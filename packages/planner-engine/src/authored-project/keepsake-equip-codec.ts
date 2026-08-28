import type { Catalog, TraitRarity } from '../catalog-schema';
import type { AuthoredKeepsakeEquipResults } from './model';
import {
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument as fail,
} from './validation';

/** Decode the sparse immediate result of an authored keepsake selection. */
export function decodeKeepsakeEquipResults(
  value: unknown,
  path: string,
  catalog: Catalog,
): AuthoredKeepsakeEquipResults {
  const results = expectRecord(value, path);
  expectExactKeys(results, ['jeweledPom', 'experimentalHammer', 'transcendentEmbryo'], path);
  if (
    results.jeweledPom === undefined &&
    results.experimentalHammer === undefined &&
    results.transcendentEmbryo === undefined
  )
    return Object.freeze({});

  const embryo =
    results.transcendentEmbryo === undefined
      ? undefined
      : expectRecord(results.transcendentEmbryo, `${path}.transcendentEmbryo`);
  if (embryo !== undefined) {
    expectExactKeys(embryo, ['blessingKey'], `${path}.transcendentEmbryo`);
    const blessingKey = expectNonBlankString(
      embryo.blessingKey,
      `${path}.transcendentEmbryo.blessingKey`,
    );
    const blessing = catalog.chaos.blessings.byKey[blessingKey];
    if (blessing === undefined)
      fail(`${path}.transcendentEmbryo.blessingKey`, 'must be a declared Chaos blessing');
    if (blessing.fixedRarity !== undefined)
      fail(`${path}.transcendentEmbryo.blessingKey`, 'must be a declared in-run Chaos blessing');
  }

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
    if (hammer === undefined)
      return Object.freeze(
        embryo === undefined
          ? {}
          : { transcendentEmbryo: Object.freeze({ blessingKey: embryo.blessingKey as string }) },
      );
    return Object.freeze({
      ...(embryo === undefined
        ? {}
        : { transcendentEmbryo: Object.freeze({ blessingKey: embryo.blessingKey as string }) }),
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
    ...(embryo === undefined
      ? {}
      : { transcendentEmbryo: Object.freeze({ blessingKey: embryo.blessingKey as string }) }),
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
