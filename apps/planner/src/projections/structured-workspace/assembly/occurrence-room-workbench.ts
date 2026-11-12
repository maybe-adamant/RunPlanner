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
  const actionByKey = new Map(roomActions?.rows.map((row) => [row.key, row]) ?? []);
  const phaseRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseUnplacedRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const repairRows: WorkspaceRoomActionRow[] = [];
  // A row off the Timeline sits on its engine phase's tab, but a row a wheel's choice waits
  // on stands with the fight before it, as its gate does.
  const phaseIndexOrLast = (phaseKey: string | undefined): number => {
    const index =
      phaseKey === undefined ? -1 : roomLocal.phases.findIndex((phase) => phase.key === phaseKey);
    return index < 0 ? roomLocal.phases.length - 1 : index;
  };
  const tabForUnrankedRow = (row: WorkspaceRoomActionRow): number => {
    const timing = row.timing;
    switch (timing.kind) {
      case 'afterEncounterEnd':
        return phaseIndexOrLast(timing.phaseKey);
      case 'beforeWheelPhase':
      case 'beforeWheelChoice':
        return timing.phaseKey === undefined
          ? roomLocal.phases.length - 1
          : precedingTab(phaseIndexOrLast(timing.phaseKey));
      case 'afterWheelPhase':
      case 'beforeCombat':
      case 'afterCombat':
      case 'fields':
      case 'afterDoorsOpen':
        return phaseIndexOrLast(row.phaseKey);
    }
  };
  const phaseOptionalRows = roomLocal.phases.map(() => [] as WorkspaceRoomActionRow[]);
  const phaseTimelineEntries = roomLocal.phases.map(
    () => [] as WorkspaceRoomLifecycleTimelineEntry[],
  );
  const phaseNotReached = roomLocal.phases.map(
    () => [] as NonNullable<WorkspaceRoomActions['timeline']['notReached']>[number][],
  );
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
        continue;
      }
      const row = actionByKey.get(entry.actionKey);
      if (row === undefined) continue;
      phaseTimelineEntries[tabIndex]!.push(entry);
      phaseRows[tabIndex]!.push(row);
      const gated = gatePhaseIndexByActionKey.get(entry.actionKey);
      if (gated !== undefined) tabIndex = Math.max(tabIndex, gated);
    }
    // Rows past the stop sit as rows off the Timeline do; a banner's events and an end effect
    // with their phase.
    for (const entry of roomActions.timeline.notReached ?? []) {
      const row = entry.kind === 'action' ? actionByKey.get(entry.actionKey) : undefined;
      phaseNotReached[
        entry.kind !== 'action'
          ? phaseIndexOrLast(entry.phaseKey)
          : row === undefined
            ? roomLocal.phases.length - 1
            : tabForUnrankedRow(row)
      ]!.push(entry);
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
