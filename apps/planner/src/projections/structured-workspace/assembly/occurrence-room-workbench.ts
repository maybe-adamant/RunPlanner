import { roomActionKey } from '@run-planner/engine/authored-project';
import { roomTabForPhase } from './occurrence-action-run-state';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceRoomWorkbenchPresentation,
  type WorkspaceShipPhasePresentation,
} from '../contract';
import type {
  WorkspaceEncounterPhase,
  WorkspaceRoomLocal,
  WorkspaceRewardWheelDescriptor,
} from '../contracts/locals';
import type {
  WorkspaceRoomActionRow,
  WorkspaceRoomActions,
  WorkspaceRoomLifecycleBoundary,
  WorkspaceRoomLifecycleTimelineEntry,
  WorkspaceTimelineWait,
} from '../contracts/timeline';
import type { WorkspaceRoomFeature } from '../contracts/features';
import type { WorkspaceRoomTab } from '../contracts/navigation';

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
  // Each tab is one fight, then the choice of what comes next: a phase's tab shows the
  // wheel the next phase's combat is chosen at, and the last its doors.
  const wheelForTab = (tabIndex: number): WorkspaceRewardWheelDescriptor | undefined => {
    const wheelKey =
      roomLocal.phases[tabIndex + 1]?.rewardWheelKey ??
      (tabIndex === 0 ? roomLocal.phases[0]?.rewardWheelKey : undefined);
    return wheelKey === undefined
      ? undefined
      : activeWheels.find((wheel) => wheel.key === wheelKey);
  };
  // A phase's tab ends at the row whose use starts the next phase's Combat (its wheel choice).
  const gatePhaseIndexByActionKey = new Map(
    (roomActions?.timeline.boundaries ?? []).flatMap((boundary) =>
      boundary.kind === 'encounterStarted' && boundary.trigger.kind === 'action'
        ? [[roomActionKey(boundary.trigger.action), phaseIndexForKey(boundary.phaseKey)] as const]
        : [],
    ),
  );
  // The tab shown before a phase's own: where its gate and the wheel it is chosen at stand.
  const precedingTab = (phaseIndex: number) => Math.max(0, phaseIndex - 1);
  const checkpointKeyForBoundary = (boundary: WorkspaceRoomLifecycleBoundary): string => {
    switch (boundary.kind) {
      case 'encounterEnd':
        return `combat:${boundary.phaseKey}`;
      default:
        return boundary.key;
    }
  };
  const actionByKey = new Map(roomActions?.rows.map((row) => [row.key, row]) ?? []);
  const phaseRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseUnplacedRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const repairRows: WorkspaceRoomActionRow[] = [];
  // A row off the Timeline has no engine phase: a gate and a wheel's reroll stand with the
  // wheel they use, and any other row with the last phase, where new actions are appended.
  const tabForUnrankedRow = (row: WorkspaceRoomActionRow): number => {
    const gated = gatePhaseIndexByActionKey.get(row.key);
    if (gated !== undefined) return precedingTab(gated);
    const reference = row.reference;
    if (reference.kind === 'reroll' && reference.target.kind === 'wheelOffer') {
      const wheelKey = reference.target.wheelKey;
      const tab = roomLocal.phases.findIndex((_, index) => wheelForTab(index)?.key === wheelKey);
      if (tab >= 0) return tab;
    }
    return roomLocal.phases.length - 1;
  };
  const phaseOptionalRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseTimelineEntries = roomLocal.phases.map(
    () => [] as WorkspaceRoomLifecycleTimelineEntry[],
  );
  const phaseNotReached = roomLocal.phases.map(
    () => [] as NonNullable<WorkspaceRoomActions['timeline']['notReached']>[number][],
  );
  const phaseCheckpointEntries = roomLocal.phases.map(
    () => [] as WorkspaceRoomActions['checkpoints'][number][],
  );
  const tabByBoundaryKey = new Map<string, number>();
  if (roomActions !== undefined) {
    // Entries keep the engine's order; a tab runs from its phase's Combat through the gate
    // that starts the next phase's Combat, and the Intro from the room's entry.
    let tabIndex = 0;
    for (const entry of roomActions.timeline.entries) {
      // A Combat whose gate is not on the Timeline starts its tab itself.
      if (entry.kind === 'boundary' && entry.boundary.kind === 'encounterStarted')
        tabIndex = Math.max(tabIndex, phaseIndexForKey(entry.boundary.phaseKey));
      if (entry.kind !== 'action') {
        phaseTimelineEntries[tabIndex]!.push(entry);
        if (entry.kind === 'boundary') tabByBoundaryKey.set(entry.boundary.key, tabIndex);
        continue;
      }
      const row = actionByKey.get(entry.actionKey);
      if (row === undefined) continue;
      phaseTimelineEntries[tabIndex]!.push(entry);
      phaseRows[tabIndex]!.push(row);
      const gated = gatePhaseIndexByActionKey.get(entry.actionKey);
      if (gated !== undefined) tabIndex = Math.max(tabIndex, gated);
    }
    // Rows past the stop keep the engine's order: a gate still closes its tab, and a Combat's
    // outcome events or end effects open their phase's.
    for (const entry of roomActions.timeline.notReached ?? []) {
      if (entry.kind !== 'action') tabIndex = Math.max(tabIndex, phaseIndexForKey(entry.phaseKey));
      phaseNotReached[tabIndex]!.push(entry);
      const gated =
        entry.kind === 'action' ? gatePhaseIndexByActionKey.get(entry.actionKey) : undefined;
      if (gated !== undefined) tabIndex = Math.max(tabIndex, gated);
    }
    for (const checkpoint of roomActions.checkpoints) {
      if (checkpoint.key === 'exitUsable') continue;
      const matchingBoundary = roomActions.timeline.entries.find(
        (entry) =>
          entry.kind === 'boundary' && checkpointKeyForBoundary(entry.boundary) === checkpoint.key,
      );
      const phaseIndex =
        matchingBoundary?.kind === 'boundary'
          ? (tabByBoundaryKey.get(matchingBoundary.boundary.key) ?? roomLocal.phases.length - 1)
          : roomLocal.phases.length - 1;
      phaseCheckpointEntries[phaseIndex]!.push(checkpoint);
    }
    for (const row of roomActions.optionalRows) {
      phaseOptionalRows[tabForUnrankedRow(row)]!.push(row);
    }
  }
  for (const row of roomActions?.repairRows ?? []) {
    if (!row.stale && row.rank === null) {
      phaseUnplacedRows[tabForUnrankedRow(row)]!.push(row);
    } else {
      repairRows.push(row);
    }
  }
  // A phase the stopped walk has not reached waits on the last phase it did reach.
  const stopped = roomActions?.timeline.notReached !== undefined;
  const waitsOn = (index: number): WorkspaceTimelineWait | undefined => {
    if (roomActions?.timeline.waitsOn !== undefined) return roomActions.timeline.waitsOn;
    if (!stopped || phaseTimelineEntries[index]!.length > 0) return undefined;
    const reached = phaseTimelineEntries.findLastIndex(
      (entries, earlier) => earlier < index && entries.length > 0,
    );
    return reached < 0
      ? undefined
      : Object.freeze({ kind: 'phase' as const, phaseLabel: roomLocal.phases[reached]!.label });
  };
  const phases: WorkspaceShipPhasePresentation[] = roomLocal.phases.map((phase, index) => {
    const phaseWaitsOn = waitsOn(index);
    const encounter = encounterPhases.find((candidate) => candidate.address.phaseKey === phase.key);
    const wheel = wheelForTab(index);
    return Object.freeze({
      tab: roomTabForPhase(roomLocal, phase.key),
      actionRows: Object.freeze(phaseRows[index]!),
      unplacedRows: Object.freeze(phaseUnplacedRows[index]!),
      checkpoints: Object.freeze(phaseCheckpointEntries[index]!),
      ...(encounter === undefined ? {} : { encounter }),
      key: phase.key,
      label: phase.label,
      timeline: Object.freeze(phaseTimelineEntries[index]!),
      ...(roomActions?.timeline.notReached === undefined
        ? {}
        : { notReached: Object.freeze(phaseNotReached[index]!) }),
      ...(phaseWaitsOn === undefined ? {} : { waitsOn: phaseWaitsOn }),
      optionalRows: Object.freeze(phaseOptionalRows[index]!),
      ...(index !== roomLocal.phases.length - 1 || roomActions?.objectEntries === undefined
        ? {}
        : { objectEntries: roomActions.objectEntries }),
      ...(wheel === undefined ? {} : { wheel }),
    });
  });
  return Object.freeze({
    combatPhaseCount: roomLocal.combatPhaseCount,
    features,
    kind: 'ship' as const,
    phases: Object.freeze(phases),
    repairRows: Object.freeze(repairRows),
    ...(roomActions === undefined ? {} : { roomActions }),
  });
}

export function roomWorkbenchPresentation(
  encounterPhases: readonly WorkspaceEncounterPhase[],
  features: readonly WorkspaceRoomFeature[],
  roomLocal: WorkspaceRoomLocal,
  roomActions: WorkspaceRoomActions | undefined,
): WorkspaceRoomWorkbenchPresentation {
  switch (roomLocal.kind) {
    case 'fields':
      return Object.freeze({
        encounterPhases,
        features,
        fields: roomLocal,
        kind: 'fields' as const,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
    case 'ship':
      return shipWorkbenchPresentation(encounterPhases, features, roomLocal, roomActions);
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
        encounterPhases,
        features,
        kind: 'standard' as const,
        ...(roomActions === undefined ? {} : { roomActions }),
      });
  }
}

/** The Timeline tab holding the room's Doors open and exit rows: a Ship's last phase. */
export function workspaceDoorsTimelineTab(
  workbench: WorkspaceRoomWorkbenchPresentation,
): WorkspaceRoomTab {
  if (workbench.kind !== 'ship') return 'actions';
  const last = workbench.phases.at(-1);
  if (last === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      'A Ship room has no phase to open its doors',
    );
  }
  return last.tab;
}
