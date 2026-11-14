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
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { OfferConditionMark } from '@planner/ui/feedback/OfferConditionMark';
import { RowChoice } from '../RowChoice';
import { StygianWellSlotPicker } from './RoomInventoryPanel';

const wellIcon = (itemKey: string): string | undefined => wellArtwork[itemKey] ?? undefined;

const emptyPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

/** A Fateful Twist purchase: the bought item's chip, an arrow, then the item it turned into. */
export function StygianWellTwistChips({
  bought,
  interactions,
  label,
  rowKey,
  twist,
}: {
  /** The bought item shown where its Well stock cannot be edited here. */
  readonly bought: ReactNode;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  /** The purchase row, whose placement opens the result. */
  readonly rowKey: string;
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
        <StygianWellSlotPicker fieldLabel="" interactions={interactions} slot={twist.boughtSlot} />
      )}
      <span aria-hidden="true" className="row-reward-arrow">
        →
      </span>
      <RowChoice choice="stygianWellTwist" rowKey={rowKey}>
        <ContextualPicker
          findingTarget={findingTarget(twist.address)}
          ariaLabel={`${label} Twist result`}
          id={`${interaction.key}-picker`}
          itemIcon={(item) => wellIcon(item.value)}
          label=""
          layout="inline"
          loading={picker.pending}
          model={picker.result ?? emptyPicker}
          onOpenChange={(open) => {
            if (open) picker.activate();
          }}
          onSelect={(itemKey) => executeIntent(interaction.intentFor(itemKey))}
          placeholder="Twist result"
          triggerIcon={twist.itemKey === null ? undefined : wellIcon(twist.itemKey)}
          {...(twist.itemLabel === undefined ? {} : { triggerLabel: twist.itemLabel })}
          triggerSize="icon"
          triggerUnknown
          {...(interaction.contextReached ? {} : { disabledHint: candidateWaitingHint })}
        />
      </RowChoice>
      {/* The result is decided at use, so its condition is marked on the result itself. */}
      <OfferConditionMark conditions={[interaction.selectedOfferCondition]} />
    </>
  );
}
