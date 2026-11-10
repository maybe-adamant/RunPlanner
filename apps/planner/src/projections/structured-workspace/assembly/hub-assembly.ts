import {
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubRoomAddress,
  createHubRunStateCheckpointAddress,
  createHubFountainAddress,
  createExitDecisionAddress,
  createHubOpenSetAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createLocalVisitDecisionAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  hubFountainPrecedingVisitCount,
  hubDecisionHandoffReadiness,
  hubStayRows,
  hubVisitSlotKeys,
  routeRoomDeclaration,
  semanticAddressKey,
  selectedExitTarget,
  type BiomeAddress,
  type BiomeTopology,
  type ExitDecision,
  type HubAction,
  type HubDecision,
  type HubDecisionAddress,
  type HubStayRow,
  type HubStayRows,
  type LocalVisitDecision,
  type LocalVisitOrderAddress,
  type OccurrenceId,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog, HubDecisionDescriptor } from '@run-planner/engine/catalog-schema';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubDecision,
  CanonicalLocalVisitRoom,
} from '@run-planner/engine/simulation';
import { summarizeRewardOffer } from '@planner/projections/rewards/rewardOfferSummary';

import { requireWorkspaceRoom } from './catalog-room';
import { candidateRoomIcon } from '../presentation/room-icon';
import {
  StructuredWorkspaceProjectionContractError,
  workspaceLocalVisitLeaveKey,
  type WorkspaceRoomPickerControl,
  type WorkspaceRoomSummary,
} from '../contract';
import type { WorkspaceLocalVisitLeave, WorkspaceLocalVisitLeaveOption } from '../contracts/locals';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type {
  WorkspaceHubInteractionRequirement,
  WorkspaceOccurrenceInteractionRequirement,
} from '../interactions/interaction-requirements';
import {
  workspaceHubMainRewardAcquisitionMarkers,
  workspaceHubMainRewardMarkers,
} from '../navigation/marker-ownership';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import type { WorkspaceOccurrenceAssembler } from './occurrence-assembly';
import {
  projectFountainRarityControl,
  type WorkspaceOccurrenceActionsInput,
} from './occurrence-action-row-projection';
import type { WorkspaceBiomeSource } from '../source-index';
import { roomEnteredRunStateLauncher } from './occurrence-action-run-state';
import { projectWorkspaceDoorContract } from './door-contract';
import { assembleHubStayRerolls, workspaceRerolledDoor } from './reroll-assembly';
import type {
  WorkspaceDoorContract,
  WorkspaceHubDecisionNode,
  WorkspaceHubFountain,
  WorkspaceHubRowMove,
  WorkspaceHubStay,
  WorkspaceHubStayRow,
  WorkspaceHubStayRowReference,
  WorkspaceOccurrenceWorkbenchNode,
} from '../contracts/structure';
import type { WorkspaceMarker } from '../contracts/navigation';

/**
 * The Hub board owns its slots, visits, room-local workbenches, and the
 * associated authored interaction package. It does not own the mutable
 * biome-level collection maps or inspect other semantic families.
 */
export interface WorkspaceHubAssembly {
  readonly hubInteractionRequirements: readonly WorkspaceHubInteractionRequirement[];
  readonly node: WorkspaceHubDecisionNode;
  readonly occurrenceInteractionRequirements: readonly WorkspaceOccurrenceInteractionRequirement[];
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
}

interface WorkspaceHubAssemblyBaseInput {
  readonly assembleOccurrence: WorkspaceOccurrenceAssembler;
  readonly biome: BiomeAddress;
  readonly catalog: Catalog;
  /** The frontier-derived create capability for the fixed completed-Hub exit. */
  readonly descriptor: HubDecisionDescriptor;
  readonly fountainRarityAssessment?: WorkspaceOccurrenceActionsInput['fountainRarityAssessment'];
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly nextVisitIndex?: number;
  readonly topology: BiomeTopology | null;
  readonly source?: WorkspaceBiomeSource;
}

/** An authored Hub board and its optional evaluator overlay. */
export type WorkspaceHubAssemblyInput = WorkspaceHubAssemblyBaseInput & {
  readonly evaluated?: CanonicalHubDecision;
  readonly hub: HubDecision;
};

interface ProjectedHubTarget {
  readonly canonical?: CanonicalAuthoredRoom;
  readonly localSlots?: readonly CanonicalLocalVisitRoom[];
  readonly occurrenceId: OccurrenceId;
}

/**
 * The main room's exits in visit order: picking a side room at one replaces
 * that visit and keeps the later ones; picking the Hub ends the visits there.
 */
function localVisitLeaves(
  order: LocalVisitOrderAddress,
  visitOrder: readonly OccurrenceId[],
  slots: readonly {
    readonly key: string;
    readonly generation: string;
    readonly occurrenceId: OccurrenceId;
    readonly planEnd?: { readonly relation?: string };
  }[],
): readonly WorkspaceLocalVisitLeave[] {
  const generated = slots.filter((slot) => slot.generation === 'generated');
  // The side visit the plan ends in: its return and every later exit lie past the end.
  const endingVisit = visitOrder.findIndex(
    (occurrenceId) =>
      slots.find((slot) => slot.occurrenceId === occurrenceId)?.planEnd?.relation === 'end',
  );
  return Object.freeze(
    Array.from({ length: visitOrder.length + 1 }, (_, index) => {
      const selected = visitOrder[index];
      const options: WorkspaceLocalVisitLeaveOption[] = [
        Object.freeze({
          key: 'hub',
          proposedOccurrenceIds: Object.freeze(visitOrder.slice(0, index)),
        }),
        ...generated.map((slot) =>
          Object.freeze({
            key: slot.key,
            occurrenceId: slot.occurrenceId,
            proposedOccurrenceIds: Object.freeze([
              ...visitOrder.slice(0, index),
              slot.occurrenceId,
              ...visitOrder.slice(index + 1),
            ]),
          }),
        ),
      ];
      const selectedKey =
        selected === undefined ? 'hub' : slots.find((slot) => slot.occurrenceId === selected)?.key;
      if (selectedKey === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(order)} visits a room outside its side slots`,
        );
      return Object.freeze({
        position: index + 1,
        interactionKey: workspaceLocalVisitLeaveKey(order, index + 1),
        options: Object.freeze(options),
        selectedKey,
        pastPlanEnd: endingVisit >= 0 && index > endingVisit + 1,
        returnPastPlanEnd: endingVisit >= 0 && index >= endingVisit,
      });
    }),
  );
}

function hubOccurrenceMap(
  topology: BiomeTopology | null,
): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(
    (topology?.occurrences ?? []).map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
}

/** Hub main offers navigate to the Hub board and mark their reward control there. */
function redirectHubMainRewardFocus(
  markerDestinations: WorkspaceMarkerDestinationEmitter,
  hub: WorkspaceMarker,
  mainReward: WorkspaceMarker,
): void {
  markerDestinations.redirectTo(mainReward, hub, `hub:${hub.focusKey}`, mainReward);
}

/** The Hub's actions with the action at `from` moved to stand before index `to` of the original. */
function movedAction(actions: readonly HubAction[], from: number, to: number) {
  const moved = actions[from]!;
  const without = actions.filter((_, index) => index !== from);
  const at = to > from ? to - 1 : to;
  return Object.freeze([...without.slice(0, at), moved, ...without.slice(at)]);
}

function stayRowReference(
  rows: readonly HubStayRow[],
  row: HubStayRow,
): WorkspaceHubStayRowReference {
  return row.kind === 'useFountain'
    ? Object.freeze({ kind: 'fountain' as const })
    : Object.freeze({
        kind: 'reroll' as const,
        position: rows.filter((candidate) => candidate.kind === 'reroll').indexOf(row) + 1,
      });
}

/**
 * Every place one stay row can move to within its stay, and, for the
 * fountain, the end of each other stay its authored visits reach.
 */
function stayRowMoves(
  actions: readonly HubAction[],
  stays: readonly HubStayRows[],
  stay: HubStayRows,
  row: HubStayRow,
): readonly WorkspaceHubRowMove[] {
  const moves: WorkspaceHubRowMove[] = [];
  const position = stay.rows.indexOf(row);
  stay.rows.forEach((other, index) => {
    if (index === position || index === position + 1) return;
    moves.push(
      Object.freeze({
        key: `before:${other.actionIndex}`,
        destination: Object.freeze({
          kind: 'before' as const,
          row: stayRowReference(stay.rows, other),
        }),
        actions: movedAction(actions, row.actionIndex, other.actionIndex),
      }),
    );
  });
  const last = stay.rows.at(-1)!;
  if (last !== row)
    moves.push(
      Object.freeze({
        key: 'end',
        destination: Object.freeze({
          kind: 'after' as const,
          row: stayRowReference(stay.rows, last),
        }),
        actions: movedAction(actions, row.actionIndex, stay.appendIndex),
      }),
    );
  if (row.kind === 'useFountain')
    for (const other of stays)
      if (other !== stay)
        moves.push(
          Object.freeze({
            key: `stay:${other.precedingVisitCount}`,
            destination: Object.freeze({
              kind: 'stay' as const,
              precedingVisitCount: other.precedingVisitCount,
            }),
            actions: movedAction(actions, row.actionIndex, other.appendIndex),
          }),
        );
  return Object.freeze(moves);
}

function projectHubNode(
  input: WorkspaceHubAssemblyInput,
  owner: HubDecisionAddress,
  targets: ReadonlyMap<string, ProjectedHubTarget>,
  hub: HubDecision,
): WorkspaceHubAssembly {
  const { biome, catalog, descriptor, markerDestinations, topology } = input;
  const visitOrder = hubVisitSlotKeys(hub);
  const readiness = hubDecisionHandoffReadiness(descriptor, hub);
  const hubMarker = markerDestinations.marker(owner);
  const occurrences = hubOccurrenceMap(topology);
  const hubInteractionRequirements: WorkspaceHubInteractionRequirement[] = [];
  const slotRequirements: WorkspaceHubInteractionRequirement['slots'][number][] = [];
  const occurrenceInteractionRequirements: WorkspaceOccurrenceInteractionRequirement[] = [];
  const roomControls: WorkspaceRoomPickerControl[] = [];
  const rewardControls: WorkspaceRewardControl[] = [];
  const workbenches: WorkspaceOccurrenceWorkbenchNode[] = [];
  const doorsBySlot = new Map<string, WorkspaceDoorContract>();
  const source = input.source;
  const settledStays = source?.hubStays(owner);
  const drawPositions = new Map(
    (source?.hubBoardDrawPositions(owner) ?? []).flatMap((slot) =>
      slot.open ? [[slot.hubSlotKey, slot.drawPosition] as const] : [],
    ),
  );
  const authoredStays = hubStayRows(owner, hub);
  const roomsBySlot = new Map<string, WorkspaceRoomSummary>();
  const projectLocalVisit = (
    sourceOccurrence: RoomOccurrence,
    target: ProjectedHubTarget,
    detailsActive: boolean,
    parentWorkbenchKey: string,
  ) => {
    const sourceRoom = requireWorkspaceRoom(catalog, sourceOccurrence.gameName);
    const group = sourceRoom.localChildren.find((child) => child.kind === 'fixedRoomSlots');
    const localDecisions = (topology?.decisions ?? []).filter(
      (candidate): candidate is LocalVisitDecision =>
        candidate.kind === 'localVisit' &&
        candidate.sourceOccurrenceId === sourceOccurrence.occurrenceId,
    );
    if (group === undefined) {
      if (localDecisions.length > 0) {
        throw new StructuredWorkspaceProjectionContractError(
          `${sourceRoom.gameName} has authored local visits without a fixed-room declaration`,
        );
      }
      return undefined;
    }
    const decision = localDecisions.find((candidate) => candidate.groupKey === group.key);
    if (decision === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${sourceRoom.gameName} is missing its ${group.key} local-visit decision`,
      );
    }
    if (localDecisions.length !== 1) {
      throw new StructuredWorkspaceProjectionContractError(
        `${sourceRoom.gameName} has conflicting local-visit decisions`,
      );
    }
    if (!detailsActive) return undefined;
    const owner = createLocalVisitDecisionAddress(biome, sourceOccurrence.occurrenceId, group.key);
    const order = createLocalVisitOrderAddress(biome, sourceOccurrence.occurrenceId, group.key);
    const canonicalByOccurrence = new Map(
      (target.localSlots ?? []).map((local) => [local.occurrenceId, local] as const),
    );
    const slots = [...group.slots]
      .sort((left, right) => left.availabilityRank - right.availabilityRank)
      .map((slot) => {
        const targetReference = decision.targetsBySlot[slot.slotKey];
        if (targetReference === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(owner)} is missing local slot ${slot.slotKey}`,
          );
        }
        const localOccurrence = occurrences.get(targetReference.occurrenceId);
        if (localOccurrence === undefined || localOccurrence.gameName !== slot.roomGameName) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(owner)} local slot ${slot.slotKey} has no matching occurrence`,
          );
        }
        const address = createLocalVisitSlotAddress(
          biome,
          sourceOccurrence.occurrenceId,
          group.key,
          slot.slotKey,
        );
        const evaluatedRoom = canonicalByOccurrence.get(localOccurrence.occurrenceId);
        canonicalByOccurrence.delete(localOccurrence.occurrenceId);
        if (
          evaluatedRoom !== undefined &&
          (semanticAddressKey(evaluatedRoom.localVisit.origin) !== semanticAddressKey(address) ||
            evaluatedRoom.localVisit.generation !== targetReference.generation ||
            evaluatedRoom.gameName !== localOccurrence.gameName)
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(address)} evaluated local room does not match authored topology`,
          );
        }
        const enteredOrdinal = decision.visitOrder.indexOf(localOccurrence.occurrenceId);
        const room = routeRoomDeclaration(
          requireWorkspaceRoom(catalog, localOccurrence.gameName),
          address.routeKey,
        );
        const descriptor = {
          address,
          availabilityRank: slot.availabilityRank,
          entered: enteredOrdinal >= 0,
          enteredOrdinal: enteredOrdinal < 0 ? null : enteredOrdinal + 1,
          gameName: slot.roomGameName,
          key: slot.slotKey,
          label: room.label,
          roomIcon: candidateRoomIcon(catalog, address.biomeKey, room),
          marker: markerDestinations.marker(address),
          occurrenceId: localOccurrence.occurrenceId,
          physicalDoorId: slot.physicalDoorId,
        };
        if (targetReference.generation === 'notGenerated') {
          return Object.freeze({ ...descriptor, generation: 'notGenerated' as const });
        }
        const occurrenceAssembly = input.assembleOccurrence(
          Object.freeze({
            ...(evaluatedRoom === undefined ? {} : { evaluatedRoom }),
            occurrence: localOccurrence,
          }),
        );
        occurrenceInteractionRequirements.push(
          ...occurrenceAssembly.occurrenceInteractionRequirements,
        );
        roomControls.push(...occurrenceAssembly.roomControls);
        rewardControls.push(...occurrenceAssembly.rewardControls);
        const door = projectWorkspaceDoorContract(occurrenceAssembly.node.room, 'visible');
        const workbench = Object.freeze({
          ...occurrenceAssembly.node,
          incomingDoor: door,
          inspectorPresentation: 'doorTarget' as const,
          railMarker: descriptor.marker,
          railVisibility: 'inspectorOnly' as const,
          hubReturn: Object.freeze({
            kind: 'room' as const,
            room: createOccurrenceAddress(biome, sourceOccurrence.occurrenceId),
            label: routeRoomDeclaration(sourceRoom, biome.routeKey).label,
          }),
        });
        const sideRewardMarkers = workspaceHubMainRewardMarkers(workbench.room);
        markerDestinations.redirect(sideRewardMarkers, parentWorkbenchKey);
        markerDestinations.setRoomTab(sideRewardMarkers, 'overview');
        markerDestinations.setRoomTab([workbench.room.marker], 'overview');
        markerDestinations.setRoomTab(
          workspaceHubMainRewardAcquisitionMarkers(workbench.room),
          'actions',
        );
        workbenches.push(workbench);
        return Object.freeze({
          ...descriptor,
          door,
          generation: 'generated' as const,
          room: workbench.room,
          ...(workbench.planEnd === undefined ? {} : { planEnd: workbench.planEnd }),
        });
      });
    if (canonicalByOccurrence.size > 0) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} has evaluated local rooms outside its authored slots`,
      );
    }
    const leaves = localVisitLeaves(order, decision.visitOrder, slots);
    occurrenceInteractionRequirements.push(
      Object.freeze({
        kind: 'localVisits' as const,
        generationChoices: Object.freeze([
          Object.freeze({ label: 'Generated', value: 'generated' as const }),
          Object.freeze({ label: 'Not generated', value: 'notGenerated' as const }),
        ]),
        owner,
        order,
        slots: Object.freeze(
          slots.map((slot) =>
            Object.freeze({
              address: slot.address,
              generation: slot.generation,
              entered: slot.entered,
            }),
          ),
        ),
        leaves,
      }),
    );
    return Object.freeze({
      address: owner,
      marker: markerDestinations.marker(owner),
      order,
      orderMarker: markerDestinations.marker(order),
      slots: Object.freeze(slots),
      visitOrder: Object.freeze([...decision.visitOrder]),
      leaves,
    });
  };
  const hubMapDoors = requireWorkspaceRoom(catalog, descriptor.terminal.roomGameName).mapPoints
    ?.exitDoors;
  const slots = descriptor.slots.map((slot) => {
    const slotRoom = requireWorkspaceRoom(catalog, slot.roomGameName);
    const mapDoor = hubMapDoors?.find((door) => door.id === slot.physicalDoorId);
    const localSlotKeys = Object.freeze(
      slotRoom.localChildren
        .filter((child) => child.kind === 'fixedRoomSlots')
        .flatMap((group) => group.slots.map((local) => local.slotKey)),
    );
    const target = targets.get(slot.slotKey);
    const occurrence = target === undefined ? undefined : occurrences.get(target.occurrenceId);
    const address = createHubSlotAddress(biome, descriptor.hubKey, slot.slotKey);
    const close =
      target !== undefined
        ? Object.freeze({
            command: Object.freeze({ kind: 'CloseHubSlot' as const, slot: address }),
          })
        : undefined;
    const slotMarker = markerDestinations.marker(address);
    const occurrenceAssembly =
      occurrence === undefined
        ? undefined
        : input.assembleOccurrence(
            Object.freeze({
              ...(target?.canonical === undefined ? {} : { evaluatedRoom: target.canonical }),
              occurrence,
            }),
          );
    const occurrenceNode = occurrenceAssembly?.node;
    const detailsActive = occurrenceNode?.room.detailsActive ?? false;
    const localVisit =
      occurrence === undefined || target === undefined
        ? undefined
        : projectLocalVisit(occurrence, target, detailsActive, occurrenceNode!.key);
    // A board door reads its first draw and what its rerolls left for its visit.
    const onward = settledStays?.offeredOnward.find((entry) => entry.hubSlotKey === slot.slotKey);
    const boardDoor =
      occurrenceNode === undefined
        ? undefined
        : projectWorkspaceDoorContract(occurrenceNode.room, 'visible');
    const door =
      boardDoor === undefined
        ? undefined
        : source === undefined
          ? boardDoor
          : workspaceRerolledDoor(
              catalog,
              source,
              (rewardOwner) =>
                onward === undefined ||
                semanticAddressKey(onward.owner) !== semanticAddressKey(rewardOwner)
                  ? undefined
                  : Object.freeze({
                      enabled:
                        settledStays?.stays.find(
                          (entry) => entry.precedingVisitCount === onward.precedingVisitCount,
                        )?.settlement.enabled === true,
                      ...(onward.changed ? { rerolled: onward.current } : {}),
                    }),
              boardDoor,
            );
    if (occurrenceNode !== undefined) {
      occurrenceInteractionRequirements.push(
        ...occurrenceAssembly!.occurrenceInteractionRequirements,
      );
      roomControls.push(...occurrenceAssembly!.roomControls);
      rewardControls.push(...occurrenceAssembly!.rewardControls);
      const workbench = Object.freeze({
        ...occurrenceNode,
        incomingDoor: door!,
        inspectorPresentation: 'hubRoomLocal' as const,
        ...(localVisit === undefined ? {} : { localVisit }),
        railMarker: slotMarker,
        railVisibility: 'inspectorOnly' as const,
        ...(visitOrder.includes(slot.slotKey)
          ? {
              hubReturn: Object.freeze({
                kind: 'hub' as const,
                hub: owner,
                visitIndex: visitOrder.indexOf(slot.slotKey) + 1,
              }),
            }
          : {}),
      });
      workbenches.push(workbench);
      doorsBySlot.set(slot.slotKey, door!);
      roomsBySlot.set(slot.slotKey, workbench.room);
      if (localVisit !== undefined) {
        markerDestinations.redirect(
          localVisit.slots.flatMap((localSlot) =>
            localSlot.generation !== 'generated' ||
            localSlot.door.offerRewardSurface.visibility !== 'visible'
              ? []
              : localSlot.door.offerRewardSurface.rewards.map((reward) => reward.marker),
          ),
          workbench.key,
        );
      }
      const mainRewards = workspaceHubMainRewardMarkers(workbench.room);
      for (const mainReward of mainRewards) {
        redirectHubMainRewardFocus(markerDestinations, hubMarker, mainReward);
      }
      // A kept pick its rerolls no longer match is repaired on its visit, in Timeline;
      // Overview shows only the first draw.
      const repaired = new Set(
        door!.offerRewardSurface.rewards.flatMap((reward) =>
          reward.rerolledRewardRepair === undefined
            ? []
            : [semanticAddressKey(reward.marker.address)],
        ),
      );
      markerDestinations.setHubTab(
        mainRewards.filter((marker) => !repaired.has(semanticAddressKey(marker.address))),
        'overview',
      );
      markerDestinations.setHubTab(
        mainRewards.filter((marker) => repaired.has(semanticAddressKey(marker.address))),
        'timeline',
      );
      const mainRewardAcquisition = workspaceHubMainRewardAcquisitionMarkers(workbench.room);
      markerDestinations.redirect(mainRewardAcquisition, workbench.key);
      markerDestinations.setRoomTab(mainRewardAcquisition, 'actions');
    }
    slotRequirements.push(
      target === undefined
        ? Object.freeze({
            choices: Object.freeze([
              Object.freeze({ label: 'Closed', value: false }),
              Object.freeze({ label: 'Open', value: true }),
            ]),
            localSlotKeys,
            owner: address,
            selected: false as const,
          })
        : Object.freeze({
            choices: Object.freeze([
              Object.freeze({ label: 'Closed', value: false }),
              Object.freeze({ label: 'Open', value: true }),
            ]),
            ...(close === undefined ? {} : { close }),
            openedOccurrenceId: target.occurrenceId,
            owner: address,
            selected: true as const,
          }),
    );
    return Object.freeze({
      // Closing is structurally blocked by authored traversal membership, not
      // by whether the evaluator happened to enter the room. An invalid or
      // blocked authored visit must stay visibly unclosable until the user
      // moves it out of the exact visit order.
      canClose: target !== undefined && !visitOrder.includes(slot.slotKey),
      canOpen: target === undefined && targets.size < descriptor.openCount.max,
      gameName: slot.roomGameName,
      hubSlotKey: slot.slotKey,
      label: slotRoom.label,
      marker: slotMarker,
      ...(localVisit === undefined ? {} : { localVisit }),
      open: target !== undefined,
      physicalDoorId: slot.physicalDoorId,
      ...(mapDoor === undefined
        ? {}
        : { mapDoor: Object.freeze({ id: mapDoor.id, x: mapDoor.x, y: mapDoor.y }) }),
      ...(target === undefined || !drawPositions.has(slot.slotKey)
        ? {}
        : { drawPosition: drawPositions.get(slot.slotKey)! }),
      ...(door === undefined ? {} : { door }),
      ...(boardDoor === undefined ? {} : { boardDoor }),
      ...(occurrenceNode === undefined ? {} : { room: occurrenceNode.room }),
      roomKind: slotRoom.kind,
      visited: detailsActive,
    });
  });
  // Positions count the visits and the fountain use the map shows, not rerolls.
  const mapActions = hub.actions.filter((action) => action.kind !== 'reroll');
  const visitActionPositions = mapActions.flatMap((action, index) =>
    action.kind === 'roomVisit' ? [index + 1] : [],
  );
  const visits = Array.from({ length: descriptor.requiredVisits }, (_, index) => {
    const visitIndex = index + 1;
    const hubSlotKey = visitOrder[index];
    const actionPosition = visitActionPositions[index];
    const authoring =
      hubSlotKey !== undefined
        ? ('authored' as const)
        : input.nextVisitIndex === visitIndex
          ? ('next' as const)
          : ('locked' as const);
    return Object.freeze({
      authoring,
      marker: markerDestinations.marker(
        createHubVisitAddress(biome, descriptor.hubKey, visitIndex),
      ),
      ...(hubSlotKey === undefined ? {} : { hubSlotKey }),
      ...(hubSlotKey === undefined || doorsBySlot.get(hubSlotKey) === undefined
        ? {}
        : { door: doorsBySlot.get(hubSlotKey)! }),
      ...(hubSlotKey === undefined || roomsBySlot.get(hubSlotKey) === undefined
        ? {}
        : { room: roomsBySlot.get(hubSlotKey)! }),
      ...(actionPosition === undefined ? {} : { actionPosition }),
      visitIndex,
    });
  });
  const runState =
    input.source === undefined
      ? undefined
      : roomEnteredRunStateLauncher(
          { catalog, runState: input.source.runState },
          createHubRunStateCheckpointAddress(createHubRoomAddress(biome, descriptor.hubKey)),
          routeRoomDeclaration(
            requireWorkspaceRoom(catalog, descriptor.terminal.roomGameName),
            biome.routeKey,
          ).label,
        );
  const completedExitRoom = requireWorkspaceRoom(catalog, descriptor.completedExit.roomGameName);
  const completedExitOwner = createExitDecisionAddress(biome, {
    decisionKey: descriptor.hubKey,
    kind: 'hubDecision',
  });
  const completedExitDecision = input.topology?.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.source.kind === 'hubDecision' &&
      decision.source.decisionKey === descriptor.hubKey,
  );
  const completedExitTarget =
    completedExitDecision === undefined ? undefined : selectedExitTarget(completedExitDecision);
  if (completedExitTarget === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(completedExitOwner)} has no completed-Hub Preboss`,
    );
  }
  const completedExit = Object.freeze({
    marker: markerDestinations.marker(completedExitOwner),
    target: Object.freeze({
      gameName: descriptor.completedExit.roomGameName,
      label: completedExitRoom.label,
      roomIcon: candidateRoomIcon(catalog, biome.biomeKey, completedExitRoom),
      marker: markerDestinations.marker(
        createOccurrenceAddress(biome, completedExitTarget.occurrenceId),
      ),
    }),
  });
  const fountainAddress = createHubFountainAddress(biome, descriptor.hubKey);
  const fountainOutcome = createFountainRarityOutcomeAddress(fountainAddress);
  const fountainIndex = mapActions.findIndex((action) => action.kind === 'useFountain');
  const fountainPrecedingVisits = hubFountainPrecedingVisitCount(hub);
  // The preceding occurrence always exists, including before the first visit.
  const hostOccurrenceId =
    fountainPrecedingVisits === undefined
      ? undefined
      : fountainPrecedingVisits > 0
        ? (() => {
            const slotKey = visitOrder[fountainPrecedingVisits - 1];
            return slotKey === undefined ? undefined : targets.get(slotKey)?.occurrenceId;
          })()
        : hub.source.occurrenceId;
  const hostOccurrence =
    hostOccurrenceId === undefined ? undefined : occurrences.get(hostOccurrenceId);
  if (fountainPrecedingVisits !== undefined && hostOccurrence === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      'Hub fountain has no preceding occurrence',
    );
  }
  const rarity =
    fountainPrecedingVisits === undefined
      ? undefined
      : projectFountainRarityControl(
          fountainOutcome,
          hub.fountainRarityResult?.targetTraitKey,
          input.fountainRarityAssessment,
          input.source?.fountainRarityOutcome,
          markerDestinations,
        );
  const fountain: WorkspaceHubFountain = Object.freeze({
    address: fountainAddress,
    hub: owner,
    marker: markerDestinations.marker(fountainAddress),
    ...(fountainIndex < 0 ? {} : { actionPosition: fountainIndex + 1 }),
    ...(fountainIndex < 0
      ? {
          useIn: Object.freeze(
            authoredStays.map((stay) =>
              Object.freeze({
                key: `stay:${stay.precedingVisitCount}`,
                destination: Object.freeze({
                  kind: 'stay' as const,
                  precedingVisitCount: stay.precedingVisitCount,
                }),
                actions: Object.freeze([
                  ...hub.actions.slice(0, stay.appendIndex),
                  Object.freeze({ kind: 'useFountain' as const }),
                  ...hub.actions.slice(stay.appendIndex),
                ]),
              }),
            ),
          ),
        }
      : {}),
    outcomeMarker: markerDestinations.marker(fountainOutcome),
    ...(rarity === undefined ? {} : { rarity }),
    ...(hostOccurrence === undefined
      ? {}
      : {
          controlsHost: Object.freeze({
            kind: 'room' as const,
            label: routeRoomDeclaration(
              requireWorkspaceRoom(catalog, hostOccurrence.gameName),
              biome.routeKey,
            ).label,
            occurrenceId: hostOccurrence.occurrenceId,
          }),
        }),
  });
  const nodeKey = `hub:${semanticAddressKey(owner)}`;
  const openSlots = new Map(
    slots.flatMap((slot) =>
      slot.open
        ? [
            [
              slot.hubSlotKey,
              Object.freeze({
                label: slot.label,
                ...(slot.door === undefined ? {} : { door: slot.door }),
              }),
            ] as const,
          ]
        : [],
    ),
  );
  const stays = Array.from(
    { length: descriptor.requiredVisits + 1 },
    (_, precedingVisitCount): WorkspaceHubStay => {
      const authored = authoredStays[precedingVisitCount];
      const settled = settledStays?.stays.find(
        (entry) => entry.precedingVisitCount === precedingVisitCount,
      );
      const list =
        source === undefined
          ? {}
          : assembleHubStayRerolls({
              hub,
              markerDestinations,
              nodeKey,
              owner,
              precedingVisitCount,
              settled: settled?.settlement,
              slots: openSlots,
              source,
              stayRows: authored?.rows ?? [],
            });
      if (list.requirement !== undefined) occurrenceInteractionRequirements.push(list.requirement);
      // Every open door as the stay leaves it, entered rooms marked cleared.
      const doors = settled?.doors.map((door) =>
        Object.freeze({
          hubSlotKey: door.hubSlotKey,
          label: openSlots.get(door.hubSlotKey)?.label ?? door.hubSlotKey,
          firstSummary: summarizeRewardOffer(catalog, door.firstDraw),
          current: door.current,
          currentSummary: summarizeRewardOffer(catalog, door.current),
          changed: door.changed,
          cleared: door.cleared,
          presses: Object.freeze(
            door.presses.map((press) =>
              Object.freeze({
                key: semanticAddressKey(press.owner),
                precedingVisitCount: press.precedingVisitCount,
                summary: summarizeRewardOffer(catalog, press.reward),
              }),
            ),
          ),
        }),
      );
      const rows = (authored?.rows ?? []).map((row): WorkspaceHubStayRow =>
        row.kind === 'reroll'
          ? Object.freeze({
              kind: 'reroll' as const,
              key: row.action.rerollId,
              moves: stayRowMoves(hub.actions, authoredStays, authored!, row),
            })
          : Object.freeze({
              kind: 'fountain' as const,
              moves: stayRowMoves(hub.actions, authoredStays, authored!, row),
            }),
      );
      return Object.freeze({
        precedingVisitCount,
        rows: Object.freeze(rows),
        ...(list.rerolls === undefined ? {} : { rerolls: list.rerolls }),
        ...(doors === undefined ? {} : { doors: Object.freeze(doors) }),
      });
    },
  );
  const rerollsRemaining = stays.findLast((stay) => stay.rerolls?.poolRemaining !== undefined)
    ?.rerolls?.poolRemaining;
  const runDepth = input.source?.hubRunDepth(createHubRoomAddress(biome, descriptor.hubKey));
  const node = Object.freeze({
    authoring: 'authored' as const,
    kind: 'hubDecision' as const,
    ...(input.source?.walkReached(createHubRoomAddress(biome, descriptor.hubKey)) === false
      ? { notReached: true as const }
      : {}),
    fountain,
    stays: Object.freeze(stays),
    ...(rerollsRemaining === undefined ? {} : { rerollsRemaining }),
    ...(runDepth === undefined ? {} : { runDepth }),
    key: nodeKey,
    hubKey: descriptor.hubKey,
    gameName: descriptor.terminal.roomGameName,
    marker: hubMarker,
    openSet: markerDestinations.marker(createHubOpenSetAddress(biome, descriptor.hubKey)),
    openSlotCount: Object.freeze({
      current: targets.size,
      min: descriptor.openCount.min,
      max: descriptor.openCount.max,
    }),
    owner,
    requiredVisitCount: descriptor.requiredVisits,
    requirements: Object.freeze({
      openRooms: Object.freeze({
        current: targets.size,
        min: descriptor.openCount.min,
        max: descriptor.openCount.max,
        met: readiness.kind !== 'missing' && readiness.kind !== 'openSetIncomplete',
      }),
      visits: Object.freeze({
        planned: visitOrder.length,
        required: descriptor.requiredVisits,
        met: readiness.kind === 'ready',
        fountainUsed: fountainIndex !== -1,
      }),
    }),
    completedExit,
    slots: Object.freeze(slots),
    visits: Object.freeze(visits),
    ...(runState === undefined ? {} : { runState }),
  });
  markerDestinations.redirect(
    Object.freeze([
      node.marker,
      node.openSet,
      ...node.slots.map((slot) => slot.marker),
      ...node.visits.map((visit) => visit.marker),
    ]),
    node.key,
  );
  for (const slot of node.slots) {
    if (slot.localVisit === undefined || slot.room === undefined) continue;
    const parentWorkbench = workbenches.find(
      (workbench) => workbench.room.occurrenceId === slot.room!.occurrenceId,
    );
    if (parentWorkbench === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(slot.room.address)} has no Hub room workbench for local visits`,
      );
    }
    const doorsMarkers = [
      slot.localVisit.marker,
      ...slot.localVisit.slots.flatMap((local) => {
        if (local.generation !== 'generated') return [local.marker];
        return [local.marker, ...workspaceHubMainRewardMarkers(local.room)];
      }),
    ];
    markerDestinations.redirect(
      [...doorsMarkers, slot.localVisit.orderMarker],
      parentWorkbench.key,
    );
    // The side doors are spawns on the main room's Overview; its visits are its Leave rows.
    markerDestinations.setRoomTab(doorsMarkers, 'overview');
    markerDestinations.setTimelineDoors([slot.localVisit.orderMarker], 'actions', 'leave');
  }
  markerDestinations.setHubTab(
    Object.freeze([node.marker, node.openSet, ...node.slots.map((slot) => slot.marker)]),
    'overview',
  );
  markerDestinations.setHubTab(Object.freeze(node.visits.map((visit) => visit.marker)), 'timeline');
  markerDestinations.redirect([completedExit.marker], node.key);
  // The Hub Timeline's last row names the way on to the Preboss.
  markerDestinations.setHubTab([completedExit.marker], 'timeline');
  // Placement and the Phial target both repair on the Hub Timeline's fountain row.
  markerDestinations.redirect([fountain.marker, fountain.outcomeMarker], node.key);
  markerDestinations.setHubTab([fountain.marker, fountain.outcomeMarker], 'timeline');
  hubInteractionRequirements.push(
    Object.freeze({
      kind: 'hubControls' as const,
      owner,
      slots: Object.freeze(slotRequirements),
      actions: hub.actions,
    }),
  );
  return Object.freeze({
    hubInteractionRequirements: Object.freeze(hubInteractionRequirements),
    node,
    occurrenceInteractionRequirements: Object.freeze(occurrenceInteractionRequirements),
    roomControls: Object.freeze(roomControls),
    rewardControls: Object.freeze(rewardControls),
    workbenches: Object.freeze(workbenches),
  });
}

function projectAuthoredHubWithOverlay(
  input: Extract<WorkspaceHubAssemblyInput, { readonly hub: HubDecision }>,
): WorkspaceHubAssembly {
  const { biome, descriptor, evaluated, hub, topology } = input;
  const owner = createHubDecisionAddress(biome, descriptor.hubKey);
  const occurrences = hubOccurrenceMap(topology);
  if (evaluated !== undefined) {
    if (
      semanticAddressKey(evaluated.origin) !== semanticAddressKey(owner) ||
      semanticAddressKey(evaluated.board.origin) !==
        semanticAddressKey(createHubOpenSetAddress(biome, descriptor.hubKey))
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} evaluated Hub does not match authored topology`,
      );
    }
  }
  const evaluatedTargets = new Map(
    (evaluated?.board.targets ?? []).map((target) => [target.hubSlotKey, target] as const),
  );
  if (evaluatedTargets.size !== (evaluated?.board.targets.length ?? 0)) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} has duplicate evaluated Hub slot targets`,
    );
  }
  const authoredTargets = new Map(hub.openTargets.map((target) => [target.hubSlotKey, target]));
  const targets = new Map<string, ProjectedHubTarget>();
  for (const target of hub.openTargets) {
    const overlay = evaluatedTargets.get(target.hubSlotKey);
    evaluatedTargets.delete(target.hubSlotKey);
    const address = createHubSlotAddress(biome, descriptor.hubKey, target.hubSlotKey);
    if (
      overlay !== undefined &&
      (semanticAddressKey(overlay.origin) !== semanticAddressKey(address) ||
        overlay.room.occurrenceId !== target.occurrenceId ||
        semanticAddressKey(overlay.room.origin) !==
          semanticAddressKey(createOccurrenceAddress(biome, target.occurrenceId)) ||
        overlay.room.gameName !== occurrences.get(target.occurrenceId)?.gameName)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(address)} evaluated Hub target does not match its authored occurrence`,
      );
    }
    targets.set(
      target.hubSlotKey,
      Object.freeze({
        ...(overlay === undefined ? {} : { canonical: overlay.room }),
        ...(() => {
          const visit = evaluated?.visits.find(
            (candidate) => candidate.target.room.occurrenceId === target.occurrenceId,
          );
          return visit === undefined ? {} : { localSlots: visit.localSlots };
        })(),
        occurrenceId: target.occurrenceId,
      }),
    );
  }
  if (evaluatedTargets.size > 0) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} has evaluated Hub targets with no authored slot`,
    );
  }
  const evaluatedVisitIndexes = new Set<number>();
  for (const visit of evaluated?.visits ?? []) {
    if (evaluatedVisitIndexes.has(visit.visitIndex)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} has duplicate evaluated Hub visit ${visit.visitIndex}`,
      );
    }
    evaluatedVisitIndexes.add(visit.visitIndex);
    const expectedSlot = hubVisitSlotKeys(hub)[visit.visitIndex - 1];
    const target = authoredTargets.get(visit.target.hubSlotKey);
    const expectedVisit = createHubVisitAddress(biome, descriptor.hubKey, visit.visitIndex);
    const expectedTarget = createHubSlotAddress(biome, descriptor.hubKey, visit.target.hubSlotKey);
    if (
      expectedSlot !== visit.target.hubSlotKey ||
      target === undefined ||
      target.occurrenceId !== visit.target.room.occurrenceId ||
      visit.target.room.gameName !== occurrences.get(target.occurrenceId)?.gameName ||
      semanticAddressKey(visit.target.room.origin) !==
        semanticAddressKey(createOccurrenceAddress(biome, target.occurrenceId)) ||
      semanticAddressKey(visit.origin) !== semanticAddressKey(expectedVisit) ||
      semanticAddressKey(visit.target.origin) !== semanticAddressKey(expectedTarget)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} has an evaluated Hub visit that does not match authored order`,
      );
    }
  }
  return projectHubNode(input, owner, targets, hub);
}

/** Assemble the authored persistent Hub board. */
export function assembleWorkspaceHub(input: WorkspaceHubAssemblyInput): WorkspaceHubAssembly {
  return projectAuthoredHubWithOverlay(input);
}
