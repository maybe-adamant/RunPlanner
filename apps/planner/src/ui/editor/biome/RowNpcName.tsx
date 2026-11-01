import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { hintProps } from '@planner/ui/controls/hint';

/** A row's NPC as its portrait, with the name as tooltip and accessible name. */
export function RowNpcName({
  name,
  portrait,
}: {
  readonly name: string;
  readonly portrait: string;
}) {
  return (
    <span className="row-reward-name">
      <span
        {...hintProps(name, undefined, name)}
        aria-label={name}
        className="row-reward-icon"
        role="img"
      >
        <ArtworkIcon className="artwork-label-icon" source={portrait} />
      </span>
    </span>
  );
}
