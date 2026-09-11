import {
  semanticAddressKey,
  type OccurrenceAddress,
  type TargetAddress,
} from '../../authored-project/addresses';
import type { RoomTargetCandidateContext } from './model';

/** The room-target capability produced while one biome is evaluated. */
export interface RoomTargetCandidateArtifacts {
  readonly at: (target: TargetAddress) => RoomTargetCandidateContext | undefined;
}

export function createRoomTargetCandidateArtifacts(
  contexts: ReadonlyMap<string, RoomTargetCandidateContext>,
): RoomTargetCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (target: TargetAddress) => privateContexts.get(semanticAddressKey(target)),
  });
}

/** Exact reached-source Chaos placement support for ordinary authoring. */
export interface ChaosCandidateCapability {
  readonly placementEligible: boolean;
  readonly failedConditions: readonly string[];
}
export interface ChaosCandidateArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => ChaosCandidateCapability | undefined;
}
export function createChaosCandidateArtifacts(
  contexts: ReadonlyMap<string, ChaosCandidateCapability>,
): ChaosCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => privateContexts.get(semanticAddressKey(occurrence)),
  });
}
export function createEmptyChaosCandidateArtifacts(): ChaosCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

/** Exact reached-source Zagreus Contract entry-cap support. */
export interface ZagreusContractCandidateCapability {
  readonly placementEligible: boolean;
  readonly enteredContractCount: number;
  readonly maximumEnteredThisRoute: number;
}
export interface ZagreusContractCandidateArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => ZagreusContractCandidateCapability | undefined;
}
export function createZagreusContractCandidateArtifacts(
  contexts: ReadonlyMap<string, ZagreusContractCandidateCapability>,
): ZagreusContractCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => privateContexts.get(semanticAddressKey(occurrence)),
  });
}
export function createEmptyZagreusContractCandidateArtifacts(): ZagreusContractCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}
