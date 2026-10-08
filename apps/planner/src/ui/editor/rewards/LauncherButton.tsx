import type { WorkspaceLauncherPresentation } from '@planner/projections/structured-workspace';
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
      aria-description={findings === undefined ? launcher.detail : `${launcher.detail} ${findings}`}
      className="dialog-launcher trait-offer-launcher quiet-action action-compact"
      disabled={!contextReached || undefined}
      onClick={onClick}
      title={contextReached ? launcher.detail : candidateWaitingTitle}
      type="button"
    >
      <span>{launcher.label}</span>
    </button>
  );
}
