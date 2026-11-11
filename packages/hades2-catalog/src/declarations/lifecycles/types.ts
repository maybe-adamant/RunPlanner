import type {
  RoomLifecycleProducerPolicy,
  RoomLifecycleStep,
} from '@run-planner/engine/catalog-schema';

export interface RawRoomLifecycleProfileDeclaration {
  readonly key: string;
  readonly encounterEnvelopeKeys: readonly string[];
  readonly producer: RoomLifecycleProducerPolicy;
  readonly steps: readonly RoomLifecycleStep[];
}

/**
 * The lifecycle a room template runs. A fixed template lists its lifecycles; a
 * room takes the one that admits its encounter envelope.
 */
export type RawRoomTemplateLifecycleDeclaration =
  | {
      readonly kind: 'fixed';
      readonly profileKeys: readonly string[];
      /** The lifecycle when an Ephyra hub enters the room as a local visit. */
      readonly localVisitProfileKey?: string;
    }
  | {
      readonly kind: 'clockworkGoal';
      readonly goalProfileKey: string;
      readonly rewardProfileKey: string;
    }
  | {
      readonly kind: 'prebossOffer';
      readonly shopProfileKey: string;
      readonly freeRewardProfileKey: string;
    };
