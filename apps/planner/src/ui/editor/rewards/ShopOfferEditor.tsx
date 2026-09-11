import type { ShopOptionSelection } from '@run-planner/engine/reward-kernel';
import { useState } from 'react';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRewardControl,
} from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

const emptyModel = Object.freeze({ sections: Object.freeze([]) });

/** Exact Shop item picker; item identity and resolved Boon source commit atomically. */
export function ShopOfferEditor({
  control,
  interactions,
  label,
}: {
  readonly control: WorkspaceRewardControl;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  const [open, setOpen] = useState(false);
  const interaction = requireWorkspaceInteraction(
    interactions.shopOffers,
    workspaceInteractionKey(control.owner.address),
  );
  const domain = useWorkspaceInteraction(interaction);
  return (
    <ContextualPicker<ShopOptionSelection>
      cancelLabel="Cancel"
      choiceLabel="Shop item"
      closeOnSelect={true}
      findingTarget={findingTarget(control.owner.address)}
      id={semanticOwnerControlElementId(control.owner.address)}
      label={label}
      layout="inline"
      loading={domain.pending}
      model={domain.result ?? emptyModel}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) domain.activate();
      }}
      onSelect={(value) => {
        executeIntent(interaction.intentFor(value));
        setOpen(false);
      }}
      open={open}
      placeholder={interaction.summary}
      triggerLabel={interaction.summary}
    />
  );
}
