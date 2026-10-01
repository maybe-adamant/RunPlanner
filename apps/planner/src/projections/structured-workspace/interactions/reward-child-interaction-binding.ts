import type { WorkspaceRewardInteraction } from '../contracts/rewards';
import type {
  WorkspaceLevelResolutionControl,
  WorkspaceLevelResolutionInteraction,
  WorkspaceTraitOfferControl,
  WorkspaceTraitOfferInteraction,
} from '../contracts/traits';
import {
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type ProjectCommand,
  type JudgmentArcanaAddress,
  type FigurineArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type AuthoredRewardState,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { CandidateProjectionSession } from '@planner/projections/candidates/candidateProjection';
import type { RewardPickerProjectionService } from '@planner/projections/rewards/rewardPicker';

import { bindRewardPayloadInteractions } from './reward-payload-interactions';
import { bindAcquisitionConversionInteractions } from './acquisition-conversion-interactions';
import { bindTraitOfferInteractions } from './trait-offers/bind';
import { bindResolutionInteractions } from './resolution-interactions';
import { bindShopOfferInteractions } from './shop-offer-interactions';

import { workspaceInteractionKey } from '../contract';
import type { WorkspaceCommandIntent } from '../contract';
import type {
  WorkspaceKeepsakeSelectionInteraction,
  WorkspaceKeepsakeEquipResultInteraction,
} from '../contract';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type {
  WorkspaceJudgmentArcanaInteraction,
  WorkspaceFigurineArcanaInteraction,
  WorkspaceSteadyGrowthControl,
  WorkspaceSteadyGrowthInteraction,
  WorkspaceTranscendentEmbryoControl,
  WorkspaceTranscendentEmbryoInteraction,
  WorkspaceFountainRarityControl,
  WorkspaceFountainRarityInteraction,
} from '../contracts/timeline';
import type { WorkspaceAcquisitionConversionInteraction } from '../contracts/traits';
import type { WorkspaceShopOfferInteraction } from '../contracts/commerce';

export interface WorkspaceRewardChildInteractionCatalog {
  readonly rewards: ReadonlyMap<string, WorkspaceRewardInteraction>;
  readonly shopOffers: ReadonlyMap<string, WorkspaceShopOfferInteraction>;
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

type EchoChildEdit = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'ReplaceTraitOffer'
      | 'ResetEncounterTraitOffer'
      | 'ReplaceGorgonAthenaOffer'
      | 'ReplaceTraitSelection'
      | 'ReplaceConcaveStoneResult'
      | 'ReplaceLevelResolution'
      | 'ReplaceAcquisitionDisposition'
      | 'ReplaceSeaStarResult';
  }
>;

function withDerivedEchoSeed<
  Edit extends EchoChildEdit | Extract<ProjectCommand, { readonly kind: 'EditEchoReplay' }>,
>(
  intent: WorkspaceCommandIntent<Edit>,
  owner: AcquisitionEntryAddress | undefined,
  replaySeeds: ReadonlyMap<
    string,
    {
      readonly entry: AcquisitionEntryAddress;
      readonly offer: import('@run-planner/engine/reward-kernel').ResolvedRewardOffer;
    }
  >,
): WorkspaceCommandIntent<Edit | Extract<ProjectCommand, { readonly kind: 'EditEchoReplay' }>> {
  const seed = owner === undefined ? undefined : replaySeeds.get(semanticAddressKey(owner));
  if (seed === undefined || intent.command.kind === 'EditEchoReplay') return intent;
  return Object.freeze({
    ...intent,
    command: Object.freeze({
      kind: 'EditEchoReplay' as const,
      entry: seed.entry,
      sourceOffer: seed.offer,
      edit: intent.command as EchoChildEdit,
    }),
  });
}

export function bindRewardChildInteractions(input: {
  readonly catalog: Catalog;
  readonly candidates: CandidateProjectionSession;
  readonly contextualPicker: import('@planner/projections/contextual/contextualPicker').ContextualPickerProjectionService;
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
      readonly selectedKeepsakeKey?: string;
      readonly unavailableReason?: 'rackUnavailableOnRoute';
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
  const replaySeeds = new Map<
    string,
    {
      readonly entry: AcquisitionEntryAddress;
      readonly offer: import('@run-planner/engine/reward-kernel').ResolvedRewardOffer;
    }
  >();
  for (const control of rewardControls.values()) {
    if (control.owner.kind === 'acquisitionEntry' && control.derivedReplaySeed !== undefined)
      replaySeeds.set(
        semanticAddressKey(control.owner.address),
        Object.freeze({ entry: control.owner.address, offer: control.derivedReplaySeed }),
      );
    for (const trait of control.traitOffers ?? [])
      effectiveTraitControls.set(workspaceInteractionKey(trait.address), trait);
    for (const level of control.levelResolutions ?? [])
      effectiveLevelResolutionControls.set(workspaceInteractionKey(level.address), level);
  }

  const rewards = bindRewardPayloadInteractions({
    candidates,
    rewardControls,
    artificerOptionsByReplacement,
    rewardPicker,
    semanticAddressKey,
  });
  const shopOffers = bindShopOfferInteractions({
    candidates,
    catalog,
    contextualPicker,
    rewardPicker,
    rewardControls,
  });

  const baseAcquisitionConversions = bindAcquisitionConversionInteractions({
    catalog,
    candidates,
    project,
    rewardControls,
    evaluatedConversions,
  });

  const baseTraitOffers = bindTraitOfferInteractions({
    catalog,
    candidates,
    showPersephoneBonus:
      project.route.loadout.aspectKey !== null &&
      catalog.aspects.byKey[project.route.loadout.aspectKey]?.traitOfferLevelBonus !== undefined,
    traitControls: effectiveTraitControls,
    traitDomain,
  });
  const {
    levelResolutions: baseLevelResolutions,
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
    ...(judgmentArcanaControls === undefined ? {} : { judgmentArcanaControls }),
    ...(figurineArcanaControls === undefined ? {} : { figurineArcanaControls }),
    ...(keepsakeSelectionControls === undefined ? {} : { keepsakeSelectionControls }),
    ...(keepsakeEquipResultControls === undefined ? {} : { keepsakeEquipResultControls }),
  });

  const acquisitionConversions = new Map(
    [...baseAcquisitionConversions].map(([key, interaction]) => {
      const owner = interaction.owner.owner;
      const entry = owner.kind === 'acquisitionEntry' ? owner : undefined;
      return [
        key,
        Object.freeze({
          ...interaction,
          intentFor: (value: Parameters<typeof interaction.intentFor>[0]) =>
            withDerivedEchoSeed(interaction.intentFor(value), entry, replaySeeds),
          seaStarIntentFor: (procced: boolean) =>
            withDerivedEchoSeed(interaction.seaStarIntentFor(procced), entry, replaySeeds),
        }),
      ] as const;
    }),
  );
  const traitOffers = new Map(
    [...baseTraitOffers].map(([key, interaction]) => {
      const owner = interaction.owner.owner;
      const entry = owner.kind === 'acquisitionEntry' ? owner : undefined;
      return [
        key,
        Object.freeze({
          ...interaction,
          intentFor: (value: Parameters<typeof interaction.intentFor>[0]) =>
            withDerivedEchoSeed(interaction.intentFor(value), entry, replaySeeds),
          selectedIntent: (optionKey: Parameters<typeof interaction.selectedIntent>[0]) =>
            withDerivedEchoSeed(interaction.selectedIntent(optionKey), entry, replaySeeds),
        }),
      ] as const;
    }),
  );
  const levelResolutions = new Map(
    [...baseLevelResolutions].map(([key, interaction]) => {
      const owner = interaction.owner.owner;
      const entry = owner.kind === 'acquisitionEntry' ? owner : undefined;
      return [
        key,
        Object.freeze({
          ...interaction,
          intentFor: (value: Parameters<typeof interaction.intentFor>[0]) =>
            withDerivedEchoSeed(interaction.intentFor(value), entry, replaySeeds),
        }),
      ] as const;
    }),
  );

  return Object.freeze({
    rewards,
    shopOffers,
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
