import type { EncounterPhaseKind, EncounterSlotRewardAttachment } from '../../catalog-schema';
import type { AuthoredEncounterCustomization } from '../../authored-project/model';
import type { EncounterCustomizationDecision } from '../../catalog-schema';

/**
 * Retained materialization for one active envelope slot. It deliberately
 * carries authored choice identity rather than copied definition behaviour.
 */
export interface MaterializedEncounterPhase {
  readonly slotKey: string;
  readonly envelopeKey: string;
  readonly authoredChoiceKey: string;
  readonly figLeafSkip: boolean;
  readonly customizationByDecision?: Readonly<Record<string, AuthoredEncounterCustomization>>;
  readonly rewardAttachment?: EncounterSlotRewardAttachment;
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
  readonly skipEndEncounterEffects: boolean;
  /** Persisted phase-local positive disposition, when authored. */
  readonly figLeafSkip: boolean;
  /** Concrete declaration domain and sparse authored value for this exact resolved encounter. */
  readonly customization?: readonly (EncounterCustomizationDecision & {
    readonly value?: AuthoredEncounterCustomization;
    readonly valueSupported: boolean;
  })[];
  readonly sequenceEffect?: { readonly kind: 'terminateSuffix' };
  readonly rewardAttachment?: EncounterSlotRewardAttachment;
}
