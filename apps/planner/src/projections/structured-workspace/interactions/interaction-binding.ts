import {
  semanticAddressKey,
  type ExitDecisionAddress,
  type OccurrenceId,
  type SemanticAddress,
  type SideRoomGeneration,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { ProjectEvaluationAssembly } from '@run-planner/engine/simulation';

import type {
  CandidateOptionProjection,
  CandidateProjectionSession,
} from '@planner/projections/candidateProjection';
import type { ContextualPickerModel } from '@planner/projections/contextualPicker';
import { explainCandidateEvaluation } from '@planner/projections/contextualOptions';
import {
  roomCategoryForKind,
  roomSelectorCategories,
  selectRoomsForTargetCategory,
} from '@planner/projections/roomSelectorProjection';
import {
  createTakeoverBatchCommand,
  type TakeoverBatchCommand,
} from '@planner/workspace/takeoverBatchInteraction';

import { requireWorkspaceRoom } from '../assembly/catalog-room';
import { StructuredWorkspaceProjectionContractError, workspaceInteractionKey } from '../contract';
import type {
  StructuredWorkspaceContextualServices,
  WorkspaceCandidateInteraction,
  WorkspaceExitFrontierCapabilities,
  WorkspaceExitSelectionInteraction,
  WorkspaceFixedWidthOneTakeoverActionResult,
  WorkspaceHubSlotInteraction,
  WorkspaceInteractionCatalog,
  WorkspaceInteractionChoice,
  WorkspaceRewardControl,
  WorkspaceRewardInteraction,
  WorkspaceRoomInteraction,
  WorkspaceRoomPickerControl,
  WorkspaceStartInteraction,
  WorkspaceStructuralInteraction,
  WorkspaceTakeoverBatchInteraction,
  WorkspaceTakeoverCandidate,
  WorkspaceTopologyRemovalInteraction,
} from '../contract';
import type {
  WorkspaceBatchInteractionRequirement,
  WorkspaceFrontierInteractionRequirement,
  WorkspaceHubInteractionRequirement,
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceStartInteractionRequirement,
  WorkspaceTakeoverInteractionRequirement,
  WorkspaceTopologyRemovalInteractionRequirement,
} from './interaction-requirements';

export interface WorkspaceInteractionBindingInput {
  readonly assembly: ProjectEvaluationAssembly;
  readonly batchInteractionRequirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>;
  readonly catalog: Catalog;
  readonly frontierInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceFrontierInteractionRequirement
  >;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly occurrenceInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceOccurrenceInteractionRequirement
  >;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
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
  load: () => readonly CandidateOptionProjection<T>[],
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
  readonly rewardWheelOfferCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelPicks: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly shipEncounterCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<2 | 3>>;
  readonly shopPurchases: ReadonlyMap<string, WorkspaceCandidateInteraction<boolean>>;
  readonly sideRoomEntryOrders: ReadonlyMap<
    string,
    WorkspaceCandidateInteraction<readonly string[]>
  >;
  readonly sideRoomGenerations: ReadonlyMap<
    string,
    WorkspaceCandidateInteraction<SideRoomGeneration>
  >;
}

function bindOccurrenceLocalInteractions(
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>,
): WorkspaceOccurrenceLocalInteractionCatalog {
  const rewardWheelOfferCounts = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelPicks = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const shipEncounterCounts = new Map<string, WorkspaceCandidateInteraction<2 | 3>>();
  const shopPurchases = new Map<string, WorkspaceCandidateInteraction<boolean>>();
  const sideRoomEntryOrders = new Map<string, WorkspaceCandidateInteraction<readonly string[]>>();
  const sideRoomGenerations = new Map<string, WorkspaceCandidateInteraction<SideRoomGeneration>>();
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
      case 'shipCombat': {
        const encounterCountValues = Object.freeze(
          requirement.encounterCountChoices.map((choice) => choice.value),
        );
        set(
          shipEncounterCounts,
          semanticAddressKey(requirement.owner),
          candidateInteraction(
            requirement.owner,
            requirement.encounterCountChoices,
            requirement.encounterCount,
            () => candidates.shipEncounterCounts(requirement.owner, encounterCountValues),
          ),
          'Ship encounter-count',
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
      case 'shopPurchases': {
        const purchaseValues = Object.freeze(
          requirement.purchaseChoices.map((choice) => choice.value),
        );
        for (const purchase of requirement.purchases) {
          const key = semanticAddressKey(purchase.owner);
          set(
            shopPurchases,
            key,
            candidateInteraction(
              purchase.owner,
              requirement.purchaseChoices,
              purchase.purchased,
              () => candidates.shopPurchases(purchase.owner, purchaseValues),
            ),
            'Shop purchase',
          );
        }
        break;
      }
    }
  }
  return Object.freeze({
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    shipEncounterCounts,
    shopPurchases,
    sideRoomEntryOrders,
    sideRoomGenerations,
  });
}

interface WorkspaceBatchInteractionCatalog {
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly exitSelections: ReadonlyMap<string, WorkspaceExitSelectionInteraction>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceCandidateInteraction<'min' | 'max'>>;
}

function bindBatchInteractions(
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceBatchInteractionRequirement>,
): WorkspaceBatchInteractionCatalog {
  const batchRewardStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const exitSelections = new Map<string, WorkspaceExitSelectionInteraction>();
  const fieldsCageOutcomes = new Map<string, WorkspaceCandidateInteraction<'min' | 'max'>>();
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
  }
  return Object.freeze({ batchRewardStores, exitSelections, fieldsCageOutcomes });
}

interface WorkspaceHubInteractionCatalog {
  readonly hubSlots: ReadonlyMap<string, WorkspaceHubSlotInteraction>;
  readonly hubVisits: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
}

function bindHubInteractions(
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceHubInteractionRequirement>,
): WorkspaceHubInteractionCatalog {
  const hubSlots = new Map<string, WorkspaceHubSlotInteraction>();
  const hubVisits = new Map<string, WorkspaceCandidateInteraction<string>>();
  for (const requirement of requirements) {
    for (const slot of requirement.slots) {
      const key = semanticAddressKey(slot.owner);
      if (hubSlots.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound Hub-slot interactions`,
        );
      }
      const values = Object.freeze(slot.choices.map((choice) => choice.value));
      hubSlots.set(
        key,
        Object.freeze({
          bind: (proposedOccurrenceId: OccurrenceId) =>
            candidateInteraction(
              slot.owner,
              slot.choices,
              slot.selected,
              () =>
                candidates.hubSlots(
                  slot.owner,
                  slot.openedOccurrenceId ?? proposedOccurrenceId,
                  values,
                ),
              `${key}:proposed:${proposedOccurrenceId}`,
            ),
          ...(slot.close === undefined ? {} : { close: slot.close }),
          key,
          owner: slot.owner,
          roomGameName: slot.roomGameName,
          selected: slot.selected,
        }),
      );
    }
    for (const visit of requirement.visits) {
      const key = semanticAddressKey(visit.owner);
      if (hubVisits.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has multiple bound Hub-visit interactions`,
        );
      }
      const values = Object.freeze(visit.choices.map((choice) => choice.value));
      hubVisits.set(
        key,
        candidateInteraction(visit.owner, visit.choices, visit.selectedHubSlotKey, () =>
          candidates.hubVisits(visit.owner, values),
        ),
      );
    }
  }
  return Object.freeze({ hubSlots, hubVisits });
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
      topologyRemovals.set(removal.key, removal);
    }
  }
  return topologyRemovals;
}

function bindStartInteractions(
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
    if (requirement.start.kind === 'fixed') {
      starts.set(
        key,
        Object.freeze({
          fixedGameName: requirement.start.gameName,
          fixedLabel: requireWorkspaceRoom(catalog, requirement.start.gameName).label,
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
  catalog: Catalog,
  candidates: CandidateProjectionSession,
  requirements: Iterable<WorkspaceTakeoverInteractionRequirement>,
): ReadonlyMap<string, WorkspaceTakeoverBatchInteraction> {
  const takeoverCandidate = (gameName: string): WorkspaceTakeoverCandidate => {
    const room = requireWorkspaceRoom(catalog, gameName);
    return Object.freeze({ gameName: room.gameName, label: room.label });
  };
  const takeoverCandidates = (
    owner: ExitDecisionAddress,
    gameNames: readonly string[],
  ): readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[] =>
    Object.freeze(
      candidates.takeoverPrebossBatches(owner, gameNames).map((candidate) =>
        Object.freeze({
          evaluation: candidate.evaluation,
          value: takeoverCandidate(candidate.value),
        }),
      ),
    );
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
      case 'candidate': {
        const existingTargetOccurrenceIds = targetOccurrences(requirement.existingTargets);
        let loaded: readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[] | undefined;
        const load = (): readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[] => {
          if (loaded === undefined) {
            loaded = takeoverCandidates(requirement.owner, requirement.gameNames);
          }
          return loaded;
        };
        takeoverBatches.set(
          key,
          Object.freeze({
            action: requirement.action,
            commandFor(selection: WorkspaceTakeoverCandidate): TakeoverBatchCommand {
              const candidate = load().find(
                (option) => option.value.gameName === selection.gameName,
              );
              if (
                candidate?.evaluation.kind !== 'takeoverPrebossBatch' ||
                !candidate.evaluation.result.selectedPossible
              ) {
                throw new StructuredWorkspaceProjectionContractError(
                  `Takeover candidate ${selection.gameName} is not currently applicable.`,
                );
              }
              return createTakeoverBatchCommand({
                action: requirement.action,
                decision: requirement.owner,
                existingTargetOccurrenceIds,
                gameName: selection.gameName,
                requiredExitKeys: candidate.evaluation.result.requiredExitKeys,
              });
            },
            ...(requirement.impact === undefined ? {} : { impact: requirement.impact }),
            key,
            load,
            owner: requirement.owner,
            presentation: 'candidate' as const,
          }),
        );
        break;
      }
      case 'repair': {
        const candidate = takeoverCandidate(requirement.gameName);
        const existingTargetOccurrenceIds = targetOccurrences(requirement.existingTargets);
        takeoverBatches.set(
          key,
          Object.freeze({
            action: 'reconcile' as const,
            execute: () =>
              createTakeoverBatchCommand({
                action: 'reconcile',
                decision: requirement.owner,
                existingTargetOccurrenceIds,
                gameName: requirement.gameName,
                requiredExitKeys: requirement.requiredExitKeys,
              }),
            key,
            label: candidate.label,
            owner: requirement.owner,
            presentation: 'repair' as const,
          }),
        );
        break;
      }
      case 'fixedWidthOneTakeover': {
        const candidate = takeoverCandidate(requirement.gameName);
        const room = requireWorkspaceRoom(catalog, requirement.gameName);
        const summary =
          room.incomingReward.kind === 'shop'
            ? `Enter ${candidate.label}. This declaration-owned transition creates one automatically entered World Shop.`
            : `Enter ${candidate.label} through this declaration-owned transition.`;
        takeoverBatches.set(
          key,
          Object.freeze({
            action: 'create' as const,
            execute: (): WorkspaceFixedWidthOneTakeoverActionResult => {
              // This fixed declaration still receives the engine's contextual
              // validation only when the player takes it. React never loads or
              // interprets a candidate result.
              const evaluated = takeoverCandidates(
                requirement.owner,
                Object.freeze([requirement.gameName]),
              )[0];
              if (
                evaluated?.evaluation.kind !== 'takeoverPrebossBatch' ||
                !evaluated.evaluation.result.selectedPossible
              ) {
                const explanation =
                  evaluated === undefined
                    ? undefined
                    : explainCandidateEvaluation(catalog, evaluated.evaluation);
                return Object.freeze({
                  kind: 'unavailable' as const,
                  message:
                    explanation?.message ??
                    'This fixed Preboss takeover is not supported by the current route state.',
                });
              }
              return Object.freeze({
                kind: 'command' as const,
                command: createTakeoverBatchCommand({
                  action: 'create',
                  decision: requirement.owner,
                  existingTargetOccurrenceIds: new Map(),
                  gameName: requirement.gameName,
                  requiredExitKeys: requirement.requiredExitKeys,
                }),
              });
            },
            key,
            label: candidate.label,
            owner: requirement.owner,
            presentation: 'fixedWidthOneTakeover' as const,
            summary,
          }),
        );
        break;
      }
      case 'completedHubHandoff':
        takeoverBatches.set(
          key,
          Object.freeze({
            action: 'create' as const,
            execute: () =>
              createTakeoverBatchCommand({
                action: 'create',
                decision: requirement.owner,
                existingTargetOccurrenceIds: new Map(),
                gameName: requirement.gameName,
                requiredExitKeys: requirement.requiredExitKeys,
              }),
            key,
            label: takeoverCandidate(requirement.gameName).label,
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
  takeoverBatches: ReadonlyMap<string, WorkspaceTakeoverBatchInteraction>,
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
        if (capabilities.structural === undefined && capabilities.takeover !== true) {
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
        if (capabilities.takeover === true && !takeoverBatches.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${key} exit frontier takeover capability was not bound`,
          );
        }
        switch (requirement.structural?.action) {
          case undefined:
            break;
          case 'createBatch':
            bindStructural(
              Object.freeze({
                action: 'createBatch' as const,
                key,
                owner: requirement.owner,
              }),
            );
            break;
          case 'createLinkedExit':
            bindStructural(
              Object.freeze({
                action: 'createLinkedExit' as const,
                key,
                owner: requirement.owner,
                targetGameName: requirement.structural.targetGameName,
              }),
            );
            break;
        }
        break;
      }
      case 'hubDecisionFrontier':
        bindStructural(
          Object.freeze({
            action: 'createHubDecision' as const,
            key,
            owner: requirement.owner,
          }),
        );
        break;
    }
  }
  return Object.freeze({ exitFrontierCapabilities, structural });
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
    assembly,
    batchInteractionRequirements,
    catalog,
    frontierInteractionRequirements,
    hubInteractionRequirements,
    occurrenceInteractionRequirements,
    rewardControls,
    roomControls,
    services,
    startInteractionRequirements,
    takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements,
  } = input;
  const { project } = assembly;
  const candidates = services.candidateSessions.bind(assembly);
  const {
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    shipEncounterCounts,
    shopPurchases,
    sideRoomEntryOrders,
    sideRoomGenerations,
  } = bindOccurrenceLocalInteractions(candidates, occurrenceInteractionRequirements.values());
  const { batchRewardStores, exitSelections, fieldsCageOutcomes } = bindBatchInteractions(
    candidates,
    batchInteractionRequirements.values(),
  );
  const { hubSlots, hubVisits } = bindHubInteractions(
    candidates,
    hubInteractionRequirements.values(),
  );
  const topologyRemovals = bindTopologyRemovalInteractions(
    topologyRemovalInteractionRequirements.values(),
  );
  const starts = bindStartInteractions(
    catalog,
    candidates,
    services,
    startInteractionRequirements.values(),
  );
  const takeoverBatches = bindTakeoverBatchInteractions(
    catalog,
    candidates,
    takeoverInteractionRequirements.values(),
  );
  const { exitFrontierCapabilities, structural } = bindFrontierInteractions(
    frontierInteractionRequirements.values(),
    takeoverBatches,
  );
  const rooms = new Map<string, WorkspaceRoomInteraction>();
  for (const [key, control] of roomControls) {
    const candidateRooms = (() => {
      if (control.kind === 'startRoomPicker') {
        return Object.freeze(
          control.candidateGameNames.map((gameName) => requireWorkspaceRoom(catalog, gameName)),
        );
      }
      const candidatesForCategories = roomSelectorCategories(
        catalog,
        control.address.biomeKey,
      ).flatMap((category) =>
        selectRoomsForTargetCategory(catalog, project, control.address, category),
      );
      return Object.freeze([
        ...new Map(candidatesForCategories.map((room) => [room.gameName, room])).values(),
      ]);
    })();
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
        key,
        owner: control.address,
        load(): ContextualPickerModel<RoomDeclaration> {
          if (model !== undefined) return model;
          model = services.contextualPicker.project(
            control.kind === 'startRoomPicker'
              ? candidates.startRooms(control.address, candidateRooms)
              : candidates.roomTargets(control.address, candidateRooms),
            (option) =>
              Object.freeze({
                label: option.value.label,
                category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                selected: option.value.gameName === control.selectedGameName,
              }),
            (room) => room.gameName,
          );
          return model;
        },
        ...(control.selectedGameName === undefined
          ? {}
          : { selected: requireWorkspaceRoom(catalog, control.selectedGameName) }),
      }),
    );
  }

  const rewards = new Map<string, WorkspaceRewardInteraction>();
  for (const [key, control] of rewardControls) {
    const rewardTypes =
      control.kind === 'countedReward'
        ? candidates.countedRewardTypes(control.owner, control.binding, control.offer.rewardType)
        : control.rewardTypes;
    rewards.set(
      key,
      Object.freeze({
        authoredRewardTypes: rewardTypes,
        choiceLabel: services.rewardPicker.choiceLabel,
        key,
        load: () => candidates.rewardDomain(control.owner, rewardTypes, control.offer),
        model: services.rewardPicker.project,
        owner: control.owner.address,
        selected: control.offer,
        summary: services.rewardPicker.summary,
      }),
    );
  }

  return Object.freeze({
    batchRewardStores,
    exitFrontierCapabilities,
    exitSelections,
    fieldsCageOutcomes,
    hubSlots,
    hubVisits,
    rewards,
    rewardWheelOfferCounts,
    rewardWheelPicks,
    rewardWheelStores,
    rooms,
    shipEncounterCounts,
    shopPurchases,
    sideRoomEntryOrders,
    sideRoomGenerations,
    starts,
    structural,
    takeoverBatches,
    topologyRemovals,
  });
}
