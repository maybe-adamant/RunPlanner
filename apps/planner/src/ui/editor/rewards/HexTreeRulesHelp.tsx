import { EditorDialogHelp } from '@planner/ui/controls/EditorDialog';

/** How a Hex tree is edited, on the enclosing dialog's title line. */
export function HexTreeRulesHelp() {
  return (
    <EditorDialogHelp className="hex-tree-help" label="Hex tree help">
      <p>Common columns are dealt in order from one deck; each draws what earlier columns left.</p>
      <p>
        Deal a column to fill its slots top to bottom. Escape stops a deal and keeps the column.
      </p>
      <p>Rare and Epic nodes pick from their pool, each talent once.</p>
    </EditorDialogHelp>
  );
}
