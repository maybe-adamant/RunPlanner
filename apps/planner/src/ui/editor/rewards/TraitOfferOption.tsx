import type { TraitRarity } from '@run-planner/engine/catalog-schema';

import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';

const emptyRarityPicker: ContextualPickerModel<TraitRarity> = Object.freeze({
  sections: Object.freeze([]),
});

function rarityLabel(rarity: TraitRarity): string {
  return rarity;
}

/** One bound trait row. Controllers retain draft and candidate policy. */
export function TraitOfferOption<TraitValue>({
  controlId,
  effectiveLevel,
  effectiveRarity,
  fixedRarity,
  fixedRarityAriaLabel,
  legend,
  loading,
  onRarify,
  onPersephoneLevelBonusChange,
  onRarityOpenChange,
  onSelectRarity,
  onSelectTrait,
  onSelectedChange,
  onTraitOpenChange,
  persephoneLevelBonus,
  persephoneLevelBonusMaximum,
  rarityPicker,
  rarityAriaLabel,
  rarityValue,
  rarifyDisabled,
  selected,
  selectedDisabled,
  selectedLabel,
  selectedName,
  spellSlot,
  traitAriaLabel,
  persephoneAriaLabel,
  traitLabel,
  traitPicker,
}: {
  readonly controlId: string;
  readonly effectiveLevel?: number;
  readonly effectiveRarity?: TraitRarity;
  readonly fixedRarity?: TraitRarity;
  readonly fixedRarityAriaLabel?: string;
  readonly legend: string;
  readonly loading: boolean;
  readonly onRarify?: () => void;
  readonly onPersephoneLevelBonusChange?: (bonus: number) => void;
  readonly onRarityOpenChange?: (open: boolean) => void;
  readonly onSelectRarity?: (rarity: TraitRarity) => void;
  readonly onSelectTrait: (value: TraitValue) => void;
  readonly onSelectedChange: () => void;
  readonly onTraitOpenChange?: (open: boolean) => void;
  readonly persephoneLevelBonus?: number;
  readonly persephoneLevelBonusMaximum?: number;
  readonly rarityPicker?: ContextualPickerModel<TraitRarity>;
  readonly rarityAriaLabel?: string;
  readonly rarityValue?: TraitRarity;
  readonly rarifyDisabled?: boolean;
  readonly selected: boolean;
  readonly selectedDisabled: boolean;
  readonly selectedLabel: string;
  readonly selectedName: string;
  readonly spellSlot?: { readonly bonus: number; readonly moonglow: string };
  readonly traitAriaLabel: string;
  readonly persephoneAriaLabel?: string;
  readonly traitLabel?: string;
  readonly traitPicker: ContextualPickerModel<TraitValue>;
}) {
  return (
    <fieldset className="trait-offer-option trait-offer-ordinary-option">
      <legend>
        {spellSlot === undefined ? (
          legend
        ) : (
          <span className="spell-offer-slot-heading">
            <span>
              {legend} · {spellSlot.moonglow}
            </span>
            <span className="spell-offer-path-points">+{spellSlot.bonus} Path of Stars</span>
          </span>
        )}
      </legend>
      <ContextualPicker
        ariaLabel={traitAriaLabel}
        id={`${controlId}-trait`}
        label="Trait"
        loading={loading}
        model={traitPicker}
        {...(onTraitOpenChange === undefined ? {} : { onOpenChange: onTraitOpenChange })}
        onSelect={onSelectTrait}
        placeholder="Choose a trait"
        {...(traitLabel === undefined ? {} : { triggerLabel: traitLabel })}
      />
      {fixedRarity === undefined && onSelectRarity !== undefined ? (
        <ContextualPicker
          ariaLabel={rarityAriaLabel ?? `${legend} rarity`}
          id={`${controlId}-rarity`}
          label="Rarity"
          loading={loading}
          model={rarityPicker ?? emptyRarityPicker}
          {...(onRarityOpenChange === undefined ? {} : { onOpenChange: onRarityOpenChange })}
          onSelect={onSelectRarity}
          placeholder="Choose a rarity"
          {...(rarityValue === undefined ? {} : { triggerLabel: rarityLabel(rarityValue) })}
        />
      ) : fixedRarity === undefined ? null : (
        <div
          aria-label={fixedRarityAriaLabel ?? `${legend} fixed rarity`}
          className="field-control trait-offer-fixed-rarity"
        >
          <span>Rarity</span>
          <strong>{rarityLabel(fixedRarity)}</strong>
        </div>
      )}
      {onRarify === undefined ? null : (
        <button
          className="secondary-action action-compact"
          disabled={rarifyDisabled}
          onClick={onRarify}
          type="button"
        >
          Rarify
        </button>
      )}
      {effectiveRarity === undefined && effectiveLevel === undefined ? null : (
        <dl aria-label="Effective trait values" className="trait-option-effective-summary">
          <dt>Effective rarity</dt>
          <dd>{effectiveRarity ?? <span aria-label="Not applicable">—</span>}</dd>
          <dt>Effective level</dt>
          <dd>{effectiveLevel ?? <span aria-label="Not applicable">—</span>}</dd>
        </dl>
      )}
      {persephoneLevelBonusMaximum === undefined ||
      onPersephoneLevelBonusChange === undefined ? null : (
        <label className="field-control field-control-inline">
          <span>Persephone bonus</span>
          <select
            aria-label={persephoneAriaLabel ?? `${legend} Persephone level bonus`}
            id={`${controlId}-persephone-level-bonus`}
            onChange={(event) => onPersephoneLevelBonusChange(Number(event.target.value))}
            value={persephoneLevelBonus ?? 0}
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
          checked={selected}
          disabled={selectedDisabled}
          name={selectedName}
          onChange={onSelectedChange}
          type="radio"
        />
        {selectedLabel}
      </label>
    </fieldset>
  );
}
