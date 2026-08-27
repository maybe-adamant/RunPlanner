import {
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import { useMemo } from 'react';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import type { TraitOptionDomainProjection } from '@planner/projections/traitDomainProjection';
import type { WorkspaceTraitOfferInteraction } from '@planner/projections/structured-workspace';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useWorkspaceInteractionController } from '@planner/ui/controls/useWorkspaceInteraction';
import { replaceTraitOfferOption } from './traitOfferOptions';

const emptyTraitPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});
const emptyRarityPicker: ContextualPickerModel<TraitRarity> = Object.freeze({
  sections: Object.freeze([]),
});

function rarityLabel(rarity: TraitRarity): string {
  return rarity;
}

export function TraitOfferOrdinaryOption({
  index,
  interaction,
  optionKey,
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
    onUpdate(replaceTraitOfferOption(value, index, nextOption));
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
    <fieldset className="trait-offer-option" key={optionKey}>
      <legend>
        {spellOffer
          ? optionKey.replace('option', 'Spell ')
          : optionKey.replace('option', 'Option ')}
      </legend>
      <ContextualPicker
        ariaLabel={`${spellOffer ? optionKey.replace('option', 'Spell ') : optionKey} trait`}
        id={`${idPrefix}-trait`}
        label="Trait"
        loading={loaded.pending}
        model={traitPicker}
        onOpenChange={(open) => {
          if (open) controller.activate(loadable);
        }}
        onSelect={selectTrait}
        placeholder="Choose a trait"
        triggerLabel={interaction.traitLabel(option.traitKey)}
      />
      {!hasEditableRarity ? (
        option.rarity === undefined ? null : (
          <p className="trait-offer-fixed-rarity">Rarity: {rarityLabel(option.rarity)}</p>
        )
      ) : value.kind !== 'traits' ? null : (
        <ContextualPicker
          ariaLabel={`${optionKey} rarity`}
          id={`${idPrefix}-rarity`}
          label="Rarity"
          loading={loaded.pending}
          model={rarityPicker ?? emptyRarityPicker}
          onOpenChange={(open) => {
            if (open) controller.activate(loadable);
          }}
          onSelect={selectRarity}
          placeholder="Choose a rarity"
          {...(option.rarity === undefined ? {} : { triggerLabel: rarityLabel(option.rarity) })}
        />
      )}
      {spellOffer ? null : (
        <button
          className="secondary-action action-compact"
          disabled={!rarifySupported}
          onClick={() =>
            onUpdate(
              Object.freeze({
                ...value,
                rarificationActions: Object.freeze([
                  ...(value.rarificationActions ?? []),
                  optionKey,
                ]),
              }),
            )
          }
          type="button"
        >
          Rarify
        </button>
      )}
      {effectiveRarity === undefined ? null : <p>Effective rarity: {effectiveRarity}</p>}
      {effectiveLevel === undefined ? null : <p>Effective level: {effectiveLevel}</p>}
      {persephoneLevelBonusMaximum === undefined ? null : (
        <label className="field-control field-control-inline">
          <span>Persephone bonus</span>
          <select
            aria-label={`${optionKey} Persephone level bonus`}
            id={`${idPrefix}-persephone-level-bonus`}
            onChange={(event) => selectPersephoneBonus(Number(event.target.value))}
            value={option.persephoneLevelBonus ?? 0}
          >
            {Array.from({ length: persephoneLevelBonusMaximum + 1 }, (_, bonus) => (
              <option key={bonus} value={bonus}>
                +{bonus}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="trait-option-selected">
        <input
          checked={value.selectedOptionKey === optionKey}
          name={`${semanticAddressKey(interaction.owner)}-selected`}
          onChange={() => onUpdate(Object.freeze({ ...value, selectedOptionKey: optionKey }))}
          type="radio"
        />
        Selected
      </label>
    </fieldset>
  );
}
