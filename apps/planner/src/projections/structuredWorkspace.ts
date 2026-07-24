import {
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createCompletionRoomAddress,
  createContinuationAddress,
  createFixedEntryRoomAddress,
  createHubOpenSetAddress,
  createHubRoomAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createPickedAddress,
  createProjectAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRouteAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type AuthoredRoomState,
  type HubBiomePlan,
  type HubBiomeTopology,
  type BiomeAddress,
  type ContinuationAddress,
  type HubSlotAddress,
  type HubVisitAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
  type LinearBiomePlan,
  type LinearBiomeTopology,
  type OccurrenceId,
  type OccurrenceAddress,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
  type SideRoomGeneration,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import type {
  Catalog,
  CompletionRoomDescriptor,
  HubBiomeLayout,
  LinearBiomeLayout,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding, ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type {
  ProjectBiomeEvaluation,
  ProjectEvaluation,
  ProjectRouteEvaluation,
  SemanticFinding,
  CanonicalAuthoredRoom,
} from '@run-planner/engine/simulation';
import {
  assertProjectEvaluationSource,
  projectLinearBatchState,
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

export interface WorkspaceRoomSummary {
  readonly address: SemanticAddress;
  readonly entered: boolean;
  readonly gameName: string;
  readonly kind: RoomDeclaration['kind'];
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly contextualOwner?: WorkspaceContextualOwner;
  readonly occurrenceId?: OccurrenceId;
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly rewardSummary?: string;
}

export type WorkspaceRoomPickerControl =
  | {
      readonly address: BiomeAddress | OccurrenceAddress;
      readonly candidateGameNames: readonly string[];
      readonly kind: 'startRoomPicker';
      readonly selectedGameName?: string;
    }
  | {
      readonly address: TargetAddress;
      readonly kind: 'targetRoomPicker';
      readonly selectedGameName?: string;
    };

interface WorkspaceRewardControlBase {
  readonly marker: WorkspaceMarker;
  readonly offer: ResolvedRewardOffer;
  readonly owner: RewardCandidateOwner;
}

export interface WorkspaceCountedRewardControl extends WorkspaceRewardControlBase {
  readonly binding: CountedRewardBinding;
  readonly kind: 'countedReward';
  readonly owner: CountedRewardCandidateOwner;
  readonly parentMarker?: WorkspaceMarker;
}

export interface WorkspaceExplicitRewardControl extends WorkspaceRewardControlBase {
  readonly kind: 'explicitReward';
  readonly purchaseMarker?: WorkspaceMarker;
  readonly rewardTypes: readonly string[];
}

export type WorkspaceRewardControl = WorkspaceCountedRewardControl | WorkspaceExplicitRewardControl;

export type WorkspaceContextualOwner =
  | {
      readonly kind: 'startRoom';
      readonly address: BiomeAddress | OccurrenceAddress;
      readonly roomPicker: WorkspaceRoomPickerControl;
    }
  | { readonly kind: 'linearDecision'; readonly address: ContinuationAddress }
  | {
      readonly kind: 'linearTarget';
      readonly address: TargetAddress;
      readonly interaction: 'readOnly';
    }
  | {
      readonly kind: 'linearTarget';
      readonly address: TargetAddress;
      readonly interaction: 'replaceable';
      readonly roomPicker: WorkspaceRoomPickerControl;
    }
  | {
      readonly kind: 'roomState';
      readonly address: OccurrenceAddress;
      readonly rewards: readonly WorkspaceRewardControl[];
    }
  | { readonly kind: 'hubSlot'; readonly address: HubSlotAddress }
  | { readonly kind: 'hubVisit'; readonly address: HubVisitAddress }
  | {
      readonly kind: 'hubSideRoom';
      readonly address: LocalChildAddress;
      readonly reward: WorkspaceRewardControl;
    };

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
  readonly owner: WorkspaceRoomPickerControl['address'];
  readonly load: () => ContextualPickerModel<RoomDeclaration>;
  readonly selected?: RoomDeclaration;
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

export interface WorkspaceInteractionCatalog {
  readonly batchRewardStores: ReadonlyMap<string, WorkspaceCandidateInteraction<string>>;
  readonly fieldsCageOutcomes: ReadonlyMap<string, WorkspaceCandidateInteraction<'min' | 'max'>>;
  readonly hubSlots: ReadonlyMap<string, WorkspaceCandidateInteraction<boolean>>;
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

export interface WorkspaceCompletionLandmark {
  readonly gameName: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly role: CompletionRoomDescriptor['role'];
}

export type WorkspaceProgressionOutline =
  | { readonly kind: 'exact'; readonly decisionCount: number }
  | { readonly kind: 'hubVisits'; readonly visitCount: number }
  | { readonly kind: 'staged'; readonly stageKeys: readonly string[] }
  | { readonly kind: 'variable' };

export interface WorkspaceTerminalOutline {
  readonly gameName: string;
  readonly label: string;
  readonly policy: LinearBiomeLayout['terminal']['kind'] | HubBiomeLayout['terminal']['kind'];
}

export interface WorkspaceEmptyOutline {
  readonly completion: readonly WorkspaceCompletionLandmark[];
  readonly progression: WorkspaceProgressionOutline;
  readonly terminal: WorkspaceTerminalOutline;
}

export interface WorkspaceLinearEntry {
  readonly contextualOwner?: WorkspaceContextualOwner;
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly role: string;
  readonly room?: WorkspaceRoomSummary;
  readonly roomChoices?: readonly { readonly gameName: string; readonly label: string }[];
}

export interface WorkspaceLinearTarget {
  readonly contextualOwner: WorkspaceContextualOwner;
  readonly exitIndex: number;
  readonly marker: WorkspaceMarker;
  readonly picked: boolean;
  readonly retained: boolean;
  readonly room: WorkspaceRoomSummary;
}

export interface WorkspaceLinearDecision {
  readonly contextualOwner: WorkspaceContextualOwner;
  readonly findingCount: number;
  readonly kind: 'batch';
  readonly marker: WorkspaceMarker;
  readonly parentOccurrenceId: OccurrenceId | null;
  readonly pickedMarker: WorkspaceMarker;
  readonly pickedExitIndex: number | null;
  readonly rewardStoreMarker: WorkspaceMarker;
  readonly retainedOverflow: boolean;
  readonly targets: readonly WorkspaceLinearTarget[];
}

interface ProjectedLinearTerminalDecision {
  readonly contextualOwner: WorkspaceContextualOwner;
  readonly findingCount: number;
  readonly kind: 'terminal';
  readonly marker: WorkspaceMarker;
  readonly parentOccurrenceId: OccurrenceId | null;
  readonly pickedMarker: WorkspaceMarker;
  readonly pickedExitIndex: number | null;
  readonly rewardStoreMarker?: WorkspaceMarker;
  readonly retainedOverflow: boolean;
  readonly targets: readonly WorkspaceLinearTarget[];
}

type ProjectedLinearContinuation = WorkspaceLinearDecision | ProjectedLinearTerminalDecision;

export interface WorkspaceLinearTerminal {
  readonly findingCount: number;
  readonly marker: WorkspaceMarker;
  readonly outline: WorkspaceTerminalOutline;
  readonly realization: 'generatedPeer' | 'independent' | 'projected';
  readonly targets: readonly WorkspaceLinearTarget[];
}

export interface WorkspaceLinearBiome {
  readonly biomeKey: string;
  readonly completion: readonly WorkspaceCompletionLandmark[];
  readonly decisions: readonly WorkspaceLinearDecision[];
  readonly emptyOutline: WorkspaceEmptyOutline;
  readonly entries: readonly WorkspaceLinearEntry[];
  readonly frontier: WorkspaceMarker | null;
  readonly kind: 'LinearBiome';
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly source: WorkspaceProjectionSource;
  readonly status: WorkspaceStatus;
  readonly terminal: WorkspaceLinearTerminal;
  readonly trunk: readonly WorkspaceRoomSummary[];
}

export interface WorkspaceHubSideRoom {
  readonly contextualOwner: WorkspaceContextualOwner;
  readonly enteredOrdinal: number | null;
  readonly generation: 'generated' | 'notGenerated';
  readonly marker: WorkspaceMarker;
  readonly rewardSummary: string;
  readonly slotKey: string;
}

export interface WorkspaceHubSlot {
  readonly contextualOwner: WorkspaceContextualOwner;
  readonly hubSlotKey: string;
  readonly marker: WorkspaceMarker;
  readonly open: boolean;
  readonly physicalDoorId: number;
  readonly room?: WorkspaceRoomSummary;
  readonly sideRooms: readonly WorkspaceHubSideRoom[];
  readonly visited: boolean;
}

export interface WorkspaceHubVisit {
  readonly authored: boolean;
  readonly contextualOwner: WorkspaceContextualOwner;
  readonly hubSlotKey?: string;
  readonly marker: WorkspaceMarker;
  readonly room?: WorkspaceRoomSummary;
  readonly visitIndex: number;
}

export interface WorkspaceHubBiome {
  readonly biomeKey: string;
  readonly board: {
    readonly generationRegion: 'joint';
    readonly marker: WorkspaceMarker;
    readonly openCount: HubBiomeLayout['hub']['openCount'];
    readonly slots: readonly WorkspaceHubSlot[];
  };
  readonly completion: readonly WorkspaceCompletionLandmark[];
  readonly emptyOutline: WorkspaceEmptyOutline;
  readonly entries: readonly WorkspaceLinearEntry[];
  readonly frontier: WorkspaceMarker | null;
  readonly kind: 'HubBiome';
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly source: WorkspaceProjectionSource;
  readonly status: WorkspaceStatus;
  readonly terminal: WorkspaceLinearEntry;
  readonly visits: readonly WorkspaceHubVisit[];
}

export type WorkspaceBiome = WorkspaceHubBiome | WorkspaceLinearBiome;

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

interface ProjectionContext {
  readonly assessedKeys: ReadonlySet<string>;
  readonly biomeKey: string;
  readonly enteredOccurrenceKeys: ReadonlySet<string>;
  readonly evaluation: ProjectBiomeEvaluation | undefined;
  readonly findings: readonly SemanticFinding[];
  readonly findingsByOwner: ReadonlyMap<string, readonly SemanticFinding[]>;
  readonly focusByOwner: Map<string, WorkspaceInspectorDestination>;
  readonly project: ProjectDocument;
  readonly routeKey: string;
}

function requireRoom(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`room ${gameName} is missing`);
  }
  return room;
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

function roomRewardSummary(
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
      if (state.shop === undefined) {
        return 'Shop not configured';
      }
      const offers = Object.values(state.shop.offers);
      return `${offers.length} offers · ${offers.filter((offer) => offer.purchased).length} purchased`;
    }
  }
}

function addEnteredRoom(keys: Set<string>, room: CanonicalAuthoredRoom): void {
  if (room.entered) {
    keys.add(semanticAddressKey(room.origin));
  }
}

function enteredOccurrenceKeys(
  evaluation: ProjectBiomeEvaluation | undefined,
): ReadonlySet<string> {
  const keys = new Set<string>();
  if (evaluation === undefined) {
    return keys;
  }
  const materialized =
    evaluation.authoring === 'complete'
      ? evaluation.snapshot
      : 'materializedPrefix' in evaluation
        ? evaluation.materializedPrefix
        : undefined;
  if (materialized === undefined) {
    return keys;
  }
  for (const room of materialized.entryRooms) {
    if (room.kind === 'authored') {
      addEnteredRoom(keys, room);
    }
  }
  if (materialized.kind === 'LinearBiome' || materialized.kind === 'LinearBiomePrefix') {
    for (const batch of materialized.batches) {
      for (const target of batch.targets) {
        addEnteredRoom(keys, target.room);
      }
    }
    if (materialized.kind === 'LinearBiome') {
      for (const target of materialized.terminalEntry.targets) {
        addEnteredRoom(keys, target.room);
      }
    } else if (materialized.frontierGeneration !== undefined) {
      for (const target of materialized.frontierGeneration.targets) {
        addEnteredRoom(keys, target.room);
      }
    }
    return keys;
  }
  if (materialized.hubBoard !== undefined) {
    for (const target of materialized.hubBoard.targets) {
      addEnteredRoom(keys, target.room);
    }
  }
  if (materialized.kind === 'HubBiome') {
    addEnteredRoom(keys, materialized.terminalEntry);
  } else if (materialized.frontierVisit !== undefined) {
    addEnteredRoom(keys, materialized.frontierVisit.target.room);
  }
  return keys;
}

function isSemanticAddress(value: unknown): value is SemanticAddress {
  if (typeof value !== 'object' || value === null || !('kind' in value)) {
    return false;
  }
  const address = value as Readonly<Record<string, unknown>>;
  const kind = address.kind;
  const stringField = (key: string) => typeof address[key] === 'string';
  const biomeOwned = () => stringField('routeKey') && stringField('biomeKey');
  const occurrenceOwned = () => biomeOwned() && stringField('occurrenceId');
  const continuationOwned = () =>
    biomeOwned() &&
    (address.parentOccurrenceId === null || typeof address.parentOccurrenceId === 'string');
  switch (kind) {
    case 'project':
      return true;
    case 'route':
      return stringField('routeKey');
    case 'biome':
    case 'hubOpenSet':
    case 'hubRoom':
      return biomeOwned();
    case 'occurrence':
    case 'incomingReward':
      return occurrenceOwned();
    case 'completionRoom':
    case 'fixedEntryRoom':
    case 'fixedEntryReward':
    case 'fixedEntryTarget':
      return biomeOwned() && stringField('role');
    case 'continuation':
    case 'batchRewardStore':
    case 'picked':
      return continuationOwned();
    case 'target':
      return continuationOwned() && typeof address.exitIndex === 'number';
    case 'localReward':
    case 'localChild':
      return occurrenceOwned() && stringField('groupKey') && stringField('slotKey');
    case 'localChildGroup':
      return occurrenceOwned() && stringField('groupKey');
    case 'rewardWheel':
      return occurrenceOwned() && stringField('wheelKey');
    case 'rewardWheelOffer':
      return occurrenceOwned() && stringField('wheelKey') && stringField('offerKey');
    case 'hubSlot':
      return biomeOwned() && stringField('hubSlotKey');
    case 'hubVisit':
      return biomeOwned() && typeof address.visitIndex === 'number';
    case 'shopPurchase':
    case 'shopOffer':
      return occurrenceOwned() && stringField('offerKey');
    default:
      return false;
  }
}

function collectAssessedAddresses(value: unknown): ReadonlySet<string> {
  const keys = new Set<string>();
  const visited = new WeakSet<object>();
  const visit = (candidate: unknown): void => {
    if (typeof candidate !== 'object' || candidate === null || visited.has(candidate)) {
      return;
    }
    visited.add(candidate);
    if (isSemanticAddress(candidate)) {
      keys.add(semanticAddressKey(candidate));
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        visit(item);
      }
      return;
    }
    for (const item of Object.values(candidate)) {
      visit(item);
    }
  };
  visit(value);
  return keys;
}

function countedRewardControl(
  context: ProjectionContext,
  owner: CountedRewardCandidateOwner,
  binding: CountedRewardBinding,
  offer: ResolvedRewardOffer,
  nodeAddress: SemanticAddress,
): WorkspaceCountedRewardControl {
  return Object.freeze({
    binding,
    kind: 'countedReward',
    marker: marker(context, owner.address, 'inspector', nodeAddress),
    offer,
    owner,
  });
}

function explicitRewardControl(
  context: ProjectionContext,
  owner: RewardCandidateOwner,
  rewardTypes: readonly string[],
  offer: ResolvedRewardOffer,
  nodeAddress: SemanticAddress,
  purchaseMarker?: WorkspaceMarker,
): WorkspaceExplicitRewardControl {
  return Object.freeze({
    kind: 'explicitReward',
    marker: marker(context, owner.address, 'inspector', nodeAddress),
    offer,
    owner,
    ...(purchaseMarker === undefined ? {} : { purchaseMarker }),
    rewardTypes,
  });
}

function incomingRewardBinding(
  room: RoomDeclaration,
  state: Extract<AuthoredRoomState, { readonly kind: 'counted' | 'ephyraCombat' | 'freeReward' }>,
): CountedRewardBinding {
  if (state.kind === 'freeReward') {
    if (room.entryOfferPolicy === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${room.gameName} has no terminal free-reward binding`,
      );
    }
    return room.entryOfferPolicy.freeReward;
  }
  if (room.incomingReward.kind !== 'countedChoice') {
    throw new StructuredWorkspaceProjectionContractError(
      `${room.gameName} has no counted incoming-reward binding`,
    );
  }
  return room.incomingReward;
}

function roomRewardControls(
  catalog: Catalog,
  context: ProjectionContext,
  room: RoomDeclaration,
  occurrence: RoomOccurrence,
): readonly WorkspaceRewardControl[] {
  const biome = createBiomeAddress(context.routeKey, context.biomeKey);
  const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
  const state = occurrence.state;
  switch (state.kind) {
    case 'none':
      return Object.freeze([]);
    case 'fixed': {
      const offer = fixedRewardOffer(room, state);
      const rewardType = catalog.rewards.rewardTypes.byKey[offer.rewardType];
      if (rewardType === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} fixed reward type ${offer.rewardType} is missing`,
        );
      }
      if (rewardType.payloadDomain === undefined) {
        return Object.freeze([]);
      }
      const address = createIncomingRewardAddress(biome, occurrence.occurrenceId);
      return Object.freeze([
        explicitRewardControl(
          context,
          { kind: 'incomingReward', address },
          Object.freeze([offer.rewardType]),
          offer,
          occurrenceAddress,
        ),
      ]);
    }
    case 'counted':
    case 'freeReward': {
      const address = createIncomingRewardAddress(biome, occurrence.occurrenceId);
      return Object.freeze([
        countedRewardControl(
          context,
          { kind: 'incomingReward', address },
          incomingRewardBinding(room, state),
          state.offer,
          occurrenceAddress,
        ),
      ]);
    }
    case 'ephyraCombat': {
      const incomingAddress = createIncomingRewardAddress(biome, occurrence.occurrenceId);
      const controls: WorkspaceRewardControl[] = [
        countedRewardControl(
          context,
          { kind: 'incomingReward', address: incomingAddress },
          incomingRewardBinding(room, state),
          state.offer,
          occurrenceAddress,
        ),
      ];
      const group = room.localChildren.find(
        (descriptor) => descriptor.kind === 'fixedRoomSlots' && descriptor.key === 'sideRooms',
      );
      if (group === undefined && Object.keys(state.sideRooms).length === 0) {
        return Object.freeze(controls);
      }
      if (group?.kind !== 'fixedRoomSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} has no fixed side-room group`,
        );
      }
      for (const slot of group.slots) {
        const sideState = state.sideRooms[slot.slotKey];
        const sideRoom = requireRoom(catalog, slot.roomGameName);
        if (sideState === undefined || sideRoom.incomingReward.kind !== 'countedChoice') {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} side room ${slot.slotKey} has no counted reward`,
          );
        }
        const address = createLocalRewardAddress(
          biome,
          occurrence.occurrenceId,
          group.key,
          slot.slotKey,
        );
        controls.push(
          countedRewardControl(
            context,
            { kind: 'localReward', address },
            sideRoom.incomingReward,
            sideState.offer,
            createLocalChildAddress(biome, occurrence.occurrenceId, group.key, slot.slotKey),
          ),
        );
      }
      return Object.freeze(controls);
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find(
        (descriptor) => descriptor.kind === 'boundedRewardSlots' && descriptor.key === 'cages',
      );
      if (group?.kind !== 'boundedRewardSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} has no bounded cage group`,
        );
      }
      return Object.freeze(
        group.slotKeys.map((slotKey) => {
          const offer = state.cages[slotKey];
          if (offer === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${room.gameName} cage ${slotKey} is missing`,
            );
          }
          const address = createLocalRewardAddress(
            biome,
            occurrence.occurrenceId,
            group.key,
            slotKey,
          );
          return countedRewardControl(
            context,
            { kind: 'localReward', address },
            group.reward,
            offer,
            occurrenceAddress,
          );
        }),
      );
    }
    case 'shipCombat': {
      const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} encounter profile is missing`,
        );
      }
      const controls: WorkspaceRewardControl[] = [];
      for (const phase of profile.phases) {
        const descriptor = phase.offerPoint;
        if (descriptor === undefined) {
          continue;
        }
        const wheel = state.wheels[descriptor.key];
        if (wheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} wheel ${descriptor.key} is missing`,
          );
        }
        const wheelMarker = marker(
          context,
          createRewardWheelAddress(biome, occurrence.occurrenceId, descriptor.key),
          'inspector',
          occurrenceAddress,
        );
        for (const offerKey of descriptor.offerKeys) {
          const offer = wheel.offers[offerKey];
          if (offer === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${room.gameName}.${descriptor.key} offer ${offerKey} is missing`,
            );
          }
          const address = createRewardWheelOfferAddress(
            biome,
            occurrence.occurrenceId,
            descriptor.key,
            offerKey,
          );
          controls.push(
            Object.freeze({
              ...countedRewardControl(
                context,
                { kind: 'rewardWheelOffer', address },
                descriptor.reward,
                offer,
                occurrenceAddress,
              ),
              parentMarker: wheelMarker,
            }),
          );
        }
      }
      return Object.freeze(controls);
    }
    case 'shop': {
      if (state.shop === undefined) {
        return Object.freeze([]);
      }
      const profile = catalog.rewards.shops.byKey[state.shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${state.shop.profileKey} is missing`,
        );
      }
      return Object.freeze(
        profile.slots.values.map((slot) => {
          const authored = state.shop?.offers[slot.key];
          const group = profile.groups.byKey[slot.groupKey];
          if (authored === undefined || group === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${room.gameName} shop offer ${slot.key} is incomplete`,
            );
          }
          const address = createShopOfferAddress(biome, occurrence.occurrenceId, slot.key);
          const purchaseMarker = marker(
            context,
            createShopPurchaseAddress(biome, occurrence.occurrenceId, slot.key),
            'inspector',
            occurrenceAddress,
          );
          return explicitRewardControl(
            context,
            { kind: 'shopOffer', address },
            group.rewardTypes,
            authored.offer,
            occurrenceAddress,
            purchaseMarker,
          );
        }),
      );
    }
  }
}

function targetRoomPicker(
  address: TargetAddress,
  selectedGameName?: string,
): WorkspaceRoomPickerControl {
  return Object.freeze({
    address,
    kind: 'targetRoomPicker',
    ...(selectedGameName === undefined ? {} : { selectedGameName }),
  });
}

function projectionSource(
  evaluation: ProjectBiomeEvaluation | undefined,
): WorkspaceProjectionSource {
  if (evaluation?.authoring === 'complete') {
    return 'canonical';
  }
  if (evaluation?.coverage.kind === 'prefix') {
    return 'progressive';
  }
  return 'authored';
}

function biomeStatus(evaluation: ProjectBiomeEvaluation | undefined): WorkspaceStatus {
  if (evaluation === undefined) {
    return 'blocked';
  }
  if (evaluation.authoring === 'incomplete') {
    return 'incomplete';
  }
  return evaluation.validity;
}

function authoredLinearFrontier(
  biome: BiomeAddress,
  layout: LinearBiomeLayout,
  topology: LinearBiomeTopology | null,
): ContinuationAddress | null {
  if (topology === null) {
    return null;
  }
  if (topology.continuations.length === 0) {
    return createContinuationAddress(biome, topology.startOccurrenceId);
  }
  const last = topology.continuations.at(-1);
  if (last?.kind !== 'batch' || last.pickedExitIndex === null) {
    return null;
  }
  const picked = last.targets.find((target) => target.exitIndex === last.pickedExitIndex);
  if (picked === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${layout.biomeKey} continuation lost picked exit ${last.pickedExitIndex}`,
    );
  }
  const pickedRoom = occurrenceById(topology, picked.occurrenceId);
  if (
    layout.terminal.kind === 'generatedTarget' &&
    pickedRoom.gameName === layout.terminal.roomGameName
  ) {
    return null;
  }
  return createContinuationAddress(biome, picked.occurrenceId);
}

function evaluationFrontier(
  evaluation: ProjectBiomeEvaluation | undefined,
  authoredFrontier: ContinuationAddress | null,
): SemanticAddress | null {
  if (evaluation === undefined) {
    return authoredFrontier;
  }
  return evaluation.authoring === 'incomplete' ? evaluation.frontier : null;
}

function assessedEvaluationKeys(
  evaluation: ProjectBiomeEvaluation | undefined,
): ReadonlySet<string> {
  if (evaluation?.authoring === 'complete') {
    return collectAssessedAddresses(evaluation.snapshot);
  }
  if (evaluation?.coverage.kind === 'prefix' && 'materializedPrefix' in evaluation) {
    return collectAssessedAddresses(evaluation.materializedPrefix);
  }
  return new Set();
}

function assessmentFor(context: ProjectionContext, address: SemanticAddress): WorkspaceAssessment {
  if (context.evaluation === undefined) {
    return 'blocked';
  }
  if (context.evaluation.coverage.kind === 'complete') {
    return 'assessed';
  }
  const key = semanticAddressKey(address);
  const jointRegionAssessed =
    address.kind === 'hubSlot' &&
    context.assessedKeys.has(
      semanticAddressKey(
        createHubOpenSetAddress(createBiomeAddress(address.routeKey, address.biomeKey)),
      ),
    );
  return context.assessedKeys.has(key) || jointRegionAssessed || context.findingsByOwner.has(key)
    ? 'assessed'
    : 'unassessed';
}

function registerDestination(
  context: ProjectionContext,
  address: SemanticAddress,
  region: WorkspaceInspectorDestination['region'],
  nodeKey = semanticAddressKey(address),
): WorkspaceInspectorDestination {
  const destination = Object.freeze({
    ...('biomeKey' in address ? { biomeKey: address.biomeKey } : {}),
    ...('routeKey' in address ? { routeKey: address.routeKey } : {}),
    focusAddress: address,
    focusKey: semanticAddressKey(address),
    nodeKey,
    ownerAddress: address,
    region,
  });
  context.focusByOwner.set(semanticAddressKey(address), destination);
  return destination;
}

function occurrenceOwnerId(address: SemanticAddress): OccurrenceId | undefined {
  switch (address.kind) {
    case 'occurrence':
    case 'incomingReward':
    case 'localReward':
    case 'localChild':
    case 'localChildGroup':
    case 'rewardWheel':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'shopPurchase':
      return address.occurrenceId;
    default:
      return undefined;
  }
}

function findingBelongsToMarker(
  markerAddress: SemanticAddress,
  findingAddress: SemanticAddress,
): boolean {
  if (semanticAddressKey(markerAddress) === semanticAddressKey(findingAddress)) {
    return true;
  }
  switch (markerAddress.kind) {
    case 'biome':
      return (
        'biomeKey' in findingAddress &&
        findingAddress.routeKey === markerAddress.routeKey &&
        findingAddress.biomeKey === markerAddress.biomeKey
      );
    case 'occurrence':
      return occurrenceOwnerId(findingAddress) === markerAddress.occurrenceId;
    case 'continuation':
      return (
        (findingAddress.kind === 'batchRewardStore' ||
          findingAddress.kind === 'picked' ||
          findingAddress.kind === 'target') &&
        findingAddress.parentOccurrenceId === markerAddress.parentOccurrenceId
      );
    case 'fixedEntryRoom':
      return (
        (findingAddress.kind === 'fixedEntryReward' ||
          findingAddress.kind === 'fixedEntryTarget') &&
        findingAddress.role === markerAddress.role
      );
    case 'hubOpenSet':
      return findingAddress.kind === 'hubRoom';
    default:
      return false;
  }
}

function markerFindingCount(context: ProjectionContext, address: SemanticAddress): number {
  return context.findings.filter((finding) => findingBelongsToMarker(address, finding.origin))
    .length;
}

function marker(
  context: ProjectionContext,
  address: SemanticAddress,
  region: WorkspaceInspectorDestination['region'] = 'structure',
  nodeAddress: SemanticAddress = address,
): WorkspaceMarker {
  const key = semanticAddressKey(address);
  registerDestination(context, address, region, semanticAddressKey(nodeAddress));
  return Object.freeze({
    address,
    assessment: assessmentFor(context, address),
    findingCount: markerFindingCount(context, address),
    focusKey: key,
  });
}

function occurrenceById(
  topology: { readonly occurrences: readonly RoomOccurrence[] },
  id: OccurrenceId,
) {
  const occurrence = topology.occurrences.find((candidate) => candidate.occurrenceId === id);
  if (occurrence === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`occurrence ${id} is missing`);
  }
  return occurrence;
}

function roomSummary(
  catalog: Catalog,
  context: ProjectionContext,
  occurrence: RoomOccurrence,
): WorkspaceRoomSummary {
  const declaration = requireRoom(catalog, occurrence.gameName);
  const address = createOccurrenceAddress(
    createBiomeAddress(context.routeKey, declaration.biomeKey),
    occurrence.occurrenceId,
  );
  const rewardSummary = roomRewardSummary(catalog, declaration, occurrence.state);
  const rewardControls = roomRewardControls(catalog, context, declaration, occurrence);
  return Object.freeze({
    address,
    contextualOwner: Object.freeze({
      kind: 'roomState' as const,
      address,
      rewards: rewardControls,
    }),
    entered: context.enteredOccurrenceKeys.has(semanticAddressKey(address)),
    gameName: occurrence.gameName,
    kind: declaration.kind,
    label: declaration.label,
    marker: marker(context, address),
    occurrenceId: occurrence.occurrenceId,
    rewardControls,
    ...(rewardSummary === undefined ? {} : { rewardSummary }),
  });
}

function declaredRoomSummary(
  catalog: Catalog,
  context: ProjectionContext,
  address: SemanticAddress,
  gameName: string,
): WorkspaceRoomSummary {
  const declaration = requireRoom(catalog, gameName);
  const projectedMarker = marker(context, address);
  return Object.freeze({
    address,
    entered: projectedMarker.assessment === 'assessed',
    gameName,
    kind: declaration.kind,
    label: declaration.label,
    marker: projectedMarker,
    rewardControls: Object.freeze([]),
  });
}

function completionLandmarks(
  catalog: Catalog,
  context: ProjectionContext,
  biomeKey: string,
  descriptors: readonly CompletionRoomDescriptor[],
): readonly WorkspaceCompletionLandmark[] {
  const biome = createBiomeAddress(context.routeKey, biomeKey);
  return Object.freeze(
    descriptors.map((descriptor) => {
      const address = createCompletionRoomAddress(biome, descriptor.role);
      return Object.freeze({
        gameName: descriptor.roomGameName,
        label: requireRoom(catalog, descriptor.roomGameName).label,
        marker: marker(context, address),
        role: descriptor.role,
      });
    }),
  );
}

function terminalOutline(
  catalog: Catalog,
  terminal: LinearBiomeLayout['terminal'] | HubBiomeLayout['terminal'],
): WorkspaceTerminalOutline {
  return Object.freeze({
    gameName: terminal.roomGameName,
    label: requireRoom(catalog, terminal.roomGameName).label,
    policy: terminal.kind,
  });
}

function progressionOutline(layout: LinearBiomeLayout): WorkspaceProgressionOutline {
  const policy = layout.continuation.progressionPolicy;
  if (policy.kind === 'fixedCount') {
    return Object.freeze({ kind: 'exact', decisionCount: policy.continuationCount });
  }
  if (policy.kind === 'staged') {
    return Object.freeze({
      kind: 'staged',
      stageKeys: Object.freeze(policy.stages.map((stage) => stage.key)),
    });
  }
  return Object.freeze({ kind: 'variable' });
}

function linearEntries(
  catalog: Catalog,
  context: ProjectionContext,
  layout: LinearBiomeLayout,
  topology: LinearBiomeTopology | null,
): readonly WorkspaceLinearEntry[] {
  const biome = createBiomeAddress(context.routeKey, layout.biomeKey);
  const entries: WorkspaceLinearEntry[] = [];
  if (layout.start.kind === 'authoredStart') {
    const occurrence =
      topology?.startOccurrenceId === null || topology?.startOccurrenceId === undefined
        ? undefined
        : occurrenceById(topology, topology.startOccurrenceId);
    const address =
      occurrence === undefined ? biome : createOccurrenceAddress(biome, occurrence.occurrenceId);
    const roomPicker = Object.freeze({
      address,
      candidateGameNames: Object.freeze([...layout.start.roomGameNames]),
      kind: 'startRoomPicker' as const,
      ...(occurrence === undefined ? {} : { selectedGameName: occurrence.gameName }),
    });
    entries.push(
      Object.freeze({
        contextualOwner: Object.freeze({ kind: 'startRoom' as const, address, roomPicker }),
        key: 'start',
        marker: marker(context, address),
        role: 'start',
        ...(occurrence === undefined
          ? {
              roomChoices: Object.freeze(
                layout.start.roomGameNames.map((gameName) => ({
                  gameName,
                  label: requireRoom(catalog, gameName).label,
                })),
              ),
            }
          : { room: roomSummary(catalog, context, occurrence) }),
      }),
    );
  } else {
    const address = createFixedEntryRoomAddress(biome, layout.start.role);
    entries.push(
      Object.freeze({
        key: layout.start.role,
        marker: marker(context, address),
        role: layout.start.role,
        room: declaredRoomSummary(catalog, context, address, layout.start.roomGameName),
      }),
    );
  }
  for (const entry of layout.entries) {
    const role = entry.kind === 'fixedEntry' ? entry.role : entry.slotKey;
    const address = createFixedEntryRoomAddress(biome, role);
    entries.push(
      Object.freeze({
        key: role,
        marker: marker(context, address),
        role,
        room: declaredRoomSummary(catalog, context, address, entry.roomGameName),
      }),
    );
  }
  return Object.freeze(entries);
}

function linearTarget(
  catalog: Catalog,
  context: ProjectionContext,
  topology: LinearBiomeTopology,
  continuationKind: 'batch' | 'terminal',
  parentOccurrenceId: OccurrenceId | null,
  pickedExitIndex: number | null,
  target: LinearBiomeTopology['continuations'][number]['targets'][number],
): WorkspaceLinearTarget {
  const biome = createBiomeAddress(context.routeKey, context.biomeKey);
  const address = createTargetAddress(biome, parentOccurrenceId, target.exitIndex);
  const picked = target.exitIndex === pickedExitIndex;
  const projectedMarker = marker(context, address);
  const occurrence = occurrenceById(topology, target.occurrenceId);
  return Object.freeze({
    contextualOwner:
      continuationKind === 'batch'
        ? Object.freeze({
            kind: 'linearTarget' as const,
            address,
            interaction: 'replaceable' as const,
            roomPicker: targetRoomPicker(address, occurrence.gameName),
          })
        : Object.freeze({
            kind: 'linearTarget' as const,
            address,
            interaction: 'readOnly' as const,
          }),
    exitIndex: target.exitIndex,
    marker: projectedMarker,
    picked,
    retained:
      context.evaluation?.coverage.kind === 'prefix' && projectedMarker.assessment === 'unassessed',
    room: roomSummary(catalog, context, occurrence),
  });
}

function roomFindingMarkers(room: WorkspaceRoomSummary): readonly WorkspaceMarker[] {
  return [
    room.marker,
    ...room.rewardControls.flatMap((control) => [
      control.marker,
      ...(control.kind === 'countedReward' && control.parentMarker !== undefined
        ? [control.parentMarker]
        : []),
      ...(control.kind === 'explicitReward' && control.purchaseMarker !== undefined
        ? [control.purchaseMarker]
        : []),
    ]),
  ];
}

function linearContinuationFindingCount(continuation: {
  readonly marker: WorkspaceMarker;
  readonly pickedMarker: WorkspaceMarker;
  readonly rewardStoreMarker?: WorkspaceMarker;
  readonly targets: readonly WorkspaceLinearTarget[];
}): number {
  const markers = [
    continuation.marker,
    continuation.pickedMarker,
    ...(continuation.rewardStoreMarker === undefined ? [] : [continuation.rewardStoreMarker]),
    ...continuation.targets.flatMap((target) => [
      target.marker,
      ...roomFindingMarkers(target.room),
    ]),
  ];
  const unique = new Map(
    markers.map((projectedMarker) => [projectedMarker.focusKey, projectedMarker]),
  );
  return [...unique.values()].reduce(
    (count, projectedMarker) => count + projectedMarker.findingCount,
    0,
  );
}

function projectLinearBiome(
  catalog: Catalog,
  context: ProjectionContext,
  plan: LinearBiomePlan,
  layout: LinearBiomeLayout,
): WorkspaceLinearBiome {
  const biome = createBiomeAddress(context.routeKey, plan.biomeKey);
  const topology = plan.topology;
  const source = projectionSource(context.evaluation);
  const projectedContinuations: readonly ProjectedLinearContinuation[] =
    topology === null
      ? Object.freeze([])
      : Object.freeze(
          topology.continuations.map((continuation) => {
            const address = createContinuationAddress(biome, continuation.parentOccurrenceId);
            const projectedMarker = marker(context, address);
            const pickedMarker = marker(
              context,
              createPickedAddress(biome, continuation.parentOccurrenceId),
              'inspector',
              address,
            );
            const targets = Object.freeze(
              continuation.targets.map((target) =>
                linearTarget(
                  catalog,
                  context,
                  topology,
                  continuation.kind,
                  continuation.parentOccurrenceId,
                  continuation.pickedExitIndex,
                  target,
                ),
              ),
            );
            const common = {
              contextualOwner: Object.freeze({ kind: 'linearDecision' as const, address }),
              marker: projectedMarker,
              parentOccurrenceId: continuation.parentOccurrenceId,
              pickedMarker,
              pickedExitIndex: continuation.pickedExitIndex,
              retainedOverflow:
                context.evaluation?.coverage.kind === 'prefix' &&
                projectedMarker.assessment === 'unassessed',
              targets,
            };
            if (continuation.kind === 'batch') {
              const rewardStoreMarker = marker(
                context,
                createBatchRewardStoreAddress(biome, continuation.parentOccurrenceId),
                'inspector',
                address,
              );
              return Object.freeze({
                ...common,
                findingCount: linearContinuationFindingCount({
                  ...common,
                  rewardStoreMarker,
                }),
                kind: continuation.kind,
                rewardStoreMarker,
              });
            }
            const rewardStoreMarker =
              continuation.rewardStore === undefined
                ? undefined
                : marker(
                    context,
                    createBatchRewardStoreAddress(biome, continuation.parentOccurrenceId),
                    'inspector',
                    address,
                  );
            return Object.freeze({
              ...common,
              findingCount: linearContinuationFindingCount({
                ...common,
                ...(rewardStoreMarker === undefined ? {} : { rewardStoreMarker }),
              }),
              kind: continuation.kind,
              ...(rewardStoreMarker === undefined ? {} : { rewardStoreMarker }),
            });
          }),
        );
  const decisions = Object.freeze(
    projectedContinuations.filter(
      (continuation): continuation is WorkspaceLinearDecision => continuation.kind === 'batch',
    ),
  );
  const terminalDecision = projectedContinuations.find(
    (continuation): continuation is ProjectedLinearTerminalDecision =>
      continuation.kind === 'terminal',
  );
  const generatedTerminalDecision =
    layout.terminal.kind === 'generatedTarget'
      ? decisions.find((decision) =>
          decision.targets.some(
            (target) => target.picked && target.room.gameName === layout.terminal.roomGameName,
          ),
        )
      : undefined;
  const pickedGeneratedTerminal = generatedTerminalDecision?.targets.find(
    (target) => target.picked && target.room.gameName === layout.terminal.roomGameName,
  );
  const frontierAddress = evaluationFrontier(
    context.evaluation,
    authoredLinearFrontier(biome, layout, topology),
  );
  const completion = completionLandmarks(catalog, context, plan.biomeKey, layout.completion.rooms);
  const outline = terminalOutline(catalog, layout.terminal);
  const terminalTargets =
    terminalDecision?.targets ?? generatedTerminalDecision?.targets ?? Object.freeze([]);
  return Object.freeze({
    biomeKey: plan.biomeKey,
    completion,
    decisions,
    emptyOutline: Object.freeze({
      completion,
      progression: progressionOutline(layout),
      terminal: outline,
    }),
    entries: linearEntries(catalog, context, layout, topology),
    frontier: frontierAddress === null ? null : marker(context, frontierAddress),
    kind: 'LinearBiome',
    label: catalog.biomes.byKey[plan.biomeKey]?.label ?? plan.biomeKey,
    marker: marker(context, biome),
    source,
    status: biomeStatus(context.evaluation),
    terminal: Object.freeze({
      findingCount: terminalDecision?.findingCount ?? generatedTerminalDecision?.findingCount ?? 0,
      marker:
        terminalDecision?.marker ??
        pickedGeneratedTerminal?.marker ??
        marker(context, frontierAddress ?? biome),
      outline,
      realization:
        generatedTerminalDecision !== undefined
          ? 'generatedPeer'
          : terminalDecision === undefined
            ? 'projected'
            : 'independent',
      targets: terminalTargets,
    }),
    trunk: Object.freeze(
      decisions.flatMap((decision) => {
        const picked = decision.targets.find((target) => target.picked);
        return picked === undefined ? [] : [picked.room];
      }),
    ),
  });
}

function fixedHubEntry(
  catalog: Catalog,
  context: ProjectionContext,
  layout: HubBiomeLayout,
  topology: HubBiomeTopology | null,
  slotKey: string,
  gameName: string,
): WorkspaceLinearEntry {
  const biome = createBiomeAddress(context.routeKey, layout.biomeKey);
  const address = createFixedEntryRoomAddress(biome, slotKey);
  const reference = topology?.fixedRooms.find((fixed) => fixed.fixedSlotKey === slotKey);
  return Object.freeze({
    key: slotKey,
    marker: marker(context, address),
    role: slotKey,
    room:
      reference === undefined
        ? declaredRoomSummary(catalog, context, address, gameName)
        : roomSummary(catalog, context, occurrenceById(topology!, reference.occurrenceId)),
  });
}

function hubSideRooms(
  catalog: Catalog,
  context: ProjectionContext,
  occurrence: RoomOccurrence,
  rewardControls: readonly WorkspaceRewardControl[],
): readonly WorkspaceHubSideRoom[] {
  if (occurrence.state.kind !== 'ephyraCombat') {
    return Object.freeze([]);
  }
  const rewardsByAddress = new Map(
    rewardControls.map((control) => [semanticAddressKey(control.owner.address), control]),
  );
  return Object.freeze(
    Object.entries(occurrence.state.sideRooms).map(([slotKey, sideRoom]) => {
      const address = createLocalChildAddress(
        createBiomeAddress(context.routeKey, context.biomeKey),
        occurrence.occurrenceId,
        'sideRooms',
        slotKey,
      );
      const rewardAddress = createLocalRewardAddress(
        createBiomeAddress(context.routeKey, context.biomeKey),
        occurrence.occurrenceId,
        'sideRooms',
        slotKey,
      );
      const reward = rewardsByAddress.get(semanticAddressKey(rewardAddress));
      if (reward === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${occurrence.gameName} side room ${slotKey} has no projected reward control`,
        );
      }
      return Object.freeze({
        contextualOwner: Object.freeze({
          kind: 'hubSideRoom' as const,
          address,
          reward,
        }),
        enteredOrdinal: sideRoom.enteredOrdinal,
        generation: sideRoom.generation,
        marker: marker(context, address),
        rewardSummary: summarizeRewardOffer(catalog, sideRoom.offer),
        slotKey,
      });
    }),
  );
}

function projectHubBiome(
  catalog: Catalog,
  context: ProjectionContext,
  plan: HubBiomePlan,
  layout: HubBiomeLayout,
): WorkspaceHubBiome {
  const biome = createBiomeAddress(context.routeKey, plan.biomeKey);
  const topology = plan.topology;
  const openBySlot = new Map(topology?.openTargets.map((target) => [target.hubSlotKey, target]));
  const visitIndexBySlot = new Map(
    topology?.visitOrder.map((slotKey, index) => [slotKey, index + 1]),
  );
  const boardAddress = createHubOpenSetAddress(biome);
  marker(context, createHubRoomAddress(biome), 'inspector', boardAddress);
  const slots = Object.freeze(
    layout.hub.slots.map((descriptor) => {
      const address = createHubSlotAddress(biome, descriptor.slotKey);
      const target = openBySlot.get(descriptor.slotKey);
      const occurrence =
        target === undefined || topology === null
          ? undefined
          : occurrenceById(topology, target.occurrenceId);
      const projectedRoom =
        occurrence === undefined ? undefined : roomSummary(catalog, context, occurrence);
      return Object.freeze({
        contextualOwner: Object.freeze({ kind: 'hubSlot' as const, address }),
        hubSlotKey: descriptor.slotKey,
        marker: marker(context, address),
        open: target !== undefined,
        physicalDoorId: descriptor.physicalDoorId,
        ...(projectedRoom === undefined
          ? {}
          : {
              room: projectedRoom,
            }),
        sideRooms:
          occurrence === undefined || projectedRoom === undefined
            ? Object.freeze([])
            : hubSideRooms(catalog, context, occurrence, projectedRoom.rewardControls),
        visited: visitIndexBySlot.has(descriptor.slotKey),
      });
    }),
  );
  const visits = Object.freeze(
    Array.from({ length: layout.hub.requiredVisits }, (_, index) => {
      const visitIndex = index + 1;
      const address = createHubVisitAddress(biome, visitIndex);
      const hubSlotKey = topology?.visitOrder[index];
      if (hubSlotKey === undefined) {
        return Object.freeze({
          authored: false,
          contextualOwner: Object.freeze({ kind: 'hubVisit' as const, address }),
          marker: marker(context, address),
          visitIndex,
        });
      }
      const target = openBySlot.get(hubSlotKey);
      if (target === undefined || topology === null) {
        throw new StructuredWorkspaceProjectionContractError(
          `Hub visit ${visitIndex} references closed slot ${hubSlotKey}`,
        );
      }
      return Object.freeze({
        authored: true,
        contextualOwner: Object.freeze({ kind: 'hubVisit' as const, address }),
        hubSlotKey,
        marker: marker(context, address),
        room: roomSummary(catalog, context, occurrenceById(topology, target.occurrenceId)),
        visitIndex,
      });
    }),
  );
  const entries = Object.freeze(
    layout.entries.map((entry) => {
      const slotKey = entry.kind === 'fixedAuthoredSlot' ? entry.slotKey : entry.role;
      return fixedHubEntry(catalog, context, layout, topology, slotKey, entry.roomGameName);
    }),
  );
  if (layout.terminal.kind !== 'fixedAuthoredSlot') {
    throw new StructuredWorkspaceProjectionContractError(
      `${plan.biomeKey} Hub terminal must be a fixed authored slot`,
    );
  }
  const terminal = fixedHubEntry(
    catalog,
    context,
    layout,
    topology,
    layout.terminal.slotKey,
    layout.terminal.roomGameName,
  );
  const completion = completionLandmarks(catalog, context, plan.biomeKey, layout.completion.rooms);
  return Object.freeze({
    biomeKey: plan.biomeKey,
    board: Object.freeze({
      generationRegion: 'joint',
      marker: marker(context, boardAddress),
      openCount: layout.hub.openCount,
      slots,
    }),
    completion,
    emptyOutline: Object.freeze({
      completion,
      progression: Object.freeze({ kind: 'hubVisits', visitCount: layout.hub.requiredVisits }),
      terminal: terminalOutline(catalog, layout.terminal),
    }),
    entries,
    frontier:
      context.evaluation?.authoring === 'incomplete'
        ? marker(context, context.evaluation.frontier)
        : null,
    kind: 'HubBiome',
    label: catalog.biomes.byKey[plan.biomeKey]?.label ?? plan.biomeKey,
    marker: marker(context, biome),
    source: projectionSource(context.evaluation),
    status: biomeStatus(context.evaluation),
    terminal,
    visits,
  });
}

function indexFindings(findings: readonly SemanticFinding[]) {
  const mutable = new Map<string, SemanticFinding[]>();
  for (const finding of findings) {
    const key = semanticAddressKey(finding.origin);
    const current = mutable.get(key);
    if (current === undefined) {
      mutable.set(key, [finding]);
    } else {
      current.push(finding);
    }
  }
  return new Map([...mutable].map(([key, values]) => [key, Object.freeze(values)] as const));
}

function projectBiome(
  catalog: Catalog,
  project: ProjectDocument,
  routeKey: string,
  plan: AuthoredBiomePlan,
  evaluation: ProjectBiomeEvaluation | undefined,
  findingsByOwner: ReadonlyMap<string, readonly SemanticFinding[]>,
  focusByOwner: Map<string, WorkspaceInspectorDestination>,
): WorkspaceBiome {
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined || layout.kind !== plan.kind) {
    throw new StructuredWorkspaceProjectionContractError(
      `${routeKey}/${plan.biomeKey} layout does not match the authored plan`,
    );
  }
  if (evaluation !== undefined && evaluation.kind !== plan.kind) {
    throw new StructuredWorkspaceProjectionContractError(
      `${routeKey}/${plan.biomeKey} evaluation does not match the authored plan`,
    );
  }
  const context: ProjectionContext = {
    assessedKeys: assessedEvaluationKeys(evaluation),
    biomeKey: plan.biomeKey,
    enteredOccurrenceKeys: enteredOccurrenceKeys(evaluation),
    evaluation,
    findings: evaluation?.findings ?? Object.freeze([]),
    findingsByOwner,
    focusByOwner,
    project,
    routeKey,
  };
  return plan.kind === 'LinearBiome'
    ? projectLinearBiome(catalog, context, plan, layout as LinearBiomeLayout)
    : projectHubBiome(catalog, context, plan, layout as HubBiomeLayout);
}

function closestFocusAddress(origin: SemanticAddress): SemanticAddress {
  const biome =
    'biomeKey' in origin ? createBiomeAddress(origin.routeKey, origin.biomeKey) : undefined;
  switch (origin.kind) {
    case 'continuation':
      return origin.parentOccurrenceId === null
        ? biome!
        : createOccurrenceAddress(biome!, origin.parentOccurrenceId);
    case 'incomingReward':
    case 'localReward':
    case 'localChild':
    case 'localChildGroup':
    case 'rewardWheel':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'shopPurchase':
      return createOccurrenceAddress(biome!, origin.occurrenceId);
    case 'batchRewardStore':
    case 'picked':
      return createContinuationAddress(biome!, origin.parentOccurrenceId);
    case 'target':
      return createContinuationAddress(biome!, origin.parentOccurrenceId);
    case 'fixedEntryReward':
    case 'fixedEntryTarget':
      return createFixedEntryRoomAddress(biome!, origin.role);
    case 'hubRoom':
      return createHubOpenSetAddress(biome!);
    case 'hubVisit':
      return createHubOpenSetAddress(biome!);
    default:
      return origin;
  }
}

function registerFindingDestinations(
  findings: readonly SemanticFinding[],
  focusByOwner: Map<string, WorkspaceInspectorDestination>,
): void {
  for (const finding of findings) {
    const ownerKey = semanticAddressKey(finding.origin);
    if (focusByOwner.has(ownerKey)) {
      continue;
    }
    const focusAddress = closestFocusAddress(finding.origin);
    const focus = focusByOwner.get(semanticAddressKey(focusAddress));
    if (focus === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `finding owner ${ownerKey} has no structured workspace destination`,
      );
    }
    focusByOwner.set(
      ownerKey,
      Object.freeze({
        ...focus,
        ownerAddress: finding.origin,
      }),
    );
  }
}

function requireRouteEvaluation(
  evaluation: ProjectEvaluation,
  routeKey: string,
): ProjectRouteEvaluation {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  if (route === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`evaluation is missing route ${routeKey}`);
  }
  return route;
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
  switch (storeKey) {
    case 'RunProgress':
      return 'Run Progress';
    case 'MetaProgress':
      return 'Meta Progress';
    default:
      return storeKey;
  }
}

function indexBlankLinearTargets(
  catalog: Catalog,
  project: ProjectDocument,
  controls: Map<string, WorkspaceRoomPickerControl>,
): void {
  for (const route of project.routes) {
    for (const plan of route.biomes) {
      if (plan.kind !== 'LinearBiome' || plan.topology === null) {
        continue;
      }
      const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
      if (layout?.kind !== 'LinearBiome') {
        throw new StructuredWorkspaceProjectionContractError(
          `${plan.biomeKey} has no Linear interaction layout`,
        );
      }
      const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
      for (const continuation of plan.topology.continuations) {
        if (continuation.kind !== 'batch') {
          continue;
        }
        const source =
          continuation.parentOccurrenceId === null
            ? (() => {
                const descriptor = layout.entries.at(-1) ?? layout.start;
                if (descriptor.kind !== 'fixedEntry') {
                  throw new StructuredWorkspaceProjectionContractError(
                    `${plan.biomeKey} null-parent decision has no fixed source`,
                  );
                }
                return requireRoom(catalog, descriptor.roomGameName);
              })()
            : requireRoom(
                catalog,
                occurrenceById(plan.topology, continuation.parentOccurrenceId).gameName,
              );
        for (const exit of source.exits) {
          const address = createTargetAddress(biome, continuation.parentOccurrenceId, exit.index);
          const key = semanticAddressKey(address);
          if (!controls.has(key)) {
            controls.set(key, targetRoomPicker(address));
          }
        }
      }
    }
  }
}

function sideRoomOrderProposals(
  enteredSlotKeys: readonly string[],
  allSlotKeys: readonly string[],
): readonly (readonly string[])[] {
  const proposals = new Map<string, readonly string[]>();
  const add = (value: readonly string[]) => {
    const frozen = Object.freeze([...value]);
    proposals.set(JSON.stringify(frozen), frozen);
  };
  const addPermutations = (prefix: readonly string[], remaining: readonly string[]): void => {
    if (remaining.length === 0) {
      add(prefix);
      return;
    }
    for (const [index, slotKey] of remaining.entries()) {
      addPermutations(
        [...prefix, slotKey],
        remaining.filter((_, candidateIndex) => candidateIndex !== index),
      );
    }
  };
  addPermutations([], enteredSlotKeys);
  for (const slotKey of allSlotKeys) {
    const enteredIndex = enteredSlotKeys.indexOf(slotKey);
    add(
      enteredIndex < 0
        ? [...enteredSlotKeys, slotKey]
        : enteredSlotKeys.filter((candidate) => candidate !== slotKey),
    );
    if (enteredIndex > 0) {
      const earlier = [...enteredSlotKeys];
      [earlier[enteredIndex - 1], earlier[enteredIndex]] = [
        earlier[enteredIndex]!,
        earlier[enteredIndex - 1]!,
      ];
      add(earlier);
    }
    if (enteredIndex >= 0 && enteredIndex < enteredSlotKeys.length - 1) {
      const later = [...enteredSlotKeys];
      [later[enteredIndex], later[enteredIndex + 1]] = [
        later[enteredIndex + 1]!,
        later[enteredIndex]!,
      ];
      add(later);
    }
  }
  return Object.freeze([...proposals.values()]);
}

function createWorkspaceInteractionCatalog(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  services: StructuredWorkspaceContextualServices,
  roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>,
  rewardControls: ReadonlyMap<string, WorkspaceRewardControl>,
): WorkspaceInteractionCatalog {
  const candidates = services.candidateSessions.bind(project, evaluation);
  const controls = new Map(roomControls);
  indexBlankLinearTargets(catalog, project, controls);
  const rooms = new Map<string, WorkspaceRoomInteraction>();
  for (const [key, control] of controls) {
    const candidateGameNames =
      control.kind === 'startRoomPicker'
        ? control.candidateGameNames
        : (() => {
            const gameNames = new Set<string>();
            for (const category of roomSelectorCategories(catalog, control.address.biomeKey)) {
              for (const room of selectRoomsForTargetCategory(
                catalog,
                project,
                control.address,
                category,
              )) {
                gameNames.add(room.gameName);
              }
            }
            if (control.selectedGameName !== undefined) {
              gameNames.add(control.selectedGameName);
            }
            return Object.freeze([...gameNames]);
          })();
    const candidateRooms = Object.freeze(
      candidateGameNames.map((gameName) => requireRoom(catalog, gameName)),
    );
    const choices = Object.freeze(
      candidateRooms.map((room) =>
        Object.freeze({
          category:
            control.kind === 'targetRoomPicker'
              ? (roomCategoryForKind(room.kind) ?? room.kind)
              : room.kind,
          gameName: room.gameName,
          label: room.label,
        }),
      ),
    );
    let model: ContextualPickerModel<RoomDeclaration> | undefined;
    rooms.set(
      key,
      Object.freeze({
        choices,
        key,
        load(): ContextualPickerModel<RoomDeclaration> {
          if (model !== undefined) {
            return model;
          }
          const projected =
            control.kind === 'startRoomPicker'
              ? candidates.startRooms(control.address, candidateRooms)
              : candidates.roomTargets(control.address, candidateRooms);
          model = services.contextualPicker.project(
            projected,
            (option) => ({
              label: option.value.label,
              category:
                control.kind === 'targetRoomPicker'
                  ? (roomCategoryForKind(option.value.kind) ?? option.value.kind)
                  : option.value.kind,
              selected: option.value.gameName === control.selectedGameName,
            }),
            (room) => room.gameName,
          );
          return model;
        },
        owner: control.address,
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
  const fieldsCageOutcomes = new Map<string, WorkspaceCandidateInteraction<'min' | 'max'>>();
  const hubSlots = new Map<string, WorkspaceCandidateInteraction<boolean>>();
  const hubVisits = new Map<string, WorkspaceCandidateInteraction<string>>();
  const rewardWheelOfferCounts = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelPicks = new Map<string, WorkspaceCandidateInteraction<number>>();
  const rewardWheelStores = new Map<string, WorkspaceCandidateInteraction<string>>();
  const shipEncounterCounts = new Map<string, WorkspaceCandidateInteraction<2 | 3>>();
  const shopPurchases = new Map<string, WorkspaceCandidateInteraction<boolean>>();
  const sideRoomEntryOrders = new Map<string, WorkspaceCandidateInteraction<readonly string[]>>();
  const sideRoomGenerations = new Map<string, WorkspaceCandidateInteraction<SideRoomGeneration>>();
  const reservedOccurrenceIds = new Set(
    project.routes.flatMap((route) =>
      route.biomes.flatMap(
        (plan) => plan.topology?.occurrences.map((room) => room.occurrenceId) ?? [],
      ),
    ),
  );
  const candidateOccurrenceId = (key: string): OccurrenceId => {
    let suffix = 0;
    let candidate = createOccurrenceId(`candidate-${key}`);
    while (reservedOccurrenceIds.has(candidate)) {
      suffix += 1;
      candidate = createOccurrenceId(`candidate-${key}-${suffix}`);
    }
    reservedOccurrenceIds.add(candidate);
    return candidate;
  };

  const indexRoomState = (
    biome: BiomeAddress,
    occurrence: RoomOccurrence,
    room: RoomDeclaration,
  ): void => {
    const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
    const state = occurrence.state;
    if (state.kind === 'shipCombat') {
      const encounter = catalog.encounterProfiles.byKey[room.encounterProfileKey];
      const wheelDescriptors =
        encounter?.phases.flatMap((phase) =>
          phase.offerPoint === undefined ? [] : [phase.offerPoint],
        ) ?? [];
      const encounterValues = Object.freeze([2, 3] as const);
      shipEncounterCounts.set(
        semanticAddressKey(occurrenceAddress),
        candidateInteraction(
          occurrenceAddress,
          encounterValues.map((value) =>
            Object.freeze({
              label: value === 2 ? 'Intro + 1 combat' : 'Intro + 2 combats',
              value,
            }),
          ),
          state.encounterCount,
          () => candidates.shipEncounterCounts(occurrenceAddress, encounterValues),
        ),
      );
      for (const descriptor of wheelDescriptors) {
        const wheel = state.wheels[descriptor.key];
        if (wheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} is missing ${descriptor.key}`,
          );
        }
        const address = createRewardWheelAddress(biome, occurrence.occurrenceId, descriptor.key);
        const countValues = Object.freeze(
          Array.from(
            { length: descriptor.offerCount.max - descriptor.offerCount.min + 1 },
            (_, index) => descriptor.offerCount.min + index,
          ),
        );
        rewardWheelOfferCounts.set(
          semanticAddressKey(address),
          candidateInteraction(
            address,
            countValues.map((value) => Object.freeze({ label: String(value), value })),
            wheel.offerCount,
            () => candidates.rewardWheelOfferCounts(address, countValues),
          ),
        );
        rewardWheelStores.set(
          semanticAddressKey(address),
          candidateInteraction(
            address,
            descriptor.reward.storeKeys.map((value) =>
              Object.freeze({ label: storeLabel(value), value }),
            ),
            wheel.storeKey,
            () => candidates.rewardWheelStores(address, descriptor.reward.storeKeys),
          ),
        );
        const pickedValues = Object.freeze(
          Array.from({ length: wheel.offerCount }, (_, index) => index + 1),
        );
        rewardWheelPicks.set(
          semanticAddressKey(address),
          candidateInteraction(
            address,
            pickedValues.map((value) => Object.freeze({ label: `Offer ${value}`, value })),
            wheel.pickedOfferIndex,
            () => candidates.rewardWheelPicks(address, pickedValues),
          ),
        );
      }
    }
    if (state.kind === 'shop' && state.shop !== undefined) {
      for (const [slotKey, authored] of Object.entries(state.shop.offers)) {
        const address = createShopPurchaseAddress(biome, occurrence.occurrenceId, slotKey);
        const values = Object.freeze([false, true]);
        shopPurchases.set(
          semanticAddressKey(address),
          candidateInteraction(
            address,
            Object.freeze([
              Object.freeze({ label: 'Not purchased', value: false }),
              Object.freeze({ label: 'Purchased', value: true }),
            ]),
            authored.purchased,
            () => candidates.shopPurchases(address, values),
          ),
        );
      }
    }
    if (state.kind === 'ephyraCombat') {
      const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
      if (group?.kind !== 'fixedRoomSlots') {
        return;
      }
      const groupAddress = createLocalChildGroupAddress(biome, occurrence.occurrenceId, group.key);
      const enteredSlotKeys = Object.entries(state.sideRooms)
        .filter((entry) => entry[1].enteredOrdinal !== null)
        .sort((left, right) => left[1].enteredOrdinal! - right[1].enteredOrdinal!)
        .map(([slotKey]) => slotKey);
      for (const slot of group.slots) {
        const sideState = state.sideRooms[slot.slotKey];
        if (sideState === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} side slot ${slot.slotKey} is missing`,
          );
        }
        const address = createLocalChildAddress(
          biome,
          occurrence.occurrenceId,
          group.key,
          slot.slotKey,
        );
        const values = Object.freeze(['generated', 'notGenerated'] as const);
        sideRoomGenerations.set(
          semanticAddressKey(address),
          candidateInteraction(
            address,
            Object.freeze([
              Object.freeze({ label: 'Generated', value: 'generated' as const }),
              Object.freeze({ label: 'Not generated', value: 'notGenerated' as const }),
            ]),
            sideState.generation,
            () => candidates.sideRoomGenerations(address, values),
          ),
        );
      }
      for (const proposal of sideRoomOrderProposals(
        enteredSlotKeys,
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
  };

  for (const route of project.routes) {
    for (const plan of route.biomes) {
      const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
      if (layout === undefined || layout.kind !== plan.kind) {
        throw new StructuredWorkspaceProjectionContractError(
          `${plan.biomeKey} interaction layout is missing`,
        );
      }
      const biome = createBiomeAddress(route.routeKey, plan.biomeKey);
      if (plan.kind === 'LinearBiome' && layout.kind === 'LinearBiome') {
        if (plan.topology === null) {
          continue;
        }
        for (const occurrence of plan.topology.occurrences) {
          indexRoomState(biome, occurrence, requireRoom(catalog, occurrence.gameName));
        }
        for (const continuation of plan.topology.continuations) {
          if (continuation.kind !== 'batch') {
            continue;
          }
          const address = createContinuationAddress(biome, continuation.parentOccurrenceId);
          if (
            continuation.rewardStore.kind === 'authoredBaseStore' &&
            layout.continuation.rewardStorePolicy.kind === 'authoredBaseStore'
          ) {
            const rewardAddress = createBatchRewardStoreAddress(
              biome,
              continuation.parentOccurrenceId,
            );
            const storeKeys = layout.continuation.rewardStorePolicy.storeKeys;
            batchRewardStores.set(
              semanticAddressKey(rewardAddress),
              candidateInteraction(
                rewardAddress,
                storeKeys.map((value) => Object.freeze({ label: storeLabel(value), value })),
                continuation.rewardStore.baseRewardStoreKey,
                () => candidates.batchRewardStores(rewardAddress, storeKeys),
              ),
            );
          }
          if (
            layout.continuation.batchPolicy.kind === 'fields' &&
            continuation.batchState !== null
          ) {
            const projected = projectLinearBatchState(catalog, biome, plan.topology, continuation);
            if (projected.kind !== 'fields') {
              throw new StructuredWorkspaceProjectionContractError(
                `${plan.biomeKey} Fields interaction has no projected batch`,
              );
            }
            const values = Object.freeze(['min', 'max'] as const);
            fieldsCageOutcomes.set(
              semanticAddressKey(address),
              candidateInteraction(
                address,
                Object.freeze([
                  Object.freeze({
                    label: `Min (${layout.continuation.batchPolicy.minDoorCageRewards})`,
                    value: 'min' as const,
                  }),
                  Object.freeze({
                    label: `Max (${projected.batchCapacity})`,
                    value: 'max' as const,
                  }),
                ]),
                continuation.batchState.cageOutcome,
                () => candidates.fieldsCageOutcomes(address, values),
              ),
            );
          }
        }
      } else if (plan.kind === 'HubBiome' && layout.kind === 'HubBiome') {
        if (plan.topology === null) {
          continue;
        }
        for (const occurrence of plan.topology.occurrences) {
          indexRoomState(biome, occurrence, requireRoom(catalog, occurrence.gameName));
        }
        const openBySlot = new Map(
          plan.topology.openTargets.map((target) => [target.hubSlotKey, target] as const),
        );
        for (const slot of layout.hub.slots) {
          const address = createHubSlotAddress(biome, slot.slotKey);
          const target = openBySlot.get(slot.slotKey);
          const occurrenceId =
            target?.occurrenceId ??
            candidateOccurrenceId(`${route.routeKey}-${plan.biomeKey}-${slot.slotKey}`);
          const values = Object.freeze([false, true]);
          hubSlots.set(
            semanticAddressKey(address),
            candidateInteraction(
              address,
              Object.freeze([
                Object.freeze({ label: 'Closed', value: false }),
                Object.freeze({ label: 'Open', value: true }),
              ]),
              target !== undefined,
              () => candidates.hubSlots(address, occurrenceId, values),
            ),
          );
        }
        const allVisitValues = Object.freeze(
          plan.topology.openTargets.map((target) => target.hubSlotKey),
        );
        for (let visitIndex = 1; visitIndex <= layout.hub.requiredVisits; visitIndex += 1) {
          const address = createHubVisitAddress(biome, visitIndex);
          const selected = plan.topology.visitOrder[visitIndex - 1];
          const visitValues =
            selected !== undefined
              ? allVisitValues
              : visitIndex === plan.topology.visitOrder.length + 1
                ? Object.freeze(
                    allVisitValues.filter(
                      (hubSlotKey) => !plan.topology!.visitOrder.includes(hubSlotKey),
                    ),
                  )
                : Object.freeze([]);
          hubVisits.set(
            semanticAddressKey(address),
            candidateInteraction(
              address,
              visitValues.map((value) =>
                Object.freeze({
                  label:
                    catalog.rooms.byKey[
                      layout.hub.slots.find((slot) => slot.slotKey === value)?.roomGameName ?? ''
                    ]?.label ?? value,
                  value,
                }),
              ),
              selected,
              () => candidates.hubVisits(address, visitValues),
            ),
          );
        }
      }
    }
  }

  return Object.freeze({
    batchRewardStores,
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
  });
}

interface WorkspaceContextualControlIndexes {
  readonly rewards: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly rooms: ReadonlyMap<string, WorkspaceRoomPickerControl>;
}

function indexWorkspaceContextualControls(
  routes: readonly WorkspaceRoute[],
): WorkspaceContextualControlIndexes {
  const rewards = new Map<string, WorkspaceRewardControl>();
  const rooms = new Map<string, WorkspaceRoomPickerControl>();
  const indexRoom = (room: WorkspaceRoomSummary | undefined): void => {
    if (room === undefined) {
      return;
    }
    for (const reward of room.rewardControls) {
      rewards.set(semanticAddressKey(reward.owner.address), reward);
    }
  };
  const indexOwner = (owner: WorkspaceContextualOwner | undefined): void => {
    if (owner === undefined) {
      return;
    }
    switch (owner.kind) {
      case 'startRoom':
        rooms.set(semanticAddressKey(owner.roomPicker.address), owner.roomPicker);
        break;
      case 'linearTarget':
        if (owner.interaction === 'replaceable') {
          rooms.set(semanticAddressKey(owner.roomPicker.address), owner.roomPicker);
        }
        break;
      case 'roomState':
        for (const reward of owner.rewards) {
          rewards.set(semanticAddressKey(reward.owner.address), reward);
        }
        break;
      case 'hubSideRoom':
        rewards.set(semanticAddressKey(owner.reward.owner.address), owner.reward);
        break;
      case 'hubSlot':
      case 'hubVisit':
      case 'linearDecision':
        break;
    }
  };
  for (const route of routes) {
    for (const biome of route.biomes) {
      for (const entry of biome.entries) {
        indexOwner(entry.contextualOwner);
        indexRoom(entry.room);
      }
      if (biome.kind === 'LinearBiome') {
        for (const decision of biome.decisions) {
          indexOwner(decision.contextualOwner);
          for (const target of decision.targets) {
            indexOwner(target.contextualOwner);
            indexOwner(target.room.contextualOwner);
            indexRoom(target.room);
          }
        }
        for (const target of biome.terminal.targets) {
          indexOwner(target.contextualOwner);
          indexOwner(target.room.contextualOwner);
          indexRoom(target.room);
        }
      } else {
        for (const slot of biome.board.slots) {
          indexOwner(slot.contextualOwner);
          indexOwner(slot.room?.contextualOwner);
          indexRoom(slot.room);
          for (const sideRoom of slot.sideRooms) {
            indexOwner(sideRoom.contextualOwner);
          }
        }
        for (const visit of biome.visits) {
          indexOwner(visit.contextualOwner);
          indexOwner(visit.room?.contextualOwner);
          indexRoom(visit.room);
        }
        indexOwner(biome.terminal.contextualOwner);
        indexRoom(biome.terminal.room);
      }
    }
  }
  return Object.freeze({ rewards, rooms });
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
    project(project: ProjectDocument, evaluation: ProjectEvaluation) {
      const cached = cache.get(project)?.get(evaluation);
      if (cached !== undefined) {
        return cached;
      }
      if (
        evaluation.projectId !== project.projectId ||
        evaluation.catalogVersion !== project.catalogVersion ||
        project.catalogVersion !== catalog.version
      ) {
        throw new StructuredWorkspaceProjectionContractError(
          'project, evaluation, and catalog identities do not match',
        );
      }
      assertProjectEvaluationSource(project, evaluation);
      const findingsByOwner = indexFindings(evaluation.findings);
      const focusByOwner = new Map<string, WorkspaceInspectorDestination>();
      const projectContext: ProjectionContext = {
        assessedKeys: new Set(),
        biomeKey: '',
        enteredOccurrenceKeys: new Set(),
        evaluation: undefined,
        findings: evaluation.findings,
        findingsByOwner,
        focusByOwner,
        project,
        routeKey: '',
      };
      const projectAddress = createProjectAddress();
      const routes = Object.freeze(
        project.routes.map((routePlan) => {
          const routeEvaluation = requireRouteEvaluation(evaluation, routePlan.routeKey);
          const routeAddress = createRouteAddress(routePlan.routeKey);
          registerDestination(projectContext, routeAddress, 'routeRail');
          const biomes = Object.freeze(
            routePlan.biomes.map((plan) =>
              projectBiome(
                catalog,
                project,
                routePlan.routeKey,
                plan,
                routeEvaluation.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey),
                findingsByOwner,
                focusByOwner,
              ),
            ),
          );
          const rail = Object.freeze(
            biomes.map((biome) =>
              Object.freeze({
                biomeKey: biome.biomeKey,
                label: biome.label,
                marker: biome.marker,
                source: biome.source,
                status: biome.status,
              }),
            ),
          );
          return Object.freeze({
            biomes,
            label: catalog.routes.byKey[routePlan.routeKey]?.label ?? routePlan.routeKey,
            marker: Object.freeze({
              address: routeAddress,
              assessment: 'assessed' as const,
              findingCount: routeEvaluation.findings.length,
              focusKey: semanticAddressKey(routeAddress),
            }),
            rail,
            routeKey: routePlan.routeKey,
            status: routeEvaluation.status,
          });
        }),
      );
      registerDestination(projectContext, projectAddress, 'routeRail');
      registerFindingDestinations(evaluation.findings, focusByOwner);
      const contextualControls = indexWorkspaceContextualControls(routes);
      const result = Object.freeze({
        interactions: createWorkspaceInteractionCatalog(
          catalog,
          project,
          evaluation,
          services,
          contextualControls.rooms,
          contextualControls.rewards,
        ),
        focusByOwner: new Map(focusByOwner),
        marker: Object.freeze({
          address: projectAddress,
          assessment: 'assessed' as const,
          findingCount: evaluation.findings.length,
          focusKey: semanticAddressKey(projectAddress),
        }),
        routes,
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
