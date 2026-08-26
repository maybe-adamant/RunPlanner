import type {
  CatalogCollection,
  TraitDeclaration,
  TraitGiverDeclaration,
} from '@run-planner/engine/catalog-schema';

import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireBoolean,
  requireNonEmpty,
  requireObject,
} from './common';
import { fail } from './errors';
import type { RawTraitCatalogInput, RawTraitGiverDeclaration } from '../declarations/traits';

const CALLING_CARD_GIVERS = new Set([
  'Zeus',
  'Hera',
  'Poseidon',
  'Demeter',
  'Apollo',
  'Aphrodite',
  'Hephaestus',
  'Hestia',
  'Ares',
  'Hermes',
  'Artemis',
  'Athena',
  'Dionysus',
]);

function closedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of ${values.join(', ')}`);
  }
  return value as Values[number];
}

export function normalizeGivers(
  raw: RawTraitCatalogInput['givers'],
  traits: CatalogCollection<TraitDeclaration>,
): CatalogCollection<TraitGiverDeclaration> {
  const declarations = requireArray(raw, 'givers').map(
    (value, index) =>
      requireObject(value, `givers[${index}]`) as unknown as RawTraitGiverDeclaration,
  );
  const values = declarations.map((giver, index) => {
    const path = `givers[${index}]`;
    const allowedKeys = new Set([
      'key',
      'label',
      'providerKind',
      'shopAwareGodTrait',
      'traitKeys',
      'priorityTraitKeys',
      'rarityPolicy',
      'denialParticipates',
      'selectedOptionPathPointBonuses',
    ]);
    const unsupportedKey = Object.keys(giver).find((key) => !allowedKeys.has(key));
    if (unsupportedKey !== undefined) fail(`${path}.${unsupportedKey}`, 'is not supported');
    if (giver.denialParticipates !== undefined)
      requireBoolean(giver.denialParticipates, `${path}.denialParticipates`);
    if (giver.shopAwareGodTrait !== undefined)
      requireBoolean(giver.shopAwareGodTrait, `${path}.shopAwareGodTrait`);
    if (giver.selectedOptionPathPointBonuses !== undefined) {
      if (
        giver.key !== 'SpellDrop' ||
        giver.selectedOptionPathPointBonuses.length !== 3 ||
        giver.selectedOptionPathPointBonuses[0] !== 0 ||
        giver.selectedOptionPathPointBonuses[1] !== 1 ||
        giver.selectedOptionPathPointBonuses[2] !== 2
      )
        fail(`${path}.selectedOptionPathPointBonuses`, 'must be SpellDrop ordered [0, 1, 2]');
    }
    const priorityTraitKeys = freezeUniqueStrings(
      requireArray(giver.priorityTraitKeys, `${path}.priorityTraitKeys`) as readonly string[],
      `${path}.priorityTraitKeys`,
    );
    const traitKeys = freezeUniqueStrings(
      requireArray(giver.traitKeys, `${path}.traitKeys`) as readonly string[],
      `${path}.traitKeys`,
    );
    if (traitKeys.length === 0) fail(`${path}.traitKeys`, 'must not be empty');
    for (const [memberIndex, traitKey] of traitKeys.entries()) {
      const trait = traits.byKey[traitKey];
      if (trait === undefined)
        fail(`${path}.traitKeys[${memberIndex}]`, `unknown trait ${traitKey}`);
      if (giver.providerKind === 'hammer' && trait.hammerCompatibility === undefined)
        fail(
          `${path}.traitKeys[${memberIndex}]`,
          'Hammer giver members require Hammer compatibility',
        );
      if (giver.providerKind === 'hammer' && trait.rarityDomain.kind !== 'none')
        fail(`${path}.traitKeys[${memberIndex}]`, 'Hammer members must have no rarity domain');
      if (giver.providerKind !== 'hammer' && trait.hammerCompatibility !== undefined)
        fail(`${path}.traitKeys[${memberIndex}]`, 'non-Hammer giver cannot contain a Hammer trait');
    }
    for (const [priorityIndex, traitKey] of priorityTraitKeys.entries()) {
      if (!traitKeys.includes(traitKey))
        fail(`${path}.priorityTraitKeys[${priorityIndex}]`, 'must belong to giver pool');
      if (traits.byKey[traitKey] === undefined)
        fail(`${path}.priorityTraitKeys[${priorityIndex}]`, `unknown trait ${traitKey}`);
    }
    const providerKind = closedValue(
      giver.providerKind,
      ['olympian', 'hermes', 'hammer', 'npc', 'spell', 'chaos'] as const,
      `${path}.providerKind`,
    );
    const rarityPolicy = requireObject(
      giver.rarityPolicy,
      `${path}.rarityPolicy`,
    ) as unknown as RawTraitGiverDeclaration['rarityPolicy'];
    const rarityPolicyDeclaration = rarityPolicy as unknown as {
      readonly kind?: unknown;
      readonly rarity?: unknown;
      readonly rarities?: unknown;
    };
    const rarityPolicyKind = closedValue(
      rarityPolicyDeclaration.kind,
      ['none', 'fixed', 'selectable'] as const,
      `${path}.rarityPolicy.kind`,
    );
    const expectedRarityPolicyKeys =
      rarityPolicyKind === 'none'
        ? ['kind']
        : rarityPolicyKind === 'fixed'
          ? ['kind', 'rarity']
          : ['kind', 'rarities'];
    const sortedExpectedRarityPolicyKeys = [...expectedRarityPolicyKeys].sort();
    const actualRarityPolicyKeys = Object.keys(rarityPolicy).sort();
    if (
      actualRarityPolicyKeys.length !== sortedExpectedRarityPolicyKeys.length ||
      actualRarityPolicyKeys.some((key, index) => key !== sortedExpectedRarityPolicyKeys[index])
    ) {
      fail(
        `${path}.rarityPolicy`,
        `${rarityPolicyKind} rarity policy must contain exactly ${expectedRarityPolicyKeys.join(', ')}`,
      );
    }
    const normalizedRarityPolicy =
      rarityPolicyKind === 'none'
        ? ({ kind: 'none' } as const)
        : rarityPolicyKind === 'fixed'
          ? ({
              kind: 'fixed' as const,
              rarity: closedValue(
                rarityPolicyDeclaration.rarity,
                ['Common', 'Rare', 'Epic', 'Legendary', 'Duo'] as const,
                `${path}.rarityPolicy.rarity`,
              ),
            } as const)
          : rarityPolicyKind === 'selectable'
            ? (() => {
                const rarities = freezeUniqueStrings(
                  requireArray(
                    rarityPolicyDeclaration.rarities,
                    `${path}.rarityPolicy.rarities`,
                  ) as readonly string[],
                  `${path}.rarityPolicy.rarities`,
                ).map((rarity, rarityIndex) =>
                  closedValue(
                    rarity,
                    ['Common', 'Rare', 'Epic'] as const,
                    `${path}.rarityPolicy.rarities[${rarityIndex}]`,
                  ),
                );
                if (rarities.length === 0) {
                  fail(`${path}.rarityPolicy.rarities`, 'must not be empty');
                }
                return { kind: 'selectable' as const, rarities: Object.freeze(rarities) };
              })()
            : (rarityPolicyKind satisfies never);
    const frozenRarityPolicy = Object.freeze(normalizedRarityPolicy);
    if (providerKind === 'hammer' && frozenRarityPolicy.kind !== 'none')
      fail(`${path}.rarityPolicy`, 'Hammer givers require no rarity authorship');
    const memberRarityKinds = traitKeys.map(
      (traitKey) => traits.byKey[traitKey]!.rarityDomain.kind,
    );
    if (frozenRarityPolicy.kind === 'none' && memberRarityKinds.some((kind) => kind !== 'none'))
      fail(`${path}.rarityPolicy`, 'no-rarity givers require only rarityless members');
    if (frozenRarityPolicy.kind !== 'none' && memberRarityKinds.some((kind) => kind === 'none'))
      fail(`${path}.rarityPolicy`, 'ranked giver policies cannot contain rarityless members');
    if (providerKind === 'olympian') {
      if (priorityTraitKeys.length !== 5)
        fail(`${path}.priorityTraitKeys`, 'Olympian givers require exactly five priority traits');
      const prioritySlots = priorityTraitKeys.map(
        (traitKey) => traits.byKey[traitKey]?.equipmentSlot,
      );
      if (
        prioritySlots.some((slot) => slot === undefined) ||
        new Set(prioritySlots).size !== 5 ||
        !(['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const).every((slot) =>
          prioritySlots.includes(slot),
        )
      ) {
        fail(
          `${path}.priorityTraitKeys`,
          'Olympian priority traits must cover Melee, Secondary, Ranged, Rush, and Mana',
        );
      }
    } else if (priorityTraitKeys.length !== 0) {
      fail(`${path}.priorityTraitKeys`, 'non-Olympian givers must not declare priority traits');
    }
    return Object.freeze({
      key: requireNonEmpty(giver.key, `${path}.key`),
      label: requireNonEmpty(giver.label, `${path}.label`),
      providerKind,
      shopAwareGodTrait: giver.shopAwareGodTrait === true,
      callingCardMenu: CALLING_CARD_GIVERS.has(requireNonEmpty(giver.key, `${path}.key`)),
      traitKeys,
      priorityTraitKeys,
      rarityPolicy: frozenRarityPolicy,
      ...(giver.denialParticipates === true ? { denialParticipates: true } : {}),
      ...(giver.selectedOptionPathPointBonuses === undefined
        ? {}
        : {
            selectedOptionPathPointBonuses: Object.freeze([0, 1, 2] as const),
          }),
    });
  });
  const denialKeys = values.filter((giver) => giver.denialParticipates).map((giver) => giver.key);
  const expectedDenialKeys = [
    'Aphrodite',
    'Apollo',
    'Ares',
    'Demeter',
    'Hephaestus',
    'Hera',
    'Hestia',
    'Poseidon',
    'Zeus',
    'Hermes',
  ];
  const expectedDenialKeySet = new Set(expectedDenialKeys);
  const actualDenialKeySet = new Set(denialKeys);
  const missingDenialKeys = expectedDenialKeys.filter((key) => !actualDenialKeySet.has(key));
  const unexpectedDenialKeys = denialKeys.filter((key) => !expectedDenialKeySet.has(key));
  if (
    denialKeys.length !== expectedDenialKeys.length ||
    missingDenialKeys.length > 0 ||
    unexpectedDenialKeys.length > 0
  )
    fail(
      'givers',
      `Denial participants must be exactly the nine Olympians and Hermes (missing: ${missingDenialKeys.join(',') || 'none'}; unexpected: ${unexpectedDenialKeys.join(',') || 'none'})`,
    );
  for (const giver of values) {
    if (
      giver.denialParticipates &&
      giver.providerKind !== 'olympian' &&
      giver.providerKind !== 'hermes'
    )
      fail(`givers.${giver.key}.denialParticipates`, 'requires an Olympian or Hermes giver');
  }
  return createCollection(values, 'givers', (giver) => giver.key);
}
