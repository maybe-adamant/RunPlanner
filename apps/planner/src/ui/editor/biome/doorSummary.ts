import type { SemanticAddress } from '@run-planner/engine/authored-project';
import {
  workspaceInteractionKey,
  type WorkspacePhysicalTarget,
  type WorkspaceRewardWheelDescriptor,
  type WorkspaceMixedBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceRoomIcon,
  type WorkspaceTakeoverBatchNode,
} from '@planner/projections/structured-workspace';
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';

type BatchNode = WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

/** One door as the Doors open row shows it: its room's icon, then its reward's. */
export interface DoorChip {
  readonly key: string;
  readonly label: string;
  readonly roomIcon?: WorkspaceRoomIcon;
  readonly rewards: readonly (ArtworkSource | undefined)[];
  readonly missing?: true;
  readonly picked?: boolean;
  readonly unavailable?: boolean;
}

/** A door's rewards as first drawn, or after its rerolls; none while hidden. */
export function doorRewardIcons(
  target: WorkspacePhysicalTarget,
  draw: 'first' | 'final',
): readonly (ArtworkSource | undefined)[] {
  const surface = target.door.offerRewardSurface;
  if (surface.visibility === 'hidden') return [];
  return surface.rewards.flatMap((reward) => {
    const offer = draw === 'final' ? (reward.rerolledOffer ?? reward.offer) : reward.offer;
    return offer === null ? [] : [offerIcon(offer)];
  });
}

/** The batch's doors as compact chips of their first draws, in door order. */
export function batchDoorChips(node: BatchNode): readonly DoorChip[] {
  return [
    ...node.targets.map((target): DoorChip => ({
      key: target.exitKey,
      label: `Door ${target.index} · ${target.door.room.label}`,
      roomIcon: target.door.room.roomIcon,
      rewards: doorRewardIcons(target, 'first'),
      picked: target.selected,
      unavailable: target.physicalState === 'unavailable',
    })),
    ...(node.kind === 'takeoverBatch' ? [] : node.missingTargets).map((target): DoorChip => ({
      key: target.exitKey,
      label: `Door ${target.index}`,
      rewards: [],
      missing: true,
    })),
    ...[node.zagreusContract, node.chaos].flatMap((control) =>
      control === undefined
        ? []
        : [
            {
              key: workspaceInteractionKey(control.owner),
              label: control.exitTypeLabel,
              roomIcon: control.door.room.roomIcon,
              rewards: [],
              picked: control.selected,
            } satisfies DoorChip,
          ],
    ),
  ];
}

/** How far the doors are filled in, while some still need a room. */
export function batchDoorsStatus(node: BatchNode): string | undefined {
  const missing = node.kind === 'takeoverBatch' ? 0 : node.missingTargets.length;
  if (missing === 0) return undefined;
  const total = node.targets.length + missing;
  return `${node.targets.length} of ${total} doors set`;
}

/** Every owner the Doors open row's editor repairs, so its closed row can carry their findings. */
export function batchDoorFindingOwners(node: BatchNode): readonly SemanticAddress[] {
  return [
    node.marker.address,
    ...(node.rewardStore === undefined ? [] : [node.rewardStore.address]),
    ...(node.fieldsCageOutcome === undefined ? [] : [node.fieldsCageOutcome.address]),
    ...node.targets.flatMap((target) => [
      target.marker.address,
      target.door.room.marker.address,
      ...target.door.offerRewardSurface.rewards.map((reward) => reward.marker.address),
    ]),
    ...node.missingTargets.map((target) => target.marker.address),
    ...[node.zagreusContract, node.chaos].flatMap((control) =>
      control === undefined ? [] : [control.owner],
    ),
  ];
}

/** A wheel's active offers as chips: each its first draw, or its reward after rerolls. */
export function wheelOfferChips(
  wheel: WorkspaceRewardWheelDescriptor,
  draw: 'first' | 'final',
): readonly DoorChip[] {
  return wheel.offers
    .filter((offer) => offer.active)
    .map((offer, index) => {
      const reward =
        draw === 'final' ? (offer.rerolledOffer ?? offer.control.offer) : offer.control.offer;
      return {
        key: offer.key,
        label: offer.label,
        rewards: reward === null ? [] : [offerIcon(reward)],
        picked: index + 1 === wheel.pickedOfferIndex,
      };
    });
}
