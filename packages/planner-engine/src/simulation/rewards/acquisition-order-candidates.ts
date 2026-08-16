import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { RewardHistoryState, RewardKernelFacts } from '../../reward-kernel';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { FindingRegionEntry } from '../finding-regions';
import type { AcquisitionOrderCandidateContext } from './lifecycle-artifacts';
import type { TraitOfferContext } from '../traits';
import {
  settlePickupAcquisitionSite,
  settleShopAcquisitionSite,
  type RewardBranchState,
} from './processing';

interface ShopPurchaseCandidateContextOptions {
  readonly catalog: Catalog;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly branchesBeforePurchases: readonly RewardBranchState[];
  readonly historySequence: number;
  readonly facts: (
    room: CanonicalAuthoredRoom,
    history: RewardHistoryState,
    shopNames: ReadonlySet<string>,
  ) => RewardKernelFacts;
  readonly fail: (detail: string) => never;
}

export function prepareAcquisitionOrderCandidateContext({
  catalog,
  room,
  declaration,
  branchesBeforePurchases,
  historySequence,
  facts,
  fail,
}: ShopPurchaseCandidateContextOptions): AcquisitionOrderCandidateContext {
  if (room.entryState?.kind !== 'shop') {
    return fail(`${room.gameName} has no shop purchase state`);
  }
  const entryState = room.entryState;
  return Object.freeze({
    origin: room.origin,
    evaluateOrder: (order: readonly string[]) => {
      const candidateFindings = new Map<string, FindingRegionEntry>();
      const candidateRoom: CanonicalAuthoredRoom = Object.freeze({
        ...room,
        entryState: Object.freeze({
          kind: 'shop',
          profileKey: entryState.profileKey,
          ...(entryState.deathDefianceConditionMet === undefined
            ? {}
            : { deathDefianceConditionMet: entryState.deathDefianceConditionMet }),
          offers: entryState.offers,
          order: Object.freeze([...order]),
        }),
      });
      const branches = settleShopAcquisitionSite(
        branchesBeforePurchases,
        {
          catalog,
          room: candidateRoom,
          declaration,
          historySequence,
          facts: (branchHistory, shopNames = new Set()) =>
            facts(candidateRoom, branchHistory, shopNames),
          fail,
          materializeDerivedShopEntryDefaults: true,
        },
        candidateFindings,
      ).branches;
      return Object.freeze({
        findings: Object.freeze([...candidateFindings.values()].map((entry) => entry.finding)),
        supported: branches.length > 0,
      });
    },
  });
}

export function preparePickupAcquisitionOrderCandidateContext(options: {
  readonly catalog: Catalog;
  readonly room: CanonicalAuthoredRoom;
  readonly branchesBeforePickups: readonly RewardBranchState[];
  readonly producerLifecycleKey: string;
  readonly historySequence: number;
  readonly facts: (history: RewardHistoryState) => RewardKernelFacts;
  readonly traitContext?: TraitOfferContext;
}): AcquisitionOrderCandidateContext {
  const site = options.room.pickupSite;
  if (site === undefined)
    throw new Error(`${options.room.gameName} has no pickup acquisition state`);
  return Object.freeze({
    origin: options.room.origin,
    evaluateOrder: (order: readonly string[]) => {
      const findings = new Map<string, FindingRegionEntry>();
      const result = settlePickupAcquisitionSite(
        options.catalog,
        options.branchesBeforePickups,
        {
          siteOwner: options.room.origin,
          entries: site.entries,
          order: Object.freeze([...order]),
          producerLifecycleKey: options.producerLifecycleKey,
          historySequence: options.historySequence,
          facts: options.facts,
          ...(options.traitContext === undefined ? {} : { traitContext: options.traitContext }),
        },
        findings,
      );
      return Object.freeze({
        findings: Object.freeze([...findings.values()].map((entry) => entry.finding)),
        supported: result.branches.length > 0,
      });
    },
  });
}
