import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { TargetAddress } from '@run-planner/engine/authored-project';

import type { CandidateProjectionService } from '../../../projections/candidateProjection';
import type { ContextualPickerProjectionService } from '../../../projections/contextualPicker';
import {
  roomCategoryForKind,
  roomSelectorCategories,
  selectRoomsForTargetCategory,
} from '../../../projections/roomSelectorProjection';
import { selectPresentProject, useAppSelector } from '../../../state/store';
import { ContextualPicker } from '../../controls/ContextualPicker';

interface RoomSelectorProps {
  readonly biomeKey: string;
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly contextualPicker: ContextualPickerProjectionService;
  readonly current?: RoomDeclaration;
  readonly disabled?: boolean;
  readonly idPrefix: string;
  readonly onSelect: (gameName: string) => void;
  readonly target: TargetAddress;
}

export function RoomSelector({
  biomeKey,
  candidateProjection,
  catalog,
  contextualPicker,
  current,
  disabled = false,
  idPrefix,
  onSelect,
  target,
}: RoomSelectorProps) {
  const project = useAppSelector(selectPresentProject);
  const categories = roomSelectorCategories(catalog, biomeKey);
  const roomsByGameName = new Map<string, RoomDeclaration>();
  for (const category of categories) {
    for (const room of selectRoomsForTargetCategory(catalog, project, target, category)) {
      roomsByGameName.set(room.gameName, room);
    }
  }
  if (current !== undefined) {
    roomsByGameName.set(current.gameName, current);
  }
  const rooms = [...roomsByGameName.values()];
  const projectedRooms = candidateProjection.roomTargets(project, target, rooms);
  const model = contextualPicker.project(
    projectedRooms,
    (option) => ({
      label: option.value.label,
      category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
      selected: option.value.gameName === current?.gameName,
    }),
    (room) => room.gameName,
  );

  return (
    <ContextualPicker
      disabled={disabled}
      id={`${idPrefix}-room`}
      label="Room"
      model={model}
      onSelect={(room) => onSelect(room.gameName)}
      placeholder={disabled ? 'Topology target limit reached' : 'Select a room'}
    />
  );
}
