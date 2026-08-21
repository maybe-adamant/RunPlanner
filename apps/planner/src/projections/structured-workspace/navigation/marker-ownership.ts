import type {
  WorkspaceMarker,
  WorkspaceMixedBatchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceRoomLocal,
  WorkspaceRoomSummary,
  WorkspaceTakeoverBatchNode,
} from '../contract';

/** Batch-owned markers share the decision package that contains their targets. */
export type WorkspaceDecisionBatchNode =
  WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

function rewardControlMarkers(control: {
  readonly marker: WorkspaceMarker;
  readonly traitOffers?: readonly {
    readonly marker: WorkspaceMarker;
    readonly traitAcquisitionTarget?: { readonly marker: WorkspaceMarker };
    readonly circeResolution?: { readonly marker: WorkspaceMarker };
    readonly echoPomTarget?: { readonly marker: WorkspaceMarker };
    readonly echoLastRunBoon?: { readonly marker: WorkspaceMarker };
    readonly echoLastReward?: { readonly marker: WorkspaceMarker };
    readonly allTogetherSets?: readonly { readonly marker: WorkspaceMarker }[];
  }[];
  readonly levelResolutions?: readonly { readonly marker: WorkspaceMarker }[];
}): readonly WorkspaceMarker[] {
  return Object.freeze([
    control.marker,
    ...(control.traitOffers ?? []).flatMap((trait) => [
      trait.marker,
      ...(trait.traitAcquisitionTarget === undefined ? [] : [trait.traitAcquisitionTarget.marker]),
      ...(trait.circeResolution === undefined ? [] : [trait.circeResolution.marker]),
      ...(trait.echoPomTarget === undefined ? [] : [trait.echoPomTarget.marker]),
      ...(trait.echoLastRunBoon === undefined ? [] : [trait.echoLastRunBoon.marker]),
      ...(trait.echoLastReward === undefined ? [] : [trait.echoLastReward.marker]),
      ...(trait.allTogetherSets ?? []).map((set) => set.marker),
    ]),
    ...(control.levelResolutions ?? []).map((resolution) => resolution.marker),
  ]);
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
      ...(phase.traitOffer === undefined
        ? []
        : [
            phase.traitOffer.marker,
            ...(phase.traitOffer.traitAcquisitionTarget === undefined
              ? []
              : [phase.traitOffer.traitAcquisitionTarget.marker]),
            ...(phase.traitOffer.circeResolution === undefined
              ? []
              : [phase.traitOffer.circeResolution.marker]),
            ...(phase.traitOffer.echoPomTarget === undefined
              ? []
              : [phase.traitOffer.echoPomTarget.marker]),
            ...(phase.traitOffer.echoLastRunBoon === undefined
              ? []
              : [phase.traitOffer.echoLastRunBoon.marker]),
            ...(phase.traitOffer.echoLastReward === undefined
              ? []
              : [phase.traitOffer.echoLastReward.marker]),
            ...(phase.traitOffer.allTogetherSets ?? []).map((set) => set.marker),
          ]),
      ...(phase.gorgonAthena === undefined ? [] : [phase.gorgonAthena.marker]),
    ]),
    ...room.rewardControls.flatMap((control) => [
      control.marker,
      ...(control.traitOffers ?? []).flatMap((trait) => [
        trait.marker,
        ...(trait.traitAcquisitionTarget === undefined
          ? []
          : [trait.traitAcquisitionTarget.marker]),
        ...(trait.circeResolution === undefined ? [] : [trait.circeResolution.marker]),
        ...(trait.echoPomTarget === undefined ? [] : [trait.echoPomTarget.marker]),
        ...(trait.echoLastRunBoon === undefined ? [] : [trait.echoLastRunBoon.marker]),
        ...(trait.echoLastReward === undefined ? [] : [trait.echoLastReward.marker]),
        ...(trait.allTogetherSets ?? []).map((set) => set.marker),
      ]),
      ...(control.levelResolutions ?? []).map((resolution) => resolution.marker),
    ]),
    ...workspaceLocalDetailMarkers(room.roomLocal),
    ...(room.roomActions?.rows.map((row) => row.marker) ?? []),
    ...(room.zagreusSpawn === undefined ? [] : [room.zagreusSpawn.marker]),
    ...(room.naturalChaosSpawn === undefined ? [] : [room.naturalChaosSpawn.marker]),
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
    ...(node.hubTakeover === undefined ? [] : [node.hubTakeover.marker]),
    ...(node.rewardStore === undefined ? [] : [node.rewardStore]),
    ...(node.zagreusContract === undefined ? [] : [node.zagreusContract.marker]),
    ...(node.naturalChaos === undefined ? [] : [node.naturalChaos.marker]),
    ...node.targets.map((target) => target.marker),
    ...node.targets.flatMap((target) => {
      const preview = target.door.rewardPreview;
      return preview.kind === 'none'
        ? []
        : (preview.kind === 'visible' ? preview.rewards : preview.authoringRewards).map(
            (reward) => reward.marker,
          );
    }),
    ...node.missingTargets.map((target) => target.marker),
  ]);
}

/** Hub main-offer owners route to the board rather than a nested workbench. */
export function workspaceHubMainRewardMarkers(
  room: WorkspaceRoomSummary,
): readonly WorkspaceMarker[] {
  switch (room.roomLocal.kind) {
    case 'fixed':
      return Object.freeze([
        room.roomLocal.marker,
        ...(room.roomLocal.control?.traitOffers ?? []).flatMap((trait) => [
          trait.marker,
          ...(trait.traitAcquisitionTarget === undefined
            ? []
            : [trait.traitAcquisitionTarget.marker]),
          ...(trait.circeResolution === undefined ? [] : [trait.circeResolution.marker]),
          ...(trait.echoPomTarget === undefined ? [] : [trait.echoPomTarget.marker]),
          ...(trait.echoLastRunBoon === undefined ? [] : [trait.echoLastRunBoon.marker]),
          ...(trait.echoLastReward === undefined ? [] : [trait.echoLastReward.marker]),
          ...(trait.allTogetherSets ?? []).map((set) => set.marker),
        ]),
        ...(room.roomLocal.control?.levelResolutions ?? []).map((resolution) => resolution.marker),
      ]);
    case 'incomingReward':
      return Object.freeze(rewardControlMarkers(room.roomLocal.control));
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return Object.freeze([]);
  }
}
