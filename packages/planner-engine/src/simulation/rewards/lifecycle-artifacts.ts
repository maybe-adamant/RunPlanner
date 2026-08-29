import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import type { ShipCombatState } from '../../authored-project/model';
import type { SemanticFinding } from '../model';

export interface RoomLifecycleCandidateResult {
  readonly findings: readonly SemanticFinding[];
  readonly supported: boolean;
}

export interface ShipLifecycleCandidateContext {
  readonly origin: OccurrenceAddress;
  readonly activeWheelKeys: readonly string[];
  readonly evaluateState: (state: ShipCombatState) => RoomLifecycleCandidateResult;
  readonly evaluateStateThroughWheelPick: (
    state: ShipCombatState,
    wheelKey: string,
  ) => RoomLifecycleCandidateResult;
}

export interface ShipLifecycleCandidateCapability {
  readonly activeWheelKeys: readonly string[];
  readonly evaluateState: (state: ShipCombatState) => RoomLifecycleCandidateResult;
  readonly evaluateStateThroughWheelPick: (
    state: ShipCombatState,
    wheelKey: string,
  ) => RoomLifecycleCandidateResult;
}

/**
 * Opaque Ship/Shop lifecycle capabilities from one exact reward evaluation.
 *
 * Mutable construction maps stay private. Candidate evaluation can ask only
 * for the addressed occurrence capability that its family owns.
 */
export interface RoomLifecycleCandidateArtifacts {
  readonly shipAt: (owner: OccurrenceAddress) => ShipLifecycleCandidateCapability | undefined;
}

export function createRoomLifecycleCandidateArtifacts(
  shipsByOwner: ReadonlyMap<string, ShipLifecycleCandidateContext>,
): RoomLifecycleCandidateArtifacts {
  const ships = new Map<string, ShipLifecycleCandidateCapability>();
  for (const [key, context] of shipsByOwner) {
    ships.set(
      key,
      Object.freeze({
        activeWheelKeys: context.activeWheelKeys,
        evaluateState: context.evaluateState,
        evaluateStateThroughWheelPick: context.evaluateStateThroughWheelPick,
      }),
    );
  }
  return Object.freeze({
    shipAt: (owner: OccurrenceAddress) => ships.get(semanticAddressKey(owner)),
  });
}

export function createEmptyRoomLifecycleCandidateArtifacts(): RoomLifecycleCandidateArtifacts {
  return createRoomLifecycleCandidateArtifacts(new Map());
}
