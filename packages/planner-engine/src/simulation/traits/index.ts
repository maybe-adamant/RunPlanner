/**
 * Deliberate trait-simulation entry. New simulation consumers
 * import their nearest semantic owner; this entry preserves the published
 * engine vocabulary.
 */
export * from './history';
export * from './offer-domain';
export * from './offers';
export * from './level-effects';
export {
  assessNaturalSelectionTargets,
  assessSelectedTargetedAcquisition,
  assessTraitOffer,
  assessTraitOfferBeforeRarification,
  assessTraitOption,
  assessTraitReplacementComposition,
  traitCandidates,
  traitOfferCompositionDomains,
} from './authoring/assessment';
export type {
  NaturalSelectionStep,
  NaturalSelectionTargetAssessment,
  TraitFindingCode,
} from './authoring/assessment';
export {
  nextOptionalHighTierTraitOfferDraft,
  nextTraitOfferDraft,
  previousOptionalHighTierTraitOfferDraft,
  traitOfferStartingDraft,
} from './authoring/drafts';
