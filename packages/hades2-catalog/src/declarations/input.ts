import type {
  BiomeDeclaration,
  ExitCompatibilityPolicy,
  RouteDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RawArcanaCardDeclaration, RawFearVowDeclaration } from './arcana-fear-types';
import type {
  RawEncounterDefinitionDeclaration,
  RawEncounterEnvelopeDeclaration,
  RawEncounterSetDeclaration,
} from './encounters/types';
import type { RawExitTypeDeclaration } from './exits-types';
import type { RawKeepsakeDeclaration } from './keepsakes-types';
import type { RawBiomeLayoutDeclaration } from './layouts/types';
import type { RawRoomLifecycleProfileDeclaration } from './lifecycles/types';
import type { RawRewardKernelInput } from './rewards/types';
import type { RawRoomDeclaration } from './rooms/types';
import type { RawTraitCatalogInput } from './traits';

export interface RawCatalogInput {
  readonly version: string;
  readonly biomes: readonly BiomeDeclaration[];
  readonly routes: readonly RouteDeclaration[];
  readonly arcanaCards: readonly RawArcanaCardDeclaration[];
  readonly fearVows: readonly RawFearVowDeclaration[];
  readonly keepsakes: readonly RawKeepsakeDeclaration[];
  readonly rewardKernel: RawRewardKernelInput;
  readonly encounterEnvelopes: readonly RawEncounterEnvelopeDeclaration[];
  readonly encounterDefinitions: readonly RawEncounterDefinitionDeclaration[];
  readonly encounterSets: readonly RawEncounterSetDeclaration[];
  readonly roomLifecycleProfiles: readonly RawRoomLifecycleProfileDeclaration[];
  readonly exitCompatibilityPolicies: readonly ExitCompatibilityPolicy[];
  readonly exitTypes: readonly RawExitTypeDeclaration[];
  readonly rooms: readonly RawRoomDeclaration[];
  readonly biomeLayouts: readonly RawBiomeLayoutDeclaration[];
  readonly traitCatalog: RawTraitCatalogInput;
}
