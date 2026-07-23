import type {
  BatchRewardStoreAddress,
  ContinuationAddress,
} from '@run-planner/engine/authored-project';
import type { CanonicalBatchState } from '@run-planner/engine/simulation';

import { presentCandidateLabel } from '../../../projections/candidateProjection';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceInteractionCatalog,
} from '../../../projections/structuredWorkspace';
import { useWorkspaceInteraction } from '../../controls/useWorkspaceInteraction';
import { candidateSelectState } from '../../feedback/candidatePresentation';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';

interface BatchRewardStoreControlProps {
  readonly address: BatchRewardStoreAddress;
  readonly id: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onReplace: (storeKey: string) => void;
}

export function BatchRewardStoreControl({
  address,
  id,
  interactions,
  onReplace,
}: BatchRewardStoreControlProps) {
  const interaction = requireWorkspaceInteraction(
    interactions.batchRewardStores,
    workspaceInteractionKey(address),
  );
  const candidates = useWorkspaceInteraction(interaction);
  const selected = candidates.result?.find((option) => option.value === interaction.selected);
  return (
    <label className="field-control batch-reward-store" htmlFor={id}>
      <span className="field-label-with-marker">
        Reward pool
        <SemanticOwnerMarker address={address} />
      </span>
      <select
        {...candidateSelectState(selected)}
        id={id}
        onChange={(event) => onReplace(event.target.value)}
        onFocus={candidates.activate}
        onPointerDown={candidates.activate}
        value={String(interaction.selected)}
      >
        {interaction.choices.map((choice) => {
          const option = candidates.result?.find((candidate) => candidate.value === choice.value);
          return (
            <option key={choice.value} value={choice.value} {...candidateSelectState(option)}>
              {presentCandidateLabel(choice.label, option)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

interface FieldsBatchControlProps {
  readonly batchState: Extract<CanonicalBatchState, { readonly kind: 'fields' }>;
  readonly continuation: ContinuationAddress;
  readonly id: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly onReplace: (outcome: 'min' | 'max') => void;
  readonly priorMaxOutcomes?: {
    readonly fieldsMaxDoorsRolled: number;
    readonly maxDoorCageCeiling: number;
  };
}

export function FieldsBatchControl({
  batchState,
  continuation,
  id,
  interactions,
  onReplace,
  priorMaxOutcomes,
}: FieldsBatchControlProps) {
  const interaction = requireWorkspaceInteraction(
    interactions.fieldsCageOutcomes,
    workspaceInteractionKey(continuation),
  );
  const candidates = useWorkspaceInteraction(interaction);
  const selected = candidates.result?.find((option) => option.value === interaction.selected);
  return (
    <div className="fields-batch-editor">
      <label className="field-control" htmlFor={id}>
        <span>Fields door roll</span>
        <select
          {...candidateSelectState(selected)}
          aria-label="Fields door roll"
          id={id}
          onChange={(event) => onReplace(event.target.value as 'min' | 'max')}
          onFocus={candidates.activate}
          onPointerDown={candidates.activate}
          value={String(interaction.selected)}
        >
          {interaction.choices.map((choice) => {
            const option = candidates.result?.find((candidate) => candidate.value === choice.value);
            return (
              <option key={choice.value} value={choice.value} {...candidateSelectState(option)}>
                {presentCandidateLabel(choice.label, option)}
              </option>
            );
          })}
        </select>
      </label>
      <dl className="fields-batch-summary">
        <div>
          <dt>Cages per combat room</dt>
          <dd>{batchState.doorCageRewardCount}</dd>
        </div>
        <div>
          <dt>Prior Max outcomes</dt>
          <dd>
            {priorMaxOutcomes === undefined
              ? 'Unavailable'
              : `${priorMaxOutcomes.fieldsMaxDoorsRolled} / ${priorMaxOutcomes.maxDoorCageCeiling}`}
          </dd>
        </div>
      </dl>
      {batchState.cageTargetCount === 0 && (
        <p className="fields-batch-note">
          No offered room uses the Fields multi-cage count; Max still affects later Fields rolls.
        </p>
      )}
    </div>
  );
}
