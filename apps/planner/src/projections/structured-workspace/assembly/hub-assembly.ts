import {
  createHubDecisionAddress,
  createExitDecisionAddress,
  createHubOpenSetAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createLocalVisitDecisionAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  selectedExitTarget,
  type BiomeAddress,
  type BiomeTopology,
  type ExitDecision,
  type HubDecision,
  type HubDecisionAddress,
  type LocalVisitDecision,
  type LocalVisitSlotAddress,
  type OccurrenceId,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog, HubDecisionDescriptor } from '@run-planner/engine/catalog-schema';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubDecision,
  CanonicalLocalVisitRoom,
} from '@run-planner/engine/simulation';

import { requireWorkspaceRoom } from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  workspaceLocalVisitOrderKey,
  type WorkspaceDoorContract,
  type WorkspaceHubDecisionNode,
  type WorkspaceLocalVisitOrderControl,
  type WorkspaceLocalVisitOrderOption,
  type WorkspaceMarker,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceRewardControl,
  type WorkspaceRoomPickerControl,
  type WorkspaceRoomSummary,
} from '../contract';
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
import type { WorkspaceBiomeSource } from '../source-index';
import { presentRunState } from '../presentation/run-state';
import { projectWorkspaceDoorContract } from './door-contract';

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
  readonly completedExitReady?: boolean;
  readonly descriptor: HubDecisionDescriptor;
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

function ordinalLabel(position: number): string {
  const remainder = position % 100;
  if (remainder >= 11 && remainder <= 13) return `${position}th`;
  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}

function localVisitOrderControl(
  address: LocalVisitSlotAddress,
  visitOrder: readonly OccurrenceId[],
  occurrenceId: OccurrenceId,
): WorkspaceLocalVisitOrderControl {
  const index = visitOrder.indexOf(occurrenceId);
  const withoutOccurrence = Object.freeze(
    visitOrder.filter((candidate) => candidate !== occurrenceId),
  );
  const options: WorkspaceLocalVisitOrderOption[] = [
    Object.freeze({
      key: 'notEntered',
      label: 'Not visited',
      position: null,
      proposedOccurrenceIds: withoutOccurrence,
    }),
  ];
  for (let insertionIndex = 0; insertionIndex <= withoutOccurrence.length; insertionIndex += 1) {
    const position = insertionIndex + 1;
    options.push(
      Object.freeze({
        key: `position:${position}`,
        label: ordinalLabel(position),
        position,
        proposedOccurrenceIds: Object.freeze([
          ...withoutOccurrence.slice(0, insertionIndex),
          occurrenceId,
          ...withoutOccurrence.slice(insertionIndex),
        ]),
      }),
    );
  }
  return Object.freeze({
    interactionKey: workspaceLocalVisitOrderKey(address),
    options: Object.freeze(options),
    selectedKey: index < 0 ? 'notEntered' : `position:${index + 1}`,
  });
}

function hubOccurrenceMap(
  topology: BiomeTopology | null,
): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(
    (topology?.occurrences ?? []).map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
}

/** Hub main offers retain their semantic owner but navigate to the Hub board. */
function redirectHubMainRewardFocus(
  markerDestinations: WorkspaceMarkerDestinationEmitter,
  hub: WorkspaceMarker,
  mainReward: WorkspaceMarker,
): void {
  markerDestinations.redirectTo(mainReward, hub, `hub:${hub.focusKey}`);
}

function projectHubNode(
  input: WorkspaceHubAssemblyInput,
  owner: HubDecisionAddress,
  targets: ReadonlyMap<string, ProjectedHubTarget>,
  visitOrder: readonly string[],
): WorkspaceHubAssembly {
  const { biome, catalog, descriptor, markerDestinations, topology } = input;
  const hubMarker = markerDestinations.marker(owner);
  const occurrences = hubOccurrenceMap(topology);
  const hubInteractionRequirements: WorkspaceHubInteractionRequirement[] = [];
  const slotRequirements: WorkspaceHubInteractionRequirement['slots'][number][] = [];
  const occurrenceInteractionRequirements: WorkspaceOccurrenceInteractionRequirement[] = [];
  const roomControls: WorkspaceRoomPickerControl[] = [];
  const rewardControls: WorkspaceRewardControl[] = [];
  const workbenches: WorkspaceOccurrenceWorkbenchNode[] = [];
  const doorsBySlot = new Map<string, WorkspaceDoorContract>();
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
        const descriptor = {
          address,
          availabilityRank: slot.availabilityRank,
          entered: enteredOrdinal >= 0,
          enteredOrdinal: enteredOrdinal < 0 ? null : enteredOrdinal + 1,
          key: slot.slotKey,
          label: requireWorkspaceRoom(catalog, localOccurrence.gameName).label,
          marker: markerDestinations.marker(address),
          occurrenceId: localOccurrence.occurrenceId,
          order: localVisitOrderControl(address, decision.visitOrder, localOccurrence.occurrenceId),
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
        });
      });
    if (canonicalByOccurrence.size > 0) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} has evaluated local rooms outside its authored slots`,
      );
    }
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
              order: slot.order,
            }),
          ),
        ),
      }),
    );
    return Object.freeze({
      address: owner,
      marker: markerDestinations.marker(owner),
      order,
      orderMarker: markerDestinations.marker(order),
      slots: Object.freeze(slots),
      visitOrder: Object.freeze([...decision.visitOrder]),
    });
  };
  const slots = descriptor.slots.map((slot) => {
    const slotRoom = requireWorkspaceRoom(catalog, slot.roomGameName);
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
    const door =
      occurrenceNode === undefined
        ? undefined
        : projectWorkspaceDoorContract(occurrenceNode.room, 'visible');
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
      markerDestinations.setHubTab(mainRewards, 'overview');
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
      hubSlotKey: slot.slotKey,
      label: slotRoom.label,
      marker: slotMarker,
      ...(localVisit === undefined ? {} : { localVisit }),
      open: target !== undefined,
      physicalDoorId: slot.physicalDoorId,
      ...(door === undefined ? {} : { door }),
      ...(occurrenceNode === undefined ? {} : { room: occurrenceNode.room }),
      roomKind: slotRoom.kind,
      visited: detailsActive,
    });
  });
  const visits = Array.from({ length: descriptor.requiredVisits }, (_, index) => {
    const visitIndex = index + 1;
    const hubSlotKey = visitOrder[index];
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
      visitIndex,
    });
  });
  const runState = input.source?.runState(owner);
  const completedExitRoom = requireWorkspaceRoom(catalog, descriptor.completedExit.roomGameName);
  const completedExitOwner = createExitDecisionAddress(biome, {
    decisionKey: descriptor.hubKey,
    kind: 'hubDecision',
  });
  const completedExitMarker = markerDestinations.marker(completedExitOwner);
  const completedExitDecision = input.topology?.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.source.kind === 'hubDecision' &&
      decision.source.decisionKey === descriptor.hubKey,
  );
  const completedExitTarget =
    completedExitDecision === undefined ? undefined : selectedExitTarget(completedExitDecision);
  if (completedExitDecision !== undefined && completedExitTarget === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(completedExitOwner)} has no selected completed-Hub target`,
    );
  }
  const completedExit =
    completedExitTarget === undefined
      ? input.completedExitReady === true
        ? Object.freeze({
            kind: 'ready' as const,
            marker: completedExitMarker,
            targetLabel: completedExitRoom.label,
          })
        : Object.freeze({
            kind: 'locked' as const,
            marker: completedExitMarker,
            targetLabel: completedExitRoom.label,
          })
      : Object.freeze({
          kind: 'opened' as const,
          marker: completedExitMarker,
          target: Object.freeze({
            label: completedExitRoom.label,
            marker: markerDestinations.marker(
              createOccurrenceAddress(biome, completedExitTarget.occurrenceId),
            ),
          }),
          targetLabel: completedExitRoom.label,
        });
  const node = Object.freeze({
    authoring: 'authored' as const,
    kind: 'hubDecision' as const,
    key: `hub:${semanticAddressKey(owner)}`,
    hubKey: descriptor.hubKey,
    marker: hubMarker,
    openSet: markerDestinations.marker(createHubOpenSetAddress(biome, descriptor.hubKey)),
    openSlotCount: Object.freeze({
      current: targets.size,
      min: descriptor.openCount.min,
      max: descriptor.openCount.max,
    }),
    owner,
    requiredVisitCount: descriptor.requiredVisits,
    completedExit,
    slots: Object.freeze(slots),
    visits: Object.freeze(visits),
    ...(runState === undefined
      ? {}
      : {
          runState:
            runState.availability === 'available'
              ? Object.freeze({
                  availability: 'available' as const,
                  owner,
                  state: presentRunState(input.catalog, runState.snapshot),
                  title: 'Hub',
                })
              : Object.freeze({
                  availability: 'unavailable' as const,
                  owner,
                  title: 'Hub',
                }),
        }),
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
    const localVisitMarkers = [
      slot.localVisit.marker,
      slot.localVisit.orderMarker,
      ...slot.localVisit.slots.flatMap((local) => {
        if (local.generation !== 'generated') return [local.marker];
        return [local.marker, ...workspaceHubMainRewardMarkers(local.room)];
      }),
    ];
    markerDestinations.redirect(localVisitMarkers, parentWorkbench.key);
    markerDestinations.setRoomTab(localVisitMarkers, 'overview');
  }
  markerDestinations.setHubTab(
    Object.freeze([node.marker, node.openSet, ...node.slots.map((slot) => slot.marker)]),
    'overview',
  );
  markerDestinations.setHubTab(Object.freeze(node.visits.map((visit) => visit.marker)), 'timeline');
  markerDestinations.redirect([completedExitMarker], node.key);
  markerDestinations.setHubTab([completedExitMarker], 'exit');
  hubInteractionRequirements.push(
    Object.freeze({
      kind: 'hubControls' as const,
      owner,
      slots: Object.freeze(slotRequirements),
      visitOrder: Object.freeze([...visitOrder]),
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
    const expectedSlot = hub.visitOrder[visit.visitIndex - 1];
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
  return projectHubNode(input, owner, targets, hub.visitOrder);
}

/** Assemble the authored persistent Hub board. */
export function assembleWorkspaceHub(input: WorkspaceHubAssemblyInput): WorkspaceHubAssembly {
  return projectAuthoredHubWithOverlay(input);
}
