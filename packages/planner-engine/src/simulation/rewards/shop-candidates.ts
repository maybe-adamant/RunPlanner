import type { ShopState } from '../../authored-project/model';
import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { RewardHistoryState, RewardKernelFacts } from '../../reward-kernel';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { SemanticFinding } from '../model';
import type { ShopPurchaseCandidateContext } from './lifecycle-artifacts';
import { processShopPurchases, type RewardBranchState } from './processing';

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

export function prepareShopPurchaseCandidateContext({
  catalog,
  room,
  declaration,
  branchesBeforePurchases,
  historySequence,
  facts,
  fail,
}: ShopPurchaseCandidateContextOptions): ShopPurchaseCandidateContext {
  if (room.entryState?.kind !== 'shop') {
    return fail(`${room.gameName} has no shop purchase state`);
  }
  const entryState = room.entryState;
  return Object.freeze({
    origin: room.origin,
    evaluateState: (state: ShopState) => {
      const candidateFindings = new Map<string, SemanticFinding>();
      const candidateRoom: CanonicalAuthoredRoom = Object.freeze({
        ...room,
        entryState: Object.freeze({
          kind: 'shop',
          profileKey: state.profileKey,
          offers: Object.freeze(
            entryState.offers.map((offer) => {
              const candidate = state.offers[offer.offerKey];
              if (candidate === undefined) {
                return fail(`${room.gameName} lost shop offer ${offer.offerKey}`);
              }
              return Object.freeze({
                ...offer,
                offer: candidate.offer,
              });
            }),
          ),
          purchaseOrder: state.purchaseOrder,
        }),
      });
      const branches = processShopPurchases(
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
      );
      return Object.freeze({
        findings: Object.freeze([...candidateFindings.values()]),
        supported: branches.length > 0,
      });
    },
  });
}
