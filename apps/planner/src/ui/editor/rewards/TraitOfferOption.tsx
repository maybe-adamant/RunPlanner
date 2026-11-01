import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import type { ReactNode } from 'react';
import type { TraitOfferOptionFeedback } from '@planner/projections/rewards/traitProjection';

import type {
  ContextualPickerItem,
  ContextualPickerModel,
} from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import { traitRarityPresentation } from './traitRarityPresentation';
import { FixedValueChip } from '@planner/ui/controls/FixedValueChip';
import { hintProps } from '@planner/ui/controls/hint';
import { keepsakeArtwork } from '@planner/ui/controls/keepsakes/keepsakeArtwork';
import { aspectArtwork } from '@planner/ui/controls/aspects/aspectArtwork';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';

/** The keepsake a Rarify click draws on and its uses left. */
export interface TraitOfferRarifySource {
  readonly keepsakeKey: string;
  readonly remainingUses: number;
}

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
  onUnrarify,
  rarifySource,
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
  jeweledPomLevels,
  replacedTraitIcon,
  replacedTraitLabel,
  levelLine = false,
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
  /** Removes this row's last Rarify click; absent when it has none. */
  readonly onUnrarify?: () => void;
  /** The keepsake Rarify draws on and its uses left, when every branch agrees. */
  readonly rarifySource?: TraitOfferRarifySource;
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
  /** Levels Jeweled Pom adds to this row. */
  readonly jeweledPomLevels?: number;
  /** The replaced trait whose level this row carries. */
  readonly replacedTraitIcon?: ArtworkSource | undefined;
  readonly replacedTraitLabel?: string;
  /** Olympian offers show where each row's level comes from. */
  readonly levelLine?: boolean;
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
  // Duo, Legendary and Infusion rows cannot be rarified; without uses left only an undo is worth showing.
  const shownRarity = fixedRarity ?? rarityValue;
  const showRarify =
    (onRarify !== undefined || (shownOnly && reserveRarify)) &&
    fixedRarity === undefined &&
    !infusion &&
    shownRarity !== 'Duo' &&
    shownRarity !== 'Legendary' &&
    (onUnrarify !== undefined || (rarifySource !== undefined && rarifySource.remainingUses > 0));
  // The base level is roll 0's; the badge shows the levels the chosen roll adds over it.
  const rollShown =
    showPersephoneBonus &&
    persephoneLevelRolls !== undefined &&
    onPersephoneLevelBonusChange !== undefined;
  const rollBaseLevel = persephoneLevelRolls?.find(({ levelBonus }) => levelBonus === 0)?.level;
  const chosenRollLevel = persephoneLevelRolls?.find(
    ({ levelBonus }) => levelBonus === (persephoneLevelBonus ?? 0),
  )?.level;
  const rollExtraLevels =
    rollBaseLevel === undefined || chosenRollLevel === undefined
      ? undefined
      : chosenRollLevel - rollBaseLevel;
  const rarifyIcon =
    (rarifySource === undefined ? undefined : keepsakeArtwork[rarifySource.keepsakeKey]) ??
    keepsakeArtwork.RarifyKeepsake;
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
        layout="inline"
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
      <div className="trait-option-rarity-line">
        {fixedRarity === undefined && onSelectRarity !== undefined ? (
          <ContextualPicker
            ariaLabel={rarityAriaLabel ?? `${legend} rarity`}
            id={`${controlId}-rarity`}
            label="Rarity"
            layout="inline"
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
            className="field-control field-control-inline trait-offer-fixed-rarity"
          >
            <span>Rarity</span>
            {/* Only the abbreviated Infusion label needs its full rarity on hover. */}
            <div
              className="trait-offer-fixed-rarity-value"
              {...hintProps(
                fixedRarityPresentation.accessibleLabel === fixedRarityPresentation.label
                  ? undefined
                  : fixedRarityPresentation.accessibleLabel,
              )}
            >
              <FixedValueChip label={fixedRarityPresentation.label} />
            </div>
          </div>
        )}
        {showRarify ? (
          <>
            <button
              aria-label={`Rarify ${legend}`}
              className="trait-option-rarify"
              disabled={
                onRarify === undefined || rarifyDisabled || rarifySource?.remainingUses === 0
              }
              onClick={onRarify}
              type="button"
            >
              <img alt="" src={rarifyIcon} />
              <span aria-hidden="true" className="trait-option-rarify-arrow" data-direction="up">
                ▲
              </span>
              {rarifySource === undefined ? null : (
                <span className="trait-option-rarify-charges">{rarifySource.remainingUses}</span>
              )}
            </button>
            <button
              aria-label={`Undo rarify ${legend}`}
              className="trait-option-rarify"
              disabled={onUnrarify === undefined}
              onClick={onUnrarify}
              type="button"
            >
              <img alt="" src={rarifyIcon} />
              <span aria-hidden="true" className="trait-option-rarify-arrow" data-direction="down">
                ▼
              </span>
            </button>
          </>
        ) : null}
      </div>
      {!levelLine ? null : (
        <div className="field-control field-control-inline trait-option-level-line">
          <span className="trait-option-level-label">Level</span>
          <span className="trait-option-level-sources">
            {effectiveLevel === undefined ? (
              <FixedValueChip label="N/A" />
            ) : replacedTraitLabel !== undefined ? (
              <span
                aria-label={`${replacedTraitLabel} level ${effectiveLevel}`}
                className="trait-option-level-source"
                {...hintProps(replacedTraitLabel)}
              >
                <ArtworkIcon className="trait-option-level-image" source={replacedTraitIcon} />
                <span className="trait-option-level-badge">{effectiveLevel}</span>
              </span>
            ) : jeweledPomLevels === undefined && !rollShown ? (
              <FixedValueChip label="1" />
            ) : (
              <>
                {jeweledPomLevels === undefined ? null : (
                  <span
                    aria-label={`Jeweled Pom adds ${jeweledPomLevels}`}
                    className="trait-option-level-source"
                    {...hintProps('Jeweled Pom')}
                  >
                    <img alt="" src={keepsakeArtwork.HadesAndPersephoneKeepsake} />
                    <span className="trait-option-level-badge">+{jeweledPomLevels}</span>
                  </span>
                )}
                {!rollShown ||
                persephoneLevelRolls === undefined ||
                onPersephoneLevelBonusChange === undefined ? null : (
                  <span className="trait-option-roll">
                    <ContextualPicker
                      ariaLabel={persephoneAriaLabel ?? `${legend} Persephone roll`}
                      id={`${controlId}-persephone-level-bonus`}
                      label=""
                      locked={readOnly || shownOnly}
                      model={declaredChoicesPicker(
                        // The roll is the outcome's position, 0 to the maximum; the badge is the levels it adds.
                        persephoneLevelRolls.map(({ levelBonus, level }) => ({
                          key: String(levelBonus),
                          value: levelBonus,
                          label: `Roll ${levelBonus} · +${level - (rollBaseLevel ?? level)}`,
                        })),
                        persephoneLevelBonus ?? 0,
                      )}
                      onSelect={onPersephoneLevelBonusChange}
                      placeholder="Choose a roll"
                      searchable={false}
                      triggerHint="Persephone roll"
                      triggerIcon={aspectArtwork.LobImpulseAspect}
                      triggerLabel={`+${rollExtraLevels ?? 0}`}
                      triggerSize="content"
                    />
                  </span>
                )}
              </>
            )}
          </span>
        </div>
      )}
      {effectiveRarity === undefined && effectiveLevel === undefined ? null : (
        <dl aria-label="Final trait values" className="trait-option-final-values">
          <div className="field-control field-control-inline">
            <dt>Offer</dt>
            <dd>
              <FixedValueChip
                label={[
                  effectiveLevel === undefined ? undefined : `Lvl ${effectiveLevel}`,
                  effectiveRarity === undefined
                    ? undefined
                    : traitRarityPresentation(infusion, effectiveRarity).effectiveLabel,
                ]
                  .filter((part) => part !== undefined)
                  .join(' · ')}
              />
            </dd>
          </div>
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
