/** Native generator facts, independent of authored rosters and combat simulation. */
export interface EncounterEnemyChoice {
  readonly key: string;
  readonly label: string;
  readonly nativeId: string;
  readonly elite: boolean;
  readonly blockSolo: boolean;
  readonly excludes: readonly string[];
  readonly blacklistAfterAppearance: boolean;
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
  readonly blockTypesAcrossWaves: boolean;
  readonly maxTypesPerGroup: Readonly<Partial<Record<'Automatons' | 'ChronosForces', number>>>;
  /** Named fixed spawns precede generated placeholder entries, not ordinary additions. */
  readonly fixedEnemies: readonly EncounterEnemyChoice[];
}
