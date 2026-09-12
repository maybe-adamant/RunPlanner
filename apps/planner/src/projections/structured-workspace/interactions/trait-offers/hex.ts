import type {
  WorkspaceHexTreeDomain,
  WorkspaceHexTreeInteraction,
  WorkspaceTraitCarrierChildControl,
} from '@planner/projections/structured-workspace/contracts/traits';
import {
  createDefaultAuthoredHexTree,
  optionIndex,
  semanticAddressKey,
  transitionAuthoredHexTreeLayout,
  updateAuthoredTraitCarrierChild,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredHexTreeConfiguration,
  AuthoredTraitOfferTraits,
  TraitOptionKey,
  TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { projectDirectTraitOutcomePicker } from '@planner/projections/contextual/directTraitOutcomeProjection';
import { StructuredWorkspaceProjectionContractError } from '@planner/projections/structured-workspace/contract';

/** Projects one complete authored Hex tree into the shared editor product. */
export function projectHexTreeDomain(
  catalog: Catalog,
  spellTraitKey: string,
  tree: AuthoredHexTreeConfiguration,
): WorkspaceHexTreeDomain | undefined {
  const selectedHex = catalog.hexes.byKey[spellTraitKey];
  if (selectedHex === undefined) return undefined;
  const selectedCandidates = (
    candidates: readonly { readonly key: string; readonly label: string }[],
    selectedKeys: readonly string[],
    selectedKey: string | undefined,
  ) =>
    projectDirectTraitOutcomePicker(
      candidates.map((candidate) => ({
        value: candidate.key,
        support:
          selectedKey === candidate.key || !selectedKeys.includes(candidate.key)
            ? ('possible' as const)
            : ('impossible' as const),
        branchSupport: Object.freeze([true]),
        selected: selectedKey === candidate.key,
        ...(selectedKey === candidate.key || !selectedKeys.includes(candidate.key)
          ? {}
          : { reason: 'duplicateTrait' as const }),
      })),
      (key) =>
        selectedHex.rareCandidates.byKey[key]?.label ??
        selectedHex.epicCandidates.byKey[key]?.label ??
        key,
      (key) => key,
    );
  return Object.freeze({
    value: tree,
    layoutPicker: projectDirectTraitOutcomePicker(
      selectedHex.layouts.values.map((layout) => ({
        value: layout.key,
        support: 'possible' as const,
        branchSupport: Object.freeze([true]),
        selected: layout.key === tree.layoutKey,
      })),
      (key) => selectedHex.layouts.byKey[key]?.label ?? key,
      (key) => key,
    ),
    rarePickerFor: (selectedKeys: readonly string[], selectedKey?: string) =>
      selectedCandidates(selectedHex.rareCandidates.values, selectedKeys, selectedKey),
    epicPickerFor: (selectedKeys: readonly string[], selectedKey?: string) =>
      selectedCandidates(selectedHex.epicCandidates.values, selectedKeys, selectedKey),
    godSent: selectedHex.godSent,
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
    transitionFor: (offer, layoutKey) => {
      const selectedOption = offer.options[optionIndex(offer.selectedOptionKey)];
      if (selectedOption === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(owner)} is missing its selected Spell option`,
        );
      return transitionAuthoredHexTreeLayout(
        catalog,
        selectedOption.traitKey,
        offer.hexTree ?? createDefaultAuthoredHexTree(catalog, selectedOption.traitKey),
        layoutKey,
      );
    },
    forOffer: (offer) => ({
      load: () => {
        const option = offer.options[optionIndex(offer.selectedOptionKey)];
        const tree =
          offer.hexTree ?? child.value ?? createDefaultAuthoredHexTree(catalog, option!.traitKey);
        return projectHexTreeDomain(catalog, option!.traitKey, tree);
      },
    }),
  };
  return interaction;
}
