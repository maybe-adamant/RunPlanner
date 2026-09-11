import {
  semanticAddressKey,
  type FigurineArcanaAddress,
  type FountainRarityOutcomeAddress,
  type KeepsakeEquipResultAddress,
  type KeepsakeSelectionAddress,
  type TranscendentEmbryoOutcomeAddress,
} from '../../authored-project/addresses';
import type { ArcanaFearState } from '../arcana-fear';
import { type FatedStatus, type KeepsakeState } from './state';
import {
  assessTranscendentEmbryoTransformation,
  type PhialLifecycleStatus,
  type ReachedTranscendentEmbryoThreshold,
  type TranscendentEmbryoBlessingAssessment,
} from './trait-effects';
import type { TraitHistoryState } from '../traits';

/** Exact rack frontier captured by the selected chronological reward walk. */
export interface KeepsakeSelectionCandidateCapability {
  readonly state: KeepsakeState;
  readonly encounterBlockedKeepsakeKeys: readonly string[];
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

/** Exact pre-equip trait state retained for one closed keepsake result. */
export interface KeepsakeEquipResultCandidateCapability {
  readonly frontiers: readonly {
    readonly before: TraitHistoryState;
    readonly arcanaFear?: ArcanaFearState;
    readonly fatedStatus: FatedStatus;
    readonly transcendentEmbryoRarity?: import('../../catalog-schema').InRunTraitRarity;
    readonly loadout?: { readonly weaponKey: string; readonly aspectKey: string };
  }[];
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

/** Exact pre-fountain Phial frontiers retained by the reached action. */
export interface FountainRarityCandidateFrontier {
  readonly status: PhialLifecycleStatus | undefined;
  readonly consumptionTargetKeys: readonly string[];
  readonly mutationTargetKeys: readonly string[];
}
export interface FountainRarityCandidateCapability {
  readonly frontiers: readonly FountainRarityCandidateFrontier[];
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
  readonly thresholds: readonly ReachedTranscendentEmbryoThreshold[];
  readonly evaluate: (
    outcome:
      import('../../authored-project/traits').AuthoredTranscendentEmbryoOutcome | null | undefined,
  ) => readonly TranscendentEmbryoBlessingAssessment[];
}
export interface TranscendentEmbryoCandidateArtifacts {
  readonly at: (
    address: TranscendentEmbryoOutcomeAddress,
  ) => TranscendentEmbryoCandidateCapability | undefined;
}
export function createTranscendentEmbryoCandidateArtifacts(
  catalog: import('../../catalog-schema').Catalog,
  contexts: ReadonlyMap<string, readonly ReachedTranscendentEmbryoThreshold[]>,
): TranscendentEmbryoCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: TranscendentEmbryoOutcomeAddress) => {
      const thresholds = privateContexts.get(semanticAddressKey(address));
      if (thresholds === undefined) return undefined;
      return Object.freeze({
        thresholds,
        evaluate: (
          outcome:
            | import('../../authored-project/traits').AuthoredTranscendentEmbryoOutcome
            | null
            | undefined,
        ) =>
          Object.freeze(
            thresholds.map((threshold) =>
              assessTranscendentEmbryoTransformation(catalog, threshold, outcome),
            ),
          ),
      });
    },
  });
}
export function createEmptyTranscendentEmbryoCandidateArtifacts(): TranscendentEmbryoCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}
