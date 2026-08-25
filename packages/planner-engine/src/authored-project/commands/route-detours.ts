import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { createInitialExitDecision } from '../batchState';
import type { ExitDecisionSourceAddress } from '../addresses';
import type {
  AnomalyReplacementProvenance,
  AnomalyRoomState,
  AuthoredAdditionalExit,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  ExitSelection,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import { createDefaultRoomState } from '../room-state/defaults';
import { createDefaultRoomEncounterState } from '../room-state/encounters';
import { requireCountedBinding } from '../room-state/declaration';
import {
  exitDecisionForSource,
  normalDecisionProgressionForLayout,
  selectedExitKey,
  selectedOrdinaryBatchIndex,
} from '../topology/query';
import { applyTopologyRemovalImpact, describeTopologyRemovalImpact } from '../topologyImpact';
import { createEmptyRoomActionState } from '../room-actions';
import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  withBiome,
  type LocatedBiome,
} from './contract';
import { replaceOccurrence } from './occurrence-mutation';
import { reconcileNormalTargetEntryStates } from './selection-state';
import type { RouteDetourCommand } from './types';

function sourceEquals(left: ExitDecisionSource, right: ExitDecisionSourceAddress): boolean {
  if (left.kind === 'occurrence' && right.kind === 'occurrence') {
    return left.occurrenceId === right.occurrenceId;
  }
  return (
    left.kind === 'hubDecision' &&
    right.kind === 'hubDecision' &&
    left.decisionKey === right.decisionKey
  );
}

function replaceDecision(topology: BiomeTopology, replacement: ExitDecision): BiomeTopology {
  return Object.freeze({
    ...topology,
    decisions: Object.freeze(
      topology.decisions.map((decision) =>
        decision.kind === 'exit' && sourceEquals(decision.source, replacement.source)
          ? replacement
          : decision,
      ),
    ),
  });
}

function appendDecision(topology: BiomeTopology, decision: ExitDecision): BiomeTopology {
  return Object.freeze({
    ...topology,
    decisions: Object.freeze([...topology.decisions, decision]),
  });
}

function appendOccurrence(
  topology: BiomeTopology,
  occurrence: RoomOccurrence,
  command: RouteDetourCommand,
): BiomeTopology {
  if (
    topology.occurrences.some((candidate) => candidate.occurrenceId === occurrence.occurrenceId)
  ) {
    failCommand(command, `occurrence ${occurrence.occurrenceId} already exists`);
  }
  return Object.freeze({
    ...topology,
    occurrences: Object.freeze([...topology.occurrences, occurrence]),
  });
}

function updateTopology(
  document: ProjectDocument,
  located: LocatedBiome,
  topology: BiomeTopology,
): ProjectDocument {
  return withBiome(document, located, { ...located.plan, topology });
}

function anomalyDescriptor(
  located: LocatedBiome,
  command: RouteDetourCommand,
): NonNullable<
  Extract<typeof located.layout.progression, { readonly kind: 'generated' }>['anomalyReplacement']
> {
  if (located.layout.progression.kind !== 'generated') {
    failCommand(command, `${located.layout.biomeKey} has no declared Anomaly replacement`);
  }
  const descriptor = located.layout.progression.anomalyReplacement;
  if (descriptor === undefined) {
    failCommand(command, `${located.layout.biomeKey} has no declared Anomaly replacement`);
  }
  return descriptor;
}

function requireAnomalyRoom(
  catalog: Catalog,
  gameName: string,
  command: RouteDetourCommand,
): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (
    room === undefined ||
    room.roomSetKey !== 'Anomaly' ||
    room.mode.kind !== 'authored' ||
    room.mode.templateKey !== 'Anomaly'
  ) {
    failCommand(command, `${gameName} is not a declared Anomaly room`);
  }
  return room;
}

function requireContractBossRoom(
  catalog: Catalog,
  gameName: string,
  command: RouteDetourCommand,
): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (
    room === undefined ||
    room.roomSetKey !== 'C' ||
    room.mode.kind !== 'authored' ||
    room.mode.templateKey !== 'ContractBoss'
  ) {
    failCommand(command, `${gameName} is not the declared Zagreus contract room`);
  }
  return room;
}

function requireAnomalyOccurrence(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  occurrenceId: OccurrenceId,
  command: RouteDetourCommand,
): {
  readonly occurrence: RoomOccurrence & {
    readonly anomalyReplacement: AnomalyReplacementProvenance;
    readonly state: AnomalyRoomState;
  };
  readonly rememberedRoom: RoomDeclaration;
} {
  const descriptor = anomalyDescriptor(located, command);
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  if (occurrence.anomalyReplacement === undefined || occurrence.state.kind !== 'anomaly') {
    failCommand(command, `${occurrenceId} is not an Anomaly replacement occurrence`);
  }
  const anomalyOccurrence: RoomOccurrence & {
    readonly anomalyReplacement: AnomalyReplacementProvenance;
    readonly state: AnomalyRoomState;
  } = occurrence as RoomOccurrence & {
    readonly anomalyReplacement: AnomalyReplacementProvenance;
    readonly state: AnomalyRoomState;
  };
  requireAnomalyRoom(catalog, anomalyOccurrence.gameName, command);
  if (!descriptor.replacementRoomGameNames.includes(anomalyOccurrence.gameName)) {
    failCommand(command, `${anomalyOccurrence.gameName} is not a declared Anomaly replacement map`);
  }
  const rememberedRoom = requireRoom(
    catalog,
    anomalyOccurrence.anomalyReplacement.replacedRoomGameName,
    located.layout.biomeKey,
    command,
  );
  if (!descriptor.replaceableTargetRoomGameNames.includes(rememberedRoom.gameName)) {
    failCommand(command, `${rememberedRoom.gameName} is not an Anomaly-replaceable G target`);
  }
  const owners = topology.decisions.filter(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.targets.some(
        (target) => target.occurrenceId === anomalyOccurrence.occurrenceId,
      ),
  );
  if (owners.length !== 1) {
    failCommand(command, 'Anomaly replacement must have one normal-target owner');
  }
  return Object.freeze({ occurrence: anomalyOccurrence, rememberedRoom });
}

function removeOutgoingDecision(
  topology: BiomeTopology,
  occurrenceId: OccurrenceId,
): BiomeTopology {
  const source = { kind: 'occurrence' as const, occurrenceId };
  const decision = exitDecisionForSource(topology, source);
  if (decision === undefined) return topology;
  // Anomaly replaces the source room's normal continuation. Additional exits
  // are source-owned and stay dormant with the occurrence, so only ordinary
  // targets and their descendants participate in this removal closure.
  const impact = describeTopologyRemovalImpact(
    topology,
    new Set(decision.normal.targets.map((target) => target.occurrenceId)),
  );
  const withoutNormalBranch = applyTopologyRemovalImpact(topology, impact);
  return Object.freeze({
    ...withoutNormalBranch,
    decisions: Object.freeze(
      withoutNormalBranch.decisions.filter(
        (candidate) =>
          candidate.kind !== 'exit' ||
          candidate.source.kind !== 'occurrence' ||
          candidate.source.occurrenceId !== occurrenceId,
      ),
    ),
  });
}

function switchTargetToAnomaly(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<RouteDetourCommand, { readonly kind: 'SwitchTargetToAnomaly' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const descriptor = anomalyDescriptor(located, command);
  const decision = exitDecisionForSource(topology, command.target.source);
  const target = decision?.normal.targets.find(
    (candidate) => candidate.exitKey === command.target.exitKey,
  );
  if (decision === undefined || target === undefined) {
    failCommand(command, 'normal Anomaly target does not exist');
  }
  const occurrence = requireOccurrence(located.plan, target.occurrenceId, command);
  if (occurrence.anomalyReplacement !== undefined || occurrence.state.kind !== 'counted') {
    failCommand(command, 'target is not a replaceable counted host room');
  }
  const rememberedRoom = requireRoom(
    catalog,
    occurrence.gameName,
    located.layout.biomeKey,
    command,
  );
  if (!descriptor.replaceableTargetRoomGameNames.includes(rememberedRoom.gameName)) {
    failCommand(command, `${rememberedRoom.gameName} is not an Anomaly-replaceable target`);
  }
  requireCountedBinding(rememberedRoom, rememberedRoom.gameName);
  const replacementRoom = requireAnomalyRoom(
    catalog,
    descriptor.defaultReplacementRoomGameName,
    command,
  );
  const withoutOutgoing = removeOutgoingDecision(topology, occurrence.occurrenceId);
  const replacement: RoomOccurrence = Object.freeze({
    occurrenceId: occurrence.occurrenceId,
    gameName: replacementRoom.gameName,
    anomalyReplacement: Object.freeze({ replacedRoomGameName: rememberedRoom.gameName }),
    state: Object.freeze({
      kind: 'anomaly',
      reward: occurrence.state.reward,
      success: true,
    }),
    encounters: createDefaultRoomEncounterState(
      catalog,
      replacementRoom,
      `occurrences.${occurrence.occurrenceId}.encounters`,
    ),
    roomActions: occurrence.roomActions,
    additionalExits: occurrence.additionalExits ?? Object.freeze([]),
  });
  return updateTopology(document, located, replaceOccurrence(withoutOutgoing, replacement));
}

function replaceAnomalyMap(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<RouteDetourCommand, { readonly kind: 'ReplaceAnomalyMap' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const descriptor = anomalyDescriptor(located, command);
  const { occurrence } = requireAnomalyOccurrence(
    catalog,
    located,
    topology,
    command.occurrence.occurrenceId,
    command,
  );
  if (!descriptor.replacementRoomGameNames.includes(command.gameName)) {
    failCommand(command, `${command.gameName} is not a declared Anomaly replacement map`);
  }
  if (occurrence.gameName === command.gameName) return document;
  const replacementRoom = requireAnomalyRoom(catalog, command.gameName, command);
  return updateTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        gameName: replacementRoom.gameName,
        encounters: createDefaultRoomEncounterState(
          catalog,
          replacementRoom,
          `occurrences.${occurrence.occurrenceId}.encounters`,
        ),
      }),
    ),
  );
}

function replaceAnomalySuccess(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<RouteDetourCommand, { readonly kind: 'ReplaceAnomalySuccess' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const { occurrence } = requireAnomalyOccurrence(
    catalog,
    located,
    topology,
    command.occurrence.occurrenceId,
    command,
  );
  if (occurrence.state.success === command.success) return document;
  return updateTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        state: Object.freeze({ ...occurrence.state, success: command.success }),
      }),
    ),
  );
}

function revertAnomaly(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<RouteDetourCommand, { readonly kind: 'RevertAnomaly' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const { occurrence, rememberedRoom } = requireAnomalyOccurrence(
    catalog,
    located,
    topology,
    command.occurrence.occurrenceId,
    command,
  );
  requireCountedBinding(rememberedRoom, rememberedRoom.gameName);
  const withoutOutgoing = removeOutgoingDecision(topology, occurrence.occurrenceId);
  return updateTopology(
    document,
    located,
    replaceOccurrence(
      withoutOutgoing,
      Object.freeze({
        occurrenceId: occurrence.occurrenceId,
        gameName: rememberedRoom.gameName,
        state: Object.freeze({
          kind: 'counted',
          reward: occurrence.state.reward,
        }),
        encounters: createDefaultRoomEncounterState(
          catalog,
          rememberedRoom,
          `occurrences.${occurrence.occurrenceId}.encounters`,
        ),
        roomActions: occurrence.roomActions,
        additionalExits: occurrence.additionalExits ?? Object.freeze([]),
      }),
    ),
  );
}

function requireContractSource(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  occurrenceId: OccurrenceId,
  command: RouteDetourCommand,
): { readonly occurrence: RoomOccurrence; readonly room: RoomDeclaration } {
  if (selectedOrdinaryBatchIndex(topology, occurrenceId) === undefined) {
    failCommand(command, 'a Zagreus contract source must be on the selected spine');
  }
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  if (
    room.kind !== 'Shop' ||
    occurrence.state.kind !== 'shop' ||
    occurrence.state.shop === undefined
  ) {
    failCommand(
      command,
      'a Zagreus contract requires a selected Midshop with materialized Shop state',
    );
  }
  return Object.freeze({ occurrence, room });
}

function additionalDeclaration(
  room: RoomDeclaration,
  additionalExitKey: string,
  command: RouteDetourCommand,
): Extract<RoomDeclaration['additionalExits'][number], { readonly kind: 'zagreusContract' }> {
  const declaration = room.additionalExits.find(
    (
      candidate,
    ): candidate is Extract<
      RoomDeclaration['additionalExits'][number],
      { readonly kind: 'zagreusContract' }
    > => candidate.kind === 'zagreusContract' && candidate.key === additionalExitKey,
  );
  if (declaration === undefined) {
    failCommand(command, `${additionalExitKey} is not declared by ${room.gameName}`);
  }
  return declaration;
}

function naturalChaosDeclaration(
  room: RoomDeclaration,
  additionalExitKey: string,
  command: RouteDetourCommand,
): Extract<RoomDeclaration['additionalExits'][number], { readonly kind: 'naturalChaos' }> {
  const declaration = room.additionalExits.find(
    (
      candidate,
    ): candidate is Extract<
      RoomDeclaration['additionalExits'][number],
      { readonly kind: 'naturalChaos' }
    > => candidate.kind === 'naturalChaos' && candidate.key === additionalExitKey,
  );
  if (declaration === undefined) {
    failCommand(command, `${additionalExitKey} is not declared by ${room.gameName}`);
  }
  return declaration;
}

function sparkChaosDeclaration(
  room: RoomDeclaration,
  additionalExitKey: string,
  command: RouteDetourCommand,
): Extract<RoomDeclaration['additionalExits'][number], { readonly kind: 'sparkChaos' }> {
  const declaration = room.additionalExits.find(
    (
      candidate,
    ): candidate is Extract<
      RoomDeclaration['additionalExits'][number],
      { readonly kind: 'sparkChaos' }
    > => candidate.kind === 'sparkChaos' && candidate.key === additionalExitKey,
  );
  if (declaration === undefined)
    failCommand(command, `${additionalExitKey} is not declared by ${room.gameName}`);
  return declaration;
}

function requireNaturalChaosSource(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  occurrenceId: OccurrenceId,
  command: RouteDetourCommand,
): { readonly occurrence: RoomOccurrence; readonly room: RoomDeclaration } {
  if (selectedOrdinaryBatchIndex(topology, occurrenceId) === undefined) {
    failCommand(command, 'a natural Chaos source must be on the selected spine');
  }
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  if (room.mode.kind !== 'authored') {
    failCommand(command, 'a natural Chaos source must be an authored host room');
  }
  return Object.freeze({ occurrence, room });
}

function naturalChaosHost(
  located: LocatedBiome,
  command: RouteDetourCommand,
): NonNullable<typeof located.layout.naturalChaos> {
  const host = located.layout.naturalChaos;
  if (host === undefined) {
    failCommand(command, `${located.layout.biomeKey} has no natural Chaos host policy`);
  }
  return host;
}

function sparkChaosHost(located: LocatedBiome, command: RouteDetourCommand) {
  const host = located.layout.sparkChaos;
  if (host === undefined)
    failCommand(command, `${located.layout.biomeKey} has no Spark Chaos target policy`);
  return host;
}

function normalSelectionWithAdditional(
  selection: ExitSelection,
  decision: ExitDecision,
): ExitSelection {
  if (selection.kind !== 'derived') return selection;
  const [target] = decision.normal.targets;
  if (decision.normal.targets.length !== 1 || target === undefined) {
    throw new Error('decoded derived selection omitted its width-one normal target');
  }
  return Object.freeze({ kind: 'normal', exitKey: target.exitKey });
}

function addZagreusContract(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<RouteDetourCommand, { readonly kind: 'AddZagreusContract' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const { occurrence, room: sourceRoom } = requireContractSource(
    catalog,
    located,
    topology,
    command.additional.occurrenceId,
    command,
  );
  const declaration = additionalDeclaration(
    sourceRoom,
    command.additional.additionalExitKey,
    command,
  );
  const source = Object.freeze({
    kind: 'occurrence' as const,
    occurrenceId: command.additional.occurrenceId,
  });
  const existing = exitDecisionForSource(topology, source);
  if ((occurrence.additionalExits ?? []).some((additional) => additional.key === declaration.key)) {
    failCommand(command, `${declaration.key} is already authored`);
  }
  const contractRoom = requireContractBossRoom(catalog, declaration.targetRoomGameName, command);
  const progression = normalDecisionProgressionForLayout(located.layout);
  if (progression === undefined) {
    failCommand(command, 'a Zagreus contract source requires normal host progression');
  }
  const contract: AuthoredAdditionalExit = Object.freeze({
    kind: 'zagreusContract',
    key: declaration.key,
    occurrenceId: command.occurrenceId,
  });
  const nextDecision: ExitDecision =
    existing === undefined
      ? createInitialExitDecision(
          progression,
          source,
          sourceRoom.mode.kind === 'authored' ? sourceRoom.mode.templateKey : undefined,
        )
      : Object.freeze({
          kind: 'exit',
          source,
          normal: existing.normal,
          selection: normalSelectionWithAdditional(existing.selection, existing),
        });
  const contractOccurrence: RoomOccurrence = Object.freeze({
    occurrenceId: command.occurrenceId,
    gameName: contractRoom.gameName,
    state: createDefaultRoomState(catalog, contractRoom, {
      role: 'ordinary',
      entryActive: false,
      loadout: located.loadout,
    }),
    encounters: createDefaultRoomEncounterState(
      catalog,
      contractRoom,
      `occurrences.${command.occurrenceId}.encounters`,
    ),
    roomActions: createEmptyRoomActionState(),
    additionalExits: Object.freeze([]),
  });
  const withContract = appendOccurrence(topology, contractOccurrence, command);
  const withSource = replaceOccurrence(
    withContract,
    Object.freeze({
      ...occurrence,
      additionalExits: Object.freeze([...(occurrence.additionalExits ?? []), contract]),
    }),
  );
  return updateTopology(
    document,
    located,
    existing === undefined
      ? appendDecision(withSource, nextDecision)
      : replaceDecision(withSource, nextDecision),
  );
}

function removeZagreusContract(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<RouteDetourCommand, { readonly kind: 'RemoveZagreusContract' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const { occurrence, room: sourceRoom } = requireContractSource(
    catalog,
    located,
    topology,
    command.additional.occurrenceId,
    command,
  );
  const declaration = additionalDeclaration(
    sourceRoom,
    command.additional.additionalExitKey,
    command,
  );
  const source = Object.freeze({
    kind: 'occurrence' as const,
    occurrenceId: command.additional.occurrenceId,
  });
  const decision = exitDecisionForSource(topology, source);
  const additional = (occurrence.additionalExits ?? []).find(
    (candidate) => candidate.key === declaration.key,
  );
  if (decision === undefined || additional === undefined) {
    failCommand(command, `${declaration.key} is not authored`);
  }
  const impact = describeTopologyRemovalImpact(topology, new Set([additional.occurrenceId]));
  const withoutContract = applyTopologyRemovalImpact(topology, impact);
  const retainedDecision = exitDecisionForSource(withoutContract, source);
  if (retainedDecision === undefined) {
    throw new Error('removing an additional target removed its source decision');
  }
  const remainingAdditional = (occurrence.additionalExits ?? []).filter(
    (candidate) => candidate.key !== declaration.key,
  );
  const selection: ExitSelection =
    remainingAdditional.length === 0 && retainedDecision.normal.targets.length === 1
      ? Object.freeze({ kind: 'derived' })
      : retainedDecision.selection.kind === 'additional' &&
          retainedDecision.selection.additionalExitKey === declaration.key
        ? Object.freeze({ kind: 'unresolved' })
        : retainedDecision.selection;
  const nextDecision = Object.freeze({
    ...retainedDecision,
    selection,
  });
  const withDecision = replaceDecision(
    replaceOccurrence(
      withoutContract,
      Object.freeze({ ...occurrence, additionalExits: Object.freeze(remainingAdditional) }),
    ),
    nextDecision,
  );
  return updateTopology(
    document,
    located,
    reconcileNormalTargetEntryStates(
      catalog,
      located,
      withDecision,
      nextDecision,
      selectedExitKey(nextDecision),
      command,
    ),
  );
}

function addNaturalChaos(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<RouteDetourCommand, { readonly kind: 'AddNaturalChaos' | 'AddSparkChaos' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const { occurrence, room: sourceRoom } = requireNaturalChaosSource(
    catalog,
    located,
    topology,
    command.additional.occurrenceId,
    command,
  );
  const declaration =
    command.kind === 'AddSparkChaos'
      ? sparkChaosDeclaration(sourceRoom, command.additional.additionalExitKey, command)
      : naturalChaosDeclaration(sourceRoom, command.additional.additionalExitKey, command);
  if (command.kind === 'AddSparkChaos' && (sourceRoom.secretPointAnchorCount ?? 0) <= 0)
    failCommand(command, `${sourceRoom.gameName} has no physical SecretPoint`);
  if (
    occurrence.additionalExits.some(
      (additional) =>
        additional.key === declaration.key ||
        (command.kind === 'AddSparkChaos' && additional.kind === 'naturalChaos') ||
        (command.kind === 'AddNaturalChaos' && additional.kind === 'sparkChaos'),
    )
  ) {
    failCommand(command, `${declaration.key} is already authored`);
  }
  const host =
    command.kind === 'AddSparkChaos'
      ? sparkChaosHost(located, command)
      : naturalChaosHost(located, command);
  const chaosRoom = catalog.rooms.byKey[host.defaultRoomGameName];
  if (chaosRoom === undefined) {
    failCommand(command, `unknown Chaos map ${host.defaultRoomGameName}`);
  }
  if (
    chaosRoom.roomSetKey !== 'Chaos' ||
    chaosRoom.mode.kind !== 'authored' ||
    chaosRoom.mode.templateKey !== 'Chaos'
  ) {
    failCommand(command, `${chaosRoom.gameName} is not a declared Chaos map`);
  }
  const source = Object.freeze({
    kind: 'occurrence' as const,
    occurrenceId: occurrence.occurrenceId,
  });
  const existing = exitDecisionForSource(topology, source);
  const progression = normalDecisionProgressionForLayout(located.layout);
  if (progression === undefined) {
    failCommand(command, 'a natural Chaos source requires normal host progression');
  }
  const additional: AuthoredAdditionalExit =
    command.kind === 'AddSparkChaos'
      ? Object.freeze({
          kind: 'sparkChaos' as const,
          key: 'sparkChaos' as const,
          occurrenceId: command.occurrenceId,
        })
      : Object.freeze({
          kind: 'naturalChaos' as const,
          key: 'naturalChaos' as const,
          occurrenceId: command.occurrenceId,
        });
  const nextDecision: ExitDecision =
    existing === undefined
      ? createInitialExitDecision(
          progression,
          source,
          sourceRoom.mode.kind === 'authored' ? sourceRoom.mode.templateKey : undefined,
        )
      : Object.freeze({
          kind: 'exit',
          source,
          normal: existing.normal,
          selection: normalSelectionWithAdditional(existing.selection, existing),
        });
  const chaosOccurrence: RoomOccurrence = Object.freeze({
    occurrenceId: command.occurrenceId,
    gameName: chaosRoom.gameName,
    state: createDefaultRoomState(catalog, chaosRoom, {
      role: 'ordinary',
      entryActive: false,
      loadout: located.loadout,
    }),
    encounters: createDefaultRoomEncounterState(
      catalog,
      chaosRoom,
      `occurrences.${command.occurrenceId}.encounters`,
    ),
    roomActions: createEmptyRoomActionState(),
    additionalExits: Object.freeze([]),
  });
  const withChaos = appendOccurrence(topology, chaosOccurrence, command);
  const withSource = replaceOccurrence(
    withChaos,
    Object.freeze({
      ...occurrence,
      additionalExits: Object.freeze([...occurrence.additionalExits, additional]),
    }),
  );
  return updateTopology(
    document,
    located,
    existing === undefined
      ? appendDecision(withSource, nextDecision)
      : replaceDecision(withSource, nextDecision),
  );
}

function removeChaos(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    RouteDetourCommand,
    { readonly kind: 'RemoveNaturalChaos' | 'RemoveSparkChaos' }
  >,
): ProjectDocument {
  const additionalKind = command.kind === 'RemoveSparkChaos' ? 'sparkChaos' : 'naturalChaos';
  const topology = requireTopology(located.plan, command);
  if (selectedOrdinaryBatchIndex(topology, command.additional.occurrenceId) === undefined) {
    failCommand(command, `a ${additionalKind} source must be on the selected spine`);
  }
  const occurrence = requireOccurrence(located.plan, command.additional.occurrenceId, command);
  const source = Object.freeze({
    kind: 'occurrence' as const,
    occurrenceId: occurrence.occurrenceId,
  });
  const decision = exitDecisionForSource(topology, source);
  const additional = occurrence.additionalExits.find(
    (candidate) =>
      candidate.kind === additionalKind && candidate.key === command.additional.additionalExitKey,
  );
  if (additional === undefined) {
    failCommand(command, `${command.additional.additionalExitKey} is not authored`);
  }
  const impact = describeTopologyRemovalImpact(topology, new Set([additional.occurrenceId]));
  const withoutChaos = applyTopologyRemovalImpact(topology, impact);
  const withoutFeature = replaceOccurrence(
    withoutChaos,
    Object.freeze({
      ...occurrence,
      additionalExits: Object.freeze(
        occurrence.additionalExits.filter((candidate) => candidate.key !== additional.key),
      ),
    }),
  );
  if (decision === undefined) {
    return updateTopology(document, located, withoutFeature);
  }
  const retainedDecision = exitDecisionForSource(withoutChaos, source);
  if (retainedDecision === undefined) {
    throw new Error('removing an additional target removed its source decision');
  }
  const remainingAdditional = occurrence.additionalExits.filter(
    (candidate) => candidate.key !== additional.key,
  );
  const selection: ExitSelection =
    remainingAdditional.length === 0 && retainedDecision.normal.targets.length === 1
      ? Object.freeze({ kind: 'derived' })
      : retainedDecision.selection.kind === 'additional' &&
          retainedDecision.selection.additionalExitKey === additional.key
        ? Object.freeze({ kind: 'unresolved' })
        : retainedDecision.selection;
  const nextDecision = Object.freeze({ ...retainedDecision, selection });
  const withDecision = replaceDecision(withoutFeature, nextDecision);
  return updateTopology(
    document,
    located,
    reconcileNormalTargetEntryStates(
      catalog,
      located,
      withDecision,
      nextDecision,
      selectedExitKey(nextDecision),
      command,
    ),
  );
}

function replaceChaosMap(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    RouteDetourCommand,
    { readonly kind: 'ReplaceNaturalChaosMap' | 'ReplaceSparkChaosMap' }
  >,
): ProjectDocument {
  const additionalKind = command.kind === 'ReplaceSparkChaosMap' ? 'sparkChaos' : 'naturalChaos';
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
  const source = topology.occurrences.find((candidate) =>
    candidate.additionalExits.some(
      (additional) =>
        additional.kind === additionalKind && additional.occurrenceId === occurrence.occurrenceId,
    ),
  );
  if (source === undefined) {
    failCommand(command, `${occurrence.occurrenceId} is not an authored ${additionalKind} map`);
  }
  const host =
    command.kind === 'ReplaceSparkChaosMap'
      ? sparkChaosHost(located, command)
      : naturalChaosHost(located, command);
  if (!host.roomGameNames.includes(command.gameName)) {
    failCommand(
      command,
      `${command.gameName} is outside the ${located.layout.biomeKey} Chaos map domain`,
    );
  }
  const room = catalog.rooms.byKey[command.gameName];
  if (room === undefined) {
    failCommand(command, `unknown Chaos map ${command.gameName}`);
  }
  if (
    room.roomSetKey !== 'Chaos' ||
    room.mode.kind !== 'authored' ||
    room.mode.templateKey !== 'Chaos'
  ) {
    failCommand(command, `${command.gameName} is not a declared Chaos map`);
  }
  return updateTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room, {
          role: 'ordinary',
          entryActive: false,
          loadout: located.loadout,
        }),
        encounters: createDefaultRoomEncounterState(
          catalog,
          room,
          `occurrences.${occurrence.occurrenceId}.encounters`,
        ),
      }),
    ),
  );
}

export function applyRouteDetourCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: RouteDetourCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'SwitchTargetToAnomaly':
      return switchTargetToAnomaly(document, catalog, located, command);
    case 'ReplaceAnomalyMap':
      return replaceAnomalyMap(document, catalog, located, command);
    case 'ReplaceAnomalySuccess':
      return replaceAnomalySuccess(document, catalog, located, command);
    case 'RevertAnomaly':
      return revertAnomaly(document, catalog, located, command);
    case 'AddZagreusContract':
      return addZagreusContract(document, catalog, located, command);
    case 'RemoveZagreusContract':
      return removeZagreusContract(document, catalog, located, command);
    case 'AddNaturalChaos':
      return addNaturalChaos(document, catalog, located, command);
    case 'AddSparkChaos':
      return addNaturalChaos(document, catalog, located, command);
    case 'RemoveNaturalChaos':
    case 'RemoveSparkChaos':
      return removeChaos(document, catalog, located, command);
    case 'ReplaceNaturalChaosMap':
    case 'ReplaceSparkChaosMap':
      return replaceChaosMap(document, catalog, located, command);
  }
}
