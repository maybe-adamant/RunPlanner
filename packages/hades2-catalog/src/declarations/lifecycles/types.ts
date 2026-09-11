import type {
  RoomLifecycleOperation,
  RoomLifecycleProducerPolicy,
} from '@run-planner/engine/catalog-schema';

export interface RawRoomLifecycleProfileDeclaration {
  readonly key: string;
  readonly encounterEnvelopeKeys: readonly string[];
  readonly producer: RoomLifecycleProducerPolicy;
  readonly operations: readonly RoomLifecycleOperation[];
}
