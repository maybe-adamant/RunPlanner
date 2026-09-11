import type {
  EncounterSlotActivation,
  EncounterPhaseKind,
} from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type { RawCountedRewardBinding } from '../rooms/types';

export interface RawEncounterRewardWheelAttachment {
  readonly kind: 'rewardWheel';
  readonly key: string;
  readonly reward: RawCountedRewardBinding;
  readonly defaultStoreKey: string;
  readonly offerKeys: readonly string[];
  readonly offerCount: {
    readonly min: number;
    readonly max: number;
    readonly defaultValue: number;
  };
  readonly picked: 'exactlyOne';
}

export interface RawEncounterLocalRewardAttachment {
  readonly kind: 'localReward';
  readonly groupKey: string;
  readonly slotKey: string;
}

export interface RawEncounterEnvelopeSlotDeclaration {
  readonly key: string;
  readonly activation: EncounterSlotActivation;
  readonly activationRequirement?: RequirementExpression;
  readonly rewardAttachment?: RawEncounterLocalRewardAttachment | RawEncounterRewardWheelAttachment;
}

export interface RawEncounterEnvelopeDeclaration {
  readonly key: string;
  readonly slots: readonly RawEncounterEnvelopeSlotDeclaration[];
}

export interface RawEncounterDefinitionDeclaration {
  readonly key: string;
  readonly label: string;
  readonly kind: EncounterPhaseKind;
  readonly countsEncounterDepth: boolean;
  /** Exact encounter-level policy for advancing delayed Hermes Shrine delivery uses. */
  readonly advancesHermesShrineDeliveryUses?: boolean;
  readonly canEncounterSkip?: boolean;
  readonly blocksFigLeaf?: boolean;
  readonly blocksGorgon?: boolean;
  readonly hostsGorgon?: boolean;
  readonly skipEndEncounterEffects?: boolean;
  readonly blocksKeepsakeSelectionKeys?: readonly string[];
  readonly requirements?: RequirementExpression;
  readonly sequenceEffect?: { readonly kind: 'terminateSuffix' };
  readonly npcPresentationKey?: string;
  readonly traitOfferProducer?: {
    readonly kind: 'traitOffer';
    readonly giverKey: string;
  };
  /** A required interaction using the phase's ordinary interactEncounter action. */
  readonly requiresInteraction?: boolean;
  /** F/G event contact retains its draw but disables its canonical acquisition. */
  readonly suppressesIncomingReward?: boolean;
  /** Closed policy owned by the one ordinary Nemesis random-event identity. */
  readonly nemesisRandomEvent?: {
    readonly freeItem: {
      readonly resultRewardTypes: readonly [
        'EmptyMaxHealthDrop',
        'HealDrop',
        'LastStandDrop',
        'ArmorBoost',
      ];
      readonly conditionalResultRewardType: 'LastStandDrop';
      readonly response: 'none';
      readonly pickupRequired: false;
    };
    readonly goldTrade: {
      readonly variants: readonly {
        readonly rewardType: string;
        readonly enteredBiome: { readonly min?: number; readonly max?: number };
        readonly requirement: 'none' | 'pomLegal' | 'hammerEarlyOrLate';
      }[];
      readonly response: readonly ['accept', 'decline'];
      readonly pickupRequiredOnAccept: true;
    };
    readonly damageTrade: {
      readonly variants: readonly {
        readonly rewardType: string;
        readonly enteredBiome: { readonly min?: number; readonly max?: number };
        readonly requirement: 'none' | 'pomLegal' | 'talentLegal';
      }[];
      readonly response: readonly ['accept', 'decline'];
      readonly pickupRequiredOnAccept: true;
    };
    readonly traitTrade: {
      readonly response: readonly ['accept', 'decline'];
      readonly pickupRequiredOnAccept: true;
      readonly fixedResultRewardType: 'RoomMoneyTripleDrop';
      readonly traitSelection: 'eligibleGodTraitCommonPriority';
    };
    readonly damageContest: {
      readonly successResultRewardTypes: readonly [
        'MaxHealthDrop',
        'MaxManaDrop',
        'StackUpgrade',
        'RoomMoneyDrop',
        'TalentDrop',
      ];
      readonly failureResultRewardType: 'RoomRewardConsolationPrize';
      readonly response: 'none';
      readonly pickupRequired: false;
    };
    readonly hOptionalCapacityReservation: 1;
  };
}

export interface RawEncounterSetDeclaration {
  readonly key: string;
  readonly encounterDefinitionKeys: readonly string[];
  readonly defaultAuthoringProfileKey: string;
  /**
   * Authored choices whose exact game definition is selected from the
   * currently eligible member at encounter preparation time.
   */
  readonly authoringProfiles?: readonly {
    readonly key: string;
    readonly encounterDefinitionKeys: readonly string[];
  }[];
}

export type RawEncounterSlotBinding =
  | {
      readonly slotKey: string;
      readonly kind: 'set';
      readonly encounterSetKey: string;
    }
  | {
      readonly slotKey: string;
      readonly kind: 'fixed';
      readonly encounterDefinitionKey: string;
    };
