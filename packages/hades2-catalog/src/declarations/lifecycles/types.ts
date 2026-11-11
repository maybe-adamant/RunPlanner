import type {
  RoomLifecycleProducerPolicy,
  RoomLifecycleStep,
  RoomRoleLifecycleProfileKeys,
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
      /** The lifecycles when an Ephyra Hub enters the room as a board target or local visit. */
      readonly roleProfileKeys?: RoomRoleLifecycleProfileKeys;
    }
  | {
      readonly kind: 'prebossOffer';
      readonly shopProfileKey: string;
      readonly freeRewardProfileKey: string;
    };
