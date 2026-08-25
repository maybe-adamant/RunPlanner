import type {
  Catalog,
  EncounterRewardWheelAttachment,
  RoomDeclaration,
} from '../../catalog-schema';
import type {
  AuthoredRewardState,
  EphyraCombatState,
  RewardWheelState,
  ShipCombatState,
} from '../model';
import {
  expectExactKeys,
  expectPositiveInteger,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';
import {
  requireCountedBinding,
  requireEphyraSideRooms,
  requireShipCombatWheels,
} from './declaration';
import { decodeCountedOffer, decodeNullableRewardState } from './reward-acquisition-codec';

function expectedKind(value: unknown, expected: string, path: string): void {
  const kind = expectString(value, `${path}.kind`);
  if (kind !== expected)
    failProjectDocument(`${path}.kind`, `expected ${expected}, received ${kind}`);
}

function decodeRewardWheel(
  value: unknown,
  catalog: Catalog,
  descriptor: EncounterRewardWheelAttachment,
  path: string,
): RewardWheelState {
  const wheel = expectRecord(value, path);
  expectExactKeys(wheel, ['storeKey', 'offerCount', 'offers', 'pickedOfferIndex'], path);
  const storeKey = expectString(wheel.storeKey, `${path}.storeKey`);
  if (!descriptor.reward.storeKeys.includes(storeKey)) {
    failProjectDocument(`${path}.storeKey`, `${storeKey} is not available from this wheel`);
  }
  const offerCount = expectPositiveInteger(wheel.offerCount, `${path}.offerCount`);
  if (offerCount < descriptor.offerCount.min || offerCount > descriptor.offerCount.max) {
    failProjectDocument(
      `${path}.offerCount`,
      `must be between ${descriptor.offerCount.min} and ${descriptor.offerCount.max}`,
    );
  }
  const rawOffers = expectRecord(wheel.offers, `${path}.offers`);
  expectExactKeys(rawOffers, descriptor.offerKeys, `${path}.offers`);
  const offers: Record<string, AuthoredRewardState | null> = {};
  for (const offerKey of descriptor.offerKeys) {
    const reward = decodeNullableRewardState(
      rawOffers[offerKey],
      catalog,
      `${path}.offers.${offerKey}`,
      {
        kind: 'producerLifecycle',
        key: descriptor.reward.producerLifecycleKey,
      },
    );
    if (reward === null) {
      offers[offerKey] = null;
      continue;
    }
    if (!descriptor.reward.allowedRewardTypes.includes(reward.offer.rewardType))
      failProjectDocument(
        `${path}.offers.${offerKey}.offer.rewardType`,
        `${reward.offer.rewardType} is filtered from this wheel`,
      );
    offers[offerKey] = reward;
  }
  const pickedOfferIndex = expectPositiveInteger(
    wheel.pickedOfferIndex,
    `${path}.pickedOfferIndex`,
  );
  if (pickedOfferIndex > offerCount) {
    failProjectDocument(`${path}.pickedOfferIndex`, 'must select an active offer');
  }
  return Object.freeze({
    storeKey,
    offerCount,
    offers: Object.freeze(offers),
    pickedOfferIndex,
  });
}

export function decodeShipCombatState(
  value: Record<string, unknown>,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): ShipCombatState {
  expectedKind(value.kind, 'shipCombat', path);
  expectExactKeys(value, ['kind', 'encounterCount', 'wheels'], path);
  const encounterCount = expectPositiveInteger(value.encounterCount, `${path}.encounterCount`);
  if (encounterCount !== 2 && encounterCount !== 3) {
    failProjectDocument(`${path}.encounterCount`, 'must be 2 or 3');
  }
  const descriptors = requireShipCombatWheels(catalog, room, path);
  const rawWheels = expectRecord(value.wheels, `${path}.wheels`);
  expectExactKeys(
    rawWheels,
    descriptors.map((descriptor) => descriptor.key),
    `${path}.wheels`,
  );
  const wheels: Record<string, RewardWheelState> = {};
  for (const descriptor of descriptors) {
    wheels[descriptor.key] = decodeRewardWheel(
      rawWheels[descriptor.key],
      catalog,
      descriptor,
      `${path}.wheels.${descriptor.key}`,
    );
  }
  return Object.freeze({
    kind: 'shipCombat',
    encounterCount,
    wheels: Object.freeze(wheels),
  });
}

export function decodeEphyraCombatState(
  value: Record<string, unknown>,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): EphyraCombatState {
  expectedKind(value.kind, 'ephyraCombat', path);
  expectExactKeys(value, ['kind', 'reward'], path);
  requireEphyraSideRooms(room, path);
  const parentReward = decodeNullableRewardState(value.reward, catalog, `${path}.reward`, {
    kind: 'producerLifecycle',
    key: requireCountedBinding(room, path).producerLifecycleKey,
  });
  if (parentReward === null)
    return Object.freeze({
      kind: 'ephyraCombat',
      reward: null,
    });
  const offer = decodeCountedOffer(
    parentReward.offer,
    catalog,
    requireCountedBinding(room, path),
    `${path}.reward.offer`,
  );
  return Object.freeze({
    kind: 'ephyraCombat',
    reward: Object.freeze({ ...parentReward, offer }),
  });
}
