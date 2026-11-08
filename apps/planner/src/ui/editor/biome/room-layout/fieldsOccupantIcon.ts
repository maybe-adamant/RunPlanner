import type {
  WorkspaceFieldsSpotOccupant,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { npcArtwork } from '@planner/ui/artwork/npcs/npcArtwork';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';

/** A Fields slot's face: its reward's icon, or Nemesis. */
export function fieldsOccupantIcon(
  fields: Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>,
  occupant: WorkspaceFieldsSpotOccupant,
): ArtworkSource | undefined {
  const target = occupant.address.target;
  if (target.kind === 'nemesis') return npcArtwork.Nemesis ?? undefined;
  const slot = (target.kind === 'cage' ? fields.cages : fields.optionalRewards).find(
    (candidate) => candidate.key === target.slotKey,
  );
  return slot?.control.offer == null ? undefined : offerIcon(slot.control.offer);
}
