import {
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type BiomeAddress,
  type BiomeTopology,
  type HubDecision,
  type HubDecisionAddress,
  type OccurrenceId,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog, HubDecisionDescriptor } from '@run-planner/engine/catalog-schema';
import type { CanonicalAuthoredRoom, CanonicalHubDecision } from '@run-planner/engine/simulation';

import { requireWorkspaceRoom } from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceHubDecisionNode,
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
import { workspaceHubMainRewardMarker } from '../navigation/marker-ownership';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import type { WorkspaceOccurrenceAssembler } from './occurrence-assembly';

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
  readonly descriptor: HubDecisionDescriptor;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly nextVisitIndex?: number;
  readonly topology: BiomeTopology | null;
}

/** An authored Hub board and its optional evaluator overlay. */
export type WorkspaceHubAssemblyInput = WorkspaceHubAssemblyBaseInput & {
  readonly evaluated?: CanonicalHubDecision;
  readonly hub: HubDecision;
};

interface ProjectedHubTarget {
  readonly canonical?: CanonicalAuthoredRoom;
  readonly occurrenceId: OccurrenceId;
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
  const roomsBySlot = new Map<string, WorkspaceRoomSummary>();
  const slots = descriptor.slots.map((slot) => {
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
    if (occurrenceNode !== undefined) {
      occurrenceInteractionRequirements.push(
        ...occurrenceAssembly!.occurrenceInteractionRequirements,
      );
      roomControls.push(...occurrenceAssembly!.roomControls);
      rewardControls.push(...occurrenceAssembly!.rewardControls);
      const workbench = Object.freeze({
        ...occurrenceNode,
        inspectorPresentation: 'hubRoomLocal' as const,
        railMarker: slotMarker,
        railVisibility: 'inspectorOnly' as const,
      });
      workbenches.push(workbench);
      roomsBySlot.set(slot.slotKey, workbench.room);
      const mainReward = workspaceHubMainRewardMarker(workbench.room);
      if (mainReward !== undefined) {
        redirectHubMainRewardFocus(markerDestinations, hubMarker, mainReward);
      }
    }
    slotRequirements.push(
      target === undefined
        ? Object.freeze({
            choices: Object.freeze([
              Object.freeze({ label: 'Closed', value: false }),
              Object.freeze({ label: 'Open', value: true }),
            ]),
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
      label: requireWorkspaceRoom(catalog, slot.roomGameName).label,
      marker: slotMarker,
      open: target !== undefined,
      physicalDoorId: slot.physicalDoorId,
      ...(occurrenceNode === undefined ? {} : { room: occurrenceNode.room }),
      roomKind: requireWorkspaceRoom(catalog, slot.roomGameName).kind,
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
      ...(hubSlotKey === undefined || roomsBySlot.get(hubSlotKey) === undefined
        ? {}
        : { room: roomsBySlot.get(hubSlotKey)! }),
      visitIndex,
    });
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
    slots: Object.freeze(slots),
    visits: Object.freeze(visits),
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
