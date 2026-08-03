import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import type { ShipCombatState, ShopState } from '../../authored-project/model';
import type { SemanticFinding } from '../model';

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
  readonly evaluateState: (state: ShopState) => RoomLifecycleCandidateResult;
}

export interface ShipLifecycleCandidateCapability {
  readonly activeWheelKeys: readonly string[];
  readonly evaluateState: (state: ShipCombatState) => RoomLifecycleCandidateResult;
}

export interface ShopPurchaseCandidateCapability {
  readonly evaluateState: (state: ShopState) => RoomLifecycleCandidateResult;
}

/**
 * Opaque Ship/Shop lifecycle capabilities from one exact reward evaluation.
 *
 * Mutable construction maps stay private. Candidate evaluation can ask only
 * for the addressed occurrence capability that its family owns.
 */
export interface RoomLifecycleCandidateArtifacts {
  readonly shipAt: (owner: OccurrenceAddress) => ShipLifecycleCandidateCapability | undefined;
  readonly shopAt: (owner: OccurrenceAddress) => ShopPurchaseCandidateCapability | undefined;
}

export function createRoomLifecycleCandidateArtifacts(
  shipsByOwner: ReadonlyMap<string, ShipLifecycleCandidateContext>,
  shopsByOwner: ReadonlyMap<string, ShopPurchaseCandidateContext>,
): RoomLifecycleCandidateArtifacts {
  const ships = new Map<string, ShipLifecycleCandidateCapability>();
  for (const [key, context] of shipsByOwner) {
    ships.set(
      key,
      Object.freeze({
        activeWheelKeys: context.activeWheelKeys,
        evaluateState: context.evaluateState,
      }),
    );
  }
  const shops = new Map<string, ShopPurchaseCandidateCapability>();
  for (const [key, context] of shopsByOwner) {
    shops.set(key, Object.freeze({ evaluateState: context.evaluateState }));
  }
  return Object.freeze({
    shipAt: (owner: OccurrenceAddress) => ships.get(semanticAddressKey(owner)),
    shopAt: (owner: OccurrenceAddress) => shops.get(semanticAddressKey(owner)),
  });
}

export function createEmptyRoomLifecycleCandidateArtifacts(): RoomLifecycleCandidateArtifacts {
  return createRoomLifecycleCandidateArtifacts(new Map(), new Map());
}
