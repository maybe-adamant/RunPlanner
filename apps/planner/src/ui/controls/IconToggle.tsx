import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import type { FindingMarkProps, FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';
import { hintProps } from './hint';

/**
 * A yes/no flag as its icon alone: dim when off, lit when on. The icon alone
 * does not say what it means, so its name is also its hint on hover and focus.
 */
export function IconToggle({
  icon,
  inapplicable,
  inapplicableHint,
  name,
  onToggle,
  pressed,
  slot,
  target,
}: {
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
  const hint = inapplicableHint === undefined ? name : `${name} · ${inapplicableHint}`;
  return (
    <button
      {...target}
      {...hintProps(hint, description, name)}
      aria-label={name}
      aria-pressed={pressed}
      className="icon-toggle"
      data-inapplicable={inapplicable === true ? '' : undefined}
      data-slot={slot}
      onClick={() => onToggle(!pressed)}
      type="button"
    >
      <ArtworkIcon className="artwork-label-icon" source={icon} />
    </button>
  );
}
