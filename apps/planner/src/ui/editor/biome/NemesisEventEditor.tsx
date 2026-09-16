import type { AuthoredNemesisRandomEventOutcome } from '@run-planner/engine/authored-project';
import type { WorkspaceNemesisEventInteraction } from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

const emptyPicker: ContextualPickerModel<string> = Object.freeze({ sections: Object.freeze([]) });
const interactionPhrases: Record<AuthoredNemesisRandomEventOutcome['kind'], string> = {
  freeItem: 'Interact with Nemesis to get',
  goldTrade: 'Nemesis offers to take Gold to give',
  damageTrade: 'Nemesis offers to hit you to give',
  traitTrade: 'Nemesis offers to take',
  damageContest: 'at Nemesis’s damage challenge →',
};

/** Phase configuration: selecting an Event never settles its interaction. */
export function NemesisEventSelector({
  interaction,
}: {
  readonly interaction: WorkspaceNemesisEventInteraction;
}) {
  const executeIntent = useCommandIntent();
  const findingTarget = useFindingTarget();
  return (
    <ContextualPicker
      findingTarget={findingTarget(interaction.owner)}
      id={semanticOwnerControlElementId(interaction.owner)}
      label="Event"
      layout="inline"
      model={interaction.familyPicker}
      onSelect={(family) => executeIntent(interaction.familyIntentFor(family))}
      placeholder="Choose an event"
    />
  );
}

/** Action-row detail for the already selected Nemesis family. */
export function NemesisInteractionEditor({
  interaction,
}: {
  readonly interaction: WorkspaceNemesisEventInteraction;
}) {
  const executeIntent = useCommandIntent();
  const candidates = useWorkspaceInteraction(interaction);
  const value = interaction.value;
  if (value === null) return <p className="nemesis-interaction-hint">Choose a Nemesis event.</p>;
  const commit = (next: AuthoredNemesisRandomEventOutcome, reward = interaction.reward): void =>
    executeIntent(interaction.detailIntentFor({ ...next, reward }));
  const fixedResultLabel = interaction.fixedResultLabel;
  const picker = candidates.result?.rewardPicker ?? emptyPicker;
  const traitPicker = candidates.result?.traitPicker ?? emptyPicker;
  return (
    <div className="nemesis-interaction-controls">
      {value.kind === 'damageContest' ? (
        <select
          aria-label="Contest result"
          className="nemesis-contest-result"
          onChange={(event) =>
            commit({ ...value, result: event.target.value === 'success' ? 'success' : 'failure' })
          }
          value={value.result}
        >
          <option value="success">Succeed</option>
          <option value="failure">Fail</option>
        </select>
      ) : null}
      <strong>{interactionPhrases[value.kind]}</strong>
      {value.kind === 'traitTrade' ? (
        <ContextualPicker
          ariaLabel="Boon offered"
          id={`nemesis-trait-${interaction.key}`}
          label="Boon offered"
          layout="inline"
          loading={candidates.pending}
          model={traitPicker}
          onOpenChange={(open) => {
            if (open) candidates.activate();
          }}
          onSelect={(traitKey) => commit({ ...value, traitKey })}
          placeholder="Choose a boon"
          {...(interaction.selectedTraitLabel === undefined
            ? {}
            : { triggerLabel: interaction.selectedTraitLabel })}
        />
      ) : null}
      {fixedResultLabel === undefined ? (
        <ContextualPicker
          ariaLabel="Reward"
          id={`nemesis-reward-${interaction.key}`}
          label="Reward"
          layout="inline"
          loading={candidates.pending}
          model={picker}
          onOpenChange={(open) => {
            if (open) candidates.activate();
          }}
          onSelect={(rewardType) => commit(value, { rewardType })}
          placeholder="Choose a reward"
          {...(interaction.selectedRewardLabel === undefined
            ? {}
            : { triggerLabel: interaction.selectedRewardLabel })}
        />
      ) : (
        <span className="nemesis-fixed-reward">
          {value.kind === 'traitTrade' ? 'to give ' : ''}
          {fixedResultLabel}
        </span>
      )}
      {value.kind === 'goldTrade' || value.kind === 'damageTrade' || value.kind === 'traitTrade' ? (
        <label className="field-control nemesis-response-control">
          <input
            checked={value.response === 'accept'}
            onChange={(event) =>
              commit({ ...value, response: event.target.checked ? 'accept' : 'decline' })
            }
            type="checkbox"
          />
          <span>Accept</span>
        </label>
      ) : null}
    </div>
  );
}
