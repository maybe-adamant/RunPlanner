import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  authoredRoomLifecycleProfileKey,
  biomeStartRoomGameNames,
  resolveBiomeStart,
  resolveEntryDeclaration,
  resolveEntryRoom,
  roomLifecycleOperations,
  type ResolvedRoutePosition,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type {
  EncounterDefinition,
  RoomDeclaration,
  RoomLifecycleOperation,
  RoomLifecycleProfile,
} from '@run-planner/engine/catalog-schema';

const snapshotPath = './compiled-operations.snapshot.json';

function operationText(operation: RoomLifecycleOperation): string {
  const subject =
    operation.kind === 'materializeOfferPoint'
      ? ` ${operation.offerPoint}`
      : operation.kind === 'settleAcquisitionPoint' || operation.kind === 'advanceProducer'
        ? ` ${operation.point}`
        : operation.kind === 'startEncounter' || operation.kind === 'completeEncounter'
          ? ` ${operation.encounter.kind}`
          : '';
  return `${operation.kind}${subject}: ${operation.effects.join(', ')}`;
}

/** The fields an encounter's lifecycle reads: its kind, start, outcome and end. */
function encounterText(definition: EncounterDefinition): string {
  const flags = [
    definition.kind,
    ...(definition.countsEncounterDepth ? ['countsDepth'] : []),
    ...(definition.skipEndEncounterEffects ? ['skipEndEffects'] : []),
    ...(definition.advancesHermesShrineDeliveryUses ? ['advancesDeliveryUses'] : []),
    ...(definition.requiresInteraction === true ? ['requiresInteraction'] : []),
    ...(definition.createsIncomingRewardAtStart === true ? ['rewardAtStart'] : []),
    ...(definition.suppressesIncomingReward === true ? ['suppressesReward'] : []),
    ...(definition.canEncounterSkip ? ['figLeafSkip'] : []),
    ...(definition.blocksFigLeaf ? ['blocksFigLeaf'] : []),
    ...(definition.hostsGorgon ? ['hostsGorgon'] : []),
    ...(definition.blocksGorgon ? ['blocksGorgon'] : []),
    ...(definition.aetosWaves === undefined ? [] : [`aetos ${definition.aetosWaves.join(',')}`]),
    ...(definition.goldBet === undefined ? [] : ['goldBet']),
    ...(definition.nemesisRandomEvent === undefined ? [] : ['nemesisRandomEvent']),
    ...(definition.killBounty === undefined ? [] : ['killBounty']),
    ...(definition.traitOfferProducer === undefined ? [] : ['traitOfferProducer']),
    ...(definition.sequenceEffect === undefined ? [] : [definition.sequenceEffect.kind]),
  ];
  return flags.join(' | ');
}

function roomText(room: RoomDeclaration): string {
  const envelope = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  const bindings = new Map(room.encounterSlotBindings.map((binding) => [binding.slotKey, binding]));
  const slots = (envelope?.slots ?? []).map((slot) => {
    const binding = bindings.get(slot.key);
    const bound =
      binding === undefined
        ? 'unbound'
        : binding.kind === 'set'
          ? `set ${binding.encounterSetKey}`
          : [
              `fixed ${binding.encounterDefinitionKey}`,
              ...(binding.rivalsEncounterDefinitionKey === undefined
                ? []
                : [`rivals ${binding.rivalsEncounterDefinitionKey}`]),
              ...(binding.shadowEncounterDefinitionKey === undefined
                ? []
                : [`shadow ${binding.shadowEncounterDefinitionKey}`]),
            ].join(' ');
    const attachment =
      slot.rewardAttachment === undefined
        ? ''
        : slot.rewardAttachment.kind === 'rewardWheel'
          ? ` wheel ${slot.rewardAttachment.key}`
          : ` local ${slot.rewardAttachment.groupKey}.${slot.rewardAttachment.slotKey}`;
    return `${slot.key}${slot.activation === 'templateControlled' ? '?' : ''}=${bound}${attachment}`;
  });
  return [
    room.mode.kind === 'authored'
      ? `template ${room.mode.templateKey}`
      : `derived ${room.mode.classification}`,
    `profile ${room.lifecycleProfileKey ?? '-'}`,
    `envelope ${room.encounterEnvelopeKey}`,
    ...(room.structuralTags.includes('Outdoor') ? ['Outdoor'] : []),
    ...(room.blocksGorgon ? ['blocksGorgon'] : []),
    ...(room.ignoreEncounterUses ? ['ignoreEncounterUses'] : []),
    `slots ${slots.join(', ') || '-'}`,
  ].join(' | ');
}

/** The occurrence states a room's profile selection reads. */
const selectionVariants = [
  { state: { kind: 'none' } },
  { state: { kind: 'counted', reward: null } },
  { state: { kind: 'shop' } },
].map((occurrence) => occurrence as unknown as RoomOccurrence);

interface Selection {
  readonly profileKey: string;
  readonly declaration: RoomDeclaration;
  readonly label: string;
}

/** Every route's realized room declarations with each profile they can select. */
function selections(): readonly Selection[] {
  const result: Selection[] = [];
  for (const route of catalog.routes.values) {
    const biomeKeys =
      route.dreamItinerary === undefined
        ? route.biomeKeys
        : [
            ...route.dreamItinerary.initialBiomeKeys,
            ...route.dreamItinerary.laterAdditionalBiomeKeys,
          ];
    const firstBiomeKeys = new Set(
      route.dreamItinerary === undefined
        ? route.biomeKeys.slice(0, 1)
        : route.dreamItinerary.initialBiomeKeys,
    );
    const startRooms = new Map(
      biomeKeys.flatMap((biomeKey) => {
        const layout = catalog.biomeLayouts.byKey[biomeKey];
        return layout === undefined
          ? []
          : biomeStartRoomGameNames(resolveBiomeStart(catalog, route.key, layout)).map(
              (gameName) => [gameName, firstBiomeKeys.has(biomeKey)] as const,
            );
      }),
    );
    for (const room of catalog.rooms.values) {
      // A biome's start room is always its entry, resolved below.
      if (startRooms.has(room.gameName)) continue;
      const routed = resolveEntryDeclaration(room, { routeKey: route.key, isFirst: false });
      const keys = new Set(
        selectionVariants.map((occurrence) => authoredRoomLifecycleProfileKey(routed, occurrence)),
      );
      if (routed.mode.kind === 'authored' && routed.mode.templateKey === 'EphyraSideRoom')
        keys.add('EphyraSideRoom');
      if (routed.mode.kind === 'derived' && routed.mode.classification === 'hub')
        keys.add('EphyraHubRoom');
      for (const profileKey of keys)
        result.push({ profileKey, declaration: routed, label: `${route.key} ${room.gameName}` });
    }
    for (const [gameName, first] of startRooms) {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) continue;
      for (const isFirst of first ? [true, false] : [false]) {
        const entry = resolveEntryRoom(
          catalog,
          room,
          { routeKey: route.key, isFirst } as ResolvedRoutePosition,
          true,
        );
        result.push({
          profileKey:
            entry.lifecycleProfileKey ??
            authoredRoomLifecycleProfileKey(entry.declaration, selectionVariants[0]!),
          declaration: entry.declaration,
          label: `${route.key} ${gameName}${isFirst ? ' start' : ''}`,
        });
      }
    }
  }
  return result;
}

/**
 * The operations every room selecting the profile composes, keyed by the
 * profile; a room whose encounters compose differently adds its own entry.
 */
function profileOperations(
  profile: RoomLifecycleProfile,
  all: readonly Selection[],
): readonly (readonly [string, readonly string[]])[] {
  const byList = new Map<string, { operations: readonly string[]; labels: string[] }>();
  for (const selection of all) {
    if (selection.profileKey !== profile.key) continue;
    if (!profile.encounterEnvelopeKeys.includes(selection.declaration.encounterEnvelopeKey))
      continue;
    const operations = roomLifecycleOperations(catalog, profile, selection.declaration).map(
      operationText,
    );
    const key = JSON.stringify(operations);
    const group = byList.get(key) ?? { operations, labels: [] };
    group.labels.push(selection.label);
    byList.set(key, group);
  }
  const groups = [...byList.values()].sort(
    (left, right) => right.labels.length - left.labels.length,
  );
  const [common, ...variants] = groups;
  if (common === undefined) throw new Error(`${profile.key} is selected by no room`);
  return [
    [profile.key, common.operations],
    ...variants.map(
      (variant) =>
        [
          `${profile.key} (${[...new Set(variant.labels)].sort().join(', ')})`,
          variant.operations,
        ] as const,
    ),
  ];
}

/**
 * Every lifecycle profile with its compiled operations; every room with its
 * template, declared profile and slot bindings; and every bound encounter with
 * its lifecycle fields. A room template × encounter binding compiles to its
 * profile's operations with that encounter's fields.
 */
function compiledOperations() {
  const bound = new Set<string>();
  for (const room of catalog.rooms.values)
    for (const binding of room.encounterSlotBindings) {
      if (binding.kind === 'set') {
        for (const key of catalog.encounterSets.byKey[binding.encounterSetKey]
          ?.encounterDefinitionKeys ?? [])
          bound.add(key);
        continue;
      }
      bound.add(binding.encounterDefinitionKey);
      if (binding.rivalsEncounterDefinitionKey !== undefined)
        bound.add(binding.rivalsEncounterDefinitionKey);
      if (binding.shadowEncounterDefinitionKey !== undefined)
        bound.add(binding.shadowEncounterDefinitionKey);
    }
  const all = selections();
  return {
    profiles: Object.fromEntries(
      catalog.roomLifecycleProfiles.values.flatMap((profile) =>
        profileOperations(profile, all).map(([key, operations]) => [
          key,
          {
            envelopes: profile.encounterEnvelopeKeys.join(', '),
            producer:
              profile.producer.kind === 'none'
                ? 'none'
                : `required ${profile.producer.lifecycleProfileKeys.join(', ')}`,
            operations,
          },
        ]),
      ),
    ),
    rooms: Object.fromEntries(
      [...catalog.rooms.values]
        .sort((left, right) => (left.gameName < right.gameName ? -1 : 1))
        .map((room) => [room.gameName, roomText(room)]),
    ),
    encounterSets: Object.fromEntries(
      [...catalog.encounterSets.values]
        .sort((left, right) => (left.key < right.key ? -1 : 1))
        .map((set) => [set.key, set.encounterDefinitionKeys.join(', ')]),
    ),
    encounters: Object.fromEntries(
      [...bound].sort().flatMap((key) => {
        const definition = catalog.encounterDefinitions.byKey[key];
        return definition === undefined ? [] : [[key, encounterText(definition)]];
      }),
    ),
  };
}

describe('compiled room lifecycle operations', () => {
  it('match the checked-in snapshot for every room template and encounter binding', async () => {
    const options = await resolveConfig(snapshotPath);
    const text = await format(JSON.stringify(compiledOperations()), {
      ...options,
      parser: 'json',
    });
    await expect(text).toMatchFileSnapshot(snapshotPath);
  });
});
