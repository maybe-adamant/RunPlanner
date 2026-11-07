import type { WorkspaceRoomObject } from '@planner/projections/structured-workspace';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';

/** A World Shop, Hermes Shrine or Pedestal's icon. */
export const roomObjectEntryIcon: Readonly<Record<WorkspaceRoomObject, string | undefined>> = {
  worldShop: rewardIcon('Shop'),
  hermesShrine: roomObjectIcon('hermesShrine'),
  championItem: traitIcon('InfernalContractBoon'),
};
