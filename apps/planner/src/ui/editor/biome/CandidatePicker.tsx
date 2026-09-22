import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspacePickerCandidateInteraction } from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

const emptyModel: ContextualPickerModel<never> = Object.freeze({ sections: Object.freeze([]) });

interface CandidatePickerProps<T extends number | string> {
  readonly bindFindingTarget?: boolean;
  readonly id: string;
  readonly interaction: WorkspacePickerCandidateInteraction<T>;
  readonly label: string;
  readonly onReplace: (value: T) => void;
  readonly placeholder: string;
}

/**
 * The shared control for scalar settings that rest on route-wide support math.
 * A plain label cannot say why one choice is required or excluded, so the
 * choices are shown with their support state and the evidence behind it. Like
 * every contextual picker, it performs no candidate work until it opens.
 */
export function CandidatePicker<T extends number | string>({
  bindFindingTarget = true,
  id,
  interaction,
  label,
  onReplace,
  placeholder,
}: CandidatePickerProps<T>) {
  const findingTarget = useFindingTarget();
  const projection = useWorkspaceInteraction(interaction.picker);
  const model = (projection.result ?? emptyModel) as ContextualPickerModel<T>;
  const selected = interaction.choices.find((choice) => choice.value === interaction.selected);

  return (
    <ContextualPicker
      {...(bindFindingTarget ? { findingTarget: findingTarget(interaction.owner, id) } : {})}
      id={id}
      label={label}
      layout="inline"
      loading={projection.pending}
      model={model}
      onOpenChange={(open) => {
        if (open) projection.activate();
      }}
      onSelect={onReplace}
      placeholder={placeholder}
      // Support evidence lives in the popover; under the trigger it is only a
      // warning for a selection the controller no longer supports.
      selectedExplanation="impossible-only"
      {...(selected === undefined ? {} : { triggerLabel: selected.label })}
    />
  );
}
