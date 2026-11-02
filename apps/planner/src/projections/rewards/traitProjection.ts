import {
  semanticAddressKey,
  type AuthoredTraitOffer,
  type ProjectDocument,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { persephoneLevelRolls } from '@run-planner/engine/simulation';
import type {
  CandidateContextUnavailable,
  ProjectEvaluation,
  SelectedTraitOfferAssessment,
  TraitReplacementTransition,
  PersephoneLevelRoll,
} from '@run-planner/engine/simulation';
import { findingScreenTab, type ScreenTab } from './screenRerollTabs';

import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
} from '../candidates/candidateProjection';
import { candidateSupport } from '../candidates/candidateProjection';
import {
  formatFindingExplanation,
  presentTraitCandidateFinding,
  presentTraitOfferGenerationFinding,
  type TraitOfferGenerationFacts,
} from '../evaluationProjection';
import type { WorkspaceInteractionCatalog } from '../structured-workspace';

export interface TraitOfferOptionFeedback {
  readonly legal: boolean;
  readonly reasons: readonly string[];
  readonly traitKey: string;
  /** Engine-published row products. */
  readonly effectiveLevel?: number;
  readonly persephoneLevelRolls?: readonly PersephoneLevelRoll[];
  /** Installed level at Persephone roll zero; present with the rolls. */
  readonly persephoneBaseLevel?: number;
  /** Levels Jeweled Pom adds to this row; omitted when it adds none. */
  readonly jeweledPomLevels?: number;
  readonly replacement?: TraitReplacementPresentation;
}

/** Presentation-only replacement evidence resolved through the catalog. */
export interface TraitReplacementPresentation {
  readonly slot: string;
  readonly replacedTraitKey: string;
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

export interface TraitOfferStatePresentation {
  readonly rarity:
    | {
        readonly kind: 'orderedChecks';
        readonly checks: readonly { readonly label: string; readonly value: string }[];
      }
    | { readonly kind: 'fixed'; readonly rarity: string };
}

function formatCheckValue(value: number): string {
  return `${Number((value * 100).toFixed(6))}%`;
}

/** Presents the offer's exact generation facts without recomputing policy. */
export function projectTraitOfferState(
  candidate: CandidateOptionProjection<AuthoredTraitOffer> | undefined,
): TraitOfferStatePresentation | undefined {
  if (candidate?.evaluation.kind !== 'traitOffer') return undefined;
  const rarity = candidate.evaluation.result.state?.offerGenerationState?.rarity;
  if (rarity === undefined) return undefined;
  return Object.freeze({
    rarity:
      rarity.kind === 'fixed'
        ? Object.freeze({ kind: 'fixed' as const, rarity: rarity.rarity })
        : Object.freeze({
            kind: 'orderedChecks' as const,
            checks: Object.freeze(
              rarity.rollOrder.flatMap((label) =>
                label === 'Common'
                  ? []
                  : [Object.freeze({ label, value: formatCheckValue(rarity.values[label]) })],
              ),
            ),
          }),
  });
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
  finding: TraitOfferGenerationFacts & {
    readonly code: Parameters<typeof presentTraitCandidateFinding>[0];
    readonly detail?: string;
    readonly requirementTraitKeys?: readonly string[];
  },
  traitLabel: (traitKey: string) => string,
): string {
  if (finding.code === 'traitOfferGenerationUnavailable')
    return formatFindingExplanation(presentTraitOfferGenerationFinding(finding, traitLabel));
  const copy = presentTraitCandidateFinding(finding.code, finding.reason);
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
  const explanation = formatFindingExplanation(copy);
  if (finding.code === 'targetedAcquisitionTargetUnavailable' && finding.detail !== undefined) {
    return `${explanation} (${traitLabel(finding.detail)})`;
  }
  return finding.detail === undefined ? explanation : `${explanation} (${finding.detail})`;
}

/**
 * Adapt the engine's candidate artifact into option-level editor feedback.
 * The adapter only groups returned findings; it does not assess eligibility.
 */
export function projectTraitOfferFeedback(
  offer: AuthoredTraitOffer,
  candidate: CandidateOptionProjection<AuthoredTraitOffer> | undefined,
  traitLabel: (traitKey: string) => string = (traitKey) => traitKey,
  /** The screen whose rows `offer` holds and whose findings are grouped. */
  screen: ScreenTab = 'final',
): TraitOfferFeedback {
  const onScreen = (finding: Parameters<typeof findingScreenTab>[0]): boolean =>
    findingScreenTab(finding) === screen;
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
    const messages = evaluation.result.findings
      .filter(onScreen)
      .map((finding) => presentTraitCandidateReason(finding, traitLabel));
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
  if (offer.kind !== 'traits') return Object.freeze({ options: Object.freeze([]), support });
  const findingsByTrait = new Map<string, string[]>();
  const findingsByOption = new Map<string, string[]>();
  const contextMessages = new Set<string>();
  const addOptionReason = (optionKey: string, reason: string) => {
    const reasons = findingsByOption.get(optionKey) ?? [];
    if (!reasons.includes(reason)) reasons.push(reason);
    findingsByOption.set(optionKey, reasons);
  };
  for (const finding of evaluation.result.findings.filter(onScreen)) {
    const reason = presentTraitCandidateReason(finding, traitLabel);
    // An unshowable screen marks the rows its cause names; its trait may be a filler off the screen.
    if (finding.code === 'traitOfferGenerationUnavailable') {
      const rows =
        finding.optionKeys ?? (finding.optionKey === undefined ? [] : [finding.optionKey]);
      if (rows.length === 0) contextMessages.add(reason);
      for (const optionKey of rows) addOptionReason(optionKey, reason);
      continue;
    }
    if (finding.traitKey === undefined) {
      if (finding.optionKey !== undefined) {
        addOptionReason(finding.optionKey, reason);
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
        const final = screen === 'final';
        const replacement = uniformReplacement(
          final
            ? evaluation.result.assessments
            : (evaluation.result.state?.rerolledScreens?.find((entry) => entry.screen === screen)
                ?.assessments ?? []),
          evaluation.result.state === undefined ? 0 : 1,
          option.traitKey,
        );
        const screenLevel = (
          field:
            | 'effectiveLevel'
            | 'persephoneLevelBonusMaximum'
            | 'persephoneBaseLevel'
            | 'jeweledPomLevels',
        ): number | undefined =>
          evaluation.result.state?.rerolledScreens?.find((entry) => entry.screen === screen)
            ?.levelResolutions[index]?.[field];
        const effectiveLevel = final
          ? evaluation.result.effectiveLevels[index]
          : screenLevel('effectiveLevel');
        const persephoneLevelBonusMaximum = final
          ? evaluation.result.persephoneLevelBonusMaximums[index]
          : screenLevel('persephoneLevelBonusMaximum');
        const persephoneBaseLevel = final
          ? evaluation.result.persephoneBaseLevels[index]
          : screenLevel('persephoneBaseLevel');
        const jeweledPomLevels = final
          ? evaluation.result.jeweledPomLevels[index]
          : screenLevel('jeweledPomLevels');
        return Object.freeze({
          legal: reasons.length === 0,
          reasons: Object.freeze([...reasons]),
          traitKey: option.traitKey,
          ...(effectiveLevel === undefined ? {} : { effectiveLevel }),
          ...(jeweledPomLevels === undefined ? {} : { jeweledPomLevels }),
          ...(persephoneLevelBonusMaximum === undefined || persephoneBaseLevel === undefined
            ? {}
            : {
                persephoneLevelRolls: persephoneLevelRolls(
                  persephoneLevelBonusMaximum,
                  persephoneBaseLevel,
                ),
                persephoneBaseLevel,
              }),
          ...(replacement === undefined
            ? {}
            : {
                replacement: Object.freeze({
                  slot: replacement.slot,
                  replacedTraitKey: replacement.replacedTraitKey,
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
  readonly giverKey: string;
  readonly giverLabel: string;
  readonly locationLabel: string;
  readonly selectedTraitKey: string;
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
  const route = project.route.routeKey === owner.routeKey ? project.route : undefined;
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
  if (owner.kind === 'gorgonPhase') {
    return ownerLocation(project, {
      routeKey: owner.encounter.routeKey,
      biomeKey: owner.encounter.biomeKey,
      kind: 'occurrence',
      occurrenceId: owner.encounter.owner.occurrenceId,
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
  readonly assessments: SelectedTraitOfferAssessment['assessment']['assessments'][number][];
  readonly generations: NonNullable<SelectedTraitOfferAssessment['assessment']['generation']>[];
  readonly compositions: SelectedTraitOfferAssessment['assessment']['composition'][];
  readonly targetedAcquisitions: SelectedTraitOfferAssessment['assessment']['targetedAcquisition'][];
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
    for (const generation of trace.generations) {
      if (!generation.legal) invalid = true;
      for (const finding of generation.findings) findingKeys.add(findingKey(finding));
    }
    for (const composition of trace.compositions) {
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
  assessments: readonly SelectedTraitOfferAssessment['assessment']['assessments'][number][],
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
    replacedTraitKey: replacement.replacedTraitKey,
    replacedTraitLabel:
      catalog.traits.byKey[replacement.replacedTraitKey]?.label ?? replacement.replacedTraitKey,
    oldRarity: replacement.oldRarity,
    newTraitKey: replacement.newTraitKey,
    requiredRarity: replacement.requiredRarity,
  });
}

/* One row per exact semantic owner, ordered by engine chronology. */
function groupedTraitTraces(route: ProjectEvaluation['route']): readonly AggregatedTraitTrace[] {
  const grouped = new Map<string, AggregatedTraitTrace>();
  for (const [biomeOrder, biome] of route.biomes.entries()) {
    if (!('rewards' in biome)) continue;
    for (const trace of biome.rewards.selectedTraitOffers) {
      const key = semanticAddressKey(trace.address);
      const existing = grouped.get(key);
      if (existing === undefined) {
        grouped.set(key, {
          assessments: [...trace.assessment.assessments],
          generations:
            trace.assessment.generation === undefined ? [] : [trace.assessment.generation],
          compositions: [trace.assessment.composition],
          targetedAcquisitions: [trace.assessment.targetedAcquisition],
          biomeOrder,
          chronologicalIndex: trace.chronologicalIndex,
          trace,
        });
      } else {
        existing.assessments.push(...trace.assessment.assessments);
        if (trace.assessment.generation !== undefined)
          existing.generations.push(trace.assessment.generation);
        existing.compositions.push(trace.assessment.composition);
        existing.targetedAcquisitions.push(trace.assessment.targetedAcquisition);
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
  const route = evaluation.route.routeKey === routeKey ? evaluation.route : undefined;
  if (route === undefined) return Object.freeze([]);
  const rows: RouteTraitOfferProjection[] = [];
  for (const grouped of groupedTraitTraces(route)) {
    const trace = grouped.trace;
    const address = trace.address;
    const key = semanticAddressKey(address);
    const control = interactions.traitOffers.get(key);
    if (trace.offer.kind !== 'traits') continue;
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
        giverKey: giver.key,
        giverLabel: giver.label,
        locationLabel: ownerLocationForAddress(project, trace.address.owner),
        selectedTraitKey: trait.key,
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
