import type { WorkspaceLauncherPresentation } from '@planner/projections/structured-workspace';
import { hintProps } from '@planner/ui/controls/hint';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';

/** One neutral dialog launcher: a one-line label, its full summary on hover and as description. */
export function LauncherButton({
  contextReached,
  launcher,
  onClick,
  target,
}: {
  readonly contextReached: boolean;
  readonly launcher: WorkspaceLauncherPresentation;
  readonly onClick: () => void;
  /** A navigation target, or a mark within an anchor that navigation focuses. */
  readonly target: FindingMarkProps & { readonly id: string };
}) {
  const findings = target['aria-description'];
  return (
    <button
      {...target}
      {...(contextReached
        ? hintProps(launcher.detail, findings)
        : hintProps(
            candidateWaitingHint,
            [launcher.detail, findings].filter((part) => part !== undefined).join(' ') || undefined,
          ))}
      className="dialog-launcher trait-offer-launcher quiet-action action-compact"
      disabled={!contextReached || undefined}
      onClick={onClick}
      type="button"
    >
      <span>{launcher.label}</span>
    </button>
  );
}
