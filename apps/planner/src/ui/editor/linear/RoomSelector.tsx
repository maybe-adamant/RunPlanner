import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { TargetAddress } from '@run-planner/engine/authored-project';
import { useState } from 'react';

import {
  presentCandidateLabel,
  type CandidateProjectionService,
} from '../../../projections/candidateProjection';
import {
  roomCategoryForKind,
  roomSelectorCategories,
  selectRoomsForTargetCategory,
  type RoomSelectorCategory,
} from '../../../projections/roomSelectorProjection';
import { selectPresentProject, useAppSelector } from '../../../state/store';
import { candidateSelectState } from '../../feedback/candidatePresentation';

interface RoomSelectorProps {
  readonly biomeKey: string;
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly current?: RoomDeclaration;
  readonly disabled?: boolean;
  readonly idPrefix: string;
  readonly onSelect: (gameName: string) => void;
  readonly target: TargetAddress;
}

function RoomSelectorFields({
  biomeKey,
  candidateProjection,
  catalog,
  current,
  disabled = false,
  idPrefix,
  onSelect,
  target,
}: RoomSelectorProps) {
  const project = useAppSelector(selectPresentProject);
  const categories = roomSelectorCategories(catalog, biomeKey);
  const currentCategory = current === undefined ? undefined : roomCategoryForKind(current.kind);
  const [category, setCategory] = useState<RoomSelectorCategory | ''>(currentCategory ?? '');
  const rooms =
    category === '' ? [] : selectRoomsForTargetCategory(catalog, project, target, category);
  const projectedRooms = candidateProjection.roomTargets(project, target, rooms);
  const currentInCategory = current !== undefined && roomCategoryForKind(current.kind) === category;
  const selectedRoom = projectedRooms.find(
    (option) => current !== undefined && option.value.gameName === current.gameName,
  );

  return (
    <div className="room-selector">
      <label className="field-control" htmlFor={`${idPrefix}-category`}>
        <span>Type</span>
        <select
          {...candidateSelectState(selectedRoom)}
          disabled={disabled}
          id={`${idPrefix}-category`}
          onChange={(event) => setCategory(event.target.value as RoomSelectorCategory | '')}
          value={category}
        >
          <option value="">Select a type</option>
          {categories.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
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
          {projectedRooms.map((option) => (
            <option
              key={option.value.gameName}
              value={option.value.gameName}
              {...candidateSelectState(option)}
            >
              {presentCandidateLabel(option.value.label, option)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function RoomSelector(props: RoomSelectorProps) {
  return <RoomSelectorFields key={props.current?.gameName ?? 'unspecified'} {...props} />;
}
