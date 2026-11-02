import {
  createTraitOfferAddress,
  semanticAddressKey,
  type LevelResolutionAddress,
  type SemanticAddress,
  type TraitOfferAddress,
  type TraitOfferOwnerAddress,
} from '../../../authored-project/addresses';
import type { AuthoredEchoLastRunBoonOffer } from '../../../authored-project/traits/state';
import type { Catalog } from '../../../catalog-schema';
import type { RewardBranchState } from '../branch-primitives';
import type {
  ReachedLevelResolutionEvaluation,
  ReachedTraitOfferEvaluation,
  SelectedLevelResolutionAssessment,
  SelectedTraitOfferAssessment,
  TraitOfferCandidateContext,
} from '../../traits';
import { echoLastRunBoonOutcomes, traitOfferAssessmentIdentity } from '../../traits';
import { orderRandomArcanaSelection } from '../../arcana-fear';
import { traitScreenExpectation } from '../trait-settlement/screen-expectation';
import type { LevelResolutionCandidateContext } from '../../candidates/trait-offer/capability';
import { BiomeRewardSimulationContractError } from './biome-contract';

export interface SelectedTraitOfferProducts {
  readonly selectedTraitOffers: readonly SelectedTraitOfferAssessment[];
  readonly selectedLevelResolutions: readonly SelectedLevelResolutionAssessment[];
  readonly candidateContexts: ReadonlyMap<string, TraitOfferCandidateContext>;
  readonly levelCandidateContexts: ReadonlyMap<string, LevelResolutionCandidateContext>;
}

function traitOwnerAddress(origin: SemanticAddress): TraitOfferOwnerAddress | undefined {
  switch (origin.kind) {
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'infernalContractPedestal':
    case 'encounterPhase':
    case 'gorgonPhase':
    case 'acquisitionEntry':
      return origin;
    default:
      return undefined;
  }
}

/** Freezes reached trait and level products after chronological evaluation completes. */
export function selectedTraitOfferProducts(
  branches: readonly RewardBranchState[],
  retainedLevelEvaluations: readonly ReachedLevelResolutionEvaluation[] = Object.freeze([]),
  catalog?: Catalog,
): SelectedTraitOfferProducts {
  const grouped = new Map<
    string,
    {
      readonly address: TraitOfferAddress;
      readonly acquisitionRole: string;
      readonly offer: ReachedTraitOfferEvaluation['offer'];
      readonly trace: ReachedTraitOfferEvaluation;
      chronologicalIndex: number;
    }
  >();
  for (const branch of branches) {
    for (const trace of branch.traitEvaluations ?? []) {
      const owner = traitOwnerAddress(trace.address);
      if (owner === undefined) {
        continue;
      }
      const address = createTraitOfferAddress(owner, trace.acquisitionRole);
      const key = semanticAddressKey(address);
      const current = grouped.get(key);
      if (current === undefined) {
        grouped.set(key, {
          address,
          acquisitionRole: trace.acquisitionRole,
          offer: trace.offer,
          trace,
          chronologicalIndex: trace.chronologicalIndex,
        });
      } else {
        if (
          JSON.stringify(traitOfferAssessmentIdentity(trace)) !==
          JSON.stringify(traitOfferAssessmentIdentity(current.trace))
        )
          throw new BiomeRewardSimulationContractError(
            `trait offer ${key} was assessed at two different states`,
          );
        current.chronologicalIndex = Math.min(current.chronologicalIndex, trace.chronologicalIndex);
      }
    }
  }
  const selectedTraitOffers = Object.freeze(
    [...grouped.values()]
      .sort(
        (left, right) =>
          left.chronologicalIndex - right.chronologicalIndex ||
          semanticAddressKey(left.address).localeCompare(semanticAddressKey(right.address)),
      )
      .map((entry) =>
        Object.freeze({
          address: entry.address,
          acquisitionRole: entry.acquisitionRole,
          offer: entry.offer,
          assessment: ((trace) =>
            Object.freeze({
              assessments: trace.assessments,
              ...(trace.generation === undefined ? {} : { generation: trace.generation }),
              composition: trace.composition,
              targetedAcquisition: trace.targetedAcquisition,
              persephoneLevelBonusMaximums: Object.freeze(
                trace.levelResolutions.map((resolution) => resolution.persephoneLevelBonusMaximum),
              ),
              persephoneBaseLevels: Object.freeze(
                trace.levelResolutions.map((resolution) => resolution.persephoneBaseLevel),
              ),
              jeweledPomLevels: Object.freeze(
                trace.levelResolutions.map((resolution) => resolution.jeweledPomLevels),
              ),
              effectiveLevels: Object.freeze(
                trace.levelResolutions.map((resolution) => resolution.effectiveLevel),
              ),
              baseRarities: trace.baseRarities,
              ...(trace.rerolledScreenBaseRarities === undefined
                ? {}
                : { rerolledScreenBaseRarities: trace.rerolledScreenBaseRarities }),
              ...(trace.rerolledScreens === undefined
                ? {}
                : { rerolledScreens: trace.rerolledScreens }),
              ...(() => {
                const screenExpectation =
                  catalog === undefined ? undefined : traitScreenExpectation(catalog, trace);
                return screenExpectation === undefined ? {} : { screenExpectation };
              })(),
              ...(() => {
                if (trace.offer.kind !== 'traits' || catalog === undefined) return {};
                const selected =
                  trace.offer.options[Number(trace.offer.selectedOptionKey.slice(-1)) - 1];
                const resolution = selected?.circeResolution;
                if (resolution?.kind !== 'activateArcana') return {};
                return {
                  orderedCirceActivationKeys: orderRandomArcanaSelection(
                    catalog,
                    trace.state.arcanaFear.arcana.active.map((card) => card.key),
                    resolution.arcanaKeys,
                  ),
                };
              })(),
              ...(() => {
                if (trace.offer.kind !== 'traits') return {};
                const selected =
                  trace.offer.options[Number(trace.offer.selectedOptionKey.slice(-1)) - 1];
                const child = selected?.echoLastRunBoon;
                if (
                  selected?.traitKey !== 'EchoLastRunBoon' ||
                  child === undefined ||
                  catalog === undefined
                )
                  return {};
                const outcomes = echoLastRunBoonOutcomes(catalog, trace.state, trace.source);
                const resolveOption = (option: AuthoredEchoLastRunBoonOffer['options'][number]) => {
                  const outcome = outcomes.find(
                    (candidate) =>
                      candidate.option.giverKey === option.giverKey &&
                      candidate.option.traitKey === option.traitKey &&
                      candidate.option.rarity === option.rarity,
                  );
                  const variant =
                    catalog.echoLastRunBoon.variants.byKey[`${option.giverKey}:${option.traitKey}`];
                  return Object.freeze({
                    ...option,
                    rarity: outcome?.effectiveRarity ?? option.rarity,
                    ...(variant?.lootHistorySource === undefined
                      ? {}
                      : { lootHistorySource: variant.lootHistorySource }),
                  });
                };
                const first = resolveOption(child.options[0]);
                const second = child.options[1];
                const third = child.options[2];
                const options =
                  second === undefined
                    ? Object.freeze([first])
                    : third === undefined
                      ? Object.freeze([first, resolveOption(second)])
                      : Object.freeze([first, resolveOption(second), resolveOption(third)]);
                return {
                  effectiveEchoLastRunBoon: Object.freeze({
                    options,
                    selectedOptionKey: child.selectedOptionKey,
                    rarityFloor: trace.state.traitHistory.properUpbringingActive === true,
                  }),
                };
              })(),
              ...(trace.settledHexTree === undefined
                ? {}
                : { settledHexTree: trace.settledHexTree }),
            }))(entry.trace),
          reached: true as const,
          chronologicalIndex: entry.chronologicalIndex,
        }),
      ),
  );
  const candidateContexts = new Map<string, TraitOfferCandidateContext>();
  for (const entry of grouped.values()) {
    const address = createTraitOfferAddress(entry.address.owner, entry.acquisitionRole);
    candidateContexts.set(
      semanticAddressKey(address),
      Object.freeze({
        state: entry.trace.state,
        generationState: entry.trace.generationState,
        source: entry.trace.source,
      }),
    );
  }
  const levels = new Map<
    string,
    {
      address: LevelResolutionAddress;
      value: ReachedLevelResolutionEvaluation['value'];
      trace: ReachedLevelResolutionEvaluation;
      chronologicalIndex: number;
    }
  >();
  for (const trace of [
    ...branches.flatMap((branch) => branch.levelResolutionEvaluations ?? []),
    ...retainedLevelEvaluations,
  ]) {
    const key = semanticAddressKey(trace.address);
    const current = levels.get(key);
    if (current === undefined)
      levels.set(key, {
        address: trace.address,
        value: trace.value,
        trace,
        chronologicalIndex: trace.chronologicalIndex,
      });
    else if (
      JSON.stringify([current.trace.before, current.trace.value]) !==
      JSON.stringify([trace.before, trace.value])
    )
      throw new BiomeRewardSimulationContractError(
        `level resolution ${key} was assessed at two different states`,
      );
  }
  const selectedLevelResolutions = Object.freeze(
    [...levels.values()]
      .sort((left, right) => left.chronologicalIndex - right.chronologicalIndex)
      .map((entry) =>
        Object.freeze({
          address: entry.address,
          value: entry.value,
          assessment: Object.freeze({
            findings: entry.trace.findings,
            levelCount: entry.trace.levelCount,
            emptyTargetAllowed: entry.trace.emptyTargetAllowed,
            eligibleTargetCount: entry.trace.before.upgradableTraitCount,
          }),
          reached: true as const,
          chronologicalIndex: entry.chronologicalIndex,
        }),
      ),
  );
  const levelCandidateContexts = new Map<string, LevelResolutionCandidateContext>();
  for (const [key, { trace }] of levels) {
    levelCandidateContexts.set(
      key,
      Object.freeze({
        address: trace.address,
        before: trace.before,
        levelCount: trace.levelCount,
        effectKind: trace.effectKind,
        ...(trace.emptyTargetAllowed ? { emptyTargetAllowed: true } : {}),
      }),
    );
  }
  return Object.freeze({
    selectedTraitOffers,
    selectedLevelResolutions,
    candidateContexts,
    levelCandidateContexts,
  });
}
