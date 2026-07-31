import {
  createOccurrenceId,
  semanticAddressKey,
  type ExitDecisionAddress,
  type HubDecisionAddress,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { requireWorkspaceRoom as requireRoom } from '../catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  workspaceInteractionKey,
  type WorkspaceAuthoredLeafRequirement,
  type WorkspaceCandidateInteraction,
  type WorkspaceInteractionCatalog,
  type WorkspaceInteractionChoice,
  type WorkspaceRoomPickerControl,
  type WorkspaceRewardControl,
  type WorkspaceRoomSummary,
  type WorkspaceRoute,
  type WorkspaceStructuralInteraction,
} from '../contract';
import type {
  WorkspaceBatchInteractionRequirement,
  WorkspaceFrontierInteractionRequirement,
  WorkspaceHubInteractionRequirement,
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceStartInteractionRequirement,
  WorkspaceTakeoverInteractionRequirement,
  WorkspaceTopologyRemovalInteractionRequirement,
} from '../interaction-requirements';
import {
  sameHubSlotClose,
  sameTakeoverReplacementImpact,
  sameTopologyRemovalInteraction,
} from './interaction-equality';

function requireWorkspaceProjectionInteraction(
  interactions: ReadonlyMap<string, unknown>,
  key: string,
  detail: string,
): void {
  if (!interactions.has(key)) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${key} has no exact workspace interaction`,
    );
  }
}

/**
 * Checks the interaction side of the independently enumerated authored leaf
 * contract. This is intentionally not derived from room controls or rendered
 * room-local products, which could both disappear with the same projection
 * omission.
 */
export function assertAuthoredWorkspaceLeafInteractionClosure(
  requirements: readonly WorkspaceAuthoredLeafRequirement[],
  interactions: WorkspaceInteractionCatalog,
): void {
  for (const requirement of requirements) {
    for (const interaction of requirement.interactions) {
      switch (interaction.kind) {
        case 'reward':
          requireWorkspaceProjectionInteraction(
            interactions.rewards,
            interaction.key,
            'authored reward leaf',
          );
          break;
        case 'rewardWheelOfferCount':
          requireWorkspaceProjectionInteraction(
            interactions.rewardWheelOfferCounts,
            interaction.key,
            'authored reward-wheel offer-count leaf',
          );
          break;
        case 'rewardWheelPick':
          requireWorkspaceProjectionInteraction(
            interactions.rewardWheelPicks,
            interaction.key,
            'authored reward-wheel pick leaf',
          );
          break;
        case 'rewardWheelStore':
          requireWorkspaceProjectionInteraction(
            interactions.rewardWheelStores,
            interaction.key,
            'authored reward-wheel store leaf',
          );
          break;
        case 'shipEncounterCount':
          requireWorkspaceProjectionInteraction(
            interactions.shipEncounterCounts,
            interaction.key,
            'authored Ship encounter-count leaf',
          );
          break;
        case 'shopPurchase':
          requireWorkspaceProjectionInteraction(
            interactions.shopPurchases,
            interaction.key,
            'authored Shop purchase leaf',
          );
          break;
        case 'sideRoomEntryOrder':
          requireWorkspaceProjectionInteraction(
            interactions.sideRoomEntryOrders,
            interaction.key,
            'authored side-room entry-order leaf',
          );
          break;
        case 'sideRoomGeneration':
          requireWorkspaceProjectionInteraction(
            interactions.sideRoomGenerations,
            interaction.key,
            'authored side-room generation leaf',
          );
          break;
      }
    }
  }
}

/**
 * Verify that every emitted occurrence package binds to its exact owner and
 * interaction key. This complements rendered-node closure, which audits the
 * published surface rather than this package-to-interaction handoff.
 */
function assertOccurrenceInteractionRequirementClosure(
  requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>,
  interactions: WorkspaceInteractionCatalog,
): void {
  const requireCandidate = <T>(
    values: ReadonlyMap<string, WorkspaceCandidateInteraction<T>>,
    key: string,
    owner: SemanticAddress,
    detail: string,
  ): void => {
    const interaction = values.get(key);
    if (interaction === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${detail} ${key} has no exact workspace interaction`,
      );
    }
    if (semanticAddressKey(interaction.owner) !== semanticAddressKey(owner)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${detail} ${key} has an interaction for a conflicting semantic owner`,
      );
    }
  };
  for (const requirement of requirements) {
    switch (requirement.kind) {
      case 'ephyraSideRooms':
        for (const sideRoom of requirement.sideRooms) {
          requireCandidate(
            interactions.sideRoomGenerations,
            semanticAddressKey(sideRoom.address),
            sideRoom.address,
            'side-room generation requirement',
          );
          requireCandidate(
            interactions.sideRoomEntryOrders,
            sideRoom.entryOrder.interactionKey,
            requirement.owner,
            'side-room entry-order requirement',
          );
        }
        break;
      case 'shipCombat':
        requireCandidate(
          interactions.shipEncounterCounts,
          semanticAddressKey(requirement.owner),
          requirement.owner,
          'Ship encounter-count requirement',
        );
        for (const wheel of requirement.wheels) {
          const key = semanticAddressKey(wheel.address);
          requireCandidate(
            interactions.rewardWheelOfferCounts,
            key,
            wheel.address,
            'reward-wheel offer-count requirement',
          );
          requireCandidate(
            interactions.rewardWheelStores,
            key,
            wheel.address,
            'reward-wheel store requirement',
          );
          requireCandidate(
            interactions.rewardWheelPicks,
            key,
            wheel.address,
            'reward-wheel pick requirement',
          );
        }
        break;
      case 'shopPurchases':
        for (const purchase of requirement.purchases) {
          requireCandidate(
            interactions.shopPurchases,
            semanticAddressKey(purchase.owner),
            purchase.owner,
            'Shop purchase requirement',
          );
        }
        break;
    }
  }
}

/** Verify every emitted batch-control package binds to its exact key and owner. */
function assertBatchInteractionRequirementClosure(
  requirements: Iterable<WorkspaceBatchInteractionRequirement>,
  interactions: WorkspaceInteractionCatalog,
): void {
  const requireInteraction = <T extends { readonly key: string; readonly owner: SemanticAddress }>(
    values: ReadonlyMap<string, T>,
    key: string,
    owner: SemanticAddress,
    detail: string,
  ): void => {
    const interaction = values.get(key);
    if (interaction === undefined || interaction.key !== key) {
      throw new StructuredWorkspaceProjectionContractError(
        `${detail} ${key} has no exact workspace interaction`,
      );
    }
    if (semanticAddressKey(interaction.owner) !== semanticAddressKey(owner)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${detail} ${key} has an interaction for a conflicting semantic owner`,
      );
    }
  };
  for (const requirement of requirements) {
    if (requirement.exitSelection !== undefined) {
      requireInteraction(
        interactions.exitSelections,
        semanticAddressKey(requirement.exitSelection.owner),
        requirement.owner,
        'exit-selection requirement',
      );
    }
    if (requirement.rewardStore !== undefined) {
      requireInteraction(
        interactions.batchRewardStores,
        semanticAddressKey(requirement.rewardStore.owner),
        requirement.rewardStore.owner,
        'batch reward-store requirement',
      );
    }
    if (requirement.fieldsCageOutcome !== undefined) {
      requireInteraction(
        interactions.fieldsCageOutcomes,
        semanticAddressKey(requirement.fieldsCageOutcome.owner),
        requirement.fieldsCageOutcome.owner,
        'Fields cage-outcome requirement',
      );
    }
  }
}

/** Verify every emitted Hub package binds to its exact slot and visit controls. */
function assertHubInteractionRequirementClosure(
  requirements: Iterable<WorkspaceHubInteractionRequirement>,
  interactions: WorkspaceInteractionCatalog,
): void {
  const sameChoices = <T>(
    actual: readonly WorkspaceInteractionChoice<T>[],
    expected: readonly WorkspaceInteractionChoice<T>[],
  ): boolean =>
    actual.length === expected.length &&
    actual.every(
      (choice, index) =>
        choice.label === expected[index]?.label && choice.value === expected[index]?.value,
    );
  for (const requirement of requirements) {
    for (const slot of requirement.slots) {
      const key = semanticAddressKey(slot.owner);
      const interaction = interactions.hubSlots.get(key);
      if (
        interaction === undefined ||
        interaction.key !== key ||
        semanticAddressKey(interaction.owner) !== key ||
        interaction.roomGameName !== slot.roomGameName ||
        interaction.selected !== slot.selected ||
        !sameHubSlotClose(interaction.close, slot.close)
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `Hub-slot requirement ${key} has no exact workspace interaction`,
        );
      }
      const bound = interaction.bind(createOccurrenceId(`hub-closure-${key}`));
      if (
        semanticAddressKey(bound.owner) !== key ||
        !sameChoices(bound.choices, slot.choices) ||
        bound.selected !== slot.selected
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `Hub-slot requirement ${key} has a conflicting bound interaction`,
        );
      }
    }
    for (const visit of requirement.visits) {
      const key = semanticAddressKey(visit.owner);
      const interaction = interactions.hubVisits.get(key);
      if (
        interaction === undefined ||
        interaction.key !== key ||
        semanticAddressKey(interaction.owner) !== key ||
        interaction.selected !== visit.selectedHubSlotKey ||
        !sameChoices(interaction.choices, visit.choices)
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `Hub-visit requirement ${key} has no exact workspace interaction`,
        );
      }
    }
  }
}

/** Verify every authored-biome removal package binds to its exact controls. */
function assertTopologyRemovalInteractionRequirementClosure(
  requirements: Iterable<WorkspaceTopologyRemovalInteractionRequirement>,
  interactions: WorkspaceInteractionCatalog,
): void {
  const expectedKeys = new Set<string>();
  for (const requirement of requirements) {
    for (const removal of requirement.removals) {
      expectedKeys.add(removal.key);
      const interaction = interactions.topologyRemovals.get(removal.key);
      if (interaction === undefined || !sameTopologyRemovalInteraction(interaction, removal)) {
        throw new StructuredWorkspaceProjectionContractError(
          `Topology-removal requirement ${removal.key} has no exact workspace interaction`,
        );
      }
    }
  }
  if (interactions.topologyRemovals.size !== expectedKeys.size) {
    throw new StructuredWorkspaceProjectionContractError(
      'workspace topology-removal interactions have no exact requirement package',
    );
  }
}

/** Verify every topology-free biome start binds to its exact projected action. */
function assertStartInteractionRequirementClosure(
  requirements: Iterable<WorkspaceStartInteractionRequirement>,
  catalog: Catalog,
  interactions: WorkspaceInteractionCatalog,
): void {
  const expectedKeys = new Set<string>();
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.owner);
    expectedKeys.add(key);
    const interaction = interactions.starts.get(key);
    if (
      interaction === undefined ||
      interaction.key !== key ||
      semanticAddressKey(interaction.owner) !== key
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `Start interaction requirement ${key} has no exact workspace interaction`,
      );
    }
    if (requirement.start.kind === 'fixed') {
      if (
        interaction.kind !== 'fixed' ||
        interaction.fixedGameName !== requirement.start.gameName ||
        interaction.fixedLabel !== requireRoom(catalog, requirement.start.gameName).label
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `Start interaction requirement ${key} has conflicting fixed-start facts`,
        );
      }
    } else if (interaction.kind !== 'choice') {
      throw new StructuredWorkspaceProjectionContractError(
        `Start interaction requirement ${key} has a conflicting choice-start presentation`,
      );
    }
  }
  if (interactions.starts.size !== expectedKeys.size) {
    throw new StructuredWorkspaceProjectionContractError(
      'workspace start interactions have no exact requirement package',
    );
  }
}

/**
 * Verify the requirement-to-interaction handoff without invoking candidate
 * loaders. The independent authored audit above owns candidate-domain facts;
 * direct closure checks the exact eager presentation and command surface.
 */
function assertTakeoverInteractionRequirementClosure(
  requirements: Iterable<WorkspaceTakeoverInteractionRequirement>,
  catalog: Catalog,
  interactions: WorkspaceInteractionCatalog,
): void {
  const expectedKeys = new Set<string>();
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.owner);
    expectedKeys.add(key);
    const interaction = interactions.takeoverBatches.get(key);
    if (
      interaction === undefined ||
      interaction.key !== key ||
      semanticAddressKey(interaction.owner) !== key ||
      interaction.presentation !== requirement.presentation ||
      interaction.action !== requirement.action
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `Takeover interaction requirement ${key} has no exact workspace interaction`,
      );
    }
    switch (requirement.presentation) {
      case 'candidate':
        if (
          interaction.presentation !== 'candidate' ||
          typeof interaction.load !== 'function' ||
          typeof interaction.commandFor !== 'function' ||
          !sameTakeoverReplacementImpact(interaction.impact, requirement.impact)
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `Takeover interaction requirement ${key} has conflicting candidate facts`,
          );
        }
        break;
      case 'repair':
        if (
          interaction.presentation !== 'repair' ||
          typeof interaction.execute !== 'function' ||
          interaction.label !== requireRoom(catalog, requirement.gameName).label
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `Takeover interaction requirement ${key} has conflicting repair facts`,
          );
        }
        break;
      case 'fixedWidthOneTakeover': {
        const room = requireRoom(catalog, requirement.gameName);
        const summary =
          room.incomingReward.kind === 'shop'
            ? `Enter ${room.label}. This declaration-owned transition creates one automatically entered World Shop.`
            : `Enter ${room.label} through this declaration-owned transition.`;
        if (
          interaction.presentation !== 'fixedWidthOneTakeover' ||
          typeof interaction.execute !== 'function' ||
          interaction.label !== room.label ||
          interaction.summary !== summary
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `Takeover interaction requirement ${key} has conflicting fixed-width-one facts`,
          );
        }
        break;
      }
      case 'completedHubHandoff':
        if (
          interaction.presentation !== 'completedHubHandoff' ||
          typeof interaction.execute !== 'function' ||
          interaction.label !== requireRoom(catalog, requirement.gameName).label
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `Takeover interaction requirement ${key} has conflicting Hub-handoff facts`,
          );
        }
        break;
    }
  }
  if (interactions.takeoverBatches.size !== expectedKeys.size) {
    throw new StructuredWorkspaceProjectionContractError(
      'workspace takeover interactions have no exact requirement package',
    );
  }
}

/**
 * Frontier capability is a lookup permission, so verify it and structural
 * creation as one exact bound product without contacting candidate loaders.
 */
function assertFrontierInteractionRequirementClosure(
  requirements: Iterable<WorkspaceFrontierInteractionRequirement>,
  interactions: WorkspaceInteractionCatalog,
): void {
  const expectedCapabilityKeys = new Set<string>();
  const expectedStructuralKeys = new Set<string>();
  const requireStructural = (
    key: string,
    owner: ExitDecisionAddress | HubDecisionAddress,
    action: WorkspaceStructuralInteraction,
  ): void => {
    const interaction = interactions.structural.get(key);
    if (
      interaction === undefined ||
      interaction.action !== action.action ||
      interaction.key !== key ||
      semanticAddressKey(interaction.owner) !== semanticAddressKey(owner)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `Frontier interaction requirement ${key} has no exact structural action`,
      );
    }
    if (
      action.action === 'createLinkedExit' &&
      (interaction.action !== 'createLinkedExit' ||
        interaction.targetGameName !== action.targetGameName)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `Frontier interaction requirement ${key} has conflicting linked-exit facts`,
      );
    }
  };
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.owner);
    switch (requirement.kind) {
      case 'exitFrontier': {
        if (expectedCapabilityKeys.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `Frontier interaction requirement ${key} has multiple capability packages`,
          );
        }
        expectedCapabilityKeys.add(key);
        const capabilities = interactions.exitFrontierCapabilities.get(key);
        if (
          capabilities === undefined ||
          capabilities.structural !== requirement.capabilities.structural ||
          capabilities.takeover !== requirement.capabilities.takeover
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `Frontier interaction requirement ${key} has no exact capability package`,
          );
        }
        if (requirement.capabilities.takeover === true) {
          const takeover = interactions.takeoverBatches.get(key);
          if (takeover === undefined || semanticAddressKey(takeover.owner) !== key) {
            throw new StructuredWorkspaceProjectionContractError(
              `Frontier interaction requirement ${key} has no exact takeover action`,
            );
          }
        }
        if (requirement.structural === undefined) {
          if (interactions.structural.has(key)) {
            throw new StructuredWorkspaceProjectionContractError(
              `Frontier interaction requirement ${key} has an unadvertised structural action`,
            );
          }
          break;
        }
        expectedStructuralKeys.add(key);
        const action: WorkspaceStructuralInteraction =
          requirement.structural.action === 'createBatch'
            ? Object.freeze({ action: 'createBatch' as const, key, owner: requirement.owner })
            : Object.freeze({
                action: 'createLinkedExit' as const,
                key,
                owner: requirement.owner,
                targetGameName: requirement.structural.targetGameName,
              });
        requireStructural(key, requirement.owner, action);
        break;
      }
      case 'hubDecisionFrontier': {
        if (expectedStructuralKeys.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            `Frontier interaction requirement ${key} has multiple structural packages`,
          );
        }
        expectedStructuralKeys.add(key);
        requireStructural(
          key,
          requirement.owner,
          Object.freeze({ action: 'createHubDecision' as const, key, owner: requirement.owner }),
        );
        break;
      }
    }
  }
  if (interactions.exitFrontierCapabilities.size !== expectedCapabilityKeys.size) {
    throw new StructuredWorkspaceProjectionContractError(
      'workspace exit frontier capabilities have no exact requirement package',
    );
  }
  if (interactions.structural.size !== expectedStructuralKeys.size) {
    throw new StructuredWorkspaceProjectionContractError(
      'workspace structural interactions have no exact requirement package',
    );
  }
}

function assertWorkspaceRoomInteractionClosure(
  room: WorkspaceRoomSummary,
  interactions: WorkspaceInteractionCatalog,
): void {
  if (room.roomPicker !== undefined) {
    requireWorkspaceProjectionInteraction(
      interactions.rooms,
      workspaceInteractionKey(room.roomPicker.address),
      'room picker',
    );
  }
  for (const control of room.rewardControls) {
    requireWorkspaceProjectionInteraction(
      interactions.rewards,
      control.marker.focusKey,
      'reward control',
    );
  }
  switch (room.roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
    case 'fields':
      return;
    case 'ephyra':
      if (room.roomLocal.sideRooms.kind === 'withheld') return;
      for (const sideRoom of room.roomLocal.sideRooms.group.slots) {
        requireWorkspaceProjectionInteraction(
          interactions.sideRoomGenerations,
          sideRoom.marker.focusKey,
          'side-room generation',
        );
        requireWorkspaceProjectionInteraction(
          interactions.sideRoomEntryOrders,
          sideRoom.entryOrder.interactionKey,
          'side-room entry order',
        );
      }
      return;
    case 'ship':
      requireWorkspaceProjectionInteraction(
        interactions.shipEncounterCounts,
        room.marker.focusKey,
        'Ship encounter count',
      );
      for (const wheel of room.roomLocal.wheels) {
        requireWorkspaceProjectionInteraction(
          interactions.rewardWheelOfferCounts,
          wheel.marker.focusKey,
          'reward-wheel offer count',
        );
        requireWorkspaceProjectionInteraction(
          interactions.rewardWheelStores,
          wheel.marker.focusKey,
          'reward-wheel store',
        );
        requireWorkspaceProjectionInteraction(
          interactions.rewardWheelPicks,
          wheel.marker.focusKey,
          'reward-wheel pick',
        );
      }
      return;
    case 'shop':
      for (const offer of room.roomLocal.offers) {
        requireWorkspaceProjectionInteraction(
          interactions.shopPurchases,
          offer.purchase.marker.focusKey,
          'Shop purchase',
        );
      }
      return;
  }
}

export function assertWorkspaceInteractionClosure(
  routes: readonly WorkspaceRoute[],
  roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>,
  rewardControls: ReadonlyMap<string, WorkspaceRewardControl>,
  interactions: WorkspaceInteractionCatalog,
  authoredLeafRequirements: readonly WorkspaceAuthoredLeafRequirement[] = Object.freeze([]),
): void {
  assertAuthoredWorkspaceLeafInteractionClosure(authoredLeafRequirements, interactions);
  for (const [key, control] of roomControls) {
    requireWorkspaceProjectionInteraction(interactions.rooms, key, control.kind);
  }
  for (const [key, control] of rewardControls) {
    requireWorkspaceProjectionInteraction(interactions.rewards, key, control.kind);
  }
  for (const route of routes) {
    for (const biome of route.biomes) {
      for (const node of biome.nodes) {
        switch (node.kind) {
          case 'occurrenceWorkbench':
            assertWorkspaceRoomInteractionClosure(node.room, interactions);
            break;
          case 'ordinaryBatch':
          case 'mixedBatch':
            if (node.targets.length !== 1) {
              requireWorkspaceProjectionInteraction(
                interactions.exitSelections,
                node.selection.focusKey,
                'exit selection',
              );
            }
            if (node.rewardStore !== undefined) {
              requireWorkspaceProjectionInteraction(
                interactions.batchRewardStores,
                node.rewardStore.focusKey,
                'batch reward store',
              );
            }
            if (node.fieldsCageOutcome !== undefined) {
              requireWorkspaceProjectionInteraction(
                interactions.fieldsCageOutcomes,
                node.fieldsCageOutcome.focusKey,
                'Fields cage outcome',
              );
            }
            requireWorkspaceProjectionInteraction(
              interactions.topologyRemovals,
              workspaceInteractionKey(node.owner),
              'decision topology removal',
            );
            break;
          case 'takeoverBatch':
            if (node.targets.length !== 1) {
              requireWorkspaceProjectionInteraction(
                interactions.exitSelections,
                node.selection.focusKey,
                'exit selection',
              );
            }
            if (node.rewardStore !== undefined) {
              requireWorkspaceProjectionInteraction(
                interactions.batchRewardStores,
                node.rewardStore.focusKey,
                'batch reward store',
              );
            }
            requireWorkspaceProjectionInteraction(
              interactions.takeoverBatches,
              node.takeoverInteractionKey,
              'takeover batch',
            );
            requireWorkspaceProjectionInteraction(
              interactions.topologyRemovals,
              workspaceInteractionKey(node.owner),
              'decision topology removal',
            );
            break;
          case 'hubDecision':
            if (node.authoring !== 'authored') break;
            for (const slot of node.slots) {
              requireWorkspaceProjectionInteraction(
                interactions.hubSlots,
                slot.marker.focusKey,
                'Hub slot',
              );
              const interaction = interactions.hubSlots.get(slot.marker.focusKey);
              if (slot.canClose && interaction?.close === undefined) {
                throw new StructuredWorkspaceProjectionContractError(
                  slot.marker.focusKey + ' closable Hub slot has no exact close interaction',
                );
              }
            }
            for (const visit of node.visits) {
              if (visit.authoring === 'locked') continue;
              requireWorkspaceProjectionInteraction(
                interactions.hubVisits,
                visit.marker.focusKey,
                'Hub visit',
              );
            }
            break;
          case 'linkedExit':
            requireWorkspaceProjectionInteraction(
              interactions.topologyRemovals,
              workspaceInteractionKey(node.owner),
              'linked-exit topology removal',
            );
            break;
          case 'completion':
            break;
        }
      }
      if (biome.entry !== undefined) {
        requireWorkspaceProjectionInteraction(
          interactions.topologyRemovals,
          workspaceInteractionKey(biome.marker.address),
          'biome topology removal',
        );
      }
      for (const node of biome.nodes) {
        if (node.kind !== 'occurrenceWorkbench' || node.sourceDecisionRemoval === undefined) {
          continue;
        }
        requireWorkspaceProjectionInteraction(
          interactions.topologyRemovals,
          node.sourceDecisionRemoval.interactionKey,
          'staged decision removal',
        );
      }
      const frontier = biome.frontier;
      if (frontier === null) continue;
      switch (frontier.kind) {
        case 'start':
          requireWorkspaceProjectionInteraction(
            interactions.starts,
            frontier.interactionKey,
            'start frontier',
          );
          break;
        case 'hubDecision':
          requireWorkspaceProjectionInteraction(
            interactions.structural,
            frontier.interactionKey,
            'Hub creation frontier',
          );
          break;
        case 'exitDecision': {
          const hasDecisionWorkbench = biome.nodes.some(
            (node) =>
              (node.kind === 'linkedExit' ||
                node.kind === 'ordinaryBatch' ||
                node.kind === 'mixedBatch' ||
                node.kind === 'takeoverBatch') &&
              node.marker.focusKey === frontier.marker.focusKey,
          );
          const requiresFrontierActions =
            !hasDecisionWorkbench || frontier.owner.source.kind === 'hubDecision';
          if (!requiresFrontierActions) break;
          const capability = interactions.exitFrontierCapabilities.get(frontier.interactionKey);
          if (capability?.structural !== undefined) {
            const structural = interactions.structural.get(frontier.interactionKey);
            requireWorkspaceProjectionInteraction(
              interactions.structural,
              frontier.interactionKey,
              'exit frontier structural action',
            );
            if (structural?.action !== capability.structural) {
              throw new StructuredWorkspaceProjectionContractError(
                frontier.interactionKey +
                  ' exit frontier structural capability disagrees with its interaction',
              );
            }
          } else if (interactions.structural.has(frontier.interactionKey)) {
            throw new StructuredWorkspaceProjectionContractError(
              frontier.interactionKey + ' exit frontier has an unadvertised structural interaction',
            );
          }
          if (capability?.takeover === true) {
            requireWorkspaceProjectionInteraction(
              interactions.takeoverBatches,
              frontier.interactionKey,
              'exit frontier takeover action',
            );
          } else if (interactions.takeoverBatches.has(frontier.interactionKey)) {
            throw new StructuredWorkspaceProjectionContractError(
              frontier.interactionKey + ' exit frontier has an unadvertised takeover interaction',
            );
          }
          if (capability === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              'exit frontier ' +
                frontier.interactionKey +
                ' has no workspace authoring interaction',
            );
          }
          if (frontier.owner.source.kind === 'hubDecision' && capability.takeover !== true) {
            throw new StructuredWorkspaceProjectionContractError(
              frontier.interactionKey +
                ' Hub handoff frontier has no workspace authoring interaction',
            );
          }
          break;
        }
        case 'hubVisit':
        case 'hubOpenSet':
          break;
      }
    }
  }
}

export interface WorkspaceRequirementInteractionClosureInput {
  readonly batchInteractionRequirements: Iterable<WorkspaceBatchInteractionRequirement>;
  readonly catalog: Catalog;
  readonly frontierInteractionRequirements: Iterable<WorkspaceFrontierInteractionRequirement>;
  readonly hubInteractionRequirements: Iterable<WorkspaceHubInteractionRequirement>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly occurrenceInteractionRequirements: Iterable<WorkspaceOccurrenceInteractionRequirement>;
  readonly startInteractionRequirements: Iterable<WorkspaceStartInteractionRequirement>;
  readonly takeoverInteractionRequirements: Iterable<WorkspaceTakeoverInteractionRequirement>;
  readonly topologyRemovalInteractionRequirements: Iterable<WorkspaceTopologyRemovalInteractionRequirement>;
}

/** Closes every semantic requirement package over its exact bound interaction. */
export function assertWorkspaceRequirementInteractionClosure(
  input: WorkspaceRequirementInteractionClosureInput,
): void {
  const {
    batchInteractionRequirements,
    catalog,
    frontierInteractionRequirements,
    hubInteractionRequirements,
    interactions,
    occurrenceInteractionRequirements,
    startInteractionRequirements,
    takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements,
  } = input;
  assertOccurrenceInteractionRequirementClosure(occurrenceInteractionRequirements, interactions);
  assertBatchInteractionRequirementClosure(batchInteractionRequirements, interactions);
  assertHubInteractionRequirementClosure(hubInteractionRequirements, interactions);
  assertTopologyRemovalInteractionRequirementClosure(
    topologyRemovalInteractionRequirements,
    interactions,
  );
  assertStartInteractionRequirementClosure(startInteractionRequirements, catalog, interactions);
  assertTakeoverInteractionRequirementClosure(
    takeoverInteractionRequirements,
    catalog,
    interactions,
  );
  assertFrontierInteractionRequirementClosure(frontierInteractionRequirements, interactions);
}
