import {
  routeRoomDeclaration,
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  roomActionKey,
} from '@run-planner/engine/authored-project';
import {
  type RoomLifecycleTimeline,
  type RoomActionRosterIssue,
} from '@run-planner/engine/simulation';
import { requireWorkspaceRoom as requireRoom } from './catalog-room';
import { phaseMarker, roomEventMarker } from '@planner/projections/roomEventNames';
import type { WorkspaceEncounterPhase, WorkspaceRoomLocal } from '../contracts/locals';
import type {
  WorkspaceRoomLifecycleBoundary,
  WorkspaceRoomLifecycleTimeline,
  WorkspaceRoomLifecycleTimelineEntry,
  WorkspaceNotReachedEntry,
  WorkspaceRoomActionRow,
  WorkspaceEncounterEvents,
  WorkspaceSteadyGrowthControl,
  WorkspaceTranscendentEmbryoControl,
} from '../contracts/timeline';
import { roomEnteredRunStateLauncher, runStateLauncher } from './occurrence-action-run-state';
import { nemesisFamilyLabel } from '../interactions/occurrence-interaction-binding';
import type { WorkspaceOccurrenceActionsInput } from './occurrence-action-row-projection';
import type { WorkspaceRunStateLauncher } from '../contracts/run-state';

function lifecycleBoundaryLabel(
  boundary: WorkspaceRoomLifecycleBoundary,
  mergedWithBegin: boolean,
  phaseLabel: string | undefined,
): string {
  switch (boundary.kind) {
    case 'encounterStarted':
      return mergedWithBegin ? roomEventMarker.encounterBegun : roomEventMarker.encounterStarted;
    // Wheels open names the phase whose combat its wheel starts.
    case 'wheelsOpen':
      return phaseMarker(roomEventMarker.wheelsOpen, phaseLabel);
    default:
      return roomEventMarker[boundary.kind];
  }
}

type NotReachedEntry = WorkspaceNotReachedEntry;

/** A banner's encounter events that hold an authored value, which never vanishes. */
function authoredBannerEvents(
  entry: WorkspaceRoomLifecycleTimelineEntry,
): Extract<NotReachedEntry, { readonly kind: 'events' }> | undefined {
  if (entry.kind !== 'boundary' || entry.supplement === undefined) return undefined;
  const supplement = entry.supplement;
  const phase = supplement.phase;
  if (phase === undefined) return undefined;
  // An outcome's fixed choices (a bet, an event result, a capture point) always hold a value.
  const authored =
    (supplement.start === true && phase.figLeaf?.selected === true) ||
    (supplement.choices.length > 0 &&
      (phase.aetos?.selectedWave !== undefined ||
        phase.gorgonCondition?.selected === true ||
        supplement.choices.some((choice) => choice !== 'aetos' && choice !== 'gorgonCondition')));
  return authored
    ? Object.freeze({
        kind: 'events' as const,
        key: `events:${entry.boundary.key}`,
        label: entry.label,
        phaseKey: phase.address.phaseKey,
        supplement,
      })
    : undefined;
}

/** One lifecycle entry's identity, shared by the engine's Timeline and its projection. */
function lifecycleEntryKey(
  entry: RoomLifecycleTimeline['entries'][number] | WorkspaceRoomLifecycleTimelineEntry,
): string | undefined {
  switch (entry.kind) {
    case 'boundary':
      return `boundary:${entry.boundary.key}`;
    case 'action':
      return `action:${'action' in entry ? entry.action.key : entry.actionKey}`;
    case 'automaticEffect':
      return `effect:${semanticAddressKey(entry.address)}`;
    case 'spawned':
      return undefined;
  }
}

/**
 * Splits a room's Timeline at the stop the engine publishes for it: the entries before its
 * stop are reached, and the stop's own entry too when the walk reached it. The blocking rows
 * stay at the stop for repair; the authored rows after it wait, without their banners, until
 * the walk reaches them.
 * Undefined while the walk passes through the room or stops only in its exit work.
 */
export function splitAtRoomStop(
  entries: readonly WorkspaceRoomLifecycleTimelineEntry[],
  lifecycleEntries: RoomLifecycleTimeline['entries'],
  input: Pick<WorkspaceOccurrenceActionsInput, 'blockingRowKeys' | 'roomStop'>,
):
  | {
      readonly reached: readonly WorkspaceRoomLifecycleTimelineEntry[];
      readonly notReached: readonly NotReachedEntry[];
      /** Present when the walk stops before the Timeline starts. */
      readonly waitsOn?: { readonly kind: 'overview' };
      readonly doorsWait?: true;
    }
  | undefined {
  const roomStop = input.roomStop;
  if (roomStop === undefined || roomStop.kind === 'exit') return undefined;
  const blocking = input.blockingRowKeys ?? new Set<string>();
  const stopIndex = roomStop.entryIndex;
  const unreached = new Set(
    lifecycleEntries.slice(stopIndex).flatMap((entry) => lifecycleEntryKey(entry) ?? []),
  );
  const isUnreached = (entry: WorkspaceRoomLifecycleTimelineEntry) => {
    const key = lifecycleEntryKey(entry);
    return key !== undefined && unreached.has(key);
  };
  const stop = entries.findIndex(isUnreached);
  // A stop at its entry reached it (a banner whose contact blocks, a blocking row), so that
  // entry stays as the stop to repair it there. Any other first unreached entry was not
  // reached, so the stop never claims it.
  const stopEntry = lifecycleEntries[stopIndex];
  const shown = entries[stop];
  const showsStopEntry =
    stopEntry !== undefined &&
    shown !== undefined &&
    lifecycleEntryKey(shown) === lifecycleEntryKey(stopEntry);
  const cut =
    stop < 0 ? entries.length : roomStop.at === 'entry' && showsStopEntry ? stop + 1 : stop;
  // Past the stop no banner stands for a row, so each row is its own.
  const asRow = (
    entry: Extract<NotReachedEntry, { readonly kind: 'action' }>,
  ): Extract<NotReachedEntry, { readonly kind: 'action' }> =>
    entry.kind === 'action' && entry.presentation !== 'row'
      ? Object.freeze({ ...entry, presentation: 'row' as const })
      : entry;
  // A room stopped in its Overview shows none of its Timeline, its saved rows included.
  const after = roomStop.kind === 'overview' ? [] : entries.slice(cut);
  return Object.freeze({
    reached: Object.freeze([
      ...entries.slice(0, cut),
      ...after.flatMap((entry) =>
        entry.kind === 'action' && blocking.has(entry.actionKey) ? [asRow(entry)] : [],
      ),
    ]),
    notReached: Object.freeze(
      after.flatMap((entry): NotReachedEntry[] => {
        if (entry.kind === 'action') return blocking.has(entry.actionKey) ? [] : [asRow(entry)];
        if (entry.kind === 'automaticEffect') return [entry];
        const events = authoredBannerEvents(entry);
        return events === undefined ? [] : [events];
      }),
    ),
    // A room stopped in its Overview has entered, but its Timeline waits on that repair.
    ...(roomStop.kind === 'overview'
      ? { waitsOn: Object.freeze({ kind: 'overview' as const }) }
      : {}),
    // Only a stop at the doors opening itself keeps the doors, to repair them there.
    ...(roomStop.at === 'entry' &&
    stopEntry?.kind === 'boundary' &&
    stopEntry.boundary.kind === 'doorsOpened'
      ? {}
      : { doorsWait: true as const }),
  });
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
      const roomLabel = routeRoomDeclaration(
        requireRoom(input.catalog, input.occurrence.gameName),
        input.biome.routeKey,
      ).label;
      return roomEnteredRunStateLauncher(
        input,
        createRoomRunStateCheckpointAddress(occurrence, { kind: 'roomEntered' }),
        roomLabel,
      );
    }
    if (boundary.kind === 'encounterStarted' && roomLocal.kind === 'ship') {
      const phase = roomLocal.phases.find((candidate) => candidate.key === boundary.phaseKey);
      return runStateLauncher(
        input,
        createRoomRunStateCheckpointAddress(occurrence, {
          kind: 'beforeEncounterStart',
          phaseKey: boundary.phaseKey,
        }),
        `${phase?.label ?? boundary.phaseKey} encounter`,
        `Before ${phase?.label ?? boundary.phaseKey}`,
      );
    }
    return undefined;
  };
  // Each cage's encounter markers name the cage whose Unlock row starts it.
  const cageByPhase = new Map(
    roomLocal.kind !== 'fields'
      ? []
      : roomLocal.cages.map(
          (cage, cageIndex) =>
            [
              cage.phaseKey,
              Object.freeze({
                label: `${cage.label} (${cage.summary})`,
                cage: cage.label,
                slot: cageIndex + 1,
              }),
            ] as const,
        ),
  );
  // The engine settles whether an encounter's begin shows as one marker with its Combat.
  const mergedPhaseKeys = new Set(
    timeline.entries.flatMap((entry) =>
      entry.kind === 'boundary' &&
      entry.boundary.kind === 'encounterBegun' &&
      entry.markers === 'merged'
        ? [entry.boundary.phaseKey]
        : [],
    ),
  );
  // A Ship phase's encounter begins as its wheels open, so its Wheels open stands for its begin.
  const wheelPhaseKeys = new Set(
    timeline.entries.flatMap((entry) =>
      entry.kind === 'boundary' && entry.boundary.kind === 'wheelsOpen'
        ? [entry.boundary.phaseKey]
        : [],
    ),
  );
  const beginHidden = (phaseKey: string) =>
    mergedPhaseKeys.has(phaseKey) || wheelPhaseKeys.has(phaseKey);
  const shown = (boundary: WorkspaceRoomLifecycleBoundary) =>
    boundary.kind !== 'encounterBegun' || !beginHidden(boundary.phaseKey);
  const beginsEncounter = (
    boundary: WorkspaceRoomLifecycleBoundary,
  ): boundary is Extract<
    WorkspaceRoomLifecycleBoundary,
    { readonly kind: 'encounterBegun' | 'encounterStarted' }
  > =>
    boundary.kind === 'encounterBegun' ||
    (boundary.kind === 'encounterStarted' && beginHidden(boundary.phaseKey));
  const phaseLabel = (boundary: WorkspaceRoomLifecycleBoundary) =>
    roomLocal.kind === 'ship' && boundary.kind === 'wheelsOpen'
      ? roomLocal.phases.find((phase) => phase.key === boundary.phaseKey)?.label
      : undefined;
  const cageOf = (boundary: WorkspaceRoomLifecycleBoundary) =>
    boundary.kind === 'encounterBegun' ||
    boundary.kind === 'encounterStarted' ||
    boundary.kind === 'encounterEnd'
      ? cageByPhase.get(boundary.phaseKey)
      : undefined;
  const encounterByPhase = new Map(
    encounterPhases.map((phase) => [phase.address.phaseKey, phase] as const),
  );
  // A marker names its phase role only beside another encounter's, and not when its
  // Fields cage already does; phases settled on entry have no marker of their own.
  const encounterMarkerCount = encounterPhases.filter(
    (phase) => phase.timelineAnchor === 'encounter',
  ).length;
  const identityLabel = (phase: WorkspaceEncounterPhase, cageNamed: boolean) => {
    const family = phase.nemesisEvent?.value?.kind;
    const encounter =
      family === undefined
        ? phase.selectedEncounter.label
        : `${phase.selectedEncounter.label} · ${nemesisFamilyLabel(family)}`;
    return encounterMarkerCount > 1 && !cageNamed ? `${phase.label} · ${encounter}` : encounter;
  };
  // How a fight went sits on its host, only where it lists a choice: the encounter's own
  // marker (the one naming it), its Combat, or her talk row.
  const choicesAtEncounter = new Map(
    (input.encounterOutcomes ?? []).flatMap((outcome) =>
      outcome.host.kind === 'encounter' ? [[outcome.phaseKey, outcome.choices] as const] : [],
    ),
  );
  const choicesAtCombat = new Map(
    (input.encounterOutcomes ?? []).flatMap((outcome) =>
      outcome.host.kind === 'combat' ? [[outcome.host.eventKey, outcome.choices] as const] : [],
    ),
  );
  const choicesAtAction = new Map(
    (input.encounterOutcomes ?? []).flatMap((outcome) =>
      outcome.host.kind === 'interaction'
        ? [[roomActionKey(outcome.host.action), outcome.choices] as const]
        : [],
    ),
  );
  const encounterEvents = (
    phase: WorkspaceEncounterPhase,
    events: Omit<WorkspaceEncounterEvents, 'phase'>,
  ): WorkspaceEncounterEvents | undefined =>
    events.identityLabel === undefined && events.start !== true && events.choices.length === 0
      ? undefined
      : Object.freeze({ phase, ...events, choices: Object.freeze(events.choices) });
  const supplementForBoundary = (
    boundary: WorkspaceRoomLifecycleBoundary,
  ): WorkspaceEncounterEvents | undefined => {
    switch (boundary.kind) {
      case 'roomEntered': {
        const phase = encounterPhases.find(
          (candidate) => candidate.timelineAnchor === 'roomEntered',
        );
        return phase === undefined
          ? undefined
          : encounterEvents(phase, { start: true, choices: [] });
      }
      // Its encounter is named where it begins, with the outcome the encounter hosts; its Fig
      // Leaf skip and the outcome its fight hosts sit at its Combat.
      case 'encounterBegun':
      case 'encounterStarted': {
        const phase = encounterByPhase.get(boundary.phaseKey);
        if (phase?.timelineAnchor !== 'encounter') return undefined;
        const combat = boundary.kind === 'encounterStarted';
        const begins = beginsEncounter(boundary);
        return encounterEvents(phase, {
          ...(begins
            ? { identityLabel: identityLabel(phase, cageByPhase.has(boundary.phaseKey)) }
            : {}),
          ...(combat ? { start: true as const } : {}),
          choices: [
            ...(begins ? (choicesAtEncounter.get(boundary.phaseKey) ?? []) : []),
            ...(combat ? (choicesAtCombat.get(boundary.key) ?? []) : []),
          ],
        });
      }
      // A wheel opens and is taken on its phase's Timeline, beside these boundaries; an
      // encounter's end announces what it spawns; a Boss defeat hosts its own content.
      case 'encounterEnd':
      case 'bossDefeated':
      case 'wheelsOpen':
      case 'doorsOpened':
        return undefined;
    }
  };
  const supplementForAction = (action: (typeof timeline.entries)[number]) => {
    if (action.kind !== 'action' || action.action.reference.kind !== 'interactEncounter')
      return undefined;
    const phase = encounterByPhase.get(action.action.reference.phaseKey);
    if (phase?.nemesisEvent === undefined) return undefined;
    const events = encounterEvents(phase, {
      choices: choicesAtAction.get(action.action.key) ?? [],
    });
    return Object.freeze({
      kind: 'nemesisInteraction' as const,
      owner: phase.nemesisEvent.owner,
      ...(events === undefined ? {} : { events }),
    });
  };
  const entries: WorkspaceRoomLifecycleTimelineEntry[] = [];
  const activeWheelKeys = new Set(
    roomLocal.kind === 'ship'
      ? roomLocal.wheels.filter((wheel) => wheel.active).map((wheel) => wheel.key)
      : [],
  );
  for (const entry of timeline.entries) {
    if (entry.kind === 'boundary') {
      const boundary = entry.boundary;
      if (!shown(boundary)) continue;
      const runState = launcherForBoundary(boundary);
      const cage = cageOf(boundary);
      const supplement = supplementForBoundary(boundary);
      entries.push(
        Object.freeze({
          kind: 'boundary' as const,
          boundary: boundary,
          label: lifecycleBoundaryLabel(
            boundary,
            boundary.kind === 'encounterStarted' && mergedPhaseKeys.has(boundary.phaseKey),
            phaseLabel(boundary),
          ),
          ...(beginsEncounter(boundary) ? { beginsEncounter: true as const } : {}),
          dropIndex: Math.max(0, entry.rank - (entry.placement === 'before' ? 1 : 0)),
          placement: entry.placement,
          rank: entry.rank,
          ...(runState === undefined ? {} : { runState }),
          ...(cage === undefined ? {} : { fieldsCage: cage }),
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
          entry.action.reference.kind === 'chooseRewardWheel' &&
          roomLocal.kind === 'ship' &&
          !rosterIssues.some((issue) => roomActionKey(issue.reference) === entry.action.key) &&
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
    boundaries: Object.freeze(
      timeline.boundaries.filter((boundary): boundary is WorkspaceRoomLifecycleBoundary =>
        shown(boundary),
      ),
    ),
    entries: Object.freeze(entries),
    doorsAfterRank: timeline.doorsAfterRank,
  });
}

export { projectRoomLifecycleTimeline };
