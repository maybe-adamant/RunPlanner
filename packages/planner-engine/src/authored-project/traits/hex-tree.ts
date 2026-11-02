import type {
  Catalog,
  HexDeclaration,
  HexLayoutDeclaration,
  HexLayoutKey,
  HexLayoutNodeDeclaration,
} from '../../catalog-schema';

import {
  defaultHexTalentTree,
  hexCommonColumnDeal,
  type HexCommonColumnDeal,
  type HexCommonColumn,
  hexCommonColumns,
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
  /** Sets a Rare or Epic node's talent; Common nodes change only by column. */
  | { readonly kind: 'setNode'; readonly nodeKey: string; readonly talentKey: string }
  /** Sets a Common column's talents, by its slots in map order; later columns keep theirs. */
  | { readonly kind: 'setColumn'; readonly depth: number; readonly talentKeys: readonly string[] }
  /** Regenerates the default tree on another layout. */
  | { readonly kind: 'changeLayout'; readonly layoutKey: HexLayoutKey }
  | { readonly kind: 'reset' };

/** One talent a node can take, and the edit that places it. */
export interface AuthoredHexNodeEditOption {
  readonly talentKey: string;
  readonly edit: AuthoredHexTreeEdit;
  readonly selected: boolean;
  /** The other nodes of the kind holding the talent. */
  readonly relatedNodeKeys: readonly string[];
}

/** `pool`: a Rare or Epic node's talents. */
export interface AuthoredHexNodeEditGroup {
  readonly kind: 'pool';
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

function setColumn(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
  depth: number,
  talentKeys: readonly string[],
): AuthoredHexTreeConfiguration {
  const hex = hexFor(catalog, spellTraitKey);
  const column = hexCommonColumns(
    hex,
    value.layoutKey,
    fullTree(hex, layoutFor(hex, value.layoutKey), value.nodes),
  ).find((candidate) => candidate.depth === depth);
  if (column === undefined) throw new Error(`Hex depth ${depth} has no Common column`);
  if (talentKeys.length !== column.slots.length)
    throw new Error(`Hex column ${depth} has ${column.slots.length} slots`);
  return normalizeAuthoredHexTree(catalog, spellTraitKey, {
    layoutKey: value.layoutKey,
    nodes: {
      ...value.nodes,
      ...Object.fromEntries(column.slots.map((slot, index) => [slot.nodeKey, talentKeys[index]!])),
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
    case 'setNode': {
      const node = layoutFor(hexFor(catalog, spellTraitKey), value.layoutKey).nodes.byKey[
        edit.nodeKey
      ];
      if (node?.kind !== 'keystone' && node?.kind !== 'legendary')
        throw new Error(`Hex node ${edit.nodeKey} is not a ${value.layoutKey} Rare or Epic node`);
      return normalizeAuthoredHexTree(catalog, spellTraitKey, {
        layoutKey: value.layoutKey,
        nodes: { ...value.nodes, [edit.nodeKey]: edit.talentKey },
      });
    }
    case 'setColumn':
      return setColumn(catalog, spellTraitKey, value, edit.depth, edit.talentKeys);
    case 'changeLayout':
      return edit.layoutKey === value.layoutKey
        ? value
        : createDefaultAuthoredHexTree(catalog, spellTraitKey, edit.layoutKey);
    case 'reset':
      return createDefaultAuthoredHexTree(catalog, spellTraitKey, value.layoutKey);
  }
}

/**
 * A Rare or Epic node's pool, each talent naming the other nodes of its kind
 * that hold it. Common nodes change by column; God Sent nodes have none.
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
  if (node.kind !== 'keystone' && node.kind !== 'legendary') return Object.freeze([]);
  const current = value.nodes[nodeKey]!;
  const others = layout.nodes.values
    .filter((other) => other.kind === node.kind && other.key !== nodeKey)
    .map((other) => other.key);
  return Object.freeze([
    Object.freeze({
      kind: 'pool' as const,
      options: Object.freeze(
        hexNodeTalentPool(hex, node).map((talentKey) =>
          Object.freeze({
            talentKey,
            edit: Object.freeze({ kind: 'setNode' as const, nodeKey, talentKey }),
            selected: talentKey === current,
            relatedNodeKeys: Object.freeze(
              talentKey === current ? [] : others.filter((key) => value.nodes[key] === talentKey),
            ),
          }),
        ),
      ),
    }),
  ]);
}

/** One Common column, read against the earlier columns as authored. */
export type AuthoredHexColumn = HexCommonColumn;

/**
 * The tree's Common columns in draw order: each column's talents in map
 * order, the decks it draws from and whether it is such a draw.
 */
export function authoredHexColumns(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
): readonly AuthoredHexColumn[] {
  const hex = hexFor(catalog, spellTraitKey);
  const layout = layoutFor(hex, value.layoutKey);
  return hexCommonColumns(hex, layout.key, fullTree(hex, layout, value.nodes));
}

/** A column's deal so far; once complete, the column edit that places it. */
export interface AuthoredHexColumnDeal extends HexCommonColumnDeal {
  readonly edit?: Extract<AuthoredHexTreeEdit, { readonly kind: 'setColumn' }>;
}

/**
 * Deals one Common column slot by slot in map order, reading the decks the
 * earlier columns as authored left; absent past an undrawable column.
 */
export function authoredHexColumnDeal(
  catalog: Catalog,
  spellTraitKey: string,
  value: AuthoredHexTreeConfiguration,
  depth: number,
  dealt: readonly string[],
): AuthoredHexColumnDeal | undefined {
  const hex = hexFor(catalog, spellTraitKey);
  const layout = layoutFor(hex, value.layoutKey);
  const deal = hexCommonColumnDeal(
    hex,
    layout.key,
    fullTree(hex, layout, value.nodes),
    depth,
    dealt,
  );
  if (deal === undefined || !deal.complete) return deal;
  return Object.freeze({
    ...deal,
    edit: Object.freeze({ kind: 'setColumn' as const, depth, talentKeys: deal.dealt }),
  });
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
