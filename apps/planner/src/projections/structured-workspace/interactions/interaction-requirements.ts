import {
  semanticAddressKey,
  type BatchRewardStoreAddress,
  type AdditionalExitAddress,
  type BiomeAddress,
  type EncounterPhaseAddress,
  type ExitDecisionAddress,
  type ExitSelectionAddress,
  type HubDecisionAddress,
  type HubSlotAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectCommand,
  type RewardWheelAddress,
  type ShopPurchaseAddress,
  type SideRoomGeneration,
} from '@run-planner/engine/authored-project';

import type {
  WorkspaceEphyraSideRoomEntryOrderControl,
  WorkspaceExitFrontierCapabilities,
  WorkspaceInteractionChoice,
} from '../contract';
import { StructuredWorkspaceProjectionContractError } from '../contract';

/**
 * Production requirements for the non-reward controls owned by one room-local
 * surface. These are intentionally distinct from the independently derived
 * authored-leaf audit below: Ephyra remains published while dormant during
 * the A2 transition, while a dormant Shop produces no requirement at all.
 */
export type WorkspaceOccurrenceInteractionRequirement =
  | {
      readonly kind: 'naturalChaosSpawn';
      readonly owner: AdditionalExitAddress;
    }
  | {
      readonly kind: 'zagreusSpawn';
      readonly owner: AdditionalExitAddress;
    }
  | {
      readonly generationChoices: readonly WorkspaceInteractionChoice<SideRoomGeneration>[];
      readonly kind: 'ephyraSideRooms';
      readonly owner: LocalChildGroupAddress;
      readonly sideRooms: readonly {
        readonly address: LocalChildAddress;
        readonly entryOrder: WorkspaceEphyraSideRoomEntryOrderControl;
        readonly generation: SideRoomGeneration;
      }[];
    }
  | {
      /** One active exact pool-backed phase, never a profile or rendered ordinal. */
      readonly kind: 'encounterPhases';
      readonly owner: LocalChildAddress | OccurrenceAddress;
      readonly phases: readonly {
        readonly candidateChoices: readonly WorkspaceInteractionChoice<string>[];
        readonly owner: EncounterPhaseAddress;
        readonly selectedEncounterKey: string;
      }[];
    }
  | {
      /** O-specific structural activation for the optional Ship Combat2 phase. */
      readonly combatPhaseCount: 2 | 3;
      readonly combatPhaseCountChoices: readonly WorkspaceInteractionChoice<2 | 3>[];
      readonly kind: 'shipCombatPhaseCount';
      readonly owner: OccurrenceAddress;
      readonly wheels: readonly {
        readonly address: RewardWheelAddress;
        readonly offerCount: number;
        readonly offerCountChoices: readonly WorkspaceInteractionChoice<number>[];
        readonly pickChoices: readonly WorkspaceInteractionChoice<number>[];
        readonly pickedOfferIndex: number;
        readonly storeKey: string;
        readonly storeChoices: readonly WorkspaceInteractionChoice<string>[];
      }[];
    }
  | {
      readonly kind: 'shopPurchaseOrders';
      readonly owner: OccurrenceAddress;
      readonly purchases: readonly {
        readonly owner: ShopPurchaseAddress;
        readonly proposalOfferKeys: readonly (readonly string[])[];
        readonly selectedOfferKeys: readonly string[];
      }[];
    }
  | {
      readonly kind: 'shopDeathDefianceCondition';
      readonly owner: OccurrenceAddress;
      readonly value: boolean;
    };

/**
 * Production requirements for the ordinary controls owned by one authored
 * batch decision. They package the exact surface the batch projection
 * publishes without making takeover, removal, or frontier policy part of
 * this transition.
 */
export interface WorkspaceBatchInteractionRequirement {
  readonly exitSelection?: {
    readonly owner: ExitSelectionAddress;
    readonly selectedExitKey?: string;
    readonly targets: readonly WorkspaceInteractionChoice<string>[];
  };
  readonly fieldsCageOutcome?: {
    readonly owner: ExitDecisionAddress;
    readonly outcomeChoices: readonly WorkspaceInteractionChoice<'min' | 'max'>[];
    readonly selected?: 'min' | 'max';
  };
  readonly kind: 'batchControls';
  readonly owner: ExitDecisionAddress;
  readonly rewardStore?: {
    readonly owner: BatchRewardStoreAddress;
    readonly selected?: string;
    readonly storeChoices: readonly WorkspaceInteractionChoice<string>[];
  };
  readonly zagreusContract?: {
    readonly owner: AdditionalExitAddress;
  };
  readonly naturalChaos?: {
    readonly owner: AdditionalExitAddress;
    readonly occurrence: OccurrenceAddress;
    readonly mapChoices: readonly WorkspaceInteractionChoice<string>[];
  };
}

/**
 * Production requirements for the persistent controls owned by one authored
 * Hub board. Board outline presentation deliberately emits no package.
 */
export interface WorkspaceHubInteractionRequirement {
  readonly kind: 'hubControls';
  readonly owner: HubDecisionAddress;
  readonly slots: readonly (
    | {
        readonly choices: readonly WorkspaceInteractionChoice<boolean>[];
        readonly owner: HubSlotAddress;
        readonly selected: false;
      }
    | {
        readonly choices: readonly WorkspaceInteractionChoice<boolean>[];
        readonly close?: {
          readonly command: Extract<ProjectCommand, { readonly kind: 'CloseHubSlot' }>;
        };
        readonly openedOccurrenceId: OccurrenceId;
        readonly owner: HubSlotAddress;
        readonly selected: true;
      }
  )[];
  /** The exact authored prefix; per-visit markers remain separately projected. */
  readonly visitOrder: readonly string[];
}

/**
 * Production requirements for generic topology-removal controls owned by one
 * authored biome. Hub-slot closure stays with its Hub board package.
 */
export interface WorkspaceTopologyRemovalInteractionRequirement {
  readonly kind: 'topologyRemovals';
  readonly owner: BiomeAddress;
  readonly removals: readonly {
    readonly command: Extract<
      ProjectCommand,
      { readonly kind: 'ClearTopology' | 'RemoveExitDecision' | 'RemoveHubDecision' }
    >;
    readonly key: string;
    readonly owner: BiomeAddress | ExitDecisionAddress | HubDecisionAddress;
  }[];
}

/**
 * Production requirement for the authored start frontier of one topology-free
 * biome. The binder resolves declaration labels and candidate rooms lazily.
 */
export interface WorkspaceStartInteractionRequirement {
  readonly kind: 'start';
  readonly owner: BiomeAddress;
  readonly start:
    | {
        readonly gameName: string;
        readonly kind: 'fixed';
      }
    | {
        readonly gameNames: readonly [string, ...string[]];
        readonly kind: 'choice';
      };
}

/**
 * Production requirement for an authored takeover repair or the completed
 * Hub handoff. Generated Preboss selection is bound by the empty decision's
 * explicit Door 1 Room control instead.
 */
export type WorkspaceTakeoverInteractionRequirement =
  | {
      readonly action: 'reconcile';
      readonly existingTargets: readonly {
        readonly exitKey: string;
        readonly occurrenceId: OccurrenceId;
      }[];
      readonly gameName: string;
      readonly kind: 'takeoverBatch';
      readonly owner: ExitDecisionAddress;
      readonly presentation: 'repair';
      readonly requiredExitKeys: readonly string[];
    }
  | {
      readonly action: 'create';
      readonly gameName: string;
      readonly kind: 'takeoverBatch';
      readonly owner: ExitDecisionAddress;
      readonly presentation: 'completedHubHandoff';
      readonly requiredExitKeys: readonly string[];
    };

/**
 * One declared terminal candidate replaces its exact source envelope with the
 * persistent Hub decision. The requirement is emitted from authored topology,
 * independently of current candidate support.
 */
export interface WorkspaceHubTakeoverInteractionRequirement {
  readonly gameName: string;
  readonly hub: HubDecisionAddress;
  readonly kind: 'hubTakeover';
  readonly owner: ExitDecisionAddress;
}

export type WorkspaceExitFrontierStructuralRequirement = { readonly action: 'createBatch' };

/**
 * Production requirement for a structural authoring frontier. Exit-frontier
 * capability is the public permission to resolve the corresponding action,
 * so it stays packaged with structural creation rather than being rebuilt by
 * an interaction-side topology traversal.
 */
export type WorkspaceFrontierInteractionRequirement = {
  readonly capabilities: WorkspaceExitFrontierCapabilities;
  readonly kind: 'exitFrontier';
  readonly owner: ExitDecisionAddress;
  readonly structural?: WorkspaceExitFrontierStructuralRequirement;
};

function occurrenceInteractionRequirementKey(
  requirement: WorkspaceOccurrenceInteractionRequirement,
): string {
  return `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
}

function batchInteractionRequirementKey(requirement: WorkspaceBatchInteractionRequirement): string {
  return `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
}

function hubInteractionRequirementKey(requirement: WorkspaceHubInteractionRequirement): string {
  return `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
}

function topologyRemovalInteractionRequirementKey(
  requirement: WorkspaceTopologyRemovalInteractionRequirement,
): string {
  return `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
}

function startInteractionRequirementKey(requirement: WorkspaceStartInteractionRequirement): string {
  return `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
}

export function workspaceTakeoverInteractionRequirementKey(
  requirement: WorkspaceTakeoverInteractionRequirement,
): string {
  return `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
}

export function workspaceHubTakeoverInteractionRequirementKey(
  requirement: WorkspaceHubTakeoverInteractionRequirement,
): string {
  return `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
}

function frontierInteractionRequirementKey(
  requirement: WorkspaceFrontierInteractionRequirement,
): string {
  return `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
}

export function appendUniqueOccurrenceInteractionRequirements(
  requirementsByIdentity: Map<string, WorkspaceOccurrenceInteractionRequirement>,
  requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>,
): void {
  for (const requirement of requirements) {
    const key = occurrenceInteractionRequirementKey(requirement);
    if (requirementsByIdentity.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected occurrence interaction requirements`,
      );
    }
    requirementsByIdentity.set(key, requirement);
  }
}

export function appendUniqueBatchInteractionRequirements(
  requirementsByIdentity: Map<string, WorkspaceBatchInteractionRequirement>,
  requirements: Iterable<WorkspaceBatchInteractionRequirement>,
): void {
  for (const requirement of requirements) {
    const key = batchInteractionRequirementKey(requirement);
    if (requirementsByIdentity.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected batch interaction requirements`,
      );
    }
    requirementsByIdentity.set(key, requirement);
  }
}

export function appendUniqueHubInteractionRequirements(
  requirementsByIdentity: Map<string, WorkspaceHubInteractionRequirement>,
  requirements: Iterable<WorkspaceHubInteractionRequirement>,
): void {
  for (const requirement of requirements) {
    const key = hubInteractionRequirementKey(requirement);
    if (requirementsByIdentity.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected Hub interaction requirements`,
      );
    }
    requirementsByIdentity.set(key, requirement);
  }
}

export function appendUniqueTopologyRemovalInteractionRequirements(
  requirementsByIdentity: Map<string, WorkspaceTopologyRemovalInteractionRequirement>,
  requirements: Iterable<WorkspaceTopologyRemovalInteractionRequirement>,
): void {
  for (const requirement of requirements) {
    const key = topologyRemovalInteractionRequirementKey(requirement);
    if (requirementsByIdentity.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected topology-removal interaction requirements`,
      );
    }
    requirementsByIdentity.set(key, requirement);
  }
}

export function appendUniqueStartInteractionRequirements(
  requirementsByIdentity: Map<string, WorkspaceStartInteractionRequirement>,
  requirements: Iterable<WorkspaceStartInteractionRequirement>,
): void {
  for (const requirement of requirements) {
    const key = startInteractionRequirementKey(requirement);
    if (requirementsByIdentity.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected start interaction requirements`,
      );
    }
    requirementsByIdentity.set(key, requirement);
  }
}

export function appendUniqueTakeoverInteractionRequirements(
  requirementsByIdentity: Map<string, WorkspaceTakeoverInteractionRequirement>,
  requirements: Iterable<WorkspaceTakeoverInteractionRequirement>,
): void {
  for (const requirement of requirements) {
    const key = workspaceTakeoverInteractionRequirementKey(requirement);
    if (requirementsByIdentity.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected takeover interaction requirements`,
      );
    }
    requirementsByIdentity.set(key, requirement);
  }
}

export function appendUniqueHubTakeoverInteractionRequirements(
  requirementsByIdentity: Map<string, WorkspaceHubTakeoverInteractionRequirement>,
  requirements: Iterable<WorkspaceHubTakeoverInteractionRequirement>,
): void {
  for (const requirement of requirements) {
    const key = workspaceHubTakeoverInteractionRequirementKey(requirement);
    if (requirementsByIdentity.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected Hub takeover interaction requirements`,
      );
    }
    requirementsByIdentity.set(key, requirement);
  }
}

export function appendUniqueFrontierInteractionRequirements(
  requirementsByIdentity: Map<string, WorkspaceFrontierInteractionRequirement>,
  requirements: Iterable<WorkspaceFrontierInteractionRequirement>,
): void {
  for (const requirement of requirements) {
    const key = frontierInteractionRequirementKey(requirement);
    if (requirementsByIdentity.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple projected frontier interaction requirements`,
      );
    }
    requirementsByIdentity.set(key, requirement);
  }
}
