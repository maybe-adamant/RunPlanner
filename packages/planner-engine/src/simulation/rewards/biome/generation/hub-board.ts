import type { Catalog } from '../../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../../authored-project/addresses';
import {
  countedBinding,
  processFocusedOfferInDrawOrder,
  processOfferGenerationCohort,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from '../../offer-generation';
import type { RewardProducerFrontier } from '../../producer-frontiers';
import { rewardFinding } from '../../findings';
import { addRewardFinding } from '../../findings';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import {
  createGenerationEmissions,
  type GenerationEmissions,
  type PendingHubBoardGeneration,
  type ResolvedHubBoardGenerationParticipant,
  type UnresolvedHubBoardGenerationParticipant,
} from './emissions';
import { historyFindingChronology } from '../finding-chronology';
import { hubBoardRewardAssignmentOrder } from './hub-board-order';

/** Settles one complete Ephyra board without reaching into chronology-owned maps. */
export function flushHubBoard(
  catalog: Catalog,
  pending: PendingHubBoardGeneration | undefined,
): GenerationEmissions | undefined {
  if (pending === undefined || pending.participants.length === 0) return undefined;
  const findings = new Map<string, FindingRegionEntry>();
  // Every draw, finding and focused assessment follows the game's assignment order.
  const drawn = hubBoardRewardAssignmentOrder(
    pending.participants.map((participant) => Object.freeze({ ...participant.door, participant })),
  ).map((door) => door.participant);
  const resolved = drawn.filter(
    (entry): entry is ResolvedHubBoardGenerationParticipant => entry.kind === 'resolved',
  );
  const unresolved = drawn.filter(
    (entry): entry is UnresolvedHubBoardGenerationParticipant => entry.kind === 'unresolved',
  );
  const drawOrder = drawn.map((entry) => semanticAddressKey(entry.incoming.origin));
  const drawPosition = (origin: SemanticAddress) => drawOrder.indexOf(semanticAddressKey(origin));
  const branch =
    unresolved.length === 0
      ? processOfferGenerationCohort(
          pending.frontier,
          Object.freeze(resolved.map((entry) => entry.context)),
          findings,
        )
      : undefined;
  const historySequence = Math.max(
    ...pending.participants.map((entry) =>
      entry.kind === 'resolved' ? entry.context.historySequence : entry.historySequence,
    ),
  );
  // Rewards are drawn once every door exists, so missing ones share that position in draw order.
  for (const entry of unresolved)
    addRewardFinding(
      findings,
      rewardFinding('rewardMissing', entry.incoming.origin, {}),
      ownerRegion(entry.incoming.origin),
      Object.freeze({
        kind: 'hubBoard' as const,
        history: historyFindingChronology(historySequence),
      }),
    );
  const owners = Object.freeze(pending.participants.map((entry) => entry.incoming.origin));
  const ownerKeys = new Set(owners.map(semanticAddressKey));
  const evaluateOffer = (
    owner: SemanticAddress,
    offer: import('../../../../reward-kernel').ResolvedRewardOffer,
  ) => {
    const ownerKey = semanticAddressKey(owner);
    if (!ownerKeys.has(ownerKey))
      throw new BiomeRewardSimulationContractError('Hub-board frontier received a foreign owner');
    const contexts = Object.freeze(
      pending.participants.flatMap((entry): readonly OfferProcessingContext[] => {
        const focused = semanticAddressKey(entry.incoming.origin) === ownerKey;
        if (entry.kind === 'unresolved') {
          if (!focused) return Object.freeze([]);
          const incoming = entry.candidateFor(offer);
          const binding = countedBinding(entry.declaration, incoming);
          return Object.freeze([
            Object.freeze({
              catalog,
              reward: incoming,
              ...(binding === undefined ? {} : { binding }),
              historySequence: entry.historySequence,
              peers: Object.freeze([]),
              facts: entry.facts,
            }),
          ]);
        }
        return Object.freeze([
          Object.freeze({
            ...entry.context,
            reward: focused ? Object.freeze({ ...entry.incoming, offer }) : entry.incoming,
          }),
        ]);
      }),
    );
    const focused = contexts.find(
      (context) => semanticAddressKey(context.reward.origin) === ownerKey,
    );
    if (focused === undefined)
      throw new BiomeRewardSimulationContractError('Hub-board frontier lost its focused context');
    const candidateFindings = new Map<string, FindingRegionEntry>();
    const focusedPosition = drawPosition(owner);
    const peersDrawn = (side: (position: number) => boolean) =>
      Object.freeze(
        contexts
          .filter((context) => side(drawPosition(context.reward.origin)))
          .sort(
            (left, right) => drawPosition(left.reward.origin) - drawPosition(right.reward.origin),
          ),
      );
    const focusedResult = processFocusedOfferInDrawOrder(
      pending.frontier,
      {
        earlier: peersDrawn((position) => position < focusedPosition),
        later: peersDrawn((position) => position > focusedPosition),
      },
      focused,
      candidateFindings,
    );
    return Object.freeze({
      findings: Object.freeze(
        [...candidateFindings.values()]
          .map((entry) => entry.finding)
          .filter((finding) => finding.code !== 'traitOfferMissing'),
      ),
      supported: focusedResult.branch !== undefined,
      ...(focusedResult.exclusions === undefined ? {} : { exclusions: focusedResult.exclusions }),
    });
  };
  const frontiers: RewardProducerFrontier[] = pending.participants.map((entry) =>
    Object.freeze({
      generationPolicy: 'nativeDoorOrder' as const,
      generationHistorySequence: historySequence,
      acquisitionHorizon: 'generationOnly' as const,
      owners: Object.freeze([entry.incoming.origin]),
      ...(entry.incoming.resolvedStoreKey === undefined
        ? {}
        : { resolvedStoreKey: entry.incoming.resolvedStoreKey }),
      evaluateOffer,
    }),
  );
  const peers: readonly OfferProcessingPeer[] = Object.freeze(
    pending.participants.flatMap((entry) =>
      entry.kind === 'resolved'
        ? [
            Object.freeze({
              origin: entry.context.reward.origin,
              offer: entry.context.reward.offer,
            }),
          ]
        : [],
    ),
  );
  return createGenerationEmissions(branch, peers, findings, frontiers);
}
