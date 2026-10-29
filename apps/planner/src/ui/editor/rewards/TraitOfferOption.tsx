import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import type { ReactNode } from 'react';
import type { TraitOfferOptionFeedback } from '@planner/projections/rewards/traitProjection';

import type {
  ContextualPickerItem,
  ContextualPickerModel,
} from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import { traitRarityPresentation } from './traitRarityPresentation';
import { hintProps } from '@planner/ui/controls/hint';

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
  headerAction,
  legend,
  loading,
  onRarify,
  onPersephoneLevelBonusChange,
  onRarityOpenChange,
  onSelectRarity,
  onSelectTrait,
  onSelectedChange,
  onTraitOpenChange,
  pickable = true,
  readOnly = false,
  reserveRarify = false,
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
  showEffectiveValues = false,
  showPersephoneBonus = false,
  spellSlot,
  traitAriaLabel,
  traitFindingMark,
  persephoneAriaLabel,
  traitIcon,
  traitTriggerIcon,
  traitLabel,
  infusion = false,
  traitPicker,
}: {
  readonly controlId: string;
  readonly effectiveLevel?: number;
  readonly effectiveRarity?: TraitRarity;
  readonly fixedRarity?: TraitRarity;
  readonly fixedRarityAriaLabel?: string;
  /** A control at the right end of the option's header line. */
  readonly headerAction?: ReactNode;
  readonly legend: string;
  readonly loading: boolean;
  readonly onRarify?: () => void;
  readonly onPersephoneLevelBonusChange?: (bonus: number) => void;
  readonly onRarityOpenChange?: (open: boolean) => void;
  readonly onSelectRarity?: (rarity: TraitRarity) => void;
  readonly onSelectTrait: (value: TraitValue) => void;
  readonly onSelectedChange: () => void;
  readonly onTraitOpenChange?: (open: boolean) => void;
  /**
   * False on a screen rerolled away: its rows were shown, never picked. Its
   * pick-only fields stay in place, disabled, so every screen shares one layout.
   */
  readonly pickable?: boolean;
  /** Shows the row's values without editing them. */
  readonly readOnly?: boolean;
  /** Shows a disabled Rarify on a row of a screen rerolled away. */
  readonly reserveRarify?: boolean;
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
  /** Mounts the effective-value list with placeholders before evaluation supplies values. */
  readonly showEffectiveValues?: boolean;
  readonly showPersephoneBonus?: boolean;
  readonly spellSlot?: { readonly bonus: number; readonly moonglow: string };
  readonly traitAriaLabel: string;
  readonly traitFindingMark?: FindingMarkProps;
  readonly persephoneAriaLabel?: string;
  /** A trait's icon; when set, every row keeps an icon slot. */
  readonly traitIcon?: (value: TraitValue) => string | undefined;
  readonly traitTriggerIcon?: string | undefined;
  readonly traitLabel?: string;
  /** Native presents this trait's rarity as an Infusion. */
  readonly infusion?: boolean;
  readonly traitPicker: ContextualPickerModel<TraitValue>;
}) {
  const presentRarityItem = (item: ContextualPickerItem<TraitRarity>) => {
    const presentation = traitRarityPresentation(infusion, item.value);
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
  const fixedRarityPresentation =
    fixedRarity === undefined ? undefined : traitRarityPresentation(infusion, fixedRarity);
  const shownOnly = !pickable;
  return (
    <fieldset
      className={`trait-offer-option trait-offer-ordinary-option${readOnly ? ' trait-offer-readonly' : ''}`}
    >
      {headerAction === undefined ? null : (
        <div className="trait-option-header-action">{headerAction}</div>
      )}
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
        {...(traitFindingMark === undefined ? {} : { findingMark: traitFindingMark })}
        ariaLabel={traitAriaLabel}
        id={`${controlId}-trait`}
        label="Trait"
        loading={loading}
        locked={readOnly}
        model={traitPicker}
        {...(onTraitOpenChange === undefined ? {} : { onOpenChange: onTraitOpenChange })}
        onSelect={onSelectTrait}
        placeholder="Choose a trait"
        {...(traitLabel === undefined ? {} : { triggerLabel: traitLabel })}
        {...(traitIcon === undefined
          ? {}
          : { itemIcon: (item: ContextualPickerItem<TraitValue>) => traitIcon(item.value) })}
        triggerIcon={traitTriggerIcon}
      />
      {fixedRarity === undefined && onSelectRarity !== undefined ? (
        <ContextualPicker
          ariaLabel={rarityAriaLabel ?? `${legend} rarity`}
          id={`${controlId}-rarity`}
          label="Rarity"
          loading={loading}
          locked={readOnly}
          model={presentedRarityPicker}
          {...(onRarityOpenChange === undefined ? {} : { onOpenChange: onRarityOpenChange })}
          onSelect={onSelectRarity}
          placeholder="Choose a rarity"
          {...(rarityValue === undefined
            ? {}
            : { triggerLabel: traitRarityPresentation(infusion, rarityValue).label })}
        />
      ) : fixedRarityPresentation === undefined ? null : (
        <div
          aria-label={fixedRarityAriaLabel ?? `${legend} fixed rarity`}
          className="field-control trait-offer-fixed-rarity"
        >
          <span>Rarity</span>
          {/* Only the abbreviated Infusion label needs its full rarity on hover. */}
          <strong
            {...hintProps(
              fixedRarityPresentation.accessibleLabel === fixedRarityPresentation.label
                ? undefined
                : fixedRarityPresentation.accessibleLabel,
            )}
          >
            {fixedRarityPresentation.label}
          </strong>
        </div>
      )}
      {onRarify !== undefined ? (
        <button
          className="secondary-action action-compact"
          disabled={rarifyDisabled}
          onClick={onRarify}
          type="button"
        >
          Rarify
        </button>
      ) : shownOnly && reserveRarify ? (
        <button className="secondary-action action-compact" disabled type="button">
          Rarify
        </button>
      ) : null}
      {!showEffectiveValues &&
      effectiveRarity === undefined &&
      effectiveLevel === undefined ? null : (
        <dl aria-label="Effective trait values" className="trait-option-effective-summary">
          <dt>Effective rarity</dt>
          <dd>
            {effectiveRarity === undefined ? (
              <span aria-label="Not applicable">—</span>
            ) : (
              traitRarityPresentation(infusion, effectiveRarity).effectiveLabel
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
            {shownOnly &&
            (persephoneLevelRolls === undefined || onPersephoneLevelBonusChange === undefined) ? (
              // No roll domain is known for this row of a screen rerolled away.
              <select
                aria-label={persephoneAriaLabel ?? `${legend} Persephone roll`}
                disabled
                id={`${controlId}-persephone-level-bonus`}
                value=""
              >
                <option value="">—</option>
              </select>
            ) : persephoneLevelRolls === undefined || onPersephoneLevelBonusChange === undefined ? (
              <span aria-label="Not applicable">N/A</span>
            ) : (
              <select
                aria-label={persephoneAriaLabel ?? `${legend} Persephone roll`}
                disabled={readOnly}
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
          checked={pickable && selected}
          disabled={shownOnly || selectedDisabled}
          name={selectedName}
          onChange={onSelectedChange}
          type="radio"
        />
        {selectedLabel}
      </label>
    </fieldset>
  );
}
