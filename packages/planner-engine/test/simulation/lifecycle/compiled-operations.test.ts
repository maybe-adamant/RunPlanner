import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import {
  roomLifecycleProfileKey,
  biomeStartRoomGameNames,
  resolveBiomeStart,
  resolveEntryDeclaration,
  resolveEntryRoom,
  type ResolvedRoutePosition,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type {
  EncounterDefinition,
  RoomDeclaration,
  RoomLifecycleProfile,
} from '@run-planner/engine/catalog-schema';

const snapshotPath = './compiled-operations.snapshot.json';

/** Each room's own lifecycle specialization, as its declaration names it. */
const specializations = new Map(
  declarations.rooms.flatMap((room) =>
    room.lifecycleProfileKey === undefined ? [] : [[room.gameName, room.lifecycleProfileKey]],
  ),
);

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
    `profile ${specializations.get(room.gameName) ?? '-'}`,
    `envelope ${room.encounterEnvelopeKey}`,
    ...(room.structuralTags.includes('Outdoor') ? ['Outdoor'] : []),
    ...(room.blocksGorgon ? ['blocksGorgon'] : []),
    ...(room.ignoreEncounterUses ? ['ignoreEncounterUses'] : []),
    `slots ${slots.join(', ') || '-'}`,
  ].join(' | ');
}

/**
 * Fixture: the occurrence states `roomLifecycleProfileKey` distinguishes
 * (Preboss shop or free reward); every room is selected under each.
 */
const occurrenceStateFixtures = [{ state: { kind: 'none' } }, { state: { kind: 'shop' } }].map(
  (occurrence) => occurrence as unknown as RoomOccurrence,
);

/** Fixture: whether a room's reward runs a producer; a Clockwork Goal door's room runs none. */
function producerFixtures(room: RoomDeclaration): readonly boolean[] {
  if (room.incomingReward.kind === 'none') return [false];
  return room.mode.kind === 'authored' && room.mode.templateKey === 'ClockworkCombat'
    ? [true, false]
    : [true];
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
  readonly producer: boolean;
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
 * selects for them through `roomLifecycleProfileKey`, in every Hub role they
 * declare, and whether their reward runs a producer: a biome start room's
 * from `resolveEntryRoom`.
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
          profileKey: roomLifecycleProfileKey(entry.declaration, 'ordinary'),
          producer: entry.incomingRewardBinding.kind !== 'none',
          declaration: entry.declaration,
          label: `${route.key} ${gameName}${isFirst ? ' start' : ''}`,
        });
      }
    for (const room of catalog.rooms.values.filter((room) => !startRooms.has(room.gameName))) {
      const routed = resolveEntryDeclaration(room, { routeKey: route.key, isFirst: false });
      const keys = new Set([
        ...occurrenceStateFixtures.map((occurrence) =>
          roomLifecycleProfileKey(routed, 'ordinary', occurrence),
        ),
        ...Object.values(routed.roleLifecycleProfileKeys ?? {}),
      ]);
      for (const profileKey of keys)
        for (const producer of producerFixtures(routed))
          result.push({
            profileKey,
            producer,
            declaration: routed,
            label: `${route.key} ${room.gameName}${producer ? '' : ' no producer'}`,
          });
    }
  }
  return result;
}

/** A profile's walk facts; every room selecting it must admit its envelope. */
function profileFacts(profile: RoomLifecycleProfile, all: readonly Selection[]) {
  for (const selection of all)
    if (
      selection.profileKey === profile.key &&
      !profile.encounterEnvelopeKeys.includes(selection.declaration.encounterEnvelopeKey)
    )
      throw new Error(`${selection.label} selects ${profile.key} for its envelope`);
  return [
    ...(profile.offerPoint === undefined
      ? []
      : [`offerPoint ${profile.offerPoint.key} ${profile.offerPoint.at}`]),
    ...(profile.requiredObjects ? ['requiredObjects'] : []),
    ...(profile.generatesOutgoing ? ['generatesOutgoing'] : []),
    ...(profile.exitAcquisitionPoint === undefined
      ? []
      : [`exitAcquisitionPoint ${profile.exitAcquisitionPoint}`]),
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
      catalog.roomLifecycleProfiles.values.map((profile) => [
        profile.key,
        {
          envelopes: profile.encounterEnvelopeKeys.join(', '),
          producer:
            profile.producer.kind === 'none'
              ? 'none'
              : `required ${profile.producer.lifecycleProfileKeys.join(', ')}: ${profile.producer.points.join(', ')}`,
          walk: profileFacts(profile, all),
        },
      ]),
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
