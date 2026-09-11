import { semanticAddressKey, type BiomeAddress } from '../authored-project/addresses';
import {
  createEmptyRoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateArtifacts,
} from './rewards/lifecycle-artifacts';
import {
  createEmptyRewardProducerCandidateArtifacts,
  type RewardProducerCandidateArtifacts,
} from './rewards/producer-frontiers';
import {
  createEmptyLevelResolutionCandidateArtifacts,
  createEmptyTraitOfferCandidateArtifacts,
  type LevelResolutionCandidateArtifacts,
  type TraitOfferCandidateArtifacts,
} from './candidates/trait-offer-capability';
import {
  createEmptyEncounterCandidateArtifacts,
  type EncounterCandidateArtifacts,
} from './encounters/candidates';
import {
  createEmptyChaosCandidateArtifacts,
  createEmptyZagreusContractCandidateArtifacts,
  createRoomTargetCandidateArtifacts,
  type ChaosCandidateArtifacts,
  type RoomTargetCandidateArtifacts,
  type ZagreusContractCandidateArtifacts,
} from './generation/candidate-artifacts';
import {
  createEmptyFountainRarityCandidateArtifacts,
  createEmptyTranscendentEmbryoCandidateArtifacts,
  createFigurineArcanaCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  type FigurineArcanaCandidateArtifacts,
  type FountainRarityCandidateArtifacts,
  type KeepsakeEquipResultCandidateArtifacts,
  type KeepsakeEquipResultCandidateCapability,
  type KeepsakeSelectionCandidateArtifacts,
  type KeepsakeSelectionCandidateCapability,
  type TranscendentEmbryoCandidateArtifacts,
} from './keepsakes/candidate-artifacts';
import {
  createEmptyAcquisitionConversionCandidateArtifacts,
  createEmptyDerivedAcquisitionEntryCandidateArtifacts,
  type AcquisitionConversionCandidateArtifacts,
  type DerivedAcquisitionEntryCandidateArtifacts,
} from './rewards/acquisition-artifacts';
import {
  createEmptySteadyGrowthCandidateArtifacts,
  type SteadyGrowthCandidateArtifacts,
} from './trait-history';
import {
  createJudgmentArcanaCandidateArtifacts,
  type JudgmentArcanaCandidateArtifacts,
} from './arcana-fear';
import {
  createEmptyPurgingPoolCandidateArtifacts,
  type PurgingPoolCandidateArtifacts,
} from './purging-pool';
import {
  createEmptyHermesShrineCandidateArtifacts,
  type HermesShrineCandidateArtifacts,
} from './hermes-shrine';
import {
  createEmptyStygianWellCandidateArtifacts,
  type StygianWellCandidateArtifacts,
} from './stygian-well';

export interface BiomeCandidateArtifacts {
  readonly origin: BiomeAddress;
  readonly roomTargets: RoomTargetCandidateArtifacts;
  readonly rewardProducers: RewardProducerCandidateArtifacts;
  readonly roomLifecycles: RoomLifecycleCandidateArtifacts;
  readonly encounters: EncounterCandidateArtifacts;
  readonly traitOffers: TraitOfferCandidateArtifacts;
  readonly levelResolutions: LevelResolutionCandidateArtifacts;
  readonly judgmentArcana: JudgmentArcanaCandidateArtifacts;
  readonly figurineArcana: FigurineArcanaCandidateArtifacts;
  readonly keepsakeSelections: KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResults: KeepsakeEquipResultCandidateArtifacts;
  readonly acquisitionConversions: AcquisitionConversionCandidateArtifacts;
  readonly derivedAcquisitionEntries: DerivedAcquisitionEntryCandidateArtifacts;
  readonly steadyGrowth: SteadyGrowthCandidateArtifacts;
  readonly transcendentEmbryo: TranscendentEmbryoCandidateArtifacts;
  readonly fountainRarity: FountainRarityCandidateArtifacts;
  readonly purgingPools: PurgingPoolCandidateArtifacts;
  readonly hermesShrines: HermesShrineCandidateArtifacts;
  readonly stygianWells: StygianWellCandidateArtifacts;
  readonly chaos: ChaosCandidateArtifacts;
  readonly zagreusContracts: ZagreusContractCandidateArtifacts;
}

export interface ProjectCandidateArtifacts {
  readonly biomeAt: (biome: BiomeAddress) => BiomeCandidateArtifacts | undefined;
  readonly keepsakeSelections: KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResults: KeepsakeEquipResultCandidateArtifacts;
}

export class CandidateArtifactContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'CandidateArtifactContractError';
  }
}

export function createBiomeCandidateArtifacts(
  origin: BiomeAddress,
  roomTargets: RoomTargetCandidateArtifacts,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
  encounters: EncounterCandidateArtifacts = createEmptyEncounterCandidateArtifacts(),
  traitOffers: TraitOfferCandidateArtifacts = createEmptyTraitOfferCandidateArtifacts(),
  levelResolutions: LevelResolutionCandidateArtifacts = createEmptyLevelResolutionCandidateArtifacts(),
  judgmentArcana: JudgmentArcanaCandidateArtifacts = createJudgmentArcanaCandidateArtifacts(
    new Map(),
  ),
  keepsakeSelections: KeepsakeSelectionCandidateArtifacts = createKeepsakeSelectionCandidateArtifacts(
    new Map(),
  ),
  keepsakeEquipResults: KeepsakeEquipResultCandidateArtifacts = createKeepsakeEquipResultCandidateArtifacts(
    new Map(),
  ),
  acquisitionConversions: AcquisitionConversionCandidateArtifacts = createEmptyAcquisitionConversionCandidateArtifacts(),
  derivedAcquisitionEntries: DerivedAcquisitionEntryCandidateArtifacts = createEmptyDerivedAcquisitionEntryCandidateArtifacts(),
  steadyGrowth: SteadyGrowthCandidateArtifacts = createEmptySteadyGrowthCandidateArtifacts(),
  purgingPools: PurgingPoolCandidateArtifacts = createEmptyPurgingPoolCandidateArtifacts(),
  hermesShrines: HermesShrineCandidateArtifacts = createEmptyHermesShrineCandidateArtifacts(),
  stygianWells: StygianWellCandidateArtifacts = createEmptyStygianWellCandidateArtifacts(),
  fountainRarity: FountainRarityCandidateArtifacts = createEmptyFountainRarityCandidateArtifacts(),
  figurineArcana: FigurineArcanaCandidateArtifacts = createFigurineArcanaCandidateArtifacts(
    new Map(),
  ),
  transcendentEmbryo: TranscendentEmbryoCandidateArtifacts = createEmptyTranscendentEmbryoCandidateArtifacts(),
  chaos: ChaosCandidateArtifacts = createEmptyChaosCandidateArtifacts(),
  zagreusContracts: ZagreusContractCandidateArtifacts = createEmptyZagreusContractCandidateArtifacts(),
): BiomeCandidateArtifacts {
  return Object.freeze({
    origin,
    roomTargets,
    rewardProducers,
    roomLifecycles,
    encounters,
    traitOffers,
    levelResolutions,
    judgmentArcana,
    figurineArcana,
    keepsakeSelections,
    keepsakeEquipResults,
    acquisitionConversions,
    derivedAcquisitionEntries,
    steadyGrowth,
    transcendentEmbryo,
    fountainRarity,
    purgingPools,
    hermesShrines,
    stygianWells,
    chaos,
    zagreusContracts,
  });
}

export function createEmptyBiomeCandidateArtifacts(origin: BiomeAddress): BiomeCandidateArtifacts {
  return createBiomeCandidateArtifacts(
    origin,
    createRoomTargetCandidateArtifacts(new Map()),
    createEmptyRewardProducerCandidateArtifacts(),
    createEmptyRoomLifecycleCandidateArtifacts(),
    createEmptyEncounterCandidateArtifacts(),
    createEmptyTraitOfferCandidateArtifacts(),
    createEmptyLevelResolutionCandidateArtifacts(),
  );
}

export function createProjectCandidateArtifacts(
  biomes: readonly BiomeCandidateArtifacts[],
  routeStartKeepsakes: ReadonlyMap<string, KeepsakeSelectionCandidateCapability> = new Map(),
  routeStartKeepsakeEquipResults: ReadonlyMap<
    string,
    KeepsakeEquipResultCandidateCapability
  > = new Map(),
): ProjectCandidateArtifacts {
  const privateBiomes = new Map<string, BiomeCandidateArtifacts>();
  const keepsakeSelections = new Map(routeStartKeepsakes);
  const keepsakeEquipResults = new Map(routeStartKeepsakeEquipResults);
  for (const biome of biomes) {
    const key = semanticAddressKey(biome.origin);
    if (privateBiomes.has(key)) {
      throw new CandidateArtifactContractError(`duplicate candidate artifacts for ${key}`);
    }
    privateBiomes.set(key, biome);
    // A Postboss artifact is produced by the one reward walk that reaches its
    // fixed-linked occurrence. Duplicate publication would be a chronology bug.
    for (const [selectionKey, capability] of biome.keepsakeSelections.entries()) {
      if (keepsakeSelections.has(selectionKey))
        throw new CandidateArtifactContractError(
          `duplicate keepsake candidate artifact for ${selectionKey}`,
        );
      keepsakeSelections.set(selectionKey, capability);
    }
    for (const [resultKey, capability] of biome.keepsakeEquipResults.entries()) {
      if (keepsakeEquipResults.has(resultKey))
        throw new CandidateArtifactContractError(
          `duplicate keepsake equip-result candidate artifact for ${resultKey}`,
        );
      keepsakeEquipResults.set(resultKey, capability);
    }
  }
  return Object.freeze({
    biomeAt: (biome: BiomeAddress) => privateBiomes.get(semanticAddressKey(biome)),
    keepsakeSelections: createKeepsakeSelectionCandidateArtifacts(keepsakeSelections),
    keepsakeEquipResults: createKeepsakeEquipResultCandidateArtifacts(keepsakeEquipResults),
  });
}
