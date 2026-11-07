import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import type { FindingMarkProps, FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { hintProps } from './hint';

/**
 * A yes/no flag as its icon alone: dim when off, lit when on. The icon alone
 * does not say what it means, so its name is also its hint on hover and focus.
 */
export function IconToggle({
  disabled = false,
  disabledHint,
  icon,
  inapplicable,
  inapplicableHint,
  name,
  onToggle,
  pressed,
  slot,
  target,
}: {
  readonly disabled?: boolean;
  /** Why a disabled toggle cannot change, shown after its name. */
  readonly disabledHint?: string | undefined;
  readonly icon: ArtworkSource | undefined;
  /** A retained value with no effect here: still clearable, but quiet. */
  readonly inapplicable?: boolean;
  readonly inapplicableHint?: string;
  readonly name: string;
  /** A fixed slot the toggle keeps in its group, so icons line up across rows. */
  readonly slot?: string;
  readonly onToggle: (next: boolean) => void;
  readonly pressed: boolean;
  /** The flag's finding target or mark. */
  readonly target?: FindingMarkProps | FindingTargetProps;
}) {
  const description = target?.['aria-description'];
  const reason = disabled ? disabledHint : inapplicableHint;
  const hint = reason === undefined ? name : `${name} · ${reason}`;
  const { 'data-hint': shownHint, ...accessibleHint } = hintProps(hint, description, name);
  const button = (
    <button
      {...target}
      {...(disabled ? accessibleHint : { ...accessibleHint, 'data-hint': shownHint })}
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
