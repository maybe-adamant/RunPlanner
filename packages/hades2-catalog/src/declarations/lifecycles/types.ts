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
