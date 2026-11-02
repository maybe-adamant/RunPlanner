import { EditorDialogHelp } from '@planner/ui/controls/EditorDialog';

/** How a Hex tree is laid out and dealt, on the enclosing dialog's title line. */
export function HexTreeRulesHelp() {
  return (
    <EditorDialogHelp className="hex-tree-help" label="Hex tree help">
      <h4>Layout</h4>
      <p>
        Choosing a layout generates its default tree. Reset restores the layout&apos;s default tree.
      </p>
      <h4>Common nodes</h4>
      <p>
        Common columns fill in order from a deck holding each common talent once. A deck unfinished
        at a column&apos;s end continues into the next column, and a column that empties a deck
        draws from the next one. Colours mark the columns; the table shows which deck dealt what.
      </p>
      <h4>Editing nodes</h4>
      <p>
        Rare and Epic nodes pick from their pool, each talent once. Common nodes swap within their
        column, trade with another column of the same deck, or, in the last deck, swap for an unused
        talent.
      </p>
    </EditorDialogHelp>
  );
}
