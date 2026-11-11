import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type {
  EncounterDefinition,
  RoomDeclaration,
  RoomLifecycleOperation,
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
  return {
    profiles: Object.fromEntries(
      catalog.roomLifecycleProfiles.values.map((profile) => [
        profile.key,
        {
          envelopes: profile.encounterEnvelopeKeys.join(', '),
          producer:
            profile.producer.kind === 'none'
              ? 'none'
              : `required ${profile.producer.lifecycleProfileKeys.join(', ')}`,
          operations: profile.operations.map(operationText),
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
