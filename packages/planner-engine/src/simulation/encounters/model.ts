import type { EncounterPhaseKind, EncounterSlotRewardAttachment } from '../../catalog-schema';
import type { AuthoredEncounterCustomization } from '../../authored-project/model';
import type { EncounterCustomizationDecision } from '../../catalog-schema';
import type { EncounterPhaseAddress } from '../../authored-project/addresses';

/**
 * Retained materialization for one active envelope slot. It deliberately
 * carries the authored profile for selectable slots, or the resolved fixed
 * identity for fixed slots, rather than copied definition behaviour.
 */
export interface MaterializedEncounterPhase {
  readonly slotKey: string;
  readonly envelopeKey: string;
  readonly authoredChoiceKey: string;
  readonly figLeafSkip: boolean;
  readonly aetosWave?: number;
  readonly customizationByDecision?: Readonly<Record<string, AuthoredEncounterCustomization>>;
  readonly rewardAttachment?: EncounterSlotRewardAttachment;
}

/** Why the resolved encounter cannot steer with a phase's authored customization value. */
export type EncounterCustomizationUnsupportedReason =
  /** The resolved encounter does not declare the decision its authored owner did. */
  | { readonly reason: 'contextuallyReplaced' }
  /** The value names a choice or shape the resolved encounter does not declare. */
  | { readonly reason: 'valueNotDeclared' }
  | {
      readonly reason: 'cocoonCountOutOfRange';
      readonly count: number;
      readonly minimum: number;
      readonly maximum: number;
    }
  /** The host room has no cocoon reward anchor with this native ID. */
  | { readonly reason: 'cocoonRewardPointAbsent'; readonly spawnPointId: number }
  /** The first chosen value this route cannot produce. */
  | { readonly reason: 'routeExcluded'; readonly choiceKey: string }
  /** The first issue of the generated composition's assessment at its checkpoint. */
  | {
      readonly reason: 'compositionInvalid';
      readonly compositionIssue: import('./generation').GeneratedEncounterIssue;
    }
  /** The first issue of the infinite roster's assessment at its checkpoint. */
  | {
      readonly reason: 'infiniteRosterInvalid';
      readonly rosterIssue: import('./infinite-roster').InfiniteRosterIssue;
    };

/** One declared decision of a resolved phase with its sparse authored value and support. */
export type ResolvedEncounterCustomizationDecision = EncounterCustomizationDecision & {
  readonly value?: AuthoredEncounterCustomization;
  /** Retained from a binding an entry-contextual rule replaced; removal-only. */
  readonly replaced?: true;
} & (
    | { readonly valueSupported: true; readonly unsupported?: never }
    | {
        readonly valueSupported: false;
        readonly unsupported: EncounterCustomizationUnsupportedReason;
      }
  );

/** The decision with its value marked unsupported for `unsupported`. */
export function withUnsupportedCustomization(
  decision: ResolvedEncounterCustomizationDecision,
  unsupported: EncounterCustomizationUnsupportedReason,
): ResolvedEncounterCustomizationDecision {
  return Object.freeze({
    ...decision,
    valueSupported: false as const,
    unsupported: Object.freeze(unsupported),
  });
}

/**
 * One structurally active envelope position resolved to its concrete authored
 * or direct declaration identity. The envelope owns the stable slot; the
 * definition owns every effective encounter behavior.
 */
export interface ResolvedEncounterPhase {
  readonly slotKey: string;
  readonly envelopeKey: string;
  readonly encounterKey: string;
  readonly label: string;
  readonly kind: EncounterPhaseKind;
  readonly countsEncounterDepth: boolean;
  readonly advancesHermesShrineDeliveryUses: boolean;
  readonly canEncounterSkip: boolean;
  readonly blocksFigLeaf: boolean;
  readonly blocksGorgon: boolean;
  readonly hostsGorgon: boolean;
  readonly aetosWaves?: readonly number[];
  readonly aetosWave?: number;
  readonly skipEndEncounterEffects: boolean;
  /** Persisted phase-local positive disposition, when authored. */
  readonly figLeafSkip: boolean;
  /** Concrete declaration domain and sparse authored value for this exact resolved encounter. */
  readonly customization?: readonly ResolvedEncounterCustomizationDecision[];
  /** Evaluated generation operands, owned by the concrete preparation checkpoint. */
  readonly generatedCustomization?: {
    readonly decisionKey: string;
    readonly operands?: import('./generation').GeneratedEncounterOperands;
    /** Retained enemies whose introduction is unfinished at this checkpoint. */
    readonly introductionRequirements?: readonly {
      readonly enemyKey: string;
      readonly introductionEncounterKey: string;
      readonly admitted: boolean;
    }[];
    /** Every assessment issue is an unfinished introduction. */
    readonly onlyIntroductionIssues?: boolean;
    readonly knownRunBlacklistAdditions: readonly string[];
  };
  readonly sequenceEffect?: { readonly kind: 'terminateSuffix' };
  readonly rewardAttachment?: EncounterSlotRewardAttachment;
}

/** Native-roll facts of one reached generated phase at its own generation checkpoint. */
export interface GeneratedNativeRollFacts {
  readonly origin: EncounterPhaseAddress;
  /** Admissible enemies whose introduction would replace this encounter here. */
  readonly triggerExcludedEnemyKeys: readonly string[];
  /** Admissible once-per-run enemies this phase's native roll could draw and so use up. */
  readonly oncePerRunEnemyKeys: readonly string[];
  /**
   * An authored composition's once-per-run enemies that pass native eligibility
   * here, so an earlier native roll must not use them up. Absent when uncustomized.
   */
  readonly authoredOncePerRunUses?: readonly string[];
}

/** One reached generated phase after reward settlement, with its authored operands when composed. */
export interface ResolvedGeneratedPhase extends GeneratedNativeRollFacts {
  readonly customization?: NonNullable<ResolvedEncounterPhase['generatedCustomization']>;
}
