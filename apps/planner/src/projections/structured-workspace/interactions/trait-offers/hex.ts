import type {
  WorkspaceHexDeckTable,
  WorkspaceHexNodeEditor,
  WorkspaceHexTreeDomain,
  WorkspaceHexTreeInteraction,
  WorkspaceHexTreeNode,
  WorkspaceTraitCarrierChildControl,
} from '@planner/projections/structured-workspace/contracts/traits';
import {
  applyAuthoredHexTreeEdit,
  assessAuthoredHexTree,
  authoredHexCommonDecks,
  authoredHexNodeEditOptions,
  createDefaultAuthoredHexTree,
  createHexTreeAddress,
  optionIndex,
  semanticAddressKey,
  updateAuthoredTraitCarrierChild,
} from '@run-planner/engine/authored-project';
import type {
  HexCommonDecks,
  AuthoredHexNodeEditGroup,
  AuthoredHexNodeEditOption,
  AuthoredHexTreeConfiguration,
  AuthoredHexTreeEdit,
  AuthoredTraitOfferTraits,
  HexTalentTreeViolation,
  HexTreeAddress,
  TraitOptionKey,
  TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type {
  Catalog,
  HexDeclaration,
  HexLayoutDeclaration,
  HexLayoutNodeDeclaration,
  HexNodeKind,
} from '@run-planner/engine/catalog-schema';
import { projectDirectTraitOutcomePicker } from '@planner/projections/contextual/directTraitOutcomeProjection';
import { StructuredWorkspaceProjectionContractError } from '@planner/projections/structured-workspace/contract';

function talentLabel(hex: HexDeclaration, key: string): string {
  return (
    hex.rareCandidates.byKey[key]?.label ??
    hex.epicCandidates.byKey[key]?.label ??
    hex.repeatableCandidates.byKey[key]?.label ??
    (key === hex.godSent.olympianTalentKey
      ? hex.godSent.olympianTalentLabel
      : key === hex.godSent.lineageTalentKey
        ? hex.godSent.lineageTalentLabel
        : key)
  );
}

const kindLabels: Readonly<Record<HexNodeKind, string>> = {
  repeatable: 'Common',
  keystone: 'Rare',
  legendary: 'Epic',
  olympianSpell: 'God Sent',
  olympianCount: 'God Sent',
};

const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const counts = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

/** Accessible node names: kind, talent and depth, told apart by order only when repeated. */
function nodeNames(
  layout: HexLayoutDeclaration,
  talentOf: (node: HexLayoutNodeDeclaration) => string,
): ReadonlyMap<string, string> {
  const base = new Map(
    layout.nodes.values.map((node) => [
      node.key,
      `${kindLabels[node.kind]} ${talentOf(node)}, depth ${node.depth}`,
    ]),
  );
  const seen = new Map<string, number>();
  return new Map(
    layout.nodes.values.map((node) => {
      const name = base.get(node.key)!;
      const total = [...base.values()].filter((other) => other === name).length;
      const index = seen.get(name) ?? 0;
      seen.set(name, index + 1);
      return [node.key, total === 1 ? name : `${name}, ${ordinals[index] ?? index + 1}`];
    }),
  );
}

function listed(values: readonly string[]): string {
  return values.length <= 2
    ? values.join(' and ')
    : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

function treeIssue(
  hex: HexDeclaration,
  layout: HexLayoutDeclaration,
  tree: Readonly<Record<string, string>>,
  violation: HexTalentTreeViolation,
): string {
  if (violation.kind === 'repeatedTalent') {
    const kind = kindLabels[layout.nodes.byKey[violation.nodeKeys[0]!]!.kind];
    return `${talentLabel(hex, violation.talentKey)} appears on ${counts[violation.nodeKeys.length] ?? violation.nodeKeys.length} ${kind} nodes; each Rare and Epic talent appears once.`;
  }
  const talents = [...new Set(violation.nodeKeys.map((key) => talentLabel(hex, tree[key]!)))];
  return talents.length === 1
    ? `${talents[0]} is placed where the refill cycle can't draw it.`
    : `${listed(talents)} are placed where the refill cycle can't draw them.`;
}

const groupLabels: Readonly<Record<AuthoredHexNodeEditGroup['kind'], string>> = {
  pool: 'Talents',
  atDepth: 'Swap in this column',
  otherColumn: 'Trade with another column',
  unused: 'Swap for an unused talent',
};

/** A Rare or Epic talent another node holds; Common groups name their own effect. */
function optionExplanation(
  kind: string,
  group: AuthoredHexNodeEditGroup['kind'],
  option: AuthoredHexNodeEditOption,
): string | undefined {
  return group !== 'pool' || option.selected || option.relatedNodeKeys.length === 0
    ? undefined
    : `On another ${kind} node`;
}

function nodeEditor(
  hex: HexDeclaration,
  node: HexLayoutNodeDeclaration,
  talent: string,
  groups: readonly AuthoredHexNodeEditGroup[],
): WorkspaceHexNodeEditor {
  const kind = kindLabels[node.kind];
  const relatedNodeKeys: Record<string, readonly string[]> = {};
  const sections = groups.map((group) =>
    Object.freeze({
      key: group.kind,
      kind: 'category' as const,
      label: groupLabels[group.kind],
      collapsible: false,
      items: Object.freeze(
        group.options.map((option) => {
          const key = `${group.kind}:${option.talentKey}`;
          relatedNodeKeys[key] = option.relatedNodeKeys;
          const explanation = optionExplanation(kind, group.kind, option);
          const name = talentLabel(hex, option.talentKey);
          return Object.freeze({
            key,
            value: option.edit,
            label: option.depth === undefined ? name : `${name} — column ${option.depth}`,
            state: 'possible' as const,
            selected: option.selected,
            disabled: false,
            ...(explanation === undefined ? {} : { explanation }),
          });
        }),
      ),
    }),
  );
  const selected = sections.flatMap((section) => section.items).find((item) => item.selected);
  return Object.freeze({
    model: Object.freeze({
      ...(selected === undefined ? {} : { selected }),
      sections: Object.freeze(sections),
    }),
    heading: `${kind} · ${talent}`,
    relatedNodeKeys: Object.freeze(relatedNodeKeys),
  });
}

/** The Common decks as a table: one row per deck, one cell per Common column. */
function deckTable(
  catalog: Catalog,
  hex: HexDeclaration,
  decks: HexCommonDecks,
): WorkspaceHexDeckTable {
  // One chip width for every Hex: the catalog's longest Common label.
  const chipLength = Math.max(
    ...catalog.hexes.values.flatMap((candidate) =>
      candidate.repeatableCandidates.values.map((talent) => talent.label.length),
    ),
  );
  const columns = Object.freeze(
    decks.depths.map((depth, index) =>
      Object.freeze({ key: `${depth}`, label: `Column ${depth}`, commonColumn: index }),
    ),
  );
  if (decks.decks === undefined)
    return Object.freeze({
      columns,
      chipLength,
      unreadable: 'Fix the marked nodes to see which deck dealt each talent.',
    });
  return Object.freeze({
    columns,
    chipLength,
    rows: Object.freeze(
      decks.decks.map((deck) => {
        const label = `Deck ${deck.index + 1}`;
        return Object.freeze({
          key: `${deck.index}`,
          label,
          cells: Object.freeze(
            decks.depths.map((depth) => {
              const segment = deck.segments.find((candidate) => candidate.depth === depth);
              return Object.freeze(
                (segment?.talentKeys ?? []).map((talentKey, index) =>
                  Object.freeze({
                    key: `${depth}:${talentKey}`,
                    label: talentLabel(hex, talentKey),
                    name: `${label}, column ${depth}: ${talentLabel(hex, talentKey)}`,
                    nodeKey: segment!.nodeKeys[index]!,
                  }),
                ),
              );
            }),
          ),
        });
      }),
    ),
  });
}

/** Projects one authored Hex tree into its board: every node's talent, edits and conflict. */
export function projectHexTreeDomain(
  catalog: Catalog,
  spellTraitKey: string,
  tree: AuthoredHexTreeConfiguration,
  owner: HexTreeAddress['owner'],
): WorkspaceHexTreeDomain | undefined {
  const hex = catalog.hexes.byKey[spellTraitKey];
  const layout = hex?.layouts.byKey[tree.layoutKey];
  if (hex === undefined || layout === undefined) return undefined;
  const violations = assessAuthoredHexTree(catalog, spellTraitKey, tree);
  const conflicting = new Set(violations.flatMap((violation) => violation.nodeKeys));
  const talentOf = (node: HexLayoutNodeDeclaration) =>
    talentLabel(
      hex,
      node.kind === 'olympianSpell'
        ? hex.godSent.olympianTalentKey
        : node.kind === 'olympianCount'
          ? hex.godSent.lineageTalentKey
          : tree.nodes[node.key]!,
    );
  const names = nodeNames(layout, talentOf);
  const commonDecks = authoredHexCommonDecks(catalog, spellTraitKey, tree);
  const nodes = layout.nodes.values.map((node): WorkspaceHexTreeNode => {
    const olympian = node.kind === 'olympianSpell' || node.kind === 'olympianCount';
    return Object.freeze({
      nodeKey: node.key,
      kind: node.kind,
      name: names.get(node.key)!,
      x: node.depth + node.gridOffsetX,
      y: node.slot + node.gridOffsetY,
      linkTo: Object.freeze(node.linkTo.map((slot) => `${node.depth + 1}:${slot}`)),
      talentLabel: talentOf(node),
      conflict: conflicting.has(node.key),
      ...(node.kind === 'repeatable'
        ? { commonColumn: commonDecks.depths.indexOf(node.depth) }
        : {}),
      ...(olympian
        ? {}
        : {
            editor: nodeEditor(
              hex,
              node,
              talentOf(node),
              authoredHexNodeEditOptions(catalog, spellTraitKey, tree, node.key),
            ),
          }),
    });
  });
  const treeIssues = violations.map((violation) => treeIssue(hex, layout, tree.nodes, violation));
  return Object.freeze({
    value: tree,
    address: createHexTreeAddress(owner),
    layoutPicker: projectDirectTraitOutcomePicker(
      hex.layouts.values.map((candidate) => ({
        value: candidate.key,
        support: 'possible' as const,
        branchSupport: Object.freeze([true]),
        selected: candidate.key === tree.layoutKey,
      })),
      (key) => hex.layouts.byKey[key]?.label ?? key,
      (key) => key,
    ),
    nodes: Object.freeze(nodes),
    decks: deckTable(catalog, hex, commonDecks),
    ...(treeIssues.length === 0 ? {} : { treeIssue: treeIssues.join(' ') }),
    edit: (edit: AuthoredHexTreeEdit) =>
      applyAuthoredHexTreeEdit(catalog, spellTraitKey, tree, edit),
  });
}

export function bindHexTreeInteraction(input: {
  readonly catalog: Catalog;
  readonly child:
    Extract<WorkspaceTraitCarrierChildControl, { readonly kind: 'hexTree' }> | undefined;
  readonly owner: TraitOfferAddress;
  readonly optionKey: TraitOptionKey;
  readonly value: AuthoredTraitOfferTraits;
}): WorkspaceHexTreeInteraction | undefined {
  const { catalog, child, owner, optionKey, value } = input;
  if (value.selectedOptionKey !== optionKey) return undefined;
  if (child === undefined) return undefined;
  const selected = value.options[optionIndex(optionKey)];
  if (selected === undefined) return undefined;
  if (child.optionKey !== optionKey || child.traitKey !== selected.traitKey) return undefined;
  const hex = catalog.hexes.byKey[selected.traitKey];
  if (hex === undefined) return undefined;
  const interaction: WorkspaceHexTreeInteraction = {
    child,
    update: (offer, tree) =>
      updateAuthoredTraitCarrierChild(offer, { kind: 'hexTree', child, value: tree }),
    defaultFor: (offer) => {
      const selectedOption = offer.options[optionIndex(offer.selectedOptionKey)];
      if (selectedOption === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(owner)} is missing its selected Spell option`,
        );
      return createDefaultAuthoredHexTree(catalog, selectedOption.traitKey);
    },
    forOffer: (offer) => ({
      load: () => {
        const option = offer.options[optionIndex(offer.selectedOptionKey)];
        const tree =
          offer.hexTree ?? child.value ?? createDefaultAuthoredHexTree(catalog, option!.traitKey);
        return projectHexTreeDomain(catalog, option!.traitKey, tree, owner);
      },
    }),
  };
  return interaction;
}
