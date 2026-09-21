import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import type { TraitOfferOptionFeedback } from '@planner/projections/rewards/traitProjection';

import type {
  ContextualPickerItem,
  ContextualPickerModel,
} from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { traitRarityPresentation } from './traitRarityPresentation';

const emptyRarityPicker: ContextualPickerModel<TraitRarity> = Object.freeze({
  sections: Object.freeze([]),
});

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
  persephoneLevelRolls,
  rarityPicker,
  rarityAriaLabel,
  rarityValue,
  rarifyDisabled,
  selected,
  selectedDisabled,
  selectedLabel,
  selectedName,
  showPersephoneBonus = false,
  spellSlot,
  traitAriaLabel,
  persephoneAriaLabel,
  traitLabel,
  traitKey,
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
  readonly persephoneLevelRolls?: TraitOfferOptionFeedback['persephoneLevelRolls'];
  readonly rarityPicker?: ContextualPickerModel<TraitRarity>;
  readonly rarityAriaLabel?: string;
  readonly rarityValue?: TraitRarity;
  readonly rarifyDisabled?: boolean;
  readonly selected: boolean;
  readonly selectedDisabled: boolean;
  readonly selectedLabel: string;
  readonly selectedName: string;
  readonly showPersephoneBonus?: boolean;
  readonly spellSlot?: { readonly bonus: number; readonly moonglow: string };
  readonly traitAriaLabel: string;
  readonly persephoneAriaLabel?: string;
  readonly traitLabel?: string;
  readonly traitKey?: string;
  readonly traitPicker: ContextualPickerModel<TraitValue>;
}) {
  const presentRarityItem = (item: ContextualPickerItem<TraitRarity>) => {
    const presentation = traitRarityPresentation(traitKey, item.value);
    return presentation.label === item.value
      ? item
      : { ...item, label: presentation.label, ariaLabel: presentation.accessibleLabel };
  };
  const presentedRarityPicker =
    rarityPicker === undefined
      ? emptyRarityPicker
      : {
          ...rarityPicker,
          ...(rarityPicker.selected === undefined
            ? {}
            : { selected: presentRarityItem(rarityPicker.selected) }),
          sections: rarityPicker.sections.map((section) => ({
            ...section,
            items: section.items.map(presentRarityItem),
          })),
        };
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
          model={presentedRarityPicker}
          {...(onRarityOpenChange === undefined ? {} : { onOpenChange: onRarityOpenChange })}
          onSelect={onSelectRarity}
          placeholder="Choose a rarity"
          {...(rarityValue === undefined
            ? {}
            : { triggerLabel: traitRarityPresentation(traitKey, rarityValue).label })}
        />
      ) : fixedRarity === undefined ? null : (
        <div
          aria-label={fixedRarityAriaLabel ?? `${legend} fixed rarity`}
          className="field-control trait-offer-fixed-rarity"
        >
          <span>Rarity</span>
          <strong title={traitRarityPresentation(traitKey, fixedRarity).accessibleLabel}>
            {traitRarityPresentation(traitKey, fixedRarity).label}
          </strong>
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
          <dd>
            {effectiveRarity === undefined ? (
              <span aria-label="Not applicable">—</span>
            ) : (
              traitRarityPresentation(traitKey, effectiveRarity).effectiveLabel
            )}
          </dd>
          <dt>Effective level</dt>
          <dd>{effectiveLevel ?? <span aria-label="Not applicable">—</span>}</dd>
        </dl>
      )}
      {!showPersephoneBonus ? null : (
        <dl className="trait-option-effective-summary trait-option-persephone-bonus">
          <dt>Persephone Roll</dt>
          <dd>
            {persephoneLevelRolls === undefined || onPersephoneLevelBonusChange === undefined ? (
              <span aria-label="Not applicable">N/A</span>
            ) : (
              <select
                aria-label={persephoneAriaLabel ?? `${legend} Persephone roll`}
                id={`${controlId}-persephone-level-bonus`}
                onChange={(event) => onPersephoneLevelBonusChange(Number(event.target.value))}
                value={persephoneLevelBonus ?? 0}
              >
                {persephoneLevelRolls.map(({ levelBonus, roll }) => (
                  <option key={levelBonus} value={levelBonus}>
                    {roll}
                  </option>
                ))}
              </select>
            )}
          </dd>
        </dl>
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
