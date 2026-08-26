import type { Catalog } from '../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../authored-project/addresses';
import {
  countedBinding,
  processFocusedOfferAfterAuthoredPeers,
  processOfferGenerationCohort,
  type OfferProcessingContext,
  type OfferProcessingPeer,
} from '../processing';
import type { RewardProducerFrontier } from '../producer-frontiers';
import { rewardFinding } from '../findings';
import { addRewardFinding } from '../findings';
import { ownerRegion, type FindingRegionEntry } from '../../finding-regions';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import {
  createGenerationEmissions,
  type GenerationEmissions,
  type PendingHubBoardGeneration,
  type ResolvedHubBoardGenerationParticipant,
  type UnresolvedHubBoardGenerationParticipant,
} from './emissions';
import { historyFindingChronology } from '../finding-chronology';

/** Settles one complete Ephyra board without reaching into chronology-owned maps. */
export function flushHubBoard(
  catalog: Catalog,
  pending: PendingHubBoardGeneration | undefined,
): GenerationEmissions | undefined {
  if (pending === undefined || pending.participants.length === 0) return undefined;
  const findings = new Map<string, FindingRegionEntry>();
  const resolved = pending.participants.filter(
    (entry): entry is ResolvedHubBoardGenerationParticipant => entry.kind === 'resolved',
  );
  const unresolved = pending.participants.filter(
    (entry): entry is UnresolvedHubBoardGenerationParticipant => entry.kind === 'unresolved',
  );
  const branches =
    unresolved.length === 0
      ? processOfferGenerationCohort(
          pending.frontierBranches,
          Object.freeze(resolved.map((entry) => entry.context)),
          findings,
          { ordering: 'sourceOffers' },
        )
      : Object.freeze([]);
  for (const entry of unresolved)
    addRewardFinding(
      findings,
      rewardFinding('rewardMissing', entry.incoming.origin, {}),
      ownerRegion(entry.incoming.origin),
      Object.freeze({
        kind: 'hubBoard' as const,
        history: historyFindingChronology(entry.historySequence),
      }),
    );
  const owners = Object.freeze(pending.participants.map((entry) => entry.incoming.origin));
  const ownerKeys = new Set(owners.map(semanticAddressKey));
  const historySequence = Math.max(
    ...pending.participants.map((entry) =>
      entry.kind === 'resolved' ? entry.context.historySequence : entry.historySequence,
    ),
  );
  const evaluateOffer = (
    owner: SemanticAddress,
    offer: import('../../../reward-kernel').ResolvedRewardOffer,
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
    const candidateBranches = processFocusedOfferAfterAuthoredPeers(
      pending.frontierBranches,
      Object.freeze(
        contexts.filter((context) => semanticAddressKey(context.reward.origin) !== ownerKey),
      ),
      focused,
      candidateFindings,
    );
    return Object.freeze({
      findings: Object.freeze(
        [...candidateFindings.values()]
          .map((entry) => entry.finding)
          .filter((finding) => finding.code !== 'traitOfferMissing'),
      ),
      supported: candidateBranches.length > 0,
    });
  };
  const frontiers: RewardProducerFrontier[] = pending.participants.map((entry) =>
    Object.freeze({
      generationPolicy: 'jointUnordered' as const,
      generationHistorySequence: historySequence,
      reachableBranchCount: pending.frontierBranches.length,
      acquisitionHorizon: 'generationOnly' as const,
      owners: Object.freeze([entry.incoming.origin]),
      ...(entry.incoming.resolvedStoreKey === undefined
        ? {}
        : { resolvedStoreKey: entry.incoming.resolvedStoreKey }),
      evaluateOffer,
    }),
  );
  const peers: readonly OfferProcessingPeer[] = Object.freeze(
    resolved.map((entry) =>
      Object.freeze({ origin: entry.context.reward.origin, offer: entry.context.reward.offer }),
    ),
  );
  return createGenerationEmissions(branches, peers, findings, frontiers);
}
