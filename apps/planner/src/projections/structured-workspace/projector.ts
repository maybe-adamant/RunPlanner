import {
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  declaredPhysicalExits as resolveDeclaredPhysicalExits,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
  describeHubSlotClosureImpact,
  fixedWidthOneTakeoverForLayout,
  fixedWidthOneTakeoverTransitionForSource,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BatchRewardStoreAddress,
  type BiomeAddress,
  type ExitDecision,
  type ExitDecisionAddress,
  type HubDecision,
  type HubDecisionAddress,
  type HubSlotAddress,
  type HubVisitAddress,
  type OccurrenceId,
  type ProjectDocument,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';
import type { ProjectEvaluation, SemanticFinding } from '@run-planner/engine/simulation';
import {
  assertProjectEvaluationSource,
  evaluateBiomeCompleteness,
} from '@run-planner/engine/simulation';

import {
  requireWorkspaceRoom as requireRoom,
  resolveWorkspaceFixedRewardOffer,
} from './catalog-room';
import {
  appendUniqueFocusDestinations,
  appendUniqueRewardControls,
  appendUniqueRoomControls,
} from './assembly-products';
import { assembleWorkspaceBiomeSemantics } from './biome-semantic-assembly';
import { workspaceHubMainRewardMarker } from './hub-assembly';
import {
  StructuredWorkspaceProjectionContractError,
  workspaceInteractionKey,
  workspaceSideRoomEntryOrderKey,
} from './contract';
import { createWorkspaceProjectSourceIndex, type WorkspaceBiomeSource } from './source-index';
import { type WorkspaceBiomeOccurrenceAssemblyFacts } from './occurrence-facts';
import { workspaceOccurrenceOwnedMarkers } from './occurrence-assembly';
import {
  workspaceDecisionOwnedMarkers,
  type WorkspaceDecisionBatchNode,
} from './decision-assembly';
import { bindWorkspaceInteractions } from './interaction-binding';
import {
  assertWorkspaceDefaultInspectorDestinationClosure,
  defaultInspectorDestination,
} from './inspector-defaults';
import { bindWorkspaceInspectorDestinations } from './inspector-destinations';
import {
  appendUniqueBatchInteractionRequirements,
  appendUniqueFrontierInteractionRequirements,
  appendUniqueHubInteractionRequirements,
  appendUniqueOccurrenceInteractionRequirements,
  appendUniqueStartInteractionRequirements,
  appendUniqueTakeoverInteractionRequirements,
  appendUniqueTopologyRemovalInteractionRequirements,
  type WorkspaceBatchInteractionRequirement,
  type WorkspaceExitFrontierStructuralRequirement,
  type WorkspaceFrontierInteractionRequirement,
  type WorkspaceHubInteractionRequirement,
  type WorkspaceOccurrenceInteractionRequirement,
  type WorkspaceStartInteractionRequirement,
  type WorkspaceTakeoverInteractionRequirement,
  type WorkspaceTopologyRemovalInteractionRequirement,
} from './interaction-requirements';
import { workspaceRoomTakesOverNormalDoors } from './room-policy';
import {
  workspaceRemovalScopeForRoots,
  workspaceTopologyRemovalScope,
} from './topology-presentation';
import type {
  StructuredWorkspaceContextualServices,
  StructuredWorkspaceProjection,
  StructuredWorkspaceProjectionService,
  WorkspaceAuthoredLeafInteractionKind,
  WorkspaceAuthoredLeafInteractionRequirement,
  WorkspaceAuthoredLeafRequirement,
  WorkspaceBiome,
  WorkspaceCandidateInteraction,
  WorkspaceExitFrontierCapabilities,
  WorkspaceHubDecisionNode,
  WorkspaceHubRailEntry,
  WorkspaceHubSlotInteraction,
  WorkspaceHubVisitRailEntry,
  WorkspaceInspectorDestination,
  WorkspaceInteractionCatalog,
  WorkspaceInteractionChoice,
  WorkspaceLinkedExitNode,
  WorkspaceMarker,
  WorkspaceMixedBatchNode,
  WorkspaceNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceRailEntry,
  WorkspaceRewardControl,
  WorkspaceRoomPickerControl,
  WorkspaceRoomSummary,
  WorkspaceRoute,
  WorkspaceStatus,
  WorkspaceStructuralInteraction,
  WorkspaceTakeoverBatchNode,
  WorkspaceTakeoverReplacementImpact,
  WorkspaceTopologyRemovalInteraction,
  WorkspaceTopologyRemovalScope,
} from './contract';

type AuthoredBatchDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
};
type AuthoredBatchTarget = AuthoredBatchDecision['normal']['targets'][number];

function authoredTargetIsSelected(
  decision: AuthoredBatchDecision,
  target: AuthoredBatchTarget,
): boolean {
  if (decision.selection.kind === 'normal') {
    return decision.selection.exitKey === target.exitKey;
  }
  return (
    decision.selection.kind === 'derived' && decision.normal.targets[0]?.exitKey === target.exitKey
  );
}

/**
 * Detail activation is an authored relationship. It is intentionally derived
 * from topology alone so a blocked or invalid evaluator prefix cannot remove
 * an active room's declaration-owned lifecycle surface.
 */
function expectedDetailsActiveOccurrenceIds(plan: AuthoredBiomePlan): ReadonlySet<OccurrenceId> {
  const active = new Set<OccurrenceId>();
  const topology = plan.topology;
  if (topology === null) return active;
  active.add(topology.startOccurrenceId);
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      for (const slotKey of decision.visitOrder) {
        const target = decision.openTargets.find((candidate) => candidate.hubSlotKey === slotKey);
        if (target !== undefined) active.add(target.occurrenceId);
      }
      continue;
    }
    if (decision.normal.kind === 'linked') {
      active.add(decision.normal.occurrenceId);
      continue;
    }
    const target = decision.normal.targets.find((candidate) =>
      authoredTargetIsSelected(decision as AuthoredBatchDecision, candidate),
    );
    if (target !== undefined) active.add(target.occurrenceId);
  }
  return active;
}

interface MutableWorkspaceAuthoredLeafRequirement {
  readonly address: SemanticAddress;
  readonly interactions: Map<
    WorkspaceAuthoredLeafInteractionKind,
    WorkspaceAuthoredLeafInteractionRequirement
  >;
}

function authoredLeafInteraction(
  kind: WorkspaceAuthoredLeafInteractionKind,
  key: string,
): WorkspaceAuthoredLeafInteractionRequirement {
  return Object.freeze({ key, kind });
}

/**
 * Enumerates the leaf contract from persisted room state and declarations.
 *
 * This must stay independent of workspace products: it is the expected side
 * of the closure audit. It includes offer-time values for all authored
 * occurrences, while Ephyra side details and Shop inventory remain dormant
 * until their room is on an authored active detail path.
 */
export function authoredWorkspaceLeafRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
): readonly WorkspaceAuthoredLeafRequirement[] {
  const required = new Map<string, MutableWorkspaceAuthoredLeafRequirement>();
  const requireLeaf = (
    address: SemanticAddress,
    ...interactions: readonly WorkspaceAuthoredLeafInteractionRequirement[]
  ): void => {
    const key = semanticAddressKey(address);
    let requirement = required.get(key);
    if (requirement === undefined) {
      requirement = {
        address,
        interactions: new Map(),
      };
      required.set(key, requirement);
    }
    for (const interaction of interactions) {
      const existing = requirement.interactions.get(interaction.kind);
      if (existing !== undefined && existing.key !== interaction.key) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} has conflicting authored ${interaction.kind} interaction requirements`,
        );
      }
      requirement.interactions.set(interaction.kind, interaction);
    }
  };
  const requireReward = (address: SemanticAddress): void =>
    requireLeaf(address, authoredLeafInteraction('reward', semanticAddressKey(address)));
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const detailsActive = expectedDetailsActiveOccurrenceIds(plan);
  for (const occurrence of topology.occurrences) {
    const room = requireRoom(catalog, occurrence.gameName);
    const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
    const incoming = createIncomingRewardAddress(biome, occurrence.occurrenceId);
    switch (occurrence.state.kind) {
      case 'none':
        break;
      case 'fixed': {
        const offer = resolveWorkspaceFixedRewardOffer(room, occurrence.state);
        const rewardType = catalog.rewards.rewardTypes.byKey[offer.rewardType];
        requireLeaf(
          incoming,
          ...(rewardType?.payloadDomain === undefined
            ? []
            : [authoredLeafInteraction('reward', semanticAddressKey(incoming))]),
        );
        break;
      }
      case 'counted':
      case 'freeReward':
        requireReward(incoming);
        break;
      case 'ephyraCombat': {
        requireReward(incoming);
        // Main rewards are offer-time data. The side-room lifecycle is
        // picked-room customization, so an unvisited Hub room retains it as
        // dormant state rather than publishing editable children.
        if (!detailsActive.has(occurrence.occurrenceId)) break;
        const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
        if (group === undefined && Object.keys(occurrence.state.sideRooms).length === 0) break;
        if (group?.kind !== 'fixedRoomSlots') {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ephyra state has no fixed side-room declaration`,
          );
        }
        requireLeaf(createLocalChildGroupAddress(biome, occurrence.occurrenceId, group.key));
        for (const slot of group.slots) {
          const sideAddress = createLocalChildAddress(
            biome,
            occurrence.occurrenceId,
            group.key,
            slot.slotKey,
          );
          requireLeaf(
            sideAddress,
            authoredLeafInteraction('sideRoomGeneration', semanticAddressKey(sideAddress)),
            authoredLeafInteraction(
              'sideRoomEntryOrder',
              workspaceSideRoomEntryOrderKey(sideAddress),
            ),
          );
          requireReward(
            createLocalRewardAddress(biome, occurrence.occurrenceId, group.key, slot.slotKey),
          );
        }
        break;
      }
      case 'fieldsCombat': {
        const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
        if (group?.kind !== 'boundedRewardSlots') {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Fields state has no bounded cage declaration`,
          );
        }
        for (const slotKey of group.slotKeys) {
          requireReward(
            createLocalRewardAddress(biome, occurrence.occurrenceId, group.key, slotKey),
          );
        }
        break;
      }
      case 'shipCombat': {
        const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
        if (profile === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state has no encounter profile`,
          );
        }
        requireLeaf(
          occurrenceAddress,
          authoredLeafInteraction('shipEncounterCount', semanticAddressKey(occurrenceAddress)),
        );
        for (const phase of profile.phases) {
          const wheel = phase.offerPoint;
          if (wheel === undefined) continue;
          const wheelAddress = createRewardWheelAddress(biome, occurrence.occurrenceId, wheel.key);
          const wheelKey = semanticAddressKey(wheelAddress);
          requireLeaf(
            wheelAddress,
            authoredLeafInteraction('rewardWheelOfferCount', wheelKey),
            authoredLeafInteraction('rewardWheelStore', wheelKey),
            authoredLeafInteraction('rewardWheelPick', wheelKey),
          );
          for (const offerKey of wheel.offerKeys) {
            requireReward(
              createRewardWheelOfferAddress(biome, occurrence.occurrenceId, wheel.key, offerKey),
            );
          }
        }
        break;
      }
      case 'shop': {
        // A persisted unpicked Shop inventory is deliberately dormant. A
        // selected-but-unassessed Shop is active because this checks authored
        // detail activation rather than evaluator entry.
        if (!detailsActive.has(occurrence.occurrenceId) || occurrence.state.shop === undefined) {
          break;
        }
        const profile = catalog.rewards.shops.byKey[occurrence.state.shop.profileKey];
        if (profile === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop profile ${occurrence.state.shop.profileKey} is missing`,
          );
        }
        for (const slot of profile.slots.values) {
          const offer = createShopOfferAddress(biome, occurrence.occurrenceId, slot.key);
          requireReward(offer);
          requireLeaf(
            createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key),
            authoredLeafInteraction(
              'shopPurchase',
              semanticAddressKey(
                createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key),
              ),
            ),
          );
        }
        break;
      }
    }
  }
  return Object.freeze(
    [...required.values()].map((requirement) =>
      Object.freeze({
        address: requirement.address,
        interactions: Object.freeze([...requirement.interactions.values()]),
      }),
    ),
  );
}

/**
 * The occurrence facts are a production convenience, never the expected side
 * of this audit. Compare them to the independently enumerated authored leaf
 * requirements before semantic assembly relies on them.
 */
function assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements(
  facts: WorkspaceBiomeOccurrenceAssemblyFacts,
  plan: AuthoredBiomePlan,
  requirements: readonly WorkspaceAuthoredLeafRequirement[],
): void {
  const expectedDetailsActive = expectedDetailsActiveOccurrenceIds(plan);
  const authoredOccurrenceIds = new Set(
    (plan.topology?.occurrences ?? []).map((occurrence) => occurrence.occurrenceId),
  );
  for (const occurrenceId of authoredOccurrenceIds) {
    const fact = facts.occurrence(occurrenceId);
    if (fact === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(facts.biome, occurrenceId))} has no authored occurrence assembly facts`,
      );
    }
    if (fact.detailsActive !== expectedDetailsActive.has(occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(facts.biome, occurrenceId))} has incorrect authored detail activation`,
      );
    }
  }
  for (const fact of facts.occurrences) {
    if (!authoredOccurrenceIds.has(fact.occurrenceId)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(createOccurrenceAddress(facts.biome, fact.occurrenceId))} has no authored occurrence owner`,
      );
    }
  }
  const expected = new Set(
    requirements.map((requirement) => semanticAddressKey(requirement.address)),
  );
  for (const occurrence of facts.occurrences) {
    for (const leaf of occurrence.leaves) {
      const key = semanticAddressKey(leaf.address);
      if (leaf.lifecycle === 'active' && leaf.surface === 'published' && !expected.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} active authored occurrence leaf is absent from the independent closure requirements`,
        );
      }
      if (leaf.surface === 'withheld' && expected.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} withheld authored occurrence leaf is unexpectedly required by the independent closure`,
        );
      }
    }
  }
  for (const requirement of requirements) {
    const surface = facts.leafSurface(requirement.address);
    if (surface !== 'published') {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(requirement.address)} required authored leaf is ${surface} in occurrence assembly facts`,
      );
    }
  }
}

function railMarkerForNode(node: WorkspaceNode): WorkspaceMarker {
  return node.kind === 'occurrenceWorkbench' ? (node.railMarker ?? node.marker) : node.marker;
}

function pickedTargetSummary(
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode,
): string | undefined {
  const picked = node.targets.find((target) => target.selected);
  if (picked === undefined) return undefined;
  return picked.room.rewardSummary === undefined
    ? picked.room.label
    : `${picked.room.label} · ${picked.room.rewardSummary}`;
}

function decisionRailMarker(
  node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode,
): WorkspaceMarker {
  const markers = new Map<string, WorkspaceMarker>();
  for (const value of workspaceDecisionOwnedMarkers(node)) markers.set(value.focusKey, value);
  const findingCount = [...markers.values()].reduce(
    (total, marker) => total + marker.findingCount,
    0,
  );
  return findingCount === node.marker.findingCount
    ? node.marker
    : Object.freeze({ ...node.marker, findingCount });
}

function nodeRailPresentation(
  node: WorkspaceNode,
  decisionIndex: number | undefined,
  isEntry = false,
): { readonly label: string; readonly summary?: string } {
  switch (node.kind) {
    case 'occurrenceWorkbench': {
      const entryLabel = isEntry && node.room.kind === 'Opening' ? 'Opening' : node.room.label;
      const rewardSummary =
        entryLabel === node.room.label
          ? node.room.rewardSummary
          : node.room.rewardSummary === undefined
            ? node.room.label
            : `${node.room.label} · ${node.room.rewardSummary}`;
      return {
        label: entryLabel,
        ...(rewardSummary === undefined ? {} : { summary: rewardSummary }),
      };
    }
    case 'linkedExit':
      return {
        label: node.target.room.label,
        ...(node.target.room.rewardSummary === undefined
          ? {}
          : { summary: node.target.room.rewardSummary }),
      };
    case 'ordinaryBatch':
    case 'mixedBatch': {
      const summary = pickedTargetSummary(node);
      return {
        label: `Decision ${decisionIndex ?? 1}`,
        ...(summary === undefined ? {} : { summary }),
      };
    }
    case 'takeoverBatch': {
      const summary = pickedTargetSummary(node);
      return {
        label: 'Preboss',
        ...(summary === undefined ? {} : { summary }),
      };
    }
    case 'completion':
      return { label: node.label };
    case 'hubDecision':
      return { label: 'Hub' };
  }
}

/**
 * The rail needs the visit's room-local workbench identity, while the Hub
 * board retains its distinct visit-order owner.  Publishing both avoids
 * making React join visits to occurrences or infer which Hub rooms are shown.
 */
function projectHubRailEntry(
  node: WorkspaceHubDecisionNode,
  structuralNodes: readonly WorkspaceNode[],
): WorkspaceHubRailEntry {
  const workbenchesByOccurrenceId = new Map(
    structuralNodes
      .filter(
        (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
          candidate.kind === 'occurrenceWorkbench',
      )
      .map((workbench) => [workbench.room.occurrenceId, workbench] as const),
  );
  const visits: WorkspaceHubVisitRailEntry[] = [];
  for (const visit of node.visits) {
    if (visit.authoring !== 'authored') continue;
    if (visit.room === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} has no authored room workbench`,
      );
    }
    const workbench = workbenchesByOccurrenceId.get(visit.room.occurrenceId);
    if (workbench === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} room ${visit.room.occurrenceId} is not projected`,
      );
    }
    if (workbench.inspectorPresentation !== 'hubRoomLocal') {
      throw new StructuredWorkspaceProjectionContractError(
        `Hub visit ${visit.visitIndex} must use a room-local workbench presentation`,
      );
    }
    visits.push(
      Object.freeze({
        key: `${node.key}:visit:${visit.visitIndex}`,
        label: `Visit ${visit.visitIndex} · ${visit.room.label}`,
        marker: workbench.room.marker,
        node: workbench,
        visitIndex: visit.visitIndex,
        visitMarker: visit.marker,
      }),
    );
  }
  return Object.freeze({
    kind: 'hubGroup' as const,
    key: node.key,
    marker: node.marker,
    node,
    visits: Object.freeze(visits),
  });
}

/**
 * A fixed N transition remains an inspectable node, but once its target room
 * exists the room is the player-facing rail stage.  The source-owned command
 * and finding destination remain in `WorkspaceBiome.nodes`.
 */
function isHubRailScaffoldWithRenderedTarget(
  node: WorkspaceNode,
  renderedOccurrenceIds: ReadonlySet<OccurrenceId>,
): boolean {
  if (node.kind === 'linkedExit') {
    return renderedOccurrenceIds.has(node.target.room.occurrenceId);
  }
  if (
    node.kind !== 'ordinaryBatch' &&
    node.kind !== 'mixedBatch' &&
    node.kind !== 'takeoverBatch'
  ) {
    return false;
  }
  return (
    node.owner.source.kind === 'hubDecision' &&
    node.targets.some((target) => renderedOccurrenceIds.has(target.room.occurrenceId))
  );
}

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

function isFineGrainedFindingOwner(address: SemanticAddress): boolean {
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
function assertWorkspaceProjectionClosure(
  biome: BiomeAddress,
  source: WorkspaceBiomeSource,
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

  for (const finding of source.findings) {
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

interface WorkspaceExpectedBatchInteractionRequirement {
  readonly exitSelection?: {
    readonly key: string;
    readonly owner: ExitDecisionAddress;
  };
  readonly fieldsCageOutcome?: {
    readonly key: string;
    readonly owner: ExitDecisionAddress;
  };
  readonly owner: ExitDecisionAddress;
  readonly rewardStore?: {
    readonly key: string;
    readonly owner: BatchRewardStoreAddress;
  };
}

function expectedBatchInteractionRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedBatchInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null) return new Map();
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence] as const),
  );
  const expected = new Map<string, WorkspaceExpectedBatchInteractionRequirement>();
  for (const decision of topology.decisions) {
    if (decision.kind !== 'exit' || decision.normal.kind !== 'batch') continue;
    const owner = createExitDecisionAddress(biome, decision.source);
    const targetDeclarations = decision.normal.targets.map((target) => {
      const occurrence = occurrences.get(target.occurrenceId);
      return occurrence === undefined ? undefined : requireRoom(catalog, occurrence.gameName);
    });
    const takeover =
      targetDeclarations.length > 0 && targetDeclarations.every(workspaceRoomTakesOverNormalDoors);
    const selection =
      decision.selection.kind === 'derived'
        ? undefined
        : Object.freeze({
            key: semanticAddressKey(createExitSelectionAddress(biome, decision.source)),
            owner,
          });
    const authoredRewardStore =
      decision.normal.rewardStore.kind === 'authoredBaseStore'
        ? decision.normal.rewardStore
        : undefined;
    const policy =
      layout.progression.kind === 'generated' ? layout.progression.rewardStorePolicy : undefined;
    const rewardStore =
      authoredRewardStore !== undefined &&
      (!takeover || authoredRewardStore.baseRewardStoreKey !== null) &&
      policy?.kind === 'authoredBaseStore'
        ? (() => {
            const address = createBatchRewardStoreAddress(biome, decision.source);
            return Object.freeze({ key: semanticAddressKey(address), owner: address });
          })()
        : undefined;
    const fieldsCageOutcome =
      !takeover &&
      layout.progression.kind === 'generated' &&
      layout.progression.batchPolicy.kind === 'fields'
        ? Object.freeze({ key: semanticAddressKey(owner), owner })
        : undefined;
    if (selection === undefined && rewardStore === undefined && fieldsCageOutcome === undefined) {
      continue;
    }
    const requirement = Object.freeze({
      ...(selection === undefined ? {} : { exitSelection: selection }),
      ...(fieldsCageOutcome === undefined ? {} : { fieldsCageOutcome }),
      owner,
      ...(rewardStore === undefined ? {} : { rewardStore }),
    });
    const key = `batchControls:${semanticAddressKey(owner)}`;
    if (expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected authored batch interaction packages`,
      );
    }
    expected.set(key, requirement);
  }
  return expected;
}

/**
 * Independently enumerate batch-control owners from authored topology and
 * declaration policy. This makes a missing package observable before binding
 * or rendered-node closure can merely report its missing interaction.
 */
function assertBatchInteractionRequirementsMatchAuthoredState(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>,
): void {
  const expected = expectedBatchInteractionRequirements(catalog, biome, layout, plan);
  const assertAddress = (
    actual: SemanticAddress,
    expectedAddress: SemanticAddress,
    detail: string,
  ): void => {
    if (semanticAddressKey(actual) !== semanticAddressKey(expectedAddress)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${detail} has a conflicting semantic owner`,
      );
    }
  };
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored batch interaction package is absent`,
      );
    }
    assertAddress(requirement.owner, expectation.owner, `${key} batch decision owner`);
    if (expectation.exitSelection === undefined) {
      if (requirement.exitSelection !== undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} unexpectedly projects an exit-selection requirement`,
        );
      }
    } else {
      if (requirement.exitSelection === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} required exit-selection requirement is absent`,
        );
      }
      assertAddress(
        requirement.owner,
        expectation.exitSelection.owner,
        `${key} exit-selection decision owner`,
      );
      if (semanticAddressKey(requirement.exitSelection.owner) !== expectation.exitSelection.key) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} exit-selection requirement has a conflicting interaction key`,
        );
      }
    }
    if (expectation.rewardStore === undefined) {
      if (requirement.rewardStore !== undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} unexpectedly projects a batch reward-store requirement`,
        );
      }
    } else {
      if (requirement.rewardStore === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} required batch reward-store requirement is absent`,
        );
      }
      if (semanticAddressKey(requirement.rewardStore.owner) !== expectation.rewardStore.key) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} batch reward-store requirement has a conflicting interaction key`,
        );
      }
      assertAddress(
        requirement.rewardStore.owner,
        expectation.rewardStore.owner,
        `${key} batch reward-store owner`,
      );
    }
    if (expectation.fieldsCageOutcome === undefined) {
      if (requirement.fieldsCageOutcome !== undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} unexpectedly projects a Fields cage-outcome requirement`,
        );
      }
    } else {
      if (requirement.fieldsCageOutcome === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} required Fields cage-outcome requirement is absent`,
        );
      }
      if (
        semanticAddressKey(requirement.fieldsCageOutcome.owner) !==
        expectation.fieldsCageOutcome.key
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} Fields cage-outcome requirement has a conflicting interaction key`,
        );
      }
      assertAddress(
        requirement.fieldsCageOutcome.owner,
        expectation.fieldsCageOutcome.owner,
        `${key} Fields cage-outcome owner`,
      );
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected batch interaction package has no authored owner`,
      );
    }
  }
}

interface WorkspaceExpectedHubInteractionRequirement {
  readonly owner: HubDecisionAddress;
  readonly slots: readonly {
    readonly close?: NonNullable<WorkspaceHubSlotInteraction['close']>;
    readonly openedOccurrenceId?: OccurrenceId;
    readonly owner: HubSlotAddress;
    readonly roomGameName: string;
    readonly selected: boolean;
  }[];
  readonly visits: readonly {
    readonly choices: readonly string[];
    readonly owner: HubVisitAddress;
    readonly selectedHubSlotKey?: string;
  }[];
}

function expectedHubInteractionRequirements(
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedHubInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null || layout.progression.kind !== 'hub') return new Map();
  const descriptor = layout.progression;
  const authoredHubs = topology.decisions.filter(
    (decision): decision is HubDecision =>
      decision.kind === 'hub' && decision.hubKey === descriptor.hubKey,
  );
  if (authoredHubs.length === 0) return new Map();
  if (authoredHubs.length > 1) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(createHubDecisionAddress(biome, descriptor.hubKey))} has multiple authored Hub boards`,
    );
  }
  const hub = authoredHubs[0]!;
  const owner = createHubDecisionAddress(biome, descriptor.hubKey);
  const slots = Object.freeze(
    descriptor.slots.map((slot) => {
      const opened = hub.openTargets.find((target) => target.hubSlotKey === slot.slotKey);
      const address = createHubSlotAddress(biome, descriptor.hubKey, slot.slotKey);
      const closeImpact =
        opened === undefined
          ? undefined
          : describeHubSlotClosureImpact(
              topology,
              descriptor.hubKey,
              slot.slotKey,
              descriptor.openCount.min,
            );
      return Object.freeze({
        ...(closeImpact === undefined
          ? {}
          : {
              close: Object.freeze({
                command: Object.freeze({ kind: 'CloseHubSlot' as const, slot: address }),
                impact: workspaceTopologyRemovalScope(biome, closeImpact),
              }),
            }),
        ...(opened === undefined ? {} : { openedOccurrenceId: opened.occurrenceId }),
        owner: address,
        roomGameName: slot.roomGameName,
        selected: opened !== undefined,
      });
    }),
  );
  const openSlots = Object.freeze(
    descriptor.slots.filter((slot) =>
      hub.openTargets.some((target) => target.hubSlotKey === slot.slotKey),
    ),
  );
  const visits = Object.freeze(
    Array.from(
      { length: Math.min(descriptor.requiredVisits, hub.visitOrder.length + 1) },
      (_, index) => {
        const selectedHubSlotKey = hub.visitOrder[index];
        return Object.freeze({
          choices: Object.freeze(
            openSlots
              .filter(
                (slot) =>
                  slot.slotKey === selectedHubSlotKey || !hub.visitOrder.includes(slot.slotKey),
              )
              .map((slot) => slot.slotKey),
          ),
          owner: createHubVisitAddress(biome, descriptor.hubKey, index + 1),
          ...(selectedHubSlotKey === undefined ? {} : { selectedHubSlotKey }),
        });
      },
    ),
  );
  const key = `hubControls:${semanticAddressKey(owner)}`;
  return new Map([[key, Object.freeze({ owner, slots, visits })]]);
}

function sameTopologyRemovalScope(
  actual: WorkspaceTopologyRemovalScope,
  expected: WorkspaceTopologyRemovalScope,
): boolean {
  const same = <T>(left: readonly T[], right: readonly T[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);
  return (
    same(
      actual.removedDecisionOwners.map(semanticAddressKey),
      expected.removedDecisionOwners.map(semanticAddressKey),
    ) &&
    same(actual.removedHubDecisionKeys, expected.removedHubDecisionKeys) &&
    same(actual.removedOccurrenceIds, expected.removedOccurrenceIds)
  );
}

function sameHubSlotClose(
  actual: WorkspaceHubSlotInteraction['close'],
  expected: WorkspaceHubSlotInteraction['close'],
): boolean {
  if (actual === undefined || expected === undefined) return actual === expected;
  return (
    actual.command.kind === expected.command.kind &&
    semanticAddressKey(actual.command.slot) === semanticAddressKey(expected.command.slot) &&
    sameTopologyRemovalScope(actual.impact, expected.impact)
  );
}

/**
 * Independently enumerate Hub controls from authored board state and its
 * descriptor. This deliberately retains the raw structural-next visit even
 * when a newly authored empty board still renders that row as locked.
 */
function assertHubInteractionRequirementsMatchAuthoredState(
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>,
): void {
  const expected = expectedHubInteractionRequirements(biome, layout, plan);
  const sameKey = (actual: SemanticAddress, expectedAddress: SemanticAddress): boolean =>
    semanticAddressKey(actual) === semanticAddressKey(expectedAddress);
  const sameValues = <T>(actual: readonly T[], expectedValues: readonly T[]): boolean =>
    actual.length === expectedValues.length &&
    actual.every((value, index) => value === expectedValues[index]);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored Hub interaction package is absent`,
      );
    }
    if (!sameKey(requirement.owner, expectation.owner)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} Hub requirement has a conflicting semantic owner`,
      );
    }
    if (requirement.slots.length !== expectation.slots.length) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} does not cover every declared Hub slot`,
      );
    }
    for (const slot of expectation.slots) {
      const actual = requirement.slots.find((candidate) => sameKey(candidate.owner, slot.owner));
      if (actual === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} Hub slot ${semanticAddressKey(slot.owner)} requirement is absent`,
        );
      }
      if (
        actual.selected !== slot.selected ||
        actual.openedOccurrenceId !== slot.openedOccurrenceId ||
        actual.roomGameName !== slot.roomGameName ||
        !sameHubSlotClose(actual.close, slot.close) ||
        !sameValues(
          actual.choices.map((choice) => choice.value),
          Object.freeze([false, true]),
        )
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} Hub slot ${semanticAddressKey(slot.owner)} requirement disagrees with authored state`,
        );
      }
    }
    if (requirement.visits.length !== expectation.visits.length) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} does not cover every authored or structural-next Hub visit`,
      );
    }
    for (const visit of expectation.visits) {
      const actual = requirement.visits.find((candidate) => sameKey(candidate.owner, visit.owner));
      if (
        actual === undefined ||
        actual.selectedHubSlotKey !== visit.selectedHubSlotKey ||
        !sameValues(
          actual.choices.map((choice) => choice.value),
          visit.choices,
        )
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} Hub visit ${semanticAddressKey(visit.owner)} requirement disagrees with authored state`,
        );
      }
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected Hub interaction package has no authored board owner`,
      );
    }
  }
}

interface WorkspaceExpectedTopologyRemovalInteractionRequirement {
  readonly owner: BiomeAddress;
  readonly removals: readonly WorkspaceTopologyRemovalInteraction[];
}

/**
 * Independently enumerate generic removal controls from persisted topology.
 * This does not rely on projected nodes, so blocked and disconnected suffixes
 * cannot silently lose their semantic removal owner.
 */
function expectedTopologyRemovalInteractionRequirements(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedTopologyRemovalInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null) return new Map();
  const removals: WorkspaceTopologyRemovalInteraction[] = [
    Object.freeze({
      action: 'clearTopology' as const,
      command: Object.freeze({ kind: 'ClearTopology' as const, biome }),
      impact: workspaceTopologyRemovalScope(biome, describeClearTopologyImpact(topology)),
      key: semanticAddressKey(biome),
      owner: biome,
    }),
  ];
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') continue;
    const owner = createExitDecisionAddress(biome, decision.source);
    const impact = describeExitDecisionRemovalImpact(topology, decision.source);
    if (impact === undefined) continue;
    removals.push(
      Object.freeze({
        action: 'removeExitDecision' as const,
        command: Object.freeze({ kind: 'RemoveExitDecision' as const, decision: owner }),
        impact: workspaceTopologyRemovalScope(biome, impact),
        key: semanticAddressKey(owner),
        owner,
      }),
    );
  }
  const key = `topologyRemovals:${semanticAddressKey(biome)}`;
  return new Map([[key, Object.freeze({ owner: biome, removals: Object.freeze(removals) })]]);
}

function sameTopologyRemovalInteraction(
  actual: WorkspaceTopologyRemovalInteraction,
  expected: WorkspaceTopologyRemovalInteraction,
): boolean {
  if (
    actual.action !== expected.action ||
    actual.key !== expected.key ||
    semanticAddressKey(actual.owner) !== semanticAddressKey(expected.owner) ||
    !sameTopologyRemovalScope(actual.impact, expected.impact)
  ) {
    return false;
  }
  switch (actual.action) {
    case 'clearTopology':
      return (
        expected.action === 'clearTopology' &&
        semanticAddressKey(actual.command.biome) === semanticAddressKey(expected.command.biome)
      );
    case 'removeExitDecision':
      return (
        expected.action === 'removeExitDecision' &&
        semanticAddressKey(actual.command.decision) ===
          semanticAddressKey(expected.command.decision)
      );
  }
}

function assertTopologyRemovalInteractionRequirementsMatchAuthoredState(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceTopologyRemovalInteractionRequirement>,
): void {
  const expected = expectedTopologyRemovalInteractionRequirements(biome, plan);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored topology-removal interaction package is absent`,
      );
    }
    if (semanticAddressKey(requirement.owner) !== semanticAddressKey(expectation.owner)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} topology-removal requirement has a conflicting semantic owner`,
      );
    }
    if (requirement.removals.length !== expectation.removals.length) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} does not cover every authored topology-removal owner`,
      );
    }
    for (const removal of expectation.removals) {
      const actual = requirement.removals.find((candidate) => candidate.key === removal.key);
      if (actual === undefined || !sameTopologyRemovalInteraction(actual, removal)) {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} topology-removal requirement ${removal.key} disagrees with authored state`,
        );
      }
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected topology-removal package has no authored biome owner`,
      );
    }
  }
}

interface WorkspaceExpectedStartInteractionRequirement {
  readonly owner: BiomeAddress;
  readonly start: WorkspaceStartInteractionRequirement['start'];
}

/** Independently enumerate start policy from the persisted topology and layout. */
function expectedStartInteractionRequirements(
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedStartInteractionRequirement> {
  if (plan.topology !== null) return new Map();
  const start =
    layout.start.kind === 'fixedAuthored'
      ? Object.freeze({ gameName: layout.start.roomGameName, kind: 'fixed' as const })
      : Object.freeze({
          gameNames: Object.freeze([...layout.start.roomGameNames]) as readonly [
            string,
            ...string[],
          ],
          kind: 'choice' as const,
        });
  const key = `start:${semanticAddressKey(biome)}`;
  return new Map([[key, Object.freeze({ owner: biome, start })]]);
}

function sameStartInteractionRequirement(
  actual: WorkspaceStartInteractionRequirement,
  expected: WorkspaceExpectedStartInteractionRequirement,
): boolean {
  if (semanticAddressKey(actual.owner) !== semanticAddressKey(expected.owner)) return false;
  const expectedStart = expected.start;
  if (actual.start.kind !== expectedStart.kind) return false;
  if (actual.start.kind === 'fixed') {
    return expectedStart.kind === 'fixed' && actual.start.gameName === expectedStart.gameName;
  }
  if (expectedStart.kind !== 'choice') return false;
  return (
    actual.start.gameNames.length === expectedStart.gameNames.length &&
    actual.start.gameNames.every((gameName, index) => gameName === expectedStart.gameNames[index])
  );
}

function assertStartInteractionRequirementsMatchAuthoredState(
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceStartInteractionRequirement>,
): void {
  const expected = expectedStartInteractionRequirements(biome, layout, plan);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required authored start interaction is absent`,
      );
    }
    if (!sameStartInteractionRequirement(requirement, expectation)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} start interaction requirement disagrees with authored state`,
      );
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected start interaction requirement has no topology-free biome owner`,
      );
    }
  }
}

type WorkspaceExpectedTakeoverInteractionRequirement =
  | {
      readonly action: 'create' | 'replace';
      readonly existingTargets: readonly {
        readonly exitKey: string;
        readonly occurrenceId: OccurrenceId;
      }[];
      readonly gameNames: readonly string[];
      readonly impact?: WorkspaceTakeoverReplacementImpact;
      readonly owner: ExitDecisionAddress;
      readonly presentation: 'candidate';
    }
  | {
      readonly action: 'reconcile';
      readonly existingTargets: readonly {
        readonly exitKey: string;
        readonly occurrenceId: OccurrenceId;
      }[];
      readonly gameName: string;
      readonly owner: ExitDecisionAddress;
      readonly presentation: 'repair';
      readonly requiredExitKeys: readonly string[];
    }
  | {
      readonly action: 'create';
      readonly gameName: string;
      readonly owner: ExitDecisionAddress;
      readonly presentation: 'fixedWidthOneTakeover' | 'completedHubHandoff';
      readonly requiredExitKeys: readonly string[];
    };

/** Independent expected-side derivation; it never consumes assembly output. */
function expectedTakeoverReplacementImpact(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  decision: ExitDecision,
): WorkspaceTakeoverReplacementImpact | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  const replacedOccurrenceIds = new Set(
    decision.normal.targets.map((target) => target.occurrenceId),
  );
  const removal = workspaceRemovalScopeForRoots(biome, plan, replacedOccurrenceIds);
  if (removal === undefined) return undefined;
  return Object.freeze({
    command: 'ReplaceWithTakeoverBatch',
    owner: createExitDecisionAddress(biome, decision.source),
    removedDecisionOwners: removal.removedDecisionOwners,
    removedOccurrenceIds: removal.removedOccurrenceIds,
    replacedOccurrenceIds: Object.freeze(
      plan.topology?.occurrences
        .filter((occurrence) => replacedOccurrenceIds.has(occurrence.occurrenceId))
        .map((occurrence) => occurrence.occurrenceId) ?? [],
    ),
  });
}

/**
 * Independently enumerate takeover controls from persisted topology,
 * declaration policy, and structural completeness. This must not use
 * projected workbenches, interaction requirements, or evaluation coverage.
 */
function expectedTakeoverInteractionRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedTakeoverInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null) return new Map();
  const expected = new Map<string, WorkspaceExpectedTakeoverInteractionRequirement>();
  const add = (requirement: WorkspaceExpectedTakeoverInteractionRequirement): void => {
    const key = `takeoverBatch:${semanticAddressKey(requirement.owner)}`;
    if (expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected authored takeover interaction requirements`,
      );
    }
    expected.set(key, requirement);
  };
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence] as const),
  );
  const authoredDecisions = new Map<string, ExitDecision>();
  for (const decision of topology.decisions) {
    if (decision.kind !== 'exit') continue;
    const key = semanticAddressKey(createExitDecisionAddress(biome, decision.source));
    if (authoredDecisions.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected authored takeover decision owners`,
      );
    }
    authoredDecisions.set(key, decision);
  }
  const candidateGameNames = catalog.rooms.values
    .filter((room) => room.biomeKey === plan.biomeKey && workspaceRoomTakesOverNormalDoors(room))
    .map((room) => room.gameName);
  const fixedWidthOneTakeover = fixedWidthOneTakeoverForLayout(catalog, layout);
  for (const decision of authoredDecisions.values()) {
    const owner = createExitDecisionAddress(biome, decision.source);
    const existingTargets =
      decision.normal.kind === 'batch'
        ? Object.freeze(
            decision.normal.targets.map((target) =>
              Object.freeze({ exitKey: target.exitKey, occurrenceId: target.occurrenceId }),
            ),
          )
        : Object.freeze([]);
    const targetRooms =
      decision.normal.kind === 'batch'
        ? decision.normal.targets.map((target) => occurrences.get(target.occurrenceId))
        : Object.freeze([]);
    const targetDeclarations = targetRooms.map((room) =>
      room === undefined ? undefined : catalog.rooms.byKey[room.gameName],
    );
    const takeoverGameName =
      targetDeclarations.length > 0 && targetDeclarations.every(workspaceRoomTakesOverNormalDoors)
        ? targetRooms[0]?.gameName
        : undefined;
    if (takeoverGameName !== undefined) {
      const exits = resolveDeclaredPhysicalExits(catalog, layout, topology, decision.source);
      if (exits !== undefined) {
        add(
          Object.freeze({
            action: 'reconcile' as const,
            existingTargets,
            gameName: takeoverGameName,
            owner,
            presentation: 'repair' as const,
            requiredExitKeys: Object.freeze(exits.map((exit) => exit.exitKey)),
          }),
        );
      }
      continue;
    }
    if (
      layout.progression.kind !== 'generated' ||
      fixedWidthOneTakeover !== undefined ||
      candidateGameNames.length === 0
    ) {
      continue;
    }
    const impact =
      decision.normal.kind === 'batch'
        ? expectedTakeoverReplacementImpact(biome, plan, decision)
        : undefined;
    add(
      Object.freeze({
        action: decision.normal.kind === 'batch' ? ('replace' as const) : ('create' as const),
        existingTargets,
        gameNames: Object.freeze([...candidateGameNames]),
        ...(impact === undefined ? {} : { impact }),
        owner,
        presentation: 'candidate' as const,
      }),
    );
  }
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion !== 'incomplete' || completeness.frontier.kind !== 'exitDecision') {
    return expected;
  }
  const owner = completeness.frontier;
  const existing = authoredDecisions.get(semanticAddressKey(owner));
  const fixedTransition = fixedWidthOneTakeoverTransitionForSource(
    catalog,
    layout,
    topology,
    owner.source,
  );
  const requiredExits =
    fixedTransition === undefined
      ? undefined
      : resolveDeclaredPhysicalExits(catalog, layout, topology, owner.source);
  if (fixedTransition !== undefined && existing === undefined && requiredExits !== undefined) {
    add(
      Object.freeze({
        action: 'create' as const,
        gameName: fixedTransition.room.gameName,
        owner,
        presentation:
          fixedTransition.kind === 'completedHubHandoff'
            ? ('completedHubHandoff' as const)
            : ('fixedWidthOneTakeover' as const),
        requiredExitKeys: Object.freeze(requiredExits.map((exit) => exit.exitKey)),
      }),
    );
  } else if (
    layout.progression.kind === 'generated' &&
    fixedWidthOneTakeover === undefined &&
    candidateGameNames.length > 0 &&
    !expected.has(`takeoverBatch:${semanticAddressKey(owner)}`)
  ) {
    const existingTargets =
      existing?.normal.kind === 'batch'
        ? Object.freeze(
            existing.normal.targets.map((target) =>
              Object.freeze({ exitKey: target.exitKey, occurrenceId: target.occurrenceId }),
            ),
          )
        : Object.freeze([]);
    add(
      Object.freeze({
        action: existing?.normal.kind === 'batch' ? ('replace' as const) : ('create' as const),
        existingTargets,
        gameNames: Object.freeze([...candidateGameNames]),
        owner,
        presentation: 'candidate' as const,
      }),
    );
  }
  return expected;
}

function sameTakeoverReplacementImpact(
  actual: WorkspaceTakeoverReplacementImpact | undefined,
  expected: WorkspaceTakeoverReplacementImpact | undefined,
): boolean {
  if (actual === undefined || expected === undefined) return actual === expected;
  const sameValues = <T>(left: readonly T[], right: readonly T[]): boolean =>
    left.length === right.length && left.every((value, index) => value === right[index]);
  return (
    actual.command === expected.command &&
    semanticAddressKey(actual.owner) === semanticAddressKey(expected.owner) &&
    sameValues(
      actual.removedDecisionOwners.map(semanticAddressKey),
      expected.removedDecisionOwners.map(semanticAddressKey),
    ) &&
    sameValues(actual.removedOccurrenceIds, expected.removedOccurrenceIds) &&
    sameValues(actual.replacedOccurrenceIds, expected.replacedOccurrenceIds)
  );
}

function sameTakeoverExistingTargets(
  actual: readonly { readonly exitKey: string; readonly occurrenceId: OccurrenceId }[],
  expected: readonly { readonly exitKey: string; readonly occurrenceId: OccurrenceId }[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every(
      (target, index) =>
        target.exitKey === expected[index]?.exitKey &&
        target.occurrenceId === expected[index]?.occurrenceId,
    )
  );
}

function sameTakeoverInteractionRequirement(
  actual: WorkspaceTakeoverInteractionRequirement,
  expected: WorkspaceExpectedTakeoverInteractionRequirement,
): boolean {
  if (semanticAddressKey(actual.owner) !== semanticAddressKey(expected.owner)) return false;
  if (actual.presentation !== expected.presentation || actual.action !== expected.action)
    return false;
  switch (actual.presentation) {
    case 'candidate':
      return (
        expected.presentation === 'candidate' &&
        actual.gameNames.length === expected.gameNames.length &&
        actual.gameNames.every((gameName, index) => gameName === expected.gameNames[index]) &&
        sameTakeoverExistingTargets(actual.existingTargets, expected.existingTargets) &&
        sameTakeoverReplacementImpact(actual.impact, expected.impact)
      );
    case 'repair':
      return (
        expected.presentation === 'repair' &&
        actual.gameName === expected.gameName &&
        sameTakeoverExistingTargets(actual.existingTargets, expected.existingTargets) &&
        actual.requiredExitKeys.length === expected.requiredExitKeys.length &&
        actual.requiredExitKeys.every((key, index) => key === expected.requiredExitKeys[index])
      );
    case 'fixedWidthOneTakeover':
    case 'completedHubHandoff':
      return (
        (expected.presentation === 'fixedWidthOneTakeover' ||
          expected.presentation === 'completedHubHandoff') &&
        actual.gameName === expected.gameName &&
        actual.requiredExitKeys.length === expected.requiredExitKeys.length &&
        actual.requiredExitKeys.every((key, index) => key === expected.requiredExitKeys[index])
      );
  }
}

function assertTakeoverInteractionRequirementsMatchAuthoredState(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  requirements: ReadonlyMap<string, WorkspaceTakeoverInteractionRequirement>,
): void {
  const expected = expectedTakeoverInteractionRequirements(catalog, biome, layout, plan);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required takeover interaction requirement is absent`,
      );
    }
    if (!sameTakeoverInteractionRequirement(requirement, expectation)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} takeover interaction requirement disagrees with authored state`,
      );
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected takeover interaction requirement has no authored or frontier owner`,
      );
    }
  }
}

type WorkspaceExpectedFrontierInteractionRequirement =
  | {
      readonly capabilities: WorkspaceExitFrontierCapabilities;
      readonly kind: 'exitFrontier';
      readonly owner: ExitDecisionAddress;
      readonly structural?: WorkspaceExitFrontierStructuralRequirement;
    }
  | {
      readonly kind: 'hubDecisionFrontier';
      readonly owner: HubDecisionAddress;
      readonly structural: { readonly action: 'createHubDecision' };
    };

/**
 * Independently enumerate structural frontier packages from persisted
 * topology, completeness, and layout policy. This intentionally does not
 * inspect a projected frontier, another requirement collection, source-index
 * lookup, or bound interaction map: omission of the frontier package itself
 * must remain observable.
 */
function expectedFrontierInteractionRequirements(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
): ReadonlyMap<string, WorkspaceExpectedFrontierInteractionRequirement> {
  const topology = plan.topology;
  if (topology === null) return new Map();
  const expected = new Map<string, WorkspaceExpectedFrontierInteractionRequirement>();
  const add = (requirement: WorkspaceExpectedFrontierInteractionRequirement): void => {
    const key = `${requirement.kind}:${semanticAddressKey(requirement.owner)}`;
    if (expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected frontier interaction requirements`,
      );
    }
    expected.set(key, requirement);
  };
  const authoredDecisions = new Map<string, ExitDecision>();
  for (const decision of topology.decisions) {
    if (decision.kind !== 'exit') continue;
    const key = semanticAddressKey(createExitDecisionAddress(biome, decision.source));
    if (authoredDecisions.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has multiple expected authored frontier decision owners`,
      );
    }
    authoredDecisions.set(key, decision);
  }
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
  if (completeness.completion !== 'incomplete') return expected;
  switch (completeness.frontier.kind) {
    case 'exitDecision': {
      const owner = completeness.frontier;
      const existing = authoredDecisions.get(semanticAddressKey(owner));
      const fixedTransition = fixedWidthOneTakeoverTransitionForSource(
        catalog,
        layout,
        topology,
        owner.source,
      );
      const structural =
        existing === undefined &&
        owner.source.kind === 'occurrence' &&
        fixedTransition === undefined
          ? layout.progression.kind === 'hub' &&
            owner.source.occurrenceId === topology.startOccurrenceId
            ? Object.freeze({
                action: 'createLinkedExit' as const,
                targetGameName: layout.progression.linkedExit.roomGameName,
              })
            : Object.freeze({ action: 'createBatch' as const })
          : undefined;
      const fixedExits =
        fixedTransition === undefined
          ? undefined
          : resolveDeclaredPhysicalExits(catalog, layout, topology, owner.source);
      const candidateGameNames = catalog.rooms.values
        .filter(
          (room) => room.biomeKey === plan.biomeKey && workspaceRoomTakesOverNormalDoors(room),
        )
        .map((room) => room.gameName);
      const takeover =
        existing === undefined &&
        ((fixedTransition !== undefined && fixedExits !== undefined) ||
          (fixedTransition === undefined &&
            layout.progression.kind === 'generated' &&
            fixedWidthOneTakeoverForLayout(catalog, layout) === undefined &&
            candidateGameNames.length > 0));
      if (structural === undefined && !takeover) return expected;
      add(
        Object.freeze({
          capabilities: Object.freeze({
            ...(structural === undefined ? {} : { structural: structural.action }),
            ...(takeover ? { takeover: true as const } : {}),
          }),
          kind: 'exitFrontier' as const,
          owner,
          ...(structural === undefined ? {} : { structural }),
        }),
      );
      return expected;
    }
    case 'hubDecision':
      add(
        Object.freeze({
          kind: 'hubDecisionFrontier' as const,
          owner: completeness.frontier,
          structural: Object.freeze({ action: 'createHubDecision' as const }),
        }),
      );
      return expected;
    case 'hubOpenSet':
    case 'hubVisit':
      return expected;
  }
  return expected;
}

function sameFrontierInteractionRequirement(
  actual: WorkspaceFrontierInteractionRequirement,
  expected: WorkspaceExpectedFrontierInteractionRequirement,
): boolean {
  if (
    actual.kind !== expected.kind ||
    semanticAddressKey(actual.owner) !== semanticAddressKey(expected.owner)
  ) {
    return false;
  }
  if (actual.kind === 'hubDecisionFrontier') {
    return (
      expected.kind === 'hubDecisionFrontier' &&
      actual.structural.action === expected.structural.action
    );
  }
  if (expected.kind !== 'exitFrontier') return false;
  if (
    actual.capabilities.structural !== expected.capabilities.structural ||
    actual.capabilities.takeover !== expected.capabilities.takeover ||
    actual.structural?.action !== expected.structural?.action
  ) {
    return false;
  }
  if (actual.structural?.action !== 'createLinkedExit') {
    return expected.structural?.action !== 'createLinkedExit';
  }
  return (
    expected.structural?.action === 'createLinkedExit' &&
    expected.structural.targetGameName === actual.structural.targetGameName
  );
}

function assertFrontierInteractionRequirementsMatchAuthoredState(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  takeoverRequirements: ReadonlyMap<string, WorkspaceTakeoverInteractionRequirement>,
  requirements: ReadonlyMap<string, WorkspaceFrontierInteractionRequirement>,
): void {
  const expected = expectedFrontierInteractionRequirements(catalog, biome, layout, plan);
  for (const [key, expectation] of expected) {
    const requirement = requirements.get(key);
    if (requirement === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} required frontier interaction package is absent`,
      );
    }
    if (!sameFrontierInteractionRequirement(requirement, expectation)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} frontier interaction requirement disagrees with authored state`,
      );
    }
    if (requirement.kind === 'exitFrontier' && requirement.capabilities.takeover === true) {
      const takeover = takeoverRequirements.get(
        `takeoverBatch:${semanticAddressKey(requirement.owner)}`,
      );
      if (takeover?.action !== 'create') {
        throw new StructuredWorkspaceProjectionContractError(
          `${key} advertised takeover capability has no exact create requirement`,
        );
      }
    }
  }
  for (const key of requirements.keys()) {
    if (!expected.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} projected frontier interaction package has no active authored frontier`,
      );
    }
  }
}

function projectBiome(
  catalog: Catalog,
  source: WorkspaceBiomeSource,
): {
  readonly authoredLeafRequirements: readonly WorkspaceAuthoredLeafRequirement[];
  readonly batchInteractionRequirements: ReadonlyMap<string, WorkspaceBatchInteractionRequirement>;
  readonly biome: WorkspaceBiome;
  readonly focusDestinations: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly frontierInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceFrontierInteractionRequirement
  >;
  readonly hubInteractionRequirements: ReadonlyMap<string, WorkspaceHubInteractionRequirement>;
  readonly occurrenceInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceOccurrenceInteractionRequirement
  >;
  readonly roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly startInteractionRequirements: ReadonlyMap<string, WorkspaceStartInteractionRequirement>;
  readonly takeoverInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTakeoverInteractionRequirement
  >;
  readonly topologyRemovalInteractionRequirements: ReadonlyMap<
    string,
    WorkspaceTopologyRemovalInteractionRequirement
  >;
} {
  const { biome: biomeAddress, layout, plan } = source;
  const semantic = assembleWorkspaceBiomeSemantics(catalog, source);
  const authoredLeafRequirements = authoredWorkspaceLeafRequirements(catalog, biomeAddress, plan);
  assertOccurrenceAssemblyFactsMatchAuthoredLeafRequirements(
    semantic.occurrenceFacts,
    plan,
    authoredLeafRequirements,
  );
  assertBatchInteractionRequirementsMatchAuthoredState(
    catalog,
    biomeAddress,
    layout,
    plan,
    semantic.batchInteractionRequirements,
  );
  assertHubInteractionRequirementsMatchAuthoredState(
    biomeAddress,
    layout,
    plan,
    semantic.hubInteractionRequirements,
  );
  assertTopologyRemovalInteractionRequirementsMatchAuthoredState(
    biomeAddress,
    plan,
    semantic.topologyRemovalInteractionRequirements,
  );
  assertStartInteractionRequirementsMatchAuthoredState(
    biomeAddress,
    layout,
    plan,
    semantic.startInteractionRequirements,
  );
  assertTakeoverInteractionRequirementsMatchAuthoredState(
    catalog,
    biomeAddress,
    layout,
    plan,
    semantic.takeoverInteractionRequirements,
  );
  assertFrontierInteractionRequirementsMatchAuthoredState(
    catalog,
    biomeAddress,
    layout,
    plan,
    semantic.takeoverInteractionRequirements,
    semantic.frontierInteractionRequirements,
  );
  assertAuthoredWorkspaceLeafProjectionClosure(
    authoredLeafRequirements,
    semantic.preliminaryFocusDestinations,
    semantic.nodes,
  );
  assertWorkspaceProjectionClosure(
    biomeAddress,
    source,
    semantic.preliminaryFocusDestinations,
    plan,
    semantic.nodes,
  );
  const { entry, frontier, structuralNodes } = semantic;
  const renderedOccurrenceIds = new Set(
    structuralNodes
      .filter(
        (node): node is WorkspaceOccurrenceWorkbenchNode => node.kind === 'occurrenceWorkbench',
      )
      .map((node) => node.room.occurrenceId),
  );
  const railNodes = structuralNodes
    .filter((node) => {
      if (node.kind !== 'occurrenceWorkbench') return true;
      if (node.railVisibility === 'inspectorOnly') return false;
      // Ordinary room offers belong inside their owning decision workbench.
      // N's fixed Opening, PreHub, and Preboss occurrences remain structural
      // stages, while an ordinary biome keeps only its authored entry.
      return layout.progression.kind === 'hub' || node.key === entry?.key;
    })
    .filter(
      (node) =>
        layout.progression.kind !== 'hub' ||
        !isHubRailScaffoldWithRenderedTarget(node, renderedOccurrenceIds),
    );
  // The N board is declaration-owned outline structure until the fixed
  // Opening -> PreHub path has reached it. Keep that read-only preview after
  // the active entry frontier; otherwise it would claim a position in the
  // rail before the action that makes it reachable. Persisted Hub decisions
  // and retained authored structure stay in their topology order.
  const hubOutlines = railNodes.filter(
    (node): node is WorkspaceHubDecisionNode =>
      node.kind === 'hubDecision' && node.authoring === 'outline',
  );
  const reachableRailNodes = railNodes.filter(
    (node) => !(node.kind === 'hubDecision' && node.authoring === 'outline'),
  );
  const railFrontier =
    frontier?.kind === 'start' ||
    (frontier?.kind === 'exitDecision' && frontier.owner.source.kind !== 'hubDecision')
      ? frontier
      : undefined;
  let decisionIndex = 0;
  const railEntryForNode = (node: WorkspaceNode): WorkspaceRailEntry => {
    if (node.kind === 'hubDecision') return projectHubRailEntry(node, structuralNodes);
    if (node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch') decisionIndex += 1;
    const presentation = nodeRailPresentation(
      node,
      node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' ? decisionIndex : undefined,
      node.key === entry?.key,
    );
    return Object.freeze({
      kind: 'node' as const,
      key: node.key,
      label: presentation.label,
      marker:
        node.kind === 'ordinaryBatch' || node.kind === 'mixedBatch' || node.kind === 'takeoverBatch'
          ? decisionRailMarker(node)
          : railMarkerForNode(node),
      node,
      ...(presentation.summary === undefined ? {} : { summary: presentation.summary }),
    });
  };
  const rail = Object.freeze([
    ...reachableRailNodes.map(railEntryForNode),
    ...(railFrontier === undefined
      ? []
      : [
          Object.freeze({
            kind: 'frontier' as const,
            frontier: railFrontier,
            key: `frontier:${railFrontier.marker.focusKey}`,
            marker: railFrontier.marker,
          }),
        ]),
    ...hubOutlines.map(railEntryForNode),
  ]);
  const inspectorDefaults = Object.freeze({
    ...(entry === undefined ? {} : { entry }),
    frontier,
    nodes: semantic.nodes,
    rail,
  });
  const defaultInspector = defaultInspectorDestination(inspectorDefaults);
  assertWorkspaceDefaultInspectorDestinationClosure(inspectorDefaults, defaultInspector);
  const projected = Object.freeze({
    biomeKey: semantic.biomeKey,
    completion: semantic.completion,
    completionOutline: semantic.completionOutline,
    defaultInspectorDestination: defaultInspector,
    ...(entry === undefined ? {} : { entry }),
    fields: semantic.fields,
    frontier,
    label: semantic.label,
    marker: semantic.marker,
    nodes: semantic.nodes,
    rail,
    source: semantic.source,
    status: semantic.status,
  });
  const presentationFocusDestinations = bindWorkspaceInspectorDestinations({
    biome: projected,
    destinationsByOwner: semantic.preliminaryFocusDestinations,
  });
  return Object.freeze({
    authoredLeafRequirements,
    batchInteractionRequirements: semantic.batchInteractionRequirements,
    biome: projected,
    focusDestinations: presentationFocusDestinations,
    frontierInteractionRequirements: semantic.frontierInteractionRequirements,
    hubInteractionRequirements: semantic.hubInteractionRequirements,
    occurrenceInteractionRequirements: semantic.occurrenceInteractionRequirements,
    roomControls: semantic.roomControls,
    rewardControls: semantic.rewardControls,
    startInteractionRequirements: semantic.startInteractionRequirements,
    takeoverInteractionRequirements: semantic.takeoverInteractionRequirements,
    topologyRemovalInteractionRequirements: semantic.topologyRemovalInteractionRequirements,
  });
}

function routeStatus(route: { readonly status: ProjectEvaluation['status'] }): WorkspaceStatus {
  return route.status;
}

function registerFindingDestinations(
  findings: readonly SemanticFinding[],
  focusByOwner: Map<string, WorkspaceInspectorDestination>,
): void {
  for (const finding of findings) {
    const key = semanticAddressKey(finding.origin);
    if (focusByOwner.has(key)) continue;
    if (isFineGrainedFindingOwner(finding.origin)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} finding has no exact workspace destination`,
      );
    }
    if (!('routeKey' in finding.origin) || !('biomeKey' in finding.origin)) continue;
    const biome = createBiomeAddress(finding.origin.routeKey, finding.origin.biomeKey);
    const fallback = focusByOwner.get(semanticAddressKey(biome));
    if (fallback === undefined) continue;
    // A coarse finding uses the biome's inspector fallback, but it is still an
    // explicit owner. Do not inherit a no-focus rail selection from the
    // biome shell (notably its active start frontier).
    focusByOwner.set(
      key,
      Object.freeze({
        ...(fallback.biomeKey === undefined ? {} : { biomeKey: fallback.biomeKey }),
        focusAddress: fallback.focusAddress,
        focusKey: fallback.focusKey,
        ...(fallback.inspectorSubject === undefined
          ? {}
          : { inspectorSubject: fallback.inspectorSubject }),
        nodeKey: fallback.nodeKey,
        ownerAddress: finding.origin,
        region: fallback.region,
        ...(fallback.routeKey === undefined ? {} : { routeKey: fallback.routeKey }),
      }),
    );
  }
}

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

export function createStructuredWorkspaceProjection(
  catalog: Catalog,
  services: StructuredWorkspaceContextualServices,
): StructuredWorkspaceProjectionService {
  const cache = new WeakMap<
    ProjectDocument,
    WeakMap<ProjectEvaluation, StructuredWorkspaceProjection>
  >();
  return Object.freeze({
    project(
      project: ProjectDocument,
      evaluation: ProjectEvaluation,
    ): StructuredWorkspaceProjection {
      assertProjectEvaluationSource(project, evaluation);
      const existing = cache.get(project)?.get(evaluation);
      if (existing !== undefined) return existing;
      const focusByOwner = new Map<string, WorkspaceInspectorDestination>();
      const occurrenceInteractionRequirements = new Map<
        string,
        WorkspaceOccurrenceInteractionRequirement
      >();
      const batchInteractionRequirements = new Map<string, WorkspaceBatchInteractionRequirement>();
      const hubInteractionRequirements = new Map<string, WorkspaceHubInteractionRequirement>();
      const topologyRemovalInteractionRequirements = new Map<
        string,
        WorkspaceTopologyRemovalInteractionRequirement
      >();
      const startInteractionRequirements = new Map<string, WorkspaceStartInteractionRequirement>();
      const takeoverInteractionRequirements = new Map<
        string,
        WorkspaceTakeoverInteractionRequirement
      >();
      const frontierInteractionRequirements = new Map<
        string,
        WorkspaceFrontierInteractionRequirement
      >();
      const roomControls = new Map<string, WorkspaceRoomPickerControl>();
      const rewardControls = new Map<string, WorkspaceRewardControl>();
      const authoredLeafRequirements: WorkspaceAuthoredLeafRequirement[] = [];
      const sources = createWorkspaceProjectSourceIndex(catalog, project, evaluation);
      const routes = sources.routes.map((routeSource) => {
        const biomes = routeSource.biomes.map((biomeSource) => {
          const projected = projectBiome(catalog, biomeSource);
          appendUniqueFocusDestinations(focusByOwner, projected.focusDestinations.entries());
          appendUniqueOccurrenceInteractionRequirements(
            occurrenceInteractionRequirements,
            projected.occurrenceInteractionRequirements.values(),
          );
          appendUniqueBatchInteractionRequirements(
            batchInteractionRequirements,
            projected.batchInteractionRequirements.values(),
          );
          appendUniqueHubInteractionRequirements(
            hubInteractionRequirements,
            projected.hubInteractionRequirements.values(),
          );
          appendUniqueTopologyRemovalInteractionRequirements(
            topologyRemovalInteractionRequirements,
            projected.topologyRemovalInteractionRequirements.values(),
          );
          appendUniqueStartInteractionRequirements(
            startInteractionRequirements,
            projected.startInteractionRequirements.values(),
          );
          appendUniqueTakeoverInteractionRequirements(
            takeoverInteractionRequirements,
            projected.takeoverInteractionRequirements.values(),
          );
          appendUniqueFrontierInteractionRequirements(
            frontierInteractionRequirements,
            projected.frontierInteractionRequirements.values(),
          );
          appendUniqueRoomControls(roomControls, projected.roomControls.values());
          appendUniqueRewardControls(rewardControls, projected.rewardControls.values());
          authoredLeafRequirements.push(...projected.authoredLeafRequirements);
          return projected.biome;
        });
        const routeAddress = { kind: 'route' as const, routeKey: routeSource.routeKey };
        const routeMarker = Object.freeze({
          address: routeAddress,
          assessment:
            routeSource.evaluation === undefined ? ('blocked' as const) : ('assessed' as const),
          findingCount: routeSource.evaluation?.findings.length ?? 0,
          focusKey: semanticAddressKey(routeAddress),
        });
        appendUniqueFocusDestinations(focusByOwner, [
          [
            routeMarker.focusKey,
            Object.freeze<WorkspaceInspectorDestination>({
              focusAddress: routeAddress,
              focusKey: routeMarker.focusKey,
              nodeKey: `route:${routeSource.routeKey}`,
              ownerAddress: routeAddress,
              region: 'routeRail',
              routeKey: routeSource.routeKey,
            }),
          ],
        ]);
        return Object.freeze({
          biomes: Object.freeze(biomes),
          label: catalog.routes.byKey[routeSource.routeKey]?.label ?? routeSource.routeKey,
          marker: routeMarker,
          rail: Object.freeze(
            biomes.map((biome) =>
              Object.freeze({
                biomeKey: biome.biomeKey,
                label: biome.label,
                marker: biome.marker,
                source: biome.source,
                status: biome.status,
              }),
            ),
          ),
          routeKey: routeSource.routeKey,
          status:
            routeSource.evaluation === undefined ? 'blocked' : routeStatus(routeSource.evaluation),
        });
      });
      registerFindingDestinations(evaluation.findings, focusByOwner);
      const interactions = bindWorkspaceInteractions({
        batchInteractionRequirements,
        catalog,
        evaluation,
        frontierInteractionRequirements,
        hubInteractionRequirements,
        occurrenceInteractionRequirements,
        project,
        rewardControls,
        roomControls,
        services,
        startInteractionRequirements,
        takeoverInteractionRequirements,
        topologyRemovalInteractionRequirements,
      });
      assertOccurrenceInteractionRequirementClosure(
        occurrenceInteractionRequirements.values(),
        interactions,
      );
      assertBatchInteractionRequirementClosure(batchInteractionRequirements.values(), interactions);
      assertHubInteractionRequirementClosure(hubInteractionRequirements.values(), interactions);
      assertTopologyRemovalInteractionRequirementClosure(
        topologyRemovalInteractionRequirements.values(),
        interactions,
      );
      assertStartInteractionRequirementClosure(
        startInteractionRequirements.values(),
        catalog,
        interactions,
      );
      assertTakeoverInteractionRequirementClosure(
        takeoverInteractionRequirements.values(),
        catalog,
        interactions,
      );
      assertFrontierInteractionRequirementClosure(
        frontierInteractionRequirements.values(),
        interactions,
      );
      assertWorkspaceInteractionClosure(
        routes,
        roomControls,
        rewardControls,
        interactions,
        Object.freeze([...authoredLeafRequirements]),
      );
      const projectAddress = { kind: 'project' as const };
      const result = Object.freeze({
        focusByOwner,
        interactions,
        marker: Object.freeze({
          address: projectAddress,
          assessment: 'assessed' as const,
          findingCount: evaluation.findings.length,
          focusKey: semanticAddressKey(projectAddress),
        }),
        routes: Object.freeze(routes),
        status: evaluation.status,
      });
      let byEvaluation = cache.get(project);
      if (byEvaluation === undefined) {
        byEvaluation = new WeakMap();
        cache.set(project, byEvaluation);
      }
      byEvaluation.set(evaluation, result);
      return result;
    },
  });
}
