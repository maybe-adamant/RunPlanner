import type {
  BiomeDeclaration,
  ExitCompatibilityPolicy,
  GoldCatalogDeclaration,
  RouteDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RawArcanaCardDeclaration, RawFearVowDeclaration } from './arcana-fear-types';
import type {
  RawEncounterDefinitionDeclaration,
  RawEncounterEnvelopeDeclaration,
  RawEncounterSetDeclaration,
  RawEnemyGoldDropDeclaration,
} from './encounters/types';
import type { RawExitTypeDeclaration } from './exits-types';
import type { RawFamiliarDeclaration } from './familiars-types';
import type { RawKeepsakeDeclaration } from './keepsakes-types';
import type { RawBiomeLayoutDeclaration } from './layouts/types';
import type { RawRoomLifecycleProfileDeclaration } from './lifecycles/types';
import type { RawRewardKernelInput, RawRewardProducerBinding } from './rewards/types';
import type { RawRoomDeclaration } from './rooms/types';
import type { RawTraitCatalogInput } from './traits/types';

export interface RawCatalogInput {
  readonly version: string;
  readonly biomes: readonly BiomeDeclaration[];
  readonly routes: readonly RouteDeclaration[];
  readonly runStartReward: RawRewardProducerBinding;
  readonly arcanaCards: readonly RawArcanaCardDeclaration[];
  readonly fearVows: readonly RawFearVowDeclaration[];
  readonly keepsakes: readonly RawKeepsakeDeclaration[];
  readonly familiars: readonly RawFamiliarDeclaration[];
  readonly defaultFamiliarKey: string;
  readonly heroMaxStats: { readonly maxHealth: number; readonly maxMana: number };
  readonly gold: GoldCatalogDeclaration;
  readonly rewardKernel: RawRewardKernelInput;
  readonly encounterEnvelopes: readonly RawEncounterEnvelopeDeclaration[];
  readonly encounterDefinitions: readonly RawEncounterDefinitionDeclaration[];
  readonly encounterSets: readonly RawEncounterSetDeclaration[];
  /** Native kill drops of every enemy a known roster can field. */
  readonly enemyGoldDrops: readonly RawEnemyGoldDropDeclaration[];
  /** RequirementsData.lua `NoRecentFieldNPCEncounter`: the field-NPC spacing set. */
  readonly fieldNpcEncounterKeys: readonly string[];
  readonly roomLifecycleProfiles: readonly RawRoomLifecycleProfileDeclaration[];
  readonly exitCompatibilityPolicies: readonly ExitCompatibilityPolicy[];
  readonly exitTypes: readonly RawExitTypeDeclaration[];
  readonly rooms: readonly RawRoomDeclaration[];
  /** Map exit doors in door-setup order, as [ObjectId, obstacle name], by room game name. */
  readonly exitDoorSetupOrders: Readonly<
    Record<string, readonly (readonly [doorId: number, obstacleName: string])[]>
  >;
  /** Golden-urn swap candidates on each room's map, by room game name. */
  readonly swappableBreakables: Readonly<Record<string, number>>;
  readonly biomeLayouts: readonly RawBiomeLayoutDeclaration[];
  readonly traitCatalog: RawTraitCatalogInput;
}
