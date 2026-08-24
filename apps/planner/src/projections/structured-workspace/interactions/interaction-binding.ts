import {
  createOccurrenceAddress,
  createBiomeAddress,
  createRoomActionAddress,
  createCompletionRoomActionAddress,
  createCirceResolutionAddress,
  createTraitAcquisitionTargetAddress,
  createEchoPomTargetAddress,
  createEchoLastRunBoonAddress,
  createAllTogetherSetAddress,
  optionIndex,
  semanticAddressKey,
  roomActionKey,
  seaStarDuplicateSiteKey,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
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
  TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration, TraitRarity } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  evaluateEchoLastRunBoonDraftSupport,
  echoLastRunBoonRarityCandidates,
  echoLastRunBoonTraitCandidatesForRow,
  nemesisRandomEventCandidateSupportForProjectEvaluationAssembly,
  type NemesisRandomEventCandidateSupport,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';

import {
  candidateSupport,
  type CandidateOptionProjection,
  type CandidateProjectionEvaluation,
  type CandidateProjectionSession,
} from '@planner/projections/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import {
  projectDirectTraitOutcomePicker,
  withDirectTraitOutcomeSelection,
  withoutDirectTraitOutcomeValues,
} from '@planner/projections/directTraitOutcomeProjection';
import { projectEncounterPicker } from '@planner/projections/encounterPickerProjection';
import {
  roomCategoryForKind,
  roomSelectorCategories,
  selectRoomsForTargetCategory,
} from '@planner/projections/roomSelectorProjection';
import { createTakeoverBatchCommand } from '@planner/workspace/takeoverBatchInteraction';
import type { OccurrenceIdFactory } from '@planner/workspace/occurrenceIds';

import { requireWorkspaceRoom } from '../assembly/catalog-room';
import { StructuredWorkspaceProjectionContractError, workspaceInteractionKey } from '../contract';
import type {
  StructuredWorkspaceContextualServices,
  WorkspaceBatchRewardStoreInteraction,
  WorkspaceCandidateInteraction,
  WorkspaceEncounterInteraction,
  WorkspaceNemesisEventDomain,
  WorkspaceNemesisFeatureInteraction,
  WorkspaceFigLeafInteraction,
  WorkspaceFieldsCageOutcomeInteraction,
  WorkspaceRoomActionInteraction,
  WorkspaceExitSelectionInteraction,
  WorkspaceHubSlotInteraction,
  WorkspaceHubVisitOrderInteraction,
  WorkspaceHubVisitOrderProposal,
  WorkspaceInteractionCatalog,
  WorkspaceInteractionChoice,
  WorkspaceLocalVisitGenerationInteraction,
  WorkspaceLocalVisitOrderInteraction,
  WorkspaceCommandIntent,
  WorkspaceRewardControl,
  WorkspaceRewardInteraction,
  WorkspaceTraitOfferControl,
  WorkspaceLevelResolutionControl,
  WorkspaceLevelResolutionInteraction,
  WorkspaceBossCompletionArcanaInteraction,
  WorkspaceKeepsakeSelectionInteraction,
  WorkspaceKeepsakeEquipResultInteraction,
  WorkspaceTraitOfferInteraction,
  WorkspaceNaturalSelectionInteraction,
  WorkspaceSteadyGrowthInteraction,
  WorkspaceShopPurchaseParticipationInteraction,
  WorkspaceRoomInteraction,
  WorkspaceRoomPickerControl,
  WorkspaceStartInteraction,
  WorkspaceTakeoverBatchInteraction,
  WorkspaceTopologyRemovalInteraction,
  WorkspaceNaturalChaosExitInteraction,
  WorkspaceNaturalChaosSpawnInteraction,
  WorkspaceZagreusContractInteraction,
  WorkspaceZagreusSpawnInteraction,
} from '../contract';
import type {
  WorkspaceBatchInteractionRequirement,
  WorkspaceHubInteractionRequirement,
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceStartInteractionRequirement,
  WorkspaceTakeoverInteractionRequirement,
  WorkspaceTopologyRemovalInteractionRequirement,
} from './interaction-requirements';

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

function derivedShopPayloadIntent<Command extends ProjectCommand>(
  materialization: WorkspaceRewardControl['derivedShopEntryEdit'],
  edit: Command,
): WorkspaceCommandIntent<
  | Command
  | DerivedShopEntryEditCommand
  | Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
> {
  if (materialization === undefined) return Object.freeze({ command: edit });
  if (
    edit.kind !== 'ReplaceAcquisitionEntryOffer' &&
    edit.kind !== 'ReplaceTraitOffer' &&
    edit.kind !== 'ReplaceGorgonAthenaOffer' &&
    edit.kind !== 'ReplaceTraitSelection' &&
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
): WorkspaceCommandIntent<
  | RewardPayloadCommand
  | DerivedShopEntryEditCommand
  | Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
> {
  const command = rewardCommandFor(owner, value);
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
  readonly nemesisEvents: ReadonlyMap<
    string,
    import('../contract').WorkspaceNemesisEventInteraction
  >;
  readonly nemesisFeatures: ReadonlyMap<string, WorkspaceNemesisFeatureInteraction>;
  readonly figLeafSkips: ReadonlyMap<string, WorkspaceFigLeafInteraction>;
  readonly gorgonConditions: ReadonlyMap<
    string,
    import('../contract').WorkspaceGorgonConditionInteraction
  >;
  readonly rewardWheelOfferCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelPicks: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly shipCombatPhaseCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<2 | 3>>;
  readonly roomActions: ReadonlyMap<string, WorkspaceRoomActionInteraction>;
  readonly shopPurchaseParticipations: ReadonlyMap<
    string,
    WorkspaceShopPurchaseParticipationInteraction
  >;
  readonly localVisitOrders: ReadonlyMap<string, WorkspaceLocalVisitOrderInteraction>;
  readonly localVisitGenerations: ReadonlyMap<string, WorkspaceLocalVisitGenerationInteraction>;
  readonly zagreusSpawns: ReadonlyMap<string, WorkspaceZagreusSpawnInteraction>;
  readonly naturalChaosSpawns: ReadonlyMap<string, WorkspaceNaturalChaosSpawnInteraction>;
}

function intersectNemesisBranchValues(
  support: NemesisRandomEventCandidateSupport,
  select: (branch: NemesisRandomEventCandidateSupport['branches'][number]) => readonly string[],
): readonly string[] {
  const first = support.branches[0];
  if (first === undefined) return Object.freeze([]);
  return Object.freeze(
    select(first).filter((value) =>
      support.branches.every((branch) => select(branch).includes(value)),
    ),
  );
}

function projectNemesisEventDomain(
  support: NemesisRandomEventCandidateSupport | undefined,
): WorkspaceNemesisEventDomain | undefined {
  if (support === undefined) return undefined;
  return Object.freeze({
    familyKeys: support.familyKeys,
    goldTradeResponses: support.goldTradeResponses,
    damageTradeResponses: support.damageTradeResponses,
    traitTradeResponses: support.traitTradeResponses,
    damageContestResults: support.damageContestResults,
    freeItemRewardTypes: intersectNemesisBranchValues(
      support,
      (branch) => branch.freeItemRewardTypes,
    ),
    goldTradeRewardTypes: intersectNemesisBranchValues(
      support,
      (branch) => branch.goldTradeRewardTypes,
    ),
    damageTradeRewardTypes: intersectNemesisBranchValues(
      support,
      (branch) => branch.damageTradeRewardTypes,
    ),
    traitTradeTraitKeys: intersectNemesisBranchValues(
      support,
      (branch) => branch.traitTradeTraitKeys,
    ),
    damageContestSuccessRewardTypes: intersectNemesisBranchValues(
      support,
      (branch) => branch.damageContestSuccessRewardTypes,
    ),
    traitTradeRewardType: support.traitTradeRewardType,
    damageContestFailureRewardType: support.damageContestFailureRewardType,
  });
}

function bindOccurrenceLocalInteractions(
  allocateOccurrenceId: OccurrenceIdFactory,
  assembly: ProjectEvaluationAssembly,
  candidates: CandidateProjectionSession,
  contextualPicker: StructuredWorkspaceContextualServices['contextualPicker'],
  requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>,
): WorkspaceOccurrenceLocalInteractionCatalog {
  const encounterPhases = new Map<string, WorkspaceEncounterInteraction>();
  const nemesisEvents = new Map<string, import('../contract').WorkspaceNemesisEventInteraction>();
  const nemesisFeatures = new Map<string, WorkspaceNemesisFeatureInteraction>();
  const figLeafSkips = new Map<string, WorkspaceFigLeafInteraction>();
  const gorgonConditions = new Map<
    string,
    import('../contract').WorkspaceGorgonConditionInteraction
  >();
  const rewardWheelOfferCounts = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelPicks = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const shipCombatPhaseCounts = new Map<string, WorkspaceCandidateInteraction<2 | 3>>();
  const roomActions = new Map<string, WorkspaceRoomActionInteraction>();
  const shopPurchaseParticipations = new Map<
    string,
    WorkspaceShopPurchaseParticipationInteraction
  >();
  const localVisitOrders = new Map<string, WorkspaceLocalVisitOrderInteraction>();
  const localVisitGenerations = new Map<string, WorkspaceLocalVisitGenerationInteraction>();
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
          if (phase.selectionEnabled && encounterKeys.length > 1 && encounterPhases.has(key)) {
            throw new StructuredWorkspaceProjectionContractError(
              `${key} has multiple bound encounter phase interactions`,
            );
          }
          if (phase.selectionEnabled && encounterKeys.length > 1) {
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
          if (phase.nemesisEvent !== undefined) {
            const event = phase.nemesisEvent;
            const key = semanticAddressKey(event.owner);
            nemesisEvents.set(
              key,
              Object.freeze({
                key,
                owner: event.owner,
                reward: event.reward,
                value: event.value,
                load: () =>
                  projectNemesisEventDomain(
                    nemesisRandomEventCandidateSupportForProjectEvaluationAssembly(
                      assembly,
                      event.owner,
                    ),
                  ),
                intentFor: (
                  value:
                    | import('@run-planner/engine/authored-project').AuthoredNemesisRandomEventOutcome
                    | null,
                  reward: ResolvedRewardOffer | null,
                ) =>
                  Object.freeze({
                    command: Object.freeze({
                      kind: 'ReplaceNemesisRandomEventOutcome' as const,
                      event: event.owner,
                      value,
                      reward,
                    }),
                  }),
              }),
            );
          }
          if (phase.nemesisFeature !== undefined) {
            const key = workspaceInteractionKey(phase.owner);
            nemesisFeatures.set(
              key,
              Object.freeze({
                key,
                owner: phase.owner,
                intent: Object.freeze({
                  command: phase.nemesisFeature.selected
                    ? Object.freeze({ kind: 'ResetEncounter' as const, phase: phase.owner })
                    : Object.freeze({
                        kind: 'SelectEncounter' as const,
                        phase: phase.owner,
                        encounterKey: phase.nemesisFeature.encounterKey,
                      }),
                  focus: Object.freeze({ owner: phase.owner, timing: 'after' as const }),
                }),
              }),
            );
          }
        }
        break;
      }
      case 'roomActions': {
        const key = semanticAddressKey(requirement.owner);
        const proposals = requirement.proposals;
        if (roomActions.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} has multiple bound room-action interactions`,
          );
        }
        roomActions.set(
          key,
          Object.freeze({
            intentFor(proposalKey: string) {
              const proposal = proposals.find((candidate) => candidate.key === proposalKey);
              if (proposal === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${proposalKey} is not a room-action proposal for ${key}`,
                );
              }
              const action =
                requirement.owner.kind === 'occurrence'
                  ? createRoomActionAddress(
                      createBiomeAddress(requirement.owner.routeKey, requirement.owner.biomeKey),
                      requirement.owner.occurrenceId,
                      roomActionKey(proposal.reference),
                    )
                  : createCompletionRoomActionAddress(
                      requirement.owner as import('@run-planner/engine/authored-project').CompletionRoomAddress & {
                        readonly role: 'postboss';
                      },
                      roomActionKey(proposal.reference),
                    );
              if (proposal.kind === 'remove') {
                return Object.freeze({
                  command: Object.freeze({ kind: 'RemoveRoomAction' as const, action }),
                });
              }
              if (proposal.toIndex === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${proposalKey} has no room-action destination`,
                );
              }
              return Object.freeze({
                command:
                  proposal.kind === 'insert'
                    ? Object.freeze({
                        kind: 'InsertRoomAction' as const,
                        action,
                        reference: proposal.reference,
                        index: proposal.toIndex,
                      })
                    : Object.freeze({
                        kind: 'MoveRoomAction' as const,
                        action,
                        toIndex: proposal.toIndex,
                      }),
              });
            },
            key,
            owner: requirement.owner,
            proposals,
          }),
        );
        break;
      }
      case 'shopPurchaseParticipation': {
        const key = semanticAddressKey(requirement.owner);
        if (shopPurchaseParticipations.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} has multiple bound Shop purchase-participation interactions`,
          );
        }
        shopPurchaseParticipations.set(
          key,
          Object.freeze({
            intentFor: (purchased: boolean) =>
              Object.freeze({
                command: Object.freeze({
                  kind: 'ReplaceShopPurchaseParticipation' as const,
                  offer: requirement.owner,
                  purchased,
                }),
              }),
            key,
            owner: requirement.owner,
            purchased: requirement.purchased,
          }),
        );
        break;
      }
      case 'localVisits': {
        const generationValues = Object.freeze(
          requirement.generationChoices.map((choice) => choice.value),
        );
        for (const slot of requirement.slots) {
          const generationKey = semanticAddressKey(slot.address);
          set(
            localVisitGenerations,
            generationKey,
            Object.freeze({
              ...candidateInteraction(
                slot.address,
                requirement.generationChoices,
                slot.generation,
                () => candidates.localVisitGenerations(slot.address, generationValues),
              ),
              intentFor: (generation: SideRoomGeneration) =>
                Object.freeze({
                  command: Object.freeze({
                    kind: 'SetLocalVisitGeneration' as const,
                    slot: slot.address,
                    generation,
                  }),
                }),
              owner: slot.address,
            }),
            'local-visit generation',
          );
          const selected = slot.order.options.find(
            (option) => option.key === slot.order.selectedKey,
          );
          if (selected === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${generationKey} has no selected local-visit position`,
            );
          }
          const entryChoices = Object.freeze(
            slot.order.options.map((option) =>
              Object.freeze({ label: option.label, value: option.proposedOccurrenceIds }),
            ),
          );
          const proposals = Object.freeze(
            slot.order.options.map((option) => option.proposedOccurrenceIds),
          );
          set(
            localVisitOrders,
            slot.order.interactionKey,
            Object.freeze({
              ...candidateInteraction(
                requirement.order,
                entryChoices,
                selected.proposedOccurrenceIds,
                () => candidates.localVisitOrders(requirement.order, proposals),
                slot.order.interactionKey,
              ),
              intentFor: (occurrenceIds: readonly OccurrenceId[]) =>
                Object.freeze({
                  command: Object.freeze({
                    kind: 'ReplaceLocalVisitOrder' as const,
                    order: requirement.order,
                    occurrenceIds: Object.freeze([...occurrenceIds]),
                  }),
                }),
              owner: requirement.order,
            }),
            'local-visit order',
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
    }
  }
  return Object.freeze({
    encounterPhases,
    nemesisEvents,
    nemesisFeatures,
    roomActions,
    figLeafSkips,
    gorgonConditions,
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    shipCombatPhaseCounts,
    shopPurchaseParticipations,
    localVisitOrders,
    localVisitGenerations,
    zagreusSpawns,
    naturalChaosSpawns,
  });
}

interface WorkspaceBatchInteractionCatalog {
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceBatchRewardStoreInteraction>;
  readonly exitSelections: ReadonlyMap<string, WorkspaceExitSelectionInteraction>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceFieldsCageOutcomeInteraction>;
  readonly zagreusContracts: ReadonlyMap<string, WorkspaceZagreusContractInteraction>;
  readonly naturalChaosExits: ReadonlyMap<string, WorkspaceNaturalChaosExitInteraction>;
}

function bindBatchInteractions(
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceBatchInteractionRequirement>,
): WorkspaceBatchInteractionCatalog {
  const batchRewardStores = new Map<string, WorkspaceBatchRewardStoreInteraction>();
  const exitSelections = new Map<string, WorkspaceExitSelectionInteraction>();
  const fieldsCageOutcomes = new Map<string, WorkspaceFieldsCageOutcomeInteraction>();
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
      const candidate = candidateInteraction(
        rewardStore.owner,
        rewardStore.storeChoices,
        rewardStore.selected,
        () => candidates.batchRewardStores(rewardStore.owner, storeKeys),
      );
      batchRewardStores.set(
        key,
        Object.freeze({
          ...candidate,
          intentFor: (storeKey: string) =>
            Object.freeze({
              command:
                (requirement.persistence ?? 'authored') === 'authored'
                  ? Object.freeze({
                      kind: 'ReplaceBatchRewardStore' as const,
                      rewardStore: rewardStore.owner,
                      storeKey,
                    })
                  : Object.freeze({
                      kind: 'InitializeExitDecision' as const,
                      decision: requirement.owner,
                      edit: Object.freeze({ kind: 'rewardStore' as const, storeKey }),
                    }),
              focus: Object.freeze({ owner: requirement.owner, timing: 'before' as const }),
            }),
        }),
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
      const candidate = candidateInteraction(
        fieldsCageOutcome.owner,
        fieldsCageOutcome.outcomeChoices,
        fieldsCageOutcome.selected,
        () => candidates.fieldsCageOutcomes(fieldsCageOutcome.owner, values),
      );
      fieldsCageOutcomes.set(
        key,
        Object.freeze({
          ...candidate,
          intentFor: (cageOutcome: 'min' | 'max') =>
            Object.freeze({
              command:
                (requirement.persistence ?? 'authored') === 'authored'
                  ? Object.freeze({
                      kind: 'ReplaceFieldsCageOutcome' as const,
                      decision: requirement.owner,
                      cageOutcome,
                    })
                  : Object.freeze({
                      kind: 'InitializeExitDecision' as const,
                      decision: requirement.owner,
                      edit: Object.freeze({ kind: 'fieldsCageOutcome' as const, cageOutcome }),
                    }),
              focus: Object.freeze({ owner: requirement.owner, timing: 'before' as const }),
            }),
        }),
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
              const localOccurrenceIdsBySlot = Object.freeze(
                Object.fromEntries(
                  slot.localSlotKeys.map((slotKey) => [slotKey, allocateOccurrenceId()] as const),
                ),
              );
              let loaded: readonly CandidateOptionProjection<boolean>[] | undefined;
              const load = () =>
                (loaded ??= candidates.hubSlots(
                  slot.owner,
                  proposedOccurrenceId,
                  localOccurrenceIdsBySlot,
                  values,
                ));
              return Object.freeze({
                choices: slot.choices,
                intentFor: (open: true) => {
                  assertCandidateMayBeAuthored(load(), open, `Hub slot ${key} opening`);
                  return Object.freeze({
                    command: Object.freeze({
                      kind: 'OpenHubSlot' as const,
                      occurrenceId: proposedOccurrenceId,
                      localOccurrenceIdsBySlot,
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
                (loaded ??= candidates.hubSlots(
                  slot.owner,
                  slot.openedOccurrenceId,
                  Object.freeze({}),
                  values,
                ));
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
    }
  | {
      readonly candidate: CandidateOptionProjection<RoomDeclaration>;
      readonly kind: 'hub';
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
 * support because it needs the engine's required-exit product. The structurally
 * forced Hub is also authorable from an uncommitted decision when candidate
 * coverage has not reached that exact checkpoint yet; its projected control
 * and atomic engine command still validate the closed terminal. A persisted
 * Hub envelope continues to require evaluated support.
 */
function decisionEntryCandidateMayBeAuthored(
  entry: WorkspaceDecisionEntryCandidate,
  ordinaryTargetAuthoring: WorkspaceDecisionEntryRoomControl['ordinaryTargetAuthoring'],
  ordinaryTargetGameNames: WorkspaceDecisionEntryRoomControl['ordinaryTargetGameNames'],
  persistence: WorkspaceDecisionEntryRoomControl['persistence'],
): boolean {
  if (entry.kind === 'hub') {
    return (
      candidateHasExecutableSupport(entry.candidate) ||
      (persistence === 'uncommitted' && entry.candidate.evaluation.kind === 'unavailable')
    );
  }
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
  persistence: WorkspaceDecisionEntryRoomControl['persistence'],
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
          persistence,
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
    hubInteractionRequirements,
    occurrenceInteractionRequirements,
    rewardControls,
    traitControls,
    levelResolutionControls,
    steadyGrowthControls,
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
    nemesisEvents,
    nemesisFeatures,
    roomActions,
    figLeafSkips,
    gorgonConditions,
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    shipCombatPhaseCounts,
    shopPurchaseParticipations,
    localVisitOrders,
    localVisitGenerations,
    zagreusSpawns,
    naturalChaosSpawns,
  } = bindOccurrenceLocalInteractions(
    allocateOccurrenceId,
    assembly,
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
          ...(control.hub === undefined
            ? []
            : [
                (() => {
                  const candidate = candidates.hubTerminalTakeover(control.decisionOwner);
                  const room = requireWorkspaceRoom(catalog, control.hub.gameName);
                  return Object.freeze({
                    candidate: Object.freeze({
                      evaluation: candidate.evaluation,
                      value: room,
                    }),
                    kind: 'hub' as const,
                    room,
                  });
                })(),
              ]),
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
                control.persistence,
              )
            ) {
              throw new StructuredWorkspaceProjectionContractError(
                `${gameName} is not currently authorable for ${key}`,
              );
            }
            if (entry.kind === 'ordinary') {
              const occurrenceId = allocateOccurrenceId();
              return Object.freeze({
                command:
                  control.persistence === 'authored'
                    ? Object.freeze({
                        gameName,
                        kind: 'CreateTarget' as const,
                        occurrenceId,
                        target: control.address,
                      })
                    : Object.freeze({
                        decision: control.decisionOwner,
                        edit: Object.freeze({
                          gameName,
                          kind: 'target' as const,
                          occurrenceId,
                          target: control.address,
                        }),
                        kind: 'InitializeExitDecision' as const,
                      }),
                focus: Object.freeze({ owner: control.address, timing: 'after' as const }),
              });
            }
            if (entry.kind === 'hub') {
              const hub = control.hub;
              if (hub === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${gameName} has no structural Hub terminal for ${key}`,
                );
              }
              if (
                entry.candidate.evaluation.kind !== 'hubTerminalTakeover' &&
                !(
                  control.persistence === 'uncommitted' &&
                  entry.candidate.evaluation.kind === 'unavailable'
                )
              ) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${gameName} has no evaluated Hub terminal evidence for ${key}`,
                );
              }
              const result =
                entry.candidate.evaluation.kind === 'hubTerminalTakeover'
                  ? entry.candidate.evaluation.result
                  : undefined;
              if (
                result !== undefined &&
                (result.gameName !== gameName || result.hubKey !== hub.decision.hubKey)
              ) {
                throw new StructuredWorkspaceProjectionContractError(
                  `${gameName} Hub candidate disagrees with its declared terminal for ${key}`,
                );
              }
              const command =
                control.persistence === 'authored'
                  ? Object.freeze({
                      decision: control.decisionOwner,
                      hub: hub.decision,
                      kind: 'ReplaceWithHubDecision' as const,
                    })
                  : Object.freeze({
                      decision: control.decisionOwner,
                      edit: Object.freeze({
                        hub: hub.decision,
                        kind: 'hub' as const,
                      }),
                      kind: 'InitializeExitDecision' as const,
                    });
              return Object.freeze({
                command,
                focus: Object.freeze({ owner: hub.decision, timing: 'after' as const }),
              });
            }
            if (entry.candidate.evaluation.kind !== 'takeoverPrebossBatch') {
              throw new StructuredWorkspaceProjectionContractError(
                `${gameName} has no evaluated takeover evidence for ${key}`,
              );
            }
            const sharedTakeoverInput = {
              allocateOccurrenceId,
              decision: control.decisionOwner,
              existingTargetOccurrenceIds: new Map<string, OccurrenceId>(),
              gameName,
              requiredExitKeys: entry.candidate.evaluation.result.requiredExitKeys,
            };
            const command =
              control.persistence === 'authored'
                ? createTakeoverBatchCommand({ action: 'replace', ...sharedTakeoverInput })
                : createTakeoverBatchCommand({ action: 'create', ...sharedTakeoverInput });
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
              control.persistence,
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
              focus: Object.freeze({ owner: control.address, timing: 'after' as const }),
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

  const rewards = new Map<string, WorkspaceRewardInteraction>();
  for (const [key, control] of rewardControls) {
    const artificerOptions = artificerOptionsByReplacement.get(
      semanticAddressKey(control.owner.address),
    );
    const rewardTypes =
      control.kind === 'countedReward'
        ? candidates.countedRewardTypes(control.owner, control.binding, control.offer?.rewardType)
        : Object.freeze([
            ...new Set([
              ...control.rewardTypes,
              ...(artificerOptions ?? []).map((option) => option.offer.rewardType),
            ]),
          ]);
    rewards.set(
      key,
      Object.freeze({
        authoredRewardTypes: rewardTypes,
        choiceLabel: services.rewardPicker.choiceLabel,
        intentFor: (offer: ResolvedRewardOffer) =>
          rewardIntentFor(control.owner, offer, control.derivedShopEntryEdit),
        key,
        load: () => candidates.rewardDomain(control.owner, rewardTypes, control.offer ?? undefined),
        model: services.rewardPicker.project,
        owner: control.owner.address,
        selected: control.offer,
        summary: services.rewardPicker.summary,
      }),
    );
  }

  const acquisitionConversions = new Map();
  for (const control of rewardControls.values()) {
    for (const conversion of control.conversions ?? []) {
      const key = workspaceInteractionKey(conversion.address);
      const evaluated =
        evaluatedConversions.get(key) ?? candidates.acquisitionConversion(conversion.address);
      const owner = conversion.address.owner;
      const occurrenceId =
        owner.kind === 'acquisitionEntry'
          ? owner.site.owner.kind === 'occurrence'
            ? owner.site.owner.occurrenceId
            : undefined
          : owner.kind === 'encounterPhase'
            ? owner.owner.occurrenceId
            : owner.kind === 'gorgonPhase'
              ? owner.encounter.owner.occurrenceId
              : owner.occurrenceId;
      const occurrence =
        occurrenceId === undefined
          ? undefined
          : project.routes
              .find((route) => route.routeKey === conversion.address.routeKey)
              ?.biomes.find((biome) => biome.biomeKey === conversion.address.biomeKey)
              ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
      const seaStarProcced =
        occurrence?.acquisitionSites?.[seaStarDuplicateSiteKey(conversion.address)]
          ?.pickupEntries?.[SEA_STAR_DUPLICATE_ENTRY_KEY] !== undefined;
      acquisitionConversions.set(
        key,
        Object.freeze({
          ...(() => {
            return evaluated.kind === 'acquisitionConversion'
              ? {
                  timePieceSupported: evaluated.result.timePieceSupported,
                  artificerSupported: evaluated.result.artificerSupported,
                  seaStarSupported: evaluated.result.seaStarSupported,
                  visible:
                    evaluated.result.timePieceSupported ||
                    evaluated.result.artificerSupported ||
                    evaluated.result.seaStarSupported ||
                    seaStarProcced ||
                    conversion.value.kind !== 'normal',
                }
              : {
                  timePieceSupported: false,
                  artificerSupported: false,
                  seaStarSupported: false,
                  visible: seaStarProcced || conversion.value.kind !== 'normal',
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
            ),
          seaStarIntentFor: (procced: boolean) =>
            Object.freeze({
              command: Object.freeze({
                kind: 'ReplaceSeaStarResult' as const,
                acquisition: conversion.address,
                procced,
              }),
              focus: Object.freeze({ owner: conversion.address, timing: 'after' as const }),
            }),
          key,
          owner: conversion.address,
          seaStarProcced,
          value: conversion.value,
        }),
      );
    }
  }

  const traitOffers = new Map<string, WorkspaceTraitOfferInteraction>();
  for (const [key, control] of effectiveTraitControls) {
    const derivedShopEntryEdit = derivedShopEntryEdits.get(semanticAddressKey(control.rewardOwner));
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
    const startingDraft = () =>
      candidates.traitOfferStartingDraft(control.address, control.giver.key);
    const load = (value = control.offer ?? startingDraft()) =>
      value === undefined ? Object.freeze([]) : candidates.traitOffer(control.address, value);
    const optionDomains = new Map<
      string,
      ReturnType<WorkspaceTraitOfferInteraction['optionDomain']>
    >();
    const optionDomain = (value: AuthoredTraitOffer, optionKey: TraitOptionKey) => {
      if (value.kind !== 'traits') {
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
      const traitAcquisitionTargetControl = hasTargetPicker
        ? Object.freeze({
            address: createTraitAcquisitionTargetAddress(control.address, optionKey),
            marker: control.traitAcquisitionTarget?.marker ?? control.marker,
            optionKey,
            ...(option?.targetTraitKey === undefined ? {} : { value: option.targetTraitKey }),
          })
        : undefined;
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
                    : {
                        value: option.allTogetherResult[set.key],
                        valueLabel:
                          option.allTogetherResult[set.key] === null
                            ? 'No grant (set exhausted)'
                            : (catalog.traits.byKey[option.allTogetherResult[set.key]!]?.label ??
                              option.allTogetherResult[set.key]!),
                      }),
                });
              }),
            )
          : undefined;
      const naturalSelectionControl =
        value.selectedOptionKey === optionKey && control.naturalSelection?.optionKey === optionKey
          ? control.naturalSelection
          : undefined;
      let projected: ReturnType<typeof services.traitDomain.project> | undefined;
      const bound = Object.freeze({
        hasTargetPicker,
        ...(traitAcquisitionTargetControl === undefined
          ? {}
          : { traitAcquisitionTarget: traitAcquisitionTargetControl }),
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
                      const arcanaLabel = (key: string) =>
                        catalog.arcanaCards.byKey[key]?.label ?? key;
                      const vowLabel = (key: string) => catalog.fearVows.byKey[key]?.label ?? key;
                      return Object.freeze({
                        arcanaPicker: projectDirectTraitOutcomePicker(
                          result.arcanaCandidates,
                          arcanaLabel,
                          (key) => key,
                        ),
                        arcanaPickerFor: (selectedKeys: readonly string[]) =>
                          projectDirectTraitOutcomePicker(
                            withDirectTraitOutcomeSelection(
                              withoutDirectTraitOutcomeValues(
                                result.arcanaCandidates,
                                selectedKeys,
                              ),
                              Object.freeze([]),
                            ),
                            arcanaLabel,
                            (key) => key,
                          ),
                        branchAgreement: result.branchAgreement,
                        effect: result.effect,
                        outerAvailable: result.outerAvailable,
                        requiredCount: result.requiredCount,
                        vowPicker: projectDirectTraitOutcomePicker(
                          result.vowCandidates,
                          vowLabel,
                          (key) => key,
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
                  );
                },
                forOffer: (offer: AuthoredTraitOfferTraits) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.echoPomTarget(control.address, offer, optionKey);
                      if (evaluated.kind !== 'echoPomTargetDomain') return undefined;
                      return Object.freeze({
                        picker: projectDirectTraitOutcomePicker(
                          evaluated.result.candidates,
                          (key) =>
                            key === null
                              ? 'No eligible target'
                              : (catalog.traits.byKey[key]?.label ?? key),
                          (key) => key ?? '__none__',
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
                      const domainCandidates = evaluated.result.candidates;
                      const identityKey = (identity: {
                        readonly giverKey: string;
                        readonly traitKey: string;
                      }) => `${identity.giverKey}:${identity.traitKey}`;
                      const identityLabel = (identity: {
                        readonly giverKey: string;
                        readonly traitKey: string;
                      }) =>
                        `${catalog.traitGivers.byKey[identity.giverKey]?.label ?? identity.giverKey} · ${catalog.traits.byKey[identity.traitKey]?.label ?? identity.traitKey}`;
                      return Object.freeze({
                        draftSupportFor: (
                          rows: readonly {
                            readonly identity?: {
                              readonly giverKey: string;
                              readonly traitKey: string;
                            };
                            readonly rarity?: TraitRarity;
                            readonly targetTraitKey?: string;
                          }[],
                          selectedIndex: number,
                        ) =>
                          evaluateEchoLastRunBoonDraftSupport(
                            domainCandidates,
                            rows.map((row) =>
                              Object.freeze({
                                ...(row.identity === undefined
                                  ? {}
                                  : {
                                      giverKey: row.identity.giverKey,
                                      traitKey: row.identity.traitKey,
                                    }),
                                ...(row.rarity === undefined ? {} : { rarity: row.rarity }),
                                ...(row.targetTraitKey === undefined
                                  ? {}
                                  : { targetTraitKey: row.targetTraitKey }),
                              }),
                            ),
                            selectedIndex,
                          ),
                        effectiveRarityFor: (
                          option: AuthoredEchoLastRunBoonOffer['options'][number],
                        ) =>
                          domainCandidates.find(
                            (candidate) =>
                              candidate.option.giverKey === option.giverKey &&
                              candidate.option.traitKey === option.traitKey &&
                              candidate.option.rarity === option.rarity,
                          )?.effectiveRarity,
                        labelFor: identityLabel,
                        summaryFor: (child: AuthoredEchoLastRunBoonOffer) => {
                          const selected = child.options[optionIndex(child.selectedOptionKey)];
                          if (selected === undefined) return 'Choice required';
                          const candidate = domainCandidates.find(
                            (entry) =>
                              entry.option.giverKey === selected.giverKey &&
                              entry.option.traitKey === selected.traitKey &&
                              entry.option.rarity === selected.rarity,
                          );
                          const rarity =
                            candidate?.effectiveRarity === undefined ||
                            candidate.effectiveRarity === selected.rarity
                              ? selected.rarity
                              : `${selected.rarity} → ${candidate.effectiveRarity}`;
                          return `${identityLabel(selected)} · ${rarity}`;
                        },
                        rarityPickerFor: (
                          identity: {
                            readonly giverKey: string;
                            readonly traitKey: string;
                          },
                          selected?: TraitRarity,
                        ) =>
                          projectDirectTraitOutcomePicker(
                            echoLastRunBoonRarityCandidates(domainCandidates, identity, selected),
                            (rarity) => rarity,
                            (rarity) => rarity,
                          ),
                        targetPickerFor: (
                          option: AuthoredEchoLastRunBoonOffer['options'][number],
                        ) => {
                          const candidate = domainCandidates.find(
                            (entry) =>
                              entry.option.giverKey === option.giverKey &&
                              entry.option.traitKey === option.traitKey &&
                              entry.option.rarity === option.rarity,
                          );
                          return projectDirectTraitOutcomePicker(
                            candidate?.targetCandidates ?? Object.freeze([]),
                            (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                            (traitKey) => traitKey,
                          );
                        },
                        targetRequiredFor: (identity: {
                          readonly giverKey: string;
                          readonly traitKey: string;
                        }) =>
                          catalog.traits.byKey[identity.traitKey]?.targetedAcquisition !==
                          undefined,
                        traitPickerFor: (
                          occupiedTraitKeys: readonly string[],
                          selected?: {
                            readonly giverKey: string;
                            readonly traitKey: string;
                          },
                        ) =>
                          projectDirectTraitOutcomePicker(
                            echoLastRunBoonTraitCandidatesForRow(
                              domainCandidates,
                              occupiedTraitKeys,
                              selected,
                            ),
                            identityLabel,
                            identityKey,
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
                            picker: projectDirectTraitOutcomePicker(
                              evaluated.result.candidates,
                              (value) =>
                                value === null
                                  ? 'No grant (set exhausted)'
                                  : (catalog.traits.byKey[value]?.label ?? value),
                              (value) => value ?? '__none__',
                            ),
                          });
                        },
                      }),
                  }),
                ),
              ),
            }),
        ...(naturalSelectionControl === undefined
          ? {}
          : {
              naturalSelection: Object.freeze({
                control: naturalSelectionControl,
                forOffer: (offer: AuthoredTraitOfferTraits, retainedTargetKey?: string) =>
                  Object.freeze({
                    load: () => {
                      const evaluated = candidates.naturalSelectionResult(
                        naturalSelectionControl.address,
                        offer,
                        offer.options[optionIndex(optionKey)]?.naturalSelectionTargets,
                      );
                      if (evaluated.kind !== 'naturalSelectionResult') return undefined;
                      const currentTargets: readonly string[] = [
                        ...(offer.options[optionIndex(optionKey)]?.naturalSelectionTargets ?? []),
                        ...(retainedTargetKey === undefined ? [] : [retainedTargetKey]),
                      ];
                      const available = new Set(evaluated.result.nextTargetTraitKeys);
                      const targetCandidates = Object.freeze(
                        [
                          ...new Set([...evaluated.result.nextTargetTraitKeys, ...currentTargets]),
                        ].map((traitKey) =>
                          Object.freeze({
                            value: traitKey,
                            support: available.has(traitKey)
                              ? ('possible' as const)
                              : ('impossible' as const),
                            branchSupport: evaluated.result.branchSupport,
                            selected: traitKey === retainedTargetKey,
                            ...(available.has(traitKey) ? {} : { reason: 'unavailable' as const }),
                          }),
                        ),
                      );
                      return Object.freeze({
                        complete: evaluated.result.complete,
                        picker: projectDirectTraitOutcomePicker(
                          targetCandidates,
                          (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                          (traitKey) => traitKey,
                        ),
                      });
                    },
                  }),
                traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
              } satisfies WorkspaceNaturalSelectionInteraction),
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
          ),
        key,
        ...(control.echoLastReward === undefined ? {} : { echoLastReward: control.echoLastReward }),
        load,
        owner: control.address,
        rarityEditable: control.rarityEditable !== false,
        rarityEditableFor: (traitKey: string) => {
          const declaration = catalog.traits.byKey[traitKey];
          return (
            declaration?.rarityDomain.kind === 'ranked' &&
            declaration.rarityDomain.equippedRarities.length > 1
          );
        },
        ...(control.offer !== null &&
        (control.address.owner.kind === 'encounterPhase' ||
          control.address.owner.kind === 'gorgonPhase')
          ? {
              resetIntent: Object.freeze({
                command: Object.freeze({
                  kind: 'ResetEncounterTraitOffer' as const,
                  trait: control.address,
                }),
              }),
            }
          : {}),
        optionDomain,
        ransomAssessment: (value: AuthoredTraitOffer) => {
          if (value.kind !== 'traits') return undefined;
          const evaluated = candidates.ransomAssessment(control.address, value);
          if (evaluated.kind !== 'ransomAssessment') return undefined;
          const first = evaluated.result.assessments[0];
          if (!evaluated.result.branchAgreement || first === undefined)
            return Object.freeze({ branchAgreement: false });
          return Object.freeze({
            branchAgreement: evaluated.result.branchAgreement,
            buffedTraitKeys: first.buffedTraitKeys,
            levelBonus: first.levelBonus,
            removedCount: first.removedCount,
            removedTraitKeys: first.removedTraitKeys,
          });
        },
        traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
        selectedIntent: (selectedOptionKey: AuthoredTraitOfferTraits['selectedOptionKey']) =>
          derivedShopPayloadIntent(
            derivedShopEntryEdit,
            Object.freeze({
              kind: 'ReplaceTraitSelection' as const,
              selectedOptionKey,
              trait: control.address,
            }),
          ),
        value: control.offer,
        traitsStartingDraft: startingDraft,
        nextOptionalHighTierDraft: (value: AuthoredTraitOfferTraits) =>
          candidates.nextOptionalHighTierTraitOfferDraft(control.address, value),
        previousOptionalHighTierDraft: (value: AuthoredTraitOfferTraits) =>
          candidates.previousOptionalHighTierTraitOfferDraft(control.address, value),
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
    levelResolutions.set(
      key,
      Object.freeze({
        acquisitionRoleLabel: control.acquisitionRoleLabel,
        intentFor: (value: AuthoredLevelResolution) =>
          derivedShopPayloadIntent(
            derivedShopEntryEdits.get(semanticAddressKey(control.rewardOwner)),
            levelResolutionCommandFor(control.address, value),
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
  const steadyGrowth = new Map<string, WorkspaceSteadyGrowthInteraction>();
  for (const [key, control] of effectiveSteadyGrowthControls) {
    steadyGrowth.set(
      key,
      Object.freeze({
        key,
        owner: control.address,
        intentFor: (targetTraitKey: string | null) =>
          Object.freeze({
            command: Object.freeze({
              kind: 'ReplaceSteadyGrowthTarget' as const,
              outcome: control.address,
              targetTraitKey,
            }),
          }),
        forTarget: (targetTraitKey: string | null | undefined = control.targetTraitKey) =>
          Object.freeze({
            load: () => {
              const evaluated = candidates.steadyGrowthOutcome(control.address, targetTraitKey);
              if (evaluated.kind !== 'steadyGrowthOutcome') return undefined;
              return Object.freeze({
                emptyNoOp: evaluated.result.emptyNoOp,
                picker: projectDirectTraitOutcomePicker(
                  [
                    ...new Set([
                      ...evaluated.result.eligibleTargetKeys,
                      ...(targetTraitKey === null || targetTraitKey === undefined
                        ? []
                        : [targetTraitKey]),
                    ]),
                  ].map((traitKey) =>
                    Object.freeze({
                      value: traitKey,
                      support: evaluated.result.eligibleTargetKeys.includes(traitKey)
                        ? ('possible' as const)
                        : ('impossible' as const),
                      branchSupport: evaluated.result.branchSupport,
                      selected: traitKey === (targetTraitKey ?? undefined),
                      ...(evaluated.result.eligibleTargetKeys.includes(traitKey)
                        ? {}
                        : { reason: 'unavailable' as const }),
                    }),
                  ),
                  (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
                  (traitKey) => traitKey,
                ),
                selectedPossible: evaluated.result.selectedPossible,
              });
            },
          }),
        traitLabel: (traitKey: string) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
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
    nemesisEvents,
    nemesisFeatures,
    figLeafSkips,
    gorgonConditions,
    exitSelections,
    fieldsCageOutcomes,
    roomActions,
    naturalChaosExits,
    naturalChaosSpawns,
    hubSlots,
    hubVisitOrders,
    rewards,
    acquisitionConversions,
    traitOffers,
    levelResolutions,
    steadyGrowth,
    bossCompletionArcana,
    keepsakeSelections,
    keepsakeEquipResults,
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    rooms,
    shipCombatPhaseCounts,
    shopPurchaseParticipations,
    localVisitOrders,
    localVisitGenerations,
    zagreusContracts,
    zagreusSpawns,
    starts,
    takeoverBatches,
    topologyRemovals,
  });
}
