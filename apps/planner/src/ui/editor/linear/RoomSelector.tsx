import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import { useState } from 'react';

import type { ContextualPickerModel } from '../../../projections/contextualPicker';
import type {
  WorkspaceContextualResolver,
  WorkspaceRoomInteraction,
  WorkspaceRoomPickerControl,
} from '../../../projections/structuredWorkspace';
import { ContextualPicker } from '../../controls/ContextualPicker';

interface RoomSelectorProps {
  readonly contextual: WorkspaceContextualResolver;
  readonly disabled?: boolean;
  readonly idPrefix: string;
  readonly label?: string;
  readonly onSelect: (gameName: string) => void;
  readonly owner: WorkspaceRoomPickerControl['address'];
  readonly placeholder?: string;
}

const emptyModel: ContextualPickerModel<RoomDeclaration> = Object.freeze({
  sections: Object.freeze([]),
});

export function RoomSelector({
  contextual,
  disabled = false,
  idPrefix,
  label = 'Room',
  onSelect,
  owner,
  placeholder = 'Select a room',
}: RoomSelectorProps) {
  const interaction = contextual.resolveRoom(owner);
  const [projection, setProjection] = useState<{
    readonly interaction: WorkspaceRoomInteraction;
    readonly model: ContextualPickerModel<RoomDeclaration>;
  }>();
  const model = projection?.interaction === interaction ? projection.model : emptyModel;

  return (
    <ContextualPicker
      disabled={disabled}
      id={`${idPrefix}-room`}
      label={label}
      model={model}
      onOpenChange={(open) => {
        if (open && projection?.interaction !== interaction) {
          setProjection(Object.freeze({ interaction, model: interaction.load() }));
        }
      }}
      onSelect={(room) => onSelect(room.gameName)}
      placeholder={disabled ? 'Topology target limit reached' : placeholder}
      {...(interaction.selected === undefined ? {} : { triggerLabel: interaction.selected.label })}
    />
  );
}
