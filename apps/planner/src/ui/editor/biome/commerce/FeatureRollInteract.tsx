import { useState } from 'react';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import {
  requireWorkspaceInteraction,
  type WorkspaceFeatureRollActions,
  type WorkspaceFeatureRollLock,
  type WorkspaceFeatureRollSlot,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { wellArtwork } from '@planner/ui/artwork/well/wellArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

const emptyNullablePicker: ContextualPickerModel<string | null> = Object.freeze({
  sections: Object.freeze([]),
});

/** Why an Interact option cannot be picked here. */
function featureRollLockHint(lock: WorkspaceFeatureRollLock): string {
  switch (lock) {
    case 'unreached':
      return candidateWaitingHint;
    case 'notEnabled':
      return 'Rerolls are not enabled.';
    case 'nothingLeft':
      return 'Nothing left to reroll.';
    case 'poolEmpty':
      return 'No rerolls left.';
    case 'poolShort':
      return 'Not enough rerolls left.';
    case 'poolReserved':
      return 'Later rerolls need the rest.';
    case 'itemFirst':
      return 'Choose its item first.';
    case 'traitFirst':
      return 'Choose its trait first.';
  }
}

function rollIcon(feature: WorkspaceFeatureRollActions['feature'], key: string) {
  return feature === 'stygianWell' ? (wellArtwork[key] ?? undefined) : traitIcon(key);
}

/** What a Well or Pool visit does next: each pick appends one action to the room. */
export function FeatureRollInteract({
  actions,
  interactions,
}: {
  readonly actions: WorkspaceFeatureRollActions;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const interaction = requireWorkspaceInteraction(
    interactions.featureRollActions,
    actions.interactionKey,
  );
  const executeIntent = useCommandIntent();
  const [choosing, setChoosing] = useState<string>();
  const subject = actions.feature === 'stygianWell' ? 'Well' : 'Pool';
  const idPrefix = `interact-${actions.interactionKey}`;
  const pending =
    choosing !== undefined &&
    actions.options.some((option) => option.key === choosing && option.needsChoice === true)
      ? choosing
      : undefined;
  const model: ContextualPickerModel<string> = Object.freeze({
    sections: Object.freeze(
      actions.options.length === 0
        ? []
        : [
            Object.freeze({
              collapsible: false,
              key: 'interact',
              kind: 'category' as const,
              label: `Interact with ${subject}`,
              items: Object.freeze(
                actions.options.map((option) =>
                  Object.freeze({
                    disabled: option.locked !== undefined,
                    key: option.key,
                    label: option.label,
                    selected: false,
                    state:
                      option.locked === undefined ? ('possible' as const) : ('impossible' as const),
                    value: option.key,
                    ...(option.locked === undefined
                      ? {}
                      : { explanations: Object.freeze([featureRollLockHint(option.locked)]) }),
                  }),
                ),
              ),
            }),
          ],
    ),
  });
  return (
    <div className="feature-roll-interact">
      <ContextualPicker<string>
        ariaLabel={`Interact with ${subject}`}
        {...(actions.locked === undefined
          ? {}
          : { disabledHint: featureRollLockHint(actions.locked) })}
        id={`${idPrefix}-action`}
        label={`Interact with ${subject}`}
        layout="inline"
        model={model}
        onSelect={(optionKey) => {
          const option = actions.options.find((candidate) => candidate.key === optionKey);
          if (option === undefined || option.locked !== undefined) return;
          if (option.needsChoice === true) {
            setChoosing(optionKey);
            return;
          }
          setChoosing(undefined);
          executeIntent(interaction.intentFor(optionKey));
        }}
        placeholder="Choose…"
        {...(pending === undefined
          ? {}
          : {
              triggerLabel:
                actions.options.find((option) => option.key === pending)?.label ?? pending,
            })}
      />
      {pending === undefined ? null : (
        <ContextualPicker<string>
          ariaLabel={actions.feature === 'stygianWell' ? 'Item bought' : 'Trait sold'}
          id={`${idPrefix}-choice`}
          itemIcon={(item) => rollIcon(actions.feature, item.value)}
          key={pending}
          label={actions.feature === 'stygianWell' ? 'Item' : 'Trait'}
          layout="inline"
          model={interaction.choices(pending)}
          onSelect={(value) => {
            setChoosing(undefined);
            executeIntent(interaction.choiceIntentFor(pending, value));
          }}
          placeholder="Choose…"
        />
      )}
    </div>
  );
}

/** The restocked slots of a Well or Pool reroll on its Timeline row: each pinned or native. */
export function FeatureRollSlots({
  feature,
  interactions,
  label,
  slots,
}: {
  readonly feature: WorkspaceFeatureRollActions['feature'];
  readonly interactions: WorkspaceInteractionCatalog;
  readonly label: string;
  readonly slots: readonly WorkspaceFeatureRollSlot[];
}) {
  return (
    <div className="feature-roll-slots">
      {slots.map((slot) => (
        <FeatureRollSlotPicker
          feature={feature}
          interactions={interactions}
          key={slot.slotKey}
          rowLabel={label}
          slot={slot}
        />
      ))}
    </div>
  );
}

function FeatureRollSlotPicker({
  feature,
  interactions,
  rowLabel,
  slot,
}: {
  readonly feature: WorkspaceFeatureRollActions['feature'];
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
    <ContextualPicker<string | null>
      ariaLabel={`${rowLabel} ${slot.label}`}
      findingTarget={findingTarget(slot.address)}
      id={`${interaction.key}-picker`}
      itemIcon={(item) => (item.value === null ? undefined : rollIcon(feature, item.value))}
      label={slot.label}
      layout="inline"
      loading={picker.pending}
      model={picker.result ?? emptyNullablePicker}
      onOpenChange={(open) => {
        if (open) picker.activate();
      }}
      onSelect={(value) => executeIntent(interaction.intentFor(value))}
      placeholder="Any"
      triggerIcon={slot.value === null ? undefined : rollIcon(feature, slot.value)}
      {...(slot.valueLabel === undefined ? {} : { triggerLabel: slot.valueLabel })}
    />
  );
}
