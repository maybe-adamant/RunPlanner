import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { createInitialBatchState } from '../batchState';
import type { ExitDecisionSourceAddress } from '../addresses';
import type {
  AdditionalExit,
  AnomalyReplacementProvenance,
  AnomalyRoomState,
  BatchRewardStoreState,
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
import {
  exitDecisionForSource,
  normalDecisionProgressionForLayout,
  selectedExitKey,
  selectedOrdinaryBatchIndex,
} from '../topology/query';
import {
  applyTopologyRemovalImpact,
  describeExitDecisionRemovalImpact,
  describeTopologyRemovalImpact,
} from '../topologyImpact';
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

function sourceFromAddress(source: ExitDecisionSourceAddress): ExitDecisionSource {
  return source.kind === 'occurrence'
    ? Object.freeze({ kind: 'occurrence', occurrenceId: source.occurrenceId })
    : Object.freeze({ kind: 'hubDecision', decisionKey: source.decisionKey });
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

function initialRewardStore(
  located: LocatedBiome,
  sourceRoom: RoomDeclaration,
): BatchRewardStoreState {
  const progression = normalDecisionProgressionForLayout(located.layout);
  const sourceRoomTemplateKey =
    sourceRoom.mode.kind === 'authored' ? sourceRoom.mode.templateKey : undefined;
  const policy =
    progression !== undefined && sourceRoomTemplateKey !== undefined
      ? (progression.rewardStoreOverrides.find(
          (override) => override.sourceRoomTemplateKey === sourceRoomTemplateKey,
        )?.policy ?? progression.rewardStorePolicy)
      : { kind: 'none' as const };
  return policy.kind === 'authoredBaseStore'
    ? Object.freeze({ kind: 'authoredBaseStore', baseRewardStoreKey: null })
    : Object.freeze({ kind: policy.kind });
}

function anomalyDescriptor(
  located: LocatedBiome,
  command: RouteDetourCommand,
): NonNullable<
  Extract<typeof located.layout.progression, { readonly kind: 'generated' }>['anomalyReplacement']
> {
  if (located.layout.biomeKey !== 'G' || located.layout.progression.kind !== 'generated') {
    failCommand(command, 'Anomaly replacement is only declared by the G layout');
  }
  const descriptor = located.layout.progression.anomalyReplacement;
  if (descriptor === undefined) failCommand(command, 'G has no declared Anomaly replacement');
  return descriptor;
}

function requireForeignAnomalyRoom(
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
  requireForeignAnomalyRoom(catalog, anomalyOccurrence.gameName, command);
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
  const impact = describeExitDecisionRemovalImpact(topology, {
    kind: 'occurrence',
    occurrenceId,
  });
  return impact === undefined ? topology : applyTopologyRemovalImpact(topology, impact);
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
    failCommand(command, 'target is not a replaceable counted G room');
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
  const replacementRoom = requireForeignAnomalyRoom(
    catalog,
    descriptor.defaultReplacementRoomGameName,
    command,
  );
  const withoutOutgoing = removeOutgoingDecision(topology, occurrence.occurrenceId);
  const replacement: RoomOccurrence = Object.freeze({
    occurrenceId: occurrence.occurrenceId,
    gameName: replacementRoom.gameName,
    anomalyReplacement: Object.freeze({ replacedRoomGameName: rememberedRoom.gameName }),
    state: Object.freeze({ kind: 'anomaly', offer: occurrence.state.offer, success: true }),
    encounters: createDefaultRoomEncounterState(
      catalog,
      replacementRoom,
      `occurrences.${occurrence.occurrenceId}.encounters`,
    ),
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
  const replacementRoom = requireForeignAnomalyRoom(catalog, command.gameName, command);
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
  const withoutOutgoing = removeOutgoingDecision(topology, occurrence.occurrenceId);
  return updateTopology(
    document,
    located,
    replaceOccurrence(
      withoutOutgoing,
      Object.freeze({
        occurrenceId: occurrence.occurrenceId,
        gameName: rememberedRoom.gameName,
        state: Object.freeze({ kind: 'counted', offer: occurrence.state.offer }),
        encounters: createDefaultRoomEncounterState(
          catalog,
          rememberedRoom,
          `occurrences.${occurrence.occurrenceId}.encounters`,
        ),
      }),
    ),
  );
}

function requireContractSource(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  source: ExitDecisionSourceAddress,
  command: RouteDetourCommand,
): { readonly occurrence: RoomOccurrence; readonly room: RoomDeclaration } {
  if (source.kind !== 'occurrence') {
    failCommand(command, 'a Zagreus contract requires an occurrence source');
  }
  if (selectedOrdinaryBatchIndex(topology, source.occurrenceId) === undefined) {
    failCommand(command, 'a Zagreus contract source must be on the selected spine');
  }
  const occurrence = requireOccurrence(located.plan, source.occurrenceId, command);
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
  const { room: sourceRoom } = requireContractSource(
    catalog,
    located,
    topology,
    command.additional.source,
    command,
  );
  const declaration = additionalDeclaration(
    sourceRoom,
    command.additional.additionalExitKey,
    command,
  );
  const existing = exitDecisionForSource(topology, command.additional.source);
  if (existing?.additional.some((additional) => additional.key === declaration.key)) {
    failCommand(command, `${declaration.key} is already authored`);
  }
  const contractRoom = requireContractBossRoom(catalog, declaration.targetRoomGameName, command);
  const progression = normalDecisionProgressionForLayout(located.layout);
  if (progression === undefined) {
    failCommand(command, 'a Zagreus contract source requires normal host progression');
  }
  const contract: AdditionalExit = Object.freeze({
    kind: 'zagreusContract',
    key: declaration.key,
    occurrenceId: command.occurrenceId,
  });
  const nextDecision: ExitDecision = Object.freeze({
    kind: 'exit',
    source: sourceFromAddress(command.additional.source),
    normal:
      existing?.normal ??
      Object.freeze({
        kind: 'batch',
        rewardStore: initialRewardStore(located, sourceRoom),
        batchState: createInitialBatchState(progression.batchPolicy),
        targets: Object.freeze([]),
      }),
    additional: Object.freeze([...(existing?.additional ?? []), contract]),
    selection:
      existing === undefined
        ? Object.freeze({ kind: 'unresolved' })
        : normalSelectionWithAdditional(existing.selection, existing),
  });
  const contractOccurrence: RoomOccurrence = Object.freeze({
    occurrenceId: command.occurrenceId,
    gameName: contractRoom.gameName,
    state: createDefaultRoomState(catalog, contractRoom, { role: 'ordinary', entryActive: false }),
    encounters: createDefaultRoomEncounterState(
      catalog,
      contractRoom,
      `occurrences.${command.occurrenceId}.encounters`,
    ),
  });
  const withContract = appendOccurrence(topology, contractOccurrence, command);
  return updateTopology(
    document,
    located,
    existing === undefined
      ? appendDecision(withContract, nextDecision)
      : replaceDecision(withContract, nextDecision),
  );
}

function removeZagreusContract(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<RouteDetourCommand, { readonly kind: 'RemoveZagreusContract' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const { room: sourceRoom } = requireContractSource(
    catalog,
    located,
    topology,
    command.additional.source,
    command,
  );
  const declaration = additionalDeclaration(
    sourceRoom,
    command.additional.additionalExitKey,
    command,
  );
  const decision = exitDecisionForSource(topology, command.additional.source);
  const additional = decision?.additional.find((candidate) => candidate.key === declaration.key);
  if (decision === undefined || additional === undefined) {
    failCommand(command, `${declaration.key} is not authored`);
  }
  const impact = describeTopologyRemovalImpact(topology, new Set([additional.occurrenceId]));
  const withoutContract = applyTopologyRemovalImpact(topology, impact);
  const retainedDecision = exitDecisionForSource(withoutContract, command.additional.source);
  if (retainedDecision === undefined) {
    throw new Error('removing an additional target removed its source decision');
  }
  const remainingAdditional = retainedDecision.additional.filter(
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
    additional: Object.freeze(remainingAdditional),
    selection,
  });
  const withDecision = replaceDecision(withoutContract, nextDecision);
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
  }
}
