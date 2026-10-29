import { type SemanticAddress } from '@run-planner/engine/authored-project';
import { useState } from 'react';

import { useFindingScreens } from '@planner/ui/feedback/useFindingTarget';

/** The open screen tab of one dialog; it opens on the selected finding's screen. */
export function useScreenTab(
  owner: SemanticAddress,
  earlierCount: number,
): {
  /** An earlier screen's index, or `earlierCount` for the final screen. */
  readonly active: number;
  readonly marked: ReadonlySet<number | 'final'>;
  readonly select: (index: number) => void;
} {
  const screens = useFindingScreens(owner);
  const [open, setOpen] = useState<number | 'final'>(() =>
    typeof screens.selected === 'number' && screens.selected < earlierCount
      ? screens.selected
      : 'final',
  );
  const active = open === 'final' || open >= earlierCount ? earlierCount : open;
  return {
    active,
    marked: screens.marked,
    select: (index) => setOpen(index >= earlierCount ? 'final' : index),
  };
}
