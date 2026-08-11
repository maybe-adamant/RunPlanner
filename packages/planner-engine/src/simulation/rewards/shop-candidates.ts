import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { RewardHistoryState, RewardKernelFacts } from '../../reward-kernel';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { FindingRegionEntry } from '../finding-regions';
import type { AcquisitionOrderCandidateContext } from './lifecycle-artifacts';
import { settleShopAcquisitionSite, type RewardBranchState } from './processing';

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
