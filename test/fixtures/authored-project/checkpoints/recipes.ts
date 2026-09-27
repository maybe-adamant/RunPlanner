import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { AuthoredProjectCheckpointId } from './manifest';
import { dreamMixedHandoffProject } from '../routes/dream';
import {
  createNemesisFieldsCheckpoint,
  createNemesisPomSeaStarCheckpoint,
  createNemesisTraitTradeCheckpoint,
} from '../routes/nemesis-random-events';
import {
  createSurfaceNBuriedTreasureCheckpoint,
  createSurfaceNNaturalSelectionCheckpoint,
  createSurfaceNNaturalSelectionFrontier,
  createSurfaceNQueensRansomCheckpoint,
  createSurfaceNQuickBuckCheckpoint,
  createSurfaceNSteadyGrowthFrontier,
} from '../routes/run-impacting-traits';
import { surfaceScheduledLifecycleProject } from '../routes/scheduled-lifecycle';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  createSurfaceNShrineSideRoomDeliveryCheckpoint,
  surfaceAnvilProject,
  surfaceEncounterShowcaseProject,
  surfaceNPhialIntermediateFountainProject,
  surfaceOrdinaryHexPathProject,
  surfaceSeleneHexPathProject,
  surfaceShrineTravelDealProject,
} from '../routes/surface';
import {
  anomalyRosterProject,
  createCompleteFGIxionChaosProject,
  createUnderworldFPoolCheckpoint,
  createUnderworldFWellCheckpoint,
  underworldArachneCocoonProject,
  underworldAutomaticBossProject,
  underworldFigLeafSkipProject,
  underworldGeneratedCompositionProject,
  underworldGorgonAthenaProject,
  underworldPersephoneCallingCardProject,
  underworldTwistScyllaProject,
  underworldWorldShopTravelDealProject,
  underworldZagreusContractProject,
} from '../routes/underworld';

export interface RecipeBackedCheckpoint {
  readonly id: AuthoredProjectCheckpointId;
  readonly create: () => ProjectDocument;
}

/**
 * Canonical checkpoints whose complete authored state is owned by a command
 * recipe. Imported/user-authored saves intentionally stay out of this table:
 * their static loader and canonical-byte integrity coverage remains primary.
 */
export const recipeBackedCheckpoints = Object.freeze([
  { id: 'dream-mixed-handoff', create: dreamMixedHandoffProject },
  { id: 'underworld-f-pool', create: createUnderworldFPoolCheckpoint },
  { id: 'underworld-f-stygian-well', create: createUnderworldFWellCheckpoint },
  { id: 'underworld-generated-composition', create: underworldGeneratedCompositionProject },
  { id: 'underworld-ixion-chaos', create: createCompleteFGIxionChaosProject },
  { id: 'underworld-g-anomaly-roster', create: anomalyRosterProject },
  { id: 'underworld-arachne-cocoons', create: underworldArachneCocoonProject },
  { id: 'underworld-automatic-boss', create: underworldAutomaticBossProject },
  { id: 'underworld-fig-leaf', create: underworldFigLeafSkipProject },
  { id: 'underworld-gorgon-athena', create: underworldGorgonAthenaProject },
  { id: 'underworld-persephone-calling-card', create: underworldPersephoneCallingCardProject },
  { id: 'underworld-twist-scylla', create: underworldTwistScyllaProject },
  { id: 'underworld-world-shop-travel-deal', create: underworldWorldShopTravelDealProject },
  { id: 'underworld-zagreus-contract', create: underworldZagreusContractProject },
  { id: 'surface-anvil', create: surfaceAnvilProject },
  { id: 'surface-ordinary-hex-path', create: surfaceOrdinaryHexPathProject },
  { id: 'surface-selene-hex-path', create: surfaceSeleneHexPathProject },
  { id: 'surface-shrine-travel-deal', create: surfaceShrineTravelDealProject },
  { id: 'surface-encounter-showcase', create: surfaceEncounterShowcaseProject },
  { id: 'surface-scheduled-lifecycle', create: surfaceScheduledLifecycleProject },
  { id: 'surface-n-phial-intermediate-fountain', create: surfaceNPhialIntermediateFountainProject },
  {
    id: 'surface-n-shrine-side-room-delivery',
    create: createSurfaceNShrineSideRoomDeliveryCheckpoint,
  },
  {
    id: 'surface-no-hermes-shrine-delivery',
    create: createSurfaceNOHermesShrineDeliveryCheckpoint,
  },
  { id: 'surface-n-natural-selection-frontier', create: createSurfaceNNaturalSelectionFrontier },
  { id: 'surface-n-natural-selection', create: createSurfaceNNaturalSelectionCheckpoint },
  { id: 'surface-n-quick-buck', create: createSurfaceNQuickBuckCheckpoint },
  { id: 'surface-n-buried-treasure', create: createSurfaceNBuriedTreasureCheckpoint },
  { id: 'surface-n-queens-ransom', create: createSurfaceNQueensRansomCheckpoint },
  { id: 'surface-n-steady-growth-frontier', create: createSurfaceNSteadyGrowthFrontier },
  { id: 'nemesis-f-trait-trade', create: createNemesisTraitTradeCheckpoint },
  { id: 'nemesis-h-fields', create: createNemesisFieldsCheckpoint },
  { id: 'nemesis-f-pom-sea-star', create: createNemesisPomSeaStarCheckpoint },
] as const satisfies readonly RecipeBackedCheckpoint[]);
