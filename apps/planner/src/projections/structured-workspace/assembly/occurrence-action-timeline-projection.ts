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
  WorkspaceNotReachedEntry,
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
      return 'Encounter started';
    case 'encounterOutcome':
      return 'Encounter outcome';
    case 'encounterEnd':
      return 'Encounter ended';
    case 'bossDefeated':
      return 'Boss defeated';
    case 'nextPhase':
      return 'Next phase ready';
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
    supplement.kind === 'encounterStart'
      ? phase.figLeaf?.selected === true
      : phase.aetos?.selectedWave !== undefined ||
        phase.gorgonCondition?.selected === true ||
        supplement.choices.some((choice) => choice !== 'aetos' && choice !== 'gorgonCondition');
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
      readonly waitsOn?: string;
      readonly doorsWait?: true;
    }
  | undefined {
  const roomStop = input.roomStop;
  if (roomStop === undefined || roomStop.kind === 'exit') return undefined;
  const blocking = input.blockingRowKeys ?? new Set<string>();
  const unreached = new Set(
    lifecycleEntries.slice(roomStop.entryIndex).flatMap((entry) => lifecycleEntryKey(entry) ?? []),
  );
  const isUnreached = (entry: WorkspaceRoomLifecycleTimelineEntry) => {
    const key = lifecycleEntryKey(entry);
    return key !== undefined && unreached.has(key);
  };
  const stop = entries.findIndex(isUnreached);
  // A stop at its entry reached it (a banner whose contact blocks, a blocking row), so that
  // entry stays as the stop to repair it there. Any other first unreached entry was not
  // reached, so the stop never claims it.
  const stopEntry = lifecycleEntries[roomStop.entryIndex];
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
  const after = entries.slice(cut);
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
    ...(roomStop.kind === 'overview' ? { waitsOn: 'the Overview' } : {}),
    // Only a stop at the doors opening itself keeps the doors, to repair them there.
    ...(roomStop.at === 'entry' &&
    stopEntry?.kind === 'boundary' &&
    stopEntry.boundary.kind === 'cleanup'
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
      return runStateLauncher(
        input,
        createRoomRunStateCheckpointAddress(occurrence, { kind: 'roomEntered' }),
        `the first action in ${roomLabel}`,
        `Before ${roomLabel}`,
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
        `Before ${phase?.label ?? boundary.phaseKey}`,
      );
    }
    return undefined;
  };
  const room = requireRoom(input.catalog, input.occurrence.gameName);
  const envelope = input.catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  const cageOrderState = input.evaluatedRoom?.fieldsCageOrder;
  const cageLabels =
    roomLocal.kind !== 'fields'
      ? new Map<
          string,
          {
            readonly name: string;
            readonly slot: number;
            readonly full: string;
            readonly offer: import('@run-planner/engine/reward-kernel').ResolvedRewardOffer | null;
          }
        >()
      : new Map(
          roomLocal.cages.map((cage, cageIndex) => {
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
            return [
              phase.key,
              {
                name: cage.label,
                slot: cageIndex + 1,
                full: `${cage.label} (${cage.summary})`,
                offer: cage.control.rerolledOffer ?? cage.control.offer,
              },
            ] as const;
          }),
        );
  const cageChoices = (cageOrderState?.activePhaseKeys ?? []).map((phaseKey) => {
    const label = cageLabels.get(phaseKey);
    if (label === undefined) {
      throw new StructuredWorkspaceProjectionContractError(`${phaseKey} has no Fields cage label`);
    }
    // The combat order names its cages; the encounter banner adds each cage's reward.
    return Object.freeze({
      phaseKey,
      label: label.name,
      slot: label.slot,
      bannerLabel: label.full,
      offer: label.offer,
    });
  });
  const cageLabelByBoundaryKey = new Map(
    timeline.entries
      .flatMap((entry) =>
        entry.kind === 'boundary' && entry.boundary.kind === 'encounterStart'
          ? [entry.boundary]
          : [],
      )
      // Cages number among themselves; a Passive Nemesis event's start is not a cage.
      .flatMap((boundary) => {
        const choice = cageChoices.find((candidate) => candidate.phaseKey === boundary.phaseKey);
        return choice === undefined ? [] : [{ boundary, choice }];
      })
      .flatMap(({ boundary, choice }) => {
        const selected = rows.find(
          (row) =>
            row.reference.kind === 'completeFieldsCage' &&
            row.reference.phaseKey === boundary.phaseKey &&
            !row.stale,
        );
        if (selected === undefined) return [];
        return [
          [
            boundary.key,
            Object.freeze({
              label: choice.bannerLabel,
              // The banner shows the cage as a tag with its reward's icon.
              cage: choice.label,
              cageSlot: choice.slot,
              ...(choice.offer === null ? {} : { offer: choice.offer }),
              // A cage action with an ordering issue is its own row, which owns its navigation.
              ...(rosterIssues.some((issue) => roomActionKey(issue.reference) === selected.key)
                ? {}
                : {
                    owner:
                      selected.address as import('@run-planner/engine/authored-project').RoomActionAddress,
                  }),
              phaseKey: boundary.phaseKey,
            }),
          ] as const,
        ];
      }),
  );
  // A Fields cage's end banner carries its cage's slot, as its start banner does.
  const endedCage = (boundary: WorkspaceRoomLifecycleBoundary) =>
    boundary.kind !== 'encounterEnd'
      ? undefined
      : [...cageLabelByBoundaryKey.values()].find((slot) => slot.phaseKey === boundary.phaseKey);
  const representedCagePhases = new Set(
    [...cageLabelByBoundaryKey.values()].flatMap((slot) =>
      slot.owner === undefined ? [] : [slot.phaseKey],
    ),
  );
  const encounterByPhase = new Map(
    encounterPhases.map((phase) => [phase.address.phaseKey, phase] as const),
  );
  // A banner names its phase role only beside another start banner, and not when its
  // Fields cage already does; phases settled on entry have no start banner of their own.
  const startBannerCount = encounterPhases.filter(
    (phase) => phase.timelineAnchor === 'encounterStart',
  ).length;
  const encounterStartSupplement = (phase: WorkspaceEncounterPhase, cageNamed: boolean) => {
    const family = phase.nemesisEvent?.value?.kind;
    const encounter =
      family === undefined
        ? phase.selectedEncounter.label
        : `${phase.selectedEncounter.label} · ${nemesisFamilyLabel(family)}`;
    // Only a definitional encounter start names its identity; one settled on entry does not.
    return Object.freeze({
      kind: 'encounterStart' as const,
      phase,
      ...(phase.timelineAnchor === 'encounterStart'
        ? {
            identityLabel:
              startBannerCount > 1 && !cageNamed ? `${phase.label} · ${encounter}` : encounter,
          }
        : {}),
    });
  };
  // How a fight ended sits on its outcome, shown only where the engine lists a choice for it.
  const outcomeChoices = new Map(
    (input.encounterOutcomes ?? []).map((outcome) => [outcome.phaseKey, outcome.choices] as const),
  );
  const encounterOutcomeSupplement = (phaseKey: string) => {
    const phase = encounterByPhase.get(phaseKey);
    // A free item ends Nemesis's event with nothing to choose.
    const choices = outcomeChoices
      .get(phaseKey)
      ?.filter(
        (choice) =>
          choice !== 'nemesisEvent' ||
          (phase?.nemesisEvent?.value != null && phase.nemesisEvent.value.kind !== 'freeItem'),
      );
    return phase === undefined || choices === undefined || choices.length === 0
      ? undefined
      : Object.freeze({
          kind: 'encounterOutcome' as const,
          phase,
          choices: Object.freeze(choices),
        });
  };
  const supplementForBoundary = (boundary: WorkspaceRoomLifecycleBoundary) => {
    switch (boundary.kind) {
      case 'roomEntered': {
        const phase = encounterPhases.find(
          (candidate) => candidate.timelineAnchor === 'roomEntered',
        );
        return phase === undefined ? undefined : encounterStartSupplement(phase, false);
      }
      case 'encounterStart': {
        const phase = encounterByPhase.get(boundary.phaseKey);
        return phase?.timelineAnchor === 'encounterStart'
          ? encounterStartSupplement(phase, cageLabelByBoundaryKey.has(boundary.key))
          : undefined;
      }
      case 'encounterOutcome':
        return encounterOutcomeSupplement(boundary.phaseKey);
      // A wheel opens and is taken on its phase's Timeline, beside these boundaries; an
      // encounter's end announces what it spawns; a Boss defeat hosts its own content.
      case 'encounterEnd':
      case 'bossDefeated':
      case 'nextPhase':
      case 'cleanup':
        return undefined;
    }
  };
  const supplementForAction = (action: (typeof timeline.entries)[number]) => {
    if (action.kind !== 'action' || action.action.reference.kind !== 'interactEncounter')
      return undefined;
    const phase = encounterByPhase.get(action.action.reference.phaseKey);
    return phase?.nemesisEvent === undefined
      ? undefined
      : Object.freeze({
          kind: 'nemesisInteraction' as const,
          owner: phase.nemesisEvent.owner,
        });
  };
  const entries: WorkspaceRoomLifecycleTimelineEntry[] = [];
  const activeWheelKeys = new Set(
    roomLocal.kind === 'ship'
      ? roomLocal.wheels.filter((wheel) => wheel.active).map((wheel) => wheel.key)
      : [],
  );
  // An outcome with no choice to host passes without an event of its own.
  const hostsOutcome = (boundary: RoomLifecycleTimeline['boundaries'][number]) =>
    boundary.kind !== 'encounterOutcome' ||
    encounterOutcomeSupplement(boundary.phaseKey) !== undefined;
  for (const entry of timeline.entries) {
    if (entry.kind === 'boundary') {
      const boundary = entry.boundary;
      if (!hostsOutcome(boundary)) continue;
      const runState = launcherForBoundary(boundary);
      const startedCage = cageLabelByBoundaryKey.get(boundary.key);
      const endCage = endedCage(boundary);
      const supplement = supplementForBoundary(boundary);
      entries.push(
        Object.freeze({
          kind: 'boundary' as const,
          boundary: boundary,
          label: lifecycleBoundaryLabel(boundary),
          checkpointKey: lifecycleBoundaryCheckpointKey(boundary),
          dropIndex: Math.max(0, entry.rank - (entry.placement === 'before' ? 1 : 0)),
          placement: entry.placement,
          rank: entry.rank,
          ...(runState === undefined ? {} : { runState }),
          ...(startedCage === undefined
            ? endCage === undefined
              ? {}
              : {
                  // The end banner names its cage; the start banner owns the cage's navigation.
                  fieldsCage: Object.freeze({
                    label: endCage.label,
                    cage: endCage.cage,
                    slot: endCage.cageSlot,
                  }),
                }
            : {
                fieldsCage: Object.freeze({
                  label: startedCage.label,
                  cage: startedCage.cage,
                  slot: startedCage.cageSlot,
                  ...(startedCage.offer === undefined ? {} : { offer: startedCage.offer }),
                  ...(startedCage.owner === undefined ? {} : { owner: startedCage.owner }),
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
            choices: Object.freeze(
              cageChoices.map(({ phaseKey, label, slot, bannerLabel, offer }) =>
                Object.freeze({
                  phaseKey,
                  label,
                  slot,
                  fullLabel: bannerLabel,
                  ...(offer === null ? {} : { offer }),
                }),
              ),
            ),
            phaseKeys: cageOrderState.phaseKeys,
            ...(cageOrderState.available
              ? {}
              : { unavailableReason: 'Restore missing cage actions before changing their order.' }),
          }),
        }),
    boundaries: Object.freeze(
      timeline.boundaries.filter((boundary): boundary is WorkspaceRoomLifecycleBoundary =>
        hostsOutcome(boundary),
      ),
    ),
    entries: Object.freeze(entries),
    suppressedCheckpointKeys: Object.freeze([
      'exitUsable',
      ...entries.flatMap((entry) => (entry.kind !== 'boundary' ? [] : [entry.checkpointKey])),
    ]),
  });
}

export { projectRoomLifecycleTimeline };
