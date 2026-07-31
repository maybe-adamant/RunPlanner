import {
  createExitDecisionAddress,
  createHubDecisionAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type OccurrenceId,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';

import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceAuthoredLeafRequirement,
  type WorkspaceHubDecisionNode,
  type WorkspaceInspectorDestination,
  type WorkspaceLinkedExitNode,
  type WorkspaceMarker,
  type WorkspaceMixedBatchNode,
  type WorkspaceNode,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceTakeoverBatchNode,
} from '../contract';
import {
  workspaceDecisionOwnedMarkers,
  type WorkspaceDecisionBatchNode,
} from '../decision-assembly';
import { workspaceHubMainRewardMarker } from '../hub-assembly';
import { workspaceOccurrenceOwnedMarkers } from '../occurrence-assembly';

function workspaceMarkersForNode(node: WorkspaceNode): readonly WorkspaceMarker[] {
  switch (node.kind) {
    case 'linkedExit':
      return Object.freeze([
        node.marker,
        node.target.marker,
        ...workspaceOccurrenceOwnedMarkers(node.target.room),
      ]);
    case 'ordinaryBatch':
    case 'mixedBatch':
    case 'takeoverBatch':
      return workspaceDecisionOwnedMarkers(node);
    case 'hubDecision':
      return Object.freeze([
        node.marker,
        node.openSet,
        ...node.slots.map((slot) => slot.marker),
        ...node.visits.map((visit) => visit.marker),
        ...node.slots.flatMap((slot) => {
          const mainReward =
            slot.room === undefined ? undefined : workspaceHubMainRewardMarker(slot.room);
          return mainReward === undefined ? [] : [mainReward];
        }),
      ]);
    case 'occurrenceWorkbench':
      return workspaceOccurrenceOwnedMarkers(node.room);
    case 'completion':
      return Object.freeze([node.marker]);
  }
}

export function isFineGrainedFindingOwner(address: SemanticAddress): boolean {
  switch (address.kind) {
    case 'batchRewardStore':
    case 'exitSelection':
    case 'target':
    case 'occurrence':
    case 'incomingReward':
    case 'localReward':
    case 'localChild':
    case 'localChildGroup':
    case 'rewardWheel':
    case 'rewardWheelOffer':
    case 'hubSlot':
    case 'hubVisit':
    case 'shopOffer':
    case 'shopPurchase':
      return true;
    default:
      return false;
  }
}

function assertWorkspaceMarkerDestination(
  focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>,
  nodesByKey: ReadonlyMap<string, WorkspaceNode>,
  containingNodeKeys: ReadonlySet<string>,
  marker: WorkspaceMarker,
  detail: string,
): void {
  const destination = focusByOwner.get(marker.focusKey);
  if (destination === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${marker.focusKey} has no workspace focus destination`,
    );
  }
  if (semanticAddressKey(destination.ownerAddress) !== marker.focusKey) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${marker.focusKey} is registered with a conflicting focus owner`,
    );
  }
  if (destination.region !== 'structure' || !nodesByKey.has(destination.nodeKey)) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${marker.focusKey} does not resolve to a reachable workspace node`,
    );
  }
  if (!containingNodeKeys.has(destination.nodeKey)) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} ${marker.focusKey} does not resolve to a containing workspace package`,
    );
  }
}

function exactlyOneWorkspaceValue<TValue>(values: readonly TValue[], detail: string): TValue {
  if (values.length !== 1) {
    throw new StructuredWorkspaceProjectionContractError(
      `${detail} resolves to ${values.length} workspace values instead of one`,
    );
  }
  return values[0]!;
}

interface WorkspaceMarkerPackageIndex {
  readonly markerPackageKeys: Map<string, Set<string>>;
  readonly markersByOwner: Map<string, WorkspaceMarker>;
  readonly nodesByKey: Map<string, WorkspaceNode>;
}

function workspaceMarkerPackageIndex(
  structuralNodes: readonly WorkspaceNode[],
  detail: string,
): WorkspaceMarkerPackageIndex {
  const nodesByKey = new Map<string, WorkspaceNode>();
  const markersByOwner = new Map<string, WorkspaceMarker>();
  const markerPackageKeys = new Map<string, Set<string>>();
  for (const node of structuralNodes) {
    if (nodesByKey.has(node.key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${detail} projects duplicate workspace node ${node.key}`,
      );
    }
    nodesByKey.set(node.key, node);
  }
  for (const node of structuralNodes) {
    for (const workspaceMarker of workspaceMarkersForNode(node)) {
      const prior = markersByOwner.get(workspaceMarker.focusKey);
      if (
        prior !== undefined &&
        semanticAddressKey(prior.address) !== semanticAddressKey(workspaceMarker.address)
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${detail} projects conflicting marker packages for ${workspaceMarker.focusKey}`,
        );
      }
      markersByOwner.set(workspaceMarker.focusKey, workspaceMarker);
      const packages = markerPackageKeys.get(workspaceMarker.focusKey) ?? new Set<string>();
      packages.add(node.key);
      markerPackageKeys.set(workspaceMarker.focusKey, packages);
    }
  }
  return { markerPackageKeys, markersByOwner, nodesByKey };
}

/**
 * The workspace is a semantic adapter over authored topology. This closes the
 * adapter contract before findings are allowed to use a coarse biome fallback:
 * every persisted owner must have one rendered package and every published
 * marker must lead to a real structural node.
 */
export function assertWorkspaceProjectionClosure(
  biome: BiomeAddress,
  findings: readonly SemanticFinding[],
  focusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>,
  plan: AuthoredBiomePlan,
  structuralNodes: readonly WorkspaceNode[],
): void {
  const { markerPackageKeys, markersByOwner, nodesByKey } = workspaceMarkerPackageIndex(
    structuralNodes,
    plan.biomeKey,
  );
  for (const node of structuralNodes) {
    if (node.kind !== 'occurrenceWorkbench' || node.sourceDecisionRemoval === undefined) {
      continue;
    }
    const source = structuralNodes.find(
      (candidate): candidate is WorkspaceLinkedExitNode | WorkspaceDecisionBatchNode =>
        (candidate.kind === 'linkedExit' ||
          candidate.kind === 'ordinaryBatch' ||
          candidate.kind === 'mixedBatch' ||
          candidate.kind === 'takeoverBatch') &&
        candidate.marker.focusKey === node.sourceDecisionRemoval!.interactionKey,
    );
    if (source === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${node.sourceDecisionRemoval.interactionKey} has no source decision package`,
      );
    }
    for (const workspaceMarker of workspaceMarkersForNode(source)) {
      const packages = markerPackageKeys.get(workspaceMarker.focusKey);
      if (packages === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${workspaceMarker.focusKey} has no registered source marker package`,
        );
      }
      packages.add(node.key);
    }
  }
  for (const [owner, workspaceMarker] of markersByOwner) {
    assertWorkspaceMarkerDestination(
      focusDestinations,
      nodesByKey,
      markerPackageKeys.get(owner)!,
      workspaceMarker,
      plan.biomeKey,
    );
  }

  const topology = plan.topology;
  if (topology !== null) {
    const occurrenceNodes = new Map<OccurrenceId, WorkspaceOccurrenceWorkbenchNode>();
    for (const occurrence of topology.occurrences) {
      const occurrenceNode = exactlyOneWorkspaceValue(
        structuralNodes.filter(
          (node): node is WorkspaceOccurrenceWorkbenchNode =>
            node.kind === 'occurrenceWorkbench' &&
            node.room.occurrenceId === occurrence.occurrenceId,
        ),
        `${plan.biomeKey} occurrence ${occurrence.occurrenceId}`,
      );
      if (occurrenceNode.room.gameName !== occurrence.gameName) {
        throw new StructuredWorkspaceProjectionContractError(
          `${plan.biomeKey} occurrence ${occurrence.occurrenceId} projects a different room declaration`,
        );
      }
      occurrenceNodes.set(occurrence.occurrenceId, occurrenceNode);
    }

    for (const decision of topology.decisions) {
      if (decision.kind === 'hub') {
        const owner = createHubDecisionAddress(biome, decision.hubKey);
        const hub = exactlyOneWorkspaceValue(
          structuralNodes.filter(
            (node): node is WorkspaceHubDecisionNode =>
              node.kind === 'hubDecision' &&
              semanticAddressKey(node.owner) === semanticAddressKey(owner),
          ),
          `${plan.biomeKey} Hub ${decision.hubKey}`,
        );
        for (const target of decision.openTargets) {
          const slot = exactlyOneWorkspaceValue(
            hub.slots.filter((candidate) => candidate.hubSlotKey === target.hubSlotKey),
            `${semanticAddressKey(owner)} slot ${target.hubSlotKey}`,
          );
          if (!slot.open || slot.room?.occurrenceId !== target.occurrenceId) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(owner)} slot ${target.hubSlotKey} does not project its authored occurrence`,
            );
          }
        }
        for (const [index, slotKey] of decision.visitOrder.entries()) {
          const visit = exactlyOneWorkspaceValue(
            hub.visits.filter((candidate) => candidate.visitIndex === index + 1),
            `${semanticAddressKey(owner)} visit ${index + 1}`,
          );
          if (visit.authoring !== 'authored' || visit.hubSlotKey !== slotKey) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(owner)} visit ${index + 1} does not project authored order`,
            );
          }
        }
        continue;
      }

      const owner = createExitDecisionAddress(biome, decision.source);
      const decisionNode = exactlyOneWorkspaceValue(
        structuralNodes.filter(
          (
            node,
          ): node is
            | WorkspaceLinkedExitNode
            | WorkspaceOrdinaryBatchNode
            | WorkspaceMixedBatchNode
            | WorkspaceTakeoverBatchNode =>
            node.kind !== 'hubDecision' &&
            node.kind !== 'occurrenceWorkbench' &&
            node.kind !== 'completion' &&
            semanticAddressKey(node.owner) === semanticAddressKey(owner),
        ),
        `${semanticAddressKey(owner)} decision`,
      );
      if (decision.normal.kind === 'linked') {
        if (
          decisionNode.kind !== 'linkedExit' ||
          decisionNode.target.exitKey !== decision.normal.exitKey ||
          decisionNode.target.room.occurrenceId !== decision.normal.occurrenceId
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(owner)} does not project its authored linked target`,
          );
        }
        continue;
      }
      if (decisionNode.kind === 'linkedExit') {
        throw new StructuredWorkspaceProjectionContractError(
          `${semanticAddressKey(owner)} projects a linked exit for an authored batch`,
        );
      }
      for (const target of decision.normal.targets) {
        const projectedTarget = exactlyOneWorkspaceValue(
          decisionNode.targets.filter((candidate) => candidate.exitKey === target.exitKey),
          `${semanticAddressKey(owner)} target ${target.exitKey}`,
        );
        if (projectedTarget.room.occurrenceId !== target.occurrenceId) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(owner)} target ${target.exitKey} projects a different occurrence`,
          );
        }
        if (!occurrenceNodes.has(target.occurrenceId)) {
          throw new StructuredWorkspaceProjectionContractError(
            `${semanticAddressKey(owner)} target ${target.exitKey} has no occurrence workbench`,
          );
        }
      }
    }
  }

  for (const finding of findings) {
    if (!isFineGrainedFindingOwner(finding.origin)) continue;
    const workspaceMarker = markersByOwner.get(semanticAddressKey(finding.origin));
    if (workspaceMarker === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(finding.origin)} finding has no exact workspace marker`,
      );
    }
    assertWorkspaceMarkerDestination(
      focusDestinations,
      nodesByKey,
      markerPackageKeys.get(workspaceMarker.focusKey)!,
      workspaceMarker,
      `${semanticAddressKey(finding.origin)} finding`,
    );
  }
}

/**
 * Checks the rendered side of the authored leaf contract before findings can
 * use generic destination fallback. The expected requirements are produced
 * solely from authored state and declarations by `authoredWorkspaceLeafRequirements`.
 */
export function assertAuthoredWorkspaceLeafProjectionClosure(
  requirements: readonly WorkspaceAuthoredLeafRequirement[],
  focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>,
  structuralNodes: readonly WorkspaceNode[],
): void {
  const { markerPackageKeys, markersByOwner, nodesByKey } = workspaceMarkerPackageIndex(
    structuralNodes,
    'authored leaf audit',
  );
  for (const requirement of requirements) {
    const key = semanticAddressKey(requirement.address);
    const workspaceMarker = markersByOwner.get(key);
    if (workspaceMarker === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored leaf has no workspace marker`,
      );
    }
    if (semanticAddressKey(workspaceMarker.address) !== key) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored leaf resolves to a conflicting workspace marker`,
      );
    }
    assertWorkspaceMarkerDestination(
      focusByOwner,
      nodesByKey,
      markerPackageKeys.get(key)!,
      workspaceMarker,
      'required authored leaf',
    );
  }
}
