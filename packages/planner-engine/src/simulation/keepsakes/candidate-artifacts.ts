import type { SimulationState } from '../state/model';
import {
  semanticAddressKey,
  type FigurineArcanaAddress,
  type FountainRarityOutcomeAddress,
  type KeepsakeEquipResultAddress,
  type KeepsakeSelectionAddress,
  type TranscendentEmbryoOutcomeAddress,
} from '../../authored-project/addresses';
import type { CurrentArcanaCard } from '../arcana-fear';
import { type KeepsakeState } from './state';
import {
  assessTranscendentEmbryoTransformation,
  type PhialLifecycleStatus,
  type ReachedTranscendentEmbryoThreshold,
  type TranscendentEmbryoBlessingAssessment,
} from './trait-effects';

/** Exact rack frontier captured by the selected chronological reward walk. */
export interface KeepsakeSelectionCandidateCapability {
  readonly state: KeepsakeState;
  readonly encounterBlockedKeepsakeKeys: readonly string[];
  /**
   * The equip result a keepsake chosen here would open, with its pre-result frontiers from
   * this same frontier; undefined when the keepsake has none or cannot be equipped here.
   */
  readonly equipResultFor: (keepsakeKey: string) => KeepsakeDraftEquipResult | undefined;
}

/** An equip result opened by a keepsake drafted at a selection, before it is authored. */
export interface KeepsakeDraftEquipResult {
  readonly result: KeepsakeEquipResultAddress;
  readonly capability: KeepsakeEquipResultCandidateCapability;
}
export interface KeepsakeSelectionCandidateArtifacts {
  readonly at: (
    address: KeepsakeSelectionAddress,
  ) => KeepsakeSelectionCandidateCapability | undefined;
  readonly entries: () => readonly (readonly [string, KeepsakeSelectionCandidateCapability])[];
}
export function createKeepsakeSelectionCandidateArtifacts(
  contexts: ReadonlyMap<string, KeepsakeSelectionCandidateCapability>,
): KeepsakeSelectionCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: KeepsakeSelectionAddress) => privateContexts.get(semanticAddressKey(address)),
    entries: () => Object.freeze([...privateContexts.entries()]),
  });
}

/** The exact pre-equip state retained for one closed keepsake result. */
export interface KeepsakeEquipResultCandidateCapability {
  readonly state: SimulationState;
  readonly transcendentEmbryoRarity?: import('../../catalog-schema').InRunTraitRarity;
}
export interface KeepsakeEquipResultCandidateArtifacts {
  readonly at: (
    address: KeepsakeEquipResultAddress,
  ) => KeepsakeEquipResultCandidateCapability | undefined;
  readonly entries: () => readonly (readonly [string, KeepsakeEquipResultCandidateCapability])[];
}
export function createKeepsakeEquipResultCandidateArtifacts(
  contexts: ReadonlyMap<string, KeepsakeEquipResultCandidateCapability>,
): KeepsakeEquipResultCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: KeepsakeEquipResultAddress) => privateContexts.get(semanticAddressKey(address)),
    entries: () => Object.freeze([...privateContexts.entries()]),
  });
}

/** The exact pre-fountain Phial frontier retained by the reached action. */
export interface FountainRarityCandidateCapability {
  readonly status: PhialLifecycleStatus | undefined;
  readonly consumptionTargetKeys: readonly string[];
  readonly mutationTargetKeys: readonly string[];
}
export interface FountainRarityCandidateArtifacts {
  readonly at: (
    address: FountainRarityOutcomeAddress,
  ) => FountainRarityCandidateCapability | undefined;
  readonly entries: () => readonly (readonly [string, FountainRarityCandidateCapability])[];
}
export function createFountainRarityCandidateArtifacts(
  contexts: ReadonlyMap<string, FountainRarityCandidateCapability>,
): FountainRarityCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: FountainRarityOutcomeAddress) => privateContexts.get(semanticAddressKey(address)),
    entries: () => Object.freeze([...privateContexts.entries()]),
  });
}
export function createEmptyFountainRarityCandidateArtifacts(): FountainRarityCandidateArtifacts {
  return createFountainRarityCandidateArtifacts(new Map());
}

export interface FigurineArcanaCandidateCapability {
  readonly activeArcana: readonly CurrentArcanaCard[];
  readonly activeArcanaKeys: readonly string[];
  readonly inactiveArcanaKeys: readonly string[];
  readonly requiredCount: number;
  readonly rarity: import('../../catalog-schema').TraitRarity;
}
export interface FigurineArcanaCandidateArtifacts {
  readonly at: (address: FigurineArcanaAddress) => FigurineArcanaCandidateCapability | undefined;
}
export function createFigurineArcanaCandidateArtifacts(
  contexts: ReadonlyMap<string, FigurineArcanaCandidateCapability>,
): FigurineArcanaCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: FigurineArcanaAddress) => privateContexts.get(semanticAddressKey(address)),
  });
}

export interface TranscendentEmbryoCandidateCapability {
  readonly threshold: ReachedTranscendentEmbryoThreshold;
  readonly evaluate: (
    outcome:
      | import('../../authored-project/traits/state').AuthoredTranscendentEmbryoOutcome
      | null
      | undefined,
  ) => TranscendentEmbryoBlessingAssessment;
}
export interface TranscendentEmbryoCandidateArtifacts {
  readonly at: (
    address: TranscendentEmbryoOutcomeAddress,
  ) => TranscendentEmbryoCandidateCapability | undefined;
}
export function createTranscendentEmbryoCandidateArtifacts(
  catalog: import('../../catalog-schema').Catalog,
  contexts: ReadonlyMap<string, ReachedTranscendentEmbryoThreshold>,
): TranscendentEmbryoCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: TranscendentEmbryoOutcomeAddress) => {
      const threshold = privateContexts.get(semanticAddressKey(address));
      if (threshold === undefined) return undefined;
      return Object.freeze({
        threshold,
        evaluate: (
          outcome:
            | import('../../authored-project/traits/state').AuthoredTranscendentEmbryoOutcome
            | null
            | undefined,
        ) => assessTranscendentEmbryoTransformation(catalog, threshold, outcome),
      });
    },
  });
}
export function createEmptyTranscendentEmbryoCandidateArtifacts(): TranscendentEmbryoCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}
