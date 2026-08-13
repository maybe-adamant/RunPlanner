import type { AcquisitionRoleAddress } from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import type { AcquisitionConversionCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectDocument } from '../../authored-project/model';
import type { ProjectEvaluation } from '../project';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface AcquisitionConversionCandidateQuery {
  readonly kind: 'acquisitionConversion';
  readonly acquisition: AcquisitionRoleAddress;
}

export interface EvaluatedAcquisitionConversionCandidate {
  readonly kind: 'acquisitionConversion';
  readonly result: {
    /** True only when every reached branch can convert this exact role. */
    readonly goldSupported: boolean;
    /** Declaration plus concrete free/paid provenance, independent of charge/Fated. */
    readonly goldConvertible: boolean;
    readonly branchCount: number;
    readonly unsupportedEvidence: readonly import('../model').FindingEvidence[];
  };
}

export function evaluateAcquisitionConversionCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  artifacts: AcquisitionConversionCandidateArtifacts | undefined,
  query: AcquisitionConversionCandidateQuery,
): CandidateContextUnavailable | EvaluatedAcquisitionConversionCandidate {
  const capability = artifacts?.at(query.acquisition);
  if (capability === undefined)
    return unavailableForBiome(
      evaluation,
      query.acquisition.routeKey,
      query.acquisition.biomeKey,
      query.acquisition,
      'afterRoomLifecycle',
    );
  return Object.freeze({
    kind: 'acquisitionConversion',
    result: Object.freeze({
      goldSupported:
        capability.assessments.length > 0 &&
        capability.assessments.every((entry) => entry.supported),
      goldConvertible:
        capability.assessments.length > 0 &&
        capability.assessments.every(
          (entry) =>
            entry.evidence.goldConversionEligible === true &&
            entry.evidence.instanceProvenance === 'free',
        ),
      branchCount: capability.assessments.length,
      unsupportedEvidence: Object.freeze(
        capability.assessments.filter((entry) => !entry.supported).map((entry) => entry.evidence),
      ),
    }),
  });
}
