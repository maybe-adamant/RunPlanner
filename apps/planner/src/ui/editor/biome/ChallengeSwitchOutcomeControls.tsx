import {
  requireWorkspaceInteraction,
  type WorkspaceChallengeSwitchOutcome,
  type WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';

const nectarIcon = rewardIcon('GiftDrop');

/** How the pressed switch's fight ended, with the bonus Nectar as its own choice. */
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
  const spoken = (choice: WorkspaceChallengeSwitchOutcome['choices'][number]) =>
    choice.nectar ? `${choice.label} with Nectar` : choice.label;
  const current = outcome.choices.find((choice) => choice.key === outcome.current);
  const currentLabel = current?.label ?? outcome.current;
  return (
    <div className="room-action-switch-outcome">
      <strong>and</strong>
      <ContextualPicker<string>
        ariaLabel={`Switch outcome: ${current === undefined ? currentLabel : spoken(current)}`}
        id={`switch-outcome-${outcome.interactionKey}`}
        itemTrailIcon={(item) =>
          outcome.choices.find((choice) => choice.key === item.value)?.nectar === true
            ? nectarIcon
            : undefined
        }
        label=""
        layout="inline"
        model={declaredChoicesPicker(
          outcome.choices.map((choice) => ({
            key: choice.key,
            value: choice.key,
            label: choice.label,
            ...(choice.nectar ? { ariaLabel: spoken(choice) } : {}),
          })),
          outcome.current,
          'Outcome',
        )}
        onSelect={(key) => {
          if (key === outcome.current) return;
          const choice = outcome.choices.find((candidate) => candidate.key === key);
          if (choice === undefined) return;
          const intent = interaction.outcomeIntentFor(choice.outcome, choice.nectar);
          if (intent !== undefined) executeIntent(intent);
        }}
        placeholder={currentLabel}
        searchable={false}
        triggerLabel={currentLabel}
        triggerSize="content"
        {...(current?.nectar === true ? { triggerTrailIcon: nectarIcon } : {})}
      />
    </div>
  );
}
