import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
  type WorkspaceRewardControl,
} from '@planner/projections/structured-workspace';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { CountedRewardEditor, RewardValueEditor } from './RewardEditors';

/** Complete intent-bound editor for every authored reward leaf. */
export function RewardControlEditor({
  control,
  idPrefix,
  interactions,
}: {
  readonly control: WorkspaceRewardControl;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.rewards,
    workspaceInteractionKey(control.owner.address),
  );
  const onReplace = (value: Parameters<typeof interaction.intentFor>[0]): void =>
    executeIntent(interaction.intentFor(value));
  return control.kind === 'countedReward' ? (
    <CountedRewardEditor
      candidateOwner={control.owner}
      idPrefix={idPrefix}
      interactions={interactions}
      offer={control.offer}
      onReplace={onReplace}
    />
  ) : (
    <RewardValueEditor
      candidateOwner={control.owner}
      idPrefix={idPrefix}
      interactions={interactions}
      offer={control.offer}
      onReplace={onReplace}
    />
  );
}
