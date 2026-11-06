import type { WorkspaceTimelineChip } from '@planner/projections/structured-workspace';
import { hintProps, type HintProps } from '@planner/ui/controls/hint';

function chipName(chip: WorkspaceTimelineChip): string {
  return chip.state === 'rejected' || chip.state === 'removed'
    ? `${chip.label}, ${chip.state}`
    : chip.label;
}

/** A chip's name, state and ring; its name and state are also its hover. */
export function timelineChipProps(chip: WorkspaceTimelineChip): HintProps & {
  readonly 'aria-label': string;
  readonly className: string;
  readonly 'data-chip-state': WorkspaceTimelineChip['state'];
  readonly 'data-rarity'?: string;
} {
  const name = chipName(chip);
  return {
    ...hintProps(name, undefined, name),
    'aria-label': name,
    className: 'timeline-chip',
    'data-chip-state': chip.state,
    ...(chip.rarity === undefined ? {} : { 'data-rarity': chip.rarity }),
  };
}
