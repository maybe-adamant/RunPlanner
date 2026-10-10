import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import type { WorkspaceHexBoardNode } from '@planner/projections/structured-workspace';

/** Row spacing and the board's inset, in pixels; columns spread across the board's width. */
const CELL_Y = 58;
const INSET_X = 64;
const INSET_Y = 34;

/** A Hex tree on its native grid: links drawn beneath, each node rendered by its caller. */
export function HexBoard<Node extends WorkspaceHexBoardNode>({
  boardProps,
  linkProps,
  nodes,
  renderNode,
}: {
  readonly boardProps: HTMLAttributes<HTMLDivElement> & { readonly 'aria-label': string };
  /** Data marks for one link's styling. */
  readonly linkProps?: (
    from: Node,
    to: Node,
  ) => Readonly<Record<`data-${string}`, true | undefined>>;
  readonly nodes: readonly Node[];
  readonly renderNode: (node: Node, style: CSSProperties) => ReactNode;
}) {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const spanX = Math.max(...nodes.map((node) => node.x)) - minX || 1;
  const height = (Math.max(...nodes.map((node) => node.y)) - minY) * CELL_Y + INSET_Y * 2;
  const fraction = (node: Node) => (node.x - minX) / spanX;
  const top = (node: Node) => (node.y - minY) * CELL_Y + INSET_Y;
  const byKey = new Map(nodes.map((node) => [node.nodeKey, node]));
  return (
    <div className="hex-tree-scroll">
      <div className="hex-tree-board" role="group" style={{ height }} {...boardProps}>
        <svg
          aria-hidden="true"
          className="hex-tree-links"
          height="100%"
          style={{ left: INSET_X, width: `calc(100% - ${INSET_X * 2}px)` }}
        >
          {nodes.flatMap((node) =>
            node.linkTo.flatMap((target) => {
              const next = byKey.get(target);
              if (next === undefined) return [];
              return [
                <line
                  {...linkProps?.(node, next)}
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
        {nodes.map((node) =>
          renderNode(node, {
            left: `calc(${INSET_X}px + (100% - ${INSET_X * 2}px) * ${fraction(node)})`,
            top: top(node),
          }),
        )}
      </div>
    </div>
  );
}
