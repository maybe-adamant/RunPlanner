import type { TraitRarity } from '@run-planner/engine/catalog-schema';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { ContextualPickerPopover } from '@planner/ui/controls/ContextualPicker';
import { hintProps } from '@planner/ui/controls/hint';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { TimelineChip } from '../rewards/TimelineChip';

/** The target an automatic effect settled, as its rarity before and after or one chip. */
export interface AutomaticEffectTargetValue {
  readonly key: string;
  readonly label: string;
  /** The rarity before and after its growth; equal or only `after` when it shows as one chip. */
  readonly rarity?: { readonly before?: TraitRarity; readonly after?: TraitRarity };
}

/**
 * An automatic effect's source icon, which opens its target picker, then the
 * target it reaches: before and after chips when it grew, one chip otherwise,
 * or an empty slot that opens the same picker.
 */
export function AutomaticEffectTarget({
  disabledHint,
  model,
  name,
  onOpenChange,
  onSelect,
  open,
  owner,
  sourceIcon,
  target,
}: {
  /** Why the picker cannot open; its presence disables both the icon and the empty slot. */
  readonly disabledHint: string | undefined;
  readonly model: ContextualPickerModel<string>;
  /** What the source icon edits; it names the trigger and heads the picker. */
  readonly name: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelect: (key: string) => void;
  readonly open: boolean;
  /** The outcome the target belongs to; its findings mark the source icon. */
  readonly owner: SemanticAddress;
  readonly sourceIcon: ArtworkSource | undefined;
  readonly target: AutomaticEffectTargetValue | undefined;
}) {
  const { 'aria-description': findings, ...findingTarget } = useFindingTarget()(owner);
  const before = target?.rarity?.before;
  const after = target?.rarity?.after;
  const interactionDisabled =
    disabledHint !== undefined || findingTarget['data-authoring-locked'] === true;
  return (
    <span className="automatic-effect-target">
      <ContextualPickerPopover
        choiceLabel={name}
        heading={name}
        itemIcon={(item) => traitIcon(item.value)}
        model={model}
        onOpenChange={(next) => onOpenChange(next && !interactionDisabled)}
        onSelect={onSelect}
        open={open && !interactionDisabled}
        searchable
      >
        <button
          aria-expanded={open && !interactionDisabled}
          aria-haspopup="listbox"
          aria-invalid={model.selected?.state === 'impossible' || undefined}
          aria-label={name}
          className="contextual-picker-trigger timeline-chip"
          data-candidate-state={model.selected?.state ?? 'unspecified'}
          disabled={interactionDisabled}
          {...findingTarget}
          {...hintProps(
            disabledHint ?? target?.label,
            findings ?? model.selected?.explanations?.join(' '),
            name,
          )}
          type="button"
        >
          <ArtworkIcon className="artwork-label-icon" source={sourceIcon} />
        </button>
      </ContextualPickerPopover>
      {target === undefined ? (
        <button
          aria-label={`Choose ${name}`}
          className="timeline-chip"
          data-chip-state="unset"
          disabled={interactionDisabled}
          onClick={() => onOpenChange(true)}
          tabIndex={-1}
          type="button"
        />
      ) : (
        <span className="automatic-effect-outcome">
          {before !== undefined && after !== undefined && before !== after ? (
            <>
              <TargetChip rarity={before} target={target} />
              <span aria-hidden="true" className="row-reward-arrow">
                →
              </span>
            </>
          ) : null}
          <TargetChip rarity={after} target={target} />
        </span>
      )}
    </span>
  );
}

function TargetChip({
  rarity,
  target,
}: {
  readonly rarity: TraitRarity | undefined;
  readonly target: AutomaticEffectTargetValue;
}) {
  return (
    <TimelineChip
      chip={{
        key: target.key,
        label: rarity === undefined ? target.label : `${target.label}, ${rarity}`,
        icon: target.key,
        ...(rarity === undefined ? {} : { rarity }),
        state: 'shown',
      }}
    />
  );
}
