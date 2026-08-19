import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type { WorkspaceRoomInteraction } from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';

interface RoomSelectorProps {
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  readonly disabledPlaceholder?: string;
  readonly idPrefix: string;
  readonly interaction: WorkspaceRoomInteraction;
  readonly label?: string;
  readonly onSelect: (gameName: string) => void;
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
  ariaLabel,
  disabled = false,
  disabledPlaceholder = 'Room limit reached',
  idPrefix,
  interaction,
  label = 'Room',
  onSelect,
  placeholder = 'Select a room',
}: RoomSelectorProps) {
  const projection = useWorkspaceInteraction(interaction);
  const model = projection.result ?? emptyModel;

  return (
    <ContextualPicker
      {...(ariaLabel === undefined ? {} : { ariaLabel })}
      disabled={disabled}
      id={`${idPrefix}-room`}
      label={label}
      layout="inline"
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
