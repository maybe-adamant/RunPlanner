import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import type { CanonicalAuthoredRoom } from '../../materialization';
import type { FindingChronology } from '../../finding-regions';
import type { RewardFactsFactory } from '../acquisition/contracts';

export function shopRequirements(
  declaration: RoomDeclaration,
  profileKey: string,
  fail: (detail: string) => never,
) {
  const binding = declaration.incomingReward;
  if (binding.kind !== 'shop' || binding.shopProfileKey !== profileKey) {
    return fail(`${declaration.gameName} has no ${profileKey} shop binding`);
  }
  return binding.additionalOptionRequirements ?? Object.freeze({});
}

export interface ShopProcessingContext {
  readonly catalog: Catalog;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly historySequence: number;
  readonly findingChronology?: FindingChronology;
  readonly facts: RewardFactsFactory;
  readonly fail: (detail: string) => never;
  /** Exact participating Shop actions for this settlement invocation. */
  readonly order?: readonly string[];
  /** The current action is the final Shop-owned chronology row in this room. */
  readonly completeAfterOrder?: boolean;
  /** Exact authored Sea Star result sites whose source frontier must be retained. */
  readonly authoredSeaStarDuplicateSiteKeys?: ReadonlySet<string>;
}
