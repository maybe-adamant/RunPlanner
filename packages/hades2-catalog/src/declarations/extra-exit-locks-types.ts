/** The rooms whose extra exits can lock, and the door and fight that lock them. */
export interface RawExtraExitLockInput {
  /** `LockExtraExitsWithEncounter`. */
  readonly encounterKey: string;
  /** The exit type whose doors carry `CheckExitPreUnlock`. */
  readonly doorType: string;
  /** That door's `LockedWithEncounterChance`. */
  readonly doorLockChance: number;
  /** Each host's `LockExtraExitsChance`. */
  readonly hosts: readonly { readonly gameName: string; readonly chance: number }[];
}
