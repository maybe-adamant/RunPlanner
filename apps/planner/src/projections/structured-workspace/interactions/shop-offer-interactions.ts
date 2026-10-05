import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ShopOptionSelection } from '@run-planner/engine/reward-kernel';
import { locallyValidRewardOffers } from '@run-planner/engine/reward-kernel';

import type { CandidateProjectionSession } from '@planner/projections/candidates/candidateProjection';
import type {
  ContextualPickerModel,
  ContextualPickerProjectionService,
} from '@planner/projections/contextual/contextualPicker';
import type { RewardPickerProjectionService } from '@planner/projections/rewards/rewardPicker';

import type { WorkspaceRewardControl } from '../contracts/rewards';
import type { WorkspaceShopOfferInteraction } from '../contracts/commerce';

function selectionKey(selection: ShopOptionSelection | null): string {
  return selection === null ? 'clear' : JSON.stringify(selection);
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

/** An invalid current item can be cleared only when no item can replace it. */
function withClearForInvalidSelection(
  model: ContextualPickerModel<ShopOptionSelection>,
): ContextualPickerModel<ShopOptionSelection | null> {
  const replaceable = model.sections.some(
    (section) =>
      section.kind !== 'selectedInvalid' &&
      section.items.some((item) => item.state === 'possible' || item.state === 'forced'),
  );
  if (replaceable) return model;
  return Object.freeze({
    ...model,
    sections: Object.freeze(
      model.sections.map((section) =>
        section.kind !== 'selectedInvalid'
          ? section
          : Object.freeze({
              ...section,
              items: Object.freeze([
                ...section.items,
                Object.freeze({
                  key: selectionKey(null),
                  value: null,
                  label: 'Clear item',
                  state: 'possible' as const,
                  selected: false,
                  disabled: false,
                }),
              ]),
            }),
      ),
    ),
  });
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
        intentFor: (value: ShopOptionSelection | null) =>
          Object.freeze({
            command:
              value === null
                ? Object.freeze({ kind: 'ClearShopOffer' as const, offer: owner })
                : Object.freeze({
                    kind: 'ReplaceShopOfferOption' as const,
                    offer: owner,
                    value,
                  }),
          }),
        load: async () => {
          const candidates = await input.candidates.shopOfferOptions(owner, values);
          const model = input.contextualPicker.project(
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
          return withClearForInvalidSelection(model);
        },
      }),
    );
  }
  return interactions;
}
