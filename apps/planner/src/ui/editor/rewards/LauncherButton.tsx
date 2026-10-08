import type { WorkspaceLauncherPresentation } from '@planner/projections/structured-workspace';
import { hintProps } from '@planner/ui/controls/hint';
import { candidateWaitingTitle } from '@planner/ui/feedback/candidatePresentation';
import type { FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';

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
  readonly target: FindingTargetProps;
}) {
  const findings = target['aria-description'];
  return (
    <button
      {...target}
      {...(contextReached
        ? hintProps(launcher.detail, findings)
        : hintProps(
            candidateWaitingTitle,
            findings === undefined ? launcher.detail : `${launcher.detail} ${findings}`,
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
