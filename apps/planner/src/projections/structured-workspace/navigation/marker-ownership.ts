import { rewardChildMarkers } from '../assembly/occurrence-action-markers';
import type { WorkspaceMarker } from '../contracts/navigation';
import type { WorkspaceRoomSummary } from '../contract';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type { WorkspaceRoomFeature } from '../contracts/features';
import type { WorkspaceRoomLocal } from '../contracts/locals';
import type {
  WorkspaceMixedBatchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceTakeoverBatchNode,
} from '../contracts/structure';

/** Batch-owned markers share the decision package that contains their targets. */
export type WorkspaceDecisionBatchNode =
  WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

function rewardControlMarkers(control: WorkspaceRewardControl): readonly WorkspaceMarker[] {
  return Object.freeze([control.marker, ...rewardChildMarkers(control)]);
}

/** A workbench's room-local surface excludes its incoming offer. */
export function workspaceLocalDetailMarkers(
  roomLocal: WorkspaceRoomLocal,
): readonly WorkspaceMarker[] {
  switch (roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze([]);
    case 'fields':
      return Object.freeze([
        ...roomLocal.cages.flatMap((cage) => rewardControlMarkers(cage.control)),
        ...roomLocal.spatial.map((control) => control.marker),
        roomLocal.optionalRewardCountMarker,
      ]);
    case 'ship':
      return Object.freeze(
        roomLocal.wheels.flatMap((wheel) => [
          wheel.marker,
          ...wheel.offers.flatMap((offer) => rewardControlMarkers(offer.control)),
        ]),
      );
    case 'shop':
      return Object.freeze([
        ...roomLocal.offers.flatMap((offer) => [
          offer.purchase.marker,
          ...rewardControlMarkers(offer.rewardControl),
        ]),
        ...roomLocal.supplementalOffers.flatMap((offer) =>
          !('purchase' in offer)
            ? []
            : [
                offer.purchase.marker,
                ...(!('rewardControl' in offer) ? [] : rewardControlMarkers(offer.rewardControl)),
              ],
        ),
      ]);
  }
}

/** Room Overview owns feature repair markers; action rows remain Timeline-owned. */
export function workspaceRoomFeatureMarkers(
  features: readonly WorkspaceRoomFeature[],
): readonly WorkspaceMarker[] {
  return Object.freeze(
    features.flatMap((feature) => {
      switch (feature.kind) {
        case 'hermesShrine':
          return [
            feature.presenceMarker,
            ...(feature.inventoryMarker === undefined ? [] : [feature.inventoryMarker]),
            ...feature.slots.map((slot) => slot.marker),
            ...(feature.travelDealRefill === undefined ? [] : [feature.travelDealRefill.marker]),
          ];
        case 'stygianWell':
          return [
            feature.presenceMarker,
            ...(feature.inventoryMarker === undefined ? [] : [feature.inventoryMarker]),
            ...feature.slots.map((slot) => slot.marker),
          ];
        case 'purgingPool':
          return [feature.inventoryMarker, ...feature.slots.map((slot) => slot.marker)];
        case 'chaos':
          return feature.action === 'remove' ? [feature.marker] : [];
        case 'zagreusContract':
        case 'nemesisEvent':
          return [];
      }
    }),
  );
}

/**
 * Exact occurrence owners may be nested in a decision workbench, but they
 * retain one shared marker package for containment routing.
 */
export function workspaceOccurrenceOwnedMarkers(
  room: WorkspaceRoomSummary,
): readonly WorkspaceMarker[] {
  return Object.freeze([
    room.marker,
    ...room.encounterPhases.flatMap((phase) => [
      phase.marker,
      ...(phase.nemesisEvent === undefined ? [] : [phase.nemesisEvent.marker]),
      ...(phase.traitOffer === undefined
        ? []
        : [
            phase.traitOffer.marker,
            ...phase.traitOffer.children.map((child) => child.marker),
            ...phase.traitOffer.feedback.flatMap((feedback) =>
              feedback.kind === 'echoLastReward' ? [feedback.control.marker] : [],
            ),
          ]),
      ...(phase.gorgonAthena === undefined ? [] : [phase.gorgonAthena.marker]),
    ]),
    ...room.rewardControls.flatMap((control) => [
      control.marker,
      ...(control.traitOffers ?? []).flatMap((trait) => [
        trait.marker,
        ...trait.children.map((child) => child.marker),
        ...trait.feedback.flatMap((feedback) =>
          feedback.kind === 'echoLastReward' ? [feedback.control.marker] : [],
        ),
      ]),
      ...(control.levelResolutions ?? []).map((resolution) => resolution.marker),
    ]),
    ...workspaceLocalDetailMarkers(room.roomLocal),
    ...(room.roomActions?.rows.map((row) => row.marker) ?? []),
    ...(room.roomActions?.rows.flatMap((row) =>
      row.fountainRarity === undefined ? [] : [row.fountainRarity.marker],
    ) ?? []),
    ...(room.roomActions?.steadyGrowth?.map((effect) => effect.marker) ?? []),
    ...(room.roomActions?.transcendentEmbryo?.map((effect) => effect.marker) ?? []),
    ...(room.judgment === undefined ? [] : [room.judgment.marker]),
    ...(room.figurine === undefined ? [] : [room.figurine.marker]),
    ...(room.keepsakeSelection === undefined
      ? []
      : [
          room.keepsakeSelection.marker,
          ...(room.keepsakeSelection.equipResult === undefined
            ? []
            : [room.keepsakeSelection.equipResult.marker]),
        ]),
    ...(room.zagreusSpawn === undefined ? [] : [room.zagreusSpawn.marker]),
    ...(room.chaosSpawn === undefined ? [] : [room.chaosSpawn.marker]),
    ...(room.resources?.map((resource) => resource.marker) ?? []),
    ...workspaceRoomFeatureMarkers(room.workbench.features),
    ...(room.roomLocal.kind === 'fixed' ? [room.roomLocal.marker] : []),
  ]);
}

/** Decision-owned markers are limited to door identity and transition controls. */
export function workspaceDecisionOwnedMarkers(
  node: WorkspaceDecisionBatchNode,
): readonly WorkspaceMarker[] {
  return Object.freeze([
    node.marker,
    node.selection,
    ...(node.rewardStore === undefined ? [] : [node.rewardStore]),
    ...(node.zagreusContract === undefined ? [] : [node.zagreusContract.marker]),
    ...(node.chaos === undefined ? [] : [node.chaos.marker]),
    ...node.targets.map((target) => target.marker),
    ...node.targets.flatMap((target) => {
      return target.door.offerRewardSurface.rewards.map((reward) => reward.marker);
    }),
    ...node.missingTargets.map((target) => target.marker),
  ]);
}

/** The outer Hub reward identity routes to the board rather than a workbench. */
export function workspaceHubMainRewardMarkers(
  room: WorkspaceRoomSummary,
): readonly WorkspaceMarker[] {
  switch (room.roomLocal.kind) {
    case 'fixed':
      return Object.freeze([room.roomLocal.marker]);
    case 'incomingReward':
      return Object.freeze([room.roomLocal.control.marker]);
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return Object.freeze([]);
  }
}

/** Nested Hub reward acquisition owners remain in the occurrence Timeline. */
export function workspaceHubMainRewardAcquisitionMarkers(
  room: WorkspaceRoomSummary,
): readonly WorkspaceMarker[] {
  switch (room.roomLocal.kind) {
    case 'fixed':
      return room.roomLocal.control === undefined
        ? Object.freeze([])
        : rewardChildMarkers(room.roomLocal.control);
    case 'incomingReward':
      return rewardChildMarkers(room.roomLocal.control);
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return Object.freeze([]);
  }
}
