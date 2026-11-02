import type {
  WorkspaceHexBoardNode,
  WorkspaceHexColumnChip,
  WorkspaceHexColumnDeal,
  WorkspaceHexColumnDeckSegment,
  WorkspaceHexColumnRow,
  WorkspaceHexNodeEditor,
  WorkspaceHexTreeDomain,
  WorkspaceHexTreeInteraction,
  WorkspaceHexTreeNode,
  WorkspaceTraitCarrierChildControl,
} from '@planner/projections/structured-workspace/contracts/traits';
import {
  applyAuthoredHexTreeEdit,
  assessAuthoredHexTree,
  authoredHexColumnDeal,
  authoredHexColumns,
  authoredHexNodeEditOptions,
  createDefaultAuthoredHexTree,
  createHexTreeAddress,
  optionIndex,
  semanticAddressKey,
  updateAuthoredTraitCarrierChild,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredHexNodeEditGroup,
  AuthoredHexNodeEditOption,
  AuthoredHexTreeConfiguration,
  AuthoredHexTreeEdit,
  AuthoredTraitOfferTraits,
  HexCommonColumnDealSegment,
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

/** A repeated talent names its nodes; a draw that fails names the first column it fails at. */
function treeIssue(
  hex: HexDeclaration,
  layout: HexLayoutDeclaration,
  columns: readonly WorkspaceHexColumnRow[],
  violation: HexTalentTreeViolation,
): string {
  if (violation.kind === 'repeatedTalent') {
    const kind = kindLabels[layout.nodes.byKey[violation.nodeKeys[0]!]!.kind];
    return `${talentLabel(hex, violation.talentKey)} on ${counts[violation.nodeKeys.length] ?? violation.nodeKeys.length} ${kind} nodes`;
  }
  const column = columns.find((row) => row.draw?.undrawable === true);
  return column === undefined ? "Common columns can't be dealt" : `${column.label} can't be dealt`;
}

/** A Rare or Epic talent another node of the kind holds. */
function optionExplanation(kind: string, option: AuthoredHexNodeEditOption): string | undefined {
  return option.selected || option.relatedNodeKeys.length === 0
    ? undefined
    : `On another ${kind} node`;
}

/** A Rare or Epic node's picker over its pool. */
function nodeEditor(
  hex: HexDeclaration,
  node: HexLayoutNodeDeclaration,
  talent: string,
  groups: readonly AuthoredHexNodeEditGroup[],
): WorkspaceHexNodeEditor {
  const kind = kindLabels[node.kind];
  const relatedNodeKeys: Record<string, readonly string[]> = {};
  const talentKeys: Record<string, string> = {};
  const sections = groups.map((group) =>
    Object.freeze({
      key: group.kind,
      kind: 'category' as const,
      label: 'Talents',
      collapsible: false,
      items: Object.freeze(
        group.options.map((option) => {
          const key = `${group.kind}:${option.talentKey}`;
          relatedNodeKeys[key] = option.relatedNodeKeys;
          talentKeys[key] = option.talentKey;
          const explanation = optionExplanation(kind, option);
          return Object.freeze({
            key,
            value: option.edit,
            label: talentLabel(hex, option.talentKey),
            state: 'possible' as const,
            selected: option.selected,
            disabled: false,
            ...(explanation === undefined ? {} : { explanations: Object.freeze([explanation]) }),
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
    talentKeys: Object.freeze(talentKeys),
  });
}

function chip(hex: HexDeclaration, talentKey: string): WorkspaceHexColumnChip {
  return Object.freeze({ talentKey, label: talentLabel(hex, talentKey) });
}

/**
 * The cards a deal has left, deck by deck; a deck the column reaches after
 * the one before it emptied is a refill. A talent is a pick at its first
 * card only, since the deal takes it the same from either.
 */
function dealDeck(
  hex: HexDeclaration,
  segments: readonly HexCommonColumnDealSegment[],
  next: readonly string[],
  previousDeckIndex: number | undefined,
): readonly WorkspaceHexColumnDeckSegment[] {
  const offered = new Set<string>();
  return Object.freeze(
    segments.flatMap((segment, index) =>
      segment.remainingTalentKeys.length === 0
        ? []
        : [
            Object.freeze({
              key: `${segment.deckIndex}`,
              refill:
                index > 0 ||
                (previousDeckIndex !== undefined && previousDeckIndex !== segment.deckIndex),
              cards: Object.freeze(
                segment.remainingTalentKeys.map((talentKey) => {
                  const pick = next.includes(talentKey) && !offered.has(talentKey);
                  if (pick) offered.add(talentKey);
                  return Object.freeze({ ...chip(hex, talentKey), pick });
                }),
              ),
            }),
          ],
    ),
  );
}

/** The Common columns in draw order, each with its decks, talents and deal. */
function columnRows(
  catalog: Catalog,
  hex: HexDeclaration,
  spellTraitKey: string,
  tree: AuthoredHexTreeConfiguration,
): readonly WorkspaceHexColumnRow[] {
  const columns = authoredHexColumns(catalog, spellTraitKey, tree);
  return Object.freeze(
    columns.map((column, index) => {
      const previousDeckIndex = columns[index - 1]?.deck?.at(-1)?.deckIndex;
      const deal = (dealt: readonly string[]): WorkspaceHexColumnDeal => {
        const product = authoredHexColumnDeal(catalog, spellTraitKey, tree, column.depth, dealt)!;
        return Object.freeze({
          dealt: product.dealt,
          slots: Object.freeze(
            product.nodeKeys.map((nodeKey, slot) => {
              const talentKey = product.dealt[slot];
              return Object.freeze({
                nodeKey,
                ...(talentKey === undefined ? {} : { talent: chip(hex, talentKey) }),
              });
            }),
          ),
          deck: dealDeck(hex, product.segments, product.nextTalentKeys, previousDeckIndex),
          ...(product.edit === undefined ? {} : { edit: product.edit }),
        });
      };
      return Object.freeze({
        depth: column.depth,
        label: `Column ${index + 1}`,
        slots: Object.freeze(
          column.slots.map((slot) =>
            Object.freeze({ nodeKey: slot.nodeKey, talent: chip(hex, slot.talentKey) }),
          ),
        ),
        ...(column.deck === undefined
          ? {}
          : {
              draw: Object.freeze({
                undrawable: !column.drawable,
                deal,
              }),
            }),
      });
    }),
  );
}

/** The tree's present nodes on the native grid, named by the talents the tree places. */
export function projectHexBoardNodes(
  hex: HexDeclaration,
  layout: HexLayoutDeclaration,
  tree: AuthoredHexTreeConfiguration,
  present: (node: HexLayoutNodeDeclaration) => boolean = () => true,
): readonly WorkspaceHexBoardNode[] {
  const talentKeyOf = (node: HexLayoutNodeDeclaration) =>
    node.kind === 'olympianSpell'
      ? hex.godSent.olympianTalentKey
      : node.kind === 'olympianCount'
        ? hex.godSent.lineageTalentKey
        : tree.nodes[node.key]!;
  const talentOf = (node: HexLayoutNodeDeclaration) => talentLabel(hex, talentKeyOf(node));
  const names = nodeNames(layout, talentOf);
  return layout.nodes.values.filter(present).map((node) =>
    Object.freeze({
      nodeKey: node.key,
      kind: node.kind,
      name: names.get(node.key)!,
      x: node.depth + node.gridOffsetX,
      y: node.slot + node.gridOffsetY,
      linkTo: Object.freeze(node.linkTo.map((slot) => `${node.depth + 1}:${slot}`)),
      talentKey: talentKeyOf(node),
      talentLabel: talentOf(node),
    }),
  );
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
  const columns = columnRows(catalog, hex, spellTraitKey, tree);
  const conflicting = new Set(violations.flatMap((violation) => violation.nodeKeys));
  const nodes = projectHexBoardNodes(hex, layout, tree).map((board): WorkspaceHexTreeNode => {
    const node = layout.nodes.byKey[board.nodeKey]!;
    const olympian = node.kind === 'olympianSpell' || node.kind === 'olympianCount';
    return Object.freeze({
      ...board,
      conflict: conflicting.has(node.key),
      ...(olympian || node.kind === 'repeatable'
        ? {}
        : {
            editor: nodeEditor(
              hex,
              node,
              board.talentLabel,
              authoredHexNodeEditOptions(catalog, spellTraitKey, tree, node.key),
            ),
          }),
    });
  });
  // A repeated talent is its own issue; the refill cycle's issue stays one however its nodes change.
  const treeIssues = violations.map(
    (violation) =>
      [
        violation.kind === 'repeatedTalent'
          ? `${violation.kind}:${violation.talentKey}`
          : violation.kind,
        treeIssue(hex, layout, columns, violation),
      ] as const,
  );
  return Object.freeze({
    value: tree,
    address: createHexTreeAddress(owner),
    layoutPicker: projectDirectTraitOutcomePicker(
      hex.layouts.values.map((candidate) => ({
        value: candidate.key,
        support: 'possible' as const,
        selected: candidate.key === tree.layoutKey,
      })),
      (key) => hex.layouts.byKey[key]?.label ?? key,
      (key) => key,
    ),
    nodes: Object.freeze(nodes),
    deckLegend: Object.freeze(
      hex.repeatableCandidates.values.map((talent) =>
        talent.maxCount === undefined ? talent.label : `${talent.label} ×${talent.maxCount}`,
      ),
    ),
    columns,
    treeIssues: Object.freeze(treeIssues),
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
