import type {
  HexDeclaration,
  HexLayoutDeclaration,
  HexLayoutKey,
  HexLayoutNodeDeclaration,
} from '../../catalog-schema';

/** Talent key on every node of one generated tree, keyed by node key. */
export type HexTalentTree = Readonly<Record<string, string>>;

/** A node's own validity: its talent belongs to its pool and can be drawn at its depth. */
export type HexTalentNodeViolation =
  | { readonly kind: 'unknownNode'; readonly nodeKey: string }
  | { readonly kind: 'missingNode'; readonly nodeKey: string }
  | { readonly kind: 'talentNotInPool'; readonly nodeKey: string; readonly talentKey: string }
  | { readonly kind: 'talentNotAtDepth'; readonly nodeKey: string; readonly talentKey: string };

/** Tree-wide policy over locally valid nodes. */
export type HexTalentTreeViolation =
  | {
      readonly kind: 'repeatedTalent';
      readonly talentKey: string;
      readonly nodeKeys: readonly string[];
    }
  | {
      /** No refill-cycle draw sequence yields these repeatable talents at this depth. */
      readonly kind: 'repeatableSequence';
      readonly depth: number;
      readonly nodeKeys: readonly string[];
    };

export interface HexTalentTreeFindings {
  readonly nodes: readonly HexTalentNodeViolation[];
  readonly tree: readonly HexTalentTreeViolation[];
}

export type HexTalentTreeCompletion =
  | { readonly ok: true; readonly tree: HexTalentTree }
  | ({ readonly ok: false } & HexTalentTreeFindings);

/**
 * Source repeatable draw cycles: each refill list in declared order and how
 * many of its talents the layout draws. Only the last cycle can be partial.
 */
export interface HexRepeatableCycle {
  readonly talentKeys: readonly string[];
  readonly draws: number;
}

interface DepthGroup {
  readonly depth: number;
  readonly nodes: readonly HexLayoutNodeDeclaration[];
}

interface DrawState {
  readonly cycle: number;
  /** Talents of the current cycle not yet drawn. */
  readonly left: readonly string[];
}

interface DrawOption {
  readonly state: DrawState;
  readonly drawn: readonly string[];
}

function layoutFor(hex: HexDeclaration, layoutKey: HexLayoutKey): HexLayoutDeclaration {
  const layout = hex.layouts.byKey[layoutKey];
  if (layout === undefined) throw new Error(`Hex layout ${layoutKey} is not declared`);
  return layout;
}

function nodeFor(layout: HexLayoutDeclaration, nodeKey: string): HexLayoutNodeDeclaration {
  const node = layout.nodes.byKey[nodeKey];
  if (node === undefined) throw new Error(`Hex node ${nodeKey} is not declared on ${layout.key}`);
  return node;
}

/** Talents a node kind may hold, in declared order. */
export function hexNodeTalentPool(
  hex: HexDeclaration,
  node: HexLayoutNodeDeclaration,
): readonly string[] {
  switch (node.kind) {
    case 'keystone':
      return hex.rareCandidates.values.map((candidate) => candidate.key);
    case 'legendary':
      return hex.epicCandidates.values.map((candidate) => candidate.key);
    case 'repeatable':
      return hex.repeatableCandidates.values.map((candidate) => candidate.key);
    case 'olympianSpell':
      return [hex.godSent.olympianTalentKey];
    case 'olympianCount':
      return [hex.godSent.lineageTalentKey];
  }
}

/** An emptied draw list refills with talents drawn fewer than `MaxCount` times. */
export function hexRepeatableCycles(
  hex: HexDeclaration,
  layoutKey: HexLayoutKey,
): readonly HexRepeatableCycle[] {
  const layout = layoutFor(hex, layoutKey);
  const talents = hex.repeatableCandidates.values;
  let remaining = layout.nodes.values.filter((node) => node.kind === 'repeatable').length;
  const counts = new Map(talents.map((talent) => [talent.key, 0]));
  const cycles: HexRepeatableCycle[] = [];
  let cycle = talents.map((talent) => talent.key);
  while (remaining > 0) {
    if (cycle.length === 0) throw new Error(`Hex ${hex.spellTraitKey} repeatable pool ran out`);
    const draws = Math.min(remaining, cycle.length);
    cycles.push(Object.freeze({ talentKeys: Object.freeze(cycle), draws }));
    for (const key of cycle) counts.set(key, counts.get(key)! + 1);
    remaining -= draws;
    cycle = talents
      .filter(
        (talent) =>
          talent.maxCount === undefined ||
          (counts.get(talent.key)! > 0 && counts.get(talent.key)! < talent.maxCount),
      )
      .map((talent) => talent.key);
  }
  return Object.freeze(cycles);
}

/** Depths are drawn in order; order within a depth is unobservable. */
function repeatableDepths(layout: HexLayoutDeclaration): readonly DepthGroup[] {
  const groups: DepthGroup[] = [];
  for (const node of layout.nodes.values) {
    if (node.kind !== 'repeatable') continue;
    const last = groups[groups.length - 1];
    if (last?.depth === node.depth) (last.nodes as HexLayoutNodeDeclaration[]).push(node);
    else groups.push({ depth: node.depth, nodes: [node] });
  }
  return groups;
}

function combinations<T>(values: readonly T[], size: number): readonly (readonly T[])[] {
  if (size === 0) return [[]];
  return values.flatMap((value, index) =>
    combinations(values.slice(index + 1), size - 1).map((rest) => [value, ...rest]),
  );
}

/** Every way to draw `need` talents from `state`, in declared order. */
function drawOptions(
  cycles: readonly HexRepeatableCycle[],
  state: DrawState,
  need: number,
): readonly DrawOption[] {
  if (need === 0) return [{ state, drawn: [] }];
  const current =
    state.left.length > 0
      ? state
      : { cycle: state.cycle + 1, left: cycles[state.cycle + 1]?.talentKeys ?? [] };
  if (current.left.length === 0) throw new Error('Hex repeatable draws exceed the tree');
  const take = Math.min(need, current.left.length);
  return combinations(current.left, take).flatMap((subset) =>
    drawOptions(
      cycles,
      { cycle: current.cycle, left: current.left.filter((key) => !subset.includes(key)) },
      need - take,
    ).map((tail) => ({ state: tail.state, drawn: [...subset, ...tail.drawn] })),
  );
}

function stateKey(state: DrawState): string {
  return `${state.cycle}|${state.left.join(',')}`;
}

function initialState(cycles: readonly HexRepeatableCycle[]): DrawState {
  return { cycle: 0, left: cycles[0]?.talentKeys ?? [] };
}

function countValues(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function containsAll(drawn: readonly string[], required: readonly string[]): boolean {
  const available = countValues(drawn);
  return [...countValues(required)].every(([key, count]) => (available.get(key) ?? 0) >= count);
}

/** Repeatable talents some draw sequence places at a depth. */
function depthTalents(
  cycles: readonly HexRepeatableCycle[],
  depths: readonly DepthGroup[],
): ReadonlyMap<number, ReadonlySet<string>> {
  const cycleOfPosition = cycles.flatMap((cycle, index) =>
    Array.from({ length: cycle.draws }, () => index),
  );
  const result = new Map<number, ReadonlySet<string>>();
  let position = 0;
  for (const group of depths) {
    const talents = new Set<string>();
    for (let offset = 0; offset < group.nodes.length; offset += 1)
      for (const key of cycles[cycleOfPosition[position + offset]!]!.talentKeys) talents.add(key);
    result.set(group.depth, talents);
    position += group.nodes.length;
  }
  return result;
}

/** Talents this node may hold on its own, in declared order. */
export function hexNodeTalentDomain(
  hex: HexDeclaration,
  layoutKey: HexLayoutKey,
  nodeKey: string,
): readonly string[] {
  const layout = layoutFor(hex, layoutKey);
  const node = nodeFor(layout, nodeKey);
  const pool = hexNodeTalentPool(hex, node);
  if (node.kind !== 'repeatable') return Object.freeze([...pool]);
  const cycles = hexRepeatableCycles(hex, layoutKey);
  const atDepth = depthTalents(cycles, repeatableDepths(layout)).get(node.depth)!;
  return Object.freeze(pool.filter((key) => atDepth.has(key)));
}

function nodeViolations(
  hex: HexDeclaration,
  layout: HexLayoutDeclaration,
  assignment: Readonly<Record<string, string>>,
  complete: boolean,
): HexTalentNodeViolation[] {
  const violations: HexTalentNodeViolation[] = [];
  for (const nodeKey of Object.keys(assignment).sort())
    if (layout.nodes.byKey[nodeKey] === undefined)
      violations.push({ kind: 'unknownNode', nodeKey });
  for (const node of layout.nodes.values) {
    const talentKey = assignment[node.key];
    if (talentKey === undefined) {
      if (complete) violations.push({ kind: 'missingNode', nodeKey: node.key });
    } else if (!hexNodeTalentPool(hex, node).includes(talentKey))
      violations.push({ kind: 'talentNotInPool', nodeKey: node.key, talentKey });
    else if (!hexNodeTalentDomain(hex, layout.key, node.key).includes(talentKey))
      violations.push({ kind: 'talentNotAtDepth', nodeKey: node.key, talentKey });
  }
  return violations;
}

function repeatedTalents(
  layout: HexLayoutDeclaration,
  assignment: Readonly<Record<string, string>>,
): HexTalentTreeViolation[] {
  const holders = new Map<string, string[]>();
  for (const node of layout.nodes.values) {
    const talentKey = assignment[node.key];
    if (talentKey === undefined || (node.kind !== 'keystone' && node.kind !== 'legendary'))
      continue;
    holders.set(talentKey, [...(holders.get(talentKey) ?? []), node.key]);
  }
  return [...holders]
    .filter(([, nodeKeys]) => nodeKeys.length > 1)
    .map(([talentKey, nodeKeys]) => ({
      kind: 'repeatedTalent',
      talentKey,
      nodeKeys: Object.freeze(nodeKeys),
    }));
}

/**
 * Forward draw states per depth whose draws contain each depth's talents
 * (`exact` requires equality); returns the first depth no state survives.
 */
function firstImpossibleDepth(
  cycles: readonly HexRepeatableCycle[],
  depths: readonly DepthGroup[],
  assignment: Readonly<Record<string, string>>,
  exact: boolean,
): DepthGroup | undefined {
  let states = new Map([[stateKey(initialState(cycles)), initialState(cycles)]]);
  for (const group of depths) {
    const required = group.nodes.flatMap((node) =>
      assignment[node.key] === undefined ? [] : [assignment[node.key]!],
    );
    const sorted = [...required].sort().join(',');
    const next = new Map<string, DrawState>();
    for (const state of states.values())
      for (const option of drawOptions(cycles, state, group.nodes.length))
        if (
          exact
            ? [...option.drawn].sort().join(',') === sorted
            : containsAll(option.drawn, required)
        )
          next.set(stateKey(option.state), option.state);
    if (next.size === 0) return group;
    states = next;
  }
  return undefined;
}

/** Node validity first; tree-wide policy only over a tree whose nodes are all valid. */
export function validateHexTalentTree(
  hex: HexDeclaration,
  layoutKey: HexLayoutKey,
  tree: HexTalentTree,
): HexTalentTreeFindings {
  const layout = layoutFor(hex, layoutKey);
  const nodes = nodeViolations(hex, layout, tree, true);
  const treeViolations = repeatedTalents(layout, tree);
  if (nodes.length === 0) {
    const impossible = firstImpossibleDepth(
      hexRepeatableCycles(hex, layoutKey),
      repeatableDepths(layout),
      tree,
      true,
    );
    if (impossible !== undefined)
      treeViolations.push({
        kind: 'repeatableSequence',
        depth: impossible.depth,
        nodeKeys: Object.freeze(impossible.nodes.map((node) => node.key)),
      });
  }
  return Object.freeze({
    nodes: Object.freeze(nodes),
    tree: Object.freeze(treeViolations),
  });
}

/** Fills unpinned unique nodes, keeping each node's default candidate when it is free. */
function fillUnique(
  nodes: readonly HexLayoutNodeDeclaration[],
  candidates: readonly string[],
  pins: Readonly<Record<string, string>>,
  tree: Record<string, string>,
): void {
  const used = new Set(
    nodes.flatMap((node) => (pins[node.key] === undefined ? [] : [pins[node.key]!])),
  );
  const deferred: HexLayoutNodeDeclaration[] = [];
  nodes.forEach((node, index) => {
    const pinned = pins[node.key];
    if (pinned !== undefined) {
      tree[node.key] = pinned;
      return;
    }
    const preferred = candidates[index];
    if (preferred !== undefined && !used.has(preferred)) {
      tree[node.key] = preferred;
      used.add(preferred);
    } else deferred.push(node);
  });
  for (const node of deferred) {
    const next = candidates.find((candidate) => !used.has(candidate))!;
    tree[node.key] = next;
    used.add(next);
  }
}

/** Places one depth's drawn talents, keeping pins and each node's draw-order default. */
function fillDepth(
  group: DepthGroup,
  drawn: readonly string[],
  pins: Readonly<Record<string, string>>,
  tree: Record<string, string>,
): void {
  const remaining = countValues(drawn);
  for (const node of group.nodes) {
    const pin = pins[node.key];
    if (pin !== undefined) remaining.set(pin, remaining.get(pin)! - 1);
  }
  const deferred: HexLayoutNodeDeclaration[] = [];
  group.nodes.forEach((node, index) => {
    const pin = pins[node.key];
    if (pin !== undefined) tree[node.key] = pin;
    else if (remaining.get(drawn[index]!)! > 0) {
      tree[node.key] = drawn[index]!;
      remaining.set(drawn[index]!, remaining.get(drawn[index]!)! - 1);
    } else deferred.push(node);
  });
  for (const node of deferred) {
    const next = drawn.find((key) => remaining.get(key)! > 0)!;
    tree[node.key] = next;
    remaining.set(next, remaining.get(next)! - 1);
  }
}

/**
 * Completes a sparse pin map to one deterministic legal tree that keeps every
 * pin: unique nodes take declared candidates in node order; each depth takes
 * the first draw, in declared order, from which the remaining pins still fit.
 */
export function completeHexTalentTree(
  hex: HexDeclaration,
  layoutKey: HexLayoutKey,
  pinnedNodes: Readonly<Record<string, string>>,
): HexTalentTreeCompletion {
  const layout = layoutFor(hex, layoutKey);
  const nodes = nodeViolations(hex, layout, pinnedNodes, false);
  const treeViolations = repeatedTalents(layout, pinnedNodes);
  const cycles = hexRepeatableCycles(hex, layoutKey);
  const depths = repeatableDepths(layout);
  if (nodes.length === 0) {
    const impossible = firstImpossibleDepth(cycles, depths, pinnedNodes, false);
    if (impossible !== undefined)
      treeViolations.push({
        kind: 'repeatableSequence',
        depth: impossible.depth,
        nodeKeys: Object.freeze(
          depths
            .filter((group) => group.depth <= impossible.depth)
            .flatMap((group) => group.nodes)
            .filter((node) => pinnedNodes[node.key] !== undefined)
            .map((node) => node.key),
        ),
      });
  }
  if (nodes.length > 0 || treeViolations.length > 0)
    return Object.freeze({
      ok: false,
      nodes: Object.freeze(nodes),
      tree: Object.freeze(treeViolations),
    });

  const tree: Record<string, string> = {};
  const ofKind = (kind: HexLayoutNodeDeclaration['kind']) =>
    layout.nodes.values.filter((node) => node.kind === kind);
  for (const kind of ['keystone', 'legendary'] as const) {
    const kindNodes = ofKind(kind);
    fillUnique(kindNodes, hexNodeTalentPool(hex, kindNodes[0]!), pinnedNodes, tree);
  }
  for (const node of [...ofKind('olympianSpell'), ...ofKind('olympianCount')])
    tree[node.key] = hexNodeTalentPool(hex, node)[0]!;

  const pinsAt = (group: DepthGroup) =>
    group.nodes.flatMap((node) =>
      pinnedNodes[node.key] === undefined ? [] : [pinnedNodes[node.key]!],
    );
  const completable = new Map<string, boolean>();
  const canComplete = (index: number, state: DrawState): boolean => {
    const group = depths[index];
    if (group === undefined) return true;
    const key = `${index}#${stateKey(state)}`;
    const known = completable.get(key);
    if (known !== undefined) return known;
    const result = drawOptions(cycles, state, group.nodes.length).some(
      (option) => containsAll(option.drawn, pinsAt(group)) && canComplete(index + 1, option.state),
    );
    completable.set(key, result);
    return result;
  };
  let state = initialState(cycles);
  depths.forEach((group, index) => {
    const option = drawOptions(cycles, state, group.nodes.length).find(
      (candidate) =>
        containsAll(candidate.drawn, pinsAt(group)) && canComplete(index + 1, candidate.state),
    )!;
    fillDepth(group, option.drawn, pinnedNodes, tree);
    state = option.state;
  });
  const ordered = Object.fromEntries(
    layout.nodes.values.map((node) => [node.key, tree[node.key]!]),
  );
  return Object.freeze({ ok: true, tree: Object.freeze(ordered) });
}
