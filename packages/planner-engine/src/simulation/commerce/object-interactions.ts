import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import type { ProjectCommand } from '../../authored-project/commands/types';
import type { HermesShrineDelay, HermesShrineGenerationKey } from '../../authored-project/model';

type CommandOf<Kind extends ProjectCommand['kind']> = Extract<
  ProjectCommand,
  { readonly kind: Kind }
>;

/**
 * What can be bought at the end of a World Shop's authored sequence, where a
 * new purchase is appended; the Preboss Shop form included.
 */
export interface WorldShopInteraction {
  readonly historySequence: number;
  /** Each stocked item not yet bought, in Shop order. */
  readonly offers: readonly {
    readonly offerKey: string;
    readonly command: CommandOf<'ReplaceShopPurchaseParticipation'>;
  }[];
  /** The Travel Deal item, once its first purchase made it live and while it is unbought. */
  readonly travelDealRefill?: {
    /** Null while the item is blank; the pick then adds its chosen `value` to `command`. */
    readonly rewardType: string | null;
    readonly optionKey: string | null;
    /** The rewards every reached branch can stock there. */
    readonly rewardTypes: readonly string[];
    readonly command: CommandOf<'PurchaseShopTravelDealRefill'>;
  };
}

/** One Hermes Shrine item that can be bought or rushed there. */
export interface HermesShrineInteractionOffer {
  readonly generationKey: HermesShrineGenerationKey;
  /** Null only for a blank Travel Deal refill; the pick then adds its chosen `rewardType`. */
  readonly rewardType: string | null;
  readonly delay: HermesShrineDelay | null;
  readonly buy: CommandOf<'PurchaseHermesShrineOffer'>;
  readonly rush: CommandOf<'PurchaseHermesShrineOffer'>;
}

/** What can be bought at the end of a Hermes Shrine's authored sequence. */
export interface HermesShrineInteraction {
  readonly historySequence: number;
  /** Each stocked initial item not yet bought, in slot order. */
  readonly offers: readonly HermesShrineInteractionOffer[];
  /** A rush made with Travel Deal has refilled its slot on every reached branch. */
  readonly travelDealRefillLive: boolean;
  /** The live refill while it is unbought, with the rewards every branch can stock. */
  readonly travelDealRefill?: HermesShrineInteractionOffer & {
    readonly candidateRewardTypes: readonly string[];
  };
}

/** Why the Champion item cannot be collected there. */
export type ChampionItemCollectLock =
  /** The pedestal holds no item yet. */
  | 'itemUnchosen'
  /** The pedestal did not spawn on every reached branch: Champion of Elysium is not held. */
  | 'inactive';

/** Whether the Contract pedestal's item can be collected at the end of the room's sequence. */
export interface ChampionItemInteraction {
  readonly historySequence: number;
  /** Absent once collected. */
  readonly collect?:
    | { readonly command: CommandOf<'SetInfernalContractPedestalCollected'> }
    | { readonly locked: ChampionItemCollectLock };
}

/** A room's object interactions; an object whose sequence is unreached has none. */
export interface RoomObjectInteractions {
  readonly worldShop?: WorldShopInteraction;
  readonly hermesShrine?: HermesShrineInteraction;
  readonly championItem?: ChampionItemInteraction;
}

export interface RoomObjectInteractionArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => RoomObjectInteractions | undefined;
}

export function createRoomObjectInteractionArtifacts(
  interactions: ReadonlyMap<string, RoomObjectInteractions>,
): RoomObjectInteractionArtifacts {
  const privateInteractions = new Map(interactions);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => privateInteractions.get(semanticAddressKey(occurrence)),
  });
}

export function createEmptyRoomObjectInteractionArtifacts(): RoomObjectInteractionArtifacts {
  return Object.freeze({ at: () => undefined });
}
