import type {
  StructuredWorkspaceProjection,
  WorkspaceInteractionCatalog,
  WorkspaceNode,
  WorkspaceRoomSummary,
} from '@planner/projections/structured-workspace';
import {
  assertExactObservedInteraction,
  type ObservedOwnedInteraction,
} from './closure-primitives';
import type {
  ExpectedWorkspaceStructuralControl,
  ExpectedWorkspaceStructuralControlKind,
} from './expected-structural-controls';
import { workspaceTestOwnerKey } from './test-keys';

function expectedStructuralInteraction(
  interactions: WorkspaceInteractionCatalog,
  kind: ExpectedWorkspaceStructuralControlKind,
  key: string,
): ObservedOwnedInteraction | undefined {
  switch (kind) {
    case 'batchRewardStore':
      return interactions.batchRewardStores.get(key);
    case 'decisionEntryRoomPicker':
      return interactions.rooms.get(key);
    case 'exitSelection':
      return interactions.exitSelections.get(key);
    case 'fieldsCageOutcome':
      return interactions.fieldsCageOutcomes.get(key);
    case 'hubSlot':
      return interactions.hubSlots.get(key);
    case 'hubVisitOrder':
      return interactions.hubVisitOrders.get(key);
    case 'naturalChaosSpawn':
      return interactions.naturalChaosSpawns.get(key);
    case 'roomPicker':
      return interactions.rooms.get(key);
    case 'start':
      return interactions.starts.get(key);
    case 'takeoverBatch':
      return interactions.takeoverBatches.get(key);
    case 'topologyRemoval':
      return interactions.topologyRemovals.get(key);
    case 'zagreusSpawn':
      return interactions.zagreusSpawns.get(key);
  }
}

/** Close independently expected non-leaf controls over the bound catalog. */
export function assertExpectedWorkspaceStructuralControlClosure(input: {
  readonly expected: readonly ExpectedWorkspaceStructuralControl[];
  readonly interactions: WorkspaceInteractionCatalog;
}): void {
  for (const control of input.expected) {
    const interaction = expectedStructuralInteraction(
      input.interactions,
      control.kind,
      control.key,
    );
    assertExactObservedInteraction(
      interaction,
      control.key,
      control.owner,
      `${control.kind} ${control.key}`,
    );
    if (control.kind === 'decisionEntryRoomPicker') {
      const decisionEntry = input.interactions.rooms.get(control.key);
      if (decisionEntry?.kind !== 'decisionEntryRoom') {
        throw new Error(`${control.kind} ${control.key} has no decision-entry room interaction`);
      }
      if (
        control.decisionOwner === undefined ||
        workspaceTestOwnerKey(decisionEntry.decisionOwner) !==
          workspaceTestOwnerKey(control.decisionOwner)
      ) {
        throw new Error(`${control.kind} ${control.key} has a conflicting decision owner`);
      }
    }
  }
}

function assertRenderedRoomControls(
  room: WorkspaceRoomSummary,
  interactions: WorkspaceInteractionCatalog,
): void {
  const picker = room.roomPicker;
  if (picker !== undefined) {
    const key = workspaceTestOwnerKey(picker.address);
    assertExactObservedInteraction(
      interactions.rooms.get(key),
      key,
      picker.address,
      `room picker ${key}`,
    );
  }
  if (room.zagreusSpawn?.materialized === true) {
    const spawn = room.zagreusSpawn;
    assertExactObservedInteraction(
      interactions.zagreusSpawns.get(spawn.marker.focusKey),
      spawn.marker.focusKey,
      spawn.owner,
      `Zagreus contract ${spawn.marker.focusKey}`,
    );
  }
  if (room.naturalChaosSpawn !== undefined) {
    const spawn = room.naturalChaosSpawn;
    assertExactObservedInteraction(
      interactions.naturalChaosSpawns.get(spawn.marker.focusKey),
      spawn.marker.focusKey,
      spawn.owner,
      `natural Chaos spawn ${spawn.marker.focusKey}`,
    );
  }
}

function unreachable(value: never): never {
  throw new Error(`unknown public workspace product ${JSON.stringify(value)}`);
}

function assertRenderedNodeControls(
  node: WorkspaceNode,
  interactions: WorkspaceInteractionCatalog,
): void {
  switch (node.kind) {
    case 'occurrenceWorkbench':
      assertRenderedRoomControls(node.room, interactions);
      if (node.sourceDecisionRemoval !== undefined) {
        const key = node.sourceDecisionRemoval.interactionKey;
        assertExactObservedInteraction(
          interactions.topologyRemovals.get(key),
          key,
          undefined,
          `staged decision removal ${key}`,
        );
      }
      return;
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch': {
      const ownerKey = workspaceTestOwnerKey(node.owner);
      if (
        !(node.persistence === 'uncommitted' && node.targets.length === 0) &&
        (node.targets.length !== 1 ||
          node.zagreusContract !== undefined ||
          node.naturalChaos !== undefined)
      ) {
        assertExactObservedInteraction(
          interactions.exitSelections.get(node.selection.focusKey),
          node.selection.focusKey,
          node.owner,
          `exit selection ${node.selection.focusKey}`,
        );
      }
      if (node.rewardStore !== undefined) {
        assertExactObservedInteraction(
          interactions.batchRewardStores.get(node.rewardStore.focusKey),
          node.rewardStore.focusKey,
          node.rewardStore.address,
          `batch reward store ${node.rewardStore.focusKey}`,
        );
      }
      if (node.fieldsCageOutcome !== undefined) {
        assertExactObservedInteraction(
          interactions.fieldsCageOutcomes.get(node.fieldsCageOutcome.focusKey),
          node.fieldsCageOutcome.focusKey,
          node.owner,
          `Fields cage outcome ${node.fieldsCageOutcome.focusKey}`,
        );
      }
      if (node.kind === 'takeoverBatch') {
        assertExactObservedInteraction(
          interactions.takeoverBatches.get(node.takeoverInteractionKey),
          node.takeoverInteractionKey,
          node.owner,
          `takeover batch ${node.takeoverInteractionKey}`,
        );
      }
      if (node.zagreusContract !== undefined) {
        const contract = node.zagreusContract;
        const interaction = interactions.zagreusContracts.get(contract.marker.focusKey);
        assertExactObservedInteraction(
          interaction,
          contract.marker.focusKey,
          contract.owner,
          `Zagreus contract ${contract.marker.focusKey}`,
        );
        if (interaction === undefined) {
          throw new Error(`Zagreus contract ${contract.marker.focusKey} has no exact interaction`);
        }
        if (
          interaction.removeIntent.command.kind !== 'RemoveZagreusContract' ||
          workspaceTestOwnerKey(interaction.removeIntent.command.additional) !==
            workspaceTestOwnerKey(contract.owner)
        ) {
          throw new Error(
            `Zagreus contract ${contract.marker.focusKey} has no exact remove intent`,
          );
        }
        if (
          interaction.selectIntent.command.kind !== 'SetExitSelection' ||
          workspaceTestOwnerKey(interaction.selectIntent.command.selection) !==
            workspaceTestOwnerKey(node.selection.address) ||
          interaction.selectIntent.command.value.kind !== 'additional' ||
          interaction.selectIntent.command.value.additionalExitKey !==
            contract.owner.additionalExitKey
        ) {
          throw new Error(
            `Zagreus contract ${contract.marker.focusKey} has no exact select intent`,
          );
        }
      }
      if (node.naturalChaos !== undefined) {
        const chaos = node.naturalChaos;
        const interaction = interactions.naturalChaosExits.get(chaos.marker.focusKey);
        assertExactObservedInteraction(
          interaction,
          chaos.marker.focusKey,
          chaos.owner,
          `natural Chaos ${chaos.marker.focusKey}`,
        );
        if (
          interaction === undefined ||
          interaction.removeIntent.command.kind !== 'RemoveNaturalChaos' ||
          workspaceTestOwnerKey(interaction.removeIntent.command.additional) !==
            workspaceTestOwnerKey(chaos.owner) ||
          interaction.selectIntent.command.kind !== 'SetExitSelection' ||
          workspaceTestOwnerKey(interaction.selectIntent.command.selection) !==
            workspaceTestOwnerKey(node.selection.address) ||
          interaction.selectIntent.command.value.kind !== 'additional' ||
          interaction.selectIntent.command.value.additionalExitKey !==
            chaos.owner.additionalExitKey ||
          interaction.mapIntent(chaos.door.room.gameName).command.kind !==
            'ReplaceNaturalChaosMap' ||
          workspaceTestOwnerKey(
            interaction.mapIntent(chaos.door.room.gameName).command.occurrence,
          ) !== workspaceTestOwnerKey(chaos.door.room.address)
        ) {
          throw new Error(`natural Chaos ${chaos.marker.focusKey} has no exact bound intents`);
        }
        assertRenderedRoomControls(chaos.door.room, interactions);
      }
      if (node.persistence === 'authored') {
        assertExactObservedInteraction(
          interactions.topologyRemovals.get(ownerKey),
          ownerKey,
          node.owner,
          `decision topology removal ${ownerKey}`,
        );
      } else {
        if (interactions.topologyRemovals.has(ownerKey)) {
          throw new Error(`uncommitted decision ${ownerKey} exposes topology removal`);
        }
        if (interactions.exitSelections.has(node.selection.focusKey)) {
          throw new Error(`uncommitted empty decision ${ownerKey} exposes exit selection`);
        }
      }
      for (const target of node.targets) assertRenderedRoomControls(target.room, interactions);
      for (const target of node.missingTargets) {
        const interaction = interactions.rooms.get(target.marker.focusKey);
        if (interaction?.kind !== 'decisionEntryRoom') continue;
        assertExactObservedInteraction(
          interaction,
          target.marker.focusKey,
          target.marker.address,
          `decision-entry room ${target.marker.focusKey}`,
        );
        if (workspaceTestOwnerKey(interaction.decisionOwner) !== ownerKey) {
          throw new Error(
            `decision-entry room ${target.marker.focusKey} has a conflicting decision owner`,
          );
        }
      }
      return;
    }
    case 'hubDecision': {
      assertExactObservedInteraction(
        interactions.topologyRemovals.get(workspaceTestOwnerKey(node.owner)),
        workspaceTestOwnerKey(node.owner),
        node.owner,
        `Hub topology removal ${workspaceTestOwnerKey(node.owner)}`,
      );
      for (const slot of node.slots) {
        assertExactObservedInteraction(
          interactions.hubSlots.get(slot.marker.focusKey),
          slot.marker.focusKey,
          slot.marker.address,
          `Hub slot ${slot.marker.focusKey}`,
        );
        const interaction = interactions.hubSlots.get(slot.marker.focusKey);
        if (slot.canClose && (interaction?.selected !== true || interaction.close === undefined)) {
          throw new Error(
            `${slot.marker.focusKey} closable Hub slot has no exact close interaction`,
          );
        }
      }
      const visitOrderKey = workspaceTestOwnerKey(node.owner);
      const interaction = interactions.hubVisitOrders.get(visitOrderKey);
      assertExactObservedInteraction(
        interaction,
        visitOrderKey,
        node.owner,
        `Hub visit order ${visitOrderKey}`,
      );
      const authoredVisitOrder = node.visits.flatMap((visit) =>
        visit.authoring === 'authored' && visit.hubSlotKey !== undefined ? [visit.hubSlotKey] : [],
      );
      if (
        interaction === undefined ||
        interaction.selectedHubSlotKeys.length !== authoredVisitOrder.length ||
        interaction.selectedHubSlotKeys.some(
          (slotKey, index) => slotKey !== authoredVisitOrder[index],
        )
      ) {
        throw new Error(
          `${visitOrderKey} Hub visit-order interaction disagrees with rendered visits`,
        );
      }
      return;
    }
    default:
      return unreachable(node);
  }
}

/** Close rendered structural affordances over their bound interactions. */
export function assertRenderedWorkspaceStructuralControlClosure(input: {
  readonly interactions: StructuredWorkspaceProjection['interactions'];
  readonly routes: StructuredWorkspaceProjection['routes'];
}): void {
  for (const route of input.routes) {
    for (const biome of route.biomes) {
      for (const node of biome.nodes) assertRenderedNodeControls(node, input.interactions);
      if (biome.entry !== undefined) {
        assertExactObservedInteraction(
          input.interactions.topologyRemovals.get(biome.marker.focusKey),
          biome.marker.focusKey,
          biome.marker.address,
          `biome topology removal ${biome.marker.focusKey}`,
        );
      }
      const frontier = biome.frontier;
      if (frontier === null) continue;
      switch (frontier.kind) {
        case 'start':
          assertExactObservedInteraction(
            input.interactions.starts.get(frontier.interactionKey),
            frontier.interactionKey,
            frontier.owner,
            `start frontier ${frontier.interactionKey}`,
          );
          break;
        case 'exitDecision':
          if (frontier.provisionalBatch !== undefined) {
            assertRenderedNodeControls(frontier.provisionalBatch, input.interactions);
          }
          break;
        case 'hubOpenSet':
        case 'hubVisit':
          break;
        default:
          unreachable(frontier);
      }
    }
  }
}
