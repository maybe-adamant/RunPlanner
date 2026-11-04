import type {
  ChallengeSwitchEliteEncounterDeclaration,
  ChallengeSwitchKind,
  ChallengeSwitchKindDeclaration,
  ChallengeSwitchVariantDeclaration,
} from '@run-planner/engine/catalog-schema';

/** A RoomSet's default switch chance and the one encounter each kind fields there. */
export interface RawChallengeSwitchRoomSetDeclaration {
  readonly roomSetKey: string;
  readonly spawnChance: number;
  readonly encounterKeyBySwitchKind: Readonly<Record<ChallengeSwitchKind, string>>;
}

export interface RawChallengeSwitchInput {
  readonly minimumBiomeDepth: number;
  readonly minimumRoomsSinceLast: number;
  readonly producerLifecycleKey: string;
  readonly gold: {
    readonly startingValue: number;
    readonly minimumValue: number;
    readonly defaultValue: number;
  };
  readonly bonusReward: { readonly rewardType: string; readonly dropChance: number };
  readonly kinds: readonly ChallengeSwitchKindDeclaration[];
  readonly variants: readonly ChallengeSwitchVariantDeclaration[];
  readonly roomSets: readonly RawChallengeSwitchRoomSetDeclaration[];
  readonly eliteEncounters: readonly ChallengeSwitchEliteEncounterDeclaration[];
  /** Anchored rooms whose own `ChallengeSpawnChance` is zero. */
  readonly noSpawnRoomGameNames: readonly string[];
}
