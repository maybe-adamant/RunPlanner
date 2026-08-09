import type { Catalog } from '../../catalog-schema';
import { semanticAddressKey, type ExitDecisionAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import {
  exitDecisionForSource,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
} from '../../authored-project/topology/query';
import {
  hubTerminalTakeoverCandidateSupportAtFrontier,
  type HubTerminalTakeoverCandidateSupport,
} from '../generation';
import type { ProjectEvaluation } from '../project';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';
import { CandidateEvaluationContractError } from './contract';
import {
  candidateAssessmentPrefix,
  candidateBiome,
  candidatePrefix,
  completeBiomeCount,
  planFor,
  prefixAuthoredRooms,
} from './evaluated-biome';

/**
 * The bounded N entry has one terminal outcome, so callers ask for the
 * source-owned Hub result rather than proposing arbitrary room names. This
 * keeps N_PreBoss in the completed-Hub handoff domain where it belongs.
 */
export interface HubTerminalTakeoverCandidateQuery {
  readonly kind: 'hubTerminalTakeover';
  readonly source: ExitDecisionAddress;
}

export interface EvaluatedHubTerminalTakeoverCandidate {
  readonly kind: 'hubTerminalTakeover';
  readonly result: HubTerminalTakeoverCandidateSupport;
}

export type HubTerminalTakeoverCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedHubTerminalTakeoverCandidate;

function assertHubTerminalTakeoverDomain(
  catalog: Catalog,
  project: ProjectDocument,
  query: HubTerminalTakeoverCandidateQuery,
): void {
  if (query.source.source.kind !== 'occurrence') {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.source)} has no occurrence-owned Hub terminal domain`,
    );
  }
  const plan = planFor(project, query.source.routeKey, query.source.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  const topology = plan.topology;
  if (layout?.progression.kind !== 'hub' || topology === null) {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.source)} has no declaration-owned Hub terminal domain`,
    );
  }
  const terminal = hubTerminalTakeoverForSource(catalog, layout, topology, query.source.source);
  if (terminal === undefined) {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.source)} is not the bounded Hub terminal source`,
    );
  }
  const decision = exitDecisionForSource(topology, query.source.source);
  if (decision === undefined || !isExactTerminalTakeoverEnvelope(decision)) {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(query.source)} has no exact terminal Hub envelope`,
    );
  }
}

function evaluatePrefixHubTerminalTakeover(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: HubTerminalTakeoverCandidateQuery,
): EvaluatedHubTerminalTakeoverCandidate | undefined {
  const candidate = candidateBiome(evaluation, query.source.routeKey, query.source.biomeKey);
  const biome = candidatePrefix(candidate);
  const prefix = candidateAssessmentPrefix(biome);
  const frontier = prefix?.frontier;
  if (biome === undefined || prefix === undefined || frontier?.kind !== 'exitDecision') {
    return undefined;
  }
  if (semanticAddressKey(frontier.origin) !== semanticAddressKey(query.source)) return undefined;
  if (frontier.parent.origin.kind !== 'occurrence') return undefined;
  const owner = prefixAuthoredRooms(prefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(frontier.parent.origin),
  );
  const history =
    owner === undefined
      ? undefined
      : biome.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(owner.origin),
        )?.postCommit;
  if (owner === undefined || history === undefined) return undefined;
  return Object.freeze({
    kind: 'hubTerminalTakeover',
    result: hubTerminalTakeoverCandidateSupportAtFrontier(
      catalog,
      query.source,
      owner,
      history,
      completeBiomeCount(evaluation, query.source.routeKey, query.source.biomeKey),
    ),
  });
}

export function evaluateHubTerminalTakeover(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: HubTerminalTakeoverCandidateQuery,
): HubTerminalTakeoverCandidateEvaluation {
  assertHubTerminalTakeoverDomain(catalog, project, query);
  const result = evaluatePrefixHubTerminalTakeover(catalog, project, evaluation, query);
  if (result !== undefined) return result;
  return unavailableForBiome(
    evaluation,
    query.source.routeKey,
    query.source.biomeKey,
    query.source,
    'afterTargetGeneration',
  );
}
