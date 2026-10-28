import type { Catalog } from '../../../../catalog-schema';
import {
  createBiomeAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  createTravelDealRefillRealizationAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import { roomActionKey } from '../../../../authored-project/room-actions/state';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../../materialization';
import { findingRegion, type FindingRegionEntry } from '../../../finding-regions';
import {
  applyConcreteAcquisition,
  creditItemArmor,
  creditMaxStatGain,
} from '../../../../reward-kernel';
import {
  stygianWellGenerationItemKey,
  stygianWellGenerationTwistResultKey,
} from '../../../../authored-project/feature-rolls';
import type { StygianWellSlotKey } from '../../../../authored-project/model';
import {
  applyStygianWellPurchase,
  assessStygianWellPurchase,
  extendedWellItemKeys,
  stygianWellGrant,
  type StygianWellCandidateContext,
} from '../../../commerce/stygian-well';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { rewardFinding } from '../../findings';
import type { RewardBranchState } from '../../branch-primitives';
import type { PlannerTimelineFacts } from '../../../timeline-facts';
import type { WellRefillRealization } from '../../model';

export interface WellPurchaseTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly timelineFacts: PlannerTimelineFacts;
  readonly refillRealization?: WellRefillRealization;
  readonly candidateContexts: readonly StygianWellCandidateContext[];
}

/** Applies one reached Stygian Well purchase. */
export function applyWellPurchaseTransition(inputs: {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'wellPurchase' }>;
  readonly room: CanonicalAuthoredRoom | CanonicalHubRoom | undefined;
  readonly branches: readonly RewardBranchState[];
  readonly refillGenerationSupported: boolean;
  /** Where the purchase stands against the Well's rolls at its point. */
  readonly roll: {
    /** Why the bought slot is not on show; the purchase then has no effect. */
    readonly refused?: 'missing' | 'replaced' | 'notReached' | 'slotNotOffered';
    /** Present for the room's first purchase from a roll slot. */
    readonly firstPurchase?: {
      readonly slotKey: StygianWellSlotKey;
      /** The items the roll shows when it is bought. */
      readonly rollItemKeys: readonly string[];
    };
  };
}): WellPurchaseTransition {
  const { catalog, snapshot, event, room } = inputs;
  const authoredRoom = room?.kind === 'authored' ? room : undefined;
  const well = authoredRoom?.stygianWell;
  const itemKey =
    authoredRoom === undefined
      ? undefined
      : stygianWellGenerationItemKey(wellOccurrenceView(authoredRoom), event.generationKey);
  const row =
    room?.kind === 'authored'
      ? room.roomActionRoster.rows.find(
          (candidate) =>
            !candidate.stale &&
            candidate.rank !== null &&
            candidate.reference.kind === 'purchaseStygianWellOffer' &&
            candidate.reference.generationKey === event.generationKey,
        )
      : undefined;
  const effect = authoredRoom?.stygianWellOfferEffects?.[event.generationKey];
  const activeWellRows =
    authoredRoom === undefined
      ? []
      : authoredRoom.roomActionRoster.rows
          .filter(
            (candidate) =>
              !candidate.stale &&
              candidate.rank !== null &&
              candidate.reference.kind === 'purchaseStygianWellOffer',
          )
          .sort((left, right) => left.rank! - right.rank!);
  const refillItemKey = well?.travelDealRefillKey;
  const pendingExtendedOwners: SemanticAddress[] = [];
  let extendedSourceOwner: SemanticAddress | undefined;
  for (const candidate of activeWellRows) {
    if (candidate.reference.kind !== 'purchaseStygianWellOffer') continue;
    const candidateGeneration = candidate.reference.generationKey;
    const candidateEffect = authoredRoom?.stygianWellOfferEffects?.[candidateGeneration];
    if (candidateEffect === 'extended') {
      pendingExtendedOwners.push(candidate.owner);
    } else {
      const candidateItem =
        authoredRoom === undefined
          ? undefined
          : stygianWellGenerationItemKey(wellOccurrenceView(authoredRoom), candidateGeneration);
      if (
        candidateItem !== undefined &&
        candidateItem !== null &&
        extendedWellItemKeys(catalog).includes(candidateItem) &&
        pendingExtendedOwners.length > 0
      ) {
        const consumed = pendingExtendedOwners.shift();
        if (candidate === row) extendedSourceOwner = consumed;
      }
    }
    if (candidate === row) break;
  }
  const twistResultKey =
    itemKey === 'RandomStoreItem' && authoredRoom !== undefined
      ? stygianWellGenerationTwistResultKey(wellOccurrenceView(authoredRoom), event.generationKey)
      : undefined;
  const extendedDirectPurchase =
    itemKey !== undefined && itemKey !== null && extendedWellItemKeys(catalog).includes(itemKey);
  const timelineFacts: PlannerTimelineFacts = Object.freeze({
    nodes:
      row === undefined
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({
              owner: row.owner,
              included: effect !== undefined && (effect !== 'neutral' || extendedDirectPurchase),
            }),
          ]),
    dependencies:
      row === undefined ||
      extendedSourceOwner === undefined ||
      semanticAddressKey(extendedSourceOwner) === semanticAddressKey(row.owner)
        ? Object.freeze([])
        : Object.freeze([Object.freeze({ owner: row.owner, afterOwner: extendedSourceOwner })]),
  });
  const sourceOwner = inputs.roll.firstPurchase === undefined ? undefined : row?.owner;
  const refillSupported = inputs.branches.every(
    (branch) => branch.state.traitHistory.equippedTraits.RestockBoon !== undefined,
  );
  const refillRealization = (() => {
    if (
      row === undefined ||
      sourceOwner === undefined ||
      !refillSupported ||
      refillItemKey === undefined ||
      refillItemKey === null ||
      authoredRoom === undefined
    )
      return undefined;
    const inventoryOwner = createRoomActionAddress(
      createBiomeAddress(authoredRoom.origin.routeKey, authoredRoom.origin.biomeKey),
      authoredRoom.occurrenceId,
      roomActionKey(
        Object.freeze({
          kind: 'purchaseStygianWellOffer' as const,
          generationKey: 'travelDealRefill' as const,
        }),
      ),
    );
    const refillTwistResultKey =
      refillItemKey === 'RandomStoreItem'
        ? authoredRoom.stygianWell?.twistResultKeyBySlot?.travelDealRefill
        : undefined;
    return Object.freeze({
      owner: createTravelDealRefillRealizationAddress(
        createBiomeAddress(authoredRoom.origin.routeKey, authoredRoom.origin.biomeKey),
        authoredRoom.origin.occurrenceId,
      ),
      inventoryOwner,
      sourceOwner,
      generationKey: 'travelDealRefill' as const,
      offerKey: refillItemKey,
      effect: authoredRoom.stygianWellOfferEffects?.travelDealRefill ?? 'neutral',
      ...(refillTwistResultKey === undefined || refillTwistResultKey === null
        ? {}
        : { twistResultKey: refillTwistResultKey }),
    });
  })();
  const factsWithRefill =
    refillRealization === undefined
      ? timelineFacts
      : Object.freeze({
          nodes: Object.freeze([
            ...timelineFacts.nodes,
            Object.freeze({ owner: refillRealization.owner, included: true }),
          ]),
          dependencies: Object.freeze([
            ...timelineFacts.dependencies,
            Object.freeze({
              owner: refillRealization.inventoryOwner,
              afterOwner: refillRealization.owner,
            }),
          ]),
        });
  if (inputs.roll.refused !== undefined && row !== undefined && authoredRoom !== undefined) {
    return Object.freeze({
      branches: inputs.branches,
      findings: Object.freeze([
        findingRegion(
          rewardFinding('rollOfferUnavailable', row.owner, { reason: inputs.roll.refused }),
          undefined,
          rewardFindingChronologyForRoom(
            snapshot,
            authoredRoom.origin,
            event.sequence,
            'localRoomLifecycle',
          ),
          'reward',
        ),
      ]),
      timelineFacts: factsWithRefill,
      candidateContexts: Object.freeze([]),
    });
  }
  if (
    authoredRoom === undefined ||
    well === undefined ||
    itemKey === undefined ||
    itemKey === null
  ) {
    // A bought slot must be pinned; a blank one is otherwise native.
    const unpinned =
      authoredRoom !== undefined &&
      well !== undefined &&
      (itemKey === null || event.generationKey === 'travelDealRefill');
    return Object.freeze({
      branches: inputs.branches,
      findings: Object.freeze([
        findingRegion(
          unpinned
            ? rewardFinding(
                'stygianWellMissing',
                createRoomFeatureAddress(authoredRoom.origin, {
                  kind: 'stygianWellOffer',
                  generationKey: event.generationKey,
                }),
                { reason: 'missing' },
              )
            : rewardFinding('rewardSourceUnavailable', event.origin, {
                generationKey: event.generationKey,
              }),
          undefined,
          rewardFindingChronologyForRoom(
            snapshot,
            event.origin,
            event.sequence,
            'localRoomLifecycle',
          ),
          'reward',
        ),
      ]),
      timelineFacts: factsWithRefill,
      candidateContexts: Object.freeze([]),
      ...(refillRealization === undefined ? {} : { refillRealization }),
    });
  }
  if (event.generationKey === 'travelDealRefill' && !inputs.refillGenerationSupported) {
    return Object.freeze({
      branches: inputs.branches,
      findings: Object.freeze([
        findingRegion(
          rewardFinding(
            'stygianWellTravelDealRefillUnavailable',
            createRoomFeatureAddress(authoredRoom.origin, {
              kind: 'stygianWellOffer',
              generationKey: 'travelDealRefill',
            }),
            { reason: 'refillUnavailable' },
          ),
          undefined,
          rewardFindingChronologyForRoom(
            snapshot,
            authoredRoom.origin,
            event.sequence,
            'localRoomLifecycle',
          ),
          'reward',
        ),
      ]),
      timelineFacts: factsWithRefill,
      candidateContexts: Object.freeze([]),
      ...(refillRealization === undefined ? {} : { refillRealization }),
    });
  }
  const candidateContexts = inputs.branches.map((branch) =>
    Object.freeze({
      purchase: assessStygianWellPurchase(
        catalog,
        authoredRoom.origin.routeKey,
        {
          generationKey: event.generationKey,
          itemKey,
          twistResultKey,
          ...(inputs.roll.firstPurchase === undefined
            ? {}
            : {
                firstPurchase: {
                  ...inputs.roll.firstPurchase,
                  travelDealRefillKey: well.travelDealRefillKey,
                },
              }),
        },
        branch.state.stygianWell,
        branch.state.traitHistory,
      ),
    }),
  );
  const findings = candidateContexts.flatMap(({ purchase }) =>
    purchase.issues.map((issue) =>
      findingRegion(
        rewardFinding(
          issue.kind.startsWith('twist')
            ? 'stygianWellTwistInvalid'
            : 'stygianWellTravelDealRefillUnavailable',
          createRoomFeatureAddress(authoredRoom.origin, {
            kind: issue.kind.startsWith('twist') ? 'stygianWellTwist' : 'stygianWellOffer',
            generationKey: issue.generationKey,
          }),
          { reason: issue.kind },
        ),
        undefined,
        rewardFindingChronologyForRoom(
          snapshot,
          authoredRoom.origin,
          event.sequence,
          'localRoomLifecycle',
        ),
        'reward',
      ),
    ),
  );
  return Object.freeze({
    branches: Object.freeze(
      inputs.branches.map((branch, index) => {
        const assessment = candidateContexts[index]?.purchase;
        const source = Object.freeze({
          occurrence: authoredRoom.origin,
          generationKey: event.generationKey,
        });
        const direct = applyStygianWellPurchase(
          catalog,
          branch.state.stygianWell,
          itemKey,
          source,
          true,
        );
        const nestedResultIsValid =
          assessment?.twistCandidateItemKeys !== undefined &&
          twistResultKey !== undefined &&
          twistResultKey !== null &&
          assessment.twistCandidateItemKeys.includes(twistResultKey);
        let history = branch.state.rewardHistory;
        for (const grant of [
          stygianWellGrant(catalog, itemKey),
          nestedResultIsValid ? stygianWellGrant(catalog, twistResultKey) : undefined,
        ])
          if (grant?.kind === 'consumable') {
            const declaration = catalog.rewards.acquisitions.byKey[grant.acquisitionGameName];
            history = creditItemArmor(
              creditMaxStatGain(
                applyConcreteAcquisition(catalog.rewards, history, {
                  kind: 'consumable',
                  gameName: grant.acquisitionGameName,
                }),
                declaration?.maxStatGrant,
              ),
              declaration?.armorGrant,
            );
          }
        return Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            rewardHistory: history,
            stygianWell:
              !nestedResultIsValid || twistResultKey === undefined || twistResultKey === null
                ? direct
                : applyStygianWellPurchase(catalog, direct, twistResultKey, source, false),
          }),
        });
      }),
    ),
    findings: Object.freeze(findings),
    timelineFacts: factsWithRefill,
    candidateContexts: Object.freeze(candidateContexts),
    ...(refillRealization === undefined ? {} : { refillRealization }),
  });
}

/** The Well's authored state with its rerolls, as one roll lookup reads it. */
export function wellOccurrenceView(room: CanonicalAuthoredRoom) {
  return Object.freeze({
    stygianWell: room.stygianWell,
    roomActions: Object.freeze({
      order: Object.freeze(room.roomActionRoster.rows.map((row) => row.reference)),
    }),
  });
}
