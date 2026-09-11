import { isCombatBearingEncounterPhaseKind } from '@run-planner/engine/catalog-schema';
import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterPhaseKind,
} from '@run-planner/engine/catalog-schema';

import type { RawEncounterDefinitionDeclaration } from '../../declarations/index';
import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requirePositiveInteger,
} from '../common';
import { fail } from '../errors';
import { normalizeRequirement } from '../requirements';

const encounterPhaseKinds = new Set<EncounterPhaseKind>([
  'boss',
  'combat',
  'miniboss',
  'nonCombat',
  'story',
]);

export function normalizeEncounterDefinitions(
  rawDefinitions: readonly RawEncounterDefinitionDeclaration[],
): CatalogCollection<EncounterDefinition> {
  const definitions = createCollection(
    rawDefinitions.map((raw, definitionIndex): EncounterDefinition => {
      const path = `encounterDefinitions[${definitionIndex}]`;
      const key = requireNonEmpty(raw.key, `${path}.key`);
      const label = requireNonEmpty(raw.label, `${path}.label`);
      if (!encounterPhaseKinds.has(raw.kind)) {
        fail(`${path}.kind`, `unknown encounter kind ${String(raw.kind)}`);
      }
      if (typeof raw.countsEncounterDepth !== 'boolean') {
        fail(`${path}.countsEncounterDepth`, 'must be boolean');
      }
      if (
        raw.advancesHermesShrineDeliveryUses !== undefined &&
        typeof raw.advancesHermesShrineDeliveryUses !== 'boolean'
      ) {
        fail(`${path}.advancesHermesShrineDeliveryUses`, 'must be boolean');
      }
      if (raw.canEncounterSkip !== undefined && typeof raw.canEncounterSkip !== 'boolean') {
        fail(`${path}.canEncounterSkip`, 'must be boolean');
      }
      if (raw.blocksFigLeaf !== undefined && typeof raw.blocksFigLeaf !== 'boolean') {
        fail(`${path}.blocksFigLeaf`, 'must be boolean');
      }
      if (raw.blocksGorgon !== undefined && typeof raw.blocksGorgon !== 'boolean') {
        fail(`${path}.blocksGorgon`, 'must be boolean');
      }
      if (raw.hostsGorgon !== undefined && typeof raw.hostsGorgon !== 'boolean') {
        fail(`${path}.hostsGorgon`, 'must be boolean');
      }
      if (
        raw.skipEndEncounterEffects !== undefined &&
        typeof raw.skipEndEncounterEffects !== 'boolean'
      ) {
        fail(`${path}.skipEndEncounterEffects`, 'must be boolean');
      }
      if (raw.skipEndEncounterEffects === true && raw.canEncounterSkip !== true) {
        fail(`${path}.skipEndEncounterEffects`, 'requires canEncounterSkip');
      }
      const blocksKeepsakeSelectionKeys =
        raw.blocksKeepsakeSelectionKeys === undefined
          ? undefined
          : freezeUniqueStrings(
              raw.blocksKeepsakeSelectionKeys.map((key) =>
                requireNonEmpty(key, `${path}.blocksKeepsakeSelectionKeys`),
              ),
              `${path}.blocksKeepsakeSelectionKeys`,
            );
      const requirements =
        raw.requirements === undefined
          ? undefined
          : normalizeRequirement(raw.requirements, `${path}.requirements`);
      if (raw.sequenceEffect !== undefined && raw.sequenceEffect.kind !== 'terminateSuffix') {
        fail(
          `${path}.sequenceEffect.kind`,
          `unknown encounter sequence effect ${String(raw.sequenceEffect.kind)}`,
        );
      }
      const npcPresentationKey =
        raw.npcPresentationKey === undefined
          ? undefined
          : requireNonEmpty(raw.npcPresentationKey, `${path}.npcPresentationKey`);
      const traitOfferProducer =
        raw.traitOfferProducer === undefined
          ? undefined
          : (() => {
              if (raw.traitOfferProducer.kind !== 'traitOffer') {
                fail(
                  `${path}.traitOfferProducer.kind`,
                  `unknown trait offer producer ${String(raw.traitOfferProducer.kind)}`,
                );
              }
              const giverKey = requireNonEmpty(
                raw.traitOfferProducer.giverKey,
                `${path}.traitOfferProducer.giverKey`,
              );
              return Object.freeze({ kind: 'traitOffer' as const, giverKey });
            })();
      if (raw.requiresInteraction !== undefined && typeof raw.requiresInteraction !== 'boolean')
        fail(`${path}.requiresInteraction`, 'must be boolean');
      if (
        raw.suppressesIncomingReward !== undefined &&
        typeof raw.suppressesIncomingReward !== 'boolean'
      )
        fail(`${path}.suppressesIncomingReward`, 'must be boolean');
      const nemesisRandomEvent =
        raw.nemesisRandomEvent === undefined
          ? undefined
          : (() => {
              const policy = raw.nemesisRandomEvent;
              const exactKeys = (value: unknown, keys: readonly string[], valuePath: string) => {
                if (typeof value !== 'object' || value === null || Array.isArray(value))
                  fail(valuePath, 'must be an object with the exact closed declaration shape');
                const actual = Object.keys(value).sort();
                const expected = [...keys].sort();
                if (
                  actual.length !== expected.length ||
                  actual.some((key, index) => key !== expected[index])
                )
                  fail(valuePath, 'must use the exact closed declaration shape');
              };
              exactKeys(
                policy,
                [
                  'freeItem',
                  'goldTrade',
                  'damageTrade',
                  'traitTrade',
                  'damageContest',
                  'hOptionalCapacityReservation',
                ],
                `${path}.nemesisRandomEvent`,
              );
              exactKeys(
                policy.goldTrade,
                ['variants', 'response', 'pickupRequiredOnAccept'],
                `${path}.nemesisRandomEvent.goldTrade`,
              );
              exactKeys(
                policy.damageTrade,
                ['variants', 'response', 'pickupRequiredOnAccept'],
                `${path}.nemesisRandomEvent.damageTrade`,
              );
              exactKeys(
                policy.damageContest,
                [
                  'successResultRewardTypes',
                  'failureResultRewardType',
                  'response',
                  'pickupRequired',
                ],
                `${path}.nemesisRandomEvent.damageContest`,
              );
              exactKeys(
                policy.freeItem,
                ['resultRewardTypes', 'conditionalResultRewardType', 'response', 'pickupRequired'],
                `${path}.nemesisRandomEvent.freeItem`,
              );
              exactKeys(
                policy.traitTrade,
                ['response', 'pickupRequiredOnAccept', 'fixedResultRewardType', 'traitSelection'],
                `${path}.nemesisRandomEvent.traitTrade`,
              );
              const normalizeEnteredBiome = (
                range: { readonly min?: number; readonly max?: number },
                rangePath: string,
              ) => {
                const min =
                  range.min === undefined
                    ? undefined
                    : requirePositiveInteger(range.min, `${rangePath}.min`);
                const max =
                  range.max === undefined
                    ? undefined
                    : requirePositiveInteger(range.max, `${rangePath}.max`);
                if (min !== undefined && max !== undefined && max < min)
                  fail(rangePath, 'maximum must not precede minimum');
                return Object.freeze({
                  ...(min === undefined ? {} : { min }),
                  ...(max === undefined ? {} : { max }),
                });
              };
              const normalizeGoldVariants = () =>
                Object.freeze(
                  policy.goldTrade.variants.map((variant, index) => {
                    const variantPath = `${path}.nemesisRandomEvent.goldTrade[${index}]`;
                    exactKeys(variant, ['rewardType', 'enteredBiome', 'requirement'], variantPath);
                    exactKeys(
                      variant.enteredBiome,
                      ['min', 'max'].filter(
                        (key) => variant.enteredBiome[key as 'min' | 'max'] !== undefined,
                      ),
                      `${variantPath}.enteredBiome`,
                    );
                    const rewardType = requireNonEmpty(
                      variant.rewardType,
                      `${variantPath}.rewardType`,
                    );
                    if (!['none', 'pomLegal', 'hammerEarlyOrLate'].includes(variant.requirement))
                      fail(`${variantPath}.requirement`, 'has an unknown result requirement');
                    return Object.freeze({
                      rewardType,
                      enteredBiome: normalizeEnteredBiome(
                        variant.enteredBiome,
                        `${variantPath}.enteredBiome`,
                      ),
                      requirement: variant.requirement,
                    });
                  }),
                );
              const normalizeDamageVariants = () =>
                Object.freeze(
                  policy.damageTrade.variants.map((variant, index) => {
                    const variantPath = `${path}.nemesisRandomEvent.damageTrade[${index}]`;
                    exactKeys(variant, ['rewardType', 'enteredBiome', 'requirement'], variantPath);
                    exactKeys(
                      variant.enteredBiome,
                      ['min', 'max'].filter(
                        (key) => variant.enteredBiome[key as 'min' | 'max'] !== undefined,
                      ),
                      `${variantPath}.enteredBiome`,
                    );
                    const rewardType = requireNonEmpty(
                      variant.rewardType,
                      `${variantPath}.rewardType`,
                    );
                    if (!['none', 'pomLegal', 'talentLegal'].includes(variant.requirement))
                      fail(`${variantPath}.requirement`, 'has an unknown result requirement');
                    return Object.freeze({
                      rewardType,
                      enteredBiome: normalizeEnteredBiome(
                        variant.enteredBiome,
                        `${variantPath}.enteredBiome`,
                      ),
                      requirement: variant.requirement,
                    });
                  }),
                );
              const free = policy.freeItem;
              if (
                free.response !== 'none' ||
                free.pickupRequired !== false ||
                free.conditionalResultRewardType !== 'LastStandDrop'
              )
                fail(
                  `${path}.nemesisRandomEvent.freeItem`,
                  'must retain its closed response, requiredness, and Last Stand marker',
                );
              const freeResults = freezeUniqueStrings(
                free.resultRewardTypes,
                `${path}.nemesisRandomEvent.freeItem.resultRewardTypes`,
              );
              if (
                policy.goldTrade.response.length !== 2 ||
                policy.goldTrade.response[0] !== 'accept' ||
                policy.goldTrade.response[1] !== 'decline' ||
                policy.goldTrade.pickupRequiredOnAccept !== true ||
                policy.damageTrade.response.length !== 2 ||
                policy.damageTrade.response[0] !== 'accept' ||
                policy.damageTrade.response[1] !== 'decline' ||
                policy.damageTrade.pickupRequiredOnAccept !== true
              )
                fail(
                  `${path}.nemesisRandomEvent`,
                  'must retain exact trade response and accepted-pickup requiredness',
                );
              if (
                policy.traitTrade.response.length !== 2 ||
                policy.traitTrade.response[0] !== 'accept' ||
                policy.traitTrade.response[1] !== 'decline' ||
                policy.traitTrade.pickupRequiredOnAccept !== true ||
                policy.traitTrade.fixedResultRewardType !== 'RoomMoneyTripleDrop' ||
                policy.traitTrade.traitSelection !== 'eligibleGodTraitCommonPriority'
              )
                fail(
                  `${path}.nemesisRandomEvent.traitTrade`,
                  'must retain its closed response, Triple Gold, requiredness, and Common-priority policy',
                );
              const contest = policy.damageContest;
              if (
                contest.response !== 'none' ||
                contest.pickupRequired !== false ||
                contest.failureResultRewardType !== 'RoomRewardConsolationPrize'
              )
                fail(
                  `${path}.nemesisRandomEvent.damageContest`,
                  'must retain its closed response, requiredness, and Consolation result',
                );
              const contestResults = freezeUniqueStrings(
                contest.successResultRewardTypes,
                `${path}.nemesisRandomEvent.damageContest.successResultRewardTypes`,
              );
              if (raw.nemesisRandomEvent.hOptionalCapacityReservation !== 1)
                fail(`${path}.nemesisRandomEvent.hOptionalCapacityReservation`, 'must be 1');
              if (
                raw.kind !== 'nonCombat' ||
                raw.countsEncounterDepth ||
                raw.requiresInteraction !== true
              )
                fail(`${path}.nemesisRandomEvent`, 'requires a required noncombat interaction');
              return Object.freeze({
                freeItem: Object.freeze({
                  resultRewardTypes: freeResults as unknown as readonly [
                    'EmptyMaxHealthDrop',
                    'HealDrop',
                    'LastStandDrop',
                    'ArmorBoost',
                  ],
                  conditionalResultRewardType: 'LastStandDrop' as const,
                  response: 'none' as const,
                  pickupRequired: false as const,
                }),
                goldTrade: Object.freeze({
                  variants: normalizeGoldVariants(),
                  response: Object.freeze(['accept', 'decline']) as readonly ['accept', 'decline'],
                  pickupRequiredOnAccept: true as const,
                }),
                damageTrade: Object.freeze({
                  variants: normalizeDamageVariants(),
                  response: Object.freeze(['accept', 'decline']) as readonly ['accept', 'decline'],
                  pickupRequiredOnAccept: true as const,
                }),
                traitTrade: Object.freeze({
                  response: Object.freeze(['accept', 'decline']) as readonly ['accept', 'decline'],
                  pickupRequiredOnAccept: true as const,
                  fixedResultRewardType: 'RoomMoneyTripleDrop' as const,
                  traitSelection: 'eligibleGodTraitCommonPriority' as const,
                }),
                damageContest: Object.freeze({
                  successResultRewardTypes: contestResults as unknown as readonly [
                    'MaxHealthDrop',
                    'MaxManaDrop',
                    'StackUpgrade',
                    'RoomMoneyDrop',
                    'TalentDrop',
                  ],
                  failureResultRewardType: 'RoomRewardConsolationPrize' as const,
                  response: 'none' as const,
                  pickupRequired: false as const,
                }),
                hOptionalCapacityReservation: 1 as const,
              });
            })();
      return Object.freeze({
        key,
        label,
        kind: raw.kind,
        countsEncounterDepth: raw.countsEncounterDepth,
        advancesHermesShrineDeliveryUses:
          raw.advancesHermesShrineDeliveryUses ?? isCombatBearingEncounterPhaseKind(raw.kind),
        canEncounterSkip: raw.canEncounterSkip ?? false,
        blocksFigLeaf: raw.blocksFigLeaf ?? false,
        blocksGorgon: raw.blocksGorgon ?? false,
        hostsGorgon: raw.hostsGorgon ?? false,
        skipEndEncounterEffects: raw.skipEndEncounterEffects ?? false,
        requiresInteraction: raw.requiresInteraction ?? false,
        suppressesIncomingReward: raw.suppressesIncomingReward ?? false,
        ...(blocksKeepsakeSelectionKeys === undefined ? {} : { blocksKeepsakeSelectionKeys }),
        ...(requirements === undefined ? {} : { requirements }),
        ...(raw.sequenceEffect === undefined
          ? {}
          : { sequenceEffect: Object.freeze({ kind: 'terminateSuffix' as const }) }),
        ...(npcPresentationKey === undefined ? {} : { npcPresentationKey }),
        ...(traitOfferProducer === undefined ? {} : { traitOfferProducer }),
        ...(nemesisRandomEvent === undefined ? {} : { nemesisRandomEvent }),
      });
    }),
    'encounterDefinitions',
    (definition) => definition.key,
  );
  return definitions;
}
