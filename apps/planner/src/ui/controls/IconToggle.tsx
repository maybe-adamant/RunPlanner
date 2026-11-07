import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import type { FindingMarkProps, FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { hintProps } from './hint';

/**
 * A yes/no flag as its icon alone: dim when off, lit when on, gray and locked
 * when it cannot change. The icon alone does not say what it means, so its
 * name is also its hint on hover and focus.
 */
export function IconToggle({
  badge,
  detail,
  disabled = false,
  disabledHint,
  icon,
  inapplicable,
  inapplicableHint,
  name,
  onToggle,
  pressed,
  slot,
  opensDialog,
  target,
}: {
  /** A short corner mark, such as the route number of a room the flag points to. */
  readonly badge?: string | undefined;
  /** What the flag points to, shown after its name on hover. */
  readonly detail?: string | undefined;
  readonly disabled?: boolean;
  /** Why a disabled toggle cannot change, shown after its name. */
  readonly disabledHint?: string | undefined;
  readonly icon: ArtworkSource | undefined;
  /** A retained value with no effect here: still clearable, but quiet. */
  readonly inapplicable?: boolean;
  readonly inapplicableHint?: string;
  readonly name: string;
  /** Whether a press opens a confirming dialog, and that dialog is open. */
  readonly opensDialog?: { readonly open: boolean } | undefined;
  /** A fixed slot the toggle keeps in its group, so icons line up across rows. */
  readonly slot?: string;
  readonly onToggle: (next: boolean) => void;
  readonly pressed: boolean;
  /** The flag's finding target or mark. */
  readonly target?: FindingMarkProps | FindingTargetProps;
}) {
  const description = target?.['aria-description'];
  const reason = disabled ? disabledHint : (inapplicableHint ?? detail);
  const hint = reason === undefined ? name : `${name} · ${reason}`;
  const { 'data-hint': shownHint, ...accessibleHint } = hintProps(hint, description, name);
  const button = (
    <button
      {...target}
      {...(disabled ? accessibleHint : { ...accessibleHint, 'data-hint': shownHint })}
      aria-expanded={opensDialog?.open}
      aria-haspopup={opensDialog === undefined ? undefined : 'dialog'}
      aria-label={name}
      aria-pressed={pressed}
      className="icon-toggle"
      data-inapplicable={inapplicable === true ? '' : undefined}
      data-slot={slot}
      disabled={disabled || undefined}
      onClick={() => onToggle(!pressed)}
      type="button"
    >
      <ArtworkIcon className="artwork-label-icon" source={icon} />
      {disabled ? (
        <IconToggleLock />
      ) : badge === undefined ? null : (
        <span aria-hidden="true" className="timeline-chip-badge">
          {badge}
        </span>
      )}
    </button>
  );
  // A disabled button takes no pointer events, so its hint sits on a wrapper.
  return disabled ? (
    <span className="icon-toggle-disabled" data-hint={shownHint}>
      {button}
    </span>
  ) : (
    button
  );
}

/** The corner lock of a toggle that cannot change. */
export function IconToggleLock() {
  return (
    <span aria-hidden="true" className="icon-toggle-lock">
      <svg viewBox="0 0 10 10">
        <path
          d="M3 4.5V3.2a2 2 0 0 1 4 0v1.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <rect fill="currentColor" height="4.5" rx="0.8" width="6.4" x="1.8" y="4.5" />
      </svg>
    </span>
  );
}
