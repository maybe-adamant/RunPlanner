import type {
  WorkspaceFieldsSpatialControl,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import type { ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { npcArtwork } from '@planner/ui/artwork/npcs/npcArtwork';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';

type FieldsRoom = Extract<WorkspaceRoomSummary['roomLocal'], { readonly kind: 'fields' }>;

/** A Fields slot's face: its reward's icon, or Nemesis. */
export function fieldsSlotIcon(
  fields: FieldsRoom,
  target: WorkspaceFieldsSpatialControl['target'],
): ArtworkSource | undefined {
  if (target.kind === 'nemesis') return npcArtwork.Nemesis ?? undefined;
  const slot = (target.kind === 'cage' ? fields.cages : fields.optionalRewards).find(
    (candidate) => candidate.key === target.slotKey,
  );
  return slot?.control.offer == null ? undefined : offerIcon(slot.control.offer);
}

/**
 * A Fields slot's corner mark: its number among the cages or the optional
 * rewards, which its ring or row tells apart; the Nemesis wears none.
 */
export function fieldsSlotBadge(
  fields: FieldsRoom,
  target: WorkspaceFieldsSpatialControl['target'],
): string | undefined {
  if (target.kind === 'nemesis') return undefined;
  const index = (target.kind === 'cage' ? fields.cages : fields.optionalRewards).findIndex(
    (candidate) => candidate.key === target.slotKey,
  );
  return index < 0 ? undefined : String(index + 1);
}
