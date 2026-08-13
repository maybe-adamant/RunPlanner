export type FigLeafSkipUnavailableReason =
  'declaration' | 'biomeStart' | 'envelopeBlocker' | 'cascadeOwner' | 'alreadyUsed';

export interface FigLeafSkipAssessmentInput {
  readonly selected: boolean;
  readonly canEncounterSkip: boolean;
  readonly biomeStart: boolean;
  readonly blockedByEnvelope: boolean;
  readonly nonLeadingCascadePhase: boolean;
  readonly remainingUses: number;
  readonly activatedThisBiome: boolean;
  readonly selectionAlreadyResolved?: boolean;
}

export interface FigLeafSkipAssessment {
  readonly legal: boolean;
  readonly reason?: FigLeafSkipUnavailableReason;
}

/** One declaration-owned Fig Leaf legality decision shared by lifecycle and rewards. */
export function assessFigLeafSkip(input: FigLeafSkipAssessmentInput): FigLeafSkipAssessment {
  if (!input.selected) return Object.freeze({ legal: false });
  if (!input.canEncounterSkip) return Object.freeze({ legal: false, reason: 'declaration' });
  if (input.biomeStart) return Object.freeze({ legal: false, reason: 'biomeStart' });
  if (input.blockedByEnvelope) return Object.freeze({ legal: false, reason: 'envelopeBlocker' });
  if (input.nonLeadingCascadePhase) return Object.freeze({ legal: false, reason: 'cascadeOwner' });
  if (input.selectionAlreadyResolved || input.remainingUses <= 0 || input.activatedThisBiome) {
    return Object.freeze({ legal: false, reason: 'alreadyUsed' });
  }
  return Object.freeze({ legal: true });
}
