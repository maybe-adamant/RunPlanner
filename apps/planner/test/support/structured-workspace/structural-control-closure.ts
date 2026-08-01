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
  kind: Exclude<ExpectedWorkspaceStructuralControlKind, 'exitFrontierCapability'>,
  key: string,
): ObservedOwnedInteraction | undefined {
  switch (kind) {
    case 'batchRewardStore':
      return interactions.batchRewardStores.get(key);
    case 'exitSelection':
      return interactions.exitSelections.get(key);
    case 'fieldsCageOutcome':
      return interactions.fieldsCageOutcomes.get(key);
    case 'hubSlot':
      return interactions.hubSlots.get(key);
    case 'hubVisit':
      return interactions.hubVisits.get(key);
    case 'roomPicker':
      return interactions.rooms.get(key);
    case 'start':
      return interactions.starts.get(key);
    case 'structural':
      return interactions.structural.get(key);
    case 'takeoverBatch':
      return interactions.takeoverBatches.get(key);
    case 'topologyRemoval':
      return interactions.topologyRemovals.get(key);
  }
}

/** Close independently expected non-leaf controls over the bound catalog. */
export function assertExpectedWorkspaceStructuralControlClosure(input: {
  readonly expected: readonly ExpectedWorkspaceStructuralControl[];
  readonly interactions: WorkspaceInteractionCatalog;
}): void {
  for (const control of input.expected) {
    if (control.kind === 'exitFrontierCapability') {
      if (input.interactions.exitFrontierCapabilities.get(control.key) === undefined) {
        throw new Error(`${control.kind} ${control.key} has no exact workspace interaction`);
      }
      continue;
    }
    assertExactObservedInteraction(
      expectedStructuralInteraction(input.interactions, control.kind, control.key),
      control.key,
      control.owner,
      `${control.kind} ${control.key}`,
    );
  }
}

function assertRenderedRoomControls(
  room: WorkspaceRoomSummary,
  interactions: WorkspaceInteractionCatalog,
): void {
  const picker = room.roomPicker;
  if (picker === undefined) return;
  const key = workspaceTestOwnerKey(picker.address);
  assertExactObservedInteraction(
    interactions.rooms.get(key),
    key,
    picker.address,
    `room picker ${key}`,
  );
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
    case 'linkedExit': {
      const key = workspaceTestOwnerKey(node.owner);
      assertExactObservedInteraction(
        interactions.topologyRemovals.get(key),
        key,
        node.owner,
        `linked-exit topology removal ${key}`,
      );
      return;
    }
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch': {
      const ownerKey = workspaceTestOwnerKey(node.owner);
      if (node.targets.length !== 1) {
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
      assertExactObservedInteraction(
        interactions.topologyRemovals.get(ownerKey),
        ownerKey,
        node.owner,
        `decision topology removal ${ownerKey}`,
      );
      for (const target of node.targets) assertRenderedRoomControls(target.room, interactions);
      return;
    }
    case 'hubDecision':
      if (node.authoring !== 'authored') return;
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
      for (const visit of node.visits) {
        if (visit.authoring === 'locked') continue;
        const interaction = interactions.hubVisits.get(visit.marker.focusKey);
        assertExactObservedInteraction(
          interaction,
          visit.marker.focusKey,
          visit.marker.address,
          `Hub visit ${visit.marker.focusKey}`,
        );
        if (visit.authoring === 'authored' && interaction?.removal === undefined) {
          throw new Error(
            `${visit.marker.focusKey} authored Hub visit has no exact removal interaction`,
          );
        }
      }
      return;
    case 'completion':
      return;
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
        case 'hubDecision':
          assertExactObservedInteraction(
            input.interactions.structural.get(frontier.interactionKey),
            frontier.interactionKey,
            frontier.owner,
            `Hub creation frontier ${frontier.interactionKey}`,
          );
          break;
        case 'exitDecision': {
          const capability = input.interactions.exitFrontierCapabilities.get(
            frontier.interactionKey,
          );
          if (capability?.structural !== undefined) {
            assertExactObservedInteraction(
              input.interactions.structural.get(frontier.interactionKey),
              frontier.interactionKey,
              frontier.owner,
              `exit frontier structural action ${frontier.interactionKey}`,
            );
          }
          if (capability?.takeover === true) {
            assertExactObservedInteraction(
              input.interactions.takeoverBatches.get(frontier.interactionKey),
              frontier.interactionKey,
              frontier.owner,
              `exit frontier takeover action ${frontier.interactionKey}`,
            );
          }
          break;
        }
        case 'hubOpenSet':
        case 'hubVisit':
          break;
        default:
          unreachable(frontier);
      }
    }
  }
}
