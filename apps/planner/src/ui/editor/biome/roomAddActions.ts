import type { ContextualPickerItem } from '@planner/projections/contextual/contextualPicker';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import type { RoomAddAction } from './RoomAddMenu';

/** One mark carrying every marked finding of an object's actions, the first owner focused. */
export function combinedFindingMark(
  marks: readonly (FindingMarkProps | undefined)[],
): FindingMarkProps | undefined {
  const marked = marks.filter(
    (mark): mark is FindingMarkProps => mark?.['data-has-findings'] === true,
  );
  if (marked.length === 0) return undefined;
  return {
    'data-semantic-owner': marked[0]!['data-semantic-owner'],
    'data-has-findings': true,
    'aria-description': marked
      .map((mark) => mark['aria-description'])
      .filter((text) => text !== undefined)
      .join(' '),
  };
}

/** Optional actions as picker items, listed with any unavailable reason. */
export function roomAddActionItems(
  actions: readonly RoomAddAction[],
  keyPrefix = '',
): readonly ContextualPickerItem<string>[] {
  return actions.map((action) =>
    Object.freeze({
      disabled: action.unavailable !== undefined,
      key: `${keyPrefix}${action.key}`,
      label: action.label,
      selected: false,
      state: action.unavailable === undefined ? ('possible' as const) : ('impossible' as const),
      value: `${keyPrefix}${action.key}`,
      ...(action.unavailable === undefined
        ? {}
        : { explanations: Object.freeze([action.unavailable]) }),
    }),
  );
}
