import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import type { ContextualPickerModel } from '../../../projections/contextualPicker';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomPickerControl,
} from '../../../projections/structuredWorkspace';
import { ContextualPicker } from '../../controls/ContextualPicker';
import { useWorkspaceInteraction } from '../../controls/useWorkspaceInteraction';

interface RoomSelectorProps {
  readonly disabled?: boolean;
  readonly disabledPlaceholder?: string;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label?: string;
  readonly onSelect: (gameName: string) => void;
  readonly owner: WorkspaceRoomPickerControl['address'];
  readonly placeholder?: string;
}

const emptyModel: ContextualPickerModel<RoomDeclaration> = Object.freeze({
  sections: Object.freeze([]),
});

/**
 * Projection-only room picker shared by every ordinary physical target.
 * Candidate work is intentionally deferred until its picker opens.
 */
export function RoomSelector({
  disabled = false,
  disabledPlaceholder = 'Room limit reached',
  idPrefix,
  interactions,
  label = 'Room',
  onSelect,
  owner,
  placeholder = 'Select a room',
}: RoomSelectorProps) {
  const interaction = requireWorkspaceInteraction(
    interactions.rooms,
    workspaceInteractionKey(owner),
  );
  const projection = useWorkspaceInteraction(interaction);
  const model = projection.result ?? emptyModel;

  return (
    <ContextualPicker
      disabled={disabled}
      id={`${idPrefix}-room`}
      label={label}
      loading={projection.pending}
      model={model}
      onOpenChange={(open) => {
        if (open) projection.activate();
      }}
      onSelect={(room) => onSelect(room.gameName)}
      placeholder={disabled ? disabledPlaceholder : placeholder}
      {...(interaction.selected === undefined ? {} : { triggerLabel: interaction.selected.label })}
    />
  );
}
