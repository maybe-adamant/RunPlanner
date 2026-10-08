import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import { hintProps } from '@planner/ui/controls/hint';

export function TimelineActionDeleteButton({
  enabled,
  explanation,
  findingMark,
  label,
  onRemove,
}: {
  readonly enabled: boolean;
  /** Findings of an action that should not exist. */
  readonly findingMark?: FindingMarkProps;
  readonly explanation: string | undefined;
  readonly label: string;
  readonly onRemove: () => void;
}) {
  return (
    <button
      {...findingMark}
      aria-label={`Remove ${label} from timeline`}
      className={`${enabled ? 'danger-action' : 'quiet-action'} room-action-delete`}
      disabled={!enabled}
      onClick={onRemove}
      {...hintProps(explanation, findingMark?.['aria-description'])}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <path d="M3.5 4.5h9M6 2.5h4l.5 2h-5l.5-2Zm-1 2 .5 9h5l.5-9M7 7v4M9 7v4" />
      </svg>
    </button>
  );
}
