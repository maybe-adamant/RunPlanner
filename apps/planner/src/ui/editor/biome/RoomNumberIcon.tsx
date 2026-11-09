import type { WorkspaceRoomIcon } from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomKindIcon } from './roomIcon';

/** A room's icon, badged with its number where many rooms share that icon. */
export function RoomNumberIcon({
  number,
  room,
}: {
  readonly number?: string | undefined;
  readonly room: WorkspaceRoomIcon;
}) {
  return (
    <span className="biome-rail-icons-room-slot">
      <ArtworkIcon className="biome-rail-icons-room" source={roomKindIcon(room)} />
      {number === undefined ? null : (
        <span className="corner-badge biome-rail-icons-number">{number}</span>
      )}
    </span>
  );
}
