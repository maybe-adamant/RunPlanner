import {
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { RoomLifecycleTimeline } from '@run-planner/engine/simulation';
import { requireWorkspaceRoom as requireRoom } from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceEncounterPhase,
  type WorkspaceRoomActionProposal,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimeline,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceRoomLocal,
  type WorkspaceRoomActionRow,
  type WorkspaceRunStateLauncher,
  type WorkspaceSteadyGrowthControl,
  type WorkspaceTranscendentEmbryoControl,
} from '../contract';
import { runStateLauncher } from './occurrence-action-run-state';
import type { WorkspaceOccurrenceActionsInput } from './occurrence-action-row-projection';

function lifecycleBoundaryLabel(boundary: WorkspaceRoomLifecycleBoundary): string {
  switch (boundary.kind) {
    case 'roomEntered':
      return 'Room entered';
    case 'encounterStart':
      return 'Start encounter';
    case 'encounterEnd':
      return 'End encounter';
    case 'bossDefeated':
      return 'Boss defeated';
    case 'nextPhase':
      return 'Start next phase';
    case 'cleanup':
      return 'Cleanup · Doors open';
  }
}

function lifecycleBoundaryCheckpointKey(boundary: WorkspaceRoomLifecycleBoundary): string {
  switch (boundary.kind) {
    case 'encounterEnd':
      return `combat:${boundary.phaseKey}`;
    case 'nextPhase':
      return `nextPhaseUsable:${boundary.wheelKey}`;
    default:
      return boundary.key;
  }
}
function projectRoomLifecycleTimeline(
  input: WorkspaceOccurrenceActionsInput,
  timeline: RoomLifecycleTimeline,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  rows: readonly WorkspaceRoomActionRow[],
  proposals: readonly WorkspaceRoomActionProposal[],
  steadyGrowth: readonly WorkspaceSteadyGrowthControl[],
  transcendentEmbryo: readonly WorkspaceTranscendentEmbryoControl[],
): WorkspaceRoomLifecycleTimeline {
  const occurrence = createOccurrenceAddress(input.biome, input.occurrence.occurrenceId);
  const launcherForBoundary = (
    boundary: WorkspaceRoomLifecycleBoundary,
  ): WorkspaceRunStateLauncher | undefined => {
    if (boundary.kind === 'roomEntered' && roomLocal.kind !== 'ship') {
      return runStateLauncher(
        input,
        createRoomRunStateCheckpointAddress(occurrence, { kind: 'roomEntered' }),
        `the first action in ${requireRoom(input.catalog, input.occurrence.gameName).label}`,
      );
    }
    if (boundary.kind === 'encounterStart' && roomLocal.kind === 'ship') {
      const phase = roomLocal.phases.find((candidate) => candidate.key === boundary.phaseKey);
      return runStateLauncher(
        input,
        createRoomRunStateCheckpointAddress(occurrence, {
          kind: 'beforeEncounterStart',
          phaseKey: boundary.phaseKey,
        }),
        `${phase?.label ?? boundary.phaseKey} encounter`,
      );
    }
    return undefined;
  };
  const timelineActionKeys = new Set(
    timeline.entries.flatMap((entry) => (entry.kind === 'action' ? [entry.action.key] : [])),
  );
  const activeCageRows =
    roomLocal.kind !== 'fields'
      ? []
      : rows
          .filter(
            (row) =>
              row.reference.kind === 'completeFieldsCage' &&
              row.rank !== null &&
              !row.stale &&
              timelineActionKeys.has(row.key),
          )
          .sort((left, right) => left.rank! - right.rank!);
  const activeCageByPhase = new Map(
    activeCageRows.map((row) => [
      row.reference.kind === 'completeFieldsCage' ? row.reference.phaseKey : '',
      row,
    ]),
  );
  const cageChoiceRows = [...activeCageRows].sort((left, right) => {
    const phaseIndex = (row: WorkspaceRoomActionRow): number => {
      if (row.reference.kind !== 'completeFieldsCage') return Number.POSITIVE_INFINITY;
      const phaseKey = row.reference.phaseKey;
      return encounterPhases.findIndex((phase) => phase.address.phaseKey === phaseKey);
    };
    return phaseIndex(left) - phaseIndex(right);
  });
  const cageSlotByBoundaryKey = new Map(
    timeline.entries
      .flatMap((entry) =>
        entry.kind === 'boundary' && entry.boundary.kind === 'encounterStart'
          ? [entry.boundary]
          : [],
      )
      .flatMap((boundary, index) => {
        const selected = activeCageByPhase.get(boundary.phaseKey);
        if (selected === undefined || selected.rank === null) return [];
        const choices = cageChoiceRows.map((row) => {
          if (row.reference.kind !== 'completeFieldsCage') {
            throw new StructuredWorkspaceProjectionContractError(
              `${row.key} is not a Fields cage-completion anchor`,
            );
          }
          const phaseKey = row.reference.phaseKey;
          const selectedChoice = row.key === selected.key;
          const proposal = selectedChoice
            ? undefined
            : proposals.find(
                (candidate) =>
                  candidate.kind === 'move' &&
                  roomActionKey(candidate.reference) === row.key &&
                  candidate.toIndex === selected.rank! - 1,
              );
          if (!selectedChoice && proposal === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${row.key} cannot be projected into Fields encounter slot ${index + 1}`,
            );
          }
          return Object.freeze({
            label:
              encounterPhases.find((phase) => phase.address.phaseKey === phaseKey)?.label ??
              phaseKey,
            ...(proposal === undefined ? {} : { proposalKey: proposal.key }),
            value: phaseKey,
          });
        });
        return [
          [
            boundary.key,
            Object.freeze({
              choices: Object.freeze(choices),
              marker: selected.marker,
              owner:
                selected.address as import('@run-planner/engine/authored-project').RoomActionAddress,
              selected: boundary.phaseKey,
              slotOrdinal: index + 1,
            }),
          ] as const,
        ];
      }),
  );
  const representedCagePhases = new Set(
    [...cageSlotByBoundaryKey.values()].map((slot) => slot.selected),
  );
  const encounterByPhase = new Map(
    encounterPhases.map((phase) => [phase.address.phaseKey, phase] as const),
  );
  const supplementForBoundary = (boundary: WorkspaceRoomLifecycleBoundary) => {
    if (boundary.kind === 'roomEntered') {
      const phase = encounterPhases.find((candidate) => candidate.timelineAnchor === 'roomEntered');
      return phase === undefined ? undefined : Object.freeze({ kind: 'encounter' as const, phase });
    }
    if (boundary.kind === 'encounterStart') {
      const phase = encounterByPhase.get(boundary.phaseKey);
      return phase?.timelineAnchor === 'encounterStart'
        ? Object.freeze({ kind: 'encounter' as const, phase })
        : undefined;
    }
    if (boundary.kind === 'nextPhase' && roomLocal.kind === 'ship') {
      const wheel = roomLocal.wheels.find((candidate) => candidate.key === boundary.wheelKey);
      return wheel === undefined
        ? undefined
        : Object.freeze({ kind: 'rewardWheel' as const, wheel });
    }
    return undefined;
  };
  const supplementForAction = (action: (typeof timeline.entries)[number]) => {
    if (action.kind !== 'action' || action.action.reference.kind !== 'interactEncounter')
      return undefined;
    const phase = encounterByPhase.get(action.action.reference.phaseKey);
    return phase?.timelineAnchor === 'action'
      ? Object.freeze({ kind: 'encounter' as const, phase })
      : undefined;
  };
  const entries: WorkspaceRoomLifecycleTimelineEntry[] = [];
  for (const entry of timeline.entries) {
    if (entry.kind === 'boundary') {
      const runState = launcherForBoundary(entry.boundary);
      const fieldsCageSlot = cageSlotByBoundaryKey.get(entry.boundary.key);
      const supplement = supplementForBoundary(entry.boundary);
      entries.push(
        Object.freeze({
          kind: 'boundary' as const,
          boundary: entry.boundary,
          label:
            fieldsCageSlot === undefined
              ? lifecycleBoundaryLabel(entry.boundary)
              : `Start encounter ${fieldsCageSlot.slotOrdinal}`,
          checkpointKey: lifecycleBoundaryCheckpointKey(entry.boundary),
          dropIndex: Math.max(0, entry.rank - (entry.placement === 'before' ? 1 : 0)),
          placement: entry.placement,
          rank: entry.rank,
          ...(runState === undefined ? {} : { runState }),
          ...(fieldsCageSlot === undefined ? {} : { fieldsCageSlot }),
          ...(supplement === undefined ? {} : { supplement }),
        }),
      );
      continue;
    }
    if (entry.kind === 'automaticEffect') {
      if (entry.effect === 'steadyGrowth') {
        const control = steadyGrowth.find(
          (candidate) =>
            semanticAddressKey(candidate.address) === semanticAddressKey(entry.address),
        );
        if (control === undefined) continue;
        entries.push(
          Object.freeze({
            kind: 'automaticEffect' as const,
            effect: 'steadyGrowth' as const,
            address: control.address,
            phaseKey: control.phaseKey,
            rank: entry.rank,
          }),
        );
      } else {
        const control = transcendentEmbryo.find(
          (candidate) =>
            semanticAddressKey(candidate.address) === semanticAddressKey(entry.address),
        );
        if (control === undefined) continue;
        entries.push(
          Object.freeze({
            kind: 'automaticEffect' as const,
            effect: 'transcendentEmbryo' as const,
            address: control.address,
            phaseKey: control.phaseKey,
            rank: entry.rank,
          }),
        );
      }
      continue;
    }
    const supplement = supplementForAction(entry);
    entries.push(
      Object.freeze({
        kind: 'action' as const,
        actionKey: entry.action.key,
        presentation:
          entry.action.reference.kind === 'completeFieldsCage' &&
          representedCagePhases.has(entry.action.reference.phaseKey)
            ? ('fieldsCageAnchor' as const)
            : ('row' as const),
        rank: entry.rank,
        ...(entry.phaseKey === undefined ? {} : { phaseKey: entry.phaseKey }),
        ...(supplement === undefined ? {} : { supplement }),
      }),
    );
  }
  return Object.freeze({
    boundaries: Object.freeze([...timeline.boundaries]),
    entries: Object.freeze(entries),
    suppressedCheckpointKeys: Object.freeze([
      'exitUsable',
      ...entries.flatMap((entry) => (entry.kind === 'boundary' ? [entry.checkpointKey] : [])),
    ]),
  });
}

export { projectRoomLifecycleTimeline };
