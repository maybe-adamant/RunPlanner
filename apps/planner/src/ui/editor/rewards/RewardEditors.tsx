import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { useLayoutEffect, useRef, useState } from 'react';

import type {
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '../../../projections/candidateProjection';
import type { ContextualPickerModel } from '../../../projections/contextualPicker';
import type { ProjectedRewardDomain } from '../../../projections/rewardDomainProjection';
import type { RewardPickerStep } from '../../../projections/rewardPicker';
import type {
  WorkspaceContextualResolver,
  WorkspaceRewardInteraction,
} from '../../../projections/structuredWorkspace';
import { ContextualPicker } from '../../controls/ContextualPicker';

interface RewardValueEditorProps {
  readonly candidateOwner: RewardCandidateOwner;
  readonly contextual: WorkspaceContextualResolver;
  readonly idPrefix: string;
  readonly offer: ResolvedRewardOffer;
  readonly onReplace: (offer: ResolvedRewardOffer) => void;
}

interface CountedRewardEditorProps extends Omit<RewardValueEditorProps, 'candidateOwner'> {
  readonly candidateOwner: CountedRewardCandidateOwner;
}

interface RewardInteraction {
  readonly authoredOfferKey: string;
  readonly domain?: ProjectedRewardDomain;
  readonly resolver: WorkspaceRewardInteraction;
  readonly requestId: number;
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
  contextual,
  idPrefix,
  offer,
  onReplace,
}: RewardValueEditorProps) {
  const authoredOfferKey = offerKey(offer);
  const resolver = contextual.resolveReward(candidateOwner.address);
  const requestIdRef = useRef(0);
  const [interaction, setInteraction] = useState<RewardInteraction>();
  const [projectionError, setProjectionError] = useState<Error>();
  useLayoutEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    [authoredOfferKey, resolver],
  );
  if (projectionError !== undefined) {
    throw projectionError;
  }
  const interactionMatchesContext =
    interaction === undefined ||
    (interaction.resolver === resolver && interaction.authoredOfferKey === authoredOfferKey);
  if (!interactionMatchesContext) {
    setInteraction(undefined);
  }
  const active = interactionMatchesContext ? interaction : undefined;

  const load = (seed: ResolvedRewardOffer, step: RewardPickerStep, requestId: number): void => {
    void resolver.load(seed).then(
      (domain) => {
        setInteraction((current) =>
          current?.requestId === requestId && requestIdRef.current === requestId
            ? Object.freeze({ ...current, domain })
            : current,
        );
      },
      (error: unknown) => {
        if (requestIdRef.current === requestId) {
          setProjectionError(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );
    setInteraction(
      Object.freeze({
        authoredOfferKey,
        resolver,
        requestId,
        seed,
        step,
      }),
    );
  };

  const startInteraction = (): void => {
    const requestId = ++requestIdRef.current;
    load(offer, 'type', requestId);
  };

  const cancelInteraction = (): void => {
    requestIdRef.current += 1;
    setInteraction(undefined);
  };

  const advance = (seed: ResolvedRewardOffer, step: RewardPickerStep): void => {
    const requestId = ++requestIdRef.current;
    load(seed, step, requestId);
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
    active?.domain === undefined
      ? emptyModel
      : resolver.model(active.domain, active.step, active.seed);
  const summary = resolver.summary(active?.seed ?? offer);

  return (
    <div className="reward-value-editor">
      <ContextualPicker
        cancelLabel="Cancel"
        choiceLabel={resolver.choiceLabel(active?.step ?? 'type', active?.seed ?? offer)}
        closeOnSelect={false}
        id={`${idPrefix}-reward`}
        label="Reward"
        loading={active !== undefined && active.domain === undefined}
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
  contextual,
  offer,
  idPrefix,
  onReplace,
}: CountedRewardEditorProps) {
  return (
    <RewardValueEditor
      candidateOwner={candidateOwner}
      contextual={contextual}
      idPrefix={idPrefix}
      offer={offer}
      onReplace={onReplace}
    />
  );
}
