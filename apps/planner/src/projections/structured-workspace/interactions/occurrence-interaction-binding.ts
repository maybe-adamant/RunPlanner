import {
  createBiomeAddress,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
  type OccurrenceId,
  type SideRoomGeneration,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  nemesisRandomEventCandidateSupportForProjectEvaluationAssembly,
  type NemesisRandomEventCandidateSupport,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { projectEncounterPicker } from '@planner/projections/encounterPickerProjection';
import type { OccurrenceIdFactory } from '@planner/workspace/occurrenceIds';

import { StructuredWorkspaceProjectionContractError, workspaceInteractionKey } from '../contract';
import type {
  StructuredWorkspaceContextualServices,
  WorkspaceEncounterInteraction,
  WorkspaceNemesisEventDomain,
  WorkspaceNemesisFeatureInteraction,
  WorkspaceFigLeafInteraction,
  WorkspaceRoomActionInteraction,
  WorkspaceLocalVisitGenerationInteraction,
  WorkspaceLocalVisitOrderInteraction,
  WorkspaceCandidateInteraction,
  WorkspaceShopPurchaseParticipationInteraction,
  WorkspacePurgingPoolInteraction,
  WorkspacePurgingPoolSlotInteraction,
  WorkspaceHermesShrineOfferInteraction,
  WorkspaceHermesShrinePurchaseInteraction,
  WorkspaceHermesShrinePresenceInteraction,
  WorkspaceStygianWellPresenceInteraction,
  WorkspaceStygianWellInteraction,
  WorkspaceStygianWellOfferInteraction,
  WorkspaceStygianWellPurchaseInteraction,
  WorkspaceStygianWellTwistResultInteraction,
  WorkspaceChaosSpawnInteraction,
  WorkspaceZagreusSpawnInteraction,
  WorkspaceResourcePlacementInteraction,
} from '../contract';
import type { WorkspaceOccurrenceInteractionRequirement } from './interaction-requirements';
import { candidateInteraction } from './interaction-binding-primitives';
import {
  createMemoizedStableIdentityPickerLoad,
  projectStableIdentityPicker,
} from './room-feature-picker-model';

export interface WorkspaceOccurrenceLocalInteractionCatalog {
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
  readonly purgingPoolInteractions: ReadonlyMap<string, WorkspacePurgingPoolInteraction>;
  readonly purgingPoolSlots: ReadonlyMap<string, WorkspacePurgingPoolSlotInteraction>;
  readonly hermesShrineOffers: ReadonlyMap<string, WorkspaceHermesShrineOfferInteraction>;
  readonly hermesShrinePurchases: ReadonlyMap<string, WorkspaceHermesShrinePurchaseInteraction>;
  readonly hermesShrinePresences: ReadonlyMap<string, WorkspaceHermesShrinePresenceInteraction>;
  readonly stygianWellPresences: ReadonlyMap<string, WorkspaceStygianWellPresenceInteraction>;
  readonly stygianWellInteractions: ReadonlyMap<string, WorkspaceStygianWellInteraction>;
  readonly stygianWellOffers: ReadonlyMap<string, WorkspaceStygianWellOfferInteraction>;
  readonly stygianWellPurchases: ReadonlyMap<string, WorkspaceStygianWellPurchaseInteraction>;
  readonly stygianWellTwistResults: ReadonlyMap<string, WorkspaceStygianWellTwistResultInteraction>;
  readonly localVisitOrders: ReadonlyMap<string, WorkspaceLocalVisitOrderInteraction>;
  readonly localVisitGenerations: ReadonlyMap<string, WorkspaceLocalVisitGenerationInteraction>;
  readonly zagreusSpawns: ReadonlyMap<string, WorkspaceZagreusSpawnInteraction>;
  readonly chaosSpawns: ReadonlyMap<string, WorkspaceChaosSpawnInteraction>;
  readonly resourcePlacements: ReadonlyMap<string, WorkspaceResourcePlacementInteraction>;
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
  catalog: import('@run-planner/engine/catalog-schema').Catalog,
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
    traitTradePicker: (selected?: string) =>
      projectStableIdentityPicker({
        assessment: 'assessed',
        choices: intersectNemesisBranchValues(support, (branch) => branch.traitTradeTraitKeys).map(
          (traitKey) => ({
            label: catalog.traits.byKey[traitKey]?.label ?? traitKey,
            value: traitKey,
          }),
        ),
        selected,
        selectedLabel: selected === undefined ? undefined : catalog.traits.byKey[selected]?.label,
      }),
    damageContestSuccessRewardTypes: intersectNemesisBranchValues(
      support,
      (branch) => branch.damageContestSuccessRewardTypes,
    ),
    traitTradeRewardType: support.traitTradeRewardType,
    damageContestFailureRewardType: support.damageContestFailureRewardType,
  });
}

export function bindOccurrenceLocalInteractions(
  catalog: Catalog,
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
  const purgingPoolInteractions = new Map<string, WorkspacePurgingPoolInteraction>();
  const purgingPoolSlots = new Map<string, WorkspacePurgingPoolSlotInteraction>();
  const hermesShrineOffers = new Map<string, WorkspaceHermesShrineOfferInteraction>();
  const hermesShrinePurchases = new Map<string, WorkspaceHermesShrinePurchaseInteraction>();
  const hermesShrinePresences = new Map<string, WorkspaceHermesShrinePresenceInteraction>();
  const stygianWellPresences = new Map<string, WorkspaceStygianWellPresenceInteraction>();
  const stygianWellInteractions = new Map<string, WorkspaceStygianWellInteraction>();
  const stygianWellOffers = new Map<string, WorkspaceStygianWellOfferInteraction>();
  const stygianWellPurchases = new Map<string, WorkspaceStygianWellPurchaseInteraction>();
  const stygianWellTwistResults = new Map<string, WorkspaceStygianWellTwistResultInteraction>();
  const localVisitOrders = new Map<string, WorkspaceLocalVisitOrderInteraction>();
  const localVisitGenerations = new Map<string, WorkspaceLocalVisitGenerationInteraction>();
  const zagreusSpawns = new Map<string, WorkspaceZagreusSpawnInteraction>();
  const chaosSpawns = new Map<string, WorkspaceChaosSpawnInteraction>();
  const resourcePlacements = new Map<string, WorkspaceResourcePlacementInteraction>();
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
      case 'resourcePlacements': {
        for (const resource of requirement.resources) {
          const { interactionKey: key } = resource;
          if (resourcePlacements.has(key)) {
            throw new StructuredWorkspaceProjectionContractError(
              `${key} has multiple bound resource-placement interactions`,
            );
          }
          resourcePlacements.set(
            key,
            Object.freeze({
              intent: Object.freeze({
                command: Object.freeze({
                  kind: 'ReplaceResourcePlacement' as const,
                  route: Object.freeze({
                    kind: 'route' as const,
                    routeKey: requirement.owner.routeKey,
                  }),
                  family: resource.family,
                  value:
                    resource.action === 'remove'
                      ? null
                      : Object.freeze({
                          biomeKey: requirement.owner.biomeKey,
                          occurrenceId: requirement.owner.occurrenceId,
                        }),
                }),
              }),
              key,
              owner: requirement.owner,
            }),
          );
        }
        break;
      }
      case 'chaosSpawn': {
        const key = semanticAddressKey(requirement.owner);
        if (chaosSpawns.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} has multiple bound Chaos spawn interactions`,
          );
        }
        chaosSpawns.set(
          key,
          Object.freeze({
            key,
            owner: requirement.owner,
            spawnIntent: () =>
              Object.freeze({
                command: Object.freeze({
                  kind: 'AddChaos' as const,
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
                    catalog,
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
              const action = createRoomActionAddress(
                createBiomeAddress(requirement.owner.routeKey, requirement.owner.biomeKey),
                requirement.owner.occurrenceId,
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
      case 'purgingPoolSlots': {
        for (const slot of requirement.slots) {
          if (purgingPoolSlots.has(slot.interactionKey)) {
            throw new StructuredWorkspaceProjectionContractError(
              `${slot.interactionKey} has multiple bound Purging Pool slot interactions`,
            );
          }
          purgingPoolSlots.set(
            slot.interactionKey,
            Object.freeze({
              intentFor: (traitKey: string | null) =>
                Object.freeze({
                  command: Object.freeze({
                    kind: 'ReplacePurgingPoolSlot' as const,
                    occurrence: requirement.owner,
                    slotKey: slot.slotKey,
                    traitKey,
                  }),
                }),
              key: slot.interactionKey,
              load: createMemoizedStableIdentityPickerLoad({
                assessment: requirement.assessment,
                choices: [
                  { label: 'Unresolved', value: null },
                  ...slot.candidateTraits.map((trait) => ({
                    label: trait.label,
                    value: trait.key,
                  })),
                ],
                selected: slot.traitKey,
                selectedLabel: slot.traitLabel,
              }),
              owner: requirement.owner,
              slotKey: slot.slotKey,
              traitKey: slot.traitKey,
            }),
          );
        }
        break;
      }
      case 'purgingPoolInteraction': {
        if (purgingPoolInteractions.has(requirement.interactionKey)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${requirement.interactionKey} has multiple bound Purging Pool interactions`,
          );
        }
        purgingPoolInteractions.set(
          requirement.interactionKey,
          Object.freeze({
            intentFor: (interacted: boolean) =>
              Object.freeze({
                command: Object.freeze({
                  kind: 'SetPurgingPoolInteraction' as const,
                  occurrence: requirement.owner,
                  interacted,
                }),
              }),
            key: requirement.interactionKey,
            owner: requirement.owner,
            interacted: requirement.interacted,
          }),
        );
        break;
      }
      case 'hermesShrine': {
        if (requirement.presenceInteractionKey !== undefined) {
          if (hermesShrinePresences.has(requirement.presenceInteractionKey)) {
            throw new StructuredWorkspaceProjectionContractError(
              `${requirement.presenceInteractionKey} has multiple bound Hermes Shrine presence interactions`,
            );
          }
          hermesShrinePresences.set(
            requirement.presenceInteractionKey,
            Object.freeze({
              key: requirement.presenceInteractionKey,
              owner: requirement.owner,
              present: requirement.present,
              intentFor: (present: boolean) =>
                Object.freeze({
                  command: Object.freeze({
                    kind: 'SetHermesShrinePresence' as const,
                    occurrence: requirement.owner,
                    present,
                  }),
                }),
            }),
          );
        }
        for (const slot of requirement.slots) {
          if (hermesShrineOffers.has(slot.offerInteractionKey)) {
            throw new StructuredWorkspaceProjectionContractError(
              `${slot.offerInteractionKey} has multiple bound Hermes Shrine offer interactions`,
            );
          }
          const generationKey =
            slot.slotKey === 'travelDealRefill'
              ? 'travelDealRefill'
              : (`initial:${slot.slotKey}` as const);
          hermesShrineOffers.set(
            slot.offerInteractionKey,
            Object.freeze({
              key: slot.offerInteractionKey,
              load: createMemoizedStableIdentityPickerLoad({
                assessment: requirement.assessment,
                choices: slot.candidateRewards.map((reward) => ({
                  label: reward.label,
                  value: reward.rewardType,
                })),
                selected: slot.rewardType ?? undefined,
                selectedLabel: slot.rewardLabel,
              }),
              owner: requirement.owner,
              slotKey: slot.slotKey,
              rewardType: slot.rewardType,
              candidateRewardTypes: slot.candidateRewardTypes,
              intentFor: (rewardType: string) =>
                Object.freeze({
                  command:
                    slot.slotKey === 'travelDealRefill'
                      ? Object.freeze({
                          kind: 'ReplaceHermesShrineTravelDealRefill' as const,
                          occurrence: requirement.owner,
                          value: Object.freeze({ rewardType }),
                        })
                      : Object.freeze({
                          kind: 'ReplaceHermesShrineOffer' as const,
                          occurrence: requirement.owner,
                          slotKey: slot.slotKey,
                          value: Object.freeze({ rewardType }),
                        }),
                }),
            }),
          );
          if (hermesShrinePurchases.has(slot.purchaseInteractionKey)) {
            throw new StructuredWorkspaceProjectionContractError(
              `${slot.purchaseInteractionKey} has multiple bound Hermes Shrine purchase interactions`,
            );
          }
          hermesShrinePurchases.set(
            slot.purchaseInteractionKey,
            Object.freeze({
              key: slot.purchaseInteractionKey,
              owner: requirement.owner,
              generationKey,
              purchase: slot.purchase,
              intentFor: (
                purchase:
                  import('@run-planner/engine/authored-project').HermesShrinePurchase | null,
              ) =>
                Object.freeze({
                  command: Object.freeze({
                    kind: 'SetHermesShrinePurchase' as const,
                    occurrence: requirement.owner,
                    generationKey,
                    purchase,
                  }),
                }),
            }),
          );
        }
        break;
      }
      case 'stygianWell': {
        if (requirement.presenceInteractionKey !== undefined) {
          stygianWellPresences.set(
            requirement.presenceInteractionKey,
            Object.freeze({
              key: requirement.presenceInteractionKey,
              owner: requirement.owner,
              present: requirement.present,
              intentFor: (present: boolean) =>
                Object.freeze({
                  command: present
                    ? Object.freeze({
                        kind: 'AddStygianWell' as const,
                        occurrence: requirement.owner,
                      })
                    : Object.freeze({
                        kind: 'RemoveStygianWell' as const,
                        occurrence: requirement.owner,
                      }),
                }),
            }),
          );
        }
        if (requirement.interactionKey !== undefined) {
          stygianWellInteractions.set(
            requirement.interactionKey,
            Object.freeze({
              key: requirement.interactionKey,
              owner: requirement.owner,
              interacted: requirement.interacted,
              intentFor: (interacted: boolean) =>
                Object.freeze({
                  command: Object.freeze({
                    kind: 'SetStygianWellInteraction' as const,
                    occurrence: requirement.owner,
                    interacted,
                  }),
                }),
            }),
          );
        }
        for (const slot of requirement.slots) {
          stygianWellOffers.set(
            slot.offerInteractionKey,
            Object.freeze({
              key: slot.offerInteractionKey,
              load: createMemoizedStableIdentityPickerLoad({
                assessment: requirement.assessment,
                choices: [
                  { label: 'Unresolved', value: null },
                  ...slot.candidateItems.map((item) => ({
                    label: item.label,
                    value: item.key,
                  })),
                ],
                selected: slot.itemKey,
                selectedLabel: slot.itemLabel,
              }),
              owner: requirement.owner,
              generationKey: slot.generationKey,
              itemKey: slot.itemKey,
              candidateItemKeys: slot.candidateItemKeys,
              intentFor: (itemKey: string | null) =>
                Object.freeze({
                  command:
                    slot.slotKey === 'travelDealRefill'
                      ? Object.freeze({
                          kind: 'ReplaceStygianWellTravelDealRefill' as const,
                          occurrence: requirement.owner,
                          itemKey,
                        })
                      : Object.freeze({
                          kind: 'ReplaceStygianWellOffer' as const,
                          occurrence: requirement.owner,
                          slotKey: slot.slotKey,
                          itemKey,
                        }),
                }),
            }),
          );
          stygianWellPurchases.set(
            slot.purchaseInteractionKey,
            Object.freeze({
              key: slot.purchaseInteractionKey,
              owner: requirement.owner,
              generationKey: slot.generationKey,
              purchased: slot.purchased,
              intentFor: (purchased: boolean) =>
                Object.freeze({
                  command: Object.freeze({
                    kind: 'SetStygianWellPurchase' as const,
                    occurrence: requirement.owner,
                    generationKey: slot.generationKey,
                    purchased,
                  }),
                }),
            }),
          );
          if (slot.twist !== undefined) {
            stygianWellTwistResults.set(
              slot.twist.interactionKey,
              Object.freeze({
                key: slot.twist.interactionKey,
                load: createMemoizedStableIdentityPickerLoad({
                  assessment: requirement.assessment,
                  choices: [
                    { label: 'Unresolved', value: null },
                    ...slot.twist.candidateItems.map((item) => ({
                      label: item.label,
                      value: item.key,
                    })),
                  ],
                  selected: slot.twist.itemKey,
                  selectedLabel: slot.twist.itemLabel,
                }),
                owner: requirement.owner,
                generationKey: slot.generationKey,
                itemKey: slot.twist.itemKey,
                candidateItemKeys: slot.twist.candidateItemKeys,
                intentFor: (itemKey: string | null) =>
                  Object.freeze({
                    command: Object.freeze({
                      kind: 'ReplaceStygianWellTwistResult' as const,
                      occurrence: requirement.owner,
                      generationKey: slot.generationKey,
                      itemKey,
                    }),
                  }),
              }),
            );
          }
        }
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
    purgingPoolInteractions,
    purgingPoolSlots,
    hermesShrineOffers,
    hermesShrinePurchases,
    hermesShrinePresences,
    stygianWellPresences,
    stygianWellInteractions,
    stygianWellOffers,
    stygianWellPurchases,
    stygianWellTwistResults,
    localVisitOrders,
    localVisitGenerations,
    zagreusSpawns,
    chaosSpawns,
    resourcePlacements,
  });
}
