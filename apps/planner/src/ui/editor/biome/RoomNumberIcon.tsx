import type { WorkspaceRoomIcon } from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomKindIcon } from './roomIcon';

/** A room's icon, badged with its number where many rooms share that icon. */
export function RoomNumberIcon({
  iconClassName = 'biome-rail-icons-room',
  number,
  room,
}: {
  /** The icon's size where it stands among other icons, such as a chip's. */
  readonly iconClassName?: string;
  readonly number?: string | undefined;
  readonly room: WorkspaceRoomIcon;
}) {
  return (
    <span className="biome-rail-icons-room-slot">
      <ArtworkIcon className={iconClassName} source={roomKindIcon(room)} />
      {number === undefined ? null : (
        <span className="corner-badge biome-rail-icons-number">{number}</span>
      )}
    </span>
  );
}

/**
 * A room option in a list: its numbered icon, then its name. Every option keeps
 * room for a number's overhang, so the names line up.
 */
export function RoomOptionFace({
  label,
  number,
  room,
}: {
  readonly label: string;
  readonly number?: string | undefined;
  readonly room: WorkspaceRoomIcon | undefined;
}) {
  return (
    <>
      {room === undefined ? null : (
        <span aria-hidden="true" className="room-option-icon">
          <RoomNumberIcon iconClassName="contextual-picker-item-icon" number={number} room={room} />
        </span>
      )}
      <span className="contextual-picker-item-label">{label}</span>
    </>
  );
}
