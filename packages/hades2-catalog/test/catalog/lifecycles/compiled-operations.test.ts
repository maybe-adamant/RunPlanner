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

/**
 * Fixture: the occurrence states `authoredRoomLifecycleProfileKey` distinguishes
 * (Clockwork goal, Preboss shop); every room is selected under each.
 */
const occurrenceStateFixtures = [
  { state: { kind: 'none' } },
  { state: { kind: 'counted', reward: null } },
  { state: { kind: 'shop' } },
].map((occurrence) => occurrence as unknown as RoomOccurrence);

/**
 * Fixture: profiles the Ephyra hub materialization assigns outside the
 * template selection (simulation/materialization/hub.ts): the Hub room, and a
 * side room on a local visit.
 */
function hubMaterializationProfileKeys(room: RoomDeclaration): readonly string[] {
  if (room.mode.kind === 'derived' && room.mode.classification === 'hub') return ['EphyraHubRoom'];
  if (room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraSideRoom')
    return [authoredRoomLifecycleProfileKey(room, occurrenceStateFixtures[0]!, 'ephyraSide')];
  return [];
}

/**
 * Fixture: route positions. A route's first biome (Dream: each initial biome)
 * holds the route start; every biome start room is also a later entry.
 */
function routeStartBiomeKeys(route: (typeof catalog.routes.values)[number]): ReadonlySet<string> {
  return new Set(
    route.dreamItinerary === undefined
      ? route.biomeKeys.slice(0, 1)
      : route.dreamItinerary.initialBiomeKeys,
  );
}

interface Selection {
  readonly profileKey: string;
  readonly declaration: RoomDeclaration;
  readonly label: string;
}

function requireRoom(gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) throw new Error(`unknown room ${gameName}`);
  return room;
}

/**
 * Every route's realized room declarations with each profile production
 * selects for them: a biome start room through `resolveEntryRoom`, every other
 * room through `authoredRoomLifecycleProfileKey` and the hub fixture.
 */
function selections(): readonly Selection[] {
  const result: Selection[] = [];
  for (const route of catalog.routes.values) {
    const startBiomes = routeStartBiomeKeys(route);
    const startRooms = new Map<string, boolean>();
    for (const layout of catalog.biomeLayouts.values)
      for (const gameName of biomeStartRoomGameNames(resolveBiomeStart(catalog, route.key, layout)))
        startRooms.set(
          gameName,
          startRooms.get(gameName) === true || startBiomes.has(layout.biomeKey),
        );
    for (const [gameName, routeStart] of startRooms)
      for (const isFirst of routeStart ? [true, false] : [false]) {
        const entry = resolveEntryRoom(
          catalog,
          requireRoom(gameName),
          { routeKey: route.key, isFirst } as ResolvedRoutePosition,
          true,
        );
        result.push({
          profileKey:
            entry.lifecycleProfileKey ??
            authoredRoomLifecycleProfileKey(entry.declaration, occurrenceStateFixtures[0]!),
          declaration: entry.declaration,
          label: `${route.key} ${gameName}${isFirst ? ' start' : ''}`,
        });
      }
    for (const room of catalog.rooms.values.filter((room) => !startRooms.has(room.gameName))) {
      const routed = resolveEntryDeclaration(room, { routeKey: route.key, isFirst: false });
      const keys = new Set([
        ...occurrenceStateFixtures.map((occurrence) =>
          authoredRoomLifecycleProfileKey(routed, occurrence),
        ),
        ...hubMaterializationProfileKeys(routed),
      ]);
      for (const profileKey of keys)
        result.push({ profileKey, declaration: routed, label: `${route.key} ${room.gameName}` });
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
      throw new Error(`${selection.label} selects ${profile.key} for its envelope`);
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

  // Chronology cuts read a room's operation positions from its declared room
  // (progressive/selected-cut.ts); every routed variant must keep them.
  it("keep every room-level step at one position across a profile's routed variants", () => {
    const all = selections();
    for (const profile of catalog.roomLifecycleProfiles.values) {
      const positions = all
        .filter((selection) => selection.profileKey === profile.key)
        .map((selection) => {
          const operations = roomLifecycleOperations(catalog, profile, selection.declaration);
          return {
            label: selection.label,
            count: operations.length,
            outgoing: operations.findIndex(
              (operation) => operation.kind === 'generateOutgoingBatch',
            ),
            overviewEnd: operations.findIndex(
              (operation) =>
                operation.kind !== 'prepareRoom' &&
                operation.kind !== 'materializeOfferPoint' &&
                operation.kind !== 'enterRoom',
            ),
            steps: operations.flatMap((operation, index) =>
              operation.kind === 'advanceProducer' ||
              operation.kind === 'startEncounter' ||
              operation.kind === 'completeEncounter' ||
              operation.kind === 'runEncounterSequence' ||
              operation.kind === 'runRewardEncounterSequence'
                ? []
                : [`${index} ${operation.kind}`],
            ),
          };
        });
      const [first, ...rest] = positions;
      if (first === undefined) throw new Error(`${profile.key} is selected by no room`);
      for (const variant of rest)
        expect(
          { ...variant, label: first.label },
          `${variant.label} places the ${profile.key} steps`,
        ).toEqual(first);
    }
  });
});
