import type { SemanticAddress } from '@run-planner/engine/authored-project';

import type {
  WorkspaceHubDecisionNode,
  WorkspaceLinkedExitNode,
  WorkspaceMixedBatchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceTakeoverBatchNode,
} from '@planner/projections/structured-workspace';
import { assertObservedOwner } from './closure-primitives';
import type { ExpectedWorkspaceTopologyManifest } from './expected-topology';
import type { ObservedWorkspaceProducts } from './observed-workspace';
import { workspaceTestOwnerKey } from './test-keys';

type ObservedExitDecisionNode =
  | WorkspaceLinkedExitNode
  | WorkspaceMixedBatchNode
  | WorkspaceOrdinaryBatchNode
  | WorkspaceTakeoverBatchNode;

function exactlyOne<T>(values: readonly T[], detail: string): T {
  if (values.length !== 1) {
    throw new Error(`${detail} resolves to ${values.length} workspace products instead of one`);
  }
  return values[0]!;
}

function addressMatches(left: SemanticAddress, right: SemanticAddress): boolean {
  return workspaceTestOwnerKey(left) === workspaceTestOwnerKey(right);
}

function observedExitDecision(
  observed: ObservedWorkspaceProducts,
  address: SemanticAddress,
): ObservedExitDecisionNode {
  return exactlyOne(
    observed.nodes.filter(
      (node): node is ObservedExitDecisionNode =>
        (node.kind === 'linkedExit' ||
          node.kind === 'ordinaryBatch' ||
          node.kind === 'mixedBatch' ||
          node.kind === 'takeoverBatch') &&
        addressMatches(node.owner, address),
    ),
    `${workspaceTestOwnerKey(address)} decision`,
  );
}

function observedHubDecision(
  observed: ObservedWorkspaceProducts,
  address: SemanticAddress,
): WorkspaceHubDecisionNode {
  return exactlyOne(
    observed.nodes.filter(
      (node): node is WorkspaceHubDecisionNode =>
        node.kind === 'hubDecision' && addressMatches(node.owner, address),
    ),
    `${workspaceTestOwnerKey(address)} Hub`,
  );
}

/** Close independent authored topology owners over typed public products. */
export function assertExpectedWorkspaceTopologyClosure(input: {
  readonly expected: ExpectedWorkspaceTopologyManifest;
  readonly observed: ObservedWorkspaceProducts;
}): void {
  for (const occurrence of input.expected.occurrences) {
    const packages = input.observed.roomPackagesByOccurrence.get(occurrence.occurrenceId);
    if (packages === undefined || packages.length === 0) {
      throw new Error(
        `${occurrence.detail} occurrence ${occurrence.occurrenceId} has no reachable workspace room package`,
      );
    }
    const conflictingPackage = packages.find(
      (roomPackage) => roomPackage.room.gameName !== occurrence.gameName,
    );
    if (conflictingPackage !== undefined) {
      throw new Error(
        `${occurrence.detail} occurrence ${occurrence.occurrenceId} projects ${conflictingPackage.room.gameName} instead of ${occurrence.gameName}`,
      );
    }
    assertObservedOwner(
      occurrence.address,
      input.observed,
      `${occurrence.detail} occurrence ${occurrence.occurrenceId}`,
      true,
    );
  }

  for (const decision of input.expected.exitDecisions) {
    const node = observedExitDecision(input.observed, decision.address);
    if (
      (decision.decision.normal.kind === 'linked' && node.kind !== 'linkedExit') ||
      (decision.decision.normal.kind === 'batch' && node.kind === 'linkedExit')
    ) {
      throw new Error(
        `${workspaceTestOwnerKey(decision.address)} projects the wrong decision kind`,
      );
    }
    assertObservedOwner(
      decision.address,
      input.observed,
      `${workspaceTestOwnerKey(decision.address)} decision`,
    );
  }

  for (const target of input.expected.targets) {
    const node = observedExitDecision(input.observed, target.decisionAddress);
    if (target.sourceKind === 'linked') {
      if (
        node.kind !== 'linkedExit' ||
        node.target.exitKey !== target.exitKey ||
        node.target.room.occurrenceId !== target.occurrenceId
      ) {
        throw new Error(
          `${workspaceTestOwnerKey(target.decisionAddress)} omits its authored linked target`,
        );
      }
    } else {
      if (node.kind === 'linkedExit') {
        throw new Error(
          `${workspaceTestOwnerKey(target.decisionAddress)} projects a linked exit for an authored batch`,
        );
      }
      const projectedTarget = exactlyOne(
        node.targets.filter((candidate) => candidate.exitKey === target.exitKey),
        `${workspaceTestOwnerKey(target.decisionAddress)} target ${target.exitKey}`,
      );
      if (projectedTarget.room.occurrenceId !== target.occurrenceId) {
        throw new Error(
          `${workspaceTestOwnerKey(target.decisionAddress)} target ${target.exitKey} omits its authored occurrence`,
        );
      }
    }
    assertObservedOwner(
      target.address,
      input.observed,
      `${workspaceTestOwnerKey(target.decisionAddress)} target ${target.exitKey}`,
      true,
    );
  }

  for (const decision of input.expected.hubDecisions) {
    observedHubDecision(input.observed, decision.address);
    assertObservedOwner(
      decision.address,
      input.observed,
      `${workspaceTestOwnerKey(decision.address)} Hub`,
    );
  }

  for (const slot of input.expected.hubSlots) {
    const hub = observedHubDecision(input.observed, slot.hubAddress);
    const projectedSlot = exactlyOne(
      hub.slots.filter((candidate) => candidate.hubSlotKey === slot.hubSlotKey),
      `${workspaceTestOwnerKey(slot.hubAddress)} slot ${slot.hubSlotKey}`,
    );
    if (projectedSlot.open !== true || projectedSlot.room?.occurrenceId !== slot.occurrenceId) {
      throw new Error(
        `${workspaceTestOwnerKey(slot.hubAddress)} slot ${slot.hubSlotKey} omits its authored occurrence`,
      );
    }
    assertObservedOwner(
      slot.address,
      input.observed,
      `${workspaceTestOwnerKey(slot.hubAddress)} slot ${slot.hubSlotKey}`,
      true,
    );
  }

  for (const visit of input.expected.hubVisits) {
    const hub = observedHubDecision(input.observed, visit.hubAddress);
    const projectedVisit = exactlyOne(
      hub.visits.filter((candidate) => candidate.visitIndex === visit.visitIndex),
      `${workspaceTestOwnerKey(visit.hubAddress)} visit ${visit.visitIndex}`,
    );
    if (projectedVisit.authoring !== 'authored' || projectedVisit.hubSlotKey !== visit.hubSlotKey) {
      throw new Error(
        `${workspaceTestOwnerKey(visit.hubAddress)} visit ${visit.visitIndex} omits authored order`,
      );
    }
    assertObservedOwner(
      visit.address,
      input.observed,
      `${workspaceTestOwnerKey(visit.hubAddress)} visit ${visit.visitIndex}`,
      true,
    );
  }
}
