import type {
  Catalog,
  HexDeclaration,
  HexLayoutDeclaration,
  HexLayoutKey,
  HexLayoutNodeDeclaration,
} from '../../catalog-schema';

import {
  defaultHexTalentTree,
  hexCommonDecks,
  type HexCommonDecks,
  hexNodeTalentDomain,
  hexNodeTalentPool,
  validateHexTalentTree,
  type HexTalentTreeViolation,
} from './hex-talent-tree';
import type { AuthoredHexTreeConfiguration } from './state';
import {
  expectExactKeys,
  expectRecord,
  expectString,
  failProjectDocument as fail,
} from '../validation';

/** One semantic edit of an authored Hex tree. */
export type AuthoredHexTreeEdit =
  | { readonly kind: 'setNode'; readonly nodeKey: string; readonly talentKey: string }
  /** Exchanges the talents of two Common nodes. */
  | { readonly kind: 'swapNodes'; readonly nodeKey: string; readonly otherNodeKey: string }
  /** Regenerates the default tree on another layout. */
  | { readonly kind: 'changeLayout'; readonly layoutKey: HexLayoutKey }
  | { readonly kind: 'reset' };

/** One talent a node can take, and the edit that places it. */
export interface AuthoredHexNodeEditOption {
  readonly talentKey: string;
  readonly edit: AuthoredHexTreeEdit;
  readonly selected: boolean;
  /** The nodes the choice involves: the other holders of a Rare or Epic talent, or the swap partner. */
  readonly relatedNodeKeys: readonly string[];
  /** The column of a trade partner in the node's deck. */
  readonly depth?: number;
}

/**
 * `pool`: a Rare or Epic node's talents. `atDepth`: swaps within the node's
 * column. `otherColumn`: swaps with the node's deck in its other columns.
 * `unused`: the partial last deck's undealt talents, taking the node's place.
 */
export interface AuthoredHexNodeEditGroup {
  readonly kind: 'pool' | 'atDepth' | 'otherColumn' | 'unused';
  readonly options: readonly AuthoredHexNodeEditOption[];
}

function hexFor(catalog: Catalog, spellTraitKey: string): HexDeclaration {
  const hex = catalog.hexes.byKey[spellTraitKey];
  if (hex === undefined) throw new Error(`unknown Hex spell ${spellTraitKey}`);
  return hex;
}

function layoutFor(hex: HexDeclaration, layoutKey: HexLayoutKey): HexLayoutDeclaration {
  const layout = hex.layouts.byKey[layoutKey];
  if (layout === undefined) throw new Error(`Hex layout ${layoutKey} is not declared`);
  return layout;
}

/** God Sent nodes always hold their native talents and are not authored. */
function authoredNode(node: HexLayoutNodeDeclaration): boolean {
  return node.kind !== 'olympianSpell' && node.kind !== 'olympianCount';
}

function authoredNodes(layout: HexLayoutDeclaration, tree: Readonly<Record<string, string>>) {
  return Object.freeze(
    Object.fromEntries(
      layout.nodes.values.flatMap((node) =>
        authoredNode(node) && tree[node.key] !== undefined ? [[node.key, tree[node.key]!]] : [],
      ),
    ),
  );
}

/** The authored nodes with the God Sent talents, as the tree rules read them. */
function fullTree(
  hex: HexDeclaration,
  layout: HexLayoutDeclaration,
  nodes: Readonly<Record<string, string>>,
) {
  return Object.fromEntries(
    layout.nodes.values.map((node) => [
      node.key,
      authoredNode(node) ? nodes[node.key]! : hexNodeTalentPool(hex, node)[0]!,
    ]),
  );
}

/**
 * Checks each node on its own: every authored node of the layout is present
 * and holds a talent of its local domain. Tree-wide policy is a finding.
 */
export function normalizeAuthoredHexTree(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
): AuthoredHexTreeConfiguration {
  const hex = hexFor(catalog, spellTraitKey);
  const layout = layoutFor(hex, value.layoutKey);
  for (const nodeKey of Object.keys(value.nodes)) {
    const node = layout.nodes.byKey[nodeKey];
    if (node === undefined || !authoredNode(node))
      throw new Error(`Hex node ${nodeKey} is not an authored ${layout.key} node`);
  }
  for (const node of layout.nodes.values) {
    if (!authoredNode(node)) continue;
    const talentKey = value.nodes[node.key];
    if (talentKey === undefined) throw new Error(`Hex node ${node.key} is missing`);
    if (!hexNodeTalentDomain(hex, layout.key, node.key).includes(talentKey))
      throw new Error(`Hex node ${node.key} cannot hold ${talentKey}`);
  }
  return Object.freeze({ layoutKey: layout.key, nodes: authoredNodes(layout, value.nodes) });
}

/** The layout's default tree. */
export function createDefaultAuthoredHexTree(
  catalog: Catalog,
  spellTraitKey: string,
  layoutKey: HexLayoutKey = 'Lung',
): AuthoredHexTreeConfiguration {
  const hex = hexFor(catalog, spellTraitKey);
  return Object.freeze({
    layoutKey,
    nodes: authoredNodes(layoutFor(hex, layoutKey), defaultHexTalentTree(hex, layoutKey)),
  });
}

/** Tree-wide violations of an authored tree whose nodes are each valid. */
export function assessAuthoredHexTree(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
): readonly HexTalentTreeViolation[] {
  const hex = hexFor(catalog, spellTraitKey);
  const layout = layoutFor(hex, value.layoutKey);
  return validateHexTalentTree(hex, value.layoutKey, fullTree(hex, layout, value.nodes)).tree;
}

/** Each node keeps a talent of its own depth's domain. */
function swapNodes(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
  nodeKey: string,
  otherNodeKey: string,
): AuthoredHexTreeConfiguration {
  const layout = layoutFor(hexFor(catalog, spellTraitKey), value.layoutKey);
  const node = layout.nodes.byKey[nodeKey];
  const other = layout.nodes.byKey[otherNodeKey];
  if (node?.kind !== 'repeatable' || other?.kind !== 'repeatable' || node.key === other.key)
    throw new Error(`Hex nodes ${nodeKey} and ${otherNodeKey} are not two Common nodes`);
  return normalizeAuthoredHexTree(catalog, spellTraitKey, {
    layoutKey: value.layoutKey,
    nodes: {
      ...value.nodes,
      [nodeKey]: value.nodes[otherNodeKey]!,
      [otherNodeKey]: value.nodes[nodeKey]!,
    },
  });
}

/** Applies one edit; nothing else reflows. */
export function applyAuthoredHexTreeEdit(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
  edit: AuthoredHexTreeEdit,
): AuthoredHexTreeConfiguration {
  switch (edit.kind) {
    case 'setNode':
      if (value.nodes[edit.nodeKey] === undefined)
        throw new Error(`Hex node ${edit.nodeKey} is not an authored ${value.layoutKey} node`);
      return normalizeAuthoredHexTree(catalog, spellTraitKey, {
        layoutKey: value.layoutKey,
        nodes: { ...value.nodes, [edit.nodeKey]: edit.talentKey },
      });
    case 'swapNodes':
      return swapNodes(catalog, spellTraitKey, value, edit.nodeKey, edit.otherNodeKey);
    case 'changeLayout':
      return edit.layoutKey === value.layoutKey
        ? value
        : createDefaultAuthoredHexTree(catalog, spellTraitKey, edit.layoutKey);
    case 'reset':
      return createDefaultAuthoredHexTree(catalog, spellTraitKey, value.layoutKey);
  }
}

/**
 * The talents one node can take, grouped by effect: a Rare or Epic node's
 * pool; a Common node's swaps in its column and trades within its deck, which
 * keep a legal tree legal. God Sent nodes have none.
 */
export function authoredHexNodeEditOptions(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
  nodeKey: string,
): readonly AuthoredHexNodeEditGroup[] {
  const hex = hexFor(catalog, spellTraitKey);
  const layout = layoutFor(hex, value.layoutKey);
  const node = layout.nodes.byKey[nodeKey];
  if (node === undefined) throw new Error(`Hex node ${nodeKey} is not declared on ${layout.key}`);
  const none = Object.freeze([]);
  if (!authoredNode(node)) return none;
  const current = value.nodes[nodeKey]!;
  const set = (talentKey: string, relatedNodeKeys: readonly string[]): AuthoredHexNodeEditOption =>
    Object.freeze({
      talentKey,
      edit: Object.freeze({ kind: 'setNode' as const, nodeKey, talentKey }),
      selected: talentKey === current,
      relatedNodeKeys: Object.freeze(talentKey === current ? [] : relatedNodeKeys),
    });
  const holding = (keys: readonly string[], talentKey: string) =>
    keys.filter((key) => value.nodes[key] === talentKey);
  if (node.kind !== 'repeatable') {
    const others = layout.nodes.values
      .filter((other) => other.kind === node.kind && other.key !== nodeKey)
      .map((other) => other.key);
    return Object.freeze([
      Object.freeze({
        kind: 'pool' as const,
        options: Object.freeze(
          hexNodeTalentPool(hex, node).map((talentKey) =>
            set(talentKey, holding(others, talentKey)),
          ),
        ),
      }),
    ]);
  }
  const sameDepth = layout.nodes.values
    .filter(
      (other) => other.kind === 'repeatable' && other.depth === node.depth && other.key !== nodeKey,
    )
    .map((other) => other.key);
  const atDepth = hexNodeTalentPool(hex, node).flatMap((talentKey): AuthoredHexNodeEditOption[] => {
    if (talentKey === current) return [set(talentKey, [])];
    const holders = holding(sameDepth, talentKey);
    if (holders.length === 0) return [];
    return [
      Object.freeze({
        talentKey,
        edit: Object.freeze({ kind: 'swapNodes' as const, nodeKey, otherNodeKey: holders[0]! }),
        selected: false,
        relatedNodeKeys: Object.freeze([holders[0]!]),
      }),
    ];
  });
  const { decks } = hexCommonDecks(hex, layout.key, fullTree(hex, layout, value.nodes));
  const deck = decks?.find((candidate) =>
    candidate.segments.some((segment) => segment.nodeKeys.includes(nodeKey)),
  );
  const others = (deck?.segments ?? []).filter((segment) => !segment.nodeKeys.includes(nodeKey));
  const trades = others.flatMap(({ depth, nodeKeys, talentKeys }) =>
    depth === undefined
      ? []
      : talentKeys.map((talentKey, index): AuthoredHexNodeEditOption =>
          Object.freeze({
            talentKey,
            edit: Object.freeze({
              kind: 'swapNodes' as const,
              nodeKey,
              otherNodeKey: nodeKeys[index]!,
            }),
            selected: false,
            relatedNodeKeys: Object.freeze([nodeKeys[index]!]),
            depth,
          }),
        ),
  );
  const unused = others.flatMap((segment) =>
    segment.depth === undefined ? segment.talentKeys.map((key) => set(key, [])) : [],
  );
  return Object.freeze([
    Object.freeze({ kind: 'atDepth' as const, options: Object.freeze(atDepth) }),
    ...(trades.length === 0
      ? []
      : [Object.freeze({ kind: 'otherColumn' as const, options: Object.freeze(trades) })]),
    ...(unused.length === 0
      ? []
      : [Object.freeze({ kind: 'unused' as const, options: Object.freeze(unused) })]),
  ]);
}

/** The tree's Common decks and the nodes each dealt to. */
export function authoredHexCommonDecks(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
): HexCommonDecks {
  const hex = hexFor(catalog, spellTraitKey);
  const layout = layoutFor(hex, value.layoutKey);
  return hexCommonDecks(hex, layout.key, fullTree(hex, layout, value.nodes));
}

/** Strict per-node decoding; tree-wide policy stays a finding. */
export function decodeAuthoredHexTree(
  value: unknown,
  catalog: Catalog,
  spellTraitKey: string,
  path: string,
): AuthoredHexTreeConfiguration {
  const raw = expectRecord(value, path);
  expectExactKeys(raw, ['layoutKey', 'nodes'], path);
  const rawNodes = expectRecord(raw.nodes, `${path}.nodes`);
  const nodes = Object.fromEntries(
    Object.entries(rawNodes).map(([nodeKey, talentKey]) => [
      nodeKey,
      expectString(talentKey, `${path}.nodes.${nodeKey}`),
    ]),
  );
  const layoutKey = expectString(raw.layoutKey, `${path}.layoutKey`);
  try {
    return normalizeAuthoredHexTree(catalog, spellTraitKey, {
      layoutKey: layoutKey as HexLayoutKey,
      nodes,
    });
  } catch (error) {
    fail(path, error instanceof Error ? error.message : 'invalid Hex tree');
  }
}
