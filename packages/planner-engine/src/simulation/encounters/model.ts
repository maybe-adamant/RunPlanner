import type { EncounterPhaseKind, EncounterSlotRewardAttachment } from '../../catalog-schema';

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
  readonly sequenceEffect?: { readonly kind: 'terminateSuffix' };
  readonly rewardAttachment?: EncounterSlotRewardAttachment;
}
