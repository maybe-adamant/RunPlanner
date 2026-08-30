import { isCombatBearingEncounterPhaseKind } from '@run-planner/engine/catalog-schema';
import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterEnvelopeSlot,
  EncounterPhaseKind,
  EncounterSet,
  KeepsakeDeclaration,
  EncounterSlotRewardAttachment,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';
import type { TraitCatalog } from '@run-planner/engine/catalog-schema';

import type {
  RawEncounterDefinitionDeclaration,
  RawEncounterEnvelopeDeclaration,
  RawEncounterEnvelopeSlotDeclaration,
  RawEncounterSetDeclaration,
} from '../declarations';
import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';
import {
  normalizeRequirement,
  rejectEncounterHistoryRequirements,
  validateEncounterRequirementReferences,
  validateRequirementReferences,
} from './requirements';
import { normalizeRewardBinding } from './rewardBindings';

const encounterPhaseKinds = new Set<EncounterPhaseKind>([
  'boss',
  'combat',
  'miniboss',
  'nonCombat',
  'story',
]);

function normalizeRewardAttachment(
  raw: NonNullable<RawEncounterEnvelopeSlotDeclaration['rewardAttachment']>,
  rewards: RewardKernelCatalog,
  path: string,
): EncounterSlotRewardAttachment {
  const receivedKind: unknown = (raw as { readonly kind?: unknown }).kind;
  if (raw.kind === 'localReward') {
    return Object.freeze({
      kind: 'localReward',
      groupKey: requireNonEmpty(raw.groupKey, `${path}.groupKey`),
      slotKey: requireNonEmpty(raw.slotKey, `${path}.slotKey`),
    });
  }
  if (raw.kind === 'rewardWheel') {
    const key = requireNonEmpty(raw.key, `${path}.key`);
    const reward = normalizeRewardBinding(raw.reward, rewards, `${path}.reward`);
    if (reward.kind !== 'countedChoice') {
      fail(`${path}.reward.kind`, 'reward wheels require countedChoice');
    }
    if (!reward.storeKeys.includes(raw.defaultStoreKey)) {
      fail(`${path}.defaultStoreKey`, 'must belong to the wheel reward store domain');
    }
    const offerKeys = freezeUniqueStrings(raw.offerKeys, `${path}.offerKeys`);
    if (offerKeys.length === 0) {
      fail(`${path}.offerKeys`, 'must not be empty');
    }
    const min = requirePositiveInteger(raw.offerCount.min, `${path}.offerCount.min`);
    const max = requirePositiveInteger(raw.offerCount.max, `${path}.offerCount.max`);
    const defaultValue = requirePositiveInteger(
      raw.offerCount.defaultValue,
      `${path}.offerCount.defaultValue`,
    );
    if (max < min || max !== offerKeys.length) {
      fail(`${path}.offerCount.max`, 'must equal offer slot capacity and be at least min');
    }
    if (defaultValue < min || defaultValue > max) {
      fail(`${path}.offerCount.defaultValue`, 'must be within the offer-count range');
    }
    if (raw.picked !== 'exactlyOne') {
      fail(`${path}.picked`, `unknown wheel pick policy ${String(raw.picked)}`);
    }
    return Object.freeze({
      kind: 'rewardWheel',
      key,
      reward,
      defaultStoreKey: raw.defaultStoreKey,
      offerKeys,
      offerCount: Object.freeze({ min, max, defaultValue }),
      picked: 'exactlyOne',
    });
  }
  fail(`${path}.kind`, `unknown encounter reward attachment ${String(receivedKind)}`);
}

function normalizeEnvelopeSlot(
  raw: RawEncounterEnvelopeSlotDeclaration,
  rewards: RewardKernelCatalog,
  path: string,
): EncounterEnvelopeSlot {
  const key = requireNonEmpty(raw.key, `${path}.key`);
  if (raw.activation !== 'always' && raw.activation !== 'templateControlled') {
    fail(`${path}.activation`, `unknown slot activation ${String(raw.activation)}`);
  }
  const activationRequirement =
    raw.activationRequirement === undefined
      ? undefined
      : normalizeRequirement(raw.activationRequirement, `${path}.activationRequirement`);
  if (activationRequirement !== undefined) {
    if (raw.activation !== 'templateControlled') {
      fail(`${path}.activationRequirement`, 'requires templateControlled activation');
    }
    validateRequirementReferences(
      activationRequirement,
      rewards.rewardTypes,
      `${path}.activationRequirement`,
    );
    rejectEncounterHistoryRequirements(activationRequirement, `${path}.activationRequirement`);
  }
  return Object.freeze({
    key,
    activation: raw.activation,
    ...(activationRequirement === undefined ? {} : { activationRequirement }),
    ...(raw.rewardAttachment === undefined
      ? {}
      : {
          rewardAttachment: normalizeRewardAttachment(
            raw.rewardAttachment,
            rewards,
            `${path}.rewardAttachment`,
          ),
        }),
  });
}

export function normalizeEncounterEnvelopes(
  rawEnvelopes: readonly RawEncounterEnvelopeDeclaration[],
  rewards: RewardKernelCatalog,
): CatalogCollection<EncounterEnvelope> {
  return createCollection(
    rawEnvelopes.map((raw, envelopeIndex): EncounterEnvelope => {
      const path = `encounterEnvelopes[${envelopeIndex}]`;
      const key = requireNonEmpty(raw.key, `${path}.key`);
      const slots = raw.slots.map((slot, slotIndex) =>
        normalizeEnvelopeSlot(slot, rewards, `${path}.slots[${slotIndex}]`),
      );
      const seenSlotKeys = new Set<string>();
      const seenWheelKeys = new Set<string>();
      for (const [slotIndex, slot] of slots.entries()) {
        if (seenSlotKeys.has(slot.key)) {
          fail(`${path}.slots[${slotIndex}].key`, `duplicates slot ${slot.key}`);
        }
        seenSlotKeys.add(slot.key);
        if (slot.rewardAttachment?.kind === 'rewardWheel') {
          if (seenWheelKeys.has(slot.rewardAttachment.key)) {
            fail(
              `${path}.slots[${slotIndex}].rewardAttachment.key`,
              `duplicates wheel ${slot.rewardAttachment.key}`,
            );
          }
          seenWheelKeys.add(slot.rewardAttachment.key);
        }
      }
      return Object.freeze({ key, slots: Object.freeze(slots) });
    }),
    'encounterEnvelopes',
    (envelope) => envelope.key,
  );
}

export function normalizeEncounterDefinitions(
  rawDefinitions: readonly RawEncounterDefinitionDeclaration[],
  rewards: RewardKernelCatalog,
  traits: TraitCatalog,
  keepsakes: CatalogCollection<KeepsakeDeclaration>,
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
      for (const keepsakeKey of blocksKeepsakeSelectionKeys ?? []) {
        if (keepsakes.byKey[keepsakeKey] === undefined)
          fail(`${path}.blocksKeepsakeSelectionKeys`, `unknown keepsake ${keepsakeKey}`);
      }
      const requirements =
        raw.requirements === undefined
          ? undefined
          : normalizeRequirement(raw.requirements, `${path}.requirements`);
      if (requirements !== undefined) {
        validateRequirementReferences(requirements, rewards.rewardTypes, `${path}.requirements`);
      }
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
              if (traits.givers.byKey[giverKey] === undefined) {
                fail(`${path}.traitOfferProducer.giverKey`, `unknown trait giver ${giverKey}`);
              }
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
                [
                  'resultRewardTypes',
                  'conditionalResultRewardType',
                  'runtimeOfferRequirement',
                  'runtimeOfferFallbacks',
                  'response',
                  'pickupRequired',
                ],
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
                    if (rewards.rewardTypes.byKey[rewardType] === undefined)
                      fail(`${variantPath}.rewardType`, `unknown reward type ${rewardType}`);
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
                    if (rewards.rewardTypes.byKey[rewardType] === undefined)
                      fail(`${variantPath}.rewardType`, `unknown reward type ${rewardType}`);
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
                free.conditionalResultRewardType !== 'LastStandDrop' ||
                free.runtimeOfferRequirement !== 'missingLastStand' ||
                free.runtimeOfferFallbacks.length !== 2 ||
                free.runtimeOfferFallbacks[0]?.preferredRewardType !== 'LastStandDrop' ||
                free.runtimeOfferFallbacks[0]?.fallbackRewardType !== 'ArmorBoost' ||
                free.runtimeOfferFallbacks[1]?.preferredRewardType !== 'ArmorBoost' ||
                free.runtimeOfferFallbacks[1]?.fallbackRewardType !== 'EmptyMaxHealthDrop'
              )
                fail(
                  `${path}.nemesisRandomEvent.freeItem`,
                  'must retain its closed response, requiredness, and Last Stand marker',
                );
              const freeResults = freezeUniqueStrings(
                free.resultRewardTypes,
                `${path}.nemesisRandomEvent.freeItem.resultRewardTypes`,
              );
              for (const rewardType of freeResults)
                if (rewards.rewardTypes.byKey[rewardType] === undefined)
                  fail(
                    `${path}.nemesisRandomEvent.freeItem.resultRewardTypes`,
                    `unknown reward type ${rewardType}`,
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
              if (rewards.rewardTypes.byKey[policy.traitTrade.fixedResultRewardType] === undefined)
                fail(
                  `${path}.nemesisRandomEvent.traitTrade.fixedResultRewardType`,
                  'unknown reward type',
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
              for (const rewardType of [...contestResults, contest.failureResultRewardType])
                if (rewards.rewardTypes.byKey[rewardType] === undefined)
                  fail(
                    `${path}.nemesisRandomEvent.damageContest`,
                    `unknown reward type ${rewardType}`,
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
                  runtimeOfferRequirement: 'missingLastStand' as const,
                  runtimeOfferFallbacks: Object.freeze([
                    Object.freeze({
                      preferredRewardType: 'LastStandDrop' as const,
                      fallbackRewardType: 'ArmorBoost' as const,
                    }),
                    Object.freeze({
                      preferredRewardType: 'ArmorBoost' as const,
                      fallbackRewardType: 'EmptyMaxHealthDrop' as const,
                    }),
                  ]) as unknown as readonly [
                    {
                      readonly preferredRewardType: 'LastStandDrop';
                      readonly fallbackRewardType: 'ArmorBoost';
                    },
                    {
                      readonly preferredRewardType: 'ArmorBoost';
                      readonly fallbackRewardType: 'EmptyMaxHealthDrop';
                    },
                  ],
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
  definitions.values.forEach((definition, index) => {
    if (definition.requirements !== undefined) {
      validateEncounterRequirementReferences(
        definition.requirements,
        definitions,
        `encounterDefinitions[${index}].requirements`,
      );
    }
  });
  return definitions;
}

export function normalizeEncounterSets(
  rawSets: readonly RawEncounterSetDeclaration[],
  definitions: CatalogCollection<EncounterDefinition>,
): CatalogCollection<EncounterSet> {
  return createCollection(
    rawSets.map((raw, setIndex): EncounterSet => {
      const path = `encounterSets[${setIndex}]`;
      const key = requireNonEmpty(raw.key, `${path}.key`);
      const encounterDefinitionKeys = freezeUniqueStrings(
        raw.encounterDefinitionKeys,
        `${path}.encounterDefinitionKeys`,
      );
      if (encounterDefinitionKeys.length === 0) {
        fail(`${path}.encounterDefinitionKeys`, 'must not be empty');
      }
      for (const [definitionIndex, definitionKey] of encounterDefinitionKeys.entries()) {
        if (definitions.byKey[definitionKey] === undefined) {
          fail(
            `${path}.encounterDefinitionKeys[${definitionIndex}]`,
            `unknown encounter definition ${definitionKey}`,
          );
        }
      }
      const defaultAuthoringProfileKey = requireNonEmpty(
        raw.defaultAuthoringProfileKey,
        `${path}.defaultAuthoringProfileKey`,
      );
      if (!encounterDefinitionKeys.includes(defaultAuthoringProfileKey)) {
        fail(`${path}.defaultAuthoringProfileKey`, 'must be a member of the encounter set');
      }
      const authoringProfiles =
        raw.authoringProfiles === undefined
          ? undefined
          : Object.freeze(
              raw.authoringProfiles.map((rawProfile, profileIndex) => {
                const profilePath = `${path}.authoringProfiles[${profileIndex}]`;
                const profileKey = requireNonEmpty(rawProfile.key, `${profilePath}.key`);
                const profileDefinitionKeys = freezeUniqueStrings(
                  rawProfile.encounterDefinitionKeys,
                  `${profilePath}.encounterDefinitionKeys`,
                );
                if (profileDefinitionKeys.length === 0) {
                  fail(`${profilePath}.encounterDefinitionKeys`, 'must not be empty');
                }
                if (!profileDefinitionKeys.includes(profileKey)) {
                  fail(`${profilePath}.key`, 'must identify one exact definition in the profile');
                }
                for (const definitionKey of profileDefinitionKeys) {
                  if (!encounterDefinitionKeys.includes(definitionKey)) {
                    fail(
                      `${profilePath}.encounterDefinitionKeys`,
                      `${definitionKey} is not a member of ${key}`,
                    );
                  }
                }
                return Object.freeze({
                  key: profileKey,
                  encounterDefinitionKeys: profileDefinitionKeys,
                });
              }),
            );
      if (authoringProfiles !== undefined) {
        const profileKeys = authoringProfiles.map((profile) => profile.key);
        if (new Set(profileKeys).size !== profileKeys.length) {
          fail(`${path}.authoringProfiles`, 'must have unique authored keys');
        }
        const profiledDefinitionKeys = authoringProfiles.flatMap(
          (profile) => profile.encounterDefinitionKeys,
        );
        if (
          profiledDefinitionKeys.length !== encounterDefinitionKeys.length ||
          new Set(profiledDefinitionKeys).size !== encounterDefinitionKeys.length ||
          encounterDefinitionKeys.some(
            (definitionKey) => !profiledDefinitionKeys.includes(definitionKey),
          )
        ) {
          fail(`${path}.authoringProfiles`, 'must partition every exact encounter definition once');
        }
        if (!profileKeys.includes(defaultAuthoringProfileKey)) {
          fail(`${path}.defaultAuthoringProfileKey`, 'must identify an authored profile');
        }
      }
      return Object.freeze({
        key,
        encounterDefinitionKeys,
        defaultAuthoringProfileKey,
        ...(authoringProfiles === undefined ? {} : { authoringProfiles }),
      });
    }),
    'encounterSets',
    (set) => set.key,
  );
}
