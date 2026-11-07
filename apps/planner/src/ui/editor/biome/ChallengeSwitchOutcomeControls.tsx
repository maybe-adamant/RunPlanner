import {
  requireWorkspaceInteraction,
  type WorkspaceChallengeSwitchOutcome,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { IconToggle } from '@planner/ui/controls/IconToggle';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';

/** How the pressed switch's fight ended, and its bonus Nectar. */
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
        <IconToggle
          icon={rewardIcon('GiftDrop')}
          name="Nectar dropped"
          onToggle={() => executeIntent(interaction.nectarIntent!)}
          pressed={outcome.nectar.dropped}
        />
      )}
    </div>
  );
}
