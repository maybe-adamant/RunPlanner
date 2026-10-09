import type { AuthoredHexTreeConfiguration } from '../authored-project/traits/state';
import type { HexLayoutDeclaration, HexLayoutNodeDeclaration } from '../catalog-schema';

/** Reached tree state one writable talent screen selects against. */
export interface HexActivationContext {
  readonly spellTraitKey: string;
  /** The tree as installed at this screen; its nodes name the talents. */
  readonly tree: AuthoredHexTreeConfiguration;
  readonly layout: HexLayoutDeclaration;
  /** The God Sent pair exists only once inserted. */
  readonly godSentAdded: boolean;
  readonly investedNodeKeys: readonly string[];
  /** Selections the screen spends: `min(bank + 1, remaining capacity)`. */
  readonly count: number;
}

export type HexActivationViolation =
  | { readonly kind: 'selectionCount'; readonly expected: number; readonly actual: number }
  | { readonly kind: 'unknownNode'; readonly nodeKey: string }
  | { readonly kind: 'absentNode'; readonly nodeKey: string }
  | { readonly kind: 'alreadyInvested'; readonly nodeKey: string }
  | { readonly kind: 'unreachable'; readonly nodeKey: string };

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
  for (const nodeKey of nodeKeys) {
    const node = context.layout.nodes.byKey[nodeKey];
    if (node === undefined) violations.push({ kind: 'unknownNode', nodeKey });
    else if (!isPresent(context, node)) violations.push({ kind: 'absentNode', nodeKey });
    else if (invested.has(nodeKey)) violations.push({ kind: 'alreadyInvested', nodeKey });
    else nodes.push(node);
  }
  return { violations, nodes };
}

/** Whether one screen's selections are a legal source investment of exactly `count` nodes. */
export function validateHexActivation(
  context: HexActivationContext,
  selectedNodeKeys: readonly string[],
): readonly HexActivationViolation[] {
  const invested = investedSet(context);
  const { violations, nodes } = selectionViolations(context, invested, selectedNodeKeys);
  if (selectedNodeKeys.length !== context.count)
    violations.unshift({
      kind: 'selectionCount',
      expected: context.count,
      actual: selectedNodeKeys.length,
    });
  for (const node of unreachableSelections(context, invested, nodes))
    violations.push({ kind: 'unreachable', nodeKey: node.key });
  return Object.freeze(violations);
}

/** The board's exact domain for one reached screen, drawn from the first reaching branch. */
export interface HexActivationCandidateCapability {
  readonly spellTraitKey: string;
  readonly tree: AuthoredHexTreeConfiguration;
  readonly layoutKey: string;
  readonly count: number;
  readonly investedNodeKeys: readonly string[];
  readonly godSentAdded: boolean;
  /** Nodes the selection can add next, in layout order; none once it spends the screen. */
  readonly availableNodeKeys: (selection: readonly string[]) => readonly string[];
  /** The selection's violations in every reaching branch, without repeats. */
  readonly assess: (selection: readonly string[]) => readonly HexActivationViolation[];
}

export function createHexActivationCandidateCapability(
  contexts: readonly HexActivationContext[],
): HexActivationCandidateCapability | undefined {
  const first = contexts[0];
  if (first === undefined) return undefined;
  return Object.freeze({
    spellTraitKey: first.spellTraitKey,
    tree: first.tree,
    layoutKey: first.layout.key,
    count: first.count,
    investedNodeKeys: first.investedNodeKeys,
    godSentAdded: first.godSentAdded,
    availableNodeKeys: (selection: readonly string[]) =>
      selection.length >= first.count ? Object.freeze([]) : availableHexNodes(first, selection),
    assess: (selection: readonly string[]) => {
      const seen = new Map<string, HexActivationViolation>();
      for (const context of contexts)
        for (const violation of validateHexActivation(context, selection))
          seen.set(JSON.stringify(violation), violation);
      return Object.freeze([...seen.values()]);
    },
  });
}
