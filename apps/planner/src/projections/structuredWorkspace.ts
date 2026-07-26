import {
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createCompletionRoomAddress,
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
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  describeTopologyRemovalImpact,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type AuthoredBatchState,
  type AuthoredRoomState,
  type BiomeAddress,
  type ExitDecision,
  type ExitDecisionAddress,
  type ExitDecisionSourceAddress,
  type HubDecision,
  type HubDecisionAddress,
  type HubSlotAddress,
  type LocalChildGroupAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
  type SideRoomGeneration,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import type {
  Catalog,
  CompletionRoomDescriptor,
  HubDecisionDescriptor,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBiome,
  CanonicalHubDecision,
  CanonicalLinkedExit,
  CanonicalTarget,
  MaterializedBiomePrefix,
  ProjectBiomeEvaluation,
  ProjectEvaluation,
  SemanticFinding,
} from '@run-planner/engine/simulation';
import {
  assertProjectEvaluationSource,
  evaluateBiomeCompleteness,
} from '@run-planner/engine/simulation';

import type {
  CandidateOptionProjection,
  CandidateSessionFactory,
  CountedRewardCandidateOwner,
  RewardCandidateOwner,
} from './candidateProjection';
import type { ContextualPickerModel, ContextualPickerProjectionService } from './contextualPicker';
import type { ProjectedRewardDomain } from './rewardDomainProjection';
import {
  roomCategoryForKind,
  roomSelectorCategories,
  selectRoomsForTargetCategory,
} from './roomSelectorProjection';
import {
  summarizeRewardOffer,
  type RewardPickerProjectionService,
  type RewardPickerStep,
} from './rewardPicker';

/**
 * This is deliberately a projection vocabulary, not a second topology model.
 * Every structural fact below comes from the unified authored topology or the
 * corresponding materialized engine product.
 */
export type WorkspaceAssessment = 'assessed' | 'blocked' | 'unassessed';
export type WorkspaceProjectionSource = 'authored' | 'canonical' | 'progressive';
export type WorkspaceStatus = 'blocked' | 'empty' | 'incomplete' | 'invalid' | 'valid';

export interface WorkspaceMarker {
  readonly address: SemanticAddress;
  readonly assessment: WorkspaceAssessment;
  readonly findingCount: number;
  readonly focusKey: string;
}

export interface WorkspaceInspectorDestination {
  readonly biomeKey?: string;
  readonly focusAddress: SemanticAddress;
  readonly focusKey: string;
  readonly nodeKey: string;
  readonly ownerAddress: SemanticAddress;
  readonly region: 'inspector' | 'routeRail' | 'structure';
  readonly routeKey?: string;
}

export interface WorkspaceInteractionChoice<T> {
  readonly label: string;
  readonly value: T;
}

export interface WorkspaceCandidateInteraction<T> {
  readonly choices: readonly WorkspaceInteractionChoice<T>[];
  readonly key: string;
  readonly load: () => readonly CandidateOptionProjection<T>[];
  readonly owner: SemanticAddress;
  readonly selected?: T;
}

export interface WorkspaceRewardInteraction {
  readonly authoredRewardTypes: readonly string[];
  readonly key: string;
  readonly owner: RewardCandidateOwner['address'];
  readonly choiceLabel: (step: RewardPickerStep, offer: ResolvedRewardOffer) => string;
  readonly load: () => Promise<ProjectedRewardDomain>;
  readonly model: (
    domain: ProjectedRewardDomain,
    step: RewardPickerStep,
    selected: ResolvedRewardOffer,
  ) => ContextualPickerModel<ResolvedRewardOffer>;
  readonly selected: ResolvedRewardOffer;
  readonly summary: (offer: ResolvedRewardOffer) => string;
}

export interface WorkspaceRoomInteraction {
  readonly choices: readonly {
    readonly category: string;
    readonly gameName: string;
    readonly label: string;
  }[];
  readonly key: string;
  readonly owner: TargetAddress;
  readonly load: () => ContextualPickerModel<RoomDeclaration>;
  readonly selected?: RoomDeclaration;
}

/** A start remains an authored action even when its declaration fixes the room. */
export interface WorkspaceStartInteraction {
  readonly fixedGameName?: string;
  readonly key: string;
  readonly load: () => ContextualPickerModel<RoomDeclaration>;
  readonly owner: BiomeAddress;
}

/**
 * Structural creation receives occurrence identities from the adapter. The
 * descriptor supplies every catalog-owned fact React needs to dispatch one
 * semantic command without interpreting topology.
 */
export type WorkspaceStructuralInteraction =
  | {
      readonly action: 'createBatch';
      readonly key: string;
      readonly owner: ExitDecisionAddress;
    }
  | {
      readonly action: 'createLinkedExit';
      readonly key: string;
      readonly owner: ExitDecisionAddress;
      readonly targetGameName: string;
    }
  | {
      readonly action: 'createHubDecision';
      readonly key: string;
      readonly owner: HubDecisionAddress;
    };

export interface WorkspaceExitSelectionInteraction {
  readonly key: string;
  readonly owner: ExitDecisionAddress;
  readonly selectedExitKey?: string;
  readonly targets: readonly WorkspaceInteractionChoice<string>[];
}

/** A closed Hub slot needs a new occurrence identity before it can be evaluated. */
export interface WorkspaceHubSlotInteraction {
  readonly choices: readonly WorkspaceInteractionChoice<boolean>[];
  readonly key: string;
  readonly owner: HubSlotAddress;
  readonly roomGameName: string;
  readonly selected: boolean;
  readonly load: (
    proposedOccurrenceId: OccurrenceId,
  ) => readonly CandidateOptionProjection<boolean>[];
}

/**
 * A takeover action is intentionally owned by an exit decision, never by a
 * target.  The application adapter obtains target ids from the loaded engine
 * evidence before dispatching its atomic command.
 */
export interface WorkspaceTakeoverBatchInteraction {
  readonly action: 'create' | 'replace' | 'reconcile';
  readonly impact?: WorkspaceTakeoverReplacementImpact;
  readonly key: string;
  readonly owner: ExitDecisionAddress;
  readonly selectedGameName?: string;
  readonly load: () => readonly CandidateOptionProjection<string>[];
}

export interface WorkspaceInteractionCatalog {
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly exitSelections: ReadonlyMap<string, WorkspaceExitSelectionInteraction>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceCandidateInteraction<'min' | 'max'>>;
  readonly hubSlots: ReadonlyMap<string, WorkspaceHubSlotInteraction>;
  readonly hubVisits: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly rewards: ReadonlyMap<string, WorkspaceRewardInteraction>;
  readonly rewardWheelOfferCounts: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelPicks: ReadonlyMap<string, WorkspaceCandidateInteraction<number>>;
  readonly rewardWheelStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly rooms: ReadonlyMap<string, WorkspaceRoomInteraction>;
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
  readonly starts: ReadonlyMap<string, WorkspaceStartInteraction>;
  readonly structural: ReadonlyMap<string, WorkspaceStructuralInteraction>;
  readonly takeoverBatches: ReadonlyMap<string, WorkspaceTakeoverBatchInteraction>;
}

export function workspaceInteractionKey(owner: SemanticAddress): string {
  return semanticAddressKey(owner);
}

export function workspaceSideRoomEntryOrderKey(
  owner: LocalChildGroupAddress,
  enteredSlotKeys: readonly string[],
): string {
  return `${semanticAddressKey(owner)}:order:${JSON.stringify(enteredSlotKeys)}`;
}

export function requireWorkspaceInteraction<T>(
  interactions: ReadonlyMap<string, T>,
  key: string,
): T {
  const interaction = interactions.get(key);
  if (interaction === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`interaction ${key} is missing`);
  }
  return interaction;
}

export interface WorkspaceRoomPickerControl {
  readonly address: TargetAddress;
  readonly kind: 'targetRoomPicker';
  readonly selectedGameName?: string;
}

interface WorkspaceRewardControlBase {
  readonly marker: WorkspaceMarker;
  readonly offer: ResolvedRewardOffer;
  readonly owner: RewardCandidateOwner;
}

export interface WorkspaceCountedRewardControl extends WorkspaceRewardControlBase {
  readonly binding: CountedRewardBinding;
  readonly kind: 'countedReward';
  readonly owner: CountedRewardCandidateOwner;
}

export interface WorkspaceExplicitRewardControl extends WorkspaceRewardControlBase {
  readonly kind: 'explicitReward';
  readonly rewardTypes: readonly string[];
}

export type WorkspaceRewardControl = WorkspaceCountedRewardControl | WorkspaceExplicitRewardControl;

export interface WorkspaceRoomSummary {
  readonly address: OccurrenceAddress;
  readonly entered: boolean;
  readonly gameName: string;
  readonly kind: RoomDeclaration['kind'];
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly occurrenceId: OccurrenceId;
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly rewardSummary?: string;
}

export interface WorkspacePhysicalTarget {
  readonly exitKey: string;
  readonly index: number;
  readonly marker: WorkspaceMarker;
  readonly physicalState: 'available' | 'unavailable';
  readonly selected: boolean;
  readonly retained: boolean;
  readonly nextPath: 'continuesSpine' | 'deadLeaf' | 'startsCompletion';
  readonly room: WorkspaceRoomSummary;
}

/** A declared physical exit that still needs its authored target occurrence. */
export interface WorkspaceMissingPhysicalTarget {
  readonly exitKey: string;
  readonly index: number;
  readonly marker: WorkspaceMarker;
  readonly owner: TargetAddress;
}

/**
 * The command layer determines structural deletion.  The workspace exposes
 * that exact current scope so an interaction adapter can describe it without
 * walking topology or rediscovering descendants from rendered rows.
 */
export interface WorkspaceBatchRepairScope {
  readonly command: 'ReconcileBatchExitCapacity' | 'ReconcileTakeoverBatch';
  readonly owner: ExitDecisionAddress;
  readonly removedDecisionOwners: readonly ExitDecisionAddress[];
  readonly removedOccurrenceIds: readonly OccurrenceId[];
}

/**
 * Replacing an ordinary batch with a takeover resets its target occurrences
 * and removes their descendants.  The adapter receives that exact command
 * impact rather than rediscovering topology from rendered nodes.
 */
export interface WorkspaceTakeoverReplacementImpact {
  readonly command: 'ReplaceWithTakeoverBatch';
  readonly owner: ExitDecisionAddress;
  readonly removedDecisionOwners: readonly ExitDecisionAddress[];
  readonly removedOccurrenceIds: readonly OccurrenceId[];
  readonly replacedOccurrenceIds: readonly OccurrenceId[];
}

export interface WorkspaceLinkedExitNode {
  readonly kind: 'linkedExit';
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly owner: ExitDecisionAddress;
  readonly source: ExitDecisionSourceAddress;
  readonly target: WorkspacePhysicalTarget;
}

interface WorkspaceBatchNodeBase {
  readonly batchState: CanonicalBatch['batchState'] | AuthoredBatchState;
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly missingTargets: readonly WorkspaceMissingPhysicalTarget[];
  readonly owner: ExitDecisionAddress;
  readonly repairScope?: WorkspaceBatchRepairScope;
  readonly rewardStore?: WorkspaceMarker;
  readonly selection: WorkspaceMarker;
  readonly source: ExitDecisionSourceAddress;
  readonly targets: readonly WorkspacePhysicalTarget[];
  readonly topologyState: 'complete' | 'partial' | 'retained';
}

export type WorkspaceAuthoringFrontier =
  | {
      readonly kind: 'start';
      readonly interactionKey: string;
      readonly marker: WorkspaceMarker;
      readonly owner: BiomeAddress;
    }
  | {
      readonly kind: 'exitDecision';
      readonly interactionKey: string;
      readonly marker: WorkspaceMarker;
      readonly owner: ExitDecisionAddress;
    }
  | {
      readonly kind: 'hubDecision';
      readonly interactionKey: string;
      readonly marker: WorkspaceMarker;
      readonly owner: HubDecisionAddress;
    }
  | {
      readonly kind: 'hubVisit';
      readonly interactionKey: string;
      readonly marker: WorkspaceMarker;
      readonly owner: ReturnType<typeof createHubVisitAddress>;
    };

export interface WorkspaceOrdinaryBatchNode extends WorkspaceBatchNodeBase {
  readonly kind: 'ordinaryBatch';
  readonly targetInteraction: 'replaceable';
}

export interface WorkspaceTakeoverBatchNode extends WorkspaceBatchNodeBase {
  readonly kind: 'takeoverBatch';
  readonly targetInteraction: 'readOnly';
  readonly takeoverInteractionKey: string;
}

/** I retains normal peers, so its Preboss stays in the ordinary target domain. */
export interface WorkspaceMixedBatchNode extends WorkspaceBatchNodeBase {
  readonly kind: 'mixedBatch';
  readonly targetInteraction: 'replaceable';
}

export interface WorkspaceHubSlot {
  readonly hubSlotKey: string;
  readonly marker: WorkspaceMarker;
  readonly open: boolean;
  readonly physicalDoorId: number;
  readonly room?: WorkspaceRoomSummary;
  readonly visited: boolean;
}

export interface WorkspaceHubVisit {
  readonly marker: WorkspaceMarker;
  readonly room?: WorkspaceRoomSummary;
  readonly hubSlotKey?: string;
  readonly visitIndex: number;
}

export interface WorkspaceHubDecisionNode {
  readonly kind: 'hubDecision';
  readonly key: string;
  readonly hubKey: string;
  readonly marker: WorkspaceMarker;
  readonly owner: HubDecisionAddress;
  readonly slots: readonly WorkspaceHubSlot[];
  readonly visits: readonly WorkspaceHubVisit[];
}

export interface WorkspaceOccurrenceWorkbenchNode {
  readonly kind: 'occurrenceWorkbench';
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly room: WorkspaceRoomSummary;
}

export interface WorkspaceCompletionNode {
  readonly kind: 'completion';
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly role: CompletionRoomDescriptor['role'];
  readonly gameName: string;
  readonly label: string;
}

export type WorkspaceNode =
  | WorkspaceLinkedExitNode
  | WorkspaceOrdinaryBatchNode
  | WorkspaceTakeoverBatchNode
  | WorkspaceMixedBatchNode
  | WorkspaceHubDecisionNode
  | WorkspaceOccurrenceWorkbenchNode
  | WorkspaceCompletionNode;

/** One envelope for every biome; the node union carries its structure. */
export interface WorkspaceBiome {
  readonly biomeKey: string;
  readonly completion: readonly WorkspaceCompletionNode[];
  readonly entry?: WorkspaceOccurrenceWorkbenchNode;
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly nodes: readonly WorkspaceNode[];
  readonly source: WorkspaceProjectionSource;
  readonly status: WorkspaceStatus;
}

export interface WorkspaceRouteRailBiome {
  readonly biomeKey: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly source: WorkspaceProjectionSource;
  readonly status: WorkspaceStatus;
}

export interface WorkspaceRoute {
  readonly biomes: readonly WorkspaceBiome[];
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly rail: readonly WorkspaceRouteRailBiome[];
  readonly routeKey: string;
  readonly status: WorkspaceStatus;
}

export interface StructuredWorkspaceProjection {
  readonly focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly marker: WorkspaceMarker;
  readonly routes: readonly WorkspaceRoute[];
  readonly status: WorkspaceStatus;
}

export interface StructuredWorkspaceProjectionService {
  project(project: ProjectDocument, evaluation: ProjectEvaluation): StructuredWorkspaceProjection;
}

export interface StructuredWorkspaceContextualServices {
  readonly candidateSessions: CandidateSessionFactory;
  readonly contextualPicker: ContextualPickerProjectionService;
  readonly rewardPicker: RewardPickerProjectionService;
}

export class StructuredWorkspaceProjectionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'StructuredWorkspaceProjectionContractError';
  }
}

interface MutableProjectionContext {
  readonly assessedKeys: ReadonlySet<string>;
  readonly catalog: Catalog;
  readonly evaluation: ProjectBiomeEvaluation | undefined;
  readonly findingsByOwner: ReadonlyMap<string, readonly SemanticFinding[]>;
  readonly focusByOwner: Map<string, WorkspaceInspectorDestination>;
  readonly biome: BiomeAddress;
  readonly routeKey: string;
  readonly roomControls: Map<string, WorkspaceRoomPickerControl>;
  readonly rewardControls: Map<string, WorkspaceRewardControl>;
}

function requireRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`room ${gameName} is missing`);
  }
  return room;
}

function statusFor(evaluation: ProjectBiomeEvaluation | undefined): WorkspaceStatus {
  if (evaluation === undefined) return 'blocked';
  if (evaluation.authoring === 'incomplete') return 'incomplete';
  return evaluation.validity;
}

function sourceFor(evaluation: ProjectBiomeEvaluation | undefined): WorkspaceProjectionSource {
  if (evaluation === undefined) return 'authored';
  return evaluation.authoring === 'complete' ? 'canonical' : 'progressive';
}

function isSemanticAddress(value: unknown): value is SemanticAddress {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return false;
  const address = value as Readonly<Record<string, unknown>>;
  const string = (key: string) => typeof address[key] === 'string';
  const biomeOwned = () => string('routeKey') && string('biomeKey');
  const occurrenceOwned = () => biomeOwned() && string('occurrenceId');
  switch (address.kind) {
    case 'project':
      return true;
    case 'route':
      return string('routeKey');
    case 'biome':
      return biomeOwned();
    case 'biomeField':
      return biomeOwned() && string('fieldKey');
    case 'occurrence':
    case 'incomingReward':
      return occurrenceOwned();
    case 'completionRoom':
      return biomeOwned() && string('role');
    case 'exitDecision':
    case 'exitSelection':
    case 'batchRewardStore':
      return biomeOwned() && typeof address.source === 'object' && address.source !== null;
    case 'target':
      return (
        biomeOwned() &&
        string('exitKey') &&
        typeof address.source === 'object' &&
        address.source !== null
      );
    case 'hubDecision':
    case 'hubOpenSet':
    case 'hubRoom':
      return biomeOwned() && string('hubKey');
    case 'hubSlot':
      return biomeOwned() && string('hubKey') && string('hubSlotKey');
    case 'hubVisit':
      return biomeOwned() && string('hubKey') && typeof address.visitIndex === 'number';
    case 'localReward':
    case 'localChild':
      return occurrenceOwned() && string('groupKey') && string('slotKey');
    case 'localChildGroup':
      return occurrenceOwned() && string('groupKey');
    case 'rewardWheel':
      return occurrenceOwned() && string('wheelKey');
    case 'rewardWheelOffer':
      return occurrenceOwned() && string('wheelKey') && string('offerKey');
    case 'shopOffer':
    case 'shopPurchase':
      return occurrenceOwned() && string('offerKey');
    default:
      return false;
  }
}

function assessedAddresses(value: unknown): ReadonlySet<string> {
  const keys = new Set<string>();
  const visited = new WeakSet<object>();
  const visit = (candidate: unknown): void => {
    if (typeof candidate !== 'object' || candidate === null || visited.has(candidate)) return;
    visited.add(candidate);
    if (isSemanticAddress(candidate)) keys.add(semanticAddressKey(candidate));
    for (const value of Array.isArray(candidate) ? candidate : Object.values(candidate))
      visit(value);
  };
  visit(value);
  return keys;
}

function assessmentFor(
  context: MutableProjectionContext,
  address: SemanticAddress,
): WorkspaceAssessment {
  const { evaluation } = context;
  if (evaluation === undefined) return 'blocked';
  if (evaluation.coverage.kind === 'none') return 'unassessed';
  if (evaluation.coverage.kind === 'complete') return 'assessed';
  const key = semanticAddressKey(address);
  return context.assessedKeys.has(key) || context.findingsByOwner.has(key)
    ? 'assessed'
    : 'unassessed';
}

function marker(
  context: MutableProjectionContext,
  address: SemanticAddress,
  nodeKey = semanticAddressKey(address),
): WorkspaceMarker {
  const focusKey = semanticAddressKey(address);
  const findings = context.findingsByOwner.get(focusKey) ?? [];
  const value = Object.freeze({
    address,
    assessment: assessmentFor(context, address),
    findingCount: findings.length,
    focusKey,
  });
  if (!context.focusByOwner.has(focusKey)) {
    context.focusByOwner.set(
      focusKey,
      Object.freeze({
        biomeKey: context.biome.biomeKey,
        focusAddress: address,
        focusKey,
        nodeKey,
        ownerAddress: address,
        region: 'structure',
        routeKey: context.routeKey,
      }),
    );
  }
  return value;
}

function summarizeOffers(catalog: Catalog, offers: readonly ResolvedRewardOffer[]): string {
  return offers.map((offer) => summarizeRewardOffer(catalog, offer)).join(', ');
}

function fixedRewardOffer(
  room: RoomDeclaration,
  state: Extract<AuthoredRoomState, { readonly kind: 'fixed' }>,
): ResolvedRewardOffer {
  if (room.incomingReward.kind !== 'fixed') {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} fixed state has ${room.incomingReward.kind} reward binding`,
    );
  }
  return Object.freeze({
    rewardType: room.incomingReward.offer.rewardType,
    ...(state.payload === undefined
      ? room.incomingReward.offer.payload === undefined
        ? {}
        : { payload: room.incomingReward.offer.payload }
      : { payload: state.payload }),
  });
}

function rewardSummary(
  catalog: Catalog,
  room: RoomDeclaration,
  state: AuthoredRoomState,
): string | undefined {
  switch (state.kind) {
    case 'none':
      return undefined;
    case 'fixed':
      return summarizeRewardOffer(catalog, fixedRewardOffer(room, state));
    case 'counted':
    case 'freeReward':
    case 'ephyraCombat':
      return summarizeRewardOffer(catalog, state.offer);
    case 'fieldsCombat': {
      const offers = Object.values(state.cages);
      return offers.length === 0
        ? 'Cages not configured'
        : `Cages · ${summarizeOffers(catalog, offers)}`;
    }
    case 'shipCombat': {
      const offers = Object.values(state.wheels).flatMap((wheel) => Object.values(wheel.offers));
      return offers.length === 0
        ? `${state.encounterCount} encounters · Wheels not configured`
        : `${state.encounterCount} encounters · ${summarizeOffers(catalog, offers)}`;
    }
    case 'shop': {
      if (state.shop === undefined) return 'Shop not configured';
      const offers = Object.values(state.shop.offers);
      return `${offers.length} offers · ${offers.filter((offer) => offer.purchased).length} purchased`;
    }
  }
}

function rewardControl(
  context: MutableProjectionContext,
  owner: RewardCandidateOwner,
  binding: CountedRewardBinding | undefined,
  offer: ResolvedRewardOffer,
  explicitRewardTypes: readonly string[] = Object.freeze([offer.rewardType]),
): WorkspaceRewardControl {
  const item =
    binding === undefined
      ? Object.freeze({
          kind: 'explicitReward' as const,
          marker: marker(context, owner.address),
          offer,
          owner,
          rewardTypes: Object.freeze([...explicitRewardTypes]),
        })
      : Object.freeze({
          kind: 'countedReward' as const,
          binding,
          marker: marker(context, owner.address),
          offer,
          owner: owner as CountedRewardCandidateOwner,
        });
  context.rewardControls.set(semanticAddressKey(owner.address), item);
  return item;
}

function incomingRewardBinding(
  room: RoomDeclaration,
  state: Extract<AuthoredRoomState, { readonly kind: 'counted' | 'ephyraCombat' | 'freeReward' }>,
): CountedRewardBinding {
  if (state.kind === 'freeReward') {
    const policy = room.prebossBatchPolicy;
    if (policy?.kind !== 'takeOverNormalDoors' || policy.remainingOffers.kind !== 'counted') {
      throw new StructuredWorkspaceProjectionContractError(
        `${room.gameName} free Preboss reward has no declared counted binding`,
      );
    }
    return policy.remainingOffers.reward;
  }
  if (room.incomingReward.kind !== 'countedChoice') {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} counted incoming reward has no declared binding`,
    );
  }
  return room.incomingReward;
}

function controlsForOccurrence(
  context: MutableProjectionContext,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
): readonly WorkspaceRewardControl[] {
  const controls: WorkspaceRewardControl[] = [];
  const incoming = createIncomingRewardAddress(context.biome, occurrence.occurrenceId);
  const addIncoming = (
    state: Extract<AuthoredRoomState, { readonly kind: 'counted' | 'ephyraCombat' | 'freeReward' }>,
  ) => {
    controls.push(
      rewardControl(
        context,
        { kind: 'incomingReward', address: incoming },
        incomingRewardBinding(room, state),
        state.offer,
      ),
    );
  };
  switch (occurrence.state.kind) {
    case 'counted':
    case 'freeReward':
      addIncoming(occurrence.state);
      break;
    case 'ephyraCombat': {
      addIncoming(occurrence.state);
      const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
      if (group === undefined && Object.keys(occurrence.state.sideRooms).length === 0) {
        break;
      }
      if (group?.kind !== 'fixedRoomSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ephyra state has no fixed side-room declaration`,
        );
      }
      for (const [slotKey, side] of Object.entries(occurrence.state.sideRooms)) {
        const slot = group.slots.find((candidate) => candidate.slotKey === slotKey);
        if (slot === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} has no side-room slot ${slotKey}`,
          );
        }
        const sideRoom = requireRoom(context.catalog, slot.roomGameName);
        if (sideRoom.incomingReward.kind !== 'countedChoice') {
          throw new StructuredWorkspaceProjectionContractError(
            `${sideRoom.gameName} side room has no counted reward binding`,
          );
        }
        const address = createLocalRewardAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        controls.push(
          rewardControl(
            context,
            { kind: 'localReward', address },
            sideRoom.incomingReward,
            side.offer,
          ),
        );
      }
      break;
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') break;
      for (const [slotKey, offer] of Object.entries(occurrence.state.cages)) {
        const address = createLocalRewardAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        controls.push(
          rewardControl(context, { kind: 'localReward', address }, group.reward, offer),
        );
      }
      break;
    }
    case 'shipCombat': {
      const profile = context.catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} encounter profile is missing`,
        );
      }
      for (const [wheelKey, wheel] of Object.entries(occurrence.state.wheels)) {
        const declaration = profile.phases.find(
          (phase) => phase.offerPoint?.key === wheelKey,
        )?.offerPoint;
        if (declaration === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} wheel ${wheelKey} has no reward declaration`,
          );
        }
        for (const [offerKey, offer] of Object.entries(wheel.offers)) {
          const address = createRewardWheelOfferAddress(
            context.biome,
            occurrence.occurrenceId,
            wheelKey,
            offerKey,
          );
          controls.push(
            rewardControl(
              context,
              { kind: 'rewardWheelOffer', address },
              declaration.reward,
              offer,
            ),
          );
        }
      }
      break;
    }
    case 'shop': {
      if (occurrence.state.shop === undefined) break;
      const profile = context.catalog.rewards.shops.byKey[occurrence.state.shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${occurrence.state.shop.profileKey} is missing`,
        );
      }
      for (const [offerKey, shopOffer] of Object.entries(occurrence.state.shop?.offers ?? {})) {
        const slot = profile.slots.byKey[offerKey];
        const group = slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
        if (group === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop offer ${offerKey} has no declared reward domain`,
          );
        }
        const address = createShopOfferAddress(context.biome, occurrence.occurrenceId, offerKey);
        controls.push(
          rewardControl(
            context,
            { kind: 'shopOffer', address },
            undefined,
            shopOffer.offer,
            group.rewardTypes,
          ),
        );
      }
      break;
    }
    case 'fixed':
    case 'none':
      break;
  }
  return Object.freeze(controls);
}

function projectOccurrence(
  context: MutableProjectionContext,
  occurrence: RoomOccurrence,
  entered = false,
): WorkspaceOccurrenceWorkbenchNode {
  const room = requireRoom(context.catalog, occurrence.gameName);
  const address = createOccurrenceAddress(context.biome, occurrence.occurrenceId);
  const summary = rewardSummary(context.catalog, room, occurrence.state);
  const roomSummary: WorkspaceRoomSummary = Object.freeze({
    address,
    entered,
    gameName: occurrence.gameName,
    kind: room.kind,
    label: room.label,
    marker: marker(context, address),
    occurrenceId: occurrence.occurrenceId,
    rewardControls: controlsForOccurrence(context, occurrence, room),
    ...(summary === undefined ? {} : { rewardSummary: summary }),
  });
  return Object.freeze({
    kind: 'occurrenceWorkbench' as const,
    key: `occurrence:${semanticAddressKey(address)}`,
    marker: roomSummary.marker,
    room: roomSummary,
  });
}

function authoredOccurrence(plan: AuthoredBiomePlan, id: OccurrenceId): RoomOccurrence | undefined {
  return plan.topology?.occurrences.find((candidate) => candidate.occurrenceId === id);
}

function canonicalRoomOccurrence(
  plan: AuthoredBiomePlan,
  room: CanonicalAuthoredRoom,
): RoomOccurrence | undefined {
  return authoredOccurrence(plan, room.occurrenceId);
}

function isTakeover(room: RoomDeclaration | undefined): boolean {
  return room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
}

function isMixed(room: RoomDeclaration | undefined): boolean {
  return room?.prebossBatchPolicy?.kind === 'retainNormalPeers';
}

function targetNode(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  target: CanonicalTarget,
): { readonly target: WorkspacePhysicalTarget; readonly node?: WorkspaceOccurrenceWorkbenchNode } {
  const occurrence = canonicalRoomOccurrence(plan, target.room);
  const node =
    occurrence === undefined
      ? undefined
      : projectOccurrence(context, occurrence, target.room.entered);
  const room = node?.room;
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${plan.biomeKey} materialized target ${target.room.occurrenceId} is absent from authored occurrences`,
    );
  }
  return Object.freeze({
    target: Object.freeze({
      exitKey: target.exit.exitKey,
      index: target.exit.index,
      marker: marker(context, target.origin),
      physicalState: target.exit.kind,
      selected: target.picked,
      retained: target.exit.kind === 'unavailable',
      nextPath: target.continuation,
      room,
    }),
    ...(node === undefined ? {} : { node }),
  });
}

function batchKind(
  catalog: Catalog,
  batch: CanonicalBatch,
): 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch' {
  const rooms = batch.targets.map((target) => catalog.rooms.byKey[target.room.gameName]);
  if (rooms.length > 0 && rooms.every(isTakeover)) return 'takeoverBatch';
  if (rooms.some(isMixed)) return 'mixedBatch';
  return 'ordinaryBatch';
}

function batchTopologyState(
  batch: CanonicalBatch,
  partial: boolean,
): 'complete' | 'partial' | 'retained' {
  if (partial) return 'partial';
  return batch.targets.some((target) => target.exit.kind === 'unavailable')
    ? 'retained'
    : 'complete';
}

function projectRemovalScope(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  roots: ReadonlySet<OccurrenceId>,
):
  | {
      readonly removedDecisionOwners: readonly ExitDecisionAddress[];
      readonly removedOccurrenceIds: readonly OccurrenceId[];
    }
  | undefined {
  const topology = plan.topology;
  if (topology === null) return undefined;
  if (roots.size === 0) return undefined;
  const impact = describeTopologyRemovalImpact(topology, roots);

  return Object.freeze({
    removedDecisionOwners: Object.freeze(
      impact.removedExitDecisionSources.map((source) => createExitDecisionAddress(biome, source)),
    ),
    removedOccurrenceIds: impact.removedOccurrenceIds,
  });
}

function batchRepairScope(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  batch: CanonicalBatch,
  kind: 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch',
): WorkspaceBatchRepairScope | undefined {
  const roots = new Set(
    batch.targets
      .filter((target) => target.exit.kind === 'unavailable')
      .map((target) => target.room.occurrenceId),
  );
  const removal = projectRemovalScope(context.biome, plan, roots);
  if (removal === undefined) return undefined;
  return Object.freeze({
    command: kind === 'takeoverBatch' ? 'ReconcileTakeoverBatch' : 'ReconcileBatchExitCapacity',
    owner: batch.origin,
    ...removal,
  });
}

function takeoverReplacementImpact(
  biome: BiomeAddress,
  plan: AuthoredBiomePlan,
  decision: ExitDecision,
): WorkspaceTakeoverReplacementImpact | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  const replacedOccurrenceIds = new Set(
    decision.normal.targets.map((target) => target.occurrenceId),
  );
  const removal = projectRemovalScope(biome, plan, replacedOccurrenceIds);
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

function missingTargetsForBatch(
  context: MutableProjectionContext,
  batch: CanonicalBatch,
): readonly WorkspaceMissingPhysicalTarget[] {
  if (batch.parent.origin.kind === 'hubRoom') return Object.freeze([]);
  const source = requireRoom(context.catalog, batch.parent.gameName);
  const authoredExitKeys = new Set(batch.targets.map((target) => target.exit.exitKey));
  return Object.freeze(
    [...source.exits]
      .sort((left, right) => left.index - right.index)
      .flatMap((exit) => {
        const exitKey = `exit${exit.index}`;
        if (authoredExitKeys.has(exitKey)) return [];
        const owner = createTargetAddress(context.biome, batch.source, exitKey);
        return [
          Object.freeze({
            exitKey,
            index: exit.index,
            marker: marker(context, owner),
            owner,
          }),
        ];
      }),
  );
}

function projectBatch(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  batch: CanonicalBatch,
  partial = false,
): {
  readonly batch: WorkspaceOrdinaryBatchNode | WorkspaceTakeoverBatchNode | WorkspaceMixedBatchNode;
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
} {
  const owner = batch.origin;
  const projectedTargets = batch.targets.map((target) => targetNode(context, plan, target));
  const kind = batchKind(context.catalog, batch);
  const repairScope = batchRepairScope(context, plan, batch, kind);
  const rewardStore =
    batch.rewardStore.kind === 'authoredBaseStore'
      ? marker(context, batch.rewardStore.origin)
      : undefined;
  const base = {
    batchState: batch.batchState,
    key: `batch:${semanticAddressKey(owner)}`,
    marker: marker(context, owner),
    missingTargets: missingTargetsForBatch(context, batch),
    owner,
    ...(repairScope === undefined ? {} : { repairScope }),
    ...(rewardStore === undefined ? {} : { rewardStore }),
    selection: marker(context, batch.selectedOrigin),
    source: batch.source,
    targets: Object.freeze(projectedTargets.map((value) => value.target)),
    topologyState: batchTopologyState(batch, partial),
  } as const;
  const projected =
    kind === 'takeoverBatch'
      ? Object.freeze({
          ...base,
          kind: 'takeoverBatch' as const,
          targetInteraction: 'readOnly' as const,
          takeoverInteractionKey: workspaceInteractionKey(owner),
        })
      : kind === 'mixedBatch'
        ? Object.freeze({
            ...base,
            kind: 'mixedBatch' as const,
            targetInteraction: 'replaceable' as const,
          })
        : Object.freeze({
            ...base,
            kind: 'ordinaryBatch' as const,
            targetInteraction: 'replaceable' as const,
          });
  return Object.freeze({
    batch: projected,
    workbenches: Object.freeze(
      projectedTargets.flatMap((value) => (value.node === undefined ? [] : [value.node])),
    ),
  });
}

function projectLinkedExit(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  linked: CanonicalLinkedExit,
): {
  readonly node: WorkspaceLinkedExitNode;
  readonly workbench?: WorkspaceOccurrenceWorkbenchNode;
} {
  const projected = targetNode(context, plan, linked.target);
  const node: WorkspaceLinkedExitNode = Object.freeze({
    kind: 'linkedExit' as const,
    key: `linked:${semanticAddressKey(linked.origin)}`,
    marker: marker(context, linked.origin),
    owner: linked.origin,
    source: { kind: 'occurrence' as const, occurrenceId: linked.source.occurrenceId },
    target: projected.target,
  });
  if (projected.node === undefined) return Object.freeze({ node });
  return Object.freeze({ node, workbench: projected.node });
}

function hubOccurrenceMap(plan: AuthoredBiomePlan): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(
    (plan.topology?.occurrences ?? []).map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
}

function projectHub(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  hub: CanonicalHubDecision,
  descriptor: HubDecisionDescriptor,
): {
  readonly node: WorkspaceHubDecisionNode;
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
} {
  const occurrences = hubOccurrenceMap(plan);
  const targets = new Map(hub.board.targets.map((target) => [target.hubSlotKey, target]));
  const visits = new Set(hub.visits.map((visit) => visit.target.hubSlotKey));
  const workbenches: WorkspaceOccurrenceWorkbenchNode[] = [];
  const slots = descriptor.slots.map((slot) => {
    const target = targets.get(slot.slotKey);
    const occurrence = target === undefined ? undefined : occurrences.get(target.room.occurrenceId);
    const room =
      occurrence === undefined
        ? undefined
        : projectOccurrence(context, occurrence, target?.room.entered ?? false).room;
    if (room !== undefined) {
      workbenches.push(
        Object.freeze({
          kind: 'occurrenceWorkbench' as const,
          key: `occurrence:${semanticAddressKey(room.address)}`,
          marker: room.marker,
          room,
        }),
      );
    }
    const address = createHubSlotAddress(context.biome, descriptor.hubKey, slot.slotKey);
    return Object.freeze({
      hubSlotKey: slot.slotKey,
      marker: marker(context, address),
      open: target !== undefined,
      physicalDoorId: slot.physicalDoorId,
      ...(room === undefined ? {} : { room }),
      visited: visits.has(slot.slotKey),
    });
  });
  const projectedVisits = hub.visits.map((visit) => {
    const room = workbenches.find(
      (workbench) => workbench.room.occurrenceId === visit.target.room.occurrenceId,
    )?.room;
    return Object.freeze({
      marker: marker(context, visit.origin),
      ...(room === undefined ? {} : { room }),
      hubSlotKey: visit.target.hubSlotKey,
      visitIndex: visit.visitIndex,
    });
  });
  return Object.freeze({
    node: Object.freeze({
      kind: 'hubDecision' as const,
      key: `hub:${semanticAddressKey(hub.origin)}`,
      hubKey: descriptor.hubKey,
      marker: marker(context, hub.origin),
      owner: hub.origin,
      slots: Object.freeze(slots),
      visits: Object.freeze(projectedVisits),
    }),
    workbenches: Object.freeze(workbenches),
  });
}

function projectAuthoredHub(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  hub: HubDecision,
  descriptor: HubDecisionDescriptor,
): {
  readonly node: WorkspaceHubDecisionNode;
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
} {
  const occurrences = hubOccurrenceMap(plan);
  const targets = new Map(hub.openTargets.map((target) => [target.hubSlotKey, target]));
  const visitSlots = new Set(hub.visitOrder);
  const workbenches: WorkspaceOccurrenceWorkbenchNode[] = [];
  const slotRooms = new Map<string, WorkspaceRoomSummary>();
  const slots = descriptor.slots.map((slot) => {
    const target = targets.get(slot.slotKey);
    const occurrence = target === undefined ? undefined : occurrences.get(target.occurrenceId);
    const workbench = occurrence === undefined ? undefined : projectOccurrence(context, occurrence);
    if (workbench !== undefined) {
      workbenches.push(workbench);
      slotRooms.set(slot.slotKey, workbench.room);
    }
    const address = createHubSlotAddress(context.biome, descriptor.hubKey, slot.slotKey);
    return Object.freeze({
      hubSlotKey: slot.slotKey,
      marker: marker(context, address),
      open: target !== undefined,
      physicalDoorId: slot.physicalDoorId,
      ...(workbench === undefined ? {} : { room: workbench.room }),
      visited: visitSlots.has(slot.slotKey),
    });
  });
  const visits = hub.visitOrder.map((hubSlotKey, index) =>
    Object.freeze({
      marker: marker(context, createHubVisitAddress(context.biome, descriptor.hubKey, index + 1)),
      ...(slotRooms.get(hubSlotKey) === undefined ? {} : { room: slotRooms.get(hubSlotKey)! }),
      hubSlotKey,
      visitIndex: index + 1,
    }),
  );
  const owner = createHubDecisionAddress(context.biome, descriptor.hubKey);
  return Object.freeze({
    node: Object.freeze({
      kind: 'hubDecision' as const,
      key: `hub:${semanticAddressKey(owner)}`,
      hubKey: descriptor.hubKey,
      marker: marker(context, owner),
      owner,
      slots: Object.freeze(slots),
      visits: Object.freeze(visits),
    }),
    workbenches: Object.freeze(workbenches),
  });
}

interface DeclaredPhysicalExit {
  readonly exitKey: string;
  readonly index: number;
}

type AuthoredBatchDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
};
type AuthoredLinkedExitDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'linked' }>;
};

function declaredPhysicalExits(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  source: ExitDecisionSourceAddress,
): readonly DeclaredPhysicalExit[] {
  if (source.kind === 'occurrence') {
    const occurrence = authoredOccurrence(plan, source.occurrenceId);
    if (occurrence === undefined) return Object.freeze([]);
    const room = requireRoom(context.catalog, occurrence.gameName);
    const normal = room.exits.map((exit) =>
      Object.freeze({ exitKey: `exit${exit.index}`, index: exit.index }),
    );
    const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
    if (
      layout?.progression.kind === 'hub' &&
      plan.topology?.startOccurrenceId === source.occurrenceId
    ) {
      return Object.freeze([
        ...normal,
        Object.freeze({ exitKey: layout.progression.linkedExit.exitKey, index: 1 }),
      ]);
    }
    return Object.freeze(normal);
  }
  const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
  return layout?.progression.kind === 'hub'
    ? Object.freeze([
        Object.freeze({
          exitKey: layout.progression.completedExit.exitKey,
          index: layout.progression.completedExit.physicalExit.index,
        }),
      ])
    : Object.freeze([]);
}

function rawBatchKind(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: AuthoredBatchDecision,
): 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch' {
  const rooms = decision.normal.targets.flatMap((target) => {
    const occurrence = authoredOccurrence(plan, target.occurrenceId);
    return occurrence === undefined ? [] : [requireRoom(context.catalog, occurrence.gameName)];
  });
  if (rooms.length > 0 && rooms.every(isTakeover)) return 'takeoverBatch';
  if (rooms.some(isMixed)) return 'mixedBatch';
  return 'ordinaryBatch';
}

function rawBatchTopologyState(
  context: MutableProjectionContext,
  owner: ExitDecisionAddress,
): 'partial' | 'retained' {
  const evaluation = context.evaluation;
  return evaluation?.authoring === 'incomplete' &&
    evaluation.coverage.kind === 'prefix' &&
    semanticAddressKey(evaluation.frontier) === semanticAddressKey(owner)
    ? 'partial'
    : 'retained';
}

function projectAuthoredBatch(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: AuthoredBatchDecision,
): {
  readonly batch: WorkspaceOrdinaryBatchNode | WorkspaceTakeoverBatchNode | WorkspaceMixedBatchNode;
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
} {
  const owner = createExitDecisionAddress(context.biome, decision.source);
  const physical = declaredPhysicalExits(context, plan, decision.source);
  const rank = new Map(physical.map((exit) => [exit.exitKey, exit.index] as const));
  const workbenches: WorkspaceOccurrenceWorkbenchNode[] = [];
  const targets = [...decision.normal.targets]
    .sort(
      (left, right) =>
        (rank.get(left.exitKey) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.exitKey) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((target) => {
      const occurrence = authoredOccurrence(plan, target.occurrenceId);
      if (occurrence === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${plan.biomeKey} target ${target.occurrenceId} is absent from authored occurrences`,
        );
      }
      const workbench = projectOccurrence(context, occurrence);
      workbenches.push(workbench);
      const exit = physical.find((candidate) => candidate.exitKey === target.exitKey);
      const targetAddress = createTargetAddress(context.biome, decision.source, target.exitKey);
      return Object.freeze({
        exitKey: target.exitKey,
        index: exit?.index ?? Number.MAX_SAFE_INTEGER,
        marker: marker(context, targetAddress),
        physicalState: exit === undefined ? ('unavailable' as const) : ('available' as const),
        selected:
          decision.selection.kind === 'normal' && decision.selection.exitKey === target.exitKey,
        retained: true,
        nextPath:
          requireRoom(context.catalog, occurrence.gameName).kind === 'Preboss'
            ? ('startsCompletion' as const)
            : decision.selection.kind === 'normal' && decision.selection.exitKey === target.exitKey
              ? ('continuesSpine' as const)
              : ('deadLeaf' as const),
        room: workbench.room,
      });
    });
  const targetsByKey = new Set(decision.normal.targets.map((target) => target.exitKey));
  const missingTargets = Object.freeze(
    physical
      .filter((exit) => !targetsByKey.has(exit.exitKey))
      .map((exit) => {
        const targetAddress = createTargetAddress(context.biome, decision.source, exit.exitKey);
        return Object.freeze({
          exitKey: exit.exitKey,
          index: exit.index,
          marker: marker(context, targetAddress),
          owner: targetAddress,
        });
      }),
  );
  const kind = rawBatchKind(context, plan, decision);
  const base = {
    batchState: decision.normal.batchState,
    key: `batch:${semanticAddressKey(owner)}`,
    marker: marker(context, owner),
    missingTargets,
    owner,
    ...(decision.normal.rewardStore.kind === 'authoredBaseStore'
      ? {
          rewardStore: marker(
            context,
            createBatchRewardStoreAddress(context.biome, decision.source),
          ),
        }
      : {}),
    selection: marker(context, createExitSelectionAddress(context.biome, decision.source)),
    source: decision.source,
    targets: Object.freeze(targets),
    topologyState: rawBatchTopologyState(context, owner),
  } as const;
  const batch: WorkspaceOrdinaryBatchNode | WorkspaceTakeoverBatchNode | WorkspaceMixedBatchNode =
    kind === 'takeoverBatch'
      ? Object.freeze({
          ...base,
          kind: 'takeoverBatch' as const,
          targetInteraction: 'readOnly' as const,
          takeoverInteractionKey: workspaceInteractionKey(owner),
        })
      : kind === 'mixedBatch'
        ? Object.freeze({
            ...base,
            kind: 'mixedBatch' as const,
            targetInteraction: 'replaceable' as const,
          })
        : Object.freeze({
            ...base,
            kind: 'ordinaryBatch' as const,
            targetInteraction: 'replaceable' as const,
          });
  return Object.freeze({ batch, workbenches: Object.freeze(workbenches) });
}

function projectAuthoredLinkedExit(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: AuthoredLinkedExitDecision,
): {
  readonly node: WorkspaceLinkedExitNode;
  readonly workbench: WorkspaceOccurrenceWorkbenchNode;
} {
  const occurrence = authoredOccurrence(plan, decision.normal.occurrenceId);
  if (occurrence === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${plan.biomeKey} linked target ${decision.normal.occurrenceId} is absent from authored occurrences`,
    );
  }
  const workbench = projectOccurrence(context, occurrence);
  const physical = declaredPhysicalExits(context, plan, decision.source).find(
    (exit) => exit.exitKey === decision.normal.exitKey,
  );
  const owner = createExitDecisionAddress(context.biome, decision.source);
  const targetAddress = createTargetAddress(
    context.biome,
    decision.source,
    decision.normal.exitKey,
  );
  return Object.freeze({
    node: Object.freeze({
      kind: 'linkedExit' as const,
      key: `linked:${semanticAddressKey(owner)}`,
      marker: marker(context, owner),
      owner,
      source: decision.source,
      target: Object.freeze({
        exitKey: decision.normal.exitKey,
        index: physical?.index ?? Number.MAX_SAFE_INTEGER,
        marker: marker(context, targetAddress),
        physicalState: physical === undefined ? ('unavailable' as const) : ('available' as const),
        selected: true,
        retained: true,
        nextPath: 'continuesSpine' as const,
        room: workbench.room,
      }),
    }),
    workbench,
  });
}

function authoredExitDecisionsInTopologyOrder(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
): readonly ExitDecision[] {
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const bySource = new Map(
    topology.decisions
      .filter((decision): decision is ExitDecision => decision.kind === 'exit')
      .map((decision) => [
        semanticAddressKey(createExitDecisionAddress(context.biome, decision.source)),
        decision,
      ]),
  );
  const ordered: ExitDecision[] = [];
  const visited = new Set<string>();
  const visit = (source: ExitDecisionSourceAddress): void => {
    const key = semanticAddressKey(createExitDecisionAddress(context.biome, source));
    if (visited.has(key)) return;
    const decision = bySource.get(key);
    if (decision === undefined) return;
    visited.add(key);
    ordered.push(decision);
    if (decision.normal.kind !== 'batch') return;
    const rank = new Map(
      declaredPhysicalExits(context, plan, decision.source).map(
        (exit) => [exit.exitKey, exit.index] as const,
      ),
    );
    for (const target of [...decision.normal.targets].sort(
      (left, right) =>
        (rank.get(left.exitKey) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(right.exitKey) ?? Number.MAX_SAFE_INTEGER),
    )) {
      visit({ kind: 'occurrence', occurrenceId: target.occurrenceId });
    }
  };
  visit({ kind: 'occurrence', occurrenceId: topology.startOccurrenceId });
  for (const [key, decision] of [...bySource.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!visited.has(key)) visit(decision.source);
  }
  return Object.freeze(ordered);
}

function partialBatchFromPrefix(prefix: MaterializedBiomePrefix): CanonicalBatch | undefined {
  return prefix.frontier?.kind === 'exitDecision' ? prefix.frontier.partialBatch : undefined;
}

function materialized(
  evaluation: ProjectBiomeEvaluation | undefined,
): CanonicalBiome | MaterializedBiomePrefix | undefined {
  if (evaluation === undefined) return undefined;
  if (evaluation.authoring === 'complete') return evaluation.snapshot;
  return 'materializedPrefix' in evaluation ? evaluation.materializedPrefix : undefined;
}

function authoringFrontier(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
): WorkspaceAuthoringFrontier | null {
  if (plan.topology === null) {
    return Object.freeze({
      kind: 'start' as const,
      interactionKey: semanticAddressKey(context.biome),
      marker: marker(context, context.biome),
      owner: context.biome,
    });
  }
  const completeness = evaluateBiomeCompleteness(context.catalog, context.biome, plan);
  if (completeness.completion === 'complete') return null;
  const frontier = completeness.frontier;
  switch (frontier.kind) {
    case 'exitDecision':
      return Object.freeze({
        kind: 'exitDecision' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker(context, frontier),
        owner: frontier,
      });
    case 'hubDecision':
      return Object.freeze({
        kind: 'hubDecision' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker(context, frontier),
        owner: frontier,
      });
    case 'hubVisit':
      return Object.freeze({
        kind: 'hubVisit' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker(context, frontier),
        owner: frontier,
      });
    default:
      return null;
  }
}

function indexFindings(
  findings: readonly SemanticFinding[],
): ReadonlyMap<string, readonly SemanticFinding[]> {
  const mutable = new Map<string, SemanticFinding[]>();
  for (const finding of findings) {
    const key = semanticAddressKey(finding.origin);
    const values = mutable.get(key);
    if (values === undefined) mutable.set(key, [finding]);
    else values.push(finding);
  }
  return new Map([...mutable].map(([key, value]) => [key, Object.freeze(value)] as const));
}

function targetControl(
  context: MutableProjectionContext,
  address: TargetAddress,
  selectedGameName: string | undefined,
): void {
  context.roomControls.set(
    semanticAddressKey(address),
    Object.freeze({
      address,
      kind: 'targetRoomPicker',
      ...(selectedGameName === undefined ? {} : { selectedGameName }),
    }),
  );
}

function indexOrdinaryTargetControls(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
): void {
  if (plan.topology === null) return;
  for (const decision of plan.topology.decisions) {
    if (decision.kind !== 'exit' || decision.normal.kind !== 'batch') continue;
    if (decision.source.kind !== 'occurrence') continue;
    const sourceOccurrence = authoredOccurrence(plan, decision.source.occurrenceId);
    if (sourceOccurrence === undefined) continue;
    const sourceRoom = requireRoom(context.catalog, sourceOccurrence.gameName);
    const targets = decision.normal.targets.map((target) => ({
      target,
      room: authoredOccurrence(plan, target.occurrenceId),
    }));
    if (
      targets.length > 0 &&
      targets.every((target) =>
        isTakeover(target.room && requireRoom(context.catalog, target.room.gameName)),
      )
    ) {
      continue;
    }
    const source = decision.source;
    for (const exit of [...sourceRoom.exits].sort((left, right) => left.index - right.index)) {
      const exitKey = `exit${exit.index}`;
      const target = targets.find((candidate) => candidate.target.exitKey === exitKey);
      targetControl(
        context,
        createTargetAddress(context.biome, source, exitKey),
        target?.room?.gameName,
      );
    }
  }
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

function storeLabel(storeKey: string): string {
  return storeKey === 'RunProgress'
    ? 'Run Progress'
    : storeKey === 'MetaProgress'
      ? 'Meta Progress'
      : storeKey;
}

function sideRoomOrderProposals(
  enteredSlotKeys: readonly string[],
  allSlotKeys: readonly string[],
): readonly (readonly string[])[] {
  const values = new Map<string, readonly string[]>();
  const add = (value: readonly string[]) =>
    values.set(JSON.stringify(value), Object.freeze([...value]));
  add(enteredSlotKeys);
  for (const slotKey of allSlotKeys) {
    const index = enteredSlotKeys.indexOf(slotKey);
    if (index < 0) add([...enteredSlotKeys, slotKey]);
    else add(enteredSlotKeys.filter((entry) => entry !== slotKey));
  }
  return Object.freeze([...values.values()]);
}

function createInteractionCatalog(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  services: StructuredWorkspaceContextualServices,
  roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>,
  rewardControls: ReadonlyMap<string, WorkspaceRewardControl>,
): WorkspaceInteractionCatalog {
  const candidates = services.candidateSessions.bind(project, evaluation);
  const rooms = new Map<string, WorkspaceRoomInteraction>();
  for (const [key, control] of roomControls) {
    const candidatesForCategories = roomSelectorCategories(
      catalog,
      control.address.biomeKey,
    ).flatMap((category) =>
      selectRoomsForTargetCategory(catalog, project, control.address, category),
    );
    const candidateRooms = Object.freeze([
      ...new Map(candidatesForCategories.map((room) => [room.gameName, room])).values(),
    ]);
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
            candidates.roomTargets(control.address, candidateRooms),
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
          : { selected: requireRoom(catalog, control.selectedGameName) }),
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

  const batchRewardStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const exitSelections = new Map<string, WorkspaceExitSelectionInteraction>();
  const fieldsCageOutcomes = new Map<string, WorkspaceCandidateInteraction<'min' | 'max'>>();
  const hubSlots = new Map<string, WorkspaceHubSlotInteraction>();
  const hubVisits = new Map<string, WorkspaceCandidateInteraction<string>>();
  const rewardWheelOfferCounts = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelPicks = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const shipEncounterCounts = new Map<string, WorkspaceCandidateInteraction<2 | 3>>();
  const shopPurchases = new Map<string, WorkspaceCandidateInteraction<boolean>>();
  const sideRoomEntryOrders = new Map<string, WorkspaceCandidateInteraction<readonly string[]>>();
  const sideRoomGenerations = new Map<string, WorkspaceCandidateInteraction<SideRoomGeneration>>();
  const starts = new Map<string, WorkspaceStartInteraction>();
  const structural = new Map<string, WorkspaceStructuralInteraction>();
  const takeoverBatches = new Map<string, WorkspaceTakeoverBatchInteraction>();

  for (const route of project.routes) {
    for (const plan of route.biomes) {
      const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
      const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
      if (layout === undefined) continue;
      if (plan.topology === null) {
        const rooms = Object.freeze(
          (layout.start.kind === 'authoredChoice'
            ? layout.start.roomGameNames
            : [layout.start.roomGameName]
          ).map((gameName) => requireRoom(catalog, gameName)),
        );
        let model: ContextualPickerModel<RoomDeclaration> | undefined;
        starts.set(
          semanticAddressKey(biome),
          Object.freeze({
            ...(layout.start.kind === 'fixedAuthored'
              ? { fixedGameName: layout.start.roomGameName }
              : {}),
            key: semanticAddressKey(biome),
            owner: biome,
            load(): ContextualPickerModel<RoomDeclaration> {
              if (model !== undefined) return model;
              model = services.contextualPicker.project(
                candidates.startRooms(biome, rooms),
                (option) =>
                  Object.freeze({
                    category: roomCategoryForKind(option.value.kind) ?? option.value.kind,
                    label: option.value.label,
                    selected: false,
                  }),
                (room) => room.gameName,
              );
              return model;
            },
          }),
        );
        continue;
      }
      const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
      for (const decision of plan.topology.decisions) {
        if (decision.kind === 'hub') {
          if (layout.progression.kind !== 'hub' || decision.hubKey !== layout.progression.hubKey)
            continue;
          for (const slot of layout.progression.slots) {
            const opened = decision.openTargets.find(
              (target) => target.hubSlotKey === slot.slotKey,
            );
            const owner = createHubSlotAddress(biome, decision.hubKey, slot.slotKey);
            const values = Object.freeze([false, true]);
            hubSlots.set(
              semanticAddressKey(owner),
              Object.freeze({
                choices: Object.freeze([
                  Object.freeze({ label: 'Closed', value: false }),
                  Object.freeze({ label: 'Open', value: true }),
                ]),
                key: semanticAddressKey(owner),
                load: (proposedOccurrenceId: OccurrenceId) =>
                  candidates.hubSlots(owner, opened?.occurrenceId ?? proposedOccurrenceId, values),
                owner,
                roomGameName: slot.roomGameName,
                selected: opened !== undefined,
              }),
            );
          }
          const hubSlotKeys = Object.freeze(layout.progression.slots.map((slot) => slot.slotKey));
          for (let visitIndex = 1; visitIndex <= decision.visitOrder.length + 1; visitIndex += 1) {
            if (visitIndex > layout.progression.requiredVisits) break;
            const slotKey = decision.visitOrder[visitIndex - 1];
            const owner = createHubVisitAddress(biome, decision.hubKey, visitIndex);
            hubVisits.set(
              semanticAddressKey(owner),
              candidateInteraction(
                owner,
                Object.freeze(hubSlotKeys.map((value) => Object.freeze({ label: value, value }))),
                slotKey,
                () => candidates.hubVisits(owner, hubSlotKeys),
              ),
            );
          }
          continue;
        }
        const owner = createExitDecisionAddress(biome, decision.source);
        if (decision.normal.kind === 'batch') {
          if (decision.selection.kind !== 'derived') {
            const sourceRoom =
              decision.source.kind === 'occurrence'
                ? authoredOccurrence(plan, decision.source.occurrenceId)
                : undefined;
            const physicalOrder = new Map<string, number>(
              (sourceRoom === undefined ? [] : requireRoom(catalog, sourceRoom.gameName).exits).map(
                (exit) => [`exit${exit.index}`, exit.index] as const,
              ),
            );
            const selection = createExitSelectionAddress(biome, decision.source);
            exitSelections.set(
              semanticAddressKey(selection),
              Object.freeze({
                key: semanticAddressKey(selection),
                owner,
                ...(decision.selection.kind === 'normal'
                  ? { selectedExitKey: decision.selection.exitKey }
                  : {}),
                targets: Object.freeze(
                  [...decision.normal.targets]
                    .sort(
                      (left, right) =>
                        (physicalOrder.get(left.exitKey) ?? Number.MAX_SAFE_INTEGER) -
                        (physicalOrder.get(right.exitKey) ?? Number.MAX_SAFE_INTEGER),
                    )
                    .map((target) =>
                      Object.freeze({ label: target.exitKey, value: target.exitKey }),
                    ),
                ),
              }),
            );
          }
          const targetRooms = decision.normal.targets.map((target) =>
            plan.topology!.occurrences.find((room) => room.occurrenceId === target.occurrenceId),
          );
          const targetDeclarations = targetRooms.map((room) =>
            room === undefined ? undefined : catalog.rooms.byKey[room.gameName],
          );
          const takeover = targetDeclarations.length > 0 && targetDeclarations.every(isTakeover);
          const takeoverGameNames = catalog.rooms.values
            .filter((room) => room.biomeKey === plan.biomeKey && isTakeover(room))
            .map((room) => room.gameName);
          if (takeover) {
            const gameName = targetRooms[0]?.gameName;
            takeoverBatches.set(
              semanticAddressKey(owner),
              Object.freeze({
                action: 'reconcile' as const,
                key: semanticAddressKey(owner),
                owner,
                ...(gameName === undefined ? {} : { selectedGameName: gameName }),
                load: () =>
                  candidates.takeoverPrebossBatches(
                    owner,
                    gameName === undefined ? [] : [gameName],
                  ),
              }),
            );
          } else {
            const policy =
              layout.progression.kind === 'generated'
                ? layout.progression.rewardStorePolicy
                : undefined;
            if (policy?.kind === 'authoredBaseStore') {
              const store = createBatchRewardStoreAddress(biome, decision.source);
              const selected =
                decision.normal.rewardStore.kind === 'authoredBaseStore'
                  ? (decision.normal.rewardStore.baseRewardStoreKey ?? undefined)
                  : undefined;
              batchRewardStores.set(
                semanticAddressKey(store),
                candidateInteraction(
                  store,
                  Object.freeze(
                    policy.storeKeys.map((value) =>
                      Object.freeze({ label: storeLabel(value), value }),
                    ),
                  ),
                  selected,
                  () => candidates.batchRewardStores(store, policy.storeKeys),
                ),
              );
            }
            if (
              layout.progression.kind === 'generated' &&
              layout.progression.batchPolicy.kind === 'fields'
            ) {
              fieldsCageOutcomes.set(
                semanticAddressKey(owner),
                candidateInteraction(
                  owner,
                  Object.freeze([
                    Object.freeze({ label: 'Minimum', value: 'min' as const }),
                    Object.freeze({ label: 'Maximum', value: 'max' as const }),
                  ]),
                  decision.normal.batchState?.cageOutcome,
                  () => candidates.fieldsCageOutcomes(owner, Object.freeze(['min', 'max'])),
                ),
              );
            }
            if (takeoverGameNames.length > 0) {
              const impact = takeoverReplacementImpact(biome, plan, decision);
              takeoverBatches.set(
                semanticAddressKey(owner),
                Object.freeze({
                  action: 'replace' as const,
                  ...(impact === undefined ? {} : { impact }),
                  key: semanticAddressKey(owner),
                  owner,
                  load: () => candidates.takeoverPrebossBatches(owner, takeoverGameNames),
                }),
              );
            }
          }
        } else if (layout.progression.kind === 'generated') {
          const candidatesForTakeover = catalog.rooms.values
            .filter((room) => room.biomeKey === plan.biomeKey && isTakeover(room))
            .map((room) => room.gameName);
          if (candidatesForTakeover.length > 0) {
            takeoverBatches.set(
              semanticAddressKey(owner),
              Object.freeze({
                action: 'create' as const,
                key: semanticAddressKey(owner),
                owner,
                load: () => candidates.takeoverPrebossBatches(owner, candidatesForTakeover),
              }),
            );
          }
        }
      }
      for (const occurrence of plan.topology.occurrences) {
        const room = catalog.rooms.byKey[occurrence.gameName];
        if (room === undefined) continue;
        const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
        if (occurrence.state.kind === 'shipCombat') {
          shipEncounterCounts.set(
            semanticAddressKey(occurrenceAddress),
            candidateInteraction(
              occurrenceAddress,
              Object.freeze([
                Object.freeze({ label: 'Intro + 1 combat', value: 2 as const }),
                Object.freeze({ label: 'Intro + 2 combats', value: 3 as const }),
              ]),
              occurrence.state.encounterCount,
              () => candidates.shipEncounterCounts(occurrenceAddress, Object.freeze([2, 3])),
            ),
          );
          for (const [wheelKey, wheel] of Object.entries(occurrence.state.wheels)) {
            const wheelAddress = createRewardWheelAddress(biome, occurrence.occurrenceId, wheelKey);
            const declaration = catalog.encounterProfiles.byKey[
              room.encounterProfileKey
            ]?.phases.find((phase) => phase.offerPoint?.key === wheelKey)?.offerPoint;
            if (declaration === undefined) continue;
            const countValues = Object.freeze(
              Array.from(
                { length: declaration.offerCount.max - declaration.offerCount.min + 1 },
                (_, index) => declaration.offerCount.min + index,
              ),
            );
            rewardWheelOfferCounts.set(
              semanticAddressKey(wheelAddress),
              candidateInteraction(
                wheelAddress,
                countValues.map((value) => Object.freeze({ label: String(value), value })),
                wheel.offerCount,
                () => candidates.rewardWheelOfferCounts(wheelAddress, countValues),
              ),
            );
            rewardWheelStores.set(
              semanticAddressKey(wheelAddress),
              candidateInteraction(
                wheelAddress,
                declaration.reward.storeKeys.map((value) =>
                  Object.freeze({ label: storeLabel(value), value }),
                ),
                wheel.storeKey,
                () => candidates.rewardWheelStores(wheelAddress, declaration.reward.storeKeys),
              ),
            );
            const picks = Object.freeze(
              Array.from({ length: wheel.offerCount }, (_, index) => index + 1),
            );
            rewardWheelPicks.set(
              semanticAddressKey(wheelAddress),
              candidateInteraction(
                wheelAddress,
                picks.map((value) => Object.freeze({ label: `Offer ${value}`, value })),
                wheel.pickedOfferIndex,
                () => candidates.rewardWheelPicks(wheelAddress, picks),
              ),
            );
          }
        }
        if (occurrence.state.kind === 'shop' && occurrence.state.shop !== undefined) {
          for (const [offerKey, offer] of Object.entries(occurrence.state.shop.offers)) {
            const purchase = createShopPurchaseAddress(biome, occurrence.occurrenceId, offerKey);
            shopPurchases.set(
              semanticAddressKey(purchase),
              candidateInteraction(
                purchase,
                Object.freeze([
                  Object.freeze({ label: 'Not purchased', value: false }),
                  Object.freeze({ label: 'Purchased', value: true }),
                ]),
                offer.purchased,
                () => candidates.shopPurchases(purchase, Object.freeze([false, true])),
              ),
            );
          }
        }
        if (occurrence.state.kind === 'ephyraCombat') {
          const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
          if (group?.kind !== 'fixedRoomSlots') continue;
          const groupAddress = createLocalChildGroupAddress(
            biome,
            occurrence.occurrenceId,
            group.key,
          );
          const entered = Object.entries(occurrence.state.sideRooms)
            .filter(([, value]) => value.enteredOrdinal !== null)
            .sort((left, right) => left[1].enteredOrdinal! - right[1].enteredOrdinal!)
            .map(([slotKey]) => slotKey);
          for (const slot of group.slots) {
            const side = occurrence.state.sideRooms[slot.slotKey];
            if (side === undefined) continue;
            const address = createLocalChildAddress(
              biome,
              occurrence.occurrenceId,
              group.key,
              slot.slotKey,
            );
            sideRoomGenerations.set(
              semanticAddressKey(address),
              candidateInteraction(
                address,
                Object.freeze([
                  Object.freeze({ label: 'Generated', value: 'generated' as const }),
                  Object.freeze({ label: 'Not generated', value: 'notGenerated' as const }),
                ]),
                side.generation,
                () =>
                  candidates.sideRoomGenerations(
                    address,
                    Object.freeze(['generated', 'notGenerated']),
                  ),
              ),
            );
          }
          for (const proposal of sideRoomOrderProposals(
            entered,
            group.slots.map((slot) => slot.slotKey),
          )) {
            const key = workspaceSideRoomEntryOrderKey(groupAddress, proposal);
            sideRoomEntryOrders.set(
              key,
              candidateInteraction(
                groupAddress,
                Object.freeze([Object.freeze({ label: 'Apply', value: proposal })]),
                proposal,
                () => candidates.sideRoomEntryOrders(groupAddress, Object.freeze([proposal])),
                key,
              ),
            );
          }
        }
      }
      if (completeness.completion === 'incomplete') {
        const frontier = completeness.frontier;
        if (frontier.kind === 'exitDecision') {
          const existing = plan.topology.decisions.find(
            (decision): decision is ExitDecision =>
              decision.kind === 'exit' &&
              semanticAddressKey(createExitDecisionAddress(biome, decision.source)) ===
                semanticAddressKey(frontier),
          );
          const gameNames = catalog.rooms.values
            .filter((room) => room.biomeKey === plan.biomeKey && isTakeover(room))
            .map((room) => room.gameName);
          if (gameNames.length > 0 && !takeoverBatches.has(semanticAddressKey(frontier))) {
            takeoverBatches.set(
              semanticAddressKey(frontier),
              Object.freeze({
                action:
                  existing?.normal.kind === 'batch' ? ('replace' as const) : ('create' as const),
                key: semanticAddressKey(frontier),
                owner: frontier,
                load: () => candidates.takeoverPrebossBatches(frontier, gameNames),
              }),
            );
          }
          if (existing === undefined && frontier.source.kind === 'occurrence') {
            const action: WorkspaceStructuralInteraction =
              layout.progression.kind === 'hub' &&
              frontier.source.occurrenceId === plan.topology.startOccurrenceId
                ? Object.freeze({
                    action: 'createLinkedExit' as const,
                    key: semanticAddressKey(frontier),
                    owner: frontier,
                    targetGameName: layout.progression.linkedExit.roomGameName,
                  })
                : Object.freeze({
                    action: 'createBatch' as const,
                    key: semanticAddressKey(frontier),
                    owner: frontier,
                  });
            structural.set(action.key, action);
          }
        } else if (frontier.kind === 'hubDecision') {
          const action: WorkspaceStructuralInteraction = Object.freeze({
            action: 'createHubDecision' as const,
            key: semanticAddressKey(frontier),
            owner: frontier,
          });
          structural.set(action.key, action);
        }
      }
    }
  }
  return Object.freeze({
    batchRewardStores,
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
  });
}

function projectBiome(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  evaluation: ProjectBiomeEvaluation | undefined,
  focusByOwner: Map<string, WorkspaceInspectorDestination>,
): {
  readonly biome: WorkspaceBiome;
  readonly roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
} {
  const biomeAddress = createBiomeAddress(routeKey, plan.biomeKey);
  const snapshot = materialized(evaluation);
  const context: MutableProjectionContext = {
    assessedKeys: assessedAddresses(snapshot),
    catalog,
    evaluation,
    findingsByOwner: indexFindings(evaluation?.findings ?? []),
    focusByOwner,
    biome: biomeAddress,
    routeKey,
    roomControls: new Map(),
    rewardControls: new Map(),
  };
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined)
    throw new StructuredWorkspaceProjectionContractError(`${plan.biomeKey} has no layout`);
  indexOrdinaryTargetControls(context, plan);
  const nodes: WorkspaceNode[] = [];
  let entry: WorkspaceOccurrenceWorkbenchNode | undefined;
  if (plan.topology !== null) {
    const start = authoredOccurrence(plan, plan.topology.startOccurrenceId);
    if (start !== undefined) {
      entry = projectOccurrence(
        context,
        start,
        materialized(evaluation)?.entryRoom?.entered ?? false,
      );
      nodes.push(entry);
    }
  }
  for (const decision of snapshot?.decisions ?? []) {
    switch (decision.kind) {
      case 'linkedExit': {
        const projected = projectLinkedExit(context, plan, decision);
        nodes.push(projected.node);
        if (projected.workbench !== undefined) nodes.push(projected.workbench);
        break;
      }
      case 'batch': {
        const projected = projectBatch(context, plan, decision);
        nodes.push(projected.batch, ...projected.workbenches);
        break;
      }
      case 'hub': {
        if (layout.progression.kind !== 'hub') {
          throw new StructuredWorkspaceProjectionContractError(
            `${plan.biomeKey} materialized Hub without Hub descriptor`,
          );
        }
        const projected = projectHub(context, plan, decision, layout.progression);
        nodes.push(projected.node, ...projected.workbenches);
        break;
      }
    }
  }
  if (layout.progression.kind === 'hub' && plan.topology !== null) {
    const hubDescriptor = layout.progression;
    const authoredHub = plan.topology.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === hubDescriptor.hubKey,
    );
    const alreadyProjected = nodes.some(
      (node) => node.kind === 'hubDecision' && node.hubKey === hubDescriptor.hubKey,
    );
    if (authoredHub !== undefined && !alreadyProjected) {
      const projected = projectAuthoredHub(context, plan, authoredHub, hubDescriptor);
      nodes.push(projected.node, ...projected.workbenches);
    }
  }
  const prefix = snapshot?.kind === 'biomePrefix' ? snapshot : undefined;
  const partial = prefix === undefined ? undefined : partialBatchFromPrefix(prefix);
  if (
    partial !== undefined &&
    !snapshot?.decisions.some(
      (decision) =>
        decision.kind === 'batch' &&
        semanticAddressKey(decision.origin) === semanticAddressKey(partial.origin),
    )
  ) {
    const projected = projectBatch(context, plan, partial, true);
    nodes.push(projected.batch, ...projected.workbenches);
  }
  const representedExitOwners = new Set(
    (snapshot?.decisions ?? [])
      .filter(
        (decision): decision is CanonicalLinkedExit | CanonicalBatch =>
          decision.kind === 'linkedExit' || decision.kind === 'batch',
      )
      .map((decision) => semanticAddressKey(decision.origin)),
  );
  if (partial !== undefined) representedExitOwners.add(semanticAddressKey(partial.origin));
  for (const decision of authoredExitDecisionsInTopologyOrder(context, plan)) {
    const owner = createExitDecisionAddress(context.biome, decision.source);
    if (representedExitOwners.has(semanticAddressKey(owner))) continue;
    if (decision.normal.kind === 'linked') {
      const projected = projectAuthoredLinkedExit(
        context,
        plan,
        decision as AuthoredLinkedExitDecision,
      );
      nodes.push(projected.node, projected.workbench);
    } else {
      const projected = projectAuthoredBatch(context, plan, decision as AuthoredBatchDecision);
      nodes.push(projected.batch, ...projected.workbenches);
    }
  }
  const completion = layout.completion.rooms.map((descriptor) => {
    const address = createCompletionRoomAddress(biomeAddress, descriptor.role);
    return Object.freeze({
      kind: 'completion' as const,
      key: `completion:${semanticAddressKey(address)}`,
      marker: marker(context, address),
      role: descriptor.role,
      gameName: descriptor.roomGameName,
      label: requireRoom(catalog, descriptor.roomGameName).label,
    });
  });
  nodes.push(...completion);
  const biomeMarker = marker(context, biomeAddress, `biome:${routeKey}:${plan.biomeKey}`);
  const projected = Object.freeze({
    biomeKey: plan.biomeKey,
    completion: Object.freeze(completion),
    ...(entry === undefined ? {} : { entry }),
    frontier: authoringFrontier(context, plan),
    label: catalog.biomes.byKey[plan.biomeKey]?.label ?? plan.biomeKey,
    marker: biomeMarker,
    nodes: Object.freeze(nodes),
    source: sourceFor(evaluation),
    status: statusFor(evaluation),
  });
  return Object.freeze({
    biome: projected,
    roomControls: context.roomControls,
    rewardControls: context.rewardControls,
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
    if (!('routeKey' in finding.origin) || !('biomeKey' in finding.origin)) continue;
    const biome = createBiomeAddress(finding.origin.routeKey, finding.origin.biomeKey);
    const fallback = focusByOwner.get(semanticAddressKey(biome));
    if (fallback === undefined) continue;
    focusByOwner.set(key, Object.freeze({ ...fallback, ownerAddress: finding.origin }));
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
      const roomControls = new Map<string, WorkspaceRoomPickerControl>();
      const rewardControls = new Map<string, WorkspaceRewardControl>();
      const routes = project.routes.map((route) => {
        const routeEvaluation = evaluation.routes.find(
          (candidate) => candidate.routeKey === route.routeKey,
        );
        const biomes = route.biomes.map((plan) => {
          const biomeEvaluation = routeEvaluation?.biomes.find(
            (candidate) => candidate.biomeKey === plan.biomeKey,
          );
          const projected = projectBiome(
            catalog,
            route.routeKey,
            plan,
            biomeEvaluation,
            focusByOwner,
          );
          for (const [key, control] of projected.roomControls) roomControls.set(key, control);
          for (const [key, control] of projected.rewardControls) rewardControls.set(key, control);
          return projected.biome;
        });
        const routeAddress = { kind: 'route' as const, routeKey: route.routeKey };
        const routeMarker = Object.freeze({
          address: routeAddress,
          assessment: routeEvaluation === undefined ? ('blocked' as const) : ('assessed' as const),
          findingCount: routeEvaluation?.findings.length ?? 0,
          focusKey: semanticAddressKey(routeAddress),
        });
        focusByOwner.set(
          routeMarker.focusKey,
          Object.freeze({
            focusAddress: routeAddress,
            focusKey: routeMarker.focusKey,
            nodeKey: `route:${route.routeKey}`,
            ownerAddress: routeAddress,
            region: 'routeRail',
            routeKey: route.routeKey,
          }),
        );
        return Object.freeze({
          biomes: Object.freeze(biomes),
          label: catalog.routes.byKey[route.routeKey]?.label ?? route.routeKey,
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
          routeKey: route.routeKey,
          status: routeEvaluation === undefined ? 'blocked' : routeStatus(routeEvaluation),
        });
      });
      registerFindingDestinations(evaluation.findings, focusByOwner);
      const projectAddress = { kind: 'project' as const };
      const result = Object.freeze({
        focusByOwner,
        interactions: createInteractionCatalog(
          catalog,
          project,
          evaluation,
          services,
          roomControls,
          rewardControls,
        ),
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
