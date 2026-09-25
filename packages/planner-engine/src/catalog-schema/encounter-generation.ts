/** Native generator facts, independent of authored rosters and combat simulation. */
export interface EncounterEnemyChoice {
  readonly key: string;
  readonly label: string;
  readonly nativeId: string;
  readonly elite: boolean;
  /** Native Next Biome Enemy Shrine replacement contact for this source identity. */
  readonly menace?:
    | { readonly kind: 'mapped'; readonly targetNativeId: string; readonly targetLabel?: string }
    | {
        readonly kind: 'random';
        readonly targetNativeIds: readonly string[];
        readonly targetLabels?: Readonly<Record<string, string>>;
      }
    | { readonly kind: 'blocked' }
    | { readonly kind: 'none' };
  /** Native Fangs selection facts. Absent means this spawn cannot be selected by Fangs. */
  readonly fangs?: {
    readonly options: readonly string[];
    readonly blockedOptions: readonly string[];
    readonly caveat?: 'squad';
  };
  readonly blockSolo: boolean;
  readonly excludes: readonly string[];
  readonly blacklistAfterAppearance: boolean;
  /** Native GeneratorData difficulty and optional generated-count cap. */
  readonly difficultyRating: number;
  /** Native units created by one group spawn request; absent for individual enemies. */
  readonly unitGroupSize?: number;
  readonly maxCount?: number;
  /** Count on a declaration-owned manual template spawn. */
  readonly fixedCount?: number;
  readonly group?: 'Automatons' | 'ChronosForces';
  readonly minimumDepth?: {
    readonly axis: 'biomeDepthCache' | 'biomeEncounterDepth';
    readonly value: number;
  };
}

export interface GeneratedEncounterSelection {
  readonly kind: 'generated';
  readonly preparation: 'roomEntry' | 'rewardGeneration';
  readonly choices: readonly EncounterEnemyChoice[];
  readonly waveCount: { readonly min: number; readonly max: number };
  readonly types: {
    readonly min: number;
    readonly max: number;
    readonly depthRamp: number;
    readonly depthAxis: 'biomeDepthCache' | 'biomeEncounterDepth';
    readonly escalate: boolean;
    readonly cap: number;
    /** Conditional native support; not an assertion that a modeled room is hard. */
    readonly hardCap?: number;
  };
  readonly maxEliteTypes: number;
  readonly blockHighlightElites: boolean;
  /** Native encounter-level BlockEliteAttributes (the H passive cages). */
  readonly blockFangsAttributes: boolean;
  /** Native encounter-level BlockNextBiomeEnemyShrineUpgrade. */
  readonly blockMenace?: boolean;
  readonly blockTypesAcrossWaves: boolean;
  readonly maxTypesPerGroup: Readonly<Partial<Record<'Automatons' | 'ChronosForces', number>>>;
  /** Named fixed spawns precede generated placeholder entries, not ordinary additions. */
  readonly fixedEnemies: readonly EncounterEnemyChoice[];
  readonly fangs?: {
    readonly perks: Readonly<
      Record<
        string,
        {
          readonly label: string;
          readonly excludes: readonly string[];
          readonly roomSets?: readonly string[];
          readonly maxPerRoom?: number;
        }
      >
    >;
  };
  /** Resolved native base difficulty, depth ramp, modifier and multiplier operands. */
  readonly budget: {
    readonly base: number | { readonly min: number; readonly max: number };
    readonly depthRamp: number;
    readonly depthAxis: 'biomeDepthCache' | 'biomeEncounterDepth';
    /** Native DifficultyModifier, added before DifficultyMultiplier. */
    readonly modifier: number;
    readonly multiplier: number;
    readonly minimum: number;
    readonly hardDepthRamp?: number;
  };
}

/** Native identity and eligibility facts for one infinite-spawn roster member. */
export type InfiniteRosterEnemyChoice = Pick<
  EncounterEnemyChoice,
  'key' | 'label' | 'nativeId' | 'elite' | 'excludes'
> & {
  /** Native Elite GameStateRequirements read CurrentRun.BiomeDepthCache. */
  readonly minimumDepth?: { readonly axis: 'biomeDepthCache'; readonly value: number };
};

/**
 * One FillEnemyTypes roster that native FillEnemyCounts marks infinite. It has
 * no wave, budget or count domain; `excludes` apply only to later draws.
 */
export interface InfiniteRosterSelection {
  readonly kind: 'infiniteRoster';
  readonly choices: readonly InfiniteRosterEnemyChoice[];
  readonly types: { readonly min: number; readonly max: number };
  readonly maxEliteTypes: number;
}
