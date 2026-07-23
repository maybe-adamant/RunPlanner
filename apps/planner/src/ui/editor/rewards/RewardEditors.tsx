import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { useMemo, useState } from 'react';

import type {
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '../../../projections/candidateProjection';
import type { ContextualPickerModel } from '../../../projections/contextualPicker';
import type { RewardPickerStep } from '../../../projections/rewardPicker';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
} from '../../../projections/structuredWorkspace';
import { ContextualPicker } from '../../controls/ContextualPicker';
import { useWorkspaceInteraction } from '../../controls/useWorkspaceInteraction';

interface RewardValueEditorProps {
  readonly candidateOwner: RewardCandidateOwner;
  readonly idPrefix: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly offer: ResolvedRewardOffer;
  readonly onReplace: (offer: ResolvedRewardOffer) => void;
}

interface CountedRewardEditorProps extends Omit<RewardValueEditorProps, 'candidateOwner'> {
  readonly candidateOwner: CountedRewardCandidateOwner;
}

interface RewardInteraction {
  readonly context: object;
  readonly seed: ResolvedRewardOffer;
  readonly step: RewardPickerStep;
}

const emptyModel: ContextualPickerModel<ResolvedRewardOffer> = Object.freeze({
  sections: Object.freeze([]),
});

function offerKey(offer: ResolvedRewardOffer): string {
  return JSON.stringify(offer);
}

export function RewardValueEditor({
  candidateOwner,
  idPrefix,
  interactions,
  offer,
  onReplace,
}: RewardValueEditorProps) {
  const authoredOfferKey = offerKey(offer);
  const resolver = requireWorkspaceInteraction(
    interactions.rewards,
    workspaceInteractionKey(candidateOwner.address),
  );
  const domain = useWorkspaceInteraction(resolver);
  const context = useMemo(
    () => Object.freeze({ authoredOfferKey, resolver }),
    [authoredOfferKey, resolver],
  );
  const [interaction, setInteraction] = useState<RewardInteraction>();
  const interactionMatchesContext = interaction === undefined || interaction.context === context;
  const active = interactionMatchesContext ? interaction : undefined;

  const begin = (seed: ResolvedRewardOffer, step: RewardPickerStep): void => {
    domain.activate();
    setInteraction(
      Object.freeze({
        context,
        seed,
        step,
      }),
    );
  };

  const startInteraction = (): void => {
    begin(offer, 'type');
  };

  const cancelInteraction = (): void => {
    setInteraction(undefined);
  };

  const advance = (seed: ResolvedRewardOffer, step: RewardPickerStep): void => {
    begin(seed, step);
  };

  const commit = (value: ResolvedRewardOffer): void => {
    onReplace(value);
    cancelInteraction();
  };

  const select = (value: ResolvedRewardOffer): void => {
    if (active === undefined) {
      return;
    }
    switch (active.step) {
      case 'type':
        if (value.payload === undefined) {
          commit(value);
        } else if (value.payload.kind === 'BoonSource') {
          advance(value, 'source');
        } else {
          advance(value, 'chosen');
        }
        break;
      case 'source':
      case 'spurned':
        commit(value);
        break;
      case 'chosen':
        advance(value, 'spurned');
        break;
    }
  };

  const model =
    active === undefined || domain.result === undefined
      ? emptyModel
      : resolver.model(domain.result, active.step, active.seed);
  const summary = resolver.summary(active?.seed ?? offer);

  return (
    <div className="reward-value-editor">
      <ContextualPicker
        cancelLabel="Cancel"
        choiceLabel={resolver.choiceLabel(active?.step ?? 'type', active?.seed ?? offer)}
        closeOnSelect={false}
        id={`${idPrefix}-reward`}
        label="Reward"
        loading={active !== undefined && domain.result === undefined}
        model={model}
        onOpenChange={(open) => {
          if (open) {
            startInteraction();
          } else {
            cancelInteraction();
          }
        }}
        onSelect={select}
        open={active !== undefined}
        placeholder={summary}
        triggerLabel={summary}
      />
    </div>
  );
}

export function CountedRewardEditor({
  candidateOwner,
  offer,
  idPrefix,
  interactions,
  onReplace,
}: CountedRewardEditorProps) {
  return (
    <RewardValueEditor
      candidateOwner={candidateOwner}
      idPrefix={idPrefix}
      interactions={interactions}
      offer={offer}
      onReplace={onReplace}
    />
  );
}
