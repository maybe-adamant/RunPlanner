import type { Catalog } from '../../catalog-schema';
import {
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import {
  biomeGoldPrices,
  type BiomeGoldPrices,
  type GoldPurchasePrice,
  type GoldRoomSpending,
} from '../commerce/gold/ledger';
import { ZERO_GOLD } from '../commerce/gold/prices';
import type { BiomeRewardSimulation } from '../rewards/model';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import { runStateSnapshotForProjectEvaluationAssembly } from './run-state-query';

/**
 * Why a price is unavailable: coverage did not reach it, or the plan leaves
 * what a purchase buys unresolved, which its own finding reports.
 */
export type GoldUnavailableReason = 'coverageNotReached' | 'itemUnresolved';

export type GoldPurchaseAvailability =
  | { readonly availability: 'available'; readonly purchase: GoldPurchasePrice }
  | { readonly availability: 'unavailable'; readonly reason: GoldUnavailableReason };

export type GoldRoomAvailability =
  | { readonly availability: 'available'; readonly room: GoldRoomSpending }
  | { readonly availability: 'unavailable'; readonly reason: GoldUnavailableReason };

/**
 * Gold guidance over one evaluated project: what each reached purchase costs
 * and what each fully reached room spends. Never a finding; past coverage a
 * value is unavailable, never zero.
 */
export interface GoldLedger {
  purchaseAt(owner: SemanticAddress): GoldPurchaseAvailability;
  roomAt(room: OccurrenceAddress): GoldRoomAvailability;
}

const UNREACHED = Object.freeze({
  availability: 'unavailable' as const,
  reason: 'coverageNotReached' as const,
});
const UNRESOLVED = Object.freeze({
  availability: 'unavailable' as const,
  reason: 'itemUnresolved' as const,
});

const pricesByCatalog = new WeakMap<Catalog, WeakMap<BiomeRewardSimulation, BiomeGoldPrices>>();
const ledgersByCatalog = new WeakMap<Catalog, WeakMap<ProjectEvaluationAssembly, GoldLedger>>();

function memoized<K extends object, V>(
  outer: WeakMap<Catalog, WeakMap<K, V>>,
  catalog: Catalog,
  key: K,
  build: () => V,
): V {
  let inner = outer.get(catalog);
  if (inner === undefined) {
    inner = new WeakMap();
    outer.set(catalog, inner);
  }
  let value = inner.get(key);
  if (value === undefined) {
    value = build();
    inner.set(key, value);
  }
  return value;
}

/**
 * The gold ledger of an evaluated project, priced lazily per biome. A lookup
 * throws `GoldLedgerContractError` for a purchase, or its room, whose reached
 * branches disagree on a price input or whose price facts break a contract.
 */
export function goldLedgerForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
): GoldLedger {
  return memoized(ledgersByCatalog, catalog, assembly, () => {
    const biomePrices = (biomeKey: string): BiomeGoldPrices | undefined => {
      const biome = assembly.evaluation.route.biomes.find(
        (candidate) => candidate.biomeKey === biomeKey,
      );
      if (biome === undefined || !('rewards' in biome)) return undefined;
      return memoized(pricesByCatalog, catalog, biome.rewards, () =>
        biomeGoldPrices(catalog, biome.rewards.purchasePriceContexts),
      );
    };
    const sameRoute = (owner: { readonly routeKey: string }) =>
      owner.routeKey === assembly.project.route.routeKey;
    return Object.freeze({
      purchaseAt(owner: SemanticAddress): GoldPurchaseAvailability {
        if (!('biomeKey' in owner) || !('routeKey' in owner) || !sameRoute(owner)) return UNREACHED;
        const outcome = biomePrices(owner.biomeKey)?.purchases.get(semanticAddressKey(owner));
        switch (outcome?.kind) {
          case undefined:
            return UNREACHED;
          case 'fault':
            throw outcome.error;
          case 'itemUnresolved':
            return UNRESOLVED;
          case 'priced':
            return Object.freeze({ availability: 'available', purchase: outcome.purchase });
        }
      },
      roomAt(room: OccurrenceAddress): GoldRoomAvailability {
        if (!sameRoute(room)) return UNREACHED;
        const outcome = biomePrices(room.biomeKey)?.rooms.get(semanticAddressKey(room));
        if (outcome?.kind === 'fault') throw outcome.error;
        const exited = runStateSnapshotForProjectEvaluationAssembly(
          assembly,
          createRoomRunStateCheckpointAddress(room, { kind: 'beforeRoomExit' }),
        );
        if (exited === undefined) return UNREACHED;
        if (outcome?.kind === 'itemUnresolved') return UNRESOLVED;
        return Object.freeze({
          availability: 'available',
          room:
            outcome?.room ??
            Object.freeze({ room, purchases: Object.freeze([]), spending: ZERO_GOLD }),
        });
      },
    });
  });
}
