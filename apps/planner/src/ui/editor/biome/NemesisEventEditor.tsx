import type { AuthoredNemesisRandomEventOutcome } from '@run-planner/engine/authored-project';
import type { WorkspaceNemesisEventInteraction } from '@planner/projections/structured-workspace';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import { offerIcon, rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useWorkspaceInteraction } from '@planner/ui/controls/useWorkspaceInteraction';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import { npcPortrait } from '@planner/ui/artwork/npcs/npcArtwork';
import { ArtworkChip } from '@planner/ui/editor/rewards/TimelineChip';
import { RowNpcName } from './RowNpcName';
import { useFindingTarget, type FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import type { WorkspaceFindingControl } from '@planner/projections/structured-workspace';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';

const emptyPicker: ContextualPickerModel<string> = Object.freeze({ sections: Object.freeze([]) });
const nemesisPortrait = npcPortrait('Nemesis') ?? '';

/** The closed trigger names the chosen type in one word; the list keeps full names. */
const shortFamilyLabels: Record<AuthoredNemesisRandomEventOutcome['kind'], string> = {
  freeItem: 'Item',
  goldTrade: 'Gold',
  damageTrade: 'Damage',
  traitTrade: 'Boon',
  damageContest: 'Contest',
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
    <div className="nemesis-event-family">
      <ContextualPicker
        ariaLabel={
          interaction.familyPicker.selected === undefined
            ? 'Nemesis event type'
            : `Nemesis event type: ${interaction.familyPicker.selected.label}`
        }
        findingTarget={findingTarget(interaction.owner)}
        id={semanticOwnerControlElementId(interaction.owner)}
        label=""
        choiceLabel="Event type"
        layout="inline"
        model={interaction.familyPicker}
        onSelect={(family) => executeIntent(interaction.familyIntentFor(family))}
        placeholder="Type"
        {...(interaction.familyPicker.selected === undefined
          ? {}
          : { triggerLabel: shortFamilyLabels[interaction.familyPicker.selected.value] })}
      />
    </div>
  );
}

/**
 * The interaction row as one sentence: Nemesis, what she does, and the chips it
 * trades; how it ends is chosen where her encounter ends.
 */
export function NemesisInteractionSentence({
  findingMark,
  interaction,
}: {
  /** Marks the interaction-time choice that repairs the action row outcome. */
  readonly findingMark?: (control: WorkspaceFindingControl) => FindingMarkProps;
  readonly interaction: WorkspaceNemesisEventInteraction;
}) {
  const executeIntent = useCommandIntent();
  const candidates = useWorkspaceInteraction(interaction);
  const value = interaction.value;
  if (value === null) return null;
  const commit = (next: AuthoredNemesisRandomEventOutcome, reward = interaction.reward): void =>
    executeIntent(interaction.detailIntentFor({ ...next, reward }));
  const waiting = interaction.contextReached ? {} : { disabledHint: candidateWaitingHint };
  const nemesis = <RowNpcName name="Nemesis" portrait={nemesisPortrait} />;
  const fixedResult =
    interaction.fixedResultLabel === undefined ? undefined : (
      <ArtworkChip
        icon={
          interaction.fixedResultRewardType === undefined
            ? undefined
            : rewardIcon(interaction.fixedResultRewardType)
        }
        label={interaction.fixedResultLabel}
      />
    );
  const reward = fixedResult ?? (
    <ContextualPicker
      {...(findingMark === undefined ? {} : { findingMark: findingMark('nemesisReward') })}
      ariaLabel="Reward"
      id={`nemesis-reward-${interaction.key}`}
      itemIcon={(item) => rewardIcon(item.value)}
      label=""
      layout="inline"
      {...waiting}
      loading={candidates.pending}
      model={candidates.result?.rewardPicker ?? emptyPicker}
      onOpenChange={(open) => {
        if (open) candidates.activate();
      }}
      onSelect={(rewardType) => commit(value, { rewardType })}
      placeholder="Choose a reward"
      {...(interaction.selectedRewardLabel === undefined
        ? {}
        : { triggerLabel: interaction.selectedRewardLabel })}
      triggerIcon={interaction.reward === null ? undefined : offerIcon(interaction.reward)}
      triggerSize="icon"
    />
  );
  const words = (text: string) => <strong>{text}</strong>;
  switch (value.kind) {
    case 'traitTrade':
      return (
        <span className="nemesis-interaction-sentence">
          {nemesis}
          {words('takes')}
          <ContextualPicker
            {...(findingMark === undefined ? {} : { findingMark: findingMark('nemesisTrait') })}
            ariaLabel="Boon offered"
            id={`nemesis-trait-${interaction.key}`}
            itemIcon={(item) => traitIcon(item.value)}
            label=""
            layout="inline"
            {...waiting}
            loading={candidates.pending}
            model={candidates.result?.traitPicker ?? emptyPicker}
            onOpenChange={(open) => {
              if (open) candidates.activate();
            }}
            onSelect={(traitKey) => commit({ ...value, traitKey })}
            placeholder="Choose a boon"
            {...(interaction.selectedTraitLabel === undefined
              ? {}
              : { triggerLabel: interaction.selectedTraitLabel })}
            triggerIcon={value.traitKey == null ? undefined : traitIcon(value.traitKey)}
            triggerSize="icon"
          />
          {words('to give')}
          {reward}
        </span>
      );
    case 'freeItem':
      return (
        <span className="nemesis-interaction-sentence">
          {nemesis}
          {words('gives')}
          {reward}
        </span>
      );
    case 'goldTrade':
      return (
        <span className="nemesis-interaction-sentence">
          {nemesis}
          {words('sells')}
          {reward}
        </span>
      );
    case 'damageTrade':
      return (
        <span className="nemesis-interaction-sentence">
          {nemesis}
          {words('hits you to get')}
          {reward}
        </span>
      );
    case 'damageContest':
      return (
        <span className="nemesis-interaction-sentence">
          {words('Hit')}
          {nemesis}
          {words('to get')}
          {reward}
        </span>
      );
  }
}

/** The interaction row's detail while the Overview has not chosen the event yet. */
export function NemesisEventPending() {
  return (
    <div className="field-control field-control-inline control-placeholder">
      <span className="fixed-room-state">Choose a Nemesis event.</span>
    </div>
  );
}

/** How a Nemesis trade or contest ended, chosen where her encounter ends. */
export function NemesisEventOutcomeControl({
  interaction,
}: {
  readonly interaction: WorkspaceNemesisEventInteraction;
}) {
  const executeIntent = useCommandIntent();
  const outcome = interaction.outcome;
  if (outcome === undefined) return null;
  return (
    <WordOutcomePicker
      choices={outcome.choices}
      id={`nemesis-outcome-${interaction.key}`}
      name="Nemesis outcome"
      onSelect={(value) => executeIntent(outcome.intentFor(value))}
      selected={outcome.selected}
    />
  );
}

/** A settled outcome named by its word, which opens the other words it could be. */
export function WordOutcomePicker({
  choices,
  id,
  name,
  onSelect,
  selected,
}: {
  readonly choices: readonly { readonly value: string; readonly label: string }[];
  readonly id: string;
  readonly name: string;
  readonly onSelect: (value: string) => void;
  readonly selected: string;
}) {
  const label = choices.find((choice) => choice.value === selected)?.label ?? selected;
  return (
    <ContextualPicker
      ariaLabel={name}
      id={id}
      label=""
      layout="inline"
      model={declaredChoicesPicker(
        choices.map((choice) => ({ key: choice.value, value: choice.value, label: choice.label })),
        selected,
      )}
      onSelect={(value) => {
        // Picking the current outcome is no edit.
        if (value !== selected) onSelect(value);
      }}
      placeholder={label}
      searchable={false}
      triggerLabel={label}
      triggerSize="content"
    />
  );
}
