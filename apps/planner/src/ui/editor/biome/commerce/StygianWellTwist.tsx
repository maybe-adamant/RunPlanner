import type { ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { wellArtwork } from '@planner/ui/artwork/well/wellArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { StygianWellSlotPicker } from './RoomInventoryPanel';

const wellIcon = (itemKey: string): string | undefined => wellArtwork[itemKey] ?? undefined;

const emptyNullablePicker: ContextualPickerModel<string | null> = Object.freeze({
  sections: Object.freeze([]),
});

/** A Fateful Twist purchase: the bought item's chip, an arrow, then the item it turned into. */
export function StygianWellTwistChips({
  bought,
  interactions,
  label,
  twist,
}: {
  /** The bought item shown where its Well stock cannot be edited here. */
  readonly bought: ReactNode;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly twist: NonNullable<WorkspaceRoomActionRow['stygianWellTwist']>;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.stygianWellTwistResults,
    twist.interactionKey,
  );
  const picker = useWorkspaceInteraction(interaction);
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  return (
    <>
      {twist.boughtSlot === undefined ? (
        bought
      ) : (
        <StygianWellSlotPicker
          fieldLabel=""
          interactions={interactions}
          required
          slot={twist.boughtSlot}
        />
      )}
      <span aria-hidden="true" className="row-reward-arrow">
        →
      </span>
      <ContextualPicker
        findingTarget={findingTarget(twist.address)}
        ariaLabel={`${label} Twist result`}
        id={`${interaction.key}-picker`}
        itemIcon={(item) => (item.value === null ? undefined : wellIcon(item.value))}
        label=""
        layout="inline"
        loading={picker.pending}
        model={picker.result ?? emptyNullablePicker}
        onOpenChange={(open) => {
          if (open) picker.activate();
        }}
        onSelect={(itemKey) => executeIntent(interaction.intentFor(itemKey))}
        placeholder="Unresolved"
        triggerIcon={twist.itemKey === null ? undefined : wellIcon(twist.itemKey)}
        {...(twist.itemLabel === undefined ? {} : { triggerLabel: twist.itemLabel })}
        triggerSize="icon"
        triggerUnknown
      />
    </>
  );
}
