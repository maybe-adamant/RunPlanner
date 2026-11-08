import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import {
  workspaceInteractionKey,
  type WorkspacePhysicalTarget,
  type WorkspaceRewardWheelDescriptor,
  type WorkspaceMixedBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceDoorStep,
  type WorkspaceRoomIcon,
  type WorkspaceTakeoverBatchNode,
} from '@planner/projections/structured-workspace';
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import type { TimelineDoors } from './TimelineDoors';
import type { RoomMapHighlight } from './room-map/roomMapHighlight';

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
  /** The door is locked at this point of the Timeline. */
  readonly locked?: boolean;
  /** The ordinary door's number, which places it on the room's map. */
  readonly doorIndex?: number;
  /** The additional exit the chip is, such as the Chaos gate. */
  readonly additionalExit?: 'chaos' | 'zagreusContract';
}

/** The chip's point on its room's map: its door by number, or the Chaos gate. */
export function doorChipMapLink(chip: DoorChip): RoomMapHighlight | undefined {
  if (chip.additionalExit === 'chaos') return { kind: 'chaosGate' };
  if (chip.additionalExit !== undefined || chip.doorIndex === undefined) return undefined;
  return { kind: 'door', doorIndex: chip.doorIndex };
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

/** The batch's doors as compact chips of their first draws, in door order; `locked` doors as the doors open. */
export function batchDoorChips(
  node: BatchNode,
  locked: readonly string[] = [],
): readonly DoorChip[] {
  return [
    ...node.targets.map((target): DoorChip => ({
      key: target.exitKey,
      label: `Door ${target.index} · ${target.door.room.label}`,
      doorIndex: target.index,
      roomIcon: target.door.room.roomIcon,
      rewards: doorRewardIcons(target, 'first'),
      picked: target.selected,
      unavailable: target.physicalState === 'unavailable',
      locked: locked.includes(target.exitKey),
    })),
    ...(node.kind === 'takeoverBatch' ? [] : node.missingTargets).map((target): DoorChip => ({
      key: target.exitKey,
      label: `Door ${target.index}`,
      doorIndex: target.index,
      rewards: [],
      missing: true,
      locked: locked.includes(target.exitKey),
    })),
    ...[node.zagreusContract, node.chaos].flatMap((control) =>
      control === undefined
        ? []
        : [
            {
              key: workspaceInteractionKey(control.owner),
              additionalExit:
                control === node.chaos ? ('chaos' as const) : ('zagreusContract' as const),
              label: control.exitTypeLabel,
              roomIcon: control.door.room.roomIcon,
              rewards: [],
              picked: control.selected,
            } satisfies DoorChip,
          ],
    ),
  ];
}

/** The chips as the doors stand at one step: each door's rewards and lock there. */
export function doorChipsAt(
  chips: readonly DoorChip[],
  doors: WorkspaceDoorStep['doors'],
): readonly DoorChip[] {
  return chips.map((chip) => {
    const door = doors.find((candidate) => candidate.exitKey === chip.key);
    return door === undefined
      ? chip
      : {
          ...chip,
          locked: door.locked === true,
          rewards: door.rewards.flatMap((offer) => (offer === null ? [] : [offerIcon(offer)])),
        };
  });
}

/**
 * The reward a door press acts on, as the doors show it before the press: an
 * unlock names its door's exit, a reroll its reward's owner.
 */
export function batchDoorPressIcon(node: BatchNode): (key: string) => ArtworkSource | undefined {
  const icons = new Map<string, ArtworkSource | undefined>();
  for (const target of node.targets) {
    if (target.door.offerRewardSurface.visibility === 'hidden') continue;
    for (const reward of target.door.offerRewardSurface.rewards) {
      const offer = reward.rerolledOffer ?? reward.offer;
      const icon = offer === null ? undefined : offerIcon(offer);
      if (!icons.has(target.exitKey)) icons.set(target.exitKey, icon);
      icons.set(semanticAddressKey(reward.marker.address), icon);
    }
  }
  return (key) => icons.get(key);
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

/** The banner title's disclosure of the doors' editor; absent where it cannot be hidden. */
export function doorsOpenToggle(doors: TimelineDoors): BannerToggle | undefined {
  const toggle = doors.onExpandedChange;
  if (doors.detail === undefined || toggle === undefined) return undefined;
  return {
    controls: doors.detailId,
    expanded: doors.expanded,
    label: doors.noun === 'door' ? 'Door details' : 'Offer details',
    noteActive:
      doors.activeNote !== undefined &&
      (doors.expanded ? !doors.activeNote.ownRow : doors.activeNote.chip === undefined),
    onToggle: () => toggle(!doors.expanded),
  };
}

/** A banner whose whole title shows or hides the editor under it. */
export interface BannerToggle {
  readonly controls: string;
  readonly expanded: boolean;
  readonly label: string;
  /** A note about the doors lights the title where nothing nearer shows what it explains. */
  readonly noteActive?: boolean;
  readonly onToggle: () => void;
}
