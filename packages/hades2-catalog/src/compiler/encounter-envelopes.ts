import type {
  CatalogCollection,
  EncounterEnvelope,
  EncounterEnvelopeSlot,
  EncounterSlotRewardAttachment,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type {
  RawEncounterEnvelopeDeclaration,
  RawEncounterEnvelopeSlotDeclaration,
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
  validateRequirementReferences,
} from './requirements';
import { normalizeRewardBinding } from './rewardBindings';

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
