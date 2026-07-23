import { semanticAddressKey, type ProjectDocument } from '@run-planner/engine/authored-project';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { useLayoutEffect, useRef, useState } from 'react';

import type {
  CandidateProjectionService,
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from '../../../projections/candidateProjection';
import type { ContextualPickerModel } from '../../../projections/contextualPicker';
import type { ProjectedRewardDomain } from '../../../projections/rewardDomainProjection';
import type {
  RewardPickerProjectionService,
  RewardPickerStep,
} from '../../../projections/rewardPicker';
import { ContextualPicker } from '../../controls/ContextualPicker';

interface RewardValueEditorProps {
  readonly candidateOwner: RewardCandidateOwner;
  readonly candidateProjection: CandidateProjectionService;
  readonly idPrefix: string;
  readonly offer: ResolvedRewardOffer;
  readonly rewardPicker: RewardPickerProjectionService;
  readonly rewardTypes: readonly string[];
  readonly onReplace: (offer: ResolvedRewardOffer) => void;
  readonly project: ProjectDocument;
}

interface CountedRewardEditorProps extends Omit<
  RewardValueEditorProps,
  'candidateOwner' | 'rewardTypes'
> {
  readonly binding: CountedRewardBinding;
  readonly candidateOwner: CountedRewardCandidateOwner;
}

interface RewardInteraction {
  readonly authoredOfferKey: string;
  readonly candidateProjection: CandidateProjectionService;
  readonly contextKey: string;
  readonly domain?: ProjectedRewardDomain;
  readonly project: ProjectDocument;
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
  candidateProjection,
  idPrefix,
  offer,
  onReplace,
  project,
  rewardPicker,
  rewardTypes,
}: RewardValueEditorProps) {
  const authoredOfferKey = offerKey(offer);
  const contextKey = JSON.stringify({
    ownerKind: candidateOwner.kind,
    ownerAddress: semanticAddressKey(candidateOwner.address),
    rewardTypes,
  });
  const requestIdRef = useRef(0);
  const [interaction, setInteraction] = useState<RewardInteraction>();
  const [projectionError, setProjectionError] = useState<Error>();
  useLayoutEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    [authoredOfferKey, candidateProjection, contextKey, project],
  );
  if (projectionError !== undefined) {
    throw projectionError;
  }
  const interactionMatchesContext =
    interaction === undefined ||
    (interaction.project === project &&
      interaction.candidateProjection === candidateProjection &&
      interaction.authoredOfferKey === authoredOfferKey &&
      interaction.contextKey === contextKey);
  if (!interactionMatchesContext) {
    setInteraction(undefined);
  }
  const active = interactionMatchesContext ? interaction : undefined;

  const load = (seed: ResolvedRewardOffer, step: RewardPickerStep, requestId: number): void => {
    void candidateProjection.rewardDomain(project, candidateOwner, rewardTypes, seed).then(
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
        candidateProjection,
        contextKey,
        project,
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
      : rewardPicker.project(active.domain, active.step, active.seed);
  const summary = rewardPicker.summary(active?.seed ?? offer);

  return (
    <div className="reward-value-editor">
      <ContextualPicker
        cancelLabel="Cancel"
        choiceLabel={rewardPicker.choiceLabel(active?.step ?? 'type', active?.seed ?? offer)}
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
  binding,
  candidateOwner,
  candidateProjection,
  offer,
  idPrefix,
  onReplace,
  project,
  rewardPicker,
}: CountedRewardEditorProps) {
  const rewardTypes = candidateProjection.countedRewardTypes(
    project,
    candidateOwner,
    binding,
    offer.rewardType,
  );
  return (
    <RewardValueEditor
      candidateOwner={candidateOwner}
      candidateProjection={candidateProjection}
      idPrefix={idPrefix}
      offer={offer}
      onReplace={onReplace}
      project={project}
      rewardPicker={rewardPicker}
      rewardTypes={rewardTypes}
    />
  );
}
