import { useState } from 'react';
import type { AuthoredEncounterCustomization } from '@run-planner/engine/authored-project';
import type {
  WorkspaceEncounterCustomizationInteraction,
  WorkspaceEncounterPhase,
  WorkspaceInfiniteRosterDraftChoice,
} from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { enemyIcon } from '@planner/ui/artwork/encounterArtwork';

type Decision = Extract<
  NonNullable<WorkspaceEncounterPhase['customization']>[number],
  { readonly selection: { readonly kind: 'infiniteRoster' } }
>;

const emptyPicker: ContextualPickerModel<WorkspaceInfiniteRosterDraftChoice> = Object.freeze({
  sections: Object.freeze([]),
});

/** A staged ordered roster; Finish writes it into the dialog draft, and Reset restores Default. */
export function InfiniteRosterControl({
  decision,
  draftFor,
  id,
  onValue,
  resettable,
  supported,
}: {
  readonly decision: Decision;
  /** Whether the roster offers its own Reset; as a dialog's only setting, the dialog's Reset covers it. */
  readonly resettable: boolean;
  readonly draftFor: WorkspaceEncounterCustomizationInteraction['infiniteRosterDraftFor'];
  readonly id: string;
  readonly onValue: (value: AuthoredEncounterCustomization | null) => void;
  /** Exact-context support for the dialog draft's roster. */
  readonly supported: boolean | undefined;
}) {
  const [draft, setDraft] = useState<readonly string[] | undefined>();
  const product = draft === undefined ? undefined : draftFor?.(draft);
  const typeKeys = decision.value?.kind === 'infiniteRoster' ? decision.value.typeKeys : undefined;
  const labelFor = (key: string) =>
    decision.selection.choices.find((choice) => choice.key === key)?.label ??
    decision.retainedChoiceLabels?.find((choice) => choice.key === key)?.label ??
    'Unavailable enemy';
  const needsRepair = typeKeys !== undefined && (!decision.valueSupported || supported === false);
  return (
    <div className="encounter-customization-row" data-invalid={needsRepair || undefined}>
      <span>{decision.label}</span>
      <ContextualPicker<WorkspaceInfiniteRosterDraftChoice>
        ariaLabel={decision.label}
        cancelLabel="Cancel"
        choiceLabel={product?.stepLabel ?? decision.label}
        closeOnSelect={false}
        disabled={draftFor === undefined}
        id={id}
        itemIcon={(item) => (item.value.kind === 'enemy' ? enemyIcon(item.value.key) : undefined)}
        label={decision.label}
        layout="inline"
        model={product?.picker ?? emptyPicker}
        onOpenChange={(open) => setDraft(open ? Object.freeze([]) : undefined)}
        onSelect={(choice) => {
          if (draft === undefined) return;
          if (choice.kind === 'finish') {
            onValue({ kind: 'infiniteRoster', typeKeys: draft });
            setDraft(undefined);
          } else setDraft(Object.freeze([...draft, choice.key]));
        }}
        open={draft !== undefined}
        placeholder="Default"
        triggerLabel={typeKeys === undefined ? 'Default' : typeKeys.map(labelFor).join(' · ')}
        {...(typeKeys === undefined
          ? {}
          : {
              triggerParts: typeKeys.map((key) => ({ label: labelFor(key), icon: enemyIcon(key) })),
            })}
        {...(needsRepair ? { invalid: true } : {})}
      />
      {resettable ? (
        <button
          aria-label={`Reset ${decision.label}`}
          className="quiet-action"
          disabled={typeKeys === undefined}
          onClick={() => onValue(null)}
          type="button"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
