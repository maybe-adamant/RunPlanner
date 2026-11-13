import type { RollFeature } from '@run-planner/engine/authored-project';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import {
  requireWorkspaceInteraction,
  type WorkspaceFeatureRollSlot,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { wellArtwork } from '@planner/ui/artwork/well/wellArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { NumberedSlot, NumberedSlots } from '@planner/ui/editor/rewards/NumberedSlots';

const emptyPicker: ContextualPickerModel<string> = Object.freeze({
  sections: Object.freeze([]),
});

function rollIcon(feature: RollFeature, key: string) {
  return feature === 'stygianWell' ? (wellArtwork[key] ?? undefined) : traitIcon(key);
}

/** The restocked slots of a Well or Pool reroll on its Timeline row. */
export function FeatureRollSlots({
  feature,
  interactions,
  label,
  slots,
}: {
  readonly feature: RollFeature;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly slots: readonly WorkspaceFeatureRollSlot[];
}) {
  return (
    <NumberedSlots label={`${label} slots`}>
      {slots.map((slot, index) => (
        <NumberedSlot key={slot.slotKey} number={index + 1}>
          <FeatureRollSlotPicker
            feature={feature}
            interactions={interactions}
            rowLabel={label}
            slot={slot}
          />
        </NumberedSlot>
      ))}
    </NumberedSlots>
  );
}

function FeatureRollSlotPicker({
  feature,
  interactions,
  rowLabel,
  slot,
}: {
  readonly feature: RollFeature;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly rowLabel: string;
  readonly slot: WorkspaceFeatureRollSlot;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.featureRollSlots,
    slot.interactionKey,
  );
  const picker = useWorkspaceInteraction(interaction);
  const findingTarget = useFindingTarget();
  const executeIntent = useCommandIntent();
  return (
    <ContextualPicker<string>
      ariaLabel={`${rowLabel} ${slot.label}`}
      findingTarget={findingTarget(slot.address)}
      id={`${interaction.key}-picker`}
      itemIcon={(item) => rollIcon(feature, item.value)}
      label=""
      layout="inline"
      loading={picker.pending}
      model={picker.result ?? emptyPicker}
      onOpenChange={(open) => {
        if (open) picker.activate();
      }}
      onSelect={(value) => executeIntent(interaction.intentFor(value))}
      placeholder={slot.label}
      triggerIcon={slot.value === null ? undefined : rollIcon(feature, slot.value)}
      {...(slot.valueLabel === undefined ? {} : { triggerLabel: slot.valueLabel })}
      triggerSize="icon"
      triggerUnknown
      {...(interaction.contextReached ? {} : { disabledHint: candidateWaitingHint })}
    />
  );
}
