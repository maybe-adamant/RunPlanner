import type { AcquisitionRoleAddress } from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import { type AcquisitionConversionCandidateArtifacts } from '../rewards/acquisition/artifacts';
import type { ProjectDocument } from '../../authored-project/model';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface AcquisitionConversionCandidateQuery {
  readonly kind: 'acquisitionConversion';
  readonly acquisition: AcquisitionRoleAddress;
}

export interface EvaluatedAcquisitionConversionCandidate {
  readonly kind: 'acquisitionConversion';
  readonly result: {
    /** Whether the reached state can convert this exact role. */
    readonly timePieceSupported: boolean;
    /** Declaration plus concrete free/paid provenance, independent of charge/Fated. */
    readonly timePieceConvertible: boolean;
    readonly artificerSupported: boolean;
    readonly artificerConvertible: boolean;
    /** Whether the reached state can author the Sea Star result. */
    readonly seaStarSupported: boolean;
    readonly artificerReplacementAddress?: import('../../authored-project/addresses').AcquisitionEntryAddress;
    readonly artificerReplacementRewardTypes?: readonly string[];
    readonly artificerReplacementOptions?: readonly import('../../authored-project/model').AuthoredRewardState[];
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
  const timePiece = capability?.timePieceAssessment;
  const artificer = capability?.artificerAssessment;
  const seaStar = capability?.seaStarAssessment;
  // A role realized only by an entry-fixed Forfeit has no reached pickup to convert.
  if (
    capability === undefined ||
    timePiece === undefined ||
    artificer === undefined ||
    seaStar === undefined
  )
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
      timePieceSupported: timePiece.supported,
      timePieceConvertible:
        timePiece.evidence.goldConversionEligible === true &&
        timePiece.evidence.blocksGoldConversion !== true &&
        timePiece.evidence.instanceProvenance === 'free',
      artificerSupported: artificer.supported,
      artificerConvertible:
        artificer.evidence.artificerConversionEligible === true &&
        artificer.evidence.blocksArtificerConversion !== true &&
        artificer.evidence.instanceProvenance === 'free',
      seaStarSupported: seaStar.supported,
      ...(capability.artificerReplacementAddress === undefined
        ? {}
        : { artificerReplacementAddress: capability.artificerReplacementAddress }),
      ...(capability.artificerReplacementRewardTypes === undefined
        ? {}
        : { artificerReplacementRewardTypes: capability.artificerReplacementRewardTypes }),
      ...(capability.artificerReplacementOptions === undefined
        ? {}
        : { artificerReplacementOptions: capability.artificerReplacementOptions }),
      unsupportedEvidence: Object.freeze(
        [timePiece, artificer, seaStar]
          .filter((entry) => !entry.supported)
          .map((entry) => entry.evidence),
      ),
    }),
  });
}
