import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceEncounterPhase,
  type WorkspaceRoomActionRow,
  type WorkspaceRoomActions,
  type WorkspaceRoomFeature,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceRoomLocal,
  type WorkspaceRoomWorkbenchPresentation,
  type WorkspaceShipPhasePresentation,
  type WorkspaceRewardWheelDescriptor,
} from '../contract';

function presentedEncounterPhases(
  encounterPhases: readonly WorkspaceEncounterPhase[],
): readonly WorkspaceEncounterPhase[] {
  return Object.freeze(
    encounterPhases.filter(
      (phase) =>
        phase.address.phaseKey === 'Passive' ||
        phase.customizable ||
        phase.marker.findingCount > 0 ||
        phase.traitOffer !== undefined ||
        phase.figLeaf !== undefined ||
        phase.gorgonCondition !== undefined ||
        phase.gorgonAthena !== undefined,
    ),
  );
}

function shipWorkbenchPresentation(
  encounterPhases: readonly WorkspaceEncounterPhase[],
  features: readonly WorkspaceRoomFeature[],
  roomLocal: Extract<WorkspaceRoomLocal, { readonly kind: 'ship' }>,
  roomActions: WorkspaceRoomActions | undefined,
): WorkspaceRoomWorkbenchPresentation {
  const activeWheels = roomLocal.wheels.filter((wheel) => wheel.active);
  for (const wheel of activeWheels) {
    const phase = roomLocal.phases.find((candidate) => candidate.key === wheel.encounterPhaseKey);
    if (phase?.rewardWheelKey !== wheel.key) {
      throw new StructuredWorkspaceProjectionContractError(
        `Ship wheel ${wheel.key} has no active declaration-owned encounter phase`,
      );
    }
  }
  const phaseIndexForKey = (phaseKey: string): number => {
    const index = roomLocal.phases.findIndex((phase) => phase.key === phaseKey);
    if (index < 0) {
      throw new StructuredWorkspaceProjectionContractError(
        `Ship timeline references unknown phase ${phaseKey}`,
      );
    }
    return index;
  };
  const wheelForNextPhase = (phaseIndex: number): WorkspaceRewardWheelDescriptor | undefined => {
    const nextPhase = roomLocal.phases[phaseIndex + 1];
    return nextPhase?.rewardWheelKey === undefined
      ? undefined
      : activeWheels.find((wheel) => wheel.key === nextPhase.rewardWheelKey);
  };
  const boundaryPhaseIndex = (boundary: WorkspaceRoomLifecycleBoundary): number => {
    switch (boundary.kind) {
      case 'roomEntered':
        return 0;
      case 'encounterStart':
      case 'encounterEnd':
        return phaseIndexForKey(boundary.phaseKey);
      case 'bossDefeated':
        return phaseIndexForKey(boundary.phaseKey);
      case 'nextPhase': {
        const targetIndex = roomLocal.phases.findIndex(
          (phase) => phase.rewardWheelKey === boundary.wheelKey,
        );
        return targetIndex <= 0 ? 0 : targetIndex - 1;
      }
      case 'cleanup':
        return roomLocal.phases.length - 1;
    }
  };
  const checkpointKeyForBoundary = (boundary: WorkspaceRoomLifecycleBoundary): string => {
    switch (boundary.kind) {
      case 'encounterEnd':
        return `combat:${boundary.phaseKey}`;
      case 'nextPhase':
        return `nextPhaseUsable:${boundary.wheelKey}`;
      default:
        return boundary.key;
    }
  };
  const actionByKey = new Map(roomActions?.rows.map((row) => [row.key, row]) ?? []);
  const phaseRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseOptionalRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseBoundaryEntries = roomLocal.phases.map(
    () => [] as Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }>[],
  );
  const phaseTimelineEntries = roomLocal.phases.map(
    () => [] as WorkspaceRoomLifecycleTimelineEntry[],
  );
  const phaseCheckpointEntries = roomLocal.phases.map(
    () => [] as WorkspaceRoomActions['checkpoints'][number][],
  );
  if (roomActions !== undefined) {
    let currentPhaseIndex = 0;
    for (const entry of roomActions.timeline.entries) {
      if (entry.kind === 'boundary') {
        const phaseIndex = boundaryPhaseIndex(entry.boundary);
        phaseBoundaryEntries[phaseIndex]!.push(entry);
        phaseTimelineEntries[phaseIndex]!.push(entry);
        if (entry.boundary.kind === 'encounterStart') currentPhaseIndex = phaseIndex;
        continue;
      }
      if (entry.kind === 'automaticEffect') {
        phaseTimelineEntries[phaseIndexForKey(entry.phaseKey)]!.push(entry);
        continue;
      }
      const row = actionByKey.get(entry.actionKey);
      if (row === undefined) continue;
      const phaseIndex =
        entry.phaseKey === undefined ? currentPhaseIndex : phaseIndexForKey(entry.phaseKey);
      phaseTimelineEntries[phaseIndex]!.push(entry);
      phaseRows[phaseIndex]!.push(row);
    }
    for (const checkpoint of roomActions.checkpoints) {
      if (checkpoint.key === 'exitUsable') continue;
      const matchingBoundary = roomActions.timeline.entries.find(
        (entry) =>
          entry.kind === 'boundary' && checkpointKeyForBoundary(entry.boundary) === checkpoint.key,
      );
      const phaseIndex =
        matchingBoundary?.kind === 'boundary'
          ? boundaryPhaseIndex(matchingBoundary.boundary)
          : roomLocal.phases.length - 1;
      phaseCheckpointEntries[phaseIndex]!.push(checkpoint);
    }
    for (const row of roomActions.optionalRows) {
      const phaseIndex = (() => {
        const window = row.window;
        if (window.kind === 'shipPostCombat') {
          return roomLocal.phases.findIndex((phase) => phase.rewardWheelKey === window.wheelKey);
        }
        if (window.kind === 'shipPreCombat') {
          const targetIndex = roomLocal.phases.findIndex(
            (phase) => phase.rewardWheelKey === window.wheelKey,
          );
          return Math.max(0, targetIndex - 1);
        }
        return roomLocal.phases.length - 1;
      })();
      if (phaseIndex < 0) {
        throw new StructuredWorkspaceProjectionContractError(
          `Ship optional action ${row.key} has no declaration-owned phase`,
        );
      }
      phaseOptionalRows[phaseIndex]!.push(row);
    }
  }
  const phases: WorkspaceShipPhasePresentation[] = roomLocal.phases.map((phase, index) => {
    const encounter = encounterPhases.find((candidate) => candidate.address.phaseKey === phase.key);
    const wheel = wheelForNextPhase(index);
    return Object.freeze({
      actionRows: Object.freeze(phaseRows[index]!),
      checkpoints: Object.freeze(phaseCheckpointEntries[index]!),
      ...(encounter === undefined ? {} : { encounter }),
      key: phase.key,
      label: phase.label,
      timeline: Object.freeze(phaseTimelineEntries[index]!),
      optionalRows: Object.freeze(phaseOptionalRows[index]!),
      ...(wheel === undefined ? {} : { wheel }),
    });
  });
  return Object.freeze({
    combatPhaseCount: roomLocal.combatPhaseCount,
    features,
    kind: 'ship' as const,
    phases: Object.freeze(phases),
    repairRows: Object.freeze(roomActions?.repairRows ?? []),
    ...(roomActions === undefined ? {} : { roomActions }),
  });
}

export function roomWorkbenchPresentation(
  encounterPhases: readonly WorkspaceEncounterPhase[],
  features: readonly WorkspaceRoomFeature[],
  roomLocal: WorkspaceRoomLocal,
  roomActions: WorkspaceRoomActions | undefined,
): WorkspaceRoomWorkbenchPresentation {
  const presented = presentedEncounterPhases(encounterPhases);
  switch (roomLocal.kind) {
    case 'fields':
      return Object.freeze({
        encounterPhases: presented,
        features,
        fields: roomLocal,
        kind: 'fields' as const,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
    case 'ship':
      return shipWorkbenchPresentation(presented, features, roomLocal, roomActions);
    case 'shop':
      return Object.freeze({
        features,
        kind: 'shop' as const,
        shop: roomLocal,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze({
        encounterPhases: presented,
        features,
        kind: 'standard' as const,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
  }
}
