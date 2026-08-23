import type { Catalog, EncounterSlotBinding, RoomDeclaration } from '../../catalog-schema';
import type { EncounterPhaseAddress } from '../addresses';
import type { ProjectDocument, RoomEncounterState } from '../model';
import { encounterBindingsBySlot, encounterSetForBinding } from '../room-state/encounters';
import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { EncounterOccurrenceCommand } from './types';

function selectableBinding(
  catalog: Catalog,
  room: RoomDeclaration,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): Extract<EncounterSlotBinding, { readonly kind: 'set' }> {
  const binding = encounterBindingsBySlot(catalog, room, room.gameName).get(phase.phaseKey);
  if (binding === undefined) {
    failCommand(command, `${room.gameName} has no encounter phase ${phase.phaseKey}`);
  }
  if (binding.kind !== 'set') {
    failCommand(command, `${room.gameName}.${phase.phaseKey} is a fixed encounter phase`);
  }
  return binding;
}

function gorgonSlotOwnedByDeclaration(
  catalog: Catalog,
  binding: EncounterSlotBinding,
  path: string,
): boolean {
  if (binding.kind === 'fixed') {
    return catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]?.hostsGorgon === true;
  }
  return encounterSetForBinding(catalog, binding, path).encounterDefinitionKeys.some(
    (key) => catalog.encounterDefinitions.byKey[key]?.hostsGorgon === true,
  );
}

function updatedSelections(
  catalog: Catalog,
  room: RoomDeclaration,
  current: RoomEncounterState,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): RoomEncounterState {
  if (
    command.kind === 'ReplaceFigLeafSkip' ||
    command.kind === 'ReplaceGorgonDeathDefianceCondition'
  )
    return current;
  const binding = selectableBinding(catalog, room, phase, command);
  const set = encounterSetForBinding(catalog, binding, room.gameName);
  const encounterKey =
    command.kind === 'ResetEncounter' ? set.defaultEncounterDefinitionKey : command.encounterKey;
  if (!set.encounterDefinitionKeys.includes(encounterKey)) {
    failCommand(command, `${encounterKey} is not available from ${set.key}`);
  }
  const selectionUnchanged = current.encounterKeyByPhase[phase.phaseKey] === encounterKey;
  const priorOffers = current.traitOffersByPhase ?? {};
  const phaseOffers = { ...(priorOffers[phase.phaseKey] ?? {}) };
  const producer = catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer;
  if (selectionUnchanged && command.kind !== 'ResetEncounter') return current;
  if (selectionUnchanged && producer === undefined) return current;
  if (
    producer !== undefined &&
    (command.kind === 'ResetEncounter' || phaseOffers[encounterKey] === undefined)
  ) {
    phaseOffers[encounterKey] = null;
  }
  const traitOffersByPhase =
    Object.keys(phaseOffers).length === 0
      ? Object.keys(priorOffers).length === 0
        ? undefined
        : priorOffers
      : Object.freeze({ ...priorOffers, [phase.phaseKey]: Object.freeze(phaseOffers) });
  const gorgonResultByPhase = { ...(current.gorgonResultByPhase ?? {}) };
  if (gorgonSlotOwnedByDeclaration(catalog, binding, room.gameName)) {
    gorgonResultByPhase[phase.phaseKey] ??= { deathDefianceConditionMet: false };
  }
  return Object.freeze({
    encounterKeyByPhase: Object.freeze({
      ...current.encounterKeyByPhase,
      [phase.phaseKey]: encounterKey,
    }),
    figLeafSkipByPhase: current.figLeafSkipByPhase,
    gorgonResultByPhase: Object.freeze(gorgonResultByPhase),
    ...(traitOffersByPhase === undefined ? {} : { traitOffersByPhase }),
  });
}

function updatedGorgonResult(
  catalog: Catalog,
  room: RoomDeclaration,
  current: RoomEncounterState,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): RoomEncounterState {
  if (command.kind !== 'ReplaceGorgonDeathDefianceCondition') return current;
  const binding = encounterBindingsBySlot(catalog, room, room.gameName).get(phase.phaseKey);
  if (binding === undefined)
    failCommand(command, `${room.gameName} has no encounter phase ${phase.phaseKey}`);
  const prior = current.gorgonResultByPhase?.[phase.phaseKey];
  if (prior === undefined)
    failCommand(command, `${room.gameName} has no Gorgon result ${phase.phaseKey}`);
  const selectedKey =
    binding.kind === 'fixed'
      ? binding.encounterDefinitionKey
      : current.encounterKeyByPhase[phase.phaseKey];
  if (selectedKey === undefined || !gorgonSlotOwnedByDeclaration(catalog, binding, room.gameName))
    failCommand(command, `${room.gameName}.${phase.phaseKey} is not a Gorgon-hosting declaration`);
  const nextOffer =
    command.value === true && prior.athenaOffer === undefined ? null : prior.athenaOffer;
  const next = Object.freeze({
    deathDefianceConditionMet: command.value,
    ...(nextOffer === undefined ? {} : { athenaOffer: nextOffer }),
  });
  return Object.freeze({
    ...current,
    gorgonResultByPhase: Object.freeze({
      ...(current.gorgonResultByPhase ?? {}),
      [phase.phaseKey]: next,
    }),
  });
}

function updatedFigLeafSkip(
  catalog: Catalog,
  room: RoomDeclaration,
  current: RoomEncounterState,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): RoomEncounterState {
  if (command.kind !== 'ReplaceFigLeafSkip') return current;
  const binding = encounterBindingsBySlot(catalog, room, room.gameName).get(phase.phaseKey);
  if (binding === undefined)
    failCommand(command, `${room.gameName} has no encounter phase ${phase.phaseKey}`);
  const next = { ...current.figLeafSkipByPhase, [phase.phaseKey]: command.value };
  return Object.freeze({
    ...current,
    figLeafSkipByPhase: Object.freeze(next),
  });
}

function replaceTopLevel(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: EncounterOccurrenceCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.phase.owner.occurrenceId, command);
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  const encounters = updatedSelections(
    catalog,
    room,
    occurrence.encounters,
    command.phase,
    command,
  );
  const withFigLeaf = updatedFigLeafSkip(catalog, room, encounters, command.phase, command);
  const withGorgon = updatedGorgonResult(catalog, room, withFigLeaf, command.phase, command);
  if (withGorgon === occurrence.encounters) return document;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, Object.freeze({ ...occurrence, encounters: withGorgon })),
  );
}

/**
 * Encounter commands mutate only exact persisted room-instance state. Dynamic
 * candidate legality is published by simulation; a retained selection may be
 * context-invalid and is deliberately not repaired by this command path.
 */
export function applyEncounterOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: EncounterOccurrenceCommand,
): ProjectDocument {
  return replaceTopLevel(document, catalog, located, command);
}
