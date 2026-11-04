import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import type { ProjectCommand } from '../../authored-project/commands/types';
import type { HermesShrineDelay, HermesShrineGenerationKey } from '../../authored-project/model';
import type { ShopOptionSelection } from '../../reward-kernel';

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
    /** The items the reached state can stock there, each ready as the command's `value`. */
    readonly values: readonly ShopOptionSelection[];
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
  /** A rush made with Travel Deal has refilled its slot at the reached state. */
  readonly travelDealRefillLive: boolean;
  /** The live refill while it is unbought, with the rewards the reached state can stock. */
  readonly travelDealRefill?: HermesShrineInteractionOffer & {
    readonly candidateRewardTypes: readonly string[];
  };
}

/** Why the Pedestal cannot be collected there. */
export type ChampionItemCollectLock =
  /** The pedestal did not spawn: Champion of Elysium is not held. */
  'inactive';

/** Whether the Contract pedestal's item can be collected at the end of the room's sequence. */
export interface ChampionItemInteraction {
  readonly historySequence: number;
  /** Absent once collected. */
  readonly collect?:
    | { readonly command: CommandOf<'SetInfernalContractPedestalCollected'> }
    | { readonly locked: ChampionItemCollectLock };
}

/**
 * The challenge switch a host's entry could hold: each variant, rollable when
 * no shared spawn rule breaks and it has no lock, with the command observing it.
 */
export interface ChallengeSwitchInteraction {
  readonly sharedIssues: import('./challenge-switch').ChallengeSwitchEntryAssessment['sharedIssues'];
  readonly variants: readonly {
    readonly variantKey: string;
    readonly switchKind: import('../../catalog-schema').ChallengeSwitchKind;
    readonly rollable: boolean;
    readonly lock?: import('./challenge-switch').ChallengeSwitchVariantLock;
    /** The variant's own broken gate, with which gate and its numbers. */
    readonly issue?: import('./challenge-switch').ChallengeSwitchEntryAssessment['variants'][number]['issue'];
    readonly command: CommandOf<'ReplaceChallengeSwitch'>;
  }[];
  /**
   * Each kind in catalog order: the command observing it as its default
   * variant when that one is rollable, else its first rollable variant; when
   * none is rollable, the rule that locks it (a shared rule, else its first
   * variant's gate).
   */
  readonly kinds: readonly {
    readonly switchKind: import('../../catalog-schema').ChallengeSwitchKind;
    readonly observe?: CommandOf<'ReplaceChallengeSwitch'>;
    readonly lock?: import('./challenge-switch').ChallengeSwitchPlacementIssue;
  }[];
  /**
   * The Elite kind's encounter here: each elite native can draw with the
   * attributes its first forced draw can take; later draws narrow through
   * `eliteChallengeAttributeOptions`.
   */
  readonly elite: {
    readonly encounterKey: string;
    readonly roomSetKey: string;
    readonly attributeCount: number;
    readonly enemies: readonly {
      readonly enemyKey: string;
      readonly label: string;
      readonly attributeKeys: readonly string[];
    }[];
    readonly attributeLabels: Readonly<Record<string, string>>;
    /**
     * For the observed switch's pinned elite, each forced draw in order with
     * the attributes it can take after the earlier pinned ones; a draw after
     * an unpinned one stays native and offers none.
     */
    readonly pinnedDraws?: readonly { readonly attributeKeys: readonly string[] }[];
  };
  /**
   * The observed switch's encounter, generated at this entry: an
   * `EncounterCompositionPhase` whose customization reads its assessed
   * support. Its capability is `challengeSwitchEncounterSupportForProjectEvaluationAssembly`.
   */
  readonly encounter?: ChallengeSwitchEncounterInteraction;
  /** The observed switch's fight outcome and what each choice of its kind sets. */
  readonly outcome?: ChallengeSwitchOutcomeInteraction;
}

/**
 * The observed switch's outcome: its kind's choices, each with the command
 * that sets it (Nectar kept where the choice can drop it, gold left to the
 * engine), and what the current outcome allows.
 */
export interface ChallengeSwitchOutcomeInteraction {
  readonly current: import('../../authored-project/model').ChallengeSwitchOutcome;
  readonly choices: readonly {
    readonly outcome: import('../../authored-project/model').ChallengeSwitchOutcome;
    readonly command: CommandOf<'ReplaceChallengeSwitchOutcome'>;
  }[];
  /** The current outcome can drop the bonus Nectar. */
  readonly nectarAllowed: boolean;
  /** Toggles the bonus Nectar; present while it is allowed. */
  readonly nectarCommand?: CommandOf<'ReplaceChallengeSwitchOutcome'>;
  /** The current outcome claims gold (a finished Time switch). */
  readonly goldApplies: boolean;
  /** Present while gold applies: its value, authored within these bounds. */
  readonly gold?: { readonly value: number; readonly minimum: number; readonly maximum: number };
}

/** The observed switch's encounter and each declared decision with its authored value. */
export interface ChallengeSwitchEncounterInteraction {
  readonly switchKind: import('../../catalog-schema').ChallengeSwitchKind;
  readonly selectedEncounterDefinitionKey: string;
  readonly label: string;
  readonly customization: readonly {
    readonly key: string;
    readonly label: string;
    readonly selection: import('../../catalog-schema').EncounterCustomizationDecision['selection'];
    readonly value?: import('../../authored-project/model').AuthoredEncounterCustomization;
    readonly valueSupported: boolean;
    /** Restores the native roll; present while a value is authored. */
    readonly reset?: CommandOf<'ReplaceChallengeSwitchCustomization'>;
  }[];
}

/** A room's object interactions; an object whose sequence is unreached has none. */
export interface RoomObjectInteractions {
  readonly worldShop?: WorldShopInteraction;
  readonly hermesShrine?: HermesShrineInteraction;
  readonly championItem?: ChampionItemInteraction;
  /** Present at every entered switch host. */
  readonly challengeSwitch?: ChallengeSwitchInteraction;
}

export interface RoomObjectInteractionArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => RoomObjectInteractions | undefined;
  /** The observed switch's encounter generation capability at its room's entry. */
  readonly challengeSwitchEncounterAt: (
    occurrence: OccurrenceAddress,
  ) => import('../encounters').GeneratedEncounterCandidateCapability | undefined;
}

export function createRoomObjectInteractionArtifacts(
  interactions: ReadonlyMap<string, RoomObjectInteractions>,
  challengeSwitchEncounters: ReadonlyMap<
    string,
    import('../encounters/challenge-switch').PreparedChallengeSwitchEncounter
  >,
): RoomObjectInteractionArtifacts {
  const privateInteractions = new Map(interactions);
  const privateEncounters = new Map(challengeSwitchEncounters);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => privateInteractions.get(semanticAddressKey(occurrence)),
    challengeSwitchEncounterAt: (occurrence: OccurrenceAddress) =>
      privateEncounters.get(semanticAddressKey(occurrence))?.capability,
  });
}

export function createEmptyRoomObjectInteractionArtifacts(): RoomObjectInteractionArtifacts {
  return Object.freeze({ at: () => undefined, challengeSwitchEncounterAt: () => undefined });
}
