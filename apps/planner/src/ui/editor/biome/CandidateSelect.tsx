import { presentCandidateLabel } from '@planner/projections/candidates/candidateProjection';
import type { WorkspaceNativeCandidateInteraction } from '@planner/projections/structured-workspace';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import {
  candidateMayBeAuthored,
  candidateSelectState,
  candidateWaitingTitle,
  candidateWaits,
} from '@planner/ui/feedback/candidatePresentation';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

type SelectValue = number | string | null;

interface CandidateSelectProps<T extends SelectValue> {
  readonly bindFindingTarget?: boolean;
  readonly id: string;
  readonly interaction: WorkspaceNativeCandidateInteraction<T>;
  readonly label: string;
  readonly onReplace: (value: T) => void;
  readonly placeholder?: string;
}

/**
 * Small shared control for candidate-backed scalar settings. It deliberately
 * performs no work until focus or pointer intent asks for candidate evidence.
 */
export function CandidateSelect<T extends SelectValue>({
  bindFindingTarget = true,
  id,
  interaction,
  label,
  onReplace,
  placeholder,
}: CandidateSelectProps<T>) {
  const findingTarget = useFindingTarget();
  const candidates = useWorkspaceInteraction(interaction);
  const selected = candidates.result?.find((option) => option.value === interaction.selected);
  const value = interaction.selected == null ? '' : String(interaction.selected);
  // An unreached context disables the whole setting on render; loaded candidates back it up.
  const waiting =
    !interaction.contextReached ||
    (candidates.result !== undefined &&
      candidates.result.length > 0 &&
      candidates.result.every(candidateWaits));

  const replace = (raw: string): void => {
    const choice = interaction.choices.find((candidate) =>
      candidate.value === null ? raw === '' : String(candidate.value) === raw,
    );
    const option = candidates.result?.find((candidate) => candidate.value === choice?.value);
    if (choice !== undefined && candidateMayBeAuthored(option)) onReplace(choice.value);
  };

  return (
    <label className="field-control field-control-inline biome-candidate-select" htmlFor={id}>
      <span>{label}</span>
      <select
        {...(bindFindingTarget ? findingTarget(interaction.owner, id) : {})}
        {...candidateSelectState(selected)}
        aria-busy={candidates.pending || undefined}
        disabled={waiting || undefined}
        id={id}
        onChange={(event) => replace(event.target.value)}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        title={waiting ? candidateWaitingTitle : undefined}
        value={value}
      >
        {placeholder === undefined ? null : (
          <option disabled value="">
            {placeholder}
          </option>
        )}
        {interaction.choices.map((choice) => {
          const option = candidates.result?.find((candidate) => candidate.value === choice.value);
          const impossible = option !== undefined && !candidateMayBeAuthored(option);
          return (
            <option
              disabled={impossible}
              key={String(choice.value)}
              value={choice.value === null ? '' : String(choice.value)}
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
