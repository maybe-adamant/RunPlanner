import { useState } from 'react';
import type {
  WorkspaceFieldsCageOrderControl,
  WorkspaceRoomActionInteraction,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

/** The staged permutation is local; only a complete choice edits the timeline. */
export function FieldsCageOrderControl({
  control,
  id,
  interaction,
}: {
  readonly control: WorkspaceFieldsCageOrderControl;
  readonly id: string;
  readonly interaction: WorkspaceRoomActionInteraction;
}) {
  const executeIntent = useCommandIntent();
  const source = JSON.stringify([id, control]);
  const [draft, setDraft] = useState<{
    readonly source: string;
    readonly phaseKeys: readonly string[];
  }>();
  const phaseKeys = draft?.source === source ? draft.phaseKeys : undefined;
  const labelFor = (phaseKey: string) =>
    control.choices.find((choice) => choice.phaseKey === phaseKey)!.label;
  const choices = control.choices
    .filter((choice) => !phaseKeys?.includes(choice.phaseKey))
    .map((choice) => ({ key: choice.phaseKey, value: choice.phaseKey, label: choice.label }));
  return (
    <div className="fields-cage-order">
      <ContextualPicker
        cancelLabel="Cancel"
        choiceLabel={`Cage ${(phaseKeys?.length ?? 0) + 1} of ${control.choices.length}`}
        closeOnSelect={false}
        disabled={interaction.fieldsCageOrderIntentFor === undefined}
        {...(control.unavailableReason !== undefined
          ? { disabledHint: control.unavailableReason }
          : {})}
        id={id}
        label="Combat Order"
        layout="inline"
        model={declaredChoicesPicker(choices, '')}
        onOpenChange={(open) =>
          setDraft(open ? { source, phaseKeys: Object.freeze([]) } : undefined)
        }
        onSelect={(phaseKey) => {
          if (phaseKeys === undefined || interaction.fieldsCageOrderIntentFor === undefined) return;
          const next = Object.freeze([...phaseKeys, phaseKey]);
          if (next.length < control.choices.length) {
            setDraft({ source, phaseKeys: next });
            return;
          }
          executeIntent(interaction.fieldsCageOrderIntentFor(next));
          setDraft(undefined);
        }}
        open={phaseKeys !== undefined}
        placeholder="Choose combat order"
        {...(control.phaseKeys.length === 0
          ? {}
          : { triggerLabel: control.phaseKeys.map(labelFor).join(' / ') })}
      />
    </div>
  );
}
