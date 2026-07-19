import type { Catalog, RoomDeclaration } from '@run-planner/core';
import { useState } from 'react';

import {
  roomCategoryForKind,
  selectRoomsForCategory,
  type OrdinaryRoomCategory,
} from '../application/roomSelectorProjection';

interface RoomSelectorProps {
  readonly biomeKey: string;
  readonly catalog: Catalog;
  readonly current?: RoomDeclaration;
  readonly disabled?: boolean;
  readonly idPrefix: string;
  readonly onSelect: (gameName: string) => void;
}

const categories: readonly { readonly key: OrdinaryRoomCategory; readonly label: string }[] = [
  { key: 'Combat', label: 'Combat' },
  { key: 'Miniboss', label: 'Miniboss' },
  { key: 'Story', label: 'Story' },
  { key: 'Fountain', label: 'Fountain' },
  { key: 'Shop', label: 'Shop' },
];

export function RoomSelector({
  biomeKey,
  catalog,
  current,
  disabled = false,
  idPrefix,
  onSelect,
}: RoomSelectorProps) {
  const currentCategory = current === undefined ? undefined : roomCategoryForKind(current.kind);
  const [category, setCategory] = useState<OrdinaryRoomCategory | ''>(currentCategory ?? '');
  const rooms = category === '' ? [] : selectRoomsForCategory(catalog, biomeKey, category);
  const currentInCategory = current !== undefined && roomCategoryForKind(current.kind) === category;

  return (
    <div className="room-selector">
      <label className="field-control" htmlFor={`${idPrefix}-category`}>
        <span>Type</span>
        <select
          disabled={disabled}
          id={`${idPrefix}-category`}
          onChange={(event) => setCategory(event.target.value as OrdinaryRoomCategory | '')}
          value={category}
        >
          <option value="">Select a type</option>
          {categories.map((candidate) => (
            <option key={candidate.key} value={candidate.key}>
              {candidate.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field-control" htmlFor={`${idPrefix}-room`}>
        <span>Room</span>
        <select
          disabled={disabled || category === ''}
          id={`${idPrefix}-room`}
          onChange={(event) => onSelect(event.target.value)}
          value={currentInCategory && current !== undefined ? current.gameName : ''}
        >
          <option value="">
            {disabled
              ? 'Topology target limit reached'
              : category === ''
                ? 'Select a type first'
                : 'Select a room'}
          </option>
          {rooms.map((room) => (
            <option key={room.gameName} value={room.gameName}>
              {room.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
