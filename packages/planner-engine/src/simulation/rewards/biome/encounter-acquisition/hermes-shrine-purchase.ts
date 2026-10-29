import type { Catalog, RoomDeclaration } from '../../../../catalog-schema';
import {
  createBiomeAddress,
  createRoomFeatureAddress,
  createTravelDealRefillRealizationAddress,
} from '../../../../authored-project/addresses';
import {
  firstRushedInitialPurchase,
  hermesShrineDeliveryEntryKey,
} from '../../../../authored-project/hermes-shrine-delivery';
import type { HermesShrineGenerationKey } from '../../../../authored-project/model';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import type { PendingHermesShrineDelivery } from '../../../state/model';
import {
  assessHermesShrineTravelDealRefill,
  type HermesShrineTravelDealRefillAssessment,
} from '../../../commerce/hermes-shrine';
import { ownerRegion, type FindingRegionEntry } from '../../../finding-regions';
import type { PlannerTimelineFacts } from '../../../timeline-facts';
import { spawnDueHermesDeliveries } from '../offer-lifecycle/spawned-trait-offers';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { RewardBranchState } from '../../branch-primitives';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { createBiomeRewardFacts } from '../../facts';
import { addRewardFinding, rewardFinding } from '../../findings';

export interface HermesShrinePurchaseReachedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  /** Published when this rush realizes the room's Travel Deal refill. */
  readonly travelDealRefillAssessments?: readonly HermesShrineTravelDealRefillAssessment[];
  readonly timelineFacts?: PlannerTimelineFacts;
}

/** One pending Shrine delivery keyed by its entry; a rush is due in this room. */
export function pendingHermesShrineDelivery(
  room: CanonicalAuthoredRoom,
  generationKey: HermesShrineGenerationKey,
  rewardType: string,
  purchase: { readonly delay: number; readonly rushed: boolean },
  historySequence: number,
): readonly [string, PendingHermesShrineDelivery] {
  const entryKey = hermesShrineDeliveryEntryKey(room.origin, generationKey);
  return [
    entryKey,
    Object.freeze({
      entryKey,
      source: room.origin,
      generationKey,
      rewardType,
      rushed: purchase.rushed,
      remainingUses: purchase.delay,
      ...(purchase.rushed
        ? {
            due: Object.freeze({
              host: room.origin,
              cause: 'rush' as const,
              historySequence,
            }),
          }
        : {}),
    }),
  ] as const;
}

function supportedRefill(
  room: CanonicalAuthoredRoom,
  assessments: readonly HermesShrineTravelDealRefillAssessment[],
  branchCount: number,
): boolean {
  const offer = room.hermesShrine?.travelDealRefill?.offer;
  return (
    offer !== undefined &&
    offer !== null &&
    assessments.length === branchCount &&
    assessments.every((assessment) => assessment.candidateRewardTypes.includes(offer.rewardType))
  );
}

/**
 * Settles one ranked Shrine purchase. The first rushed initial purchase made
 * while every branch holds Travel Deal refills its slot (`FirstSpeedUpPurchase`);
 * a rush without the trait leaves the refill available to a later rush.
 */
export function applyHermesShrinePurchaseReachedTransition(inputs: {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'hermesShrinePurchaseReached' }>;
  readonly room: CanonicalAuthoredRoom | undefined;
  readonly declaration: RoomDeclaration | undefined;
  readonly roomView: ProgressiveRoomHistoryViews | undefined;
  readonly branches: readonly RewardBranchState[];
  /** The room's refill domain when an earlier rush already realized it. */
  readonly realized: readonly HermesShrineTravelDealRefillAssessment[] | undefined;
}): HermesShrinePurchaseReachedTransition {
  const { catalog, snapshot, event, room, declaration, roomView, branches, realized } = inputs;
  if (room === undefined || declaration === undefined || roomView === undefined)
    throw new BiomeRewardSimulationContractError('Shrine purchases have no authored room');
  const shrine = room.hermesShrine;
  const findings = new Map<string, FindingRegionEntry>();
  const addFinding = (
    kind: Parameters<typeof rewardFinding>[0],
    origin: Parameters<typeof rewardFinding>[1],
    detail: Parameters<typeof rewardFinding>[2],
  ) =>
    addRewardFinding(
      findings,
      rewardFinding(kind, origin, detail),
      ownerRegion(origin),
      rewardFindingChronologyForRoom(snapshot, room.origin, event.sequence, 'localRoomLifecycle'),
    );
  const unchanged = () => Object.freeze({ branches, findings: Object.freeze([]) });

  if (event.generationKey === 'travelDealRefill') {
    const offer = shrine?.travelDealRefill?.offer;
    const row = room.roomActionRoster.rows.find(
      (candidate) =>
        candidate.rank !== null &&
        candidate.reference.kind === 'purchaseHermesShrineOffer' &&
        candidate.reference.generationKey === 'travelDealRefill',
    );
    if (row === undefined) return unchanged();
    // Before a rush made with Travel Deal the purchased refill does not exist yet.
    if (realized === undefined) {
      addFinding('hermesShrineTravelDealRefillUnavailable', row.owner, {
        generationKey: 'travelDealRefill',
        reason:
          firstRushedInitialPurchase(
            room.roomActionRoster.rows.flatMap((ranked) =>
              ranked.rank === null ? [] : [ranked.reference],
            ),
          ) === undefined
            ? 'noRushedPurchase'
            : 'travelDealInactive',
      });
      return Object.freeze({ branches, findings: Object.freeze([...findings.values()]) });
    }
    if (offer === undefined || offer === null || !supportedRefill(room, realized, branches.length))
      return unchanged();
    const [key, delivery] = pendingHermesShrineDelivery(
      room,
      'travelDealRefill',
      offer.rewardType,
      { delay: offer.delay, rushed: event.rushed },
      event.sequence,
    );
    return Object.freeze({
      branches: Object.freeze(
        branches.map((branch) =>
          spawnDueHermesDeliveries(
            catalog,
            room,
            Object.freeze({
              ...branch,
              state: Object.freeze({
                ...branch.state,
                pendingHermesShrineDeliveries: Object.freeze({
                  ...branch.state.pendingHermesShrineDeliveries,
                  [key]: delivery,
                }),
              }),
            }),
            event.sequence,
          ),
        ),
      ),
      findings: Object.freeze([]),
    });
  }

  if (
    !event.rushed ||
    realized !== undefined ||
    shrine === undefined ||
    !branches.every((branch) => branch.state.traitHistory.equippedTraits.RestockBoon !== undefined)
  )
    return unchanged();
  const view = roomView.preOutgoing ?? roomView.entry;
  const assessments = Object.freeze(
    branches.flatMap((branch) => {
      const assessment = assessHermesShrineTravelDealRefill(catalog, shrine, event.generationKey, [
        createBiomeRewardFacts({
          catalog,
          state: branch.state,
          source: room,
          currentRoom: room,
          sourceDeclaration: declaration,
          view,
          hubBoardLookups: 'consulted',
        }).requirements,
      ]);
      return assessment === undefined ? [] : [assessment];
    }),
  );
  const offer = shrine.travelDealRefill?.offer;
  const supported = supportedRefill(room, assessments, branches.length);
  const feature = createRoomFeatureAddress(room.origin, {
    kind: 'hermesShrineOffer',
    generationKey: 'travelDealRefill',
  });
  if (offer === undefined || offer === null)
    addFinding('hermesShrineTravelDealRefillMissing', feature, {
      generationKey: event.generationKey,
    });
  else if (!supported)
    addFinding('hermesShrineTravelDealRefillUnavailable', feature, {
      generationKey: event.generationKey,
      rewardType: offer.rewardType,
    });
  return Object.freeze({
    branches,
    findings: Object.freeze([...findings.values()]),
    travelDealRefillAssessments: assessments,
    ...(supported
      ? {
          timelineFacts: Object.freeze({
            nodes: Object.freeze([
              Object.freeze({
                owner: createTravelDealRefillRealizationAddress(
                  createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
                  room.occurrenceId,
                ),
                included: true,
              }),
            ]),
            dependencies: Object.freeze([]),
          }),
        }
      : {}),
  });
}
