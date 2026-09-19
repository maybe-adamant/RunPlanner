import type { WorkspaceStartInteraction } from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

export function BiomeEntryPicker({
  interaction,
}: {
  readonly interaction: WorkspaceStartInteraction;
}) {
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  return (
    <ContextualPicker
      id={semanticOwnerControlElementId(interaction.owner)}
      findingTarget={findingTarget(interaction.owner)}
      label="Starting room"
      layout="inline"
      placeholder="Choose room"
      model={interaction.picker}
      onSelect={(gameName) => executeIntent(interaction.intent(gameName))}
    />
  );
}
