import type { BatchRewardStoreAddress } from '@run-planner/engine/authored-project';
import type { CanonicalBatchState } from '@run-planner/engine/simulation';

import {
  presentCandidateLabel,
  type CandidateProjectionService,
} from '../../../projections/candidateProjection';
import { candidateSelectState } from '../../feedback/candidatePresentation';
import { SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';

interface BatchRewardStoreControlProps {
  readonly address: BatchRewardStoreAddress;
  readonly id: string;
  readonly onReplace: (storeKey: string) => void;
  readonly options: ReturnType<CandidateProjectionService['batchRewardStores']>;
  readonly value: string;
}

export function BatchRewardStoreControl({
  address,
  id,
  onReplace,
  options,
  value,
}: BatchRewardStoreControlProps) {
  const selected = options.find((option) => option.value === value);
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
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} {...candidateSelectState(option)}>
            {presentCandidateLabel(
              option.value === 'RunProgress' ? 'Run Progress' : 'Meta Progress',
              option,
            )}
          </option>
        ))}
      </select>
    </label>
  );
}

interface FieldsBatchControlProps {
  readonly batchState: Extract<CanonicalBatchState, { readonly kind: 'fields' }>;
  readonly id: string;
  readonly minDoorCageRewards: number;
  readonly onReplace: (outcome: 'min' | 'max') => void;
  readonly options: ReturnType<CandidateProjectionService['fieldsCageOutcomes']>;
  readonly priorMaxOutcomes?: {
    readonly fieldsMaxDoorsRolled: number;
    readonly maxDoorCageCeiling: number;
  };
  readonly value: 'min' | 'max';
}

export function FieldsBatchControl({
  batchState,
  id,
  minDoorCageRewards,
  onReplace,
  options,
  priorMaxOutcomes,
  value,
}: FieldsBatchControlProps) {
  const selected = options.find((option) => option.value === value);
  return (
    <div className="fields-batch-editor">
      <label className="field-control" htmlFor={id}>
        <span>Fields door roll</span>
        <select
          {...candidateSelectState(selected)}
          aria-label="Fields door roll"
          id={id}
          onChange={(event) => onReplace(event.target.value as 'min' | 'max')}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} {...candidateSelectState(option)}>
              {presentCandidateLabel(
                `${option.value === 'min' ? 'Min' : 'Max'} (${
                  option.value === 'min' ? minDoorCageRewards : batchState.batchCapacity
                })`,
                option,
              )}
            </option>
          ))}
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
