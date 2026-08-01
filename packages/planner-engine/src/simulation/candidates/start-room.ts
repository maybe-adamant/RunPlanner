import type { Catalog } from '../../catalog-schema';
import type { BiomeAddress, OccurrenceAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import { CandidateEvaluationContractError } from './contract';
import { planFor } from './evaluated-biome';

export interface StartRoomCandidateQuery {
  readonly kind: 'startRoom';
  readonly owner: BiomeAddress | OccurrenceAddress;
  readonly gameName: string;
}

export interface StartRoomCandidateSupport {
  readonly gameName: string;
  readonly supportedGameNames: readonly string[];
  readonly selectedPossible: boolean;
}

export interface EvaluatedStartRoomCandidate {
  readonly kind: 'startRoom';
  readonly result: StartRoomCandidateSupport;
}

export function evaluateStartRoomCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  query: StartRoomCandidateQuery,
): EvaluatedStartRoomCandidate {
  const plan = planFor(project, query.owner.routeKey, query.owner.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined) {
    throw new CandidateEvaluationContractError(`${plan.biomeKey} has no catalog layout`);
  }
  if (
    query.owner.kind === 'occurrence' &&
    plan.topology?.startOccurrenceId !== query.owner.occurrenceId
  ) {
    throw new CandidateEvaluationContractError('start-room owner is not the topology start');
  }
  const supportedGameNames =
    layout.start.kind === 'authoredChoice'
      ? layout.start.roomGameNames
      : Object.freeze([layout.start.roomGameName]);
  return Object.freeze({
    kind: 'startRoom',
    result: Object.freeze({
      gameName: query.gameName,
      supportedGameNames,
      selectedPossible: supportedGameNames.includes(query.gameName),
    }),
  });
}
