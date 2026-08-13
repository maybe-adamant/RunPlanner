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
      if (raw.canEncounterSkip !== undefined && typeof raw.canEncounterSkip !== 'boolean') {
        fail(`${path}.canEncounterSkip`, 'must be boolean');
      }
      if (raw.blocksFigLeaf !== undefined && typeof raw.blocksFigLeaf !== 'boolean') {
        fail(`${path}.blocksFigLeaf`, 'must be boolean');
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
      return Object.freeze({
        key,
        label,
        kind: raw.kind,
        countsEncounterDepth: raw.countsEncounterDepth,
        canEncounterSkip: raw.canEncounterSkip ?? false,
        blocksFigLeaf: raw.blocksFigLeaf ?? false,
        skipEndEncounterEffects: raw.skipEndEncounterEffects ?? false,
        ...(blocksKeepsakeSelectionKeys === undefined ? {} : { blocksKeepsakeSelectionKeys }),
        ...(requirements === undefined ? {} : { requirements }),
        ...(raw.sequenceEffect === undefined
          ? {}
          : { sequenceEffect: Object.freeze({ kind: 'terminateSuffix' as const }) }),
        ...(npcPresentationKey === undefined ? {} : { npcPresentationKey }),
        ...(traitOfferProducer === undefined ? {} : { traitOfferProducer }),
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
      const defaultEncounterDefinitionKey = requireNonEmpty(
        raw.defaultEncounterDefinitionKey,
        `${path}.defaultEncounterDefinitionKey`,
      );
      if (!encounterDefinitionKeys.includes(defaultEncounterDefinitionKey)) {
        fail(`${path}.defaultEncounterDefinitionKey`, 'must be a member of the encounter set');
      }
      return Object.freeze({ key, encounterDefinitionKeys, defaultEncounterDefinitionKey });
    }),
    'encounterSets',
    (set) => set.key,
  );
}
