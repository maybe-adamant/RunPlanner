import type { Catalog } from '../../../catalog-schema';
import type { AuthoredRewardState, RoomOccurrence } from '../../model';
import {
  createBiomeAddress,
  type AcquisitionEntryAddress,
  type TraitOfferOwnerAddress,
} from '../../addresses';
import {
  parseClockedTraitGeneratedPickupEntryKey,
  selectedPickupProducerForEntry,
} from '../../acquisition/pickup-producers';
import {
  authoredAcquisitionEntryAtSite,
  authoredShopOffer,
  replaceAuthoredShopOffer,
  shopSlotProfile,
} from '../../shop';
import { parseArtificerReplacementEntryKey } from '../../acquisition/artificer';
import { parseHermesShrineDeliveryEntryKey } from '../../hermes-shrine-delivery';
import { requireShipCombatWheels } from '../../room-state/declaration';
import { incomingLevelEffectSource } from '../../room-state/level-effects';
import type { LevelResolutionEffectSource } from '../../../reward-kernel/level-effects';
import { failCommand } from '../contract';
import type { TraitOfferCommand, LevelResolutionCommand } from '../types';

type RewardCommand = TraitOfferCommand | LevelResolutionCommand;

export interface LocatedReward {
  readonly reward: AuthoredRewardState;
  readonly levelEffectSource: LevelResolutionEffectSource;
}

function requireAuthoredReward(
  reward: AuthoredRewardState | null | undefined,
  command: RewardCommand,
  detail: string,
): AuthoredRewardState {
  if (reward === undefined || reward === null) failCommand(command, detail);
  return reward;
}

function pickupEntrySource(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  owner: AcquisitionEntryAddress,
  command: RewardCommand,
): LocatedReward {
  const entry = authoredAcquisitionEntryAtSite(occurrence, owner.site, owner.entryKey);
  if (entry === undefined || entry === null)
    failCommand(command, `missing or unresolved pickup entry ${owner.entryKey}`);
  if (
    owner.site.pointKey === 'roomExit' &&
    occurrence.state.kind === 'shop' &&
    occurrence.state.shop !== undefined
  )
    return Object.freeze({
      reward: entry,
      levelEffectSource: {
        kind: 'shopProfile' as const,
        key: shopSlotProfile(
          catalog,
          occurrence.gameName,
          occurrence.state.shop.profileKey,
          owner.entryKey,
        )!.key,
      },
    });
  if (parseArtificerReplacementEntryKey(owner.entryKey) !== undefined)
    return Object.freeze({
      reward: entry,
      levelEffectSource: { kind: 'producerLifecycle' as const, key: 'RoomReward' },
    });
  if (
    owner.site.pointKey === 'hermesShrineDelivery' &&
    parseHermesShrineDeliveryEntryKey(owner.entryKey) !== undefined
  )
    return Object.freeze({
      reward: entry,
      levelEffectSource: { kind: 'producerLifecycle' as const, key: 'HermesShrineDelivery' },
    });
  if (
    owner.site.pointKey === 'roomExit' &&
    parseClockedTraitGeneratedPickupEntryKey(owner.entryKey) !== undefined
  )
    return Object.freeze({
      reward: entry,
      levelEffectSource: { kind: 'producerLifecycle' as const, key: 'GeneratedTraitPickup' },
    });
  const producer = selectedPickupProducerForEntry(
    catalog,
    createBiomeAddress(owner.routeKey, owner.biomeKey),
    occurrence,
    owner.site.pointKey,
    owner.entryKey,
  );
  if (producer === undefined) failCommand(command, 'pickup entry has no unique selected producer');
  return Object.freeze({
    reward: entry,
    levelEffectSource: {
      kind: 'producerLifecycle' as const,
      key: producer.producerLifecycleKey,
    },
  });
}

export function locateReward(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  state: RoomOccurrence['state'],
  owner: TraitOfferOwnerAddress,
  command: RewardCommand,
): LocatedReward | undefined {
  switch (owner.kind) {
    case 'acquisitionEntry':
      return pickupEntrySource(catalog, occurrence, owner, command);
    case 'incomingReward':
      switch (state.kind) {
        case 'counted':
        case 'fixed':
        case 'ephyraCombat': {
          const room = catalog.rooms.byKey[occurrence.gameName];
          const binding = room?.incomingReward;
          if (binding === undefined || binding.kind === 'none')
            failCommand(command, `${occurrence.gameName} has no incoming reward binding`);
          return Object.freeze({
            reward: requireAuthoredReward(
              state.reward,
              command,
              'cannot edit acquisition outcome before reward authorship',
            ),
            levelEffectSource: {
              kind: 'producerLifecycle',
              key: binding.producerLifecycleKey,
            } as const,
          });
        }
        case 'anomaly':
        case 'freeReward': {
          const levelEffectSource = incomingLevelEffectSource(catalog, occurrence);
          if (levelEffectSource === undefined)
            failCommand(command, `${occurrence.gameName} has no declared incoming reward binding`);
          return Object.freeze({
            reward: requireAuthoredReward(
              state.reward,
              command,
              'cannot edit acquisition outcome before reward authorship',
            ),
            levelEffectSource,
          });
        }
        case 'none':
        case 'fieldsCombat':
        case 'shipCombat':
        case 'shop':
          failCommand(command, `incoming reward is not owned by ${occurrence.gameName}`);
      }
      break;
    case 'localReward':
      if (state.kind === 'fieldsCombat') {
        const room = catalog.rooms.byKey[occurrence.gameName];
        const cageGroup = room?.localChildren.find((child) => child.key === owner.groupKey);
        const binding =
          cageGroup?.kind === 'boundedRewardSlots'
            ? cageGroup.reward
            : room?.fieldsOptionalRewards?.key === owner.groupKey
              ? room.fieldsOptionalRewards.reward
              : undefined;
        const slotKeys =
          cageGroup?.kind === 'boundedRewardSlots'
            ? cageGroup.slotKeys
            : room?.fieldsOptionalRewards?.key === owner.groupKey
              ? room.fieldsOptionalRewards.slotKeys
              : [];
        if (binding === undefined) {
          failCommand(
            command,
            `${occurrence.gameName} has no Fields reward group ${owner.groupKey}`,
          );
        }
        if (!slotKeys.includes(owner.slotKey)) {
          failCommand(command, `${occurrence.gameName} has no Fields reward slot ${owner.slotKey}`);
        }
        const reward =
          owner.groupKey === 'cages'
            ? state.cages[owner.slotKey]
            : state.optionalRewards[owner.slotKey];
        if (reward === undefined) failCommand(command, `missing Fields reward ${owner.slotKey}`);
        return Object.freeze({
          reward: requireAuthoredReward(
            reward,
            command,
            'cannot edit acquisition outcome before reward authorship',
          ),
          levelEffectSource: {
            kind: 'producerLifecycle',
            key: binding.producerLifecycleKey,
          } as const,
        });
      }
      return failCommand(
        command,
        `${occurrence.gameName} has no local reward ${owner.groupKey}/${owner.slotKey}`,
      );
    case 'rewardWheelOffer':
      if (state.kind !== 'shipCombat') {
        failCommand(command, `${occurrence.gameName} has no reward wheel ${owner.wheelKey}`);
      }
      {
        const wheel = state.wheels[owner.wheelKey];
        const reward = wheel?.offers[owner.offerKey];
        if (wheel === undefined || reward === undefined) {
          failCommand(command, `missing reward wheel offer ${owner.wheelKey}/${owner.offerKey}`);
        }
        const room = catalog.rooms.byKey[occurrence.gameName];
        if (room === undefined) failCommand(command, `unknown room ${occurrence.gameName}`);
        const descriptor = requireShipCombatWheels(catalog, room, occurrence.gameName).find(
          (candidate) => candidate.key === owner.wheelKey,
        );
        if (descriptor === undefined)
          failCommand(command, `unknown reward wheel ${owner.wheelKey}`);
        return Object.freeze({
          reward: requireAuthoredReward(
            reward,
            command,
            'cannot edit acquisition outcome before reward authorship',
          ),
          levelEffectSource: {
            kind: 'producerLifecycle',
            key: descriptor.reward.producerLifecycleKey,
          } as const,
        });
      }
    case 'shopOffer':
      if (state.kind !== 'shop' || state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized Shop offers`);
      }
      {
        const reward = authoredShopOffer(occurrence, owner.offerKey)?.reward;
        if (reward === undefined) failCommand(command, `missing Shop offer ${owner.offerKey}`);
        return Object.freeze({
          reward: requireAuthoredReward(
            reward,
            command,
            'cannot edit acquisition outcome before reward authorship',
          ),
          levelEffectSource: {
            kind: 'shopProfile',
            key: shopSlotProfile(
              catalog,
              occurrence.gameName,
              state.shop.profileKey,
              owner.offerKey,
            )!.key,
          } as const,
        });
      }
  }
}

export function updateRewardState(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  state: RoomOccurrence['state'],
  owner: TraitOfferOwnerAddress,
  command: RewardCommand,
  update: (reward: AuthoredRewardState) => AuthoredRewardState,
): RoomOccurrence['state'] {
  switch (owner.kind) {
    case 'acquisitionEntry':
      return failCommand(command, 'site pickup entries are updated on their occurrence overlay');
    case 'incomingReward':
      switch (state.kind) {
        case 'counted':
        case 'fixed':
        case 'anomaly':
        case 'ephyraCombat':
        case 'freeReward':
          return Object.freeze({
            ...state,
            reward: update(
              requireAuthoredReward(
                state.reward,
                command,
                'cannot edit acquisition outcome before reward authorship',
              ),
            ),
          });
        case 'none':
        case 'fieldsCombat':
        case 'shipCombat':
        case 'shop':
          failCommand(command, `incoming reward is not owned by ${occurrence.gameName}`);
      }
      break;
    case 'localReward':
      if (state.kind === 'fieldsCombat') {
        const room = catalog.rooms.byKey[occurrence.gameName];
        const cageGroup = room?.localChildren.find((child) => child.key === owner.groupKey);
        const slotKeys =
          cageGroup?.kind === 'boundedRewardSlots'
            ? cageGroup.slotKeys
            : room?.fieldsOptionalRewards?.key === owner.groupKey
              ? room.fieldsOptionalRewards.slotKeys
              : [];
        if (slotKeys.length === 0) {
          failCommand(
            command,
            `${occurrence.gameName} has no Fields reward group ${owner.groupKey}`,
          );
        }
        if (!slotKeys.includes(owner.slotKey)) {
          failCommand(command, `${occurrence.gameName} has no Fields reward slot ${owner.slotKey}`);
        }
        const reward =
          owner.groupKey === 'cages'
            ? state.cages[owner.slotKey]
            : state.optionalRewards[owner.slotKey];
        if (reward === undefined) failCommand(command, `missing Fields reward ${owner.slotKey}`);
        return Object.freeze({
          ...state,
          ...(owner.groupKey === 'cages'
            ? {
                cages: Object.freeze({
                  ...state.cages,
                  [owner.slotKey]: update(
                    requireAuthoredReward(
                      reward,
                      command,
                      'cannot edit acquisition outcome before reward authorship',
                    ),
                  ),
                }),
              }
            : {
                optionalRewards: Object.freeze({
                  ...state.optionalRewards,
                  [owner.slotKey]: update(
                    requireAuthoredReward(
                      reward,
                      command,
                      'cannot edit acquisition outcome before reward authorship',
                    ),
                  ),
                }),
              }),
        });
      }
      return failCommand(
        command,
        `${occurrence.gameName} has no local reward ${owner.groupKey}/${owner.slotKey}`,
      );
    case 'rewardWheelOffer':
      if (state.kind !== 'shipCombat') {
        failCommand(command, `${occurrence.gameName} has no reward wheel ${owner.wheelKey}`);
      }
      {
        const wheel = state.wheels[owner.wheelKey];
        const reward = wheel?.offers[owner.offerKey];
        if (wheel === undefined || reward === undefined) {
          failCommand(command, `missing reward wheel offer ${owner.wheelKey}/${owner.offerKey}`);
        }
        return Object.freeze({
          ...state,
          wheels: Object.freeze({
            ...state.wheels,
            [owner.wheelKey]: Object.freeze({
              ...wheel,
              offers: Object.freeze({
                ...wheel.offers,
                [owner.offerKey]: update(
                  requireAuthoredReward(
                    reward,
                    command,
                    'cannot edit acquisition outcome before reward authorship',
                  ),
                ),
              }),
            }),
          }),
        });
      }
    case 'shopOffer':
      if (state.kind !== 'shop' || state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized Shop offers`);
      }
      {
        const entry = authoredShopOffer(occurrence, owner.offerKey);
        if (entry === undefined) failCommand(command, `missing Shop offer ${owner.offerKey}`);
        return replaceAuthoredShopOffer(
          { ...occurrence, state },
          owner.offerKey,
          Object.freeze({
            ...entry,
            reward: update(
              requireAuthoredReward(
                entry.reward,
                command,
                'cannot edit acquisition outcome before reward authorship',
              ),
            ),
          }),
        ).state;
      }
    case 'encounterPhase':
      return failCommand(command, 'encounter trait offers are updated by the encounter owner path');
  }
  return failCommand(command, `unsupported reward owner ${owner.kind}`);
}
