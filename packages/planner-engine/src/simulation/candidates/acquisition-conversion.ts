import type { AcquisitionRoleAddress } from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import type { AcquisitionConversionCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectDocument } from '../../authored-project/model';
import type { ProjectEvaluation } from '../evaluation-products';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface AcquisitionConversionCandidateQuery {
  readonly kind: 'acquisitionConversion';
  readonly acquisition: AcquisitionRoleAddress;
}

export interface EvaluatedAcquisitionConversionCandidate {
  readonly kind: 'acquisitionConversion';
  readonly result: {
    /** True only when every reached branch can convert this exact role. */
    readonly timePieceSupported: boolean;
    /** Declaration plus concrete free/paid provenance, independent of charge/Fated. */
    readonly timePieceConvertible: boolean;
    readonly artificerSupported: boolean;
    readonly artificerConvertible: boolean;
    /** True only when every reached branch can author the Sea Star result. */
    readonly seaStarSupported: boolean;
    readonly artificerReplacementAddress?: import('../../authored-project/addresses').AcquisitionEntryAddress;
    readonly artificerReplacementRewardTypes?: readonly string[];
    readonly artificerReplacementOptions?: readonly import('../../authored-project/model').AuthoredRewardState[];
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
      timePieceSupported:
        capability.timePieceAssessments.length > 0 &&
        capability.timePieceAssessments.every((entry) => entry.supported),
      timePieceConvertible:
        capability.timePieceAssessments.length > 0 &&
        capability.timePieceAssessments.every(
          (entry) =>
            entry.evidence.goldConversionEligible === true &&
            entry.evidence.blocksGoldConversion !== true &&
            entry.evidence.instanceProvenance === 'free',
        ),
      artificerSupported:
        capability.artificerAssessments.length > 0 &&
        capability.artificerAssessments.every((entry) => entry.supported),
      artificerConvertible:
        capability.artificerAssessments.length > 0 &&
        capability.artificerAssessments.every(
          (entry) =>
            entry.evidence.artificerConversionEligible === true &&
            entry.evidence.blocksArtificerConversion !== true &&
            entry.evidence.instanceProvenance === 'free',
        ),
      seaStarSupported:
        capability.seaStarAssessments.length > 0 &&
        capability.seaStarAssessments.every((entry) => entry.supported),
      ...(capability.artificerReplacementAddress === undefined
        ? {}
        : { artificerReplacementAddress: capability.artificerReplacementAddress }),
      ...(capability.artificerReplacementRewardTypes === undefined
        ? {}
        : { artificerReplacementRewardTypes: capability.artificerReplacementRewardTypes }),
      ...(capability.artificerReplacementOptions === undefined
        ? {}
        : { artificerReplacementOptions: capability.artificerReplacementOptions }),
      branchCount: capability.timePieceAssessments.length,
      unsupportedEvidence: Object.freeze(
        [
          ...capability.timePieceAssessments,
          ...capability.artificerAssessments,
          ...capability.seaStarAssessments,
        ]
          .filter((entry) => !entry.supported)
          .map((entry) => entry.evidence),
      ),
    }),
  });
}
