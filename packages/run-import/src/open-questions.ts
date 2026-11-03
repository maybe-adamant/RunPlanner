import {
  createBiomeAddress,
  createExitDecisionAddress,
  NEMESIS_RANDOM_EVENT_FAMILIES,
  shopOfferOptionValues,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  type NemesisRandomEventAddress,
  type ProjectCommand,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  levelResolutionCandidateForProjectEvaluationAssembly,
  nemesisRandomEventCandidateSupportForProjectEvaluationAssembly,
  type SemanticFinding,
} from '@run-planner/engine/simulation';
import { isQuestionFinding } from './areas';
import { carrierChildAnswers } from './carrier-children';
import { countedCageOutcome } from './fields';
import type { RunImportContext } from './import';
import { nemesisEventOf } from './nemesis';
import { authoredOccurrence } from './occurrences';
import { searchRoom } from './room-search';

/*
 * A question the record does not answer: the engine-legal answers its domain
 * holds are each authored on a probe and judged at the room's next entry save.
 * The first the save accepts is authored; without one the question stays open.
 * Domains: a Shop slot's or refill's options, a Fields cage roll, a batch
 * store, a fountain, Steady Growth or random level-up target, a Fields point,
 * Nemesis's family and interaction, and a carrier child's values.
 */

type Origin<K extends SemanticAddress['kind']> = Extract<SemanticAddress, { readonly kind: K }>;

/** The accepted answer's commands and whether other answers were accepted as well. */
export interface AcceptedAnswer {
  readonly commands: readonly ProjectCommand[];
  readonly alternatives: readonly ProjectCommand[];
}

export function answerByAcceptance(
  context: RunImportContext,
  reason: SemanticFinding,
): AcceptedAnswer | undefined {
  const roomIndex = context.occurrences.locationOf(reason.origin)?.roomIndex;
  if (roomIndex === undefined) return undefined;
  return authorAcceptedAnswer(context, roomIndex, candidateAnswers(context, reason));
}

/**
 * Authors the first candidate the room's next entry save accepts, each
 * candidate's later questions in any room answered until that save is
 * reached; undefined, authoring nothing, when none is accepted.
 */
export function authorAcceptedAnswer(
  context: RunImportContext,
  roomIndex: number,
  candidates: Iterable<readonly ProjectCommand[]>,
): AcceptedAnswer | undefined {
  const search = searchRoom(context, {
    roomIndex,
    candidates,
    settles: 'all',
    sweep: true,
    author: (commands: readonly ProjectCommand[]) =>
      commands.every((command) => context.apply(command)) ? commands : undefined,
  });
  const accepted = search.fits.filter((fit) => fit.accepted);
  const chosen = accepted[0]?.choice;
  if (
    chosen === undefined ||
    !context.transaction(() => chosen.every((command) => context.apply(command)))
  )
    return undefined;
  return { commands: chosen, alternatives: accepted.slice(1).flatMap((fit) => fit.choice) };
}

/** Each engine-legal answer to the question, as the commands that author it, in domain order. */
function* candidateAnswers(
  context: RunImportContext,
  reason: SemanticFinding,
): Generator<readonly ProjectCommand[]> {
  const origin = reason.origin;
  if (origin.kind === 'shopOffer') yield* shopOfferAnswers(context, origin);
  else if (origin.kind === 'exitDecision' && reason.code === 'batchStateMissing')
    // A roll the Max counter pins is never searched: the record already answered it.
    for (const cageOutcome of origin.source.kind === 'occurrence' &&
    countedCageOutcome(context, origin.source.occurrenceId) !== undefined
      ? []
      : (['min', 'max'] as const))
      yield [
        {
          kind: 'InitializeExitDecision',
          decision: origin,
          edit: { kind: 'fieldsCageOutcome', cageOutcome },
        },
      ];
  else if (origin.kind === 'batchRewardStore')
    for (const store of context.catalog.rewards.stores.values)
      yield [
        {
          kind: 'InitializeExitDecision',
          decision: createExitDecisionAddress(
            createBiomeAddress(origin.routeKey, origin.biomeKey),
            origin.source,
          ),
          edit: { kind: 'rewardStore', storeKey: store.key },
        },
      ];
  else if (origin.kind === 'fountainRarityOutcome') {
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'fountainRarityOutcome', outcome: origin, targetTraitKey: undefined });
    if (evaluation.kind !== 'fountainRarityOutcome') return;
    const targets: (string | null)[] = [
      ...(evaluation.result.targetRequired ? [] : [null]),
      ...evaluation.result.mutationTargetKeys,
    ];
    for (const targetTraitKey of targets)
      yield [{ kind: 'ReplaceFountainRarityTarget', outcome: origin, targetTraitKey }];
  } else if (origin.kind === 'steadyGrowthOutcome') {
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'steadyGrowthOutcome', outcome: origin, targetTraitKey: undefined });
    if (evaluation.kind !== 'steadyGrowthOutcome') return;
    const targets: (string | null)[] = [
      ...(evaluation.result.emptyNoOp ? [null] : []),
      ...evaluation.result.eligibleTargetKeys,
    ];
    for (const targetTraitKey of targets)
      yield [{ kind: 'ReplaceSteadyGrowthTarget', outcome: origin, targetTraitKey }];
  } else if (origin.kind === 'fieldsSpatial') {
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'fieldsSpatialPoint', spatial: origin, pointId: null });
    if (evaluation.kind !== 'fieldsSpatialPoint') return;
    for (const pointId of evaluation.result.supportPointIds)
      yield [{ kind: 'ReplaceFieldsSpatialPoint', spatial: origin, pointId }];
  } else if (origin.kind === 'levelResolution') {
    const capability = levelResolutionCandidateForProjectEvaluationAssembly(
      context.assembly(),
      origin,
    );
    // A level-up screen's offered rows are unknown; only a random target is a domain.
    if (capability?.surface.effectKind !== 'random') return;
    for (const trait of context.catalog.traits.values) {
      const value = { kind: 'random', targetTraitKey: trait.key } as const;
      if (capability.evaluate(value).supported)
        yield [{ kind: 'ReplaceLevelResolution', levelResolution: origin, value }];
    }
  } else if (reason.code.startsWith('nemesis') || origin.kind === 'nemesisRandomEvent') {
    const event = nemesisEventOf(context, origin);
    if (event !== undefined) yield* nemesisAnswers(context, event);
  } else yield* carrierChildAnswers(context, reason);
}

/** A Shop slot's or Travel Deal refill's options the engine admits there. */
function* shopOfferAnswers(
  context: RunImportContext,
  offer: Origin<'shopOffer'>,
): Generator<readonly ProjectCommand[]> {
  const occurrence = authoredOccurrence(
    context.assembly().project,
    offer.biomeKey,
    offer.occurrenceId,
  );
  const shop = occurrence?.state.kind === 'shop' ? occurrence.state.shop : undefined;
  const profile =
    shop === undefined ? undefined : context.catalog.rewards.shops.byKey[shop.profileKey];
  if (shop === undefined || profile === undefined) return;
  // A refill restocks from any slot's options.
  const slotKeys =
    offer.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
      ? profile.slots.values.map((slot) => slot.key)
      : [offer.offerKey];
  const seen = new Set<string>();
  for (const slotKey of slotKeys)
    for (const value of shopOfferOptionValues(context.catalog, shop.profileKey, slotKey)) {
      const key = JSON.stringify(value);
      if (seen.has(key)) continue;
      seen.add(key);
      const evaluation = context.candidates().evaluate({ kind: 'shopOfferOption', offer, value });
      if (
        evaluation.kind === 'shopOffer' &&
        evaluation.result.supported &&
        evaluation.result.findings.every(isQuestionFinding)
      )
        yield [{ kind: 'ReplaceShopOfferOption', offer, value }];
    }
}

type Interaction = Extract<
  ProjectCommand,
  { readonly kind: 'ReplaceNemesisRandomEventInteraction' }
>['value'];

/**
 * Nemesis's event: each family the room admits, with each interaction and
 * reward the engine's support lists for it once the family is selected.
 */
function* nemesisAnswers(
  context: RunImportContext,
  event: NemesisRandomEventAddress,
): Generator<readonly ProjectCommand[]> {
  const selected = authoredOccurrence(
    context.assembly().project,
    event.biomeKey,
    event.encounter.owner.occurrenceId,
  )?.encounters.nemesisRandomEventByPhase?.[event.encounter.phaseKey]?.kind;
  // A selected family keeps its selection; only its interaction is open.
  for (const family of selected === undefined ? NEMESIS_RANDOM_EVENT_FAMILIES : [selected]) {
    const select: readonly ProjectCommand[] =
      selected === undefined ? [{ kind: 'SelectNemesisRandomEventFamily', event, family }] : [];
    const values = context.probe((): readonly Interaction[] => {
      if (!select.every((command) => context.apply(command))) return [];
      const support = nemesisRandomEventCandidateSupportForProjectEvaluationAssembly(
        context.assembly(),
        event,
      );
      const branch = support?.assessment;
      if (support === undefined || branch === undefined) return [];
      const rewards = (types: readonly string[]) =>
        types.length === 0 ? [null] : types.map((rewardType) => ({ rewardType }));
      switch (family) {
        case 'freeItem':
          return rewards(branch.freeItemRewardTypes).map((reward) => ({
            kind: 'freeItem' as const,
            reward,
          }));
        case 'goldTrade':
          return support.goldTradeResponses.flatMap((response) =>
            rewards(branch.goldTradeRewardTypes).map((reward) => ({
              kind: 'goldTrade' as const,
              response,
              reward,
            })),
          );
        case 'damageTrade':
          return support.damageTradeResponses.flatMap((response) =>
            rewards(branch.damageTradeRewardTypes).map((reward) => ({
              kind: 'damageTrade' as const,
              response,
              reward,
            })),
          );
        case 'traitTrade':
          return support.traitTradeResponses.flatMap((response) =>
            (branch.traitTradeTraitKeys.length === 0 ? [null] : branch.traitTradeTraitKeys).map(
              (traitKey) => ({
                kind: 'traitTrade' as const,
                traitKey,
                response,
                reward: { rewardType: support.traitTradeRewardType },
              }),
            ),
          );
        case 'damageContest':
          return [
            {
              kind: 'damageContest' as const,
              result: 'failure' as const,
              reward: { rewardType: support.damageContestFailureRewardType },
            },
            ...branch.damageContestSuccessRewardTypes.map((rewardType) => ({
              kind: 'damageContest' as const,
              result: 'success' as const,
              reward: { rewardType },
            })),
          ];
      }
      return [];
    });
    for (const value of values)
      yield [...select, { kind: 'ReplaceNemesisRandomEventInteraction', event, value }];
  }
}
