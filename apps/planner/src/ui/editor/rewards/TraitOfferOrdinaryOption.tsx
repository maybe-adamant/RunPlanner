import {
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import { useMemo } from 'react';

import type { TraitOptionDomainProjection } from '@planner/projections/rewards/traitDomainProjection';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceTraitOfferInteraction } from '@planner/projections/structured-workspace';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { spellOfferSlotPresentation } from './spellOfferPresentation';
import { TraitOfferOption } from './TraitOfferOption';
import { replaceTraitOfferOption } from './traitOfferOptions';

const emptyTraitPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

export function TraitOfferOrdinaryOption({
  index,
  interaction,
  optionKey,
  rejected,
  effectiveRarity,
  effectiveLevel,
  persephoneLevelBonusMaximum,
  spellOffer = false,
  rarifySupported,
  value,
  onUpdate,
}: {
  readonly index: number;
  readonly interaction: WorkspaceTraitOfferInteraction;
  readonly optionKey: AuthoredTraitOfferTraits['selectedOptionKey'];
  /** Rejected keeps this generated row visible but unavailable. */
  readonly rejected: boolean;
  readonly effectiveRarity?: TraitRarity;
  readonly effectiveLevel?: number;
  readonly persephoneLevelBonusMaximum?: number;
  readonly spellOffer?: boolean;
  readonly rarifySupported: boolean;
  readonly value: AuthoredTraitOfferTraits;
  readonly onUpdate: (value: AuthoredTraitOfferTraits) => void;
}) {
  const option = value.options[index];
  if (option === undefined) throw new Error(`Trait offer is missing ${optionKey}`);
  const loadable = useMemo(
    () => interaction.optionDomain(value, optionKey),
    [interaction, optionKey, value],
  );
  const controller = useWorkspaceInteractionController<TraitOptionDomainProjection>();
  const loaded = controller.observe(loadable);
  const domain = loaded.result;
  const traitPicker = domain?.traitPicker ?? emptyTraitPicker;
  const rarityPicker = domain?.rarityPickerFor(option.traitKey);
  const hasEditableRarity =
    interaction.rarityEditable &&
    interaction.giver.rarityPolicy.kind === 'selectable' &&
    interaction.rarityEditableFor(option.traitKey);
  const idPrefix = `${semanticAddressKey(interaction.owner)}-${optionKey}`;
  const spellSlot = spellOffer ? spellOfferSlotPresentation(interaction.giver, index) : undefined;
  const withSelectedHexDefault = (
    nextValue: AuthoredTraitOfferTraits,
  ): AuthoredTraitOfferTraits => {
    if (!spellOffer || nextValue.selectedOptionKey !== optionKey) return nextValue;
    const { hexTree: _hexTree, ...withoutTree } = nextValue;
    void _hexTree;
    const selectedDomain = interaction
      .optionDomain(withoutTree, optionKey)
      .children.find(
        (child): child is Extract<typeof child, { readonly child: { readonly kind: 'hexTree' } }> =>
          child.child.kind === 'hexTree',
      );
    return selectedDomain === undefined
      ? Object.freeze(withoutTree)
      : Object.freeze({ ...withoutTree, hexTree: selectedDomain.defaultFor(withoutTree) });
  };
  const selectTrait = (traitKey: string): void => {
    const preferred = domain?.preferredOptionFor(traitKey);
    if (preferred === undefined) return;
    const nextOption =
      preferred.traitKey === option.traitKey
        ? Object.freeze({ ...option, ...preferred })
        : Object.freeze({
            ...preferred,
            ...(option.persephoneLevelBonus === undefined
              ? {}
              : { persephoneLevelBonus: option.persephoneLevelBonus }),
          });
    const nextValue = replaceTraitOfferOption(value, index, nextOption);
    onUpdate(withSelectedHexDefault(nextValue));
  };
  const selectRarity = (rarity: TraitRarity): void => {
    onUpdate(replaceTraitOfferOption(value, index, { ...option, rarity }));
  };
  const selectPersephoneBonus = (bonus: number): void => {
    if (bonus === 0) {
      const { persephoneLevelBonus, ...withoutBonus } = option;
      void persephoneLevelBonus;
      onUpdate(replaceTraitOfferOption(value, index, withoutBonus));
      return;
    }
    const nextOption = { ...option, persephoneLevelBonus: bonus };
    onUpdate(replaceTraitOfferOption(value, index, nextOption));
  };
  return (
    <TraitOfferOption
      controlId={idPrefix}
      {...(effectiveLevel === undefined ? {} : { effectiveLevel })}
      {...(effectiveRarity === undefined ? {} : { effectiveRarity })}
      {...(!hasEditableRarity && option.rarity !== undefined ? { fixedRarity: option.rarity } : {})}
      {...(!hasEditableRarity && option.rarity !== undefined
        ? { fixedRarityAriaLabel: `${optionKey} fixed rarity` }
        : {})}
      legend={optionKey.replace('option', spellOffer ? 'Spell ' : 'Option ')}
      loading={loaded.pending}
      {...(spellOffer
        ? {}
        : {
            onRarify: () =>
              onUpdate(
                Object.freeze({
                  ...value,
                  rarificationActions: Object.freeze([
                    ...(value.rarificationActions ?? []),
                    optionKey,
                  ]),
                }),
              ),
          })}
      {...(!hasEditableRarity
        ? {}
        : {
            onSelectRarity: selectRarity,
            ...(rarityPicker === undefined ? {} : { rarityPicker }),
            ...(option.rarity === undefined ? {} : { rarityValue: option.rarity }),
          })}
      onPersephoneLevelBonusChange={selectPersephoneBonus}
      onRarityOpenChange={(open) => {
        if (open) controller.activate(loadable);
      }}
      onSelectTrait={selectTrait}
      onSelectedChange={() =>
        onUpdate(withSelectedHexDefault(Object.freeze({ ...value, selectedOptionKey: optionKey })))
      }
      onTraitOpenChange={(open) => {
        if (open) controller.activate(loadable);
      }}
      persephoneAriaLabel={`${optionKey} Persephone level bonus`}
      {...(option.persephoneLevelBonus === undefined
        ? {}
        : { persephoneLevelBonus: option.persephoneLevelBonus })}
      {...(persephoneLevelBonusMaximum === undefined ? {} : { persephoneLevelBonusMaximum })}
      selected={value.selectedOptionKey === optionKey}
      selectedDisabled={rejected}
      selectedLabel={rejected ? 'Blocked by Rejected' : 'Selected'}
      selectedName={`${semanticAddressKey(interaction.owner)}-selected`}
      {...(spellSlot === undefined ? {} : { spellSlot })}
      traitAriaLabel={`${spellOffer ? optionKey.replace('option', 'Spell ') : optionKey} trait`}
      traitLabel={interaction.traitLabel(option.traitKey)}
      traitPicker={traitPicker}
      rarityAriaLabel={`${optionKey} rarity`}
      rarifyDisabled={rejected || !rarifySupported}
    />
  );
}
