import type { OccurrenceAddress, ShopPurchaseAddress } from '../../authored-project/addresses';
import type { ShipCombatState, ShopState } from '../../authored-project/model';
import type { SemanticFinding } from '../model';
import type { RewardSimulation } from './model';

export interface RoomLifecycleCandidateResult {
  readonly findings: readonly SemanticFinding[];
  readonly supported: boolean;
}

export interface ShipLifecycleCandidateContext {
  readonly origin: OccurrenceAddress;
  readonly activeWheelKeys: readonly string[];
  readonly evaluateState: (state: ShipCombatState) => RoomLifecycleCandidateResult;
}

export interface ShopPurchaseCandidateContext {
  readonly origin: OccurrenceAddress;
  readonly purchaseOrigins: readonly ShopPurchaseAddress[];
  readonly evaluateState: (state: ShopState) => RoomLifecycleCandidateResult;
}

export interface RoomLifecycleCandidateContextIndex {
  readonly shipsByOwner: ReadonlyMap<string, ShipLifecycleCandidateContext>;
  readonly shopsByOwner: ReadonlyMap<string, ShopPurchaseCandidateContext>;
}

const lifecycleContextsBySimulation = new WeakMap<
  RewardSimulation,
  RoomLifecycleCandidateContextIndex
>();

export function registerRoomLifecycleCandidateContexts(
  simulation: RewardSimulation,
  contexts: RoomLifecycleCandidateContextIndex,
): void {
  lifecycleContextsBySimulation.set(simulation, {
    shipsByOwner: new Map(contexts.shipsByOwner),
    shopsByOwner: new Map(contexts.shopsByOwner),
  });
}

export function roomLifecycleCandidateContexts(
  simulation: RewardSimulation,
): RoomLifecycleCandidateContextIndex {
  const contexts = lifecycleContextsBySimulation.get(simulation);
  if (contexts === undefined) {
    throw new Error(`reward simulation for ${simulation.biomeKey} has no lifecycle contexts`);
  }
  return contexts;
}
