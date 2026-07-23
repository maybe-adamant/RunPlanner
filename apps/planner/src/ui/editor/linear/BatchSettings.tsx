import type {
  BatchRewardStoreAddress,
  ContinuationAddress,
} from '@run-planner/engine/authored-project';
import type { CanonicalBatchState } from '@run-planner/engine/simulation';

import { presentCandidateLabel } from '../../../projections/candidateProjection';
import type { WorkspaceContextualResolver } from '../../../projections/structuredWorkspace';
import { useLazyCandidateOptions } from '../../controls/useLazyCandidateOptions';
import { candidateSelectState } from '../../feedback/candidatePresentation';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';

interface BatchRewardStoreControlProps {
  readonly address: BatchRewardStoreAddress;
  readonly contextual: WorkspaceContextualResolver;
  readonly id: string;
  readonly onReplace: (storeKey: string) => void;
  readonly storeKeys: readonly string[];
  readonly value: string;
}

export function BatchRewardStoreControl({
  address,
  contextual,
  id,
  onReplace,
  storeKeys,
  value,
}: BatchRewardStoreControlProps) {
  const candidates = useLazyCandidateOptions(contextual, `batch-store:${id}`, () =>
    contextual.resolveBatchRewardStores(address, storeKeys),
  );
  const selected = candidates.options?.find((option) => option.value === value);
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
        value={value}
      >
        {storeKeys.map((storeKey) => {
          const option = candidates.options?.find((candidate) => candidate.value === storeKey);
          return (
            <option key={storeKey} value={storeKey} {...candidateSelectState(option)}>
              {presentCandidateLabel(
                storeKey === 'RunProgress' ? 'Run Progress' : 'Meta Progress',
                option,
              )}
            </option>
          );
        })}
      </select>
    </label>
  );
}

interface FieldsBatchControlProps {
  readonly batchState: Extract<CanonicalBatchState, { readonly kind: 'fields' }>;
  readonly contextual: WorkspaceContextualResolver;
  readonly continuation: ContinuationAddress;
  readonly id: string;
  readonly minDoorCageRewards: number;
  readonly onReplace: (outcome: 'min' | 'max') => void;
  readonly priorMaxOutcomes?: {
    readonly fieldsMaxDoorsRolled: number;
    readonly maxDoorCageCeiling: number;
  };
  readonly value: 'min' | 'max';
}

export function FieldsBatchControl({
  batchState,
  contextual,
  continuation,
  id,
  minDoorCageRewards,
  onReplace,
  priorMaxOutcomes,
  value,
}: FieldsBatchControlProps) {
  const values = ['min', 'max'] as const;
  const candidates = useLazyCandidateOptions(contextual, `fields-outcome:${id}`, () =>
    contextual.resolveFieldsCageOutcomes(continuation, values),
  );
  const selected = candidates.options?.find((option) => option.value === value);
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
          value={value}
        >
          {values.map((candidateValue) => {
            const option = candidates.options?.find(
              (candidate) => candidate.value === candidateValue,
            );
            return (
              <option key={candidateValue} value={candidateValue} {...candidateSelectState(option)}>
                {presentCandidateLabel(
                  `${candidateValue === 'min' ? 'Min' : 'Max'} (${
                    candidateValue === 'min' ? minDoorCageRewards : batchState.batchCapacity
                  })`,
                  option,
                )}
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
