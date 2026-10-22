import { ActionIcon, type ActionIconName } from './ActionIcon';
import { hintProps } from './hint';

/** A row action shown as an icon, named for screen readers and hinted with its action. */
export function IconActionButton({
  disabled = false,
  hint,
  icon,
  label,
  onClick,
  tone,
}: {
  readonly icon: ActionIconName;
  /** The accessible name, such as "Delete Erebus run". */
  readonly label: string;
  /** The hover and focus hint, the action itself, such as "Delete". */
  readonly hint: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly tone?: 'danger';
}) {
  return (
    <button
      aria-label={label}
      className="icon-action"
      data-tone={tone}
      disabled={disabled}
      onClick={onClick}
      type="button"
      {...hintProps(hint, undefined, label)}
    >
      <ActionIcon name={icon} />
    </button>
  );
}
