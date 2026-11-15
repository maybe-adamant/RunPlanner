import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterSet,
  EncounterSlotBinding,
  RoomDeclaration,
  RoomLifecycleProfile,
  RoomLifecycleProducerPolicy,
  TraitDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog, RewardProducerBinding } from '@run-planner/engine/reward-kernel';
import type {
  ProducerLifecyclePointKey,
  ProducerLifecycleProfileDeclaration,
} from '@run-planner/engine/reward-kernel';

import type { RawRoomLifecycleProfileDeclaration } from '../declarations';
import { createCollection, freezeUniqueStrings, requireNonEmpty } from './common';
import { fail } from './errors';

const producerLifecyclePoints = {
  afterCombat: true,
  afterUnwrap: true,
  beforeCombat: true,
  echoReplay: true,
  purchase: true,
  roomRewardPickup: true,
  roomExit: true,
} as const satisfies Readonly<Record<ProducerLifecyclePointKey, true>>;

function normalizeProducerPolicy(
  raw: RoomLifecycleProducerPolicy,
  producerLifecycles: CatalogCollection<ProducerLifecycleProfileDeclaration>,
  path: string,
): RoomLifecycleProducerPolicy {
  const receivedKind: unknown = (raw as { readonly kind?: unknown }).kind;
  if (raw.kind === 'none') {
    return Object.freeze({ kind: 'none' });
  }
  if (raw.kind !== 'required') {
    fail(`${path}.kind`, `unknown producer policy ${String(receivedKind)}`);
  }
  const lifecycleProfileKeys = freezeUniqueStrings(
    raw.lifecycleProfileKeys,
    `${path}.lifecycleProfileKeys`,
  );
  if (lifecycleProfileKeys.length === 0) {
    fail(`${path}.lifecycleProfileKeys`, 'must not be empty');
  }
  for (const [index, key] of lifecycleProfileKeys.entries()) {
    if (producerLifecycles.byKey[key] === undefined) {
      fail(`${path}.lifecycleProfileKeys[${index}]`, `unknown producer lifecycle ${key}`);
    }
  }
  const points = freezeUniqueStrings(
    raw.points,
    `${path}.points`,
  ) as readonly ProducerLifecyclePointKey[];
  for (const [index, point] of points.entries()) {
    if (!Object.hasOwn(producerLifecyclePoints, point)) {
      fail(`${path}.points[${index}]`, `unknown producer lifecycle point ${String(point)}`);
    }
  }
  return Object.freeze({ kind: 'required', lifecycleProfileKeys, points });
}

export function normalizeRoomLifecycleProfiles(
  rawProfiles: readonly RawRoomLifecycleProfileDeclaration[],
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  producerLifecycles: CatalogCollection<ProducerLifecycleProfileDeclaration>,
): CatalogCollection<RoomLifecycleProfile> {
  return createCollection(
    rawProfiles.map((raw, profileIndex): RoomLifecycleProfile => {
      const path = `roomLifecycleProfiles[${profileIndex}]`;
      const key = requireNonEmpty(raw.key, `${path}.key`);
      const encounterEnvelopeKeys = freezeUniqueStrings(
        raw.encounterEnvelopeKeys,
        `${path}.encounterEnvelopeKeys`,
      );
      if (encounterEnvelopeKeys.length === 0) {
        fail(`${path}.encounterEnvelopeKeys`, 'must not be empty');
      }
      for (const [index, encounterKey] of encounterEnvelopeKeys.entries()) {
        if (encounterEnvelopes.byKey[encounterKey] === undefined) {
          fail(
            `${path}.encounterEnvelopeKeys[${index}]`,
            `unknown encounter envelope ${encounterKey}`,
          );
        }
      }
      const producer = normalizeProducerPolicy(
        raw.producer,
        producerLifecycles,
        `${path}.producer`,
      );
      return Object.freeze({
        key,
        encounterEnvelopeKeys,
        producer,
        ...(raw.offerPoint === undefined
          ? {}
          : {
              offerPoint: Object.freeze({
                key: requireNonEmpty(raw.offerPoint.key, `${path}.offerPoint.key`),
                at: raw.offerPoint.at,
              }),
            }),
        requiredObjects: raw.requiredObjects,
        generatesOutgoing: raw.generatesOutgoing,
        ...(raw.exitAcquisitionPoint === undefined
          ? {}
          : {
              exitAcquisitionPoint: requireNonEmpty(
                raw.exitAcquisitionPoint,
                `${path}.exitAcquisitionPoint`,
              ),
            }),
      });
    }),
    'roomLifecycleProfiles',
    (profile) => profile.key,
  );
}

interface SlotGateInput {
  readonly encounterEnvelopes: CatalogCollection<EncounterEnvelope>;
  readonly encounterSets: CatalogCollection<EncounterSet>;
  readonly encounterDefinitions: CatalogCollection<EncounterDefinition>;
  readonly rewards: RewardKernelCatalog;
  readonly runStartReward: { readonly incomingReward: RewardProducerBinding };
}

/** Every encounter a binding can run, its rivals and shadow included. */
function boundEncounterKeys(
  input: SlotGateInput,
  binding: EncounterSlotBinding,
): readonly string[] {
  return binding.kind === 'set'
    ? (input.encounterSets.byKey[binding.encounterSetKey]?.encounterDefinitionKeys ?? [])
    : [
        binding.encounterDefinitionKey,
        ...(binding.rivalsEncounterDefinitionKey === undefined
          ? []
          : [binding.rivalsEncounterDefinitionKey]),
        ...(binding.shadowEncounterDefinitionKey === undefined
          ? []
          : [binding.shadowEncounterDefinitionKey]),
      ];
}

/** The acquisition roles of the reward a room's encounter can wait on; a route start's is the run-start reward. */
function producerRoles(input: SlotGateInput, reward: RewardProducerBinding): ReadonlySet<string> {
  const binding = reward.kind === 'none' ? input.runStartReward.incomingReward : reward;
  if (binding.kind === 'none') return new Set();
  return new Set(
    (
      input.rewards.producerLifecycles.byKey[binding.producerLifecycleKey]?.rewardTypes.values ?? []
    ).flatMap((rewardType) => rewardType.acquisitionLifecycle.map((role) => role.role)),
  );
}

/**
 * A wheel slot's encounters start by wheel use and a cage slot's by cage use;
 * no other slot does, and a pickup gate names a role of the room's reward.
 * A wheel slot's encounters wait for every required object before their end,
 * and only a wheel-phase room's encounters do (its intro included).
 * Route overlays and entry rules bind slots too.
 */
function validateSlotGates(input: SlotGateInput, room: RoomDeclaration): void {
  const envelope = input.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  const variants: readonly {
    readonly path: string;
    readonly reward: RewardProducerBinding;
    readonly bindings: readonly EncounterSlotBinding[];
  }[] = [
    {
      path: `rooms.${room.gameName}.encounterSlotBindings`,
      reward: room.incomingReward,
      bindings: room.encounterSlotBindings,
    },
    ...(room.routeOverlays ?? []).map((overlay, index) => ({
      path: `rooms.${room.gameName}.routeOverlays[${index}].encounterSlotBindings`,
      reward: overlay.incomingReward,
      bindings: overlay.encounterSlotBindings,
    })),
    ...(room.entryContextualEncounterRules ?? []).map((rule, index) => ({
      path: `rooms.${room.gameName}.entryContextualEncounterRules[${index}]`,
      reward: room.incomingReward,
      bindings: [
        {
          slotKey: 'Encounter',
          kind: 'fixed' as const,
          encounterDefinitionKey: rule.encounterDefinitionKey,
        },
      ],
    })),
  ];
  for (const variant of variants)
    for (const binding of variant.bindings) {
      const path = `${variant.path}.${binding.slotKey}`;
      const slot = envelope?.slots.find((candidate) => candidate.key === binding.slotKey);
      if (slot === undefined) fail(path, `unknown slot ${binding.slotKey}`);
      const expected =
        slot.rewardAttachment?.kind === 'rewardWheel'
          ? 'wheelUse'
          : slot.rewardAttachment?.kind === 'localReward'
            ? 'cageActivation'
            : undefined;
      for (const key of boundEncounterKeys(input, binding)) {
        const script = input.encounterDefinitions.byKey[key]?.script;
        if (script === undefined) continue;
        if (slot.rewardAttachment?.kind === 'rewardWheel' && !script.waitReadyBeforeEnd)
          fail(path, `${key} must wait for the next encounter before its wheel's end`);
        if (script.waitReadyBeforeEnd && envelope?.kind !== 'wheelPhases')
          fail(path, `${key} waits for the next encounter outside a wheel-phase room`);
        const gate = script.gate;
        if (
          expected === undefined
            ? gate.kind === 'wheelUse' || gate.kind === 'cageActivation'
            : gate.kind !== expected
        )
          fail(path, `${key} gate ${gate.kind} does not fit the slot`);
        if (gate.kind === 'useItemRole' && !producerRoles(input, variant.reward).has(gate.role))
          fail(path, `${key} gate role ${gate.role} is not a role of the room's reward`);
      }
    }
}

export function validateLifecycleBindings(input: {
  readonly rooms: CatalogCollection<RoomDeclaration>;
  readonly encounterEnvelopes: CatalogCollection<EncounterEnvelope>;
  readonly encounterSets: CatalogCollection<EncounterSet>;
  readonly encounterDefinitions: CatalogCollection<EncounterDefinition>;
  readonly runStartReward: { readonly incomingReward: RewardProducerBinding };
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly rewards: RewardKernelCatalog;
}): void {
  for (const room of input.rooms.values) validateSlotGates(input, room);
  for (const trait of input.traits.values) {
    const disposition = trait.selectedDisposition;
    if (disposition.kind === 'echo' && disposition.effect === 'doubleShop') {
      for (const rewardType of disposition.excludedRewardTypes)
        if (input.rewards.rewardTypes.byKey[rewardType] === undefined)
          fail(
            `traits.${trait.key}.selectedDisposition.excludedRewardTypes`,
            `unknown reward type ${rewardType}`,
          );
      continue;
    }
    if (disposition.kind !== 'producePickups') continue;
    const lifecycle = input.rewards.producerLifecycles.byKey[disposition.producerLifecycleKey];
    if (lifecycle === undefined)
      fail(
        `traits.${trait.key}.selectedDisposition.producerLifecycleKey`,
        'unknown producer lifecycle',
      );
    for (const pickup of disposition.pickups) {
      if (input.rewards.rewardTypes.byKey[pickup.rewardType] === undefined)
        fail(
          `traits.${trait.key}.selectedDisposition.pickups.${pickup.key}`,
          'unknown reward type',
        );
      if (lifecycle.rewardTypes.byKey[pickup.rewardType] === undefined)
        fail(
          `traits.${trait.key}.selectedDisposition.pickups.${pickup.key}`,
          'is not supported by producer lifecycle',
        );
    }
  }
}
