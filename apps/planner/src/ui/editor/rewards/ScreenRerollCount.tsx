import type {
  WorkspaceScreenRerollLock,
  WorkspaceScreenRerolls,
} from '@planner/projections/structured-workspace';
import { hintProps } from '@planner/ui/controls/hint';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';

function lockHint(lock: WorkspaceScreenRerollLock | undefined): string | undefined {
  switch (lock) {
    case undefined:
      return undefined;
    case 'unreached':
      return candidateWaitingHint;
    case 'notEnabled':
      return 'Rerolls are not enabled.';
    case 'poolEmpty':
      return 'No rerolls left.';
    case 'poolShort':
      return 'Not enough rerolls left.';
  }
}

/** The screen's native rerolls before its final rows. */
export function ScreenRerollCount({
  count,
  onChange,
  rerolls,
}: {
  readonly count: number;
  readonly onChange: (count: number) => void;
  readonly rerolls: WorkspaceScreenRerolls;
}) {
  const atMax = count >= rerolls.maxCount;
  return (
    <div aria-label="Screen rerolls" className="screen-reroll-count" role="group">
      <span className="screen-reroll-count-label">Rerolls</span>
      <button
        aria-label="Fewer rerolls"
        className="quiet-action action-compact"
        disabled={count === 0}
        onClick={() => onChange(count - 1)}
        type="button"
      >
        −
      </button>
      <output aria-live="polite" className="screen-reroll-count-value">
        {count}
      </output>
      <button
        aria-label="More rerolls"
        className="quiet-action action-compact"
        disabled={atMax}
        onClick={() => onChange(count + 1)}
        {...hintProps(atMax ? lockHint(rerolls.lockAtMax) : undefined)}
        type="button"
      >
        +
      </button>
    </div>
  );
}
