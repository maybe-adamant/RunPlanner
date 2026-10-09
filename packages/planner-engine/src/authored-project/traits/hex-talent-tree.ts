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
      /**
       * No refill-cycle draw sequence yields the repeatable talents; names every
       * node of the smallest node sets whose change restores one.
       */
      readonly kind: 'repeatableSequence';
      readonly nodeKeys: readonly string[];
    };

export interface HexTalentTreeFindings {
  readonly nodes: readonly HexTalentNodeViolation[];
  readonly tree: readonly HexTalentTreeViolation[];
}

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
): HexTalentNodeViolation[] {
  const violations: HexTalentNodeViolation[] = [];
  for (const nodeKey of Object.keys(assignment).sort())
    if (layout.nodes.byKey[nodeKey] === undefined)
      violations.push({ kind: 'unknownNode', nodeKey });
  for (const node of layout.nodes.values) {
    const talentKey = assignment[node.key];
    if (talentKey === undefined) violations.push({ kind: 'missingNode', nodeKey: node.key });
    else if (!hexNodeTalentPool(hex, node).includes(talentKey))
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

/** Largest node set searched for the smallest change that restores the draw sequence. */
const SEQUENCE_SEARCH_LIMIT = 4;

/**
 * Repeatable nodes of every smallest set whose release lets the remaining
 * talents complete a draw sequence; beyond the limit, the first undrawable depth.
 */
function sequenceConflictNodes(
  cycles: readonly HexRepeatableCycle[],
  depths: readonly DepthGroup[],
  assignment: Readonly<Record<string, string>>,
): readonly string[] {
  const candidates = depths.flatMap((group) =>
    group.nodes.flatMap((node) => (assignment[node.key] === undefined ? [] : [node.key])),
  );
  for (let size = 1; size <= Math.min(SEQUENCE_SEARCH_LIMIT, candidates.length); size += 1) {
    const involved = new Set<string>();
    for (const released of combinations(candidates, size)) {
      const kept = Object.fromEntries(
        Object.entries(assignment).filter(([key]) => !released.includes(key)),
      );
      if (firstImpossibleDepth(cycles, depths, kept, false) === undefined)
        for (const key of released) involved.add(key);
    }
    if (involved.size > 0) return candidates.filter((key) => involved.has(key));
  }
  const impossible = firstImpossibleDepth(cycles, depths, assignment, false);
  return impossible?.nodes.map((node) => node.key) ?? [];
}

/** Node validity first; tree-wide policy only over a tree whose nodes are all valid. */
export function validateHexTalentTree(
  hex: HexDeclaration,
  layoutKey: HexLayoutKey,
  tree: HexTalentTree,
): HexTalentTreeFindings {
  const layout = layoutFor(hex, layoutKey);
  const nodes = nodeViolations(hex, layout, tree);
  const treeViolations = repeatedTalents(layout, tree);
  if (nodes.length === 0) {
    const cycles = hexRepeatableCycles(hex, layoutKey);
    const depths = repeatableDepths(layout);
    if (firstImpossibleDepth(cycles, depths, tree, true) !== undefined)
      treeViolations.push({
        kind: 'repeatableSequence',
        nodeKeys: Object.freeze(sequenceConflictNodes(cycles, depths, tree)),
      });
  }
  return Object.freeze({
    nodes: Object.freeze(nodes),
    tree: Object.freeze(treeViolations),
  });
}

/** One deck's share of a column; `depth` is absent for the last deck's undealt talents. */
interface HexCommonDeckSegment {
  readonly depth?: number;
  readonly nodeKeys: readonly string[];
  readonly talentKeys: readonly string[];
}

/** One refill of the Common draw list and the columns its talents were dealt to. */
interface HexCommonDeck {
  readonly index: number;
  readonly segments: readonly HexCommonDeckSegment[];
}

export interface HexCommonDecks {
  /** Common columns in draw order. */
  readonly depths: readonly number[];
  /** Absent when no draw sequence deals the tree's Common talents. */
  readonly decks?: readonly HexCommonDeck[];
}

/**
 * Splits the Common nodes into decks: each column takes the rest of the
 * current deck, whole decks, then the head of the next. Within a column, each
 * segment's talent takes the first unassigned node holding it, in declared
 * node order, earlier decks first.
 */
export function hexCommonDecks(
  hex: HexDeclaration,
  layoutKey: HexLayoutKey,
  tree: HexTalentTree,
): HexCommonDecks {
  const cycles = hexRepeatableCycles(hex, layoutKey);
  const depths = repeatableDepths(layoutFor(hex, layoutKey));
  const shape = { depths: Object.freeze(depths.map((group) => group.depth)) };
  const segments: HexCommonDeckSegment[][] = cycles.map(() => []);
  let deck = 0;
  let left = [...(cycles[0]?.talentKeys ?? [])];
  for (const group of depths) {
    const holders = new Map<string, string[]>();
    for (const node of group.nodes) {
      const talentKey = tree[node.key];
      if (talentKey === undefined) return Object.freeze(shape);
      holders.set(talentKey, [...(holders.get(talentKey) ?? []), node.key]);
    }
    let need = group.nodes.length;
    while (need > 0) {
      if (left.length === 0) {
        deck += 1;
        if (cycles[deck] === undefined) return Object.freeze(shape);
        left = [...cycles[deck]!.talentKeys];
      }
      const taken =
        need >= left.length ? left : left.filter((key) => (holders.get(key)?.length ?? 0) > 0);
      const remaining = [...holders.values()].reduce((sum, keys) => sum + keys.length, 0);
      if (need < left.length && (taken.length !== need || remaining !== need))
        return Object.freeze(shape);
      const nodeKeys: string[] = [];
      for (const key of taken) {
        const nodeKey = holders.get(key)?.shift();
        if (nodeKey === undefined) return Object.freeze(shape);
        nodeKeys.push(nodeKey);
      }
      segments[deck]!.push(
        Object.freeze({
          depth: group.depth,
          nodeKeys: Object.freeze(nodeKeys),
          talentKeys: Object.freeze([...taken]),
        }),
      );
      need -= taken.length;
      left = left.filter((key) => !taken.includes(key));
    }
  }
  if (left.length > 0)
    segments[deck]!.push(
      Object.freeze({ nodeKeys: Object.freeze([]), talentKeys: Object.freeze(left) }),
    );
  return Object.freeze({
    ...shape,
    decks: Object.freeze(
      segments.map((deckSegments, index) =>
        Object.freeze({ index, segments: Object.freeze(deckSegments) }),
      ),
    ),
  });
}

/**
 * The deterministic default tree: Rare and Epic nodes take declared candidates
 * in node order, God Sent nodes their native talents, and each depth the first
 * draw in declared order.
 */
export function defaultHexTalentTree(hex: HexDeclaration, layoutKey: HexLayoutKey): HexTalentTree {
  const layout = layoutFor(hex, layoutKey);
  const cycles = hexRepeatableCycles(hex, layoutKey);
  const tree: Record<string, string> = {};
  for (const kind of ['keystone', 'legendary'] as const)
    layout.nodes.values
      .filter((node) => node.kind === kind)
      .forEach((node, index) => {
        tree[node.key] = hexNodeTalentPool(hex, node)[index]!;
      });
  for (const node of layout.nodes.values)
    if (node.kind === 'olympianSpell' || node.kind === 'olympianCount')
      tree[node.key] = hexNodeTalentPool(hex, node)[0]!;
  let state = initialState(cycles);
  for (const group of repeatableDepths(layout)) {
    const option = drawOptions(cycles, state, group.nodes.length)[0]!;
    group.nodes.forEach((node, index) => {
      tree[node.key] = option.drawn[index]!;
    });
    state = option.state;
  }
  return Object.freeze(
    Object.fromEntries(layout.nodes.values.map((node) => [node.key, tree[node.key]!])),
  );
}
