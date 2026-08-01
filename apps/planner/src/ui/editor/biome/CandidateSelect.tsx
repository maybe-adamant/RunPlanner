import { presentCandidateLabel } from '@planner/projections/candidateProjection';
import type { WorkspaceCandidateInteraction } from '@planner/projections/structured-workspace';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateSelectState,
} from '@planner/ui/feedback/candidatePresentation';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';

type SelectValue = number | string;

interface CandidateSelectProps<T extends SelectValue> {
  readonly id: string;
  readonly interaction: WorkspaceCandidateInteraction<T>;
  readonly label: string;
  readonly onReplace: (value: T) => void;
  readonly placeholder?: string;
}

/**
 * Small shared control for candidate-backed scalar settings. It deliberately
 * performs no work until focus or pointer intent asks for candidate evidence.
 */
export function CandidateSelect<T extends SelectValue>({
  id,
  interaction,
  label,
  onReplace,
  placeholder,
}: CandidateSelectProps<T>) {
  const candidates = useWorkspaceInteraction(interaction);
  const selected = candidates.result?.find((option) => option.value === interaction.selected);
  const value = interaction.selected === undefined ? '' : String(interaction.selected);

  const replace = (raw: string): void => {
    const choice = interaction.choices.find((candidate) => String(candidate.value) === raw);
    const option = candidates.result?.find((candidate) => candidate.value === choice?.value);
    if (choice !== undefined && candidateMayBeAuthored(option)) onReplace(choice.value);
  };

  return (
    <label className="field-control biome-candidate-select" htmlFor={id}>
      <span className="field-label-with-marker">
        {label}
        <SemanticOwnerMarker address={interaction.owner} />
      </span>
      <select
        {...candidateSelectState(selected)}
        aria-busy={candidates.pending || undefined}
        id={id}
        onChange={(event) => replace(event.target.value)}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        value={value}
      >
        {placeholder === undefined ? null : (
          <option disabled value="">
            {placeholder}
          </option>
        )}
        {interaction.choices.map((choice) => {
          const option = candidates.result?.find((candidate) => candidate.value === choice.value);
          const retainsImpossibleValue =
            interaction.selected === choice.value &&
            option !== undefined &&
            !candidateMayBeAuthored(option);
          if (option !== undefined && !candidateMayBeAuthored(option) && !retainsImpossibleValue) {
            return null;
          }
          return (
            <option
              disabled={retainsImpossibleValue}
              key={String(choice.value)}
              value={String(choice.value)}
              {...candidateSelectState(option)}
            >
              {presentCandidateLabel(choice.label, option)}
            </option>
          );
        })}
      </select>
    </label>
  );
}
