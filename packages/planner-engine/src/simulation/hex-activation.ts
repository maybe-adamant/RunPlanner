import type { HexLayoutDeclaration, HexLayoutNodeDeclaration } from '../catalog-schema';

/** Reached tree state one writable talent screen selects against. */
export interface HexActivationContext {
  readonly layout: HexLayoutDeclaration;
  /** The God Sent pair exists only once inserted. */
  readonly godSentAdded: boolean;
  readonly investedNodeKeys: readonly string[];
}

export type HexActivationViolation =
  | { readonly kind: 'selectionCount'; readonly expected: number; readonly actual: number }
  | { readonly kind: 'unknownNode'; readonly nodeKey: string }
  | { readonly kind: 'absentNode'; readonly nodeKey: string }
  | { readonly kind: 'alreadyInvested'; readonly nodeKey: string }
  | { readonly kind: 'duplicateSelection'; readonly nodeKey: string }
  | { readonly kind: 'unreachable'; readonly nodeKey: string }
  | { readonly kind: 'pinsExceedSelections'; readonly count: number };

export type HexActivationCompletion =
  | { readonly ok: true; readonly selection: readonly string[] }
  | { readonly ok: false; readonly violations: readonly HexActivationViolation[] };

function isPresent(context: HexActivationContext, node: HexLayoutNodeDeclaration): boolean {
  return context.godSentAdded || (node.kind !== 'olympianSpell' && node.kind !== 'olympianCount');
}

function presentNodes(context: HexActivationContext): readonly HexLayoutNodeDeclaration[] {
  return context.layout.nodes.values.filter((node) => isPresent(context, node));
}

function investedSet(context: HexActivationContext): ReadonlySet<string> {
  for (const key of context.investedNodeKeys) {
    const node = context.layout.nodes.byKey[key];
    if (node === undefined || !isPresent(context, node))
      throw new Error(`invested Hex node ${key} is not in the tree`);
  }
  return new Set(context.investedNodeKeys);
}

/**
 * Source availability: a node without present backlinks is a root; otherwise a
 * backlink, or for a bidirectional node a `linkTo` neighbour, is invested or queued.
 */
function presentAt(
  context: HexActivationContext,
  depth: number,
  slots: readonly number[],
): readonly HexLayoutNodeDeclaration[] {
  return slots.flatMap((slot) => {
    const node = context.layout.nodes.byKey[`${depth}:${slot}`];
    return node !== undefined && isPresent(context, node) ? [node] : [];
  });
}

function enablers(
  context: HexActivationContext,
  node: HexLayoutNodeDeclaration,
): readonly HexLayoutNodeDeclaration[] {
  return [
    ...presentAt(context, node.depth - 1, node.linkFrom),
    ...(node.bidirectional ? presentAt(context, node.depth + 1, node.linkTo) : []),
  ];
}

function isAvailable(
  context: HexActivationContext,
  node: HexLayoutNodeDeclaration,
  taken: ReadonlySet<string>,
): boolean {
  const backlinks = presentAt(context, node.depth - 1, node.linkFrom);
  if (backlinks.length === 0) return true;
  return enablers(context, node).some((enabler) => taken.has(enabler.key));
}

/** Present, uninvested nodes selectable now; layout order. */
export function availableHexNodes(
  context: HexActivationContext,
  selectedNodeKeys: readonly string[],
): readonly string[] {
  const taken = new Set([...investedSet(context), ...selectedNodeKeys]);
  return Object.freeze(
    presentNodes(context)
      .filter((node) => !taken.has(node.key) && isAvailable(context, node, taken))
      .map((node) => node.key),
  );
}

/** Selected nodes that no order can reach; availability only grows, so closure is order-free. */
function unreachableSelections(
  context: HexActivationContext,
  invested: ReadonlySet<string>,
  selection: readonly HexLayoutNodeDeclaration[],
): readonly HexLayoutNodeDeclaration[] {
  const taken = new Set(invested);
  let pending = [...selection];
  for (;;) {
    const ready = pending.filter((node) => isAvailable(context, node, taken));
    if (ready.length === 0) return pending;
    for (const node of ready) taken.add(node.key);
    pending = pending.filter((node) => !taken.has(node.key));
  }
}

function selectionViolations(
  context: HexActivationContext,
  invested: ReadonlySet<string>,
  nodeKeys: readonly string[],
): { readonly violations: HexActivationViolation[]; readonly nodes: HexLayoutNodeDeclaration[] } {
  const violations: HexActivationViolation[] = [];
  const nodes: HexLayoutNodeDeclaration[] = [];
  const seen = new Set<string>();
  for (const nodeKey of nodeKeys) {
    const node = context.layout.nodes.byKey[nodeKey];
    if (node === undefined) violations.push({ kind: 'unknownNode', nodeKey });
    else if (!isPresent(context, node)) violations.push({ kind: 'absentNode', nodeKey });
    else if (invested.has(nodeKey)) violations.push({ kind: 'alreadyInvested', nodeKey });
    else if (seen.has(nodeKey)) violations.push({ kind: 'duplicateSelection', nodeKey });
    else nodes.push(node);
    seen.add(nodeKey);
  }
  return { violations, nodes };
}

/** Whether one screen's selections are a legal source investment of exactly `count` nodes. */
export function validateHexActivation(
  context: HexActivationContext,
  selectedNodeKeys: readonly string[],
  count: number,
): readonly HexActivationViolation[] {
  const invested = investedSet(context);
  const { violations, nodes } = selectionViolations(context, invested, selectedNodeKeys);
  if (selectedNodeKeys.length !== count)
    violations.unshift({
      kind: 'selectionCount',
      expected: count,
      actual: selectedNodeKeys.length,
    });
  for (const node of unreachableSelections(context, invested, nodes))
    violations.push({ kind: 'unreachable', nodeKey: node.key });
  return Object.freeze(violations);
}

function nodeOrder(context: HexActivationContext): Map<string, number> {
  return new Map(context.layout.nodes.values.map((node, index) => [node.key, index]));
}

function compareIndexLists(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1)
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  return left.length - right.length;
}

/**
 * Smallest set of at most `budget` extra nodes that makes every pin reachable,
 * ties broken by layout order. Each level adds one enabler of a still
 * unreachable node; some such enabler belongs to every solution.
 */
function minimalConnectors(
  context: HexActivationContext,
  invested: ReadonlySet<string>,
  pins: readonly HexLayoutNodeDeclaration[],
  budget: number,
): readonly HexLayoutNodeDeclaration[] | undefined {
  const order = nodeOrder(context);
  const pinKeys = new Set(pins.map((pin) => pin.key));
  let frontier = new Map<string, readonly HexLayoutNodeDeclaration[]>([['', []]]);
  for (let size = 0; size <= budget && frontier.size > 0; size += 1) {
    let best: readonly HexLayoutNodeDeclaration[] | undefined;
    let bestIndexes: readonly number[] = [];
    const next = new Map<string, readonly HexLayoutNodeDeclaration[]>();
    for (const extra of frontier.values()) {
      const pending = unreachableSelections(context, invested, [...pins, ...extra]);
      if (pending.length === 0) {
        const indexes = extra.map((node) => order.get(node.key)!);
        if (best === undefined || compareIndexLists(indexes, bestIndexes) < 0) {
          best = extra;
          bestIndexes = indexes;
        }
        continue;
      }
      if (best !== undefined || size === budget) continue;
      const extraKeys = new Set(extra.map((node) => node.key));
      for (const node of pending)
        for (const enabler of enablers(context, node)) {
          if (invested.has(enabler.key) || pinKeys.has(enabler.key) || extraKeys.has(enabler.key))
            continue;
          const grown = [...extra, enabler].sort(
            (left, right) => order.get(left.key)! - order.get(right.key)!,
          );
          next.set(grown.map((grownNode) => grownNode.key).join(','), grown);
        }
    }
    if (best !== undefined) return best;
    frontier = next;
  }
  return undefined;
}

/**
 * Completes pinned selections to `count` legal nodes: the fewest connectors the
 * pins need, then the shallowest available nodes by depth and slot.
 */
export function completeHexActivation(
  context: HexActivationContext,
  pinnedNodeKeys: readonly string[],
  count: number,
): HexActivationCompletion {
  const invested = investedSet(context);
  const { violations, nodes: pins } = selectionViolations(context, invested, pinnedNodeKeys);
  const open = presentNodes(context).filter((node) => !invested.has(node.key)).length;
  if (count > open) throw new Error(`Hex screen selects ${count} of ${open} open nodes`);
  if (violations.length > 0)
    return Object.freeze({ ok: false, violations: Object.freeze(violations) });
  const connectors =
    pins.length > count
      ? undefined
      : minimalConnectors(context, invested, pins, count - pins.length);
  if (connectors === undefined)
    return Object.freeze({
      ok: false,
      violations: Object.freeze([{ kind: 'pinsExceedSelections', count } as const]),
    });
  const selected = new Set([...pins, ...connectors].map((node) => node.key));
  while (selected.size < count) selected.add(availableHexNodes(context, [...selected])[0]!);
  const order = nodeOrder(context);
  return Object.freeze({
    ok: true,
    selection: Object.freeze([...selected].sort((a, b) => order.get(a)! - order.get(b)!)),
  });
}

/**
 * Nodes that can be pinned on their own: present, uninvested, and reachable
 * within `count` selections. Whether all pins fit together is the screen check.
 */
export function hexActivationPinDomain(
  context: HexActivationContext,
  pinnedNodeKeys: readonly string[],
  count: number,
): readonly string[] {
  const invested = investedSet(context);
  const nodes = presentNodes(context);
  // Fewest selections, the node included, that make each node reachable.
  const cost = new Map<string, number>();
  for (let changed = true; changed;) {
    changed = false;
    for (const node of nodes) {
      if (invested.has(node.key)) continue;
      const backlinks = presentAt(context, node.depth - 1, node.linkFrom);
      const viaEnablers = enablers(context, node).map((enabler) =>
        invested.has(enabler.key) ? 0 : (cost.get(enabler.key) ?? Infinity),
      );
      const value = 1 + (backlinks.length === 0 ? 0 : Math.min(...viaEnablers));
      if (value < (cost.get(node.key) ?? Infinity)) {
        cost.set(node.key, value);
        changed = true;
      }
    }
  }
  return Object.freeze(
    nodes
      .filter(
        (node) =>
          !invested.has(node.key) &&
          !pinnedNodeKeys.includes(node.key) &&
          (cost.get(node.key) ?? Infinity) <= count,
      )
      .map((node) => node.key),
  );
}
