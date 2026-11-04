import { useState } from 'react';
import {
  requireWorkspaceInteraction,
  type WorkspaceChallengeSwitchOutcome,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';

/** How the pressed switch's fight ended, its bonus Nectar and a Gold Switch's claimed gold. */
export function ChallengeSwitchOutcomeControls({
  interactions,
  outcome,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly outcome: WorkspaceChallengeSwitchOutcome;
}) {
  const executeIntent = useCommandIntent();
  const interaction = requireWorkspaceInteraction(
    interactions.challengeSwitches,
    outcome.interactionKey,
  );
  const currentLabel =
    outcome.choices.find((choice) => choice.outcome === outcome.current)?.label ?? outcome.current;
  return (
    <div className="room-action-switch-outcome">
      <ContextualPicker<string>
        ariaLabel={`Switch outcome: ${currentLabel}`}
        id={`switch-outcome-${outcome.interactionKey}`}
        label=""
        layout="inline"
        model={declaredChoicesPicker(
          outcome.choices.map((choice) => ({
            key: choice.outcome,
            value: choice.outcome,
            label: choice.label,
          })),
          outcome.current,
        )}
        onSelect={(value) => {
          if (value === outcome.current) return;
          const intent = interaction.outcomeIntentFor(value as typeof outcome.current);
          if (intent !== undefined) executeIntent(intent);
        }}
        placeholder={currentLabel}
        searchable={false}
        triggerLabel={currentLabel}
        triggerSize="content"
      />
      {outcome.nectar === undefined || interaction.nectarIntent === undefined ? null : (
        <label className="timeline-checkbox">
          <input
            checked={outcome.nectar.dropped}
            onChange={() => executeIntent(interaction.nectarIntent!)}
            type="checkbox"
          />
          <span>Nectar dropped</span>
        </label>
      )}
      {outcome.gold === undefined || interaction.goldIntentFor === undefined ? null : (
        <SwitchGoldInput
          gold={outcome.gold}
          onCommit={(value) => executeIntent(interaction.goldIntentFor!(value))}
        />
      )}
    </div>
  );
}

function SwitchGoldInput({
  gold,
  onCommit,
}: {
  readonly gold: NonNullable<WorkspaceChallengeSwitchOutcome['gold']>;
  readonly onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | undefined>();
  const commit = () => {
    if (draft === undefined) return;
    const next = draft.trim() === '' ? NaN : Number(draft);
    setDraft(undefined);
    // An entry outside the claim's range reverts to the saved value.
    if (
      Number.isInteger(next) &&
      next >= gold.minimum &&
      next <= gold.maximum &&
      next !== gold.value
    )
      onCommit(next);
  };
  return (
    <label className="timeline-checkbox room-action-switch-gold">
      <span>Gold</span>
      <input
        aria-label="Claimed gold"
        autoComplete="off"
        inputMode="numeric"
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(undefined);
          }
        }}
        size={4}
        type="text"
        value={draft ?? String(gold.value)}
      />
    </label>
  );
}
