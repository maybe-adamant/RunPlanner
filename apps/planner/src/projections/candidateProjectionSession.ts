import {
  createPreparedProjectCandidateSession,
  type ProjectCandidateSession,
  type ProjectCandidateSessionEvaluation,
  type ProjectCandidateSessionQuery,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
  CandidateSessionFactoryOptions,
} from './candidateProjection';

export interface CandidateProjectionCoreFactory {
  readonly bind: (assembly: ProjectEvaluationAssembly) => CandidateProjectionCore;
}

export interface CandidateProjectionCore {
  readonly catalog: Catalog;
  readonly assembly: ProjectEvaluationAssembly;
  readonly evaluate: ProjectCandidateSession['evaluate'];
  readonly traitOfferStartingDraft: ProjectCandidateCoreTraitDrafts['traitOfferStartingDraft'];
  readonly nextOptionalHighTierTraitOfferDraft: ProjectCandidateCoreTraitDrafts['nextOptionalHighTierTraitOfferDraft'];
  readonly previousOptionalHighTierTraitOfferDraft: ProjectCandidateCoreTraitDrafts['previousOptionalHighTierTraitOfferDraft'];
  readonly projectOptions: <T>(
    key: string,
    values: readonly T[],
    queries: readonly ProjectCandidateSessionQuery[],
  ) => readonly CandidateOptionProjection<T>[];
  readonly projectOptionsCooperatively: <T>(
    key: string,
    values: readonly T[],
    queries: readonly ProjectCandidateSessionQuery[],
  ) => Promise<readonly CandidateOptionProjection<T>[]>;
  readonly memoizeOptions: <T, Evaluation extends CandidateProjectionEvaluation>(
    key: string,
    project: () => readonly CandidateOptionProjection<T, Evaluation>[],
  ) => readonly CandidateOptionProjection<T, Evaluation>[];
}

type ProjectCandidateCoreTraitDrafts = Pick<
  import('@run-planner/engine/simulation').ProjectCandidateSession,
  | 'traitOfferStartingDraft'
  | 'nextOptionalHighTierTraitOfferDraft'
  | 'previousOptionalHighTierTraitOfferDraft'
>;

export function domainKey(values: readonly unknown[]): string {
  return JSON.stringify(values);
}

export function offerKey(value: unknown): string {
  return JSON.stringify(value);
}

export function candidateOptionEvaluation(
  evaluation: ProjectCandidateSessionEvaluation,
): CandidateProjectionEvaluation {
  if (
    evaluation.kind === 'traitAcquisitionTargetDomain' ||
    evaluation.kind === 'circeResolutionDomain' ||
    evaluation.kind === 'echoPomTargetDomain' ||
    evaluation.kind === 'naturalSelectionResult' ||
    evaluation.kind === 'ransomAssessment' ||
    evaluation.kind === 'steadyGrowthOutcome' ||
    evaluation.kind === 'transcendentEmbryoOutcome' ||
    evaluation.kind === 'echoLastRunBoonDomain' ||
    evaluation.kind === 'allTogetherSetDomain'
  ) {
    throw new Error('a target-domain aggregate cannot be projected as one candidate option');
  }
  return evaluation;
}

export function createCandidateProjectionCore(
  catalog: Catalog,
  options: CandidateSessionFactoryOptions,
): CandidateProjectionCoreFactory {
  const yieldToHost =
    options.yieldToHost ??
    (() =>
      new Promise((resolve) => {
        setTimeout(resolve, 0);
      }));
  const boundCores = new WeakMap<ProjectEvaluationAssembly, CandidateProjectionCore>();

  return {
    bind: (assembly) => {
      const existing = boundCores.get(assembly);
      if (existing !== undefined) return existing;
      const evaluator = createPreparedProjectCandidateSession(
        catalog,
        assembly,
        options.observeCandidateEvaluation === undefined
          ? {}
          : { observe: options.observeCandidateEvaluation },
      );
      const optionsCache = new Map<
        string,
        readonly CandidateOptionProjection<unknown, CandidateProjectionEvaluation>[]
      >();
      const projectOptions = <T>(
        key: string,
        values: readonly T[],
        queries: readonly ProjectCandidateSessionQuery[],
      ): readonly CandidateOptionProjection<T>[] => {
        const existingOptions = optionsCache.get(key);
        if (existingOptions !== undefined) {
          return existingOptions as readonly CandidateOptionProjection<T>[];
        }
        const evaluations = evaluator.evaluate(queries);
        const projected = Object.freeze(
          values.map((value, index) => {
            const evaluation = evaluations[index];
            if (evaluation === undefined) {
              throw new Error(`candidate projection ${key} omitted value ${index}`);
            }
            return Object.freeze({ value, evaluation: candidateOptionEvaluation(evaluation) });
          }),
        ) as readonly CandidateOptionProjection<T>[];
        optionsCache.set(key, projected);
        return projected;
      };
      const projectOptionsCooperatively = async <T>(
        key: string,
        values: readonly T[],
        queries: readonly ProjectCandidateSessionQuery[],
      ): Promise<readonly CandidateOptionProjection<T>[]> => {
        const cached = optionsCache.get(key);
        if (cached !== undefined) {
          return cached as readonly CandidateOptionProjection<T>[];
        }
        await yieldToHost();
        const existingOptions = optionsCache.get(key);
        if (existingOptions !== undefined) {
          return existingOptions as readonly CandidateOptionProjection<T>[];
        }
        const projected: CandidateOptionProjection<T, CandidateProjectionEvaluation>[] = [];
        for (const [index, query] of queries.entries()) {
          const evaluation = evaluator.evaluate([query])[0];
          if (evaluation === undefined) {
            throw new Error(`candidate projection ${key} omitted value ${index}`);
          }
          projected.push(
            Object.freeze({
              value: values[index]!,
              evaluation: candidateOptionEvaluation(evaluation),
            }),
          );
          if (index + 1 < queries.length) await yieldToHost();
        }
        const result = Object.freeze(projected) as readonly CandidateOptionProjection<T>[];
        optionsCache.set(key, result);
        return result;
      };
      const memoizeOptions = <T, Evaluation extends CandidateProjectionEvaluation>(
        key: string,
        project: () => readonly CandidateOptionProjection<T, Evaluation>[],
      ): readonly CandidateOptionProjection<T, Evaluation>[] => {
        const existingOptions = optionsCache.get(key);
        if (existingOptions !== undefined) {
          return existingOptions as readonly CandidateOptionProjection<T, Evaluation>[];
        }
        const projected = project();
        optionsCache.set(key, projected);
        return projected;
      };
      const core: CandidateProjectionCore = Object.freeze({
        catalog,
        assembly,
        evaluate: evaluator.evaluate,
        traitOfferStartingDraft: evaluator.traitOfferStartingDraft,
        nextOptionalHighTierTraitOfferDraft: evaluator.nextOptionalHighTierTraitOfferDraft,
        previousOptionalHighTierTraitOfferDraft: evaluator.previousOptionalHighTierTraitOfferDraft,
        projectOptions,
        projectOptionsCooperatively,
        memoizeOptions,
      });
      boundCores.set(assembly, core);
      return core;
    },
  };
}
