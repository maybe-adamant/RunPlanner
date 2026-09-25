import { useState } from 'react';
import type {
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterPhase,
  WorkspaceInfiniteRosterDraftChoice,
} from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

type Decision = Extract<
  NonNullable<WorkspaceEncounterPhase['customization']>[number],
  { readonly selection: { readonly kind: 'infiniteRoster' } }
>;

const emptyPicker: ContextualPickerModel<WorkspaceInfiniteRosterDraftChoice> = Object.freeze({
  sections: Object.freeze([]),
});

/** A staged ordered roster; the draft commits only on Finish, and Reset restores Default. */
export function InfiniteRosterControl({
  decision,
  id,
  interaction,
}: {
  readonly decision: Decision;
  readonly id: string;
  readonly interaction: WorkspaceEncounterCustomizationInteraction;
}) {
  const executeIntent = useCommandIntent();
  const [draft, setDraft] = useState<readonly string[] | undefined>();
  const product = draft === undefined ? undefined : interaction.infiniteRosterDraftFor?.(draft);
  const typeKeys = decision.value?.kind === 'infiniteRoster' ? decision.value.typeKeys : undefined;
  const labelFor = (key: string) =>
    decision.selection.choices.find((choice) => choice.key === key)?.label ??
    decision.retainedChoiceLabels?.find((choice) => choice.key === key)?.label ??
    'Unavailable enemy';
  const needsRepair =
    typeKeys !== undefined &&
    (!decision.valueSupported || interaction.infiniteRosterSupported === false);
  return (
    <div className="encounter-customization-row">
      <span>{decision.label}</span>
      <ContextualPicker<WorkspaceInfiniteRosterDraftChoice>
        ariaLabel={decision.label}
        cancelLabel="Cancel"
        choiceLabel={product?.stepLabel ?? decision.label}
        closeOnSelect={false}
        disabled={interaction.infiniteRosterDraftFor === undefined}
        id={id}
        label={decision.label}
        layout="inline"
        model={product?.picker ?? emptyPicker}
        onOpenChange={(open) => setDraft(open ? Object.freeze([]) : undefined)}
        onSelect={(choice) => {
          if (draft === undefined) return;
          if (choice.kind === 'finish') {
            executeIntent(
              interaction.intentFor(decision.key, { kind: 'infiniteRoster', typeKeys: draft }),
            );
            setDraft(undefined);
          } else setDraft(Object.freeze([...draft, choice.key]));
        }}
        open={draft !== undefined}
        placeholder="Default"
        triggerLabel={typeKeys === undefined ? 'Default' : typeKeys.map(labelFor).join(' · ')}
      />
      <button
        className="quiet-action"
        disabled={typeKeys === undefined}
        onClick={() => executeIntent(interaction.intentFor(decision.key, null))}
        type="button"
      >
        Reset
      </button>
      {needsRepair ? <span className="encounter-customization-repair">Needs repair</span> : null}
    </div>
  );
}
