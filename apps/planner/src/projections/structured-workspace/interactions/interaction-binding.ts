import type {
  JudgmentArcanaAddress,
  FigurineArcanaAddress,
  KeepsakeSelectionAddress,
  KeepsakeEquipResultAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import type { OccurrenceIdFactory } from '@planner/workspace/occurrenceIds';

import type {
  StructuredWorkspaceContextualServices,
  WorkspaceRoomPickerControl,
  WorkspaceRewardControl,
  WorkspaceTraitOfferControl,
  WorkspaceLevelResolutionControl,
  WorkspaceInteractionCatalog,
} from '../contract';
import type {
  WorkspaceBatchInteractionRequirement,
  WorkspaceHubInteractionRequirement,
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceStartInteractionRequirement,
  WorkspaceTakeoverInteractionRequirement,
  WorkspaceTopologyRemovalInteractionRequirement,
} from './interaction-requirements';
import {
  bindOccurrenceLocalInteractions,
  type WorkspaceOccurrenceLocalInteractionCatalog,
} from './occurrence-interaction-binding';
import {
  bindBatchInteractions,
  type WorkspaceBatchInteractionCatalog,
} from './batch-interaction-binding';
import {
  bindHubInteractions,
  type WorkspaceHubInteractionCatalog,
} from './hub-interaction-binding';
import {
  bindTopologyInteractions,
  type WorkspaceTopologyInteractionCatalog,
} from './topology-interaction-binding';
import {
  bindRewardChildInteractions,
  type WorkspaceRewardChildInteractionCatalog,
} from './reward-child-interaction-binding';

export interface WorkspaceInteractionBindingInput {
  readonly allocateOccurrenceId: OccurrenceIdFactory;
  readonly assembly: ProjectEvaluationAssembly;
  readonly batchInteractionRequirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>;
  readonly catalog: Catalog;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly occurrenceInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceOccurrenceInteractionRequirement
  >;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly traitControls?: ReadonlyMap<string, WorkspaceTraitOfferControl>;
  readonly levelResolutionControls?: ReadonlyMap<string, WorkspaceLevelResolutionControl>;
  readonly steadyGrowthControls?: ReadonlyMap<
    string,
    import('../contract').WorkspaceSteadyGrowthControl
  >;
  readonly transcendentEmbryoControls?: ReadonlyMap<
    string,
    import('../contract').WorkspaceTranscendentEmbryoControl
  >;
  readonly fountainRarityControls?: ReadonlyMap<
    string,
    import('../contract').WorkspaceFountainRarityControl
  >;
  readonly judgmentArcanaControls?: ReadonlyMap<
    string,
    { readonly address: JudgmentArcanaAddress; readonly value: readonly string[] }
  >;
  readonly figurineArcanaControls?: ReadonlyMap<
    string,
    { readonly address: FigurineArcanaAddress; readonly value: readonly string[] }
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

export function bindWorkspaceInteractions(
  input: WorkspaceInteractionBindingInput,
): WorkspaceInteractionCatalog {
  const {
    allocateOccurrenceId,
    assembly,
    batchInteractionRequirements,
    catalog,
    hubInteractionRequirements,
    occurrenceInteractionRequirements,
    rewardControls,
    traitControls,
    levelResolutionControls,
    steadyGrowthControls,
    transcendentEmbryoControls,
    fountainRarityControls,
    judgmentArcanaControls,
    figurineArcanaControls,
    keepsakeSelectionControls,
    keepsakeEquipResultControls,
    roomControls,
    services,
    startInteractionRequirements,
    takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements,
  } = input;
  const candidates = services.candidateSessions.bind(assembly);

  const occurrence: WorkspaceOccurrenceLocalInteractionCatalog = bindOccurrenceLocalInteractions(
    catalog,
    allocateOccurrenceId,
    assembly,
    candidates,
    services.contextualPicker,
    occurrenceInteractionRequirements.values(),
  );
  const batch: WorkspaceBatchInteractionCatalog = bindBatchInteractions(
    candidates,
    batchInteractionRequirements.values(),
  );
  const hub: WorkspaceHubInteractionCatalog = bindHubInteractions(
    allocateOccurrenceId,
    candidates,
    hubInteractionRequirements.values(),
  );
  const topology: WorkspaceTopologyInteractionCatalog = bindTopologyInteractions({
    allocateOccurrenceId,
    candidates,
    catalog,
    contextualPicker: services.contextualPicker,
    project: assembly.project,
    roomControls,
    startInteractionRequirements: startInteractionRequirements.values(),
    takeoverInteractionRequirements: takeoverInteractionRequirements.values(),
    topologyRemovalInteractionRequirements: topologyRemovalInteractionRequirements.values(),
  });
  const child: WorkspaceRewardChildInteractionCatalog = bindRewardChildInteractions({
    candidates,
    catalog,
    contextualPicker: services.contextualPicker,
    project: assembly.project,
    rewardControls,
    rewardPicker: services.rewardPicker,
    traitDomain: services.traitDomain,
    ...(traitControls === undefined ? {} : { traitControls }),
    ...(levelResolutionControls === undefined ? {} : { levelResolutionControls }),
    ...(steadyGrowthControls === undefined ? {} : { steadyGrowthControls }),
    ...(transcendentEmbryoControls === undefined ? {} : { transcendentEmbryoControls }),
    ...(fountainRarityControls === undefined ? {} : { fountainRarityControls }),
    ...(judgmentArcanaControls === undefined ? {} : { judgmentArcanaControls }),
    ...(figurineArcanaControls === undefined ? {} : { figurineArcanaControls }),
    ...(keepsakeSelectionControls === undefined ? {} : { keepsakeSelectionControls }),
    ...(keepsakeEquipResultControls === undefined ? {} : { keepsakeEquipResultControls }),
  });

  return Object.freeze({
    ...batch,
    ...child,
    ...occurrence,
    ...hub,
    ...topology,
  });
}
