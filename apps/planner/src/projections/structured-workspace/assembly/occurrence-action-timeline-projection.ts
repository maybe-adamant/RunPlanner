import {
  routeRoomDeclaration,
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import type { RoomLifecycleTimeline, RoomActionRosterIssue } from '@run-planner/engine/simulation';
import { requireWorkspaceRoom as requireRoom } from './catalog-room';
import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceEncounterPhase, WorkspaceRoomLocal } from '../contracts/locals';
import type {
  WorkspaceRoomLifecycleBoundary,
  WorkspaceRoomLifecycleTimeline,
  WorkspaceRoomLifecycleTimelineEntry,
  WorkspaceRoomActionRow,
  WorkspaceSteadyGrowthControl,
  WorkspaceTranscendentEmbryoControl,
} from '../contracts/timeline';
import { runStateLauncher } from './occurrence-action-run-state';
import { nemesisFamilyLabel } from '../interactions/occurrence-interaction-binding';
import type { WorkspaceOccurrenceActionsInput } from './occurrence-action-row-projection';
import type { WorkspaceRunStateLauncher } from '../contracts/run-state';

function lifecycleBoundaryLabel(boundary: WorkspaceRoomLifecycleBoundary): string {
  switch (boundary.kind) {
    case 'roomEntered':
      return 'Room entered';
    case 'encounterStart':
      return 'Start encounter';
    case 'encounterEnd':
      return 'Encounter ended';
    case 'bossDefeated':
      return 'Boss defeated';
    case 'nextPhase':
      return 'Next encounter available';
    case 'cleanup':
      return 'Doors open';
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
  rosterIssues: readonly RoomActionRosterIssue[],
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  rows: readonly WorkspaceRoomActionRow[],
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
        `the first action in ${
          routeRoomDeclaration(
            requireRoom(input.catalog, input.occurrence.gameName),
            input.biome.routeKey,
          ).label
        }`,
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
  const room = requireRoom(input.catalog, input.occurrence.gameName);
  const envelope = input.catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  const cageOrderState = input.evaluatedRoom?.fieldsCageOrder;
  const cageLabels =
    roomLocal.kind !== 'fields'
      ? new Map<string, string>()
      : new Map(
          roomLocal.cages.map((cage) => {
            const phase = envelope?.slots.find(
              (slot) =>
                slot.rewardAttachment?.kind === 'localReward' &&
                slot.rewardAttachment.slotKey === cage.key,
            );
            if (phase === undefined) {
              throw new StructuredWorkspaceProjectionContractError(
                `${cage.key} has no Fields cage encounter slot`,
              );
            }
            return [phase.key, `${cage.label} (${cage.summary})`] as const;
          }),
        );
  const cageChoices = (cageOrderState?.activePhaseKeys ?? []).map((phaseKey) => {
    const label = cageLabels.get(phaseKey);
    if (label === undefined) {
      throw new StructuredWorkspaceProjectionContractError(`${phaseKey} has no Fields cage label`);
    }
    return Object.freeze({ phaseKey, label });
  });
  const cageLabelByBoundaryKey = new Map(
    timeline.entries
      .flatMap((entry) =>
        entry.kind === 'boundary' && entry.boundary.kind === 'encounterStart'
          ? [entry.boundary]
          : [],
      )
      .flatMap((boundary, index) => {
        const choice = cageChoices.find((candidate) => candidate.phaseKey === boundary.phaseKey);
        const selected = rows.find(
          (row) =>
            row.reference.kind === 'completeFieldsCage' &&
            row.reference.phaseKey === boundary.phaseKey &&
            !row.stale,
        );
        if (choice === undefined || selected === undefined) return [];
        return [
          [
            boundary.key,
            Object.freeze({
              label: choice.label,
              owner:
                selected.address as import('@run-planner/engine/authored-project').RoomActionAddress,
              slotOrdinal: index + 1,
              phaseKey: boundary.phaseKey,
            }),
          ] as const,
        ];
      }),
  );
  const representedCagePhases = new Set(
    [...cageLabelByBoundaryKey.values()].map((slot) => slot.phaseKey),
  );
  const encounterByPhase = new Map(
    encounterPhases.map((phase) => [phase.address.phaseKey, phase] as const),
  );
  // A multi-phase banner names its phase unless its Fields cage already does.
  const encounterSupplement = (phase: WorkspaceEncounterPhase, cageNamed: boolean) => {
    const family = phase.nemesisEvent?.value?.kind;
    const encounter =
      family === undefined
        ? phase.selectedEncounter.label
        : `${phase.selectedEncounter.label} · ${nemesisFamilyLabel(family)}`;
    return Object.freeze({
      kind: 'encounter' as const,
      phase,
      identityLabel:
        encounterPhases.length > 1 && !cageNamed ? `${phase.label} · ${encounter}` : encounter,
    });
  };
  const supplementForBoundary = (boundary: WorkspaceRoomLifecycleBoundary) => {
    if (boundary.kind === 'roomEntered') {
      const phase = encounterPhases.find((candidate) => candidate.timelineAnchor === 'roomEntered');
      return phase === undefined ? undefined : encounterSupplement(phase, false);
    }
    if (boundary.kind === 'encounterStart') {
      const phase = encounterByPhase.get(boundary.phaseKey);
      return phase?.timelineAnchor === 'encounterStart'
        ? encounterSupplement(phase, cageLabelByBoundaryKey.has(boundary.key))
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
    return phase?.nemesisEvent === undefined
      ? undefined
      : Object.freeze({ kind: 'nemesisInteraction' as const, owner: phase.nemesisEvent.owner });
  };
  const entries: WorkspaceRoomLifecycleTimelineEntry[] = [];
  const activeWheelKeys = new Set(
    roomLocal.kind === 'ship'
      ? roomLocal.wheels.filter((wheel) => wheel.active).map((wheel) => wheel.key)
      : [],
  );
  for (const entry of timeline.entries) {
    if (entry.kind === 'boundary') {
      const runState = launcherForBoundary(entry.boundary);
      const fieldsCage = cageLabelByBoundaryKey.get(entry.boundary.key);
      const supplement = supplementForBoundary(entry.boundary);
      entries.push(
        Object.freeze({
          kind: 'boundary' as const,
          boundary: entry.boundary,
          label:
            fieldsCage === undefined
              ? lifecycleBoundaryLabel(entry.boundary)
              : `Start encounter ${fieldsCage.slotOrdinal}`,
          checkpointKey: lifecycleBoundaryCheckpointKey(entry.boundary),
          dropIndex: Math.max(0, entry.rank - (entry.placement === 'before' ? 1 : 0)),
          placement: entry.placement,
          rank: entry.rank,
          ...(runState === undefined ? {} : { runState }),
          ...(fieldsCage === undefined
            ? {}
            : {
                fieldsCage: Object.freeze({
                  label: fieldsCage.label,
                  owner: fieldsCage.owner,
                }),
              }),
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
            : entry.action.reference.kind === 'chooseRewardWheel' &&
                roomLocal.kind === 'ship' &&
                !rosterIssues.some(
                  (issue) => roomActionKey(issue.reference) === entry.action.key,
                ) &&
                activeWheelKeys.has(entry.action.reference.wheelKey)
              ? ('rewardWheelAnchor' as const)
              : ('row' as const),
        rank: entry.rank,
        ...(entry.phaseKey === undefined ? {} : { phaseKey: entry.phaseKey }),
        ...(supplement === undefined ? {} : { supplement }),
      }),
    );
  }
  return Object.freeze({
    ...(cageOrderState === undefined || cageChoices.length === 0
      ? {}
      : {
          fieldsCageOrder: Object.freeze({
            choices: Object.freeze(cageChoices),
            phaseKeys: cageOrderState.phaseKeys,
            ...(cageOrderState.available
              ? {}
              : { unavailableReason: 'Restore missing cage actions before changing their order.' }),
          }),
        }),
    boundaries: Object.freeze([...timeline.boundaries]),
    entries: Object.freeze(entries),
    suppressedCheckpointKeys: Object.freeze([
      'exitUsable',
      ...entries.flatMap((entry) => (entry.kind === 'boundary' ? [entry.checkpointKey] : [])),
    ]),
  });
}

export { projectRoomLifecycleTimeline };
