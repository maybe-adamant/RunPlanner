import {
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type ProjectDocument,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  CandidateContextUnavailable,
  ProjectEvaluation,
  ReachedTraitOfferEvaluation,
} from '@run-planner/engine/simulation';

import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
} from './candidateProjection';
import { candidateSupport } from './candidateProjection';
import { presentTraitCandidateFinding } from './evaluationProjection';
import type { WorkspaceInteractionCatalog } from './structured-workspace';

export interface TraitOfferOptionFeedback {
  readonly legal: boolean;
  readonly reasons: readonly string[];
  readonly traitKey: string;
}

export interface TraitOfferFeedback {
  readonly contextMessage?: string;
  readonly options: readonly TraitOfferOptionFeedback[];
  readonly support: ReturnType<typeof candidateSupport>;
}

function unavailableMessage(evaluation: CandidateContextUnavailable): string {
  switch (evaluation.evidence.kind) {
    case 'authoredPrerequisiteMissing':
      return 'Complete the required route prerequisite before evaluating this offer.';
    case 'coverageNotReached':
      return 'This offer context has not been evaluated yet.';
    case 'producerFrontierUnavailable':
      return 'The current route does not reach this offer yet.';
    case 'targetNotReachable':
      return 'This offer is not reachable in the current route.';
    case 'upstreamIncomplete':
      return 'Complete the earlier biome before evaluating this offer.';
    case 'upstreamInvalid':
      return 'Fix the earlier biome before evaluating this offer.';
  }
}

/**
 * Adapt the engine's candidate artifact into option-level editor feedback.
 * The adapter only groups returned findings; it does not assess eligibility.
 */
export function projectTraitOfferFeedback(
  offer: AuthoredTraitOffer,
  candidate: CandidateOptionProjection<AuthoredTraitOffer> | undefined,
): TraitOfferFeedback {
  if (candidate === undefined) {
    return Object.freeze({ options: Object.freeze([]), support: 'unavailable' });
  }
  const support = candidateSupport(candidate);
  const evaluation: CandidateProjectionEvaluation = candidate.evaluation;
  if (evaluation.kind === 'unavailable') {
    return Object.freeze({
      contextMessage: unavailableMessage(evaluation),
      options: Object.freeze([]),
      support,
    });
  }
  if (evaluation.kind !== 'traitOffer') {
    return Object.freeze({ options: Object.freeze([]), support });
  }
  const findingsByTrait = new Map<string, string[]>();
  for (const finding of evaluation.result.findings) {
    const copy = presentTraitCandidateFinding(finding.code);
    const reason =
      finding.detail === undefined
        ? `${copy.title}: ${copy.description}`
        : `${copy.title}: ${copy.description} (${finding.detail})`;
    const reasons = findingsByTrait.get(finding.traitKey);
    if (reasons === undefined) findingsByTrait.set(finding.traitKey, [reason]);
    else if (!reasons.includes(reason)) reasons.push(reason);
  }
  return Object.freeze({
    options: Object.freeze(
      offer.options.map((option) => {
        const reasons = findingsByTrait.get(option.traitKey) ?? [];
        return Object.freeze({
          legal: reasons.length === 0,
          reasons: Object.freeze([...reasons]),
          traitKey: option.traitKey,
        });
      }),
    ),
    support,
  });
}

export interface RouteTraitOfferProjection {
  readonly address: TraitOfferAddress;
  readonly biomeKey: string;
  readonly giverLabel: string;
  readonly locationLabel: string;
  readonly selectedTraitLabel: string;
  readonly rarity?: string;
  readonly invalid: boolean;
  readonly findingCount: number;
  readonly interactionKey: string;
}

function ownerLocation(
  project: ProjectDocument,
  owner: Extract<ReachedTraitOfferEvaluation['address'], { readonly occurrenceId: string }>,
): string {
  const route = project.routes.find((candidate) => candidate.routeKey === owner.routeKey);
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === owner.biomeKey);
  const occurrence = biome?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === owner.occurrenceId,
  );
  return occurrence?.gameName ?? owner.kind;
}

function ownerLocationForAddress(
  project: ProjectDocument,
  owner: ReachedTraitOfferEvaluation['address'],
): string {
  if (!('occurrenceId' in owner)) return owner.kind;
  return ownerLocation(project, owner);
}

interface AggregatedTraitTrace {
  readonly trace: ReachedTraitOfferEvaluation;
  readonly assessments: ReachedTraitOfferEvaluation['assessments'][number][];
  chronologicalIndex: number;
}

function findingKey(finding: {
  readonly code: string;
  readonly traitKey: string;
  readonly detail?: string;
}): string {
  return `${finding.code}|${finding.traitKey}|${finding.detail ?? ''}`;
}

function aggregateTraceEvidence(traces: readonly AggregatedTraitTrace[]): {
  readonly invalid: boolean;
  readonly findingCount: number;
} {
  const findingKeys = new Set<string>();
  let invalid = false;
  for (const trace of traces) {
    for (const assessment of trace.assessments) {
      if (!assessment.legal) invalid = true;
      for (const finding of assessment.findings) findingKeys.add(findingKey(finding));
    }
  }
  return Object.freeze({ invalid, findingCount: findingKeys.size });
}

/*
 * Route evaluation branches are alternate reachable histories, not separate
 * authored offers. Keep one row per exact semantic owner while retaining all
 * assessment evidence so a single invalid branch cannot be hidden by the
 * first branch encountered.
 */
function groupedTraitTraces(
  route: ProjectEvaluation['routes'][number],
): readonly AggregatedTraitTrace[] {
  const grouped = new Map<string, AggregatedTraitTrace>();
  for (const biome of route.biomes) {
    if (!('rewards' in biome)) continue;
    for (const branch of biome.rewards.branches) {
      for (const trace of branch.traitEvaluations ?? []) {
        const address = createTraitOfferAddress(
          trace.address as Extract<
            typeof trace.address,
            { kind: 'incomingReward' | 'localReward' | 'rewardWheelOffer' | 'shopOffer' }
          >,
          trace.acquisitionRole,
        );
        const key = semanticAddressKey(address);
        const existing = grouped.get(key);
        if (existing === undefined) {
          grouped.set(key, {
            assessments: [...trace.assessments],
            chronologicalIndex: trace.chronologicalIndex,
            trace,
          });
        } else {
          existing.assessments.push(...trace.assessments);
          existing.chronologicalIndex = Math.min(
            existing.chronologicalIndex,
            trace.chronologicalIndex,
          );
        }
      }
    }
  }
  return Object.freeze(
    [...grouped.values()].sort((left, right) => {
      const chronology = left.chronologicalIndex - right.chronologicalIndex;
      if (chronology !== 0) return chronology;
      return semanticAddressKey(left.trace.address).localeCompare(
        semanticAddressKey(right.trace.address),
      );
    }),
  );
}

export function projectRouteTraitOffers(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  routeKey: string,
  interactions: WorkspaceInteractionCatalog,
): readonly RouteTraitOfferProjection[] {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  if (route === undefined) return Object.freeze([]);
  const rows: RouteTraitOfferProjection[] = [];
  for (const grouped of groupedTraitTraces(route)) {
    const trace = grouped.trace;
    const address = createTraitOfferAddress(
      trace.address as Extract<
        typeof trace.address,
        { kind: 'incomingReward' | 'localReward' | 'rewardWheelOffer' | 'shopOffer' }
      >,
      trace.acquisitionRole,
    );
    const key = semanticAddressKey(address);
    const control = interactions.traitOffers.get(key);
    const option =
      trace.offer.options[
        trace.offer.selectedOptionKey === 'option1'
          ? 0
          : trace.offer.selectedOptionKey === 'option2'
            ? 1
            : 2
      ];
    if (option === undefined) continue;
    const trait = catalog.traits.byKey[option.traitKey];
    const giver = catalog.traitGivers.byKey[trace.offer.giverKey];
    if (trait === undefined || giver === undefined || control === undefined) continue;
    const evidence = aggregateTraceEvidence([grouped]);
    rows.push(
      Object.freeze({
        address,
        biomeKey: address.biomeKey,
        giverLabel: giver.label,
        locationLabel: ownerLocationForAddress(project, trace.address),
        selectedTraitLabel: trait.label,
        ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
        invalid: evidence.invalid,
        findingCount: evidence.findingCount,
        interactionKey: key,
      }),
    );
  }
  return Object.freeze(rows);
}
