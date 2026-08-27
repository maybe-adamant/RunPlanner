import {
  semanticAddressKey,
  type JudgmentArcanaAddress,
  type FigurineArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type AuthoredRewardState,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import type { RewardPickerProjectionService } from '@planner/projections/rewardPicker';

import { bindRewardPayloadInteractions } from './reward-payload-interactions';
import { bindAcquisitionConversionInteractions } from './acquisition-conversion-interactions';
import { bindTraitOfferInteractions } from './trait-offer-interactions';
import { bindResolutionInteractions } from './resolution-interactions';

import { workspaceInteractionKey } from '../contract';
import type {
  WorkspaceRewardControl,
  WorkspaceRewardInteraction,
  WorkspaceTraitOfferControl,
  WorkspaceLevelResolutionControl,
  WorkspaceLevelResolutionInteraction,
  WorkspaceJudgmentArcanaInteraction,
  WorkspaceFigurineArcanaInteraction,
  WorkspaceKeepsakeSelectionInteraction,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceTraitOfferInteraction,
  WorkspaceSteadyGrowthControl,
  WorkspaceSteadyGrowthInteraction,
  WorkspaceTranscendentEmbryoControl,
  WorkspaceTranscendentEmbryoInteraction,
  WorkspaceFountainRarityControl,
  WorkspaceFountainRarityInteraction,
  WorkspaceAcquisitionConversionInteraction,
} from '../contract';

export interface WorkspaceRewardChildInteractionCatalog {
  readonly rewards: ReadonlyMap<string, WorkspaceRewardInteraction>;
  readonly acquisitionConversions: ReadonlyMap<string, WorkspaceAcquisitionConversionInteraction>;
  readonly traitOffers: ReadonlyMap<string, WorkspaceTraitOfferInteraction>;
  readonly levelResolutions: ReadonlyMap<string, WorkspaceLevelResolutionInteraction>;
  readonly steadyGrowth: ReadonlyMap<string, WorkspaceSteadyGrowthInteraction>;
  readonly transcendentEmbryo: ReadonlyMap<string, WorkspaceTranscendentEmbryoInteraction>;
  readonly fountainRarity: ReadonlyMap<string, WorkspaceFountainRarityInteraction>;
  readonly judgmentArcana: ReadonlyMap<string, WorkspaceJudgmentArcanaInteraction>;
  readonly figurineArcana: ReadonlyMap<string, WorkspaceFigurineArcanaInteraction>;
  readonly keepsakeSelections: ReadonlyMap<string, WorkspaceKeepsakeSelectionInteraction>;
  readonly keepsakeEquipResults: ReadonlyMap<string, WorkspaceKeepsakeEquipResultInteraction>;
}

export function bindRewardChildInteractions(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly contextualPicker: import('@planner/projections/contextualPicker').ContextualPickerProjectionService;
  readonly project: import('@run-planner/engine/simulation').ProjectEvaluationAssembly['project'];
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly traitControls?: ReadonlyMap<string, WorkspaceTraitOfferControl>;
  readonly levelResolutionControls?: ReadonlyMap<string, WorkspaceLevelResolutionControl>;
  readonly steadyGrowthControls?: ReadonlyMap<string, WorkspaceSteadyGrowthControl>;
  readonly transcendentEmbryoControls?: ReadonlyMap<string, WorkspaceTranscendentEmbryoControl>;
  readonly fountainRarityControls?: ReadonlyMap<string, WorkspaceFountainRarityControl>;
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
  readonly rewardPicker: RewardPickerProjectionService;
  readonly traitDomain: import('../contract').StructuredWorkspaceContextualServices['traitDomain'];
}): WorkspaceRewardChildInteractionCatalog {
  const {
    catalog,
    candidates,
    contextualPicker,
    project,
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
    rewardPicker,
    traitDomain,
  } = input;
  const evaluatedConversions = new Map<
    string,
    ReturnType<CandidateProjectionSession['acquisitionConversion']>
  >();
  const artificerOptionsByReplacement = new Map<string, readonly AuthoredRewardState[]>();
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
      artificerOptionsByReplacement.set(
        semanticAddressKey(evaluated.result.artificerReplacementAddress),
        evaluated.result.artificerReplacementOptions ?? Object.freeze([]),
      );
    }
  }

  const effectiveTraitControls = new Map(traitControls ?? []);
  const effectiveLevelResolutionControls = new Map(levelResolutionControls ?? []);
  const effectiveSteadyGrowthControls = new Map(steadyGrowthControls ?? []);
  const effectiveTranscendentEmbryoControls = new Map(transcendentEmbryoControls ?? []);
  const effectiveFountainRarityControls = new Map(fountainRarityControls ?? []);
  for (const control of rewardControls.values()) {
    for (const trait of control.traitOffers ?? [])
      effectiveTraitControls.set(workspaceInteractionKey(trait.address), trait);
    for (const level of control.levelResolutions ?? [])
      effectiveLevelResolutionControls.set(workspaceInteractionKey(level.address), level);
  }

  const derivedShopEntryEdits = new Map<
    string,
    NonNullable<WorkspaceRewardControl['derivedShopEntryEdit']>
  >();
  for (const control of rewardControls.values()) {
    if (control.derivedShopEntryEdit !== undefined) {
      derivedShopEntryEdits.set(
        semanticAddressKey(control.owner.address),
        control.derivedShopEntryEdit,
      );
    }
  }

  const rewards = bindRewardPayloadInteractions({
    candidates,
    rewardControls,
    artificerOptionsByReplacement,
    rewardPicker,
    semanticAddressKey,
  });

  const acquisitionConversions = bindAcquisitionConversionInteractions({
    candidates,
    project,
    rewardControls,
    evaluatedConversions,
  });

  const traitOffers = bindTraitOfferInteractions({
    catalog,
    candidates,
    traitControls: effectiveTraitControls,
    derivedShopEntryEdits,
    traitDomain,
  });
  const {
    levelResolutions,
    steadyGrowth,
    transcendentEmbryo,
    fountainRarity,
    judgmentArcana,
    figurineArcana,
    keepsakeSelections,
    keepsakeEquipResults,
  } = bindResolutionInteractions({
    catalog,
    candidates,
    contextualPicker,
    levelResolutionControls: effectiveLevelResolutionControls,
    steadyGrowthControls: effectiveSteadyGrowthControls,
    transcendentEmbryoControls: effectiveTranscendentEmbryoControls,
    fountainRarityControls: effectiveFountainRarityControls,
    derivedShopEntryEdits,
    ...(judgmentArcanaControls === undefined ? {} : { judgmentArcanaControls }),
    ...(figurineArcanaControls === undefined ? {} : { figurineArcanaControls }),
    ...(keepsakeSelectionControls === undefined ? {} : { keepsakeSelectionControls }),
    ...(keepsakeEquipResultControls === undefined ? {} : { keepsakeEquipResultControls }),
  });

  return Object.freeze({
    rewards,
    acquisitionConversions,
    traitOffers,
    levelResolutions,
    steadyGrowth,
    transcendentEmbryo,
    fountainRarity,
    judgmentArcana,
    figurineArcana,
    keepsakeSelections,
    keepsakeEquipResults,
  });
}
