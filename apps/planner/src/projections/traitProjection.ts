import {
  semanticAddressKey,
  type AuthoredTraitOffer,
  type ProjectDocument,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  CandidateContextUnavailable,
  ProjectEvaluation,
  SelectedTraitOfferAssessment,
  TraitReplacementTransition,
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
  readonly replacement?: TraitReplacementPresentation;
}

/** Presentation-only replacement evidence resolved through the catalog. */
export interface TraitReplacementPresentation {
  readonly slot: string;
  readonly replacedTraitLabel: string;
  readonly oldRarity: TraitReplacementTransition['oldRarity'];
  readonly newTraitKey: TraitReplacementTransition['newTraitKey'];
  readonly requiredRarity: TraitReplacementTransition['requiredRarity'];
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

function formatAlternativeLabels(labels: readonly string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, or ${labels.at(-1)}`;
}

function presentTraitCandidateReason(
  finding: {
    readonly code: Parameters<typeof presentTraitCandidateFinding>[0];
    readonly detail?: string;
    readonly requirementTraitKeys?: readonly string[];
  },
  traitLabel: (traitKey: string) => string,
): string {
  const copy = presentTraitCandidateFinding(finding.code);
  const requirementLabels = finding.requirementTraitKeys?.map(traitLabel);
  if (requirementLabels !== undefined && requirementLabels.length > 0) {
    const alternatives = formatAlternativeLabels(requirementLabels);
    if (finding.code === 'missingPrerequisite') {
      return `${copy.title}: Requires one of ${alternatives}.`;
    }
    if (finding.code === 'negativePrerequisite') {
      return `${copy.title}: Cannot be equipped alongside ${alternatives}.`;
    }
  }
  if (finding.code === 'targetedAcquisitionTargetUnavailable' && finding.detail !== undefined) {
    return `${copy.title}: ${copy.description} (${traitLabel(finding.detail)})`;
  }
  return finding.detail === undefined
    ? `${copy.title}: ${copy.description}`
    : `${copy.title}: ${copy.description} (${finding.detail})`;
}

/**
 * Adapt the engine's candidate artifact into option-level editor feedback.
 * The adapter only groups returned findings; it does not assess eligibility.
 */
export function projectTraitOfferFeedback(
  offer: AuthoredTraitOffer,
  candidate: CandidateOptionProjection<AuthoredTraitOffer> | undefined,
  traitLabel: (traitKey: string) => string = (traitKey) => traitKey,
): TraitOfferFeedback {
  if (offer.kind === 'fallbackGold') {
    if (candidate === undefined)
      return Object.freeze({ options: Object.freeze([]), support: 'unavailable' });
    const support = candidateSupport(candidate);
    const evaluation = candidate.evaluation;
    if (evaluation.kind === 'unavailable') {
      return Object.freeze({
        contextMessage: unavailableMessage(evaluation),
        options: Object.freeze([]),
        support,
      });
    }
    if (evaluation.kind !== 'traitOffer')
      return Object.freeze({ options: Object.freeze([]), support });
    const messages = evaluation.result.findings.map((finding) =>
      presentTraitCandidateReason(finding, traitLabel),
    );
    return Object.freeze({
      ...(messages.length === 0 ? {} : { contextMessage: [...new Set(messages)].join(' ') }),
      options: Object.freeze([]),
      support,
    });
  }
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
  const findingsByOption = new Map<string, string[]>();
  const contextMessages = new Set<string>();
  for (const finding of evaluation.result.findings) {
    const reason = presentTraitCandidateReason(finding, traitLabel);
    if (finding.traitKey === undefined) {
      if (finding.optionKey !== undefined) {
        const reasons = findingsByOption.get(finding.optionKey) ?? [];
        if (!reasons.includes(reason)) reasons.push(reason);
        findingsByOption.set(finding.optionKey, reasons);
        continue;
      }
      contextMessages.add(reason);
      continue;
    }
    const reasons = findingsByTrait.get(finding.traitKey);
    if (reasons === undefined) findingsByTrait.set(finding.traitKey, [reason]);
    else if (!reasons.includes(reason)) reasons.push(reason);
  }
  return Object.freeze({
    ...(contextMessages.size === 0 ? {} : { contextMessage: [...contextMessages].join(' ') }),
    options: Object.freeze(
      offer.options.map((option, index) => {
        const reasons = [
          ...(findingsByTrait.get(option.traitKey) ?? []),
          ...(findingsByOption.get(['option1', 'option2', 'option3'][index]!) ?? []),
        ];
        const replacement = uniformReplacement(
          evaluation.result.assessments,
          evaluation.result.branches.length,
          option.traitKey,
        );
        return Object.freeze({
          legal: reasons.length === 0,
          reasons: Object.freeze([...reasons]),
          traitKey: option.traitKey,
          ...(replacement === undefined
            ? {}
            : {
                replacement: Object.freeze({
                  slot: replacement.slot,
                  replacedTraitLabel: traitLabel(replacement.replacedTraitKey),
                  oldRarity: replacement.oldRarity,
                  newTraitKey: replacement.newTraitKey,
                  requiredRarity: replacement.requiredRarity,
                }),
              }),
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
  readonly selectedReplacement?: TraitReplacementPresentation;
  readonly invalid: boolean;
  readonly findingCount: number;
  readonly interactionKey: string;
}

function ownerLocation(
  project: ProjectDocument,
  owner: {
    readonly kind: string;
    readonly routeKey: string;
    readonly biomeKey: string;
    readonly occurrenceId: string;
  },
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
  owner: SelectedTraitOfferAssessment['address']['owner'],
): string {
  if (owner.kind === 'encounterPhase') {
    return ownerLocation(project, {
      routeKey: owner.routeKey,
      biomeKey: owner.biomeKey,
      kind: 'occurrence',
      occurrenceId: owner.owner.occurrenceId,
    });
  }
  if (owner.kind === 'acquisitionEntry') {
    if (owner.site.owner.kind !== 'occurrence') return 'Acquisition';
    return ownerLocation(project, owner.site.owner);
  }
  return ownerLocation(project, owner);
}

interface AggregatedTraitTrace {
  readonly trace: SelectedTraitOfferAssessment;
  readonly assessments: SelectedTraitOfferAssessment['branches'][number]['assessments'][number][];
  readonly compositions: SelectedTraitOfferAssessment['branches'][number]['composition'][];
  readonly replacementCompositions: SelectedTraitOfferAssessment['branches'][number]['replacementComposition'][];
  readonly targetedAcquisitions: SelectedTraitOfferAssessment['branches'][number]['targetedAcquisition'][];
  biomeOrder: number;
  chronologicalIndex: number;
}

function findingKey(finding: {
  readonly code: string;
  readonly traitKey?: string;
  readonly detail?: string;
  readonly requirementTraitKeys?: readonly string[];
}): string {
  return `${finding.code}|${finding.traitKey}|${finding.detail ?? ''}|${finding.requirementTraitKeys?.join(',') ?? ''}`;
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
    for (const composition of trace.compositions) {
      if (!composition.legal) invalid = true;
      for (const finding of composition.findings) findingKeys.add(findingKey(finding));
    }
    for (const composition of trace.replacementCompositions) {
      if (!composition.legal) invalid = true;
      for (const finding of composition.findings) findingKeys.add(findingKey(finding));
    }
    for (const acquisition of trace.targetedAcquisitions) {
      if (!acquisition.legal) invalid = true;
      for (const finding of acquisition.findings) findingKeys.add(findingKey(finding));
    }
  }
  return Object.freeze({ invalid, findingCount: findingKeys.size });
}

function uniformReplacement(
  assessments: readonly SelectedTraitOfferAssessment['branches'][number]['assessments'][number][],
  branchCount: number,
  traitKey: string,
): TraitReplacementTransition | undefined {
  const replacements = assessments
    .map((assessment) => assessment.replacementTransition)
    .filter(
      (replacement): replacement is TraitReplacementTransition =>
        replacement?.newTraitKey === traitKey,
    );
  if (replacements.length !== branchCount) return undefined;
  const first = replacements[0];
  if (first === undefined) return undefined;
  return replacements.every(
    (replacement) =>
      replacement.slot === first.slot &&
      replacement.replacedTraitKey === first.replacedTraitKey &&
      replacement.oldRarity === first.oldRarity &&
      replacement.requiredRarity === first.requiredRarity,
  )
    ? first
    : undefined;
}

function presentReplacement(
  catalog: Catalog,
  replacement: TraitReplacementTransition,
): TraitReplacementPresentation {
  return Object.freeze({
    slot: replacement.slot,
    replacedTraitLabel:
      catalog.traits.byKey[replacement.replacedTraitKey]?.label ?? replacement.replacedTraitKey,
    oldRarity: replacement.oldRarity,
    newTraitKey: replacement.newTraitKey,
    requiredRarity: replacement.requiredRarity,
  });
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
  for (const [biomeOrder, biome] of route.biomes.entries()) {
    if (!('rewards' in biome)) continue;
    for (const trace of biome.rewards.selectedTraitOffers) {
      const key = semanticAddressKey(trace.address);
      const existing = grouped.get(key);
      if (existing === undefined) {
        grouped.set(key, {
          assessments: trace.branches.flatMap((branch) => [...branch.assessments]),
          compositions: trace.branches.map((branch) => branch.composition),
          replacementCompositions: trace.branches.map((branch) => branch.replacementComposition),
          targetedAcquisitions: trace.branches.map((branch) => branch.targetedAcquisition),
          biomeOrder,
          chronologicalIndex: trace.chronologicalIndex,
          trace,
        });
      } else {
        existing.assessments.push(...trace.branches.flatMap((branch) => [...branch.assessments]));
        existing.compositions.push(...trace.branches.map((branch) => branch.composition));
        existing.replacementCompositions.push(
          ...trace.branches.map((branch) => branch.replacementComposition),
        );
        existing.targetedAcquisitions.push(
          ...trace.branches.map((branch) => branch.targetedAcquisition),
        );
        existing.chronologicalIndex = Math.min(
          existing.chronologicalIndex,
          trace.chronologicalIndex,
        );
        existing.biomeOrder = Math.min(existing.biomeOrder, biomeOrder);
      }
    }
  }
  return Object.freeze(
    [...grouped.values()].sort((left, right) => {
      const chronology = left.biomeOrder - right.biomeOrder;
      if (chronology !== 0) return chronology;
      const localChronology = left.chronologicalIndex - right.chronologicalIndex;
      if (localChronology !== 0) return localChronology;
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
    const address = trace.address;
    const key = semanticAddressKey(address);
    const control = interactions.traitOffers.get(key);
    if (trace.offer.kind === 'fallbackGold') continue;
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
    const selectedReplacement = uniformReplacement(
      grouped.assessments,
      grouped.compositions.length,
      option.traitKey,
    );
    rows.push(
      Object.freeze({
        address,
        biomeKey: address.biomeKey,
        giverLabel: giver.label,
        locationLabel: ownerLocationForAddress(project, trace.address.owner),
        selectedTraitLabel: trait.label,
        ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
        ...(selectedReplacement === undefined
          ? {}
          : { selectedReplacement: presentReplacement(catalog, selectedReplacement) }),
        invalid: evidence.invalid,
        findingCount: evidence.findingCount,
        interactionKey: key,
      }),
    );
  }
  return Object.freeze(rows);
}
