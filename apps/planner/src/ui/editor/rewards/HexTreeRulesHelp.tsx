import * as Popover from '@radix-ui/react-popover';
import { useCallback, useId, useState } from 'react';

/** How common Hex nodes are dealt, opened from the dialog header. */
export function HexTreeRulesHelp() {
  const headingId = useId();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const capture = useCallback((node: HTMLButtonElement | null) => {
    setContainer(node?.closest<HTMLElement>('dialog') ?? null);
  }, []);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          aria-label="How common nodes work"
          className="hex-tree-help"
          ref={capture}
          type="button"
        >
          ?
        </button>
      </Popover.Trigger>
      <Popover.Portal container={container ?? undefined}>
        <Popover.Content
          align="end"
          aria-labelledby={headingId}
          className="hex-tree-rules"
          collisionPadding={12}
          sideOffset={6}
        >
          <h3 id={headingId}>How common nodes work</h3>
          <p>
            Common columns fill in order from a deck holding each common talent once. A deck
            unfinished at a column&apos;s end continues into the next column, and a column that
            empties a deck draws from the next one. Colours mark the columns; the table shows which
            deck dealt what.
          </p>
          <p>
            Rare and Epic nodes pick from their pool, each talent once. Common nodes swap within
            their column, trade with another column of the same deck, or, in the last deck, swap for
            an unused talent.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
