import type {
  CatalogCollection,
  HexDeclaration,
  HexLayoutKey,
  KeepsakeDeclaration,
  TraitDeclaration,
  TraitGiverDeclaration,
} from '@run-planner/engine/catalog-schema';

import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireNonEmpty,
  requireObject,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';
import type { RawHexDeclaration, RawTraitCatalogInput } from '../declarations/traits';

const LAYOUT_KEYS: readonly HexLayoutKey[] = ['Lung', 'Pyramid', 'Maze', 'Nacelle'];
const EXPECTED_LAYOUTS = Object.freeze({
  Lung: Object.freeze({ baseCapacity: 16, rareCount: 2, epicCount: 1 }),
  Pyramid: Object.freeze({ baseCapacity: 18, rareCount: 3, epicCount: 1 }),
  Maze: Object.freeze({ baseCapacity: 22, rareCount: 3, epicCount: 2 }),
  Nacelle: Object.freeze({ baseCapacity: 18, rareCount: 3, epicCount: 2 }),
});

export function normalizeHexes(
  raw: RawTraitCatalogInput['hexes'],
): CatalogCollection<HexDeclaration> {
  const declarations = requireArray(raw, 'hexes').map(
    (value, index) => requireObject(value, `hexes[${index}]`) as unknown as RawHexDeclaration,
  );
  const values = declarations.map((hex, index) => {
    const path = `hexes[${index}]`;
    const layouts = requireArray(hex.layouts, `${path}.layouts`).map((value, layoutIndex) => {
      const layout = requireObject(value, `${path}.layouts[${layoutIndex}]`);
      const key = layout.key;
      if (typeof key !== 'string' || !(LAYOUT_KEYS as readonly string[]).includes(key))
        fail(`${path}.layouts[${layoutIndex}].key`, 'must be Lung, Pyramid, Maze, or Nacelle');
      const expected = EXPECTED_LAYOUTS[key as HexLayoutKey];
      if (expected === undefined) fail(`${path}.layouts[${layoutIndex}].key`, 'unknown layout');
      const label = requireNonEmpty(
        layout.label as string,
        `${path}.layouts[${layoutIndex}].label`,
      );
      const baseCapacity = requirePositiveInteger(
        layout.baseCapacity as number,
        `${path}.layouts[${layoutIndex}].baseCapacity`,
      );
      const rareCount = requirePositiveInteger(
        layout.rareCount as number,
        `${path}.layouts[${layoutIndex}].rareCount`,
      );
      const epicCount = requirePositiveInteger(
        layout.epicCount as number,
        `${path}.layouts[${layoutIndex}].epicCount`,
      );
      if (
        baseCapacity !== expected.baseCapacity ||
        rareCount !== expected.rareCount ||
        epicCount !== expected.epicCount
      )
        fail(`${path}.layouts[${layoutIndex}]`, 'does not match the source layout contract');
      return Object.freeze({
        key: key as HexLayoutKey,
        label,
        baseCapacity,
        rareCount,
        epicCount,
      });
    });
    if (
      layouts.length !== LAYOUT_KEYS.length ||
      layouts.some((layout, layoutIndex) => layout.key !== LAYOUT_KEYS[layoutIndex])
    )
      fail(`${path}.layouts`, 'must contain Lung, Pyramid, Maze, and Nacelle in declaration order');
    const normalizeCandidates = (
      rawCandidates: unknown,
      candidatePath: string,
    ): CatalogCollection<{ readonly key: string; readonly label: string }> => {
      const candidates = requireArray(rawCandidates, candidatePath).map((value, candidateIndex) => {
        const candidate = requireObject(value, `${candidatePath}[${candidateIndex}]`);
        return Object.freeze({
          key: requireNonEmpty(candidate.key as string, `${candidatePath}[${candidateIndex}].key`),
          label: requireNonEmpty(
            candidate.label as string,
            `${candidatePath}[${candidateIndex}].label`,
          ),
        });
      });
      const keys = freezeUniqueStrings(
        candidates.map((candidate) => candidate.key),
        `${candidatePath}.keys`,
      );
      if (keys.length !== candidates.length) fail(candidatePath, 'candidate keys must be distinct');
      return createCollection(candidates, candidatePath, (candidate) => candidate.key);
    };
    const rareCandidates = normalizeCandidates(hex.rareCandidates, `${path}.rareCandidates`);
    const epicCandidates = normalizeCandidates(hex.epicCandidates, `${path}.epicCandidates`);
    if (rareCandidates.values.length < 3 || epicCandidates.values.length < 2)
      fail(path, 'must provide at least three Rare and two Epic candidates');
    const godSent = requireObject(hex.godSent, `${path}.godSent`);
    if (godSent.capacityDelta !== 2) fail(`${path}.godSent.capacityDelta`, 'must be 2');
    return Object.freeze({
      spellTraitKey: requireNonEmpty(hex.spellTraitKey, `${path}.spellTraitKey`),
      label: requireNonEmpty(hex.label, `${path}.label`),
      layouts: createCollection(layouts, `${path}.layouts`, (layout) => layout.key),
      rareCandidates,
      epicCandidates,
      godSent: Object.freeze({
        providerKey: requireNonEmpty(godSent.providerKey as string, `${path}.godSent.providerKey`),
        forceKeepsakeKey: requireNonEmpty(
          godSent.forceKeepsakeKey as string,
          `${path}.godSent.forceKeepsakeKey`,
        ),
        olympianTalentKey: requireNonEmpty(
          godSent.olympianTalentKey as string,
          `${path}.godSent.olympianTalentKey`,
        ),
        olympianTalentLabel: requireNonEmpty(
          godSent.olympianTalentLabel as string,
          `${path}.godSent.olympianTalentLabel`,
        ),
        lineageTalentKey: requireNonEmpty(
          godSent.lineageTalentKey as string,
          `${path}.godSent.lineageTalentKey`,
        ),
        lineageTalentLabel: requireNonEmpty(
          godSent.lineageTalentLabel as string,
          `${path}.godSent.lineageTalentLabel`,
        ),
        capacityDelta: 2 as const,
      }),
    });
  });
  return createCollection(values, 'hexes', (hex) => hex.spellTraitKey, 'spellTraitKey');
}

export function validateHexBindings(input: {
  readonly hexes: CatalogCollection<HexDeclaration>;
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly givers: CatalogCollection<TraitGiverDeclaration>;
  readonly keepsakes: CatalogCollection<KeepsakeDeclaration>;
}): void {
  const spellGiver = input.givers.byKey.SpellDrop;
  const expectedBindings = {
    SpellPolymorphTrait: ['Zeus', 'ForceZeusBoonKeepsake', 'PolymorphZeusTalent'],
    SpellMeteorTrait: ['Hestia', 'ForceHestiaBoonKeepsake', 'MeteorHestiaTalent'],
    SpellTransformTrait: ['Aphrodite', 'ForceAphroditeBoonKeepsake', 'TransformAphroditeTalent'],
    SpellLeapTrait: ['Hephaestus', 'ForceHephaestusBoonKeepsake', 'LeapHephaestusTalent'],
    SpellLaserTrait: ['Apollo', 'ForceApolloBoonKeepsake', 'LaserApolloTalent'],
    SpellSummonTrait: ['Hera', 'ForceHeraBoonKeepsake', 'SummonHeraTalent'],
    SpellTimeSlowTrait: ['Demeter', 'ForceDemeterBoonKeepsake', 'TimeSlowDemeterTalent'],
    SpellPotionTrait: ['Poseidon', 'ForcePoseidonBoonKeepsake', 'PotionPoseidonTalent'],
    SpellMoonBeamTrait: ['Ares', 'ForceAresBoonKeepsake', 'MoonBeamAresTalent'],
  } as const;
  const expectedSpellKeys = Object.keys(expectedBindings);
  if (
    input.hexes.values.length !== expectedSpellKeys.length ||
    expectedSpellKeys.some((key) => input.hexes.byKey[key] === undefined)
  )
    fail('traitCatalog.hexes', 'must declare exactly one Hex for each of the nine spell traits');
  for (const hex of input.hexes.values) {
    const trait = input.traits.byKey[hex.spellTraitKey];
    if (trait?.equipmentSlot !== 'Spell')
      fail(`traitCatalog.hexes.${hex.spellTraitKey}.spellTraitKey`, 'must reference a Spell trait');
    if (
      spellGiver === undefined ||
      (hex.spellTraitKey !== 'SpellMoonBeamTrait' &&
        !spellGiver.traitKeys.includes(hex.spellTraitKey))
    )
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.spellTraitKey`,
        'must belong to the normal SpellDrop pool unless it is Aspect of Selene Sky Fall',
      );
    const expectedBinding = expectedBindings[hex.spellTraitKey as keyof typeof expectedBindings];
    if (expectedBinding === undefined)
      fail(`traitCatalog.hexes.${hex.spellTraitKey}`, 'has no audited God Sent binding');
    if (hex.godSent.providerKey !== expectedBinding[0])
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.providerKey`,
        `must be ${expectedBinding[0]}`,
      );
    if (hex.godSent.forceKeepsakeKey !== expectedBinding[1])
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.forceKeepsakeKey`,
        `must be ${expectedBinding[1]}`,
      );
    const provider = input.givers.byKey[hex.godSent.providerKey];
    if (provider?.providerKind !== 'olympian')
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.providerKey`,
        'must be an Olympian giver',
      );
    const forceKeepsake = input.keepsakes.byKey[hex.godSent.forceKeepsakeKey];
    if (forceKeepsake === undefined)
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.forceKeepsakeKey`,
        'must reference a declared force-boon keepsake',
      );
    if (
      forceKeepsake.effect?.kind !== 'olympianRewardPressure' ||
      forceKeepsake.effect.providerKey !== hex.godSent.providerKey
    )
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.forceKeepsakeKey`,
        'must reference the matching provider force-keepsake',
      );
    if (hex.godSent.olympianTalentKey !== expectedBinding[2])
      fail(
        `traitCatalog.hexes.${hex.spellTraitKey}.godSent.olympianTalentKey`,
        `must be ${expectedBinding[2]}`,
      );
    const nodeKeys = [
      ...hex.rareCandidates.values.map((candidate) => candidate.key),
      ...hex.epicCandidates.values.map((candidate) => candidate.key),
    ];
    if (new Set(nodeKeys).size !== nodeKeys.length)
      fail(`traitCatalog.hexes.${hex.spellTraitKey}`, 'Rare and Epic node keys must be unique');
  }
}
