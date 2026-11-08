import type { WorkspaceRoomActionRow } from '@planner/projections/structured-workspace';
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { roomActionIcon, wellItemIcon } from '@planner/ui/artwork/roomArtwork';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';

/** An action that collects or buys an item shows that item; any other action, its own icon. */
export function roomActionItemIcon(row: WorkspaceRoomActionRow): ArtworkSource | undefined {
  const reward = row.labelParts?.reward;
  if (reward === undefined)
    return roomActionIcon(
      row.reference,
      row.address.biomeKey,
      row.sourceFamily,
      row.challengeSwitchKind,
    );
  return reward.itemKey === undefined ? offerIcon(reward.offer) : wellItemIcon(reward.itemKey);
}
