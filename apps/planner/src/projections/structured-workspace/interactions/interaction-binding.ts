import {
  createOccurrenceAddress,
  createCirceResolutionAddress,
  createEchoPomTargetAddress,
  createEchoLastRunBoonAddress,
  createEchoLastRewardAddress,
  createAllTogetherSetAddress,
  createAcquisitionSiteAddress,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createTraitOfferAddress,
  createLevelResolutionAddress,
  optionIndex,
  createDefaultAllTogetherResult,
  traitGiverForAcquisitionRole,
  semanticAddressKey,
  type OccurrenceId,
  type SemanticAddress,
  type SideRoomGeneration,
  type TargetAddress,
  type TraitOfferAddress,
  type LevelResolutionAddress,
  type BossCompletionArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type DerivedShopEntryEditCommand,
  type ProjectCommand,
  type AuthoredRewardState,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredLevelResolution,
  AuthoredCirceResolution,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  AuthoredEchoLastRunBoonOffer,
  AuthoredEchoLastRewardAcquisition,
  TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { ProjectEvaluationAssembly } from '@run-planner/engine/simulation';

import {
  candidateSupport,
  type CandidateOptionProjection,
  type CandidateProjectionEvaluation,
  type CandidateProjectionSession,
} from '@planner/projections/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { projectEncounterPicker } from '@planner/projections/encounterPickerProjection';
import {
  roomCategoryForKind,
  roomSelectorCategories,
  selectRoomsForTargetCategory,
} from '@planner/projections/roomSelectorProjection';
import { createTakeoverBatchCommand } from '@planner/workspace/takeoverBatchInteraction';
import type { OccurrenceIdFactory } from '@planner/workspace/occurrenceIds';

import { requireWorkspaceRoom } from '../assembly/catalog-room';
import { workspaceAcquisitionRoleLabel } from '../assembly/occurrence-assembly';
import { StructuredWorkspaceProjectionContractError, workspaceInteractionKey } from '../contract';
import type {
  StructuredWorkspaceContextualServices,
  WorkspaceCandidateInteraction,
  WorkspaceEncounterInteraction,
  WorkspaceFigLeafInteraction,
  WorkspaceFieldsActionOrderInteraction,
  WorkspaceExitFrontierCapabilities,
  WorkspaceExitSelectionInteraction,
  WorkspaceHubSlotInteraction,
  WorkspaceHubTakeoverInteraction,
  WorkspaceHubVisitOrderInteraction,
  WorkspaceHubVisitOrderProposal,
  WorkspaceInteractionCatalog,
  WorkspaceInteractionChoice,
  WorkspaceCommandIntent,
  WorkspaceRewardControl,
  WorkspaceExplicitRewardControl,
  WorkspaceRewardInteraction,
  WorkspaceAcquisitionConversionControl,
  WorkspaceTraitOfferControl,
  WorkspaceLevelResolutionControl,
  WorkspaceLevelResolutionInteraction,
  WorkspaceBossCompletionArcanaInteraction,
  WorkspaceKeepsakeSelectionInteraction,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceTraitOfferInteraction,
  WorkspaceShopDeathDefianceConditionInteraction,
  WorkspaceRoomInteraction,
  WorkspaceRoomPickerControl,
  WorkspaceStartInteraction,
  WorkspaceStructuralInteraction,
  WorkspaceTakeoverBatchInteraction,
  WorkspaceTopologyRemovalInteraction,
  WorkspaceNaturalChaosExitInteraction,
  WorkspaceNaturalChaosSpawnInteraction,
  WorkspaceZagreusContractInteraction,
  WorkspaceZagreusSpawnInteraction,
} from '../contract';
import type {
  WorkspaceBatchInteractionRequirement,
  WorkspaceFrontierInteractionRequirement,
  WorkspaceHubInteractionRequirement,
  WorkspaceHubTakeoverInteractionRequirement,
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceStartInteractionRequirement,
  WorkspaceTakeoverInteractionRequirement,
  WorkspaceTopologyRemovalInteractionRequirement,
} from './interaction-requirements';

function createArtificerReplacementControl(
  catalog: Catalog,
  candidates: CandidateProjectionSession,
  conversion: WorkspaceAcquisitionConversionControl,
  replacementAddress: import('@run-planner/engine/authored-project').AcquisitionEntryAddress,
  candidateOptions: readonly AuthoredRewardState[],
): WorkspaceExplicitRewardControl | undefined {
  if (conversion.value.kind !== 'artificer') return undefined;
  const replacement = conversion.value.replacement;
  const options = Object.freeze(
    candidateOptions.some(
      (option) => JSON.stringify(option.offer) === JSON.stringify(replacement.offer),
    )
      ? [...candidateOptions]
      : [...candidateOptions, replacement],
  );
  const markerFor = (address: SemanticAddress) =>
    Object.freeze({
      ...conversion.marker,
      address,
      focusKey: semanticAddressKey(address),
    });
  const owner = Object.freeze({ kind: 'acquisitionEntry' as const, address: replacementAddress });
  const traitOffers = Object.freeze(
    Object.entries(replacement.traitOffersByAcquisitionRole).flatMap(([role, offer]) => {
      const giverKey = traitGiverForAcquisitionRole(catalog, replacement.offer, role);
      const giver = giverKey === undefined ? undefined : catalog.traitGivers.byKey[giverKey];
      if (giver === undefined) return [];
      const address = createTraitOfferAddress(replacementAddress, role);
      return [
        Object.freeze({
          acquisitionRoleLabel: workspaceAcquisitionRoleLabel(role),
          address,
          giver,
          marker: markerFor(address),
          offer,
          rewardOwner: replacementAddress,
        }),
      ];
    }),
  );
  const levelResolutions = Object.freeze(
    Object.entries(replacement.levelResolutionsByAcquisitionRole ?? {}).flatMap(([role, value]) => {
      const address = createLevelResolutionAddress(replacementAddress, role);
      const assessment = candidates.levelResolution(address, value);
      const counts = new Set((assessment?.groups ?? []).map((group) => group.surface.levelCount));
      const levelCount = counts.size === 1 ? [...counts][0] : undefined;
      return levelCount === undefined
        ? []
        : [
            Object.freeze({
              acquisitionRoleLabel: workspaceAcquisitionRoleLabel(role),
              address,
              levelCount,
              settledEmptyNoOp: false,
              marker: markerFor(address),
              rewardOwner: replacementAddress,
              value,
            }),
          ];
    }),
  );
  const declaration = catalog.rewards.rewardTypes.byKey[replacement.offer.rewardType];
  if (declaration === undefined)
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(replacementAddress)} has unknown reward type ${replacement.offer.rewardType}`,
    );
  const conversions = Object.freeze(
    declaration.acquisitionRoles.values.map((role) => {
      const address = createAcquisitionRoleAddress(replacementAddress, role.key);
      const value = replacement.dispositionByAcquisitionRole[role.key];
      if (value === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(replacementAddress)} lacks disposition ${role.key}`,
        );
      return Object.freeze({
        acquisitionRoleLabel: workspaceAcquisitionRoleLabel(role.key),
        address,
        marker: markerFor(address),
        rewardOwner: replacementAddress,
        value,
      });
    }),
  );
  return Object.freeze({
    kind: 'explicitReward' as const,
    marker: markerFor(replacementAddress),
    offer: replacement.offer,
    owner,
    traitOffers,
    levelResolutions,
    conversions,
    rewardTypes: Object.freeze([...new Set(options.map((option) => option.offer.rewardType))]),
    artificerReplacementEdit: Object.freeze({
      acquisition: conversion.address,
      options,
      replacement,
    }),
  });
}

type RewardPayloadCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'ReplaceIncomingReward'
      | 'ReplaceLocalReward'
      | 'ReplaceRewardWheelOffer'
      | 'ReplaceShopOffer'
      | 'ReplaceAcquisitionEntryOffer';
  }
>;

function replaceArtificerTraitOffer(
  replacement: AuthoredRewardState,
  role: string,
  value: AuthoredTraitOffer,
): AuthoredRewardState {
  return Object.freeze({
    ...replacement,
    traitOffersByAcquisitionRole: Object.freeze({
      ...replacement.traitOffersByAcquisitionRole,
      [role]: value,
    }),
  });
}

function replaceArtificerLevelResolution(
  replacement: AuthoredRewardState,
  role: string,
  value: AuthoredLevelResolution,
): AuthoredRewardState {
  return Object.freeze({
    ...replacement,
    levelResolutionsByAcquisitionRole: Object.freeze({
      ...replacement.levelResolutionsByAcquisitionRole,
      [role]: value,
    }),
  });
}

function selectArtificerTraitOffer(
  replacement: AuthoredRewardState,
  role: string,
  selectedOptionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
): AuthoredRewardState {
  const offer = replacement.traitOffersByAcquisitionRole[role];
  if (offer?.kind !== 'traits') {
    throw new StructuredWorkspaceProjectionContractError(
      `Artificer replacement role ${role} has no selectable trait offer`,
    );
  }
  return replaceArtificerTraitOffer(
    replacement,
    role,
    Object.freeze({ ...offer, selectedOptionKey }),
  );
}

function editArtificerReplacement(
  edit: DerivedShopEntryEditCommand['edit'],
  owner: NonNullable<WorkspaceRewardControl['artificerReplacementEdit']>,
): AuthoredRewardState {
  const replacement = owner.replacement;
  switch (edit.kind) {
    case 'ReplaceAcquisitionEntryOffer': {
      const selected = owner.options.find(
        (option) => JSON.stringify(option.offer) === JSON.stringify(edit.value),
      );
      if (selected === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(edit.entry)} has no complete Artificer reward option`,
        );
      return selected;
    }
    case 'ReplaceTraitOffer':
      return replaceArtificerTraitOffer(replacement, edit.trait.acquisitionRole, edit.value);
    case 'ReplaceTraitSelection':
      return selectArtificerTraitOffer(
        replacement,
        edit.trait.acquisitionRole,
        edit.selectedOptionKey,
      );
    case 'ReplaceAllTogetherSet': {
      const role = edit.set.trait.acquisitionRole;
      const offer = replacement.traitOffersByAcquisitionRole[role];
      if (offer?.kind !== 'traits')
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(edit.set)} has no Artificer trait offer`,
        );
      const index = optionIndex(edit.set.optionKey);
      const option = offer.options[index];
      if (option === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(edit.set)} has no selected trait option`,
        );
      if (option.allTogetherResult === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(edit.set)} has no complete All Together result`,
        );
      const options = [
        ...offer.options,
      ] as import('@run-planner/engine/authored-project').AuthoredTraitOption[];
      options[index] = Object.freeze({
        ...option,
        allTogetherResult: Object.freeze({
          ...option.allTogetherResult,
          [edit.set.setKey]: edit.value,
        }),
      });
      return replaceArtificerTraitOffer(
        replacement,
        role,
        Object.freeze({
          ...offer,
          options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
        }),
      );
    }
    case 'ReplaceLevelResolution':
      return replaceArtificerLevelResolution(
        replacement,
        edit.levelResolution.acquisitionRole,
        edit.value,
      );
    case 'ReplaceAcquisitionDisposition':
      return Object.freeze({
        ...replacement,
        dispositionByAcquisitionRole: Object.freeze({
          ...replacement.dispositionByAcquisitionRole,
          [edit.acquisition.acquisitionRole]: edit.value,
        }),
      });
    case 'ReplaceGorgonAthenaOffer':
      throw new StructuredWorkspaceProjectionContractError(
        'Artificer replacement cannot own a Gorgon Athena offer',
      );
  }
}

function derivedShopPayloadIntent<Command extends ProjectCommand>(
  materialization: WorkspaceRewardControl['derivedShopEntryEdit'],
  edit: Command,
  artificer?: WorkspaceRewardControl['artificerReplacementEdit'],
): WorkspaceCommandIntent<
  | Command
  | DerivedShopEntryEditCommand
  | Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
> {
  if (artificer !== undefined) {
    if (
      edit.kind !== 'ReplaceAcquisitionEntryOffer' &&
      edit.kind !== 'ReplaceTraitOffer' &&
      edit.kind !== 'ReplaceGorgonAthenaOffer' &&
      edit.kind !== 'ReplaceTraitSelection' &&
      edit.kind !== 'ReplaceAllTogetherSet' &&
      edit.kind !== 'ReplaceLevelResolution' &&
      edit.kind !== 'ReplaceAcquisitionDisposition'
    )
      throw new StructuredWorkspaceProjectionContractError(
        `${edit.kind} cannot edit an Artificer replacement`,
      );
    return Object.freeze({
      command: Object.freeze({
        kind: 'ReplaceAcquisitionDisposition' as const,
        acquisition: artificer.acquisition,
        value: Object.freeze({
          kind: 'artificer' as const,
          replacement: editArtificerReplacement(edit, artificer),
        }),
      }),
    });
  }
  if (materialization === undefined) return Object.freeze({ command: edit });
  if (
    edit.kind !== 'ReplaceAcquisitionEntryOffer' &&
    edit.kind !== 'ReplaceTraitOffer' &&
    edit.kind !== 'ReplaceGorgonAthenaOffer' &&
    edit.kind !== 'ReplaceTraitSelection' &&
    edit.kind !== 'ReplaceAllTogetherSet' &&
    edit.kind !== 'ReplaceLevelResolution' &&
    edit.kind !== 'ReplaceAcquisitionDisposition'
  )
    throw new StructuredWorkspaceProjectionContractError(
      `${edit.kind} cannot edit a derived Shop entry`,
    );
  return Object.freeze({
    command: Object.freeze({
      kind: 'EditDerivedShopEntry' as const,
      ...materialization,
      edit: edit as DerivedShopEntryEditCommand['edit'],
    }),
  });
}

function rewardCommandFor(
  owner: WorkspaceRewardControl['owner'],
  value: Parameters<WorkspaceRewardInteraction['intentFor']>[0],
): RewardPayloadCommand {
  switch (owner.kind) {
    case 'incomingReward':
      return Object.freeze({ kind: 'ReplaceIncomingReward', reward: owner.address, value });
    case 'localReward':
      return Object.freeze({ kind: 'ReplaceLocalReward', reward: owner.address, value });
    case 'rewardWheelOffer':
      return Object.freeze({ kind: 'ReplaceRewardWheelOffer', offer: owner.address, value });
    case 'shopOffer':
      return Object.freeze({ kind: 'ReplaceShopOffer', offer: owner.address, value });
    case 'acquisitionEntry':
      return Object.freeze({
        kind: 'ReplaceAcquisitionEntryOffer',
        entry: owner.address,
        value,
      });
  }
}

function rewardIntentFor(
  owner: WorkspaceRewardControl['owner'],
  value: Parameters<WorkspaceRewardInteraction['intentFor']>[0],
  materialization: WorkspaceRewardControl['derivedShopEntryEdit'],
  artificer?: WorkspaceRewardControl['artificerReplacementEdit'],
): WorkspaceCommandIntent<
  | RewardPayloadCommand
  | DerivedShopEntryEditCommand
  | Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
> {
  const command = rewardCommandFor(owner, value);
  if (artificer !== undefined) return derivedShopPayloadIntent(materialization, command, artificer);
  if (materialization === undefined) return Object.freeze({ command });
  if (command.kind !== 'ReplaceAcquisitionEntryOffer') {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner.address)} cannot own a derived Shop payload edit`,
    );
  }
  return derivedShopPayloadIntent(materialization, command);
}

function traitOfferCommandFor(
  owner: TraitOfferAddress,
  value: AuthoredTraitOffer,
): Extract<ProjectCommand, { readonly kind: 'ReplaceTraitOffer' | 'ReplaceGorgonAthenaOffer' }> {
  if (owner.owner.kind === 'gorgonPhase') {
    if (value.kind !== 'traits' || value.options.length !== 3) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} requires exactly three Gorgon Athena traits`,
      );
    }
    return Object.freeze({
      kind: 'ReplaceGorgonAthenaOffer' as const,
      trait: owner,
      value: Object.freeze({
        traitKeys: Object.freeze(value.options.map((option) => option.traitKey)) as readonly [
          string,
          string,
          string,
        ],
        selectedOptionKey: value.selectedOptionKey,
      }),
    });
  }
  return Object.freeze({ kind: 'ReplaceTraitOffer' as const, trait: owner, value });
}

function ordinaryTraitOfferCommandFor(
  owner: TraitOfferAddress,
  value: AuthoredTraitOffer,
): Extract<ProjectCommand, { readonly kind: 'ReplaceTraitOffer' }> {
  return Object.freeze({ kind: 'ReplaceTraitOffer' as const, trait: owner, value });
}

function levelResolutionCommandFor(
  owner: LevelResolutionAddress,
  value: AuthoredLevelResolution,
): Extract<ProjectCommand, { readonly kind: 'ReplaceLevelResolution' }> {
  return Object.freeze({
    kind: 'ReplaceLevelResolution' as const,
    levelResolution: owner,
    value,
  });
}

export interface WorkspaceInteractionBindingInput {
  readonly allocateOccurrenceId: OccurrenceIdFactory;
  readonly assembly: ProjectEvaluationAssembly;
  readonly batchInteractionRequirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>;
  readonly catalog: Catalog;
  readonly frontierInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceFrontierInteractionRequirement
  >;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly hubTakeoverInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceHubTakeoverInteractionRequirement
  >;
  readonly occurrenceInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceOccurrenceInteractionRequirement
  >;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly traitControls?: ReadonlyMap<string, WorkspaceTraitOfferControl>;
  readonly levelResolutionControls?: ReadonlyMap<string, WorkspaceLevelResolutionControl>;
  readonly bossCompletionArcanaControls?: ReadonlyMap<
    string,
    { readonly address: BossCompletionArcanaAddress; readonly value: readonly string[] }
  >;
  readonly keepsakeSelectionControls?: ReadonlyMap<
    string,
    {
      readonly address: KeepsakeSelectionAddress;
      readonly value:
        | { readonly kind: 'retain' }
        | { readonly kind: 'replace'; readonly keepsakeKey: string }
        | string;
    }
  >;
  readonly keepsakeEquipResultControls?: ReadonlyMap<
    string,
    {
      readonly address: KeepsakeEquipResultAddress;
      readonly value?: import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults[keyof import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults];
    }
  >;
  readonly roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>;
  readonly services: StructuredWorkspaceContextualServices;
  readonly startInteractionRequirements: ReadonlyMap<string, WorkspaceStartInteractionRequirement>;
  readonly takeoverInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTakeoverInteractionRequirement
  >;
  readonly topologyRemovalInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTopologyRemovalInteractionRequirement
  >;
}

function candidateInteraction<T>(
  owner: SemanticAddress,
  choices: readonly WorkspaceInteractionChoice<T>[],
  selected: T | undefined,
  load: () => readonly CandidateOptionProjection<T, CandidateProjectionEvaluation>[],
  key = workspaceInteractionKey(owner),
): WorkspaceCandidateInteraction<T> {
  return Object.freeze({
    choices: Object.freeze([...choices]),
    key,
    load,
    owner,
    ...(selected === undefined ? {} : { selected }),
  });
}

interface WorkspaceOccurrenceLocalInteractionCatalog {
  readonly encounterPhases: ReadonlyMap<string, WorkspaceEncounterInteraction>;
  readonly figLeafSkips: ReadonlyMap<string, WorkspaceFigLeafInteraction>;
  readonly gorgonConditions: ReadonlyMap<
    string,
    import('../contract').WorkspaceGorgonConditionInteraction
  >;
  readonly rewardWheelOfferCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelPicks: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly shipCombatPhaseCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<2 | 3>>;
  readonly fieldsActionOrders: ReadonlyMap<string, WorkspaceFieldsActionOrderInteraction>;
  readonly acquisitionOrders: ReadonlyMap<string, WorkspaceCandidateInteraction<readonly string[]>>;
  readonly shopDeathDefianceConditions: ReadonlyMap<
    string,
    WorkspaceShopDeathDefianceConditionInteraction
  >;
  readonly sideRoomEntryOrders: ReadonlyMap<
    string,
    WorkspaceCandidateInteraction<readonly string[]>
  >;
  readonly sideRoomGenerations: ReadonlyMap<
    string,
    WorkspaceCandidateInteraction<SideRoomGeneration>
  >;
  readonly zagreusSpawns: ReadonlyMap<string, WorkspaceZagreusSpawnInteraction>;
  readonly naturalChaosSpawns: ReadonlyMap<string, WorkspaceNaturalChaosSpawnInteraction>;
}

function bindOccurrenceLocalInteractions(
  allocateOccurrenceId: OccurrenceIdFactory,
  candidates: CandidateProjectionSession,
  contextualPicker: StructuredWorkspaceContextualServices['contextualPicker'],
  requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>,
): WorkspaceOccurrenceLocalInteractionCatalog {
  const encounterPhases = new Map<string, WorkspaceEncounterInteraction>();
  const figLeafSkips = new Map<string, WorkspaceFigLeafInteraction>();
  const gorgonConditions = new Map<
    string,
    import('../contract').WorkspaceGorgonConditionInteraction
  >();
  const rewardWheelOfferCounts = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelPicks = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const shipCombatPhaseCounts = new Map<string, WorkspaceCandidateInteraction<2 | 3>>();
  const fieldsActionOrders = new Map<string, WorkspaceFieldsActionOrderInteraction>();
  const acquisitionOrders = new Map<string, WorkspaceCandidateInteraction<readonly string[]>>();
  const shopDeathDefianceConditions = new Map<
    string,
    WorkspaceShopDeathDefianceConditionInteraction
  >();
  const sideRoomEntryOrders = new Map<string, WorkspaceCandidateInteraction<readonly string[]>>();
  const sideRoomGenerations = new Map<string, WorkspaceCandidateInteraction<SideRoomGeneration>>();
  const zagreusSpawns = new Map<string, WorkspaceZagreusSpawnInteraction>();
  const naturalChaosSpawns = new Map<string, WorkspaceNaturalChaosSpawnInteraction>();
  const set = <T>(
    target: Map<string, WorkspaceCandidateInteraction<T>>,
    key: string,
    value: WorkspaceCandidateInteraction<T>,
    label: string,
  ): void => {
    if (target.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple bound ${label} interactions`,
      );
    }
    target.set(key, value);
  };
  for (const requirement of requirements) {
    switch (requirement.kind) {
      case 'naturalChaosSpawn': {
        const key = semanticAddressKey(requirement.owner);
        if (naturalChaosSpawns.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} has multiple bound natural Chaos spawn interactions`,
          );
        }
        naturalChaosSpawns.set(
          key,
          Object.freeze({
            key,
            owner: requirement.owner,
            spawnIntent: () =>
              Object.freeze({
                command: Object.freeze({
                  kind: 'AddNaturalChaos' as const,
                  additional: requirement.owner,
                  occurrenceId: allocateOccurrenceId(),
                }),
              }),
          }),
        );
        break;
      }
      case 'zagreusSpawn': {
        const key = semanticAddressKey(requirement.owner);
        if (zagreusSpawns.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} has multiple bound Zagreus spawn interactions`,
          );
        }
        zagreusSpawns.set(
          key,
          Object.freeze({
            key,
            owner: requirement.owner,
            spawnIntent: () =>
              Object.freeze({
                command: Object.freeze({
                  kind: 'AddZagreusContract' as const,
                  additional: requirement.owner,
                  occurrenceId: allocateOccurrenceId(),
                }),
              }),
          }),
        );
        break;
      }
      case 'encounterPhases': {
        for (const phase of requirement.phases) {
          const key = semanticAddressKey(phase.owner);
          const encounterKeys = Object.freeze(phase.candidateChoices.map((choice) => choice.value));
          if (encounterKeys.length > 1 && encounterPhases.has(key)) {
            throw new StructuredWorkspaceProjectionContractError(
              `${key} has multiple bound encounter phase interactions`,
            );
          }
          if (encounterKeys.length > 1) {
            let model: ContextualPickerModel<string> | undefined;
            encounterPhases.set(
              key,
              Object.freeze({
                intentFor: (encounterKey: string) =>
                  Object.freeze({
                    command: Object.freeze({
                      encounterKey,
                      kind: 'SelectEncounter' as const,
                      phase: phase.owner,
                    }),
                  }),
                key,
                load: () =>
                  (model ??= projectEncounterPicker(
                    contextualPicker,
                    phase.candidateChoices,
                    phase.selectedEncounterKey,
                    candidates.encounterPhases(phase.owner, encounterKeys),
                  )),
                owner: phase.owner,
                resetIntent: Object.freeze({
                  command: Object.freeze({ kind: 'ResetEncounter' as const, phase: phase.owner }),
                }),
                selected: phase.selectedEncounterKey,
              }),
            );
          }
          if (phase.figLeaf !== undefined) {
            figLeafSkips.set(
              key,
              Object.freeze({
                intentFor: (value: boolean) =>
                  Object.freeze({
                    command: Object.freeze({
                      kind: 'ReplaceFigLeafSkip' as const,
                      phase: phase.owner,
                      value,
                    }),
                  }),
                key,
                owner: phase.owner,
                selected: phase.figLeaf.selected,
                supported: phase.figLeaf.supported,
              }),
            );
          }
          if (phase.gorgonCondition !== undefined) {
            gorgonConditions.set(
              key,
              Object.freeze({
                intentFor: (value: boolean) =>
                  Object.freeze({
                    command: Object.freeze({
                      kind: 'ReplaceGorgonDeathDefianceCondition' as const,
                      phase: phase.owner,
                      value,
                    }),
                  }),
                key,
                owner: phase.owner,
                selected: phase.gorgonCondition.selected,
                supported: phase.gorgonCondition.supported,
              }),
            );
          }
        }
        break;
      }
      case 'fieldsActionOrder': {
        const key = semanticAddressKey(requirement.owner);
        const proposals = requirement.proposals;
        const values = Object.freeze(proposals.map((proposal) => proposal.order));
        if (fieldsActionOrders.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} has multiple bound Fields action-order interactions`,
          );
        }
        fieldsActionOrders.set(
          key,
          Object.freeze({
            intentFor(proposalKey: string) {
              const proposal = proposals.find((candidate) => candidate.key === proposalKey);
              if (proposal === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${proposalKey} is not a Fields action-order proposal for ${key}`,
                );
              }
              return Object.freeze({
                command: Object.freeze({
                  kind: 'ReplaceFieldsActionOrder' as const,
                  occurrence: requirement.owner,
                  actionOrder: proposal.order,
                }),
              });
            },
            key,
            load: () => candidates.fieldsActionOrders(requirement.owner, values),
            owner: requirement.owner,
            proposals,
          }),
        );
        break;
      }
      case 'ephyraSideRooms': {
        const generationValues = Object.freeze(
          requirement.generationChoices.map((choice) => choice.value),
        );
        for (const sideRoom of requirement.sideRooms) {
          const generationKey = semanticAddressKey(sideRoom.address);
          set(
            sideRoomGenerations,
            generationKey,
            candidateInteraction(
              sideRoom.address,
              requirement.generationChoices,
              sideRoom.generation,
              () => candidates.sideRoomGenerations(sideRoom.address, generationValues),
            ),
            'side-room generation',
          );
          const selected = sideRoom.entryOrder.options.find(
            (option) => option.key === sideRoom.entryOrder.selectedKey,
          );
          if (selected === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${generationKey} has no selected side-room entry position`,
            );
          }
          const entryChoices = Object.freeze(
            sideRoom.entryOrder.options.map((option) =>
              Object.freeze({ label: option.label, value: option.proposedEnteredSlotKeys }),
            ),
          );
          const proposals = Object.freeze(
            sideRoom.entryOrder.options.map((option) => option.proposedEnteredSlotKeys),
          );
          set(
            sideRoomEntryOrders,
            sideRoom.entryOrder.interactionKey,
            candidateInteraction(
              requirement.owner,
              entryChoices,
              selected.proposedEnteredSlotKeys,
              () => candidates.sideRoomEntryOrders(requirement.owner, proposals),
              sideRoom.entryOrder.interactionKey,
            ),
            'side-room entry-order',
          );
        }
        break;
      }
      case 'shipCombatPhaseCount': {
        const combatPhaseCountValues = Object.freeze(
          requirement.combatPhaseCountChoices.map((choice) => choice.value),
        );
        set(
          shipCombatPhaseCounts,
          semanticAddressKey(requirement.owner),
          candidateInteraction(
            requirement.owner,
            requirement.combatPhaseCountChoices,
            requirement.combatPhaseCount,
            () => candidates.shipCombatPhaseCounts(requirement.owner, combatPhaseCountValues),
          ),
          'Ship combat-phase count',
        );
        for (const wheel of requirement.wheels) {
          const key = semanticAddressKey(wheel.address);
          const offerCountValues = Object.freeze(
            wheel.offerCountChoices.map((choice) => choice.value),
          );
          set(
            rewardWheelOfferCounts,
            key,
            candidateInteraction(wheel.address, wheel.offerCountChoices, wheel.offerCount, () =>
              candidates.rewardWheelOfferCounts(wheel.address, offerCountValues),
            ),
            'reward-wheel offer-count',
          );
          const storeValues = Object.freeze(wheel.storeChoices.map((choice) => choice.value));
          set(
            rewardWheelStores,
            key,
            candidateInteraction(wheel.address, wheel.storeChoices, wheel.storeKey, () =>
              candidates.rewardWheelStores(wheel.address, storeValues),
            ),
            'reward-wheel store',
          );
          const pickValues = Object.freeze(wheel.pickChoices.map((choice) => choice.value));
          set(
            rewardWheelPicks,
            key,
            candidateInteraction(wheel.address, wheel.pickChoices, wheel.pickedOfferIndex, () =>
              candidates.rewardWheelPicks(wheel.address, pickValues),
            ),
            'reward-wheel pick',
          );
        }
        break;
      }
      case 'acquisitionOrder': {
        const key = semanticAddressKey(requirement.owner);
        const choices = Object.freeze(
          requirement.proposalEntryKeys.map((offerKeys) =>
            Object.freeze({
              label: offerKeys.length === 0 ? 'No purchases' : offerKeys.join(' → '),
              value: offerKeys,
            }),
          ),
        );
        set(
          acquisitionOrders,
          key,
          candidateInteraction(
            requirement.owner,
            choices,
            requirement.selectedEntryKeys,
            () => candidates.acquisitionOrders(requirement.owner, requirement.proposalEntryKeys),
            key,
          ),
          'acquisition order',
        );
        break;
      }
      case 'shopDeathDefianceCondition': {
        const key = semanticAddressKey(requirement.owner);
        if (shopDeathDefianceConditions.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} has multiple Shop Death Defiance condition interactions`,
          );
        }
        shopDeathDefianceConditions.set(
          key,
          Object.freeze({
            key,
            owner: requirement.owner,
            value: requirement.value,
            intentFor: (value: boolean) =>
              Object.freeze({
                command: Object.freeze({
                  kind: 'ReplaceShopDeathDefianceCondition' as const,
                  shop: requirement.owner,
                  value,
                }),
              }),
          }),
        );
        break;
      }
    }
  }
  return Object.freeze({
    encounterPhases,
    fieldsActionOrders,
    figLeafSkips,
    gorgonConditions,
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    shipCombatPhaseCounts,
    acquisitionOrders,
    shopDeathDefianceConditions,
    sideRoomEntryOrders,
    sideRoomGenerations,
    zagreusSpawns,
    naturalChaosSpawns,
  });
}

interface WorkspaceBatchInteractionCatalog {
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly exitSelections: ReadonlyMap<string, WorkspaceExitSelectionInteraction>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceCandidateInteraction<'min' | 'max'>>;
  readonly zagreusContracts: ReadonlyMap<string, WorkspaceZagreusContractInteraction>;
  readonly naturalChaosExits: ReadonlyMap<string, WorkspaceNaturalChaosExitInteraction>;
}

function bindBatchInteractions(
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceBatchInteractionRequirement>,
): WorkspaceBatchInteractionCatalog {
  const batchRewardStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const exitSelections = new Map<string, WorkspaceExitSelectionInteraction>();
  const fieldsCageOutcomes = new Map<string, WorkspaceCandidateInteraction<'min' | 'max'>>();
  const zagreusContracts = new Map<string, WorkspaceZagreusContractInteraction>();
  const naturalChaosExits = new Map<string, WorkspaceNaturalChaosExitInteraction>();
  for (const requirement of requirements) {
    if (requirement.exitSelection !== undefined) {
      const { exitSelection } = requirement;
      const key = semanticAddressKey(exitSelection.owner);
      if (exitSelections.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound exit-selection interactions`,
        );
      }
      exitSelections.set(
        key,
        Object.freeze({
          key,
          owner: requirement.owner,
          ...(exitSelection.selectedExitKey === undefined
            ? {}
            : { selectedExitKey: exitSelection.selectedExitKey }),
          targets: exitSelection.targets,
        }),
      );
    }
    if (requirement.rewardStore !== undefined) {
      const { rewardStore } = requirement;
      const key = semanticAddressKey(rewardStore.owner);
      if (batchRewardStores.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound batch reward-store interactions`,
        );
      }
      const storeKeys = Object.freeze(rewardStore.storeChoices.map((choice) => choice.value));
      batchRewardStores.set(
        key,
        candidateInteraction(
          rewardStore.owner,
          rewardStore.storeChoices,
          rewardStore.selected,
          () => candidates.batchRewardStores(rewardStore.owner, storeKeys),
        ),
      );
    }
    if (requirement.fieldsCageOutcome !== undefined) {
      const { fieldsCageOutcome } = requirement;
      const key = semanticAddressKey(fieldsCageOutcome.owner);
      if (fieldsCageOutcomes.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound Fields cage-outcome interactions`,
        );
      }
      const values = Object.freeze(fieldsCageOutcome.outcomeChoices.map((choice) => choice.value));
      fieldsCageOutcomes.set(
        key,
        candidateInteraction(
          fieldsCageOutcome.owner,
          fieldsCageOutcome.outcomeChoices,
          fieldsCageOutcome.selected,
          () => candidates.fieldsCageOutcomes(fieldsCageOutcome.owner, values),
        ),
      );
    }
    if (requirement.zagreusContract !== undefined) {
      const { owner } = requirement.zagreusContract;
      const key = semanticAddressKey(owner);
      if (zagreusContracts.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound Zagreus contract interactions`,
        );
      }
      zagreusContracts.set(
        key,
        Object.freeze({
          key,
          owner,
          removeIntent: Object.freeze({
            command: Object.freeze({ kind: 'RemoveZagreusContract' as const, additional: owner }),
          }),
          selectIntent: Object.freeze({
            command: Object.freeze({
              kind: 'SetExitSelection' as const,
              selection: Object.freeze({
                kind: 'exitSelection' as const,
                routeKey: owner.routeKey,
                biomeKey: owner.biomeKey,
                source: { kind: 'occurrence' as const, occurrenceId: owner.occurrenceId },
              }),
              value: Object.freeze({
                kind: 'additional' as const,
                additionalExitKey: owner.additionalExitKey,
              }),
            }),
          }),
        }),
      );
    }
    if (requirement.naturalChaos !== undefined) {
      const { owner, occurrence } = requirement.naturalChaos;
      const key = semanticAddressKey(owner);
      if (naturalChaosExits.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound natural Chaos exit interactions`,
        );
      }
      naturalChaosExits.set(
        key,
        Object.freeze({
          key,
          owner,
          mapIntent: (gameName: string) =>
            Object.freeze({
              command: Object.freeze({
                kind: 'ReplaceNaturalChaosMap' as const,
                occurrence,
                gameName,
              }),
            }),
          removeIntent: Object.freeze({
            command: Object.freeze({ kind: 'RemoveNaturalChaos' as const, additional: owner }),
          }),
          selectIntent: Object.freeze({
            command: Object.freeze({
              kind: 'SetExitSelection' as const,
              selection: Object.freeze({
                kind: 'exitSelection' as const,
                routeKey: owner.routeKey,
                biomeKey: owner.biomeKey,
                source: { kind: 'occurrence' as const, occurrenceId: owner.occurrenceId },
              }),
              value: Object.freeze({
                kind: 'additional' as const,
                additionalExitKey: owner.additionalExitKey,
              }),
            }),
          }),
        }),
      );
    }
  }
  return Object.freeze({
    batchRewardStores,
    exitSelections,
    fieldsCageOutcomes,
    zagreusContracts,
    naturalChaosExits,
  });
}

interface WorkspaceHubInteractionCatalog {
  readonly hubSlots: ReadonlyMap<string, WorkspaceHubSlotInteraction>;
  readonly hubVisitOrders: ReadonlyMap<string, WorkspaceHubVisitOrderInteraction>;
}

function bindHubInteractions(
  allocateOccurrenceId: OccurrenceIdFactory,
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceHubInteractionRequirement>,
): WorkspaceHubInteractionCatalog {
  const hubSlots = new Map<string, WorkspaceHubSlotInteraction>();
  const hubVisitOrders = new Map<string, WorkspaceHubVisitOrderInteraction>();
  const assertCandidateMayBeAuthored = <T>(
    options: readonly CandidateOptionProjection<T>[],
    value: T,
    label: string,
  ): void => {
    const option = options.find((candidate) => Object.is(candidate.value, value));
    if (option === undefined || candidateSupport(option) === 'impossible') {
      throw new StructuredWorkspaceProjectionContractError(`${label} is not currently authorable.`);
    }
  };
  for (const requirement of requirements) {
    for (const slot of requirement.slots) {
      const key = semanticAddressKey(slot.owner);
      if (hubSlots.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound Hub-slot interactions`,
        );
      }
      const values = Object.freeze(slot.choices.map((choice) => choice.value));
      if (!slot.selected) {
        hubSlots.set(
          key,
          Object.freeze({
            beginOpeningAttempt: () => {
              const proposedOccurrenceId = allocateOccurrenceId();
              let loaded: readonly CandidateOptionProjection<boolean>[] | undefined;
              const load = () =>
                (loaded ??= candidates.hubSlots(slot.owner, proposedOccurrenceId, values));
              return Object.freeze({
                choices: slot.choices,
                intentFor: (open: true) => {
                  assertCandidateMayBeAuthored(load(), open, `Hub slot ${key} opening`);
                  return Object.freeze({
                    command: Object.freeze({
                      kind: 'OpenHubSlot' as const,
                      occurrenceId: proposedOccurrenceId,
                      slot: slot.owner,
                    }),
                  });
                },
                key: `${key}:opening:${proposedOccurrenceId}`,
                load,
                owner: slot.owner,
                selected: false,
              });
            },
            key,
            owner: slot.owner,
            selected: false as const,
          }),
        );
        continue;
      }
      const closeRequirement = slot.close;
      const close =
        closeRequirement === undefined
          ? undefined
          : (() => {
              let loaded: readonly CandidateOptionProjection<boolean>[] | undefined;
              const load = () =>
                (loaded ??= candidates.hubSlots(slot.owner, slot.openedOccurrenceId, values));
              return Object.freeze({
                choices: slot.choices,
                intentFor: (open: false) => {
                  assertCandidateMayBeAuthored(load(), open, `Hub slot ${key} closure`);
                  return Object.freeze({
                    command: closeRequirement.command,
                  });
                },
                key: `${key}:close`,
                load,
                owner: slot.owner,
                selected: true,
              });
            })();
      hubSlots.set(
        key,
        Object.freeze({
          ...(close === undefined ? {} : { close }),
          key,
          owner: slot.owner,
          selected: true as const,
        }),
      );
    }
    const key = semanticAddressKey(requirement.owner);
    if (hubVisitOrders.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple bound Hub visit-order interactions`,
      );
    }
    const proposals = new Map<string, WorkspaceHubVisitOrderProposal>();
    hubVisitOrders.set(
      key,
      Object.freeze({
        key,
        owner: requirement.owner,
        proposalFor: (hubSlotKeys: readonly string[]) => {
          const value = Object.freeze([...hubSlotKeys]);
          const proposalKey = JSON.stringify(value);
          const existing = proposals.get(proposalKey);
          if (existing !== undefined) return existing;
          let loaded: readonly CandidateOptionProjection<readonly string[]>[] | undefined;
          const load = () =>
            (loaded ??= candidates.hubVisitOrders(requirement.owner, Object.freeze([value])));
          const proposal = Object.freeze({
            choices: Object.freeze([
              Object.freeze({
                label: value.length === 0 ? 'No visits' : value.join(' → '),
                value,
              }),
            ]),
            intent: () => {
              const candidate = load()[0];
              if (candidate === undefined || candidateSupport(candidate) === 'impossible') {
                throw new StructuredWorkspaceProjectionContractError(
                  `Hub visit order ${key} is not currently authorable.`,
                );
              }
              return Object.freeze({
                command: Object.freeze({
                  hub: requirement.owner,
                  hubSlotKeys: value,
                  kind: 'ReplaceHubVisitOrder' as const,
                }),
              });
            },
            key: `${key}:visit-order:${proposalKey}`,
            load,
            owner: requirement.owner,
            selected: value,
          });
          proposals.set(proposalKey, proposal);
          return proposal;
        },
        selectedHubSlotKeys: Object.freeze([...requirement.visitOrder]),
      }),
    );
  }
  return Object.freeze({ hubSlots, hubVisitOrders });
}

/**
 * Binds the one terminal Hub result without rediscovering its source, depth,
 * or room. The requirement is structural; the lazy candidate is only the
 * affordance authority.
 */
function bindHubTakeoverInteractions(
  candidates: CandidateProjectionSession,
  catalog: Catalog,
  requirements: Iterable<WorkspaceHubTakeoverInteractionRequirement>,
): ReadonlyMap<string, WorkspaceHubTakeoverInteraction> {
  const hubTakeovers = new Map<string, WorkspaceHubTakeoverInteraction>();
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.owner);
    if (hubTakeovers.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple bound Hub takeover interactions`,
      );
    }
    let loaded: CandidateOptionProjection<WorkspaceHubTakeoverInteraction['owner']> | undefined;
    const load = (): CandidateOptionProjection<WorkspaceHubTakeoverInteraction['owner']> =>
      (loaded ??= candidates.hubTerminalTakeover(requirement.owner));
    hubTakeovers.set(
      key,
      Object.freeze({
        hub: requirement.hub,
        intent: () => {
          const candidate = load();
          const support = candidateSupport(candidate);
          if (support !== 'forced' && support !== 'possible') {
            throw new StructuredWorkspaceProjectionContractError(
              `${requirement.gameName} is not currently authorable for ${key}`,
            );
          }
          if (candidate.evaluation.kind !== 'unavailable') {
            if (
              candidate.evaluation.kind !== 'hubTerminalTakeover' ||
              candidate.evaluation.result.gameName !== requirement.gameName ||
              candidate.evaluation.result.hubKey !== requirement.hub.hubKey
            ) {
              throw new StructuredWorkspaceProjectionContractError(
                `${key} Hub takeover candidate disagrees with its declared terminal`,
              );
            }
          }
          return Object.freeze({
            command: Object.freeze({
              decision: requirement.owner,
              hub: requirement.hub,
              kind: 'ReplaceWithHubDecision' as const,
            }),
            focus: Object.freeze({ owner: requirement.hub, timing: 'after' as const }),
          });
        },
        key,
        label: requireWorkspaceRoom(catalog, requirement.gameName).label,
        load,
        owner: requirement.owner,
      }),
    );
  }
  return hubTakeovers;
}

function bindTopologyRemovalInteractions(
  requirements: Iterable<WorkspaceTopologyRemovalInteractionRequirement>,
): ReadonlyMap<string, WorkspaceTopologyRemovalInteraction> {
  const topologyRemovals = new Map<string, WorkspaceTopologyRemovalInteraction>();
  for (const requirement of requirements) {
    for (const removal of requirement.removals) {
      if (topologyRemovals.has(removal.key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${removal.key} has multiple bound topology-removal interactions`,
        );
      }
      topologyRemovals.set(
        removal.key,
        Object.freeze({
          intent: Object.freeze({
            command: removal.command,
            focus: Object.freeze({ owner: removal.owner, timing: 'before' as const }),
          }),
          key: removal.key,
          owner: removal.owner,
        }),
      );
    }
  }
  return topologyRemovals;
}

function bindStartInteractions(
  allocateOccurrenceId: OccurrenceIdFactory,
  catalog: Catalog,
  candidates: CandidateProjectionSession,
  services: StructuredWorkspaceContextualServices,
  requirements: Iterable<WorkspaceStartInteractionRequirement>,
): ReadonlyMap<string, WorkspaceStartInteraction> {
  const starts = new Map<string, WorkspaceStartInteraction>();
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.owner);
    if (starts.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple bound start interactions`,
      );
    }
    const gameNames =
      requirement.start.kind === 'fixed'
        ? Object.freeze([requirement.start.gameName])
        : requirement.start.gameNames;
    const rooms = Object.freeze(
      gameNames.map((gameName) => requireWorkspaceRoom(catalog, gameName)),
    );
    let model: ContextualPickerModel<RoomDeclaration> | undefined;
    const load = (): ContextualPickerModel<RoomDeclaration> => {
      if (model !== undefined) return model;
      model = services.contextualPicker.project(
        candidates.startRooms(requirement.owner, rooms),
        (option) =>
          Object.freeze({
            category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
            label: option.value.label,
            selected: false,
          }),
        (room) => room.gameName,
      );
      return model;
    };
    const intentFor = (gameName?: string) => {
      const occurrenceId = allocateOccurrenceId();
      return Object.freeze({
        command: Object.freeze({
          biome: requirement.owner,
          ...(gameName === undefined ? {} : { gameName }),
          kind: 'CreateStart' as const,
          occurrenceId,
        }),
        focus: Object.freeze({
          owner: createOccurrenceAddress(requirement.owner, occurrenceId),
          timing: 'after' as const,
        }),
      });
    };
    if (requirement.start.kind === 'fixed') {
      starts.set(
        key,
        Object.freeze({
          fixedLabel: requireWorkspaceRoom(catalog, requirement.start.gameName).label,
          intent: () => intentFor(),
          key,
          kind: 'fixed' as const,
          load,
          owner: requirement.owner,
        }),
      );
    } else {
      starts.set(
        key,
        Object.freeze({
          intentFor: (room: RoomDeclaration) => {
            if (!gameNames.includes(room.gameName)) {
              throw new StructuredWorkspaceProjectionContractError(
                `${room.gameName} is outside the declared start domain for ${key}`,
              );
            }
            return intentFor(room.gameName);
          },
          key,
          kind: 'choice' as const,
          load,
          owner: requirement.owner,
        }),
      );
    }
  }
  return starts;
}

function bindTakeoverBatchInteractions(
  allocateOccurrenceId: OccurrenceIdFactory,
  catalog: Catalog,
  requirements: Iterable<WorkspaceTakeoverInteractionRequirement>,
): ReadonlyMap<string, WorkspaceTakeoverBatchInteraction> {
  const targetOccurrences = (
    targets: readonly { readonly exitKey: string; readonly occurrenceId: OccurrenceId }[],
  ): ReadonlyMap<string, OccurrenceId> =>
    new Map(targets.map((target) => [target.exitKey, target.occurrenceId] as const));
  const takeoverBatches = new Map<string, WorkspaceTakeoverBatchInteraction>();
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.owner);
    if (takeoverBatches.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple bound takeover batch interactions`,
      );
    }
    switch (requirement.presentation) {
      case 'repair': {
        const existingTargetOccurrenceIds = targetOccurrences(requirement.existingTargets);
        takeoverBatches.set(
          key,
          Object.freeze({
            action: 'reconcile' as const,
            intent: () =>
              Object.freeze({
                command: createTakeoverBatchCommand({
                  action: 'reconcile',
                  allocateOccurrenceId,
                  decision: requirement.owner,
                  existingTargetOccurrenceIds,
                  gameName: requirement.gameName,
                  requiredExitKeys: requirement.requiredExitKeys,
                }),
                focus: Object.freeze({ owner: requirement.owner, timing: 'before' as const }),
              }),
            key,
            label: requireWorkspaceRoom(catalog, requirement.gameName).label,
            owner: requirement.owner,
            presentation: 'repair' as const,
          }),
        );
        break;
      }
      case 'completedHubHandoff':
        takeoverBatches.set(
          key,
          Object.freeze({
            action: 'create' as const,
            intent: () =>
              Object.freeze({
                command: createTakeoverBatchCommand({
                  action: 'create',
                  allocateOccurrenceId,
                  decision: requirement.owner,
                  existingTargetOccurrenceIds: new Map(),
                  gameName: requirement.gameName,
                  requiredExitKeys: requirement.requiredExitKeys,
                }),
                focus: Object.freeze({ owner: requirement.owner, timing: 'before' as const }),
              }),
            key,
            label: requireWorkspaceRoom(catalog, requirement.gameName).label,
            owner: requirement.owner,
            presentation: 'completedHubHandoff' as const,
          }),
        );
        break;
    }
  }
  return takeoverBatches;
}

interface WorkspaceFrontierInteractionCatalog {
  readonly exitFrontierCapabilities: ReadonlyMap<string, WorkspaceExitFrontierCapabilities>;
  readonly structural: ReadonlyMap<string, WorkspaceStructuralInteraction>;
}

function bindFrontierInteractions(
  requirements: Iterable<WorkspaceFrontierInteractionRequirement>,
): WorkspaceFrontierInteractionCatalog {
  const exitFrontierCapabilities = new Map<string, WorkspaceExitFrontierCapabilities>();
  const structural = new Map<string, WorkspaceStructuralInteraction>();
  const bindStructural = (action: WorkspaceStructuralInteraction): void => {
    if (structural.has(action.key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${action.key} has multiple bound structural frontier interactions`,
      );
    }
    structural.set(action.key, action);
  };
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.owner);
    switch (requirement.kind) {
      case 'exitFrontier': {
        const capabilities = requirement.capabilities;
        if (capabilities.structural !== requirement.structural?.action) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} frontier structural capability disagrees with its requirement`,
          );
        }
        if (capabilities.structural === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} frontier interaction requirement has no authoring capability`,
          );
        }
        if (exitFrontierCapabilities.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} has multiple bound exit frontier capability packages`,
          );
        }
        exitFrontierCapabilities.set(key, capabilities);
        switch (requirement.structural?.action) {
          case undefined:
            break;
          case 'createBatch':
            bindStructural(
              Object.freeze({
                action: 'createBatch' as const,
                intent: Object.freeze({
                  command: Object.freeze({
                    decision: requirement.owner,
                    kind: 'CreateBatch' as const,
                  }),
                  focus: Object.freeze({ owner: requirement.owner, timing: 'before' as const }),
                }),
                key,
                owner: requirement.owner,
              }),
            );
            break;
        }
        break;
      }
    }
  }
  return Object.freeze({ exitFrontierCapabilities, structural });
}

function candidateHasExecutableSupport(candidate: CandidateOptionProjection<unknown>): boolean {
  const support = candidateSupport(candidate);
  return support === 'forced' || support === 'possible';
}

function distinctRooms(rooms: readonly RoomDeclaration[]): readonly RoomDeclaration[] {
  return Object.freeze([...new Map(rooms.map((room) => [room.gameName, room])).values()]);
}

function targetCandidateRooms(
  catalog: Catalog,
  project: ProjectEvaluationAssembly['project'],
  target: TargetAddress,
): readonly RoomDeclaration[] {
  return distinctRooms(
    roomSelectorCategories(catalog, target.biomeKey).flatMap((category) =>
      selectRoomsForTargetCategory(catalog, project, target, category),
    ),
  );
}

type WorkspaceDecisionEntryCandidate =
  | {
      readonly candidate: CandidateOptionProjection<RoomDeclaration>;
      readonly kind: 'ordinary';
      readonly room: RoomDeclaration;
    }
  | {
      readonly candidate: CandidateOptionProjection<string>;
      readonly kind: 'takeover';
      readonly room: RoomDeclaration;
    };

type WorkspaceDecisionEntryRoomControl = Extract<
  WorkspaceRoomPickerControl,
  { readonly kind: 'decisionEntryRoomPicker' }
>;

/**
 * Candidate availability and authored mutation readiness answer different
 * questions. An ordinary Door 1 choice remains authorable behind a retained
 * or incomplete prefix just like any other target picker when the engine's
 * exact static command domain admits it. Setup owned by this exact decision
 * can still block ordinary mutation. A takeover requires evaluated whole-batch
 * support because it needs the engine's required-exit product.
 */
function decisionEntryCandidateMayBeAuthored(
  entry: WorkspaceDecisionEntryCandidate,
  ordinaryTargetAuthoring: WorkspaceDecisionEntryRoomControl['ordinaryTargetAuthoring'],
  ordinaryTargetGameNames: WorkspaceDecisionEntryRoomControl['ordinaryTargetGameNames'],
): boolean {
  if (entry.kind === 'takeover') return candidateHasExecutableSupport(entry.candidate);
  if (ordinaryTargetAuthoring.kind !== 'ready') return false;
  if (!ordinaryTargetGameNames.includes(entry.room.gameName)) return false;
  return candidateSupport(entry.candidate) !== 'impossible';
}

function disableUnavailableDecisionEntryCandidates(
  model: ContextualPickerModel<RoomDeclaration>,
  candidates: readonly WorkspaceDecisionEntryCandidate[],
  ordinaryTargetAuthoring: WorkspaceDecisionEntryRoomControl['ordinaryTargetAuthoring'],
  ordinaryTargetGameNames: WorkspaceDecisionEntryRoomControl['ordinaryTargetGameNames'],
): ContextualPickerModel<RoomDeclaration> {
  const candidatesByGameName = new Map(
    candidates.map((candidate) => [candidate.room.gameName, candidate] as const),
  );
  let changed = false;
  const sections = model.sections.map((section) => {
    let sectionChanged = false;
    const items = section.items.map((item) => {
      const candidate = candidatesByGameName.get(item.value.gameName);
      if (
        item.disabled ||
        candidate === undefined ||
        decisionEntryCandidateMayBeAuthored(
          candidate,
          ordinaryTargetAuthoring,
          ordinaryTargetGameNames,
        )
      ) {
        return item;
      }
      changed = true;
      sectionChanged = true;
      return Object.freeze({ ...item, disabled: true });
    });
    return sectionChanged ? Object.freeze({ ...section, items: Object.freeze(items) }) : section;
  });
  return changed ? Object.freeze({ ...model, sections: Object.freeze(sections) }) : model;
}

/**
 * Bind every public interaction map from completed requirement products and
 * the exact contextual services for one project-evaluation assembly. This module
 * deliberately has no source-index or topology traversal.
 */
export function bindWorkspaceInteractions(
  input: WorkspaceInteractionBindingInput,
): WorkspaceInteractionCatalog {
  const {
    allocateOccurrenceId,
    assembly,
    batchInteractionRequirements,
    catalog,
    frontierInteractionRequirements,
    hubInteractionRequirements,
    hubTakeoverInteractionRequirements,
    occurrenceInteractionRequirements,
    rewardControls,
    traitControls,
    levelResolutionControls,
    bossCompletionArcanaControls,
    keepsakeSelectionControls,
    keepsakeEquipResultControls,
    roomControls,
    services,
    startInteractionRequirements,
    takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements,
  } = input;
  const { project } = assembly;
  const candidates = services.candidateSessions.bind(assembly);
  const {
    encounterPhases,
    fieldsActionOrders,
    figLeafSkips,
    gorgonConditions,
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    shipCombatPhaseCounts,
    acquisitionOrders,
    shopDeathDefianceConditions,
    sideRoomEntryOrders,
    sideRoomGenerations,
    zagreusSpawns,
    naturalChaosSpawns,
  } = bindOccurrenceLocalInteractions(
    allocateOccurrenceId,
    candidates,
    services.contextualPicker,
    occurrenceInteractionRequirements.values(),
  );
  const {
    batchRewardStores,
    exitSelections,
    fieldsCageOutcomes,
    zagreusContracts,
    naturalChaosExits,
  } = bindBatchInteractions(candidates, batchInteractionRequirements.values());
  const { hubSlots, hubVisitOrders } = bindHubInteractions(
    allocateOccurrenceId,
    candidates,
    hubInteractionRequirements.values(),
  );
  const hubTakeovers = bindHubTakeoverInteractions(
    candidates,
    catalog,
    hubTakeoverInteractionRequirements.values(),
  );
  const topologyRemovals = bindTopologyRemovalInteractions(
    topologyRemovalInteractionRequirements.values(),
  );
  const starts = bindStartInteractions(
    allocateOccurrenceId,
    catalog,
    candidates,
    services,
    startInteractionRequirements.values(),
  );
  const takeoverBatches = bindTakeoverBatchInteractions(
    allocateOccurrenceId,
    catalog,
    takeoverInteractionRequirements.values(),
  );
  const { exitFrontierCapabilities, structural } = bindFrontierInteractions(
    frontierInteractionRequirements.values(),
  );
  const rooms = new Map<string, WorkspaceRoomInteraction>();
  for (const [key, control] of roomControls) {
    if (control.kind === 'startRoomPicker') {
      const candidateRooms = Object.freeze(
        control.candidateGameNames.map((gameName) => requireWorkspaceRoom(catalog, gameName)),
      );
      let model: ContextualPickerModel<RoomDeclaration> | undefined;
      rooms.set(
        key,
        Object.freeze({
          choices: Object.freeze(
            candidateRooms.map((room) =>
              Object.freeze({
                category: roomCategoryForKind(room.kind) ?? room.kind,
                gameName: room.gameName,
                label: room.label,
              }),
            ),
          ),
          kind: 'startRoom' as const,
          key,
          load(): ContextualPickerModel<RoomDeclaration> {
            if (model !== undefined) return model;
            model = services.contextualPicker.project(
              candidates.startRooms(control.address, candidateRooms),
              (option) =>
                Object.freeze({
                  category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                  label: option.value.label,
                  selected: option.value.gameName === control.selectedGameName,
                }),
              (room) => room.gameName,
            );
            return model;
          },
          owner: control.address,
          selected: requireWorkspaceRoom(catalog, control.selectedGameName),
        }),
      );
      continue;
    }

    const ordinaryRooms =
      control.kind === 'decisionEntryRoomPicker'
        ? Object.freeze(
            control.ordinaryTargetGameNames.map((gameName) =>
              requireWorkspaceRoom(catalog, gameName),
            ),
          )
        : targetCandidateRooms(catalog, project, control.address);
    if (control.kind === 'decisionEntryRoomPicker') {
      const takeoverRooms = Object.freeze(
        control.takeoverGameNames.map((gameName) => requireWorkspaceRoom(catalog, gameName)),
      );
      const takeoverGameNames = new Set(takeoverRooms.map((room) => room.gameName));
      const ordinaryGameNames = new Set(ordinaryRooms.map((room) => room.gameName));
      const overlappingGameName = [...ordinaryGameNames].find((gameName) =>
        takeoverGameNames.has(gameName),
      );
      if (overlappingGameName !== undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${overlappingGameName} has ambiguous ordinary and takeover decision-entry semantics for ${key}`,
        );
      }
      const candidateRooms = Object.freeze([...ordinaryRooms, ...takeoverRooms]);
      let loadedCandidates: readonly WorkspaceDecisionEntryCandidate[] | undefined;
      let model: ContextualPickerModel<RoomDeclaration> | undefined;
      const loadCandidates = (): readonly WorkspaceDecisionEntryCandidate[] =>
        (loadedCandidates ??= Object.freeze([
          ...candidates
            .roomTargets(control.address, ordinaryRooms)
            .map((candidate) =>
              Object.freeze({ candidate, kind: 'ordinary' as const, room: candidate.value }),
            ),
          ...candidates
            .takeoverPrebossBatches(control.decisionOwner, control.takeoverGameNames)
            .map((candidate) =>
              Object.freeze({
                candidate,
                kind: 'takeover' as const,
                room: requireWorkspaceRoom(catalog, candidate.value),
              }),
            ),
        ]));
      rooms.set(
        key,
        Object.freeze({
          choices: Object.freeze(
            candidateRooms.map((room) =>
              Object.freeze({
                category: roomCategoryForKind(room.kind) ?? room.kind,
                gameName: room.gameName,
                label: room.label,
              }),
            ),
          ),
          decisionOwner: control.decisionOwner,
          intentFor(gameName: string) {
            const entry = loadCandidates().find(
              (candidate) => candidate.room.gameName === gameName,
            );
            if (entry === undefined) {
              throw new StructuredWorkspaceProjectionContractError(
                `${gameName} is outside the decision-entry room domain for ${key}`,
              );
            }
            if (
              !decisionEntryCandidateMayBeAuthored(
                entry,
                control.ordinaryTargetAuthoring,
                control.ordinaryTargetGameNames,
              )
            ) {
              throw new StructuredWorkspaceProjectionContractError(
                `${gameName} is not currently authorable for ${key}`,
              );
            }
            if (entry.kind === 'ordinary') {
              const occurrenceId = allocateOccurrenceId();
              return Object.freeze({
                command: Object.freeze({
                  gameName,
                  kind: 'CreateTarget' as const,
                  occurrenceId,
                  target: control.address,
                }),
                focus: Object.freeze({ owner: control.address, timing: 'after' as const }),
              });
            }
            if (entry.candidate.evaluation.kind !== 'takeoverPrebossBatch') {
              throw new StructuredWorkspaceProjectionContractError(
                `${gameName} has no evaluated takeover evidence for ${key}`,
              );
            }
            const command = createTakeoverBatchCommand({
              action: 'replace',
              allocateOccurrenceId,
              decision: control.decisionOwner,
              existingTargetOccurrenceIds: new Map(),
              gameName,
              requiredExitKeys: entry.candidate.evaluation.result.requiredExitKeys,
            });
            return Object.freeze({
              command,
              focus: Object.freeze({ owner: control.decisionOwner, timing: 'before' as const }),
            });
          },
          key,
          kind: 'decisionEntryRoom' as const,
          load(): ContextualPickerModel<RoomDeclaration> {
            if (model !== undefined) return model;
            const projected = services.contextualPicker.project(
              loadCandidates().map((entry) =>
                Object.freeze({ evaluation: entry.candidate.evaluation, value: entry.room }),
              ),
              (option) =>
                Object.freeze({
                  category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                  label: option.value.label,
                  selected: false,
                }),
              (room) => room.gameName,
            );
            model = disableUnavailableDecisionEntryCandidates(
              projected,
              loadCandidates(),
              control.ordinaryTargetAuthoring,
              control.ordinaryTargetGameNames,
            );
            return model;
          },
          owner: control.address,
        }),
      );
      continue;
    }

    const selectedGameName =
      control.target.kind === 'existing' ? control.target.selectedGameName : undefined;
    const targetGameNames = new Set(ordinaryRooms.map((room) => room.gameName));
    let model: ContextualPickerModel<RoomDeclaration> | undefined;
    rooms.set(
      key,
      Object.freeze({
        choices: Object.freeze(
          ordinaryRooms.map((room) =>
            Object.freeze({
              category: roomCategoryForKind(room.kind) ?? room.kind,
              gameName: room.gameName,
              label: room.label,
            }),
          ),
        ),
        intentFor(gameName: string) {
          if (!targetGameNames.has(gameName)) {
            throw new StructuredWorkspaceProjectionContractError(
              `${gameName} is outside the target-room domain for ${key}`,
            );
          }
          if (control.target.kind === 'existing') {
            return Object.freeze({
              command: Object.freeze({
                gameName,
                kind: 'ReplaceOccurrenceRoom' as const,
                occurrence: control.target.occurrence,
              }),
            });
          }
          const occurrenceId = allocateOccurrenceId();
          return Object.freeze({
            command: Object.freeze({
              gameName,
              kind: 'CreateTarget' as const,
              occurrenceId,
              target: control.address,
            }),
            focus: Object.freeze({ owner: control.address, timing: 'after' as const }),
          });
        },
        kind: 'targetRoom' as const,
        key,
        load(): ContextualPickerModel<RoomDeclaration> {
          if (model !== undefined) return model;
          model = services.contextualPicker.project(
            candidates.roomTargets(control.address, ordinaryRooms),
            (option) =>
              Object.freeze({
                category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                label: option.value.label,
                selected: option.value.gameName === selectedGameName,
              }),
            (room) => room.gameName,
          );
          return model;
        },
        owner: control.address,
        ...(selectedGameName === undefined
          ? {}
          : { selected: requireWorkspaceRoom(catalog, selectedGameName) }),
      }),
    );
  }

  const effectiveRewardControls = new Map(rewardControls);
  const evaluatedConversions = new Map<
    string,
    ReturnType<CandidateProjectionSession['acquisitionConversion']>
  >();
  const replacementControls = new Map<string, WorkspaceExplicitRewardControl>();
  for (const control of rewardControls.values()) {
    for (const conversion of control.conversions ?? []) {
      const key = workspaceInteractionKey(conversion.address);
      const evaluated = candidates.acquisitionConversion(conversion.address);
      evaluatedConversions.set(key, evaluated);
      if (
        evaluated.kind !== 'acquisitionConversion' ||
        evaluated.result.artificerReplacementAddress === undefined
      )
        continue;
      const replacement = createArtificerReplacementControl(
        catalog,
        candidates,
        conversion,
        evaluated.result.artificerReplacementAddress,
        evaluated.result.artificerReplacementOptions ?? Object.freeze([]),
      );
      if (replacement === undefined) continue;
      const replacementKey = workspaceInteractionKey(replacement.owner.address);
      effectiveRewardControls.set(replacementKey, replacement);
      replacementControls.set(key, replacement);
    }
  }

  const effectiveTraitControls = new Map(traitControls ?? []);
  const effectiveLevelResolutionControls = new Map(levelResolutionControls ?? []);
  for (const control of effectiveRewardControls.values()) {
    for (const trait of control.traitOffers ?? [])
      effectiveTraitControls.set(workspaceInteractionKey(trait.address), trait);
    for (const level of control.levelResolutions ?? [])
      effectiveLevelResolutionControls.set(workspaceInteractionKey(level.address), level);
  }

  const derivedShopEntryEdits = new Map<
    string,
    NonNullable<WorkspaceRewardControl['derivedShopEntryEdit']>
  >();
  const artificerReplacementEdits = new Map<
    string,
    NonNullable<WorkspaceRewardControl['artificerReplacementEdit']>
  >();
  for (const control of effectiveRewardControls.values()) {
    if (control.derivedShopEntryEdit !== undefined) {
      derivedShopEntryEdits.set(
        semanticAddressKey(control.owner.address),
        control.derivedShopEntryEdit,
      );
    }
    if (control.artificerReplacementEdit !== undefined)
      artificerReplacementEdits.set(
        semanticAddressKey(control.owner.address),
        control.artificerReplacementEdit,
      );
  }

  const rewards = new Map<string, WorkspaceRewardInteraction>();
  for (const [key, control] of effectiveRewardControls) {
    const rewardTypes =
      control.kind === 'countedReward'
        ? candidates.countedRewardTypes(control.owner, control.binding, control.offer.rewardType)
        : control.rewardTypes;
    rewards.set(
      key,
      Object.freeze({
        authoredRewardTypes: rewardTypes,
        choiceLabel: services.rewardPicker.choiceLabel,
        intentFor: (offer: ResolvedRewardOffer) =>
          rewardIntentFor(
            control.owner,
            offer,
            control.derivedShopEntryEdit,
            control.artificerReplacementEdit,
          ),
        key,
        load: () => candidates.rewardDomain(control.owner, rewardTypes, control.offer),
        model: services.rewardPicker.project,
        owner: control.owner.address,
        selected: control.offer,
        summary: services.rewardPicker.summary,
      }),
    );
  }

  const acquisitionConversions = new Map();
  for (const control of effectiveRewardControls.values()) {
    for (const conversion of control.conversions ?? []) {
      const key = workspaceInteractionKey(conversion.address);
      const evaluated =
        evaluatedConversions.get(key) ?? candidates.acquisitionConversion(conversion.address);
      acquisitionConversions.set(
        key,
        Object.freeze({
          ...(() => {
            return evaluated.kind === 'acquisitionConversion'
              ? {
                  timePieceSupported: evaluated.result.timePieceSupported,
                  artificerSupported: evaluated.result.artificerSupported,
                  ...(evaluated.result.artificerDefaultReplacement === undefined
                    ? {}
                    : {
                        artificerDefaultReplacement: evaluated.result.artificerDefaultReplacement,
                      }),
                  artificerReplacementOptions:
                    evaluated.result.artificerReplacementOptions ?? Object.freeze([]),
                  ...(replacementControls.get(key) === undefined
                    ? {}
                    : { artificerReplacementControl: replacementControls.get(key)! }),
                  visible:
                    evaluated.result.timePieceSupported ||
                    evaluated.result.artificerSupported ||
                    conversion.value.kind !== 'normal',
                }
              : {
                  timePieceSupported: false,
                  artificerSupported: false,
                  artificerReplacementOptions: Object.freeze([]),
                  visible: conversion.value.kind !== 'normal',
                };
          })(),
          intentFor: (
            value: import('@run-planner/engine/authored-project').AcquisitionDisposition,
          ) =>
            derivedShopPayloadIntent(
              control.derivedShopEntryEdit,
              Object.freeze({
                kind: 'ReplaceAcquisitionDisposition' as const,
                acquisition: conversion.address,
                value,
              }),
              control.artificerReplacementEdit,
            ),
          key,
          owner: conversion.address,
          value: conversion.value,
        }),
      );
    }
  }

  const traitOffers = new Map<string, WorkspaceTraitOfferInteraction>();
  for (const [key, control] of effectiveTraitControls) {
    const derivedShopEntryEdit = derivedShopEntryEdits.get(semanticAddressKey(control.rewardOwner));
    const artificerReplacementEdit = artificerReplacementEdits.get(
      semanticAddressKey(control.rewardOwner),
    );
    const traitChoices = Object.freeze(
      control.giver.traitKeys.map((traitKey) => {
        const trait = catalog.traits.byKey[traitKey];
        if (trait === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} references unknown trait ${traitKey}`,
          );
        }
        return Object.freeze({ label: trait.label, value: trait.key });
      }),
    );
    const load = (value = control.offer) => candidates.traitOffer(control.address, value);
    const optionDomains = new Map<
      string,
      ReturnType<WorkspaceTraitOfferInteraction['optionDomain']>
    >();
    const optionDomain = (value: AuthoredTraitOffer, optionKey: TraitOptionKey) => {
      if (value.kind === 'fallbackGold') {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(control.address)} Fallback Gold has no trait option domain`,
        );
      }
      const prepared = services.traitDomain.prepare(control.giver, value, optionKey);
      const domainKey = `${optionKey}:${JSON.stringify(value)}:${prepared.variants
        .map((option) => `${option.traitKey}:${option.rarity ?? ''}:${option.targetTraitKey ?? ''}`)
        .join(',')}`;
      const existing = optionDomains.get(domainKey);
      if (existing !== undefined) return existing;
      const option = value.options[optionIndex(optionKey)];
      const declaration = option === undefined ? undefined : catalog.traits.byKey[option.traitKey];
      const hasTargetPicker =
        option !== undefined &&
        value.selectedOptionKey === optionKey &&
        declaration?.targetedAcquisition !== undefined;
      const circeControl =
        value.selectedOptionKey === optionKey && declaration?.selectedDisposition.kind === 'circe'
          ? Object.freeze({
              // The draft selection owns this exact child even before a save
              // republishes workspace controls. Retain the persisted marker
              // only as presentation fallback; the semantic address is exact.
              address: createCirceResolutionAddress(control.address, optionKey),
              marker: control.circeResolution?.marker ?? control.marker,
              optionKey,
              ...(option?.circeResolution === undefined ? {} : { value: option.circeResolution }),
            })
          : undefined;
      const echoPomControl =
        value.selectedOptionKey === optionKey &&
        declaration?.selectedDisposition.kind === 'echo' &&
        declaration.selectedDisposition.effect === 'doubleLevel'
          ? Object.freeze({
              address: createEchoPomTargetAddress(control.address, optionKey),
              marker: control.echoPomTarget?.marker ?? control.marker,
              optionKey,
              ...(option === undefined || !('echoPomTarget' in option)
                ? {}
                : { value: option.echoPomTarget }),
            })
          : undefined;
      const echoLastRunBoonControl =
        value.selectedOptionKey === optionKey &&
        declaration?.selectedDisposition.kind === 'echo' &&
        declaration.selectedDisposition.effect === 'lastRunBoon'
          ? Object.freeze({
              address: createEchoLastRunBoonAddress(control.address, optionKey),
              marker: control.echoLastRunBoon?.marker ?? control.marker,
              optionKey,
              ...(option?.echoLastRunBoon === undefined ? {} : { value: option.echoLastRunBoon }),
            })
          : undefined;
      const echoLastRewardControl =
        value.selectedOptionKey === optionKey &&
        declaration?.selectedDisposition.kind === 'echo' &&
        declaration.selectedDisposition.effect === 'lastReward'
          ? Object.freeze({
              address: createEchoLastRewardAddress(control.address, optionKey),
              marker: control.echoLastReward?.marker ?? control.marker,
              optionKey,
              ...(option?.echoLastReward === undefined ? {} : { value: option.echoLastReward }),
            })
          : undefined;
      const allTogetherSetControls =
        value.selectedOptionKey === optionKey &&
        declaration?.selectedDisposition.kind === 'directTraitSets'
          ? Object.freeze(
              declaration.selectedDisposition.sets.map((set) => {
                const address = createAllTogetherSetAddress(control.address, optionKey, set.key);
                const persisted = control.allTogetherSets?.find(
                  (candidate) => candidate.setKey === set.key,
                );
                return Object.freeze({
                  address,
                  marker: persisted?.marker ?? control.marker,
                  optionKey,
                  setKey: set.key,
                  ...(option?.allTogetherResult === undefined
                    ? {}
                    : { value: option.allTogetherResult[set.key] }),
                });
              }),
            )
          : undefined;
      let projected: ReturnType<typeof services.traitDomain.project> | undefined;
      const bound = Object.freeze({
        hasTargetPicker,
        ...(circeControl === undefined
          ? {}
          : {
              circeResolution: Object.freeze({
                control: circeControl,
                intentFor: (
                  offer: AuthoredTraitOfferTraits,
                  resolution: AuthoredCirceResolution,
                ) => {
                  const index = optionIndex(optionKey);
                  const existing = offer.options[index];
                  if (existing === undefined)
                    throw new StructuredWorkspaceProjectionContractError(
                      `${semanticAddressKey(control.address)} is missing ${optionKey}`,
                    );
                  const options = [...offer.options];
                  options[index] = Object.freeze({ ...existing, circeResolution: resolution });
                  return derivedShopPayloadIntent(
                    derivedShopEntryEdit,
                    ordinaryTraitOfferCommandFor(
                      control.address,
                      Object.freeze({
                        ...offer,
                        options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      }),
                    ),
                    artificerReplacementEdit,
                  );
                },
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.circeResolution(
                        control.address,
                        offer,
                        optionKey,
                      );
                      if (evaluated.kind !== 'circeResolutionDomain') return undefined;
                      const result = evaluated.result;
                      return Object.freeze({
                        arcanaChoices: Object.freeze(
                          result.arcanaKeys.map((key) =>
                            Object.freeze({
                              label: catalog.arcanaCards.byKey[key]?.label ?? key,
                              value: key,
                            }),
                          ),
                        ),
                        effect: result.effect,
                        outerAvailable: result.outerAvailable,
                        requiredCount: result.requiredCount,
                        vowChoices: Object.freeze(
                          result.vowKeys.map((key) =>
                            Object.freeze({
                              label: catalog.fearVows.byKey[key]?.label ?? key,
                              value: key,
                            }),
                          ),
                        ),
                      });
                    },
                  }),
              }),
            }),
        ...(echoPomControl === undefined
          ? {}
          : {
              echoPomTarget: Object.freeze({
                control: echoPomControl,
                intentFor: (offer: AuthoredTraitOfferTraits, targetTraitKey: string | null) => {
                  const index = optionIndex(optionKey);
                  const existing = offer.options[index];
                  if (existing === undefined)
                    throw new StructuredWorkspaceProjectionContractError(
                      `${semanticAddressKey(control.address)} is missing ${optionKey}`,
                    );
                  const options = [...offer.options];
                  options[index] = Object.freeze({ ...existing, echoPomTarget: targetTraitKey });
                  return derivedShopPayloadIntent(
                    derivedShopEntryEdit,
                    ordinaryTraitOfferCommandFor(
                      control.address,
                      Object.freeze({
                        ...offer,
                        options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      }),
                    ),
                    artificerReplacementEdit,
                  );
                },
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.echoPomTarget(control.address, offer, optionKey);
                      if (evaluated.kind !== 'echoPomTargetDomain') return undefined;
                      return Object.freeze({
                        choices: Object.freeze(
                          evaluated.result.traitKeys.map((key) =>
                            Object.freeze({
                              label: catalog.traits.byKey[key]?.label ?? key,
                              value: key,
                            }),
                          ),
                        ),
                        emptyNoOpAllowed: evaluated.result.emptyNoOpAllowed,
                      });
                    },
                  }),
              }),
            }),
        ...(echoLastRunBoonControl === undefined
          ? {}
          : {
              echoLastRunBoon: Object.freeze({
                control: echoLastRunBoonControl,
                intentFor: (
                  offer: AuthoredTraitOfferTraits,
                  child: AuthoredEchoLastRunBoonOffer,
                ) => {
                  const index = optionIndex(optionKey);
                  const existing = offer.options[index];
                  if (existing === undefined)
                    throw new StructuredWorkspaceProjectionContractError(
                      `${semanticAddressKey(control.address)} is missing ${optionKey}`,
                    );
                  const options = [...offer.options];
                  options[index] = Object.freeze({ ...existing, echoLastRunBoon: child });
                  return derivedShopPayloadIntent(
                    derivedShopEntryEdit,
                    ordinaryTraitOfferCommandFor(
                      control.address,
                      Object.freeze({
                        ...offer,
                        options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      }),
                    ),
                    artificerReplacementEdit,
                  );
                },
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.echoLastRunBoon(
                        control.address,
                        offer,
                        optionKey,
                      );
                      if (evaluated.kind !== 'echoLastRunBoonDomain') return undefined;
                      const projectCandidate = (
                        candidate: (typeof evaluated.result.candidates)[number],
                      ) => {
                        const giver = catalog.traitGivers.byKey[candidate.option.giverKey];
                        const trait = catalog.traits.byKey[candidate.option.traitKey];
                        return Object.freeze({
                          label: `${giver?.label ?? candidate.option.giverKey} · ${trait?.label ?? candidate.option.traitKey} · ${candidate.option.rarity}`,
                          value: candidate.option,
                          effectiveRarity: candidate.effectiveRarity,
                          supported: candidate.supported,
                          targetChoices: Object.freeze(
                            candidate.targetTraitKeys.map((traitKey) =>
                              Object.freeze({
                                label: catalog.traits.byKey[traitKey]?.label ?? traitKey,
                                value: traitKey,
                              }),
                            ),
                          ),
                        });
                      };
                      const projectedCandidates = Object.freeze(
                        evaluated.result.candidates.map(projectCandidate),
                      );
                      return Object.freeze({
                        candidates: projectedCandidates,
                        candidatesByOption: Object.freeze(
                          evaluated.result.candidatesByOption.map((row) =>
                            Object.freeze(row.map(projectCandidate)),
                          ),
                        ),
                        ...(evaluated.result.appendCandidate === undefined
                          ? {}
                          : {
                              appendCandidate: projectCandidate(evaluated.result.appendCandidate),
                            }),
                      });
                    },
                  }),
              }),
            }),
        ...(echoLastRewardControl === undefined
          ? {}
          : {
              echoLastReward: Object.freeze({
                control: echoLastRewardControl,
                intentFor: (
                  offer: AuthoredTraitOfferTraits,
                  child: AuthoredEchoLastRewardAcquisition,
                ) => {
                  const index = optionIndex(optionKey);
                  const existing = offer.options[index];
                  if (existing === undefined)
                    throw new StructuredWorkspaceProjectionContractError(
                      `${semanticAddressKey(control.address)} is missing ${optionKey}`,
                    );
                  const options = [...offer.options];
                  options[index] = Object.freeze({ ...existing, echoLastReward: child });
                  return derivedShopPayloadIntent(
                    derivedShopEntryEdit,
                    ordinaryTraitOfferCommandFor(
                      control.address,
                      Object.freeze({
                        ...offer,
                        options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      }),
                    ),
                    artificerReplacementEdit,
                  );
                },
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.echoLastReward(
                        control.address,
                        offer,
                        optionKey,
                      );
                      if (evaluated.kind !== 'echoLastRewardDomain') return undefined;
                      const replayOwner = createEchoLastRewardAddress(control.address, optionKey);
                      const site = createAcquisitionSiteAddress(replayOwner, 'echoReplay');
                      const entry = createAcquisitionEntryAddress(site, 'recreatedReward');
                      const role = createAcquisitionRoleAddress(entry, 'self');
                      const trait = createTraitOfferAddress(entry, 'self');
                      const level = createLevelResolutionAddress(entry, 'self');
                      const current = offer.options[optionIndex(optionKey)]?.echoLastReward;
                      const traitOffer =
                        current?.traitOffer ?? evaluated.result.defaultValue.traitOffer;
                      const nextTraitOffer =
                        traitOffer?.kind === 'traits'
                          ? candidates.nextTraitOfferDraft(trait, traitOffer)
                          : undefined;
                      const nestedGiver =
                        traitOffer?.kind === 'traits'
                          ? catalog.traitGivers.byKey[traitOffer.giverKey]
                          : undefined;
                      const traitOptionDomains =
                        traitOffer?.kind === 'traits' && nestedGiver !== undefined
                          ? Object.freeze(
                              traitOffer.options.map((_traitOption, index) => {
                                const nestedOptionKey = (
                                  ['option1', 'option2', 'option3'] as const
                                )[index]!;
                                const nestedPrepared = services.traitDomain.prepare(
                                  nestedGiver,
                                  traitOffer,
                                  nestedOptionKey,
                                );
                                const focused = candidates.traitOfferFocusedOptions(
                                  trait,
                                  traitOffer,
                                  nestedOptionKey,
                                  nestedPrepared.variants,
                                );
                                const nestedOption = traitOffer.options[index];
                                const declaration =
                                  nestedOption === undefined
                                    ? undefined
                                    : catalog.traits.byKey[nestedOption.traitKey];
                                const targets =
                                  nestedOption !== undefined &&
                                  traitOffer.selectedOptionKey === nestedOptionKey &&
                                  declaration?.targetedAcquisition !== undefined
                                    ? candidates.traitAcquisitionTargets(
                                        trait,
                                        traitOffer,
                                        nestedOptionKey,
                                        nestedOption.targetTraitKey,
                                      )
                                    : undefined;
                                return services.traitDomain.project(
                                  nestedGiver,
                                  traitOffer,
                                  nestedPrepared,
                                  focused,
                                  targets,
                                );
                              }),
                            )
                          : Object.freeze([]);
                      const levelValue =
                        current?.levelResolution ?? evaluated.result.defaultValue.levelResolution;
                      const levelProjection =
                        levelValue === undefined
                          ? undefined
                          : candidates.levelResolution(level, levelValue);
                      const levelGroups = levelProjection?.groups ?? [];
                      const levelTargetKeys =
                        levelGroups.length === 0
                          ? []
                          : levelGroups[0]!.surface.eligibleTargetTraitKeys.filter((traitKey) =>
                              levelGroups.every((group) =>
                                group.surface.eligibleTargetTraitKeys.includes(traitKey),
                              ),
                            );
                      const conversion = candidates.acquisitionConversion(role);
                      return Object.freeze({
                        rewardType: evaluated.result.rewardType,
                        rewardLabel:
                          catalog.rewards.rewardTypes.byKey[evaluated.result.rewardType]?.label ??
                          evaluated.result.rewardType,
                        defaultValue: evaluated.result.defaultValue,
                        goldSupported:
                          conversion.kind === 'acquisitionConversion' &&
                          conversion.result.timePieceSupported,
                        traitOptionDomains,
                        traitRarityEditable: nestedGiver?.rarityPolicy.kind === 'selectable',
                        ...(nextTraitOffer === undefined ? {} : { nextTraitOffer }),
                        levelTargetChoices: Object.freeze(
                          levelTargetKeys.map((traitKey) =>
                            Object.freeze({
                              label: catalog.traits.byKey[traitKey]?.label ?? traitKey,
                              value: traitKey,
                            }),
                          ),
                        ),
                        emptyLevelTargetAllowed:
                          levelGroups.length > 0 &&
                          levelGroups.every(
                            (group) =>
                              group.surface.emptyTargetAllowed === true &&
                              group.surface.eligibleTargetTraitKeys.length === 0,
                          ),
                      });
                    },
                  }),
              }),
            }),
        ...(allTogetherSetControls === undefined
          ? {}
          : {
              allTogetherSets: Object.freeze(
                allTogetherSetControls.map((setControl) =>
                  Object.freeze({
                    control: setControl,
                    intentFor: (result: string | null) =>
                      derivedShopPayloadIntent(
                        derivedShopEntryEdit,
                        Object.freeze({
                          kind: 'ReplaceAllTogetherSet' as const,
                          set: setControl.address,
                          value: result,
                        }),
                        artificerReplacementEdit,
                      ),
                    offerFor: (offer: AuthoredTraitOfferTraits, result: string | null) => {
                      const index = optionIndex(optionKey);
                      const existing = offer.options[index];
                      if (existing === undefined)
                        throw new StructuredWorkspaceProjectionContractError(
                          `${semanticAddressKey(control.address)} is missing ${optionKey}`,
                        );
                      const current =
                        existing.allTogetherResult ??
                        createDefaultAllTogetherResult(catalog, existing.traitKey);
                      if (current === undefined)
                        throw new StructuredWorkspaceProjectionContractError(
                          `${existing.traitKey} has no All Together default`,
                        );
                      const options = [...offer.options];
                      options[index] = Object.freeze({
                        ...existing,
                        allTogetherResult: Object.freeze({
                          ...current,
                          [setControl.setKey]: result,
                        }),
                      });
                      return Object.freeze({
                        ...offer,
                        options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
                      });
                    },
                    forOffer: (offer: AuthoredTraitOfferTraits) =>
                      Object.freeze({
                        load: () => {
                          const evaluated = candidates.allTogetherSet(
                            control.address,
                            offer,
                            optionKey,
                            setControl.setKey,
                          );
                          if (evaluated.kind !== 'allTogetherSetDomain') return undefined;
                          return Object.freeze({
                            choices: Object.freeze(
                              evaluated.result.values.map((value) =>
                                Object.freeze({
                                  label:
                                    value === null
                                      ? 'No grant (set exhausted)'
                                      : (catalog.traits.byKey[value]?.label ?? value),
                                  value,
                                }),
                              ),
                            ),
                          });
                        },
                      }),
                  }),
                ),
              ),
            }),
        load() {
          if (projected !== undefined) return projected;
          const focused = candidates.traitOfferFocusedOptions(
            control.address,
            value,
            optionKey,
            prepared.variants,
          );
          const targets =
            hasTargetPicker && option !== undefined
              ? candidates.traitAcquisitionTargets(
                  control.address,
                  value,
                  optionKey,
                  option.targetTraitKey,
                )
              : undefined;
          projected = services.traitDomain.project(
            control.giver,
            value,
            prepared,
            focused,
            targets,
          );
          return projected;
        },
      });
      optionDomains.set(domainKey, bound);
      return bound;
    };
    traitOffers.set(
      key,
      Object.freeze({
        acquisitionRoleLabel: control.acquisitionRoleLabel,
        choices: traitChoices,
        giver: control.giver,
        intentFor: (value: AuthoredTraitOffer) =>
          derivedShopPayloadIntent(
            derivedShopEntryEdit,
            traitOfferCommandFor(control.address, value),
            artificerReplacementEdit,
          ),
        key,
        load,
        owner: control.address,
        rarityEditable: control.rarityEditable !== false,
        optionDomain,
        traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
        selectedIntent: (selectedOptionKey: AuthoredTraitOfferTraits['selectedOptionKey']) =>
          derivedShopPayloadIntent(
            derivedShopEntryEdit,
            Object.freeze({
              kind: 'ReplaceTraitSelection' as const,
              selectedOptionKey,
              trait: control.address,
            }),
            artificerReplacementEdit,
          ),
        value: control.offer,
        traitsStartingDraft: () =>
          candidates.traitOfferStartingDraft(control.address, control.giver.key),
        nextTraitOfferDraft: (value: AuthoredTraitOfferTraits) =>
          candidates.nextTraitOfferDraft(control.address, value),
        ...(control.deathDefianceCondition === undefined
          ? {}
          : {
              deathDefianceCondition: {
                value: control.deathDefianceCondition.value,
              },
            }),
      }),
    );
  }

  const levelResolutions = new Map<string, WorkspaceLevelResolutionInteraction>();
  for (const [key, control] of effectiveLevelResolutionControls) {
    const artificerReplacementEdit = artificerReplacementEdits.get(
      semanticAddressKey(control.rewardOwner),
    );
    levelResolutions.set(
      key,
      Object.freeze({
        acquisitionRoleLabel: control.acquisitionRoleLabel,
        intentFor: (value: AuthoredLevelResolution) =>
          derivedShopPayloadIntent(
            derivedShopEntryEdits.get(semanticAddressKey(control.rewardOwner)),
            levelResolutionCommandFor(control.address, value),
            artificerReplacementEdit,
          ),
        key,
        levelCount: control.levelCount,
        load: (value = control.value) => candidates.levelResolution(control.address, value),
        owner: control.address,
        traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
        value: control.value,
      }),
    );
  }
  const bossCompletionArcana = new Map<string, WorkspaceBossCompletionArcanaInteraction>();
  for (const [key, control] of bossCompletionArcanaControls ?? []) {
    bossCompletionArcana.set(
      key,
      Object.freeze({
        choices: Object.freeze(
          catalog.arcanaCards.values.map((card) =>
            Object.freeze({ label: card.label, value: card.key }),
          ),
        ),
        intentFor: (arcanaKeys: readonly string[]) =>
          Object.freeze({
            command: Object.freeze({
              kind: 'ReplaceBossCompletionArcana' as const,
              completion: control.address,
              arcanaKeys: Object.freeze([...arcanaKeys]),
            }),
          }),
        key,
        load: (arcanaKeys = control.value) =>
          candidates.bossCompletionArcana(control.address, arcanaKeys),
        owner: control.address,
        value: control.value,
      }),
    );
  }
  const keepsakeSelections = new Map<string, WorkspaceKeepsakeSelectionInteraction>();
  for (const [key, control] of keepsakeSelectionControls ?? []) {
    const postboss = control.address.owner !== 'routeStart';
    keepsakeSelections.set(
      key,
      Object.freeze({
        choices: Object.freeze(
          catalog.keepsakes.values.map((keepsake) =>
            Object.freeze({ label: keepsake.label, value: keepsake.key }),
          ),
        ),
        key,
        load: () => candidates.keepsakeSelections(control.address),
        owner: control.address,
        value: control.value,
        replaceIntent: (keepsakeKey: string) =>
          Object.freeze({
            command: postboss
              ? Object.freeze({
                  kind: 'ReplacePostbossKeepsake' as const,
                  selection: control.address as Extract<
                    KeepsakeSelectionAddress,
                    {
                      readonly owner: import('@run-planner/engine/authored-project').CompletionRoomAddress;
                    }
                  >,
                  value: Object.freeze({ kind: 'replace' as const, keepsakeKey }),
                })
              : Object.freeze({
                  kind: 'ReplaceStartingKeepsake' as const,
                  selection: control.address as Extract<
                    KeepsakeSelectionAddress,
                    { readonly owner: 'routeStart' }
                  >,
                  keepsakeKey,
                }),
          }),
        ...(postboss
          ? {
              retainIntent: () =>
                Object.freeze({
                  command: Object.freeze({
                    kind: 'ReplacePostbossKeepsake' as const,
                    selection: control.address as Extract<
                      KeepsakeSelectionAddress,
                      {
                        readonly owner: import('@run-planner/engine/authored-project').CompletionRoomAddress;
                      }
                    >,
                    value: Object.freeze({ kind: 'retain' as const }),
                  }),
                }),
            }
          : {}),
      }),
    );
  }
  const keepsakeEquipResults = new Map<string, WorkspaceKeepsakeEquipResultInteraction>();
  for (const [key, control] of keepsakeEquipResultControls ?? []) {
    const effect = catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === control.address.resultKind,
    )?.effect;
    if (effect === undefined)
      throw new Error(`Missing ${control.address.resultKind} keepsake descriptor`);
    if (effect.kind === 'experimentalHammer') {
      keepsakeEquipResults.set(
        key,
        Object.freeze({
          choices: Object.freeze(
            catalog.traits.values
              .filter((trait) => trait.hammerCompatibility !== undefined)
              .map((trait) => Object.freeze({ label: trait.label, value: trait.key }))
              .concat([Object.freeze({ label: 'No compatible Hammer', value: '__exhausted' })]),
          ),
          key,
          owner: control.address as KeepsakeEquipResultAddress & {
            readonly resultKind: 'experimentalHammer';
          },
          ...(control.value === undefined
            ? {}
            : {
                value:
                  control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer'],
              }),
          load: (
            value = control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer'],
          ) => candidates.keepsakeEquipResult(control.address, value),
          intentFor: (
            value: NonNullable<
              import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['experimentalHammer']
            >,
          ) =>
            Object.freeze({
              command: Object.freeze({
                kind: 'ReplaceExperimentalHammerEquipResult' as const,
                result: control.address as KeepsakeEquipResultAddress & {
                  readonly resultKind: 'experimentalHammer';
                },
                value,
              }),
            }),
        }),
      );
      continue;
    }
    if (effect.kind !== 'jeweledPom') continue;
    keepsakeEquipResults.set(
      key,
      Object.freeze({
        choices: Object.freeze(
          (catalog.traitGivers.byKey[effect.giverKey]?.traitKeys ?? []).map((traitKey) =>
            Object.freeze({
              label: catalog.traits.byKey[traitKey]?.label ?? traitKey,
              value: traitKey,
            }),
          ),
        ),
        key,
        owner: control.address as KeepsakeEquipResultAddress & {
          readonly resultKind: 'jeweledPom';
        },
        ...(control.value === undefined
          ? {}
          : {
              value:
                control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom'],
            }),
        supportsDeathDefianceCondition: (
          catalog.traitGivers.byKey[effect.giverKey]?.traitKeys ?? []
        ).some(
          (traitKey) =>
            catalog.traits.byKey[traitKey]?.offerRequirements.some(
              (requirement) =>
                requirement.kind === 'offerContext' &&
                requirement.context === 'deathDefianceConditionMet',
            ) === true,
        ),
        load: (
          value = control.value as import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom'],
        ) => candidates.keepsakeEquipResult(control.address, value),
        intentFor: (
          value: NonNullable<
            import('@run-planner/engine/authored-project').AuthoredKeepsakeEquipResults['jeweledPom']
          >,
        ) =>
          Object.freeze({
            command: Object.freeze({
              kind: 'ReplaceJeweledPomEquipResult' as const,
              result: control.address as KeepsakeEquipResultAddress & {
                readonly resultKind: 'jeweledPom';
              },
              value,
            }),
          }),
      }),
    );
  }

  return Object.freeze({
    batchRewardStores,
    encounterPhases,
    figLeafSkips,
    gorgonConditions,
    exitFrontierCapabilities,
    exitSelections,
    fieldsCageOutcomes,
    fieldsActionOrders,
    naturalChaosExits,
    naturalChaosSpawns,
    hubTakeovers,
    hubSlots,
    hubVisitOrders,
    rewards,
    acquisitionConversions,
    traitOffers,
    levelResolutions,
    bossCompletionArcana,
    keepsakeSelections,
    keepsakeEquipResults,
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    rooms,
    shipCombatPhaseCounts,
    acquisitionOrders,
    shopDeathDefianceConditions,
    sideRoomEntryOrders,
    sideRoomGenerations,
    zagreusContracts,
    zagreusSpawns,
    starts,
    structural,
    takeoverBatches,
    topologyRemovals,
  });
}
