import type { AuthoredHexTreeEdit } from '@run-planner/engine/authored-project';
import { useState } from 'react';

import type { CSSProperties, ReactElement } from 'react';

import type {
  WorkspaceHexDeckTable,
  WorkspaceHexTreeDomain,
  WorkspaceHexTreeNode,
} from '@planner/projections/structured-workspace';
import { ContextualPicker, ContextualPickerPopover } from '@planner/ui/controls/ContextualPicker';
import { hintProps } from '@planner/ui/controls/hint';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

/** Row spacing and the board's inset, in pixels; columns spread across the board's width. */
const CELL_Y = 58;
const INSET_X = 64;
const INSET_Y = 34;
/** Pickers with more options than this offer a search box. */
const SEARCH_THRESHOLD = 8;

/** The open node picker and the trigger it was opened from: the board node or a table talent. */
interface OpenPicker {
  readonly nodeKey: string;
  readonly anchor: string;
}

/** The planner-owned Hex tree on its native grid; each node edits by its own kind. */
export function HexTreeBoard({
  domain,
  onEdit,
}: {
  readonly domain: WorkspaceHexTreeDomain;
  readonly onEdit: (edit: AuthoredHexTreeEdit) => void;
}) {
  const findingTarget = useFindingTarget();
  const [open, setOpen] = useState<OpenPicker>();
  const [activeItemKey, setActiveItemKey] = useState<string>();
  const [hoveredNodeKey, setHoveredNodeKey] = useState<string>();
  // Pickers stay within the editor rather than overflowing its dialog.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const idBase = semanticOwnerControlElementId(domain.address);
  const minX = Math.min(...domain.nodes.map((node) => node.x));
  const minY = Math.min(...domain.nodes.map((node) => node.y));
  const spanX = Math.max(...domain.nodes.map((node) => node.x)) - minX || 1;
  const height = (Math.max(...domain.nodes.map((node) => node.y)) - minY) * CELL_Y + INSET_Y * 2;
  const fraction = (node: WorkspaceHexTreeNode) => (node.x - minX) / spanX;
  const top = (node: WorkspaceHexTreeNode) => (node.y - minY) * CELL_Y + INSET_Y;
  const position = (node: WorkspaceHexTreeNode) => ({
    left: `calc(${INSET_X}px + (100% - ${INSET_X * 2}px) * ${fraction(node)})`,
    top: top(node),
  });
  const byKey = new Map(domain.nodes.map((node) => [node.nodeKey, node]));
  // The nodes the open node's active choice or the decks table involves.
  const openEditor = open === undefined ? undefined : byKey.get(open.nodeKey)?.editor;
  const involved = new Set([
    ...(activeItemKey === undefined ? [] : (openEditor?.relatedNodeKeys[activeItemKey] ?? [])),
    ...(hoveredNodeKey === undefined ? [] : [hoveredNodeKey]),
  ]);
  // One picker per node, opened from its board node or its table talent.
  const picker = (node: WorkspaceHexTreeNode, anchor: string, trigger: ReactElement) => {
    const editor = node.editor!;
    const count = editor.model.sections.reduce((sum, section) => sum + section.items.length, 0);
    return (
      <ContextualPickerPopover
        choiceLabel="talent"
        heading={editor.heading}
        key={`${node.nodeKey}-${anchor}`}
        model={editor.model}
        onActiveChange={(item) => setActiveItemKey(item?.key)}
        onOpenChange={(next) => {
          setActiveItemKey(undefined);
          setOpen(next ? { nodeKey: node.nodeKey, anchor } : undefined);
        }}
        onSelect={onEdit}
        open={open?.nodeKey === node.nodeKey && open.anchor === anchor}
        collisionBoundary={root}
        searchable={count > SEARCH_THRESHOLD}
      >
        {trigger}
      </ContextualPickerPopover>
    );
  };
  return (
    <div className="hex-tree-editor" ref={setRoot}>
      <div className="hex-tree-toolbar">
        <ContextualPicker
          ariaLabel="Hex talent layout"
          id={`${idBase}-layout`}
          label="Layout"
          layout="inline"
          model={domain.layoutPicker}
          onSelect={(layoutKey) => {
            onEdit({ kind: 'changeLayout', layoutKey });
          }}
          placeholder="Choose a layout"
        />
        <button className="quiet-action" onClick={() => onEdit({ kind: 'reset' })} type="button">
          Reset to default
        </button>
        <p className="hex-tree-note">Choosing a layout generates its default tree.</p>
      </div>
      <div className="hex-tree-scroll">
        <div
          aria-label={`${domain.layoutPicker.selected?.label ?? domain.value.layoutKey} Hex tree`}
          className="hex-tree-board"
          role="group"
          style={{ height }}
          {...findingTarget(domain.address, `${idBase}-board`)}
        >
          <svg
            aria-hidden="true"
            className="hex-tree-links"
            height={height}
            style={{ left: INSET_X, width: `calc(100% - ${INSET_X * 2}px)` }}
          >
            {domain.nodes.flatMap((node) =>
              node.linkTo.flatMap((target) => {
                const next = byKey.get(target);
                if (next === undefined) return [];
                return [
                  <line
                    data-olympian={next.kind.startsWith('olympian') || undefined}
                    key={`${node.nodeKey}-${target}`}
                    x1={`${fraction(node) * 100}%`}
                    x2={`${fraction(next) * 100}%`}
                    y1={top(node)}
                    y2={top(next)}
                  />,
                ];
              }),
            )}
          </svg>
          {domain.nodes.map((node) => {
            const style = position(node);
            const marks = {
              'data-common-column': node.commonColumn,
              'data-involved': involved.has(node.nodeKey) || undefined,
            };
            if (node.editor === undefined)
              return (
                <span
                  aria-label={node.name}
                  className="hex-tree-node"
                  data-kind={node.kind}
                  key={node.nodeKey}
                  role="note"
                  style={style}
                  tabIndex={0}
                  {...marks}
                  {...hintProps(`${node.talentLabel} appears once God Sent is eligible.`)}
                >
                  {node.talentLabel}
                </span>
              );
            return picker(
              node,
              'board',
              <button
                aria-label={node.name}
                className="hex-tree-node"
                data-editing={open?.nodeKey === node.nodeKey || undefined}
                data-has-findings={node.conflict}
                data-kind={node.kind}
                id={`${idBase}-${node.nodeKey}`}
                style={style}
                type="button"
                {...marks}
              >
                {node.talentLabel}
              </button>,
            );
          })}
        </div>
      </div>
      <HexDeckTable
        decks={domain.decks}
        onHover={setHoveredNodeKey}
        picker={(nodeKey, anchor, trigger) => {
          const node = byKey.get(nodeKey);
          return node?.editor === undefined ? trigger : picker(node, anchor, trigger);
        }}
      />
    </div>
  );
}

/** Which deck dealt each Common talent; each talent opens its node's picker. */
function HexDeckTable({
  decks,
  onHover,
  picker,
}: {
  readonly decks: WorkspaceHexDeckTable;
  readonly onHover: (nodeKey: string | undefined) => void;
  readonly picker: (nodeKey: string, anchor: string, trigger: ReactElement) => ReactElement;
}) {
  return (
    <div className="hex-deck-scroll">
      <table
        className="hex-deck-table"
        style={
          {
            '--hex-chip-length': decks.chipLength,
            '--hex-column-count': decks.columns.length,
          } as CSSProperties
        }
      >
        <caption>Common decks</caption>
        <thead>
          <tr>
            <td />
            {decks.columns.map((column) => (
              <th data-common-column={column.commonColumn} key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {decks.rows === undefined ? (
            <tr>
              <td className="hex-deck-unreadable" colSpan={decks.columns.length + 1}>
                {decks.unreadable}
              </td>
            </tr>
          ) : (
            decks.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, index) => (
                  <td key={decks.columns[index]!.key}>
                    <div className="hex-deck-cell">
                      {cell.map((talent) =>
                        picker(
                          talent.nodeKey,
                          `deck-${row.key}-${talent.key}`,
                          <button
                            aria-label={talent.name}
                            className="hex-deck-talent"
                            onBlur={() => onHover(undefined)}
                            onFocus={() => onHover(talent.nodeKey)}
                            onMouseEnter={() => onHover(talent.nodeKey)}
                            onMouseLeave={() => onHover(undefined)}
                            type="button"
                          >
                            {talent.label}
                          </button>,
                        ),
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
