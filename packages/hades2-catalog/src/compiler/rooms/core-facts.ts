import type {
  RoomCaps,
  RoomDeclaration,
  RoomForce,
  RoomMode,
  RoomStructuralTag,
  RoomTemplateKey,
} from '@run-planner/engine/catalog-schema';
import type { RewardProducerBinding, RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawRoomDeclaration } from '../../declarations/index';
import {
  freezeUniqueStrings,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from '../common';
import { fail } from '../errors';
import {
  normalizeRequirement,
  rejectEncounterHistoryRequirements,
  validateRequirementReferences,
} from '../requirements';

export type RoomIdentityFacts = Pick<
  RoomDeclaration,
  | 'gameName'
  | 'label'
  | 'roomSetKey'
  | 'kind'
  | 'mode'
  | 'blockGiftBoons'
  | 'blocksGorgon'
  | 'advancesExperimentalHammerUses'
  | 'ignoreEncounterUses'
  | 'advancesHermesShrineDeliveryUses'
  | 'skipRoomsPerUpgrade'
  | 'skipTimedDropResources'
>;

export type RoomCoreFacts = Pick<RoomDeclaration, 'lifecycleProfileKey' | 'structuralTags'>;

export type RoomCounterFacts = Pick<RoomDeclaration, 'counters' | 'caps'>;

const structuralTags = new Set<RoomStructuralTag>(['Indoor', 'Outdoor']);

const roomTemplateKinds = {
  Anomaly: 'Combat',
  Boss: 'Boss',
  Chaos: 'Combat',
  ContractBoss: 'Boss',
  Devotion: 'Devotion',
  EphyraCombat: 'Combat',
  EphyraSideRoom: 'Combat',
  ClockworkCombat: 'Combat',
  FixedIntro: 'Intro',
  FixedOpening: 'Opening',
  FixedPreHub: 'PreHub',
  FieldsCombat: 'Combat',
  Fountain: 'Reprieve',
  Miniboss: 'Miniboss',
  RewardlessCombat: 'Combat',
  Shop: 'Shop',
  Preboss: 'Preboss',
  PostBoss: 'PostBoss',
  ShipCombat: 'Combat',
  StandardCombat: 'Combat',
  Story: 'Story',
} as const satisfies Readonly<Record<RoomTemplateKey, RoomDeclaration['kind']>>;

const roomTemplateRewardKinds = {
  Anomaly: 'countedChoice',
  Boss: 'none',
  Chaos: 'fixed',
  ContractBoss: 'fixed',
  Devotion: 'fixed',
  EphyraCombat: 'countedChoice',
  EphyraSideRoom: 'countedChoice',
  ClockworkCombat: 'countedChoice',
  FixedIntro: 'none',
  FixedOpening: 'countedChoice',
  FixedPreHub: 'countedChoice',
  FieldsCombat: 'none',
  Fountain: 'countedChoice',
  Miniboss: 'countedChoice',
  RewardlessCombat: 'none',
  Shop: 'shop',
  Preboss: 'shop',
  PostBoss: 'none',
  ShipCombat: 'none',
  StandardCombat: 'countedChoice',
  Story: 'fixed',
} as const satisfies Readonly<Record<RoomTemplateKey, RewardProducerBinding['kind']>>;

const supportedRoomSetKeys = new Set([
  'F',
  'G',
  'H',
  'I',
  'N',
  'O',
  'P',
  'Q',
  'Anomaly',
  'C',
  'Chaos',
]);

function validateMode(room: RawRoomDeclaration, path: string): RoomMode {
  const receivedModeKind: unknown = (room.mode as { readonly kind?: unknown } | undefined)?.kind;
  if (room.mode?.kind === 'derived') {
    const classification = room.mode.classification;
    if (classification !== 'hub') {
      fail(
        `${path}.mode.classification`,
        `unknown derived classification ${String(classification)}`,
      );
    }
    if (room.prebossBatchPolicy !== undefined) {
      fail(`${path}.prebossBatchPolicy`, 'is only valid for authored Preboss rooms');
    }
    return Object.freeze({ kind: 'derived', classification });
  }
  if (room.mode?.kind !== 'authored') {
    fail(`${path}.mode.kind`, `unknown room mode ${String(receivedModeKind)}`);
  }
  const templateKey = room.mode.templateKey;
  if (!Object.hasOwn(roomTemplateKinds, templateKey)) {
    fail(`${path}.mode.templateKey`, `unknown room template ${String(templateKey)}`);
  }
  const expectedKind = roomTemplateKinds[templateKey];
  if (room.kind !== expectedKind)
    fail(`${path}.kind`, `${templateKey} requires room kind ${expectedKind}`);
  const expectedRewardKind = roomTemplateRewardKinds[templateKey];
  if (room.incomingReward.kind !== expectedRewardKind) {
    fail(
      `${path}.incomingReward.kind`,
      `${templateKey} requires reward producer ${expectedRewardKind}`,
    );
  }
  if (templateKey === 'Preboss' && room.prebossBatchPolicy === undefined) {
    fail(`${path}.prebossBatchPolicy`, 'is required by Preboss');
  }
  if (templateKey !== 'Preboss' && room.prebossBatchPolicy !== undefined) {
    fail(`${path}.prebossBatchPolicy`, 'is only valid for Preboss');
  }
  return Object.freeze({ kind: 'authored', templateKey });
}

/** Normalizes the room-local identity and mode facts before related products validate. */
export function normalizeRoomIdentity(room: RawRoomDeclaration, path: string): RoomIdentityFacts {
  const gameName = requireNonEmpty(room.gameName, `${path}.gameName`);
  const label = requireNonEmpty(room.label, `${path}.label`);
  const roomSetKey = requireNonEmpty(room.roomSetKey, `${path}.roomSetKey`);
  if (!supportedRoomSetKeys.has(roomSetKey))
    fail(`${path}.roomSetKey`, `unknown room set ${roomSetKey}`);
  if (room.structuralTags === undefined) fail(`${path}.structuralTags`, 'is required');
  if (room.blockGiftBoons !== undefined && typeof room.blockGiftBoons !== 'boolean') {
    fail(`${path}.blockGiftBoons`, 'must be a boolean when declared');
  }
  if (room.blocksGorgon !== undefined && typeof room.blocksGorgon !== 'boolean') {
    fail(`${path}.blocksGorgon`, 'must be a boolean when declared');
  }
  if (typeof room.advancesExperimentalHammerUses !== 'boolean') {
    fail(`${path}.advancesExperimentalHammerUses`, 'must be a boolean');
  }
  if (room.ignoreEncounterUses !== undefined && typeof room.ignoreEncounterUses !== 'boolean') {
    fail(`${path}.ignoreEncounterUses`, 'must be a boolean when declared');
  }
  if (
    room.advancesHermesShrineDeliveryUses !== undefined &&
    typeof room.advancesHermesShrineDeliveryUses !== 'boolean'
  ) {
    fail(`${path}.advancesHermesShrineDeliveryUses`, 'must be a boolean when declared');
  }
  if (room.skipRoomsPerUpgrade !== undefined && typeof room.skipRoomsPerUpgrade !== 'boolean') {
    fail(`${path}.skipRoomsPerUpgrade`, 'must be a boolean when declared');
  }
  if (
    room.skipTimedDropResources !== undefined &&
    typeof room.skipTimedDropResources !== 'boolean'
  ) {
    fail(`${path}.skipTimedDropResources`, 'must be a boolean when declared');
  }
  return Object.freeze({
    gameName,
    label,
    roomSetKey,
    kind: room.kind,
    mode: validateMode(room, path),
    blockGiftBoons: room.blockGiftBoons ?? false,
    blocksGorgon: room.blocksGorgon ?? false,
    advancesExperimentalHammerUses: room.advancesExperimentalHammerUses,
    ignoreEncounterUses: room.ignoreEncounterUses ?? false,
    advancesHermesShrineDeliveryUses: room.advancesHermesShrineDeliveryUses ?? true,
    skipRoomsPerUpgrade: room.skipRoomsPerUpgrade ?? false,
    skipTimedDropResources: room.skipTimedDropResources ?? false,
  });
}

/** Normalizes eligibility at its original room-validation boundary. */
export function normalizeRoomEligibility(
  room: RawRoomDeclaration,
  rewards: RewardKernelCatalog,
  path: string,
): Pick<RoomDeclaration, 'eligibility'> {
  const eligibility =
    room.eligibility === undefined
      ? undefined
      : normalizeRequirement(room.eligibility, `${path}.eligibility`);
  if (eligibility !== undefined) {
    validateRequirementReferences(eligibility, rewards.rewardTypes, `${path}.eligibility`);
    rejectEncounterHistoryRequirements(eligibility, `${path}.eligibility`);
  }
  return Object.freeze(eligibility === undefined ? {} : { eligibility });
}

function normalizeRoomCaps(caps: RoomCaps, path: string): RoomCaps {
  return Object.freeze({
    ...(caps.maxAppearancesThisBiome === undefined
      ? {}
      : {
          maxAppearancesThisBiome: requirePositiveInteger(
            caps.maxAppearancesThisBiome,
            `${path}.maxAppearancesThisBiome`,
          ),
        }),
    ...(caps.maxCreationsThisRun === undefined
      ? {}
      : {
          maxCreationsThisRun: requirePositiveInteger(
            caps.maxCreationsThisRun,
            `${path}.maxCreationsThisRun`,
          ),
        }),
    ...(caps.maxCreationsPerRoom === undefined
      ? {}
      : {
          maxCreationsPerRoom: requirePositiveInteger(
            caps.maxCreationsPerRoom,
            `${path}.maxCreationsPerRoom`,
          ),
        }),
  });
}

function normalizeRoomStructuralTags(
  rawTags: readonly RoomStructuralTag[],
  path: string,
): readonly RoomStructuralTag[] {
  const tags = freezeUniqueStrings(rawTags, path);
  for (const [index, tag] of tags.entries()) {
    if (!structuralTags.has(tag as RoomStructuralTag))
      fail(`${path}[${index}]`, `unknown structural tag ${tag}`);
  }
  return tags as readonly RoomStructuralTag[];
}

/** Normalizes force at the final room assembly boundary. */
export function normalizeRoomForce(
  force: RoomForce,
  rewards: RewardKernelCatalog,
  path: string,
): RoomForce {
  if (force.kind === 'always') return Object.freeze({ kind: 'always' });
  if (force.kind === 'requirement') {
    const requirement = normalizeRequirement(force.requirement, `${path}.requirement`);
    validateRequirementReferences(requirement, rewards.rewardTypes, `${path}.requirement`);
    rejectEncounterHistoryRequirements(requirement, `${path}.requirement`);
    return Object.freeze({ kind: 'requirement', requirement });
  }
  if (force.kind !== 'depthWindow') {
    fail(`${path}.kind`, `unknown room force ${String((force as { kind?: unknown }).kind)}`);
  }
  const start = requireNonNegativeInteger(force.start, `${path}.start`);
  const deadline = requireNonNegativeInteger(force.deadline, `${path}.deadline`);
  if (deadline < start) fail(`${path}.deadline`, 'must be greater than or equal to start');
  return Object.freeze({ kind: force.kind, axis: force.axis, start, deadline });
}

/** Completes the room header facts after feature validation has retained its original order. */
export function normalizeRoomCoreFacts(room: RawRoomDeclaration, path: string): RoomCoreFacts {
  return Object.freeze({
    ...(room.lifecycleProfileKey === undefined
      ? {}
      : {
          lifecycleProfileKey: requireNonEmpty(
            room.lifecycleProfileKey,
            `${path}.lifecycleProfileKey`,
          ),
        }),
    structuralTags: normalizeRoomStructuralTags(room.structuralTags, `${path}.structuralTags`),
  });
}

/** Completes room counters and caps at their original final assembly boundary. */
export function normalizeRoomCounters(room: RawRoomDeclaration, path: string): RoomCounterFacts {
  return Object.freeze({
    counters: Object.freeze({
      biomeDepthCache: requireNonNegativeInteger(
        room.counters.biomeDepthCache,
        `${path}.counters.biomeDepthCache`,
      ),
      roomHistoryOrdinal: requirePositiveInteger(
        room.counters.roomHistoryOrdinal,
        `${path}.counters.roomHistoryOrdinal`,
      ),
    }),
    caps: normalizeRoomCaps(room.caps, `${path}.caps`),
  });
}
