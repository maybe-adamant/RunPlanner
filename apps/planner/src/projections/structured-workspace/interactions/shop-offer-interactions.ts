import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ShopOptionSelection } from '@run-planner/engine/reward-kernel';
import { locallyValidRewardOffers } from '@run-planner/engine/reward-kernel';

import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import type { ContextualPickerProjectionService } from '@planner/projections/contextualPicker';
import type { RewardPickerProjectionService } from '@planner/projections/rewardPicker';

import type { WorkspaceRewardControl, WorkspaceShopOfferInteraction } from '../contract';

function selectionKey(selection: ShopOptionSelection): string {
  return JSON.stringify(selection);
}

function sameSelection(left: ShopOptionSelection, right: ShopOptionSelection): boolean {
  return selectionKey(left) === selectionKey(right);
}

function selectionLabel(catalog: Catalog, optionLabel: string, selection: ShopOptionSelection) {
  const payload = selection.offer.payload;
  if (payload?.kind !== 'BoonSource') return optionLabel;
  const source = catalog.rewards.rewardTypes.byKey[payload.source];
  if (source === undefined) throw new Error(`Shop Boon source ${payload.source} is missing`);
  return `${optionLabel} · ${source.label}`;
}

function pickerItemLabel(catalog: Catalog, optionLabel: string, selection: ShopOptionSelection) {
  const payload = selection.offer.payload;
  if (payload?.kind !== 'BoonSource') return optionLabel;
  const source = catalog.rewards.rewardTypes.byKey[payload.source];
  if (source === undefined) throw new Error(`Shop Boon source ${payload.source} is missing`);
  return source.label;
}

/** Binds exact declaration-owned Shop item identities to one contextual picker. */
export function bindShopOfferInteractions(input: {
  readonly candidates: CandidateProjectionSession;
  readonly catalog: Catalog;
  readonly contextualPicker: ContextualPickerProjectionService;
  readonly rewardPicker: RewardPickerProjectionService;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
}): ReadonlyMap<string, WorkspaceShopOfferInteraction> {
  const interactions = new Map<string, WorkspaceShopOfferInteraction>();
  for (const [key, control] of input.rewardControls) {
    if (control.owner.kind !== 'shopOffer' || control.shopOption === undefined) continue;
    const owner = control.owner.address;
    const selected =
      control.shopOption.selectedOptionKey === null || control.offer === null
        ? null
        : Object.freeze({
            optionKey: control.shopOption.selectedOptionKey,
            offer: control.offer,
          });
    const values = control.shopOption.options.flatMap((option) => {
      let offers = locallyValidRewardOffers(input.catalog.rewards, option.rewardType);
      const representative = offers[0];
      if (
        representative !== undefined &&
        input.rewardPicker.resolvesAtAcquisition(representative)
      ) {
        offers = Object.freeze([Object.freeze({ rewardType: option.rewardType })]);
      }
      if (
        selected?.optionKey === option.key &&
        !offers.some((offer) =>
          sameSelection(Object.freeze({ optionKey: option.key, offer }), selected),
        )
      ) {
        offers = Object.freeze([...offers, selected.offer]);
      }
      return offers.map((offer) => Object.freeze({ optionKey: option.key, offer }));
    });
    const optionLabelByKey = new Map(
      control.shopOption.options.map((option) => [option.key, option.label] as const),
    );
    const summary =
      selected === null
        ? 'Choose item'
        : selectionLabel(
            input.catalog,
            optionLabelByKey.get(selected.optionKey) ?? selected.optionKey,
            selected,
          );
    interactions.set(
      key,
      Object.freeze({
        key,
        owner,
        selected,
        summary,
        intentFor: (value: ShopOptionSelection) =>
          Object.freeze({
            command: Object.freeze({
              kind: 'ReplaceShopOfferOption' as const,
              offer: owner,
              value,
            }),
          }),
        load: async () => {
          const candidates = await input.candidates.shopOfferOptions(owner, values);
          return input.contextualPicker.project(
            candidates,
            (candidate) => {
              const optionLabel =
                optionLabelByKey.get(candidate.value.optionKey) ?? candidate.value.optionKey;
              return Object.freeze({
                category:
                  candidate.value.offer.payload?.kind === 'BoonSource' ? optionLabel : 'Shop Items',
                label: pickerItemLabel(input.catalog, optionLabel, candidate.value),
                selected: selected !== null && sameSelection(candidate.value, selected),
              });
            },
            selectionKey,
          );
        },
      }),
    );
  }
  return interactions;
}
