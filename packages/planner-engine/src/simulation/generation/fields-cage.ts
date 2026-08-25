import type { NormalDoorBatchPolicy } from '../../catalog-schema';
import type { ExitDecisionAddress } from '../../authored-project/addresses';
import type { HistoryStateView } from '../history';
import type { CanonicalBatch } from '../materialization';
import type {
  FieldsCageOutcome,
  FieldsCageOutcomeCandidateSupport,
  FieldsCageOutcomeSupportEntry,
} from './model';
import type { FindingEvidence } from '../model';
import { BiomeRoomGenerationContractError } from './normal-targets';

export function fieldsCageOutcomeEvidence(entry: FieldsCageOutcomeSupportEntry): FindingEvidence {
  return {
    beforeSequence: entry.beforeSequence,
    biomeDepthCache: entry.biomeDepthCache,
    fieldsMaxDoorsRolled: entry.fieldsMaxDoorsRolled,
    maxDoorCageCeiling: entry.maxDoorCageCeiling,
    selectedOutcome: entry.selectedOutcome,
    supportOutcomes: entry.supportOutcomes,
  };
}

export function supportedFieldsCageOutcomes(
  batchPolicy: Extract<NormalDoorBatchPolicy, { readonly kind: 'fields' }>,
  biomeDepthCache: number,
  fieldsMaxDoorsRolled: number,
): readonly FieldsCageOutcome[] {
  if (
    !Number.isInteger(biomeDepthCache) ||
    biomeDepthCache < 1 ||
    !Number.isInteger(fieldsMaxDoorsRolled) ||
    fieldsMaxDoorsRolled < 0
  ) {
    throw new BiomeRoomGenerationContractError('Fields outcome support has invalid counters');
  }
  if (fieldsMaxDoorsRolled >= batchPolicy.maxDoorCageCeiling) {
    return Object.freeze(['min']);
  }
  if (batchPolicy.maxOutcomeSupport.requiredBiomeDepths.includes(biomeDepthCache)) {
    return Object.freeze(['max']);
  }
  return batchPolicy.maxOutcomeSupport.optionalBiomeDepths.includes(biomeDepthCache)
    ? Object.freeze(['min', 'max'])
    : Object.freeze(['min']);
}

export function fieldsCageOutcomeCandidateSupport(
  batchPolicy: Extract<NormalDoorBatchPolicy, { readonly kind: 'fields' }>,
  origin: ExitDecisionAddress,
  view: HistoryStateView,
): FieldsCageOutcomeCandidateSupport {
  const fieldsMaxDoorsRolled = view.ledgers.counters.fieldsMaxDoorsRolled;
  if (fieldsMaxDoorsRolled === undefined) {
    throw new BiomeRoomGenerationContractError('Fields history lost its Max outcome counter');
  }
  const supportOutcomes = supportedFieldsCageOutcomes(
    batchPolicy,
    view.ledgers.counters.biomeDepthCache,
    fieldsMaxDoorsRolled,
  );
  return Object.freeze({
    origin,
    beforeSequence: view.sequence,
    biomeDepthCache: view.ledgers.counters.biomeDepthCache,
    fieldsMaxDoorsRolled,
    maxDoorCageCeiling: batchPolicy.maxDoorCageCeiling,
    supportOutcomes,
  });
}

export function evaluateFieldsCageOutcome(
  batchPolicy: Extract<NormalDoorBatchPolicy, { readonly kind: 'fields' }>,
  batch: Pick<CanonicalBatch, 'batchState' | 'origin'>,
  view: HistoryStateView,
): FieldsCageOutcomeSupportEntry {
  if (batch.batchState.kind !== 'fields') {
    throw new BiomeRoomGenerationContractError('Fields layout lost its canonical batch state');
  }
  const support = fieldsCageOutcomeCandidateSupport(batchPolicy, batch.origin, view);
  return Object.freeze({
    ...support,
    selectedOutcome: batch.batchState.cageOutcome,
    selectedPossible: support.supportOutcomes.includes(batch.batchState.cageOutcome),
  });
}
