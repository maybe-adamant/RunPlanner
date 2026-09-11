import {
  levelResolutionCandidateForProjectEvaluationAssembly,
  type ProjectCandidateSessionQuery,
} from '@run-planner/engine/simulation';
import {
  semanticAddressKey,
  type AuthoredTraitOffer,
  type AuthoredKeepsakeEquipResults,
  type TraitOptionKey,
} from '@run-planner/engine/authored-project';

import type { AuthoredTraitOption } from '@run-planner/engine/authored-project';
import type {
  CirceResolutionDomainEvaluation,
  EchoLastRunBoonDomainEvaluation,
  EchoPomTargetDomainEvaluation,
  EvaluatedAcquisitionConversionCandidate,
  EvaluatedSteadyGrowthOutcomeCandidate,
  EvaluatedTranscendentEmbryoOutcomeCandidate,
  CandidateContextUnavailable,
  ConcaveStoneCandidateBranch,
  TraitCarrierChildDomainEvaluation,
} from '@run-planner/engine/simulation';

import type {
  CandidateProjectionEvaluation,
  CandidateProjectionSession,
  KeepsakeEquipResultOptionProjection,
} from './candidateProjection';
import { domainKey, type CandidateProjectionCore } from './candidateProjectionSession';

function traitOptionKey(option: AuthoredTraitOption): string {
  return `${option.traitKey}:${option.rarity ?? ''}:${option.targetTraitKey ?? ''}`;
}

function offerWithFocusedOption(
  value: AuthoredTraitOffer,
  optionKey: TraitOptionKey,
  option: AuthoredTraitOption,
): AuthoredTraitOffer {
  if (value.kind !== 'traits') return value;
  const index = optionKey === 'option1' ? 0 : optionKey === 'option2' ? 1 : 2;
  const options = [...value.options] as AuthoredTraitOption[];
  options[index] = Object.freeze({ ...option });
  return Object.freeze({
    ...value,
    options: Object.freeze(options) as typeof value.options,
  });
}

function keepsakeEquipResultKey(
  value: AuthoredKeepsakeEquipResults[keyof AuthoredKeepsakeEquipResults] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if ('kind' in value) return value.kind === 'selected' ? value.traitKey : '__exhausted';
  if ('blessingKey' in value) return value.blessingKey;
  return value.traitKey;
}

export type TraitCandidateAdapters = Pick<
  CandidateProjectionSession,
  | 'traitOffer'
  | 'traitOfferStartingDraft'
  | 'nextOptionalHighTierTraitOfferDraft'
  | 'previousOptionalHighTierTraitOfferDraft'
  | 'chaosOfferDomain'
  | 'traitOfferFocusedOptions'
  | 'traitCarrierChildDomain'
  | 'circeResolution'
  | 'echoPomTarget'
  | 'echoLastRunBoon'
  | 'ransomAssessment'
  | 'concaveStone'
  | 'steadyGrowthOutcome'
  | 'transcendentEmbryoOutcome'
  | 'fountainRarityOutcome'
  | 'levelResolution'
  | 'judgmentArcana'
  | 'figurineArcana'
  | 'keepsakeSelections'
  | 'keepsakeEquipResult'
  | 'acquisitionConversion'
>;

function aggregateEvaluation(core: CandidateProjectionCore, query: ProjectCandidateSessionQuery) {
  return core.evaluate(query);
}

export function createTraitCandidateAdapters(
  core: CandidateProjectionCore,
): TraitCandidateAdapters {
  const childDomains = new Map<string, TraitCarrierChildDomainEvaluation>();
  return {
    traitOffer: (owner, value) =>
      core.projectOptions(
        `trait-offer:${semanticAddressKey(owner)}:${JSON.stringify(value)}`,
        [value],
        [{ kind: 'traitOffer', trait: owner, value }],
      ),
    traitOfferStartingDraft: (owner, giverKey) => {
      const draft = core.traitOfferStartingDraft(owner, giverKey);
      return draft?.kind === 'traits' ? draft : undefined;
    },
    nextOptionalHighTierTraitOfferDraft: (owner, value) =>
      core.nextOptionalHighTierTraitOfferDraft(owner, value),
    previousOptionalHighTierTraitOfferDraft: (owner, value) =>
      core.previousOptionalHighTierTraitOfferDraft(owner, value),
    chaosOfferDomain: (owner, value) => core.chaosOfferDomain(owner, value),
    traitOfferFocusedOptions: (owner, value, optionKey, variants) =>
      core.projectOptions(
        `trait-offer-focused:${semanticAddressKey(owner)}:${JSON.stringify(value)}:${optionKey}:${domainKey(
          variants.map(traitOptionKey),
        )}`,
        variants,
        variants.map((option) => ({
          kind: 'traitOfferFocusedOption' as const,
          optionKey,
          trait: owner,
          value: offerWithFocusedOption(value, optionKey, option),
        })),
      ),
    traitCarrierChildDomain: (owner, value, child) => {
      const key = `trait-carrier-child:${semanticAddressKey(owner)}:${JSON.stringify(value)}:${JSON.stringify(child)}`;
      const cached = childDomains.get(key);
      if (cached !== undefined) return cached;
      const evaluated = core.evaluate({
        kind: 'traitCarrierChildDomain',
        trait: owner,
        value,
        child,
      });
      childDomains.set(key, evaluated);
      return evaluated;
    },
    circeResolution: (owner, value, optionKey) =>
      aggregateEvaluation(core, {
        kind: 'circeResolutionDomain',
        trait: owner,
        value,
        optionKey,
      }) as CirceResolutionDomainEvaluation,
    echoPomTarget: (owner, value, optionKey) =>
      aggregateEvaluation(core, {
        kind: 'echoPomTargetDomain',
        trait: owner,
        value,
        optionKey,
      }) as EchoPomTargetDomainEvaluation,
    echoLastRunBoon: (owner, value, optionKey) =>
      aggregateEvaluation(core, {
        kind: 'echoLastRunBoonDomain',
        trait: owner,
        value,
        optionKey,
      }) as EchoLastRunBoonDomainEvaluation,
    ransomAssessment: (trait, value) =>
      aggregateEvaluation(core, {
        kind: 'ransomAssessment',
        trait,
        value,
      }) as import('@run-planner/engine/simulation').RansomAssessmentCandidateEvaluation,
    concaveStone: (owner, value) => {
      const evaluation = core.evaluate({ kind: 'traitOffer', trait: owner, value });
      return evaluation.kind === 'traitOffer'
        ? (evaluation.result.concaveStone ?? Object.freeze([]))
        : Object.freeze([] as ConcaveStoneCandidateBranch[]);
    },
    steadyGrowthOutcome: (outcome, targetTraitKey) =>
      aggregateEvaluation(core, {
        kind: 'steadyGrowthOutcome',
        outcome,
        targetTraitKey,
      }) as EvaluatedSteadyGrowthOutcomeCandidate | CandidateContextUnavailable,
    transcendentEmbryoOutcome: (outcome, value) =>
      aggregateEvaluation(core, {
        kind: 'transcendentEmbryoOutcome',
        outcome,
        value,
      }) as EvaluatedTranscendentEmbryoOutcomeCandidate | CandidateContextUnavailable,
    fountainRarityOutcome: (outcome, targetTraitKey) =>
      aggregateEvaluation(core, {
        kind: 'fountainRarityOutcome',
        outcome,
        targetTraitKey,
      }) as
        | import('@run-planner/engine/simulation').EvaluatedFountainRarityOutcomeCandidate
        | CandidateContextUnavailable,
    levelResolution: (owner, value) => {
      const capability = levelResolutionCandidateForProjectEvaluationAssembly(core.assembly, owner);
      if (capability === undefined) return undefined;
      const evaluations = capability.evaluate(value);
      const groups = new Map<
        string,
        {
          surface: import('./candidateProjection').LevelResolutionCandidateSurface;
          branchIndices: number[];
          evaluations: (typeof evaluations)[number][];
        }
      >();
      for (const [branchIndex, surface] of capability.branches.entries()) {
        const key = JSON.stringify([
          surface.effectKind,
          surface.emptyTargetAllowed ?? false,
          surface.levelCount,
          surface.requiredOfferCount,
          surface.eligibleTargetTraitKeys,
        ]);
        const entry = groups.get(key) ?? { surface, branchIndices: [], evaluations: [] };
        entry.branchIndices.push(branchIndex);
        const evaluation = evaluations.find((candidate) => candidate.branchIndex === branchIndex);
        if (evaluation !== undefined) entry.evaluations.push(evaluation);
        groups.set(key, entry);
      }
      return Object.freeze({
        groups: Object.freeze(
          [...groups.entries()].map(([key, group]) =>
            Object.freeze({
              key,
              surface: group.surface,
              branchIndices: Object.freeze(group.branchIndices),
              evaluations: Object.freeze(group.evaluations),
            }),
          ),
        ),
      });
    },
    judgmentArcana: (owner, arcanaKeys) =>
      aggregateEvaluation(core, {
        kind: 'judgmentArcana',
        judgment: owner,
        arcanaKeys,
      }) as CandidateProjectionEvaluation,
    figurineArcana: (owner, arcanaKeys) =>
      aggregateEvaluation(core, {
        kind: 'figurineArcana',
        figurine: owner,
        arcanaKeys,
      }) as CandidateProjectionEvaluation,
    keepsakeSelections: (owner) => {
      const evaluation = aggregateEvaluation(core, {
        kind: 'keepsakeSelection',
        selection: owner,
      });
      if (evaluation.kind === 'unavailable') return Object.freeze([]);
      if (evaluation.kind !== 'keepsakeSelection') {
        throw new Error(
          `Keepsake candidate ${semanticAddressKey(owner)} returned ${evaluation.kind}`,
        );
      }
      return Object.freeze(
        evaluation.result.options.map((option) =>
          Object.freeze({
            value: option.key,
            evaluation: Object.freeze({
              ...evaluation,
              result: Object.freeze({
                ...evaluation.result,
                selectedPossible: option.selectedPossible,
              }),
            }),
          }),
        ),
      );
    },
    acquisitionConversion: (owner) =>
      aggregateEvaluation(core, {
        kind: 'acquisitionConversion',
        acquisition: owner,
      }) as EvaluatedAcquisitionConversionCandidate,
    keepsakeEquipResult: (
      owner,
      value?: AuthoredKeepsakeEquipResults[keyof AuthoredKeepsakeEquipResults],
    ) => {
      const evaluation = aggregateEvaluation(core, {
        kind: 'keepsakeEquipResult',
        result: owner,
        ...(value === undefined ? {} : { value }),
      });
      if (evaluation.kind === 'unavailable') return Object.freeze([]);
      if (evaluation.kind !== 'keepsakeEquipResult')
        throw new Error(
          `Keepsake equip result ${semanticAddressKey(owner)} returned ${evaluation.kind}`,
        );
      const projected = evaluation.result.options.map((option) =>
        Object.freeze({
          value:
            'kind' in option.value
              ? option.value.kind === 'selected'
                ? option.value.traitKey
                : '__exhausted'
              : 'blessingKey' in option.value
                ? option.value.blessingKey
                : option.value.traitKey,
          resultValue: option.value,
          evaluation: Object.freeze({
            ...evaluation,
            result: Object.freeze({
              ...evaluation.result,
              selectedPossible: option.selectedPossible,
            }),
          }),
          ...(option.transcendentEmbryoSummary === undefined
            ? {}
            : { transcendentEmbryoSummary: option.transcendentEmbryoSummary }),
        }),
      ) as readonly KeepsakeEquipResultOptionProjection[];
      const selectedKey = keepsakeEquipResultKey(value);
      if (selectedKey === undefined || projected.some((option) => option.value === selectedKey))
        return Object.freeze(projected);
      return Object.freeze([
        ...projected,
        Object.freeze({
          value: selectedKey,
          resultValue: value,
          evaluation: Object.freeze({
            ...evaluation,
            result: Object.freeze({ ...evaluation.result, selectedPossible: false }),
          }),
        }),
      ]);
    },
  };
}
