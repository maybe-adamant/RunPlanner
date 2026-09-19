import type { Catalog } from '../../../catalog-schema';
import {
  applyTopologyRemovalImpact,
  describeExitDecisionRemovalImpact,
  describeHubDecisionRemovalImpact,
  describeHubSlotClosureImpact,
} from '../../topology/impact';
import type {
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  HubDecision,
  OccurrenceId,
  ProjectDocument,
} from '../../model';
import { requireEphyraSideRooms } from '../../room-state/declaration';
import {
  exitDecisionForSource,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
} from '../../topology/query';
import { failCommand, requireRoom, requireTopology, type LocatedBiome } from '../contract';
import type { TopologyCommand } from '../types';
import { replaceDecision, appendDecision, appendOccurrence, updateTopology } from './construction';
import { defaultOccurrence } from '../../topology/construction';

/**
 * A completed Hub owns one fixed width-one Preboss handoff. Reducing the
 * visit sequence below its declared completion requirement must remove that
 * handoff and its target subtree in the same semantic edit; otherwise the
 * persisted topology would retain an invalid Hub-source exit.
 */
function removeCompletedHubHandoff(topology: BiomeTopology, hubKey: string): BiomeTopology {
  const impact = describeExitDecisionRemovalImpact(topology, {
    kind: 'hubDecision',
    decisionKey: hubKey,
  });
  return impact === undefined ? topology : applyTopologyRemovalImpact(topology, impact);
}

function terminalHubEnvelope(source: ExitDecisionSource): ExitDecision {
  return Object.freeze({
    kind: 'exit',
    source,
    normal: Object.freeze({
      kind: 'batch',
      rewardStore: Object.freeze({ kind: 'none' }),
      batchState: null,
      targets: Object.freeze([]),
    }),
    selection: Object.freeze({ kind: 'unresolved' }),
  });
}

export function replaceWithHubDecision(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'ReplaceWithHubDecision' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (located.layout.progression.kind !== 'hub') failCommand(command, 'unknown Hub decision');
  if (
    command.hub.routeKey !== command.decision.routeKey ||
    command.hub.biomeKey !== command.decision.biomeKey
  ) {
    failCommand(command, 'Hub address does not match the terminal decision biome');
  }
  if (command.hub.hubKey !== located.layout.progression.hubKey)
    failCommand(command, 'unknown Hub decision');
  if (command.decision.source.kind !== 'occurrence') {
    failCommand(command, 'Hub takeover requires an occurrence-owned terminal envelope');
  }
  if (topology.decisions.some((decision) => decision.kind === 'hub'))
    failCommand(command, 'Hub decision already exists');
  const source = Object.freeze({
    kind: 'occurrence' as const,
    occurrenceId: command.decision.source.occurrenceId,
  });
  const terminal = hubTerminalTakeoverForSource(catalog, located.layout, topology, source);
  if (terminal === undefined || terminal.hubKey !== command.hub.hubKey) {
    failCommand(command, 'Hub takeover is not declared at this terminal envelope');
  }
  const envelope = exitDecisionForSource(topology, command.decision.source);
  if (envelope === undefined || !isExactTerminalTakeoverEnvelope(envelope)) {
    failCommand(command, 'Hub takeover requires the exact empty terminal envelope');
  }
  const impact = describeExitDecisionRemovalImpact(topology, source);
  if (impact === undefined) throw new Error('terminal Hub envelope disappeared during replacement');
  return updateTopology(
    document,
    located,
    appendDecision(
      applyTopologyRemovalImpact(topology, impact),
      Object.freeze({
        kind: 'hub',
        hubKey: command.hub.hubKey,
        source,
        openTargets: Object.freeze([]),
        visitOrder: Object.freeze([]),
      }),
    ),
  );
}

export function removeHubDecision(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'RemoveHubDecision' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (
    located.layout.progression.kind !== 'hub' ||
    command.hub.hubKey !== located.layout.progression.hubKey
  ) {
    failCommand(command, 'unknown Hub decision');
  }
  const hub = topology.decisions.find(
    (decision): decision is HubDecision =>
      decision.kind === 'hub' && decision.hubKey === command.hub.hubKey,
  );
  if (hub === undefined) return document;
  const terminal = hubTerminalTakeoverForSource(catalog, located.layout, topology, hub.source);
  if (terminal === undefined || terminal.hubKey !== hub.hubKey) {
    failCommand(command, 'Hub decision has no declared terminal source to restore');
  }
  const impact = describeHubDecisionRemovalImpact(topology, hub.hubKey);
  if (impact === undefined) throw new Error('Hub decision disappeared during removal');
  return updateTopology(
    document,
    located,
    appendDecision(applyTopologyRemovalImpact(topology, impact), terminalHubEnvelope(hub.source)),
  );
}

export function updateHub(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    TopologyCommand,
    {
      readonly kind: 'OpenHubSlot' | 'CloseHubSlot' | 'ReplaceHubVisitOrder' | 'ResetHubBoard';
    }
  >,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (located.layout.progression.kind !== 'hub')
    failCommand(command, 'Hub commands require a Hub progression');
  const descriptor = located.layout.progression;
  const hub = topology.decisions.find(
    (decision): decision is HubDecision =>
      decision.kind === 'hub' && decision.hubKey === descriptor.hubKey,
  );
  if (hub === undefined) failCommand(command, 'Hub decision has not been created');
  if (command.kind === 'OpenHubSlot') {
    if (command.slot.hubKey !== descriptor.hubKey)
      failCommand(command, 'Hub address does not match this decision');
    const slot = descriptor.slots.find(
      (candidate) => candidate.slotKey === command.slot.hubSlotKey,
    );
    if (slot === undefined) failCommand(command, `unknown Hub slot ${command.slot.hubSlotKey}`);
    if (hub.openTargets.some((target) => target.hubSlotKey === slot.slotKey)) return document;
    if (hub.openTargets.length >= descriptor.openCount.max)
      failCommand(command, 'Hub already has its maximum open slots');
    for (const constraint of descriptor.openSlotConstraints) {
      if (
        constraint.kind === 'maxOpenFromSlots' &&
        constraint.slotKeys.includes(slot.slotKey) &&
        hub.openTargets.filter((target) => constraint.slotKeys.includes(target.hubSlotKey))
          .length >= constraint.max
      ) {
        failCommand(command, `Hub open-slot constraint excludes ${slot.slotKey}`);
      }
    }
    if (topology.occurrences.some((occurrence) => occurrence.occurrenceId === command.occurrenceId))
      failCommand(command, `occurrence ${command.occurrenceId} already exists`);
    const room = requireRoom(catalog, slot.roomGameName, located.layout.biomeKey, command);
    const localGroup = requireEphyraSideRooms(room, room.gameName);
    const expectedLocalSlots = localGroup?.slots ?? [];
    const suppliedLocalSlotKeys = Object.keys(command.localOccurrenceIdsBySlot);
    if (
      suppliedLocalSlotKeys.length !== expectedLocalSlots.length ||
      suppliedLocalSlotKeys.some(
        (slotKey) => !expectedLocalSlots.some((candidate) => candidate.slotKey === slotKey),
      )
    ) {
      failCommand(command, 'local occurrence identities must match the declaration-fixed slots');
    }
    const createdIds = [command.occurrenceId, ...Object.values(command.localOccurrenceIdsBySlot)];
    if (new Set(createdIds).size !== createdIds.length) {
      failCommand(command, 'main and local occurrence identities must be distinct');
    }
    if (
      createdIds.some((occurrenceId) =>
        topology.occurrences.some((occurrence) => occurrence.occurrenceId === occurrenceId),
      )
    ) {
      failCommand(command, 'one or more supplied occurrence identities already exist');
    }
    const replacement: HubDecision = Object.freeze({
      ...hub,
      openTargets: Object.freeze([
        ...hub.openTargets,
        Object.freeze({ hubSlotKey: slot.slotKey, occurrenceId: command.occurrenceId }),
      ]),
    });
    let next = appendOccurrence(
      topology,
      defaultOccurrence(
        catalog,
        room,
        command.occurrenceId,
        'ordinary',
        false,
        undefined,
        located.loadout,
      ),
      command,
    );
    if (localGroup !== undefined) {
      const targetsBySlot: Record<
        string,
        { readonly occurrenceId: OccurrenceId; readonly generation: 'notGenerated' }
      > = {};
      for (const localSlot of localGroup.slots) {
        const localOccurrenceId = command.localOccurrenceIdsBySlot[localSlot.slotKey];
        if (localOccurrenceId === undefined) {
          failCommand(command, `missing local occurrence identity for ${localSlot.slotKey}`);
        }
        const localRoom = requireRoom(
          catalog,
          localSlot.roomGameName,
          located.layout.biomeKey,
          command,
        );
        next = appendOccurrence(
          next,
          defaultOccurrence(
            catalog,
            localRoom,
            localOccurrenceId,
            'ordinary',
            false,
            undefined,
            located.loadout,
          ),
          command,
        );
        targetsBySlot[localSlot.slotKey] = Object.freeze({
          occurrenceId: localOccurrenceId,
          generation: 'notGenerated',
        });
      }
      next = appendDecision(
        next,
        Object.freeze({
          kind: 'localVisit',
          sourceOccurrenceId: command.occurrenceId,
          groupKey: localGroup.key,
          targetsBySlot: Object.freeze(targetsBySlot),
          visitOrder: Object.freeze([]),
        }),
      );
    }
    return updateTopology(document, located, replaceDecision(next, replacement));
  }
  if (command.kind === 'CloseHubSlot') {
    if (command.slot.hubKey !== descriptor.hubKey)
      failCommand(command, 'Hub address does not match this decision');
    const target = hub.openTargets.find(
      (candidate) => candidate.hubSlotKey === command.slot.hubSlotKey,
    );
    if (target === undefined) return document;
    if (hub.visitOrder.includes(target.hubSlotKey))
      failCommand(command, 'remove Hub visits before closing a slot');
    const impact = describeHubSlotClosureImpact(
      topology,
      descriptor.hubKey,
      target.hubSlotKey,
      descriptor.openCount.min,
    );
    if (impact === undefined)
      failCommand(command, `Hub slot ${target.hubSlotKey} has no open target`);
    const replacement: HubDecision = Object.freeze({
      ...hub,
      openTargets: Object.freeze(hub.openTargets.filter((candidate) => candidate !== target)),
    });
    return updateTopology(
      document,
      located,
      replaceDecision(applyTopologyRemovalImpact(topology, impact), replacement),
    );
  }
  if (command.hub.hubKey !== descriptor.hubKey)
    failCommand(command, 'Hub address does not match this decision');
  if (command.kind === 'ResetHubBoard') {
    if (hub.openTargets.length === 0) return document;
    const impact = describeHubDecisionRemovalImpact(topology, hub.hubKey);
    if (impact === undefined) throw new Error('Hub decision disappeared during reset');
    return updateTopology(
      document,
      located,
      appendDecision(
        applyTopologyRemovalImpact(topology, impact),
        Object.freeze({
          ...hub,
          openTargets: Object.freeze([]),
          visitOrder: Object.freeze([]),
        }),
      ),
    );
  }
  if (
    !Array.isArray(command.hubSlotKeys) ||
    !command.hubSlotKeys.every((hubSlotKey) => typeof hubSlotKey === 'string')
  ) {
    failCommand(command, 'Hub visit order must contain slot keys');
  }
  const visits = [...command.hubSlotKeys];
  if (visits.some((hubSlotKey) => hubSlotKey.trim().length === 0)) {
    failCommand(command, 'Hub visit order must contain non-blank slot keys');
  }
  if (new Set(visits).size !== visits.length) failCommand(command, 'Hub visits must be distinct');
  if (
    visits.some((hubSlotKey) => !hub.openTargets.some((target) => target.hubSlotKey === hubSlotKey))
  ) {
    failCommand(command, 'Hub visits must reference open slots');
  }
  if (visits.length > descriptor.requiredVisits)
    failCommand(command, `Hub supports ${descriptor.requiredVisits} visits`);
  if (
    visits.length === hub.visitOrder.length &&
    visits.every((hubSlotKey, index) => hub.visitOrder[index] === hubSlotKey)
  ) {
    return document;
  }
  const withoutCompletedHandoff =
    hub.visitOrder.length === descriptor.requiredVisits && visits.length < descriptor.requiredVisits
      ? removeCompletedHubHandoff(topology, descriptor.hubKey)
      : topology;
  return updateTopology(
    document,
    located,
    replaceDecision(
      withoutCompletedHandoff,
      Object.freeze({ ...hub, visitOrder: Object.freeze(visits) }),
    ),
  );
}
