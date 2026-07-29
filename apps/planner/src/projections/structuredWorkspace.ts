import {
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createBiomeFieldAddress,
  createCompletionRoomAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubOpenSetAddress,
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
  declaredPhysicalExits as resolveDeclaredPhysicalExits,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
  describeHubSlotClosureImpact,
  describeTopologyRemovalImpact,
  fixedWidthOneTakeoverForLayout,
  fixedWidthOneTakeoverTransitionForSource,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type AuthoredBatchState,
  type AuthoredRoomState,
  type BiomeAddress,
  type BiomeFieldAddress,
  type DeclaredPhysicalExit,
  type ExitDecision,
  type ExitDecisionAddress,
  type ExitDecisionSourceAddress,
  type HubDecision,
  type HubDecisionAddress,
  type HubOpenSetAddress,
  type HubSlotAddress,
  type LocalChildAddress,
  type LocalChildGroupAddress,
  type OccurrenceAddress,
  type OccurrenceId,
  type ProjectDocument,
  type ProjectCommand,
  type RewardWheelAddress,
  type RoomOccurrence,
  type SemanticAddress,
  type SideRoomGeneration,
  type ShopPurchaseAddress,
  type TargetAddress,
  type TopologyRemovalImpact,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredFieldDescriptor,
  BiomeLayout,
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
import { explainCandidateEvaluation } from './contextualOptions';
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
import {
  createTakeoverBatchCommand,
  type TakeoverBatchCommand,
} from '../workspace/takeoverBatchInteraction';

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
  readonly owner: TargetAddress | OccurrenceAddress;
  readonly load: () => ContextualPickerModel<RoomDeclaration>;
  readonly selected?: RoomDeclaration;
}

/** A start remains an authored action even when its declaration fixes the room. */
export type WorkspaceStartInteraction =
  | {
      readonly fixedGameName: string;
      readonly fixedLabel: string;
      readonly key: string;
      readonly kind: 'fixed';
      readonly load: () => ContextualPickerModel<RoomDeclaration>;
      readonly owner: BiomeAddress;
    }
  | {
      readonly key: string;
      readonly kind: 'choice';
      readonly load: () => ContextualPickerModel<RoomDeclaration>;
      readonly owner: BiomeAddress;
    };

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

/**
 * A topology-removal command carries its engine-derived impact all the way to
 * the renderer. React may use the supplied interaction to expose a named
 * removal action, but cannot walk descendants or infer which Hub structure a
 * linked exit owns.
 */
export interface WorkspaceTopologyRemovalScope {
  readonly removedDecisionOwners: readonly ExitDecisionAddress[];
  readonly removedHubDecisionKeys: readonly string[];
  readonly removedOccurrenceIds: readonly OccurrenceId[];
}

export type WorkspaceTopologyRemovalInteraction =
  | {
      readonly action: 'clearTopology';
      readonly command: Extract<ProjectCommand, { readonly kind: 'ClearTopology' }>;
      readonly impact: WorkspaceTopologyRemovalScope;
      readonly key: string;
      readonly owner: BiomeAddress;
    }
  | {
      readonly action: 'removeExitDecision';
      readonly command: Extract<ProjectCommand, { readonly kind: 'RemoveExitDecision' }>;
      readonly impact: WorkspaceTopologyRemovalScope;
      readonly key: string;
      readonly owner: ExitDecisionAddress;
    };

/**
 * A player-facing room stage may host the removal action for its hidden
 * source decision. The action and exact impact stay in the interaction
 * catalog; this product only declares the presentation anchor.
 */
export interface WorkspaceStageDecisionRemoval {
  readonly interactionKey: string;
  readonly label: string;
}

export interface WorkspaceExitSelectionInteraction {
  readonly key: string;
  readonly owner: ExitDecisionAddress;
  readonly selectedExitKey?: string;
  readonly targets: readonly WorkspaceInteractionChoice<string>[];
}

/** A closed Hub slot needs a new occurrence identity before it can be evaluated. */
export interface WorkspaceHubSlotInteraction {
  /**
   * Binds a prospective occurrence identity into a normal zero-argument
   * candidate capability. React supplies identity, while the interaction
   * adapter remains the only code that evaluates candidate evidence.
   */
  readonly bind: (proposedOccurrenceId: OccurrenceId) => WorkspaceCandidateInteraction<boolean>;
  /** CloseHubSlot and its engine-derived removal impact for an open slot. */
  readonly close?: {
    readonly command: Extract<ProjectCommand, { readonly kind: 'CloseHubSlot' }>;
    readonly impact: WorkspaceTopologyRemovalScope;
  };
  readonly key: string;
  readonly owner: HubSlotAddress;
  readonly roomGameName: string;
  readonly selected: boolean;
}

interface WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'create' | 'replace' | 'reconcile';
  readonly impact?: WorkspaceTakeoverReplacementImpact;
  readonly key: string;
  readonly owner: ExitDecisionAddress;
}

/**
 * A candidate takeover is intentionally owned by an exit decision, never by
 * a target. The application adapter obtains target ids from loaded engine
 * evidence before dispatching its atomic command.
 */
export interface WorkspaceCandidateTakeoverBatchInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly presentation: 'candidate';
  readonly commandFor: (candidate: WorkspaceTakeoverCandidate) => TakeoverBatchCommand;
  readonly selected?: WorkspaceTakeoverCandidate;
  readonly load: () => readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[];
}

/** The fixed O/Q width-one takeover keeps validation inside a semantic capability. */
export type WorkspaceFixedWidthOneTakeoverActionResult =
  | { readonly kind: 'command'; readonly command: TakeoverBatchCommand }
  | { readonly kind: 'unavailable'; readonly message: string };

/** O/Q have one declaration-required width-one takeover action, not a candidate picker. */
export interface WorkspaceFixedWidthOneTakeoverInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'create';
  readonly execute: () => WorkspaceFixedWidthOneTakeoverActionResult;
  readonly label: string;
  readonly presentation: 'fixedWidthOneTakeover';
  /** Projection-owned description of the declaration-owned Preboss outcome. */
  readonly summary: string;
}

/** N's six-visit completion exposes a fixed Hub-owned handoff, not a candidate picker. */
export interface WorkspaceCompletedHubHandoffInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'create';
  readonly execute: () => TakeoverBatchCommand;
  readonly label: string;
  readonly presentation: 'completedHubHandoff';
}

/** A retained takeover repair is a declaration-fixed semantic command. */
export interface WorkspaceTakeoverRepairInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'reconcile';
  readonly execute: () => TakeoverBatchCommand;
  readonly label: string;
  readonly presentation: 'repair';
}

export type WorkspaceTakeoverBatchInteraction =
  | WorkspaceCandidateTakeoverBatchInteraction
  | WorkspaceFixedWidthOneTakeoverInteraction
  | WorkspaceCompletedHubHandoffInteraction
  | WorkspaceTakeoverRepairInteraction;

/** A Preboss declaration is presented through its catalog label, never a raw game name. */
export interface WorkspaceTakeoverCandidate {
  readonly gameName: string;
  readonly label: string;
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
  readonly topologyRemovals: ReadonlyMap<string, WorkspaceTopologyRemovalInteraction>;
}

export function workspaceInteractionKey(owner: SemanticAddress): string {
  return semanticAddressKey(owner);
}

export function workspaceSideRoomEntryOrderKey(owner: LocalChildAddress): string {
  return `${semanticAddressKey(owner)}:entry-order`;
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

export type WorkspaceRoomPickerControl =
  | {
      readonly address: TargetAddress;
      readonly kind: 'targetRoomPicker';
      readonly selectedGameName?: string;
    }
  | {
      readonly address: OccurrenceAddress;
      readonly candidateGameNames: readonly string[];
      readonly kind: 'startRoomPicker';
      readonly selectedGameName: string;
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
}

export interface WorkspaceExplicitRewardControl extends WorkspaceRewardControlBase {
  readonly kind: 'explicitReward';
  readonly rewardTypes: readonly string[];
}

export type WorkspaceRewardControl = WorkspaceCountedRewardControl | WorkspaceExplicitRewardControl;

/** A declaration-ordered Fields cage, including its resolved semantic control. */
export interface WorkspaceFieldsCageDescriptor {
  readonly active: boolean;
  readonly control: WorkspaceCountedRewardControl;
  readonly key: string;
  readonly label: string;
}

/** One offer on a declaration-owned Ship reward wheel. */
export interface WorkspaceRewardWheelOfferDescriptor {
  readonly active: boolean;
  readonly control: WorkspaceCountedRewardControl;
  readonly key: string;
  readonly label: string;
}

/** One declaration-owned Ship reward wheel and its editable lifecycle state. */
export interface WorkspaceRewardWheelDescriptor {
  readonly active: boolean;
  readonly address: RewardWheelAddress;
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly offerCount: number;
  readonly offers: readonly WorkspaceRewardWheelOfferDescriptor[];
  readonly pickedOfferIndex: number;
  readonly storeKey: string;
}

/** The purchase state remains a distinct semantic owner from the Shop offer. */
export interface WorkspaceShopPurchaseDescriptor {
  readonly address: ShopPurchaseAddress;
  readonly marker: WorkspaceMarker;
  readonly purchased: boolean;
}

/** One declaration-owned Shop slot, including its offer and purchase owners. */
export interface WorkspaceShopOfferDescriptor {
  readonly key: string;
  readonly label: string;
  readonly purchase: WorkspaceShopPurchaseDescriptor;
  readonly rewardControl: WorkspaceExplicitRewardControl;
}

/** One complete, candidate-backed entry-order proposal for an Ephyra side room. */
export interface WorkspaceEphyraSideRoomEntryOption {
  readonly key: string;
  readonly label: string;
  readonly position: number | null;
  readonly proposedEnteredSlotKeys: readonly string[];
}

/**
 * A row-owned entry-order control. Every option carries the complete semantic
 * sequence to submit, so React never repairs, splices, or ranks side rooms.
 */
export interface WorkspaceEphyraSideRoomEntryOrderControl {
  readonly interactionKey: string;
  readonly options: readonly WorkspaceEphyraSideRoomEntryOption[];
  readonly selectedKey: string;
}

/** A declaration-ordered Ephyra side room owned by its visited parent occurrence. */
export interface WorkspaceEphyraSideRoomDescriptor {
  readonly address: LocalChildAddress;
  readonly entered: boolean;
  readonly enteredOrdinal: number | null;
  readonly entryOrder: WorkspaceEphyraSideRoomEntryOrderControl;
  readonly generation: SideRoomGeneration;
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly physicalDoorId: number;
  readonly rewardControl: WorkspaceCountedRewardControl;
}

/** The parent-owned side-room group preserves entered order independently of Hub visits. */
export interface WorkspaceEphyraSideRoomGroup {
  readonly address: LocalChildGroupAddress;
  readonly enteredSlotKeys: readonly string[];
  readonly marker: WorkspaceMarker;
  readonly slots: readonly WorkspaceEphyraSideRoomDescriptor[];
}

/**
 * Immutable leaf data for an occurrence workbench.  This intentionally
 * carries only presentation-ready declaration facts, authored values, and
 * semantic control owners; React never needs the authored occurrence or
 * catalog declaration to render the room-local editor.
 */
export type WorkspaceRoomLocal =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'fixed';
      readonly marker: WorkspaceMarker;
      readonly summary: string;
      /** A fixed reward type may still own an authored payload, such as Devotion. */
      readonly control?: WorkspaceExplicitRewardControl;
    }
  | {
      readonly kind: 'incomingReward';
      readonly control: WorkspaceCountedRewardControl;
      readonly clockworkReward?: 'goal' | 'nonGoal';
    }
  | {
      readonly kind: 'ephyra';
      readonly incomingReward: WorkspaceCountedRewardControl;
      readonly sideRooms: WorkspaceEphyraSideRoomGroup;
    }
  | {
      readonly kind: 'fields';
      readonly cages: readonly WorkspaceFieldsCageDescriptor[];
      readonly groupKey: string;
    }
  | {
      readonly kind: 'ship';
      readonly encounterCount: 2 | 3;
      readonly wheels: readonly WorkspaceRewardWheelDescriptor[];
    }
  | {
      readonly kind: 'shop';
      readonly materialized: boolean;
      readonly offers: readonly WorkspaceShopOfferDescriptor[];
    };

export interface WorkspaceRoomSummary {
  readonly address: OccurrenceAddress;
  readonly entered: boolean;
  readonly gameName: string;
  readonly kind: RoomDeclaration['kind'];
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly occurrenceId: OccurrenceId;
  readonly roomLocal: WorkspaceRoomLocal;
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly rewardSummary?: string;
  readonly roomPicker?: WorkspaceRoomPickerControl;
}

export interface WorkspacePhysicalTarget {
  /**
   * I's declaration-owned batch realization.  It is projected so the
   * physical-exit comparison never has to infer Clockwork identity from a
   * room declaration or batch position.
   */
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly exitKey: string;
  readonly index: number;
  readonly marker: WorkspaceMarker;
  readonly physicalState: 'available' | 'unavailable';
  readonly selected: boolean;
  readonly retained: boolean;
  readonly nextPath: 'continuesSpine' | 'deadLeaf' | 'startsCompletion';
  readonly room: WorkspaceRoomSummary;
}

/**
 * A missing target is authorable only after its batch setup is complete and
 * no earlier physical target remains blank. The projection owns those rules
 * so React never derives them from rendered exit order or command failures.
 */
export type WorkspaceMissingTargetAuthoring =
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'awaitingPriorExit';
      readonly message: string;
      readonly prerequisiteExitKey: string;
    }
  | {
      readonly kind: 'awaitingBatchRewardStore';
      readonly message: string;
    }
  | {
      readonly kind: 'awaitingFieldsCageOutcome';
      readonly message: string;
    };

type WorkspaceMissingTargetSetupPrerequisite = Extract<
  WorkspaceMissingTargetAuthoring,
  { readonly kind: 'awaitingBatchRewardStore' | 'awaitingFieldsCageOutcome' }
>;

/** A declared physical exit that still needs its authored target occurrence. */
export interface WorkspaceMissingPhysicalTarget {
  readonly authoring: WorkspaceMissingTargetAuthoring;
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
interface WorkspaceBatchRepairScopeBase {
  readonly owner: ExitDecisionAddress;
  readonly removedDecisionOwners: readonly ExitDecisionAddress[];
  readonly removedOccurrenceIds: readonly OccurrenceId[];
}

/**
 * Ordinary retained exits have a complete static command. Takeover repair
 * needs declaration-derived target identities, so its semantic capability
 * owns execution separately while this scope remains display-only.
 */
export type WorkspaceBatchRepairScope =
  | (WorkspaceBatchRepairScopeBase & {
      readonly command: Extract<ProjectCommand, { readonly kind: 'ReconcileBatchExitCapacity' }>;
      readonly commandKind: 'ReconcileBatchExitCapacity';
    })
  | (WorkspaceBatchRepairScopeBase & {
      readonly commandKind: 'ReconcileTakeoverBatch';
    });

/** Read-only Fields outcome context derived by materialization/generation. */
export interface WorkspaceFieldsBatchContext {
  readonly cageOutcome: 'min' | 'max';
  readonly cageTargetCount: number;
  readonly doorCageRewardCount: number;
  readonly priorMaxOutcomes?: {
    readonly fieldsMaxDoorsRolled: number;
    readonly maxDoorCageCeiling: number;
  };
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
  readonly fields?: WorkspaceFieldsBatchContext;
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
      /**
       * The projection identifies the one rendered workbench that may offer
       * focus-only navigation to this frontier. React never derives this from
       * authored topology or rendered position.
       */
      readonly predecessorNodeKey?: string;
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
    }
  | {
      /**
       * A Hub board may be intentionally below its required open-slot count.
       * Slot interactions remain available on the Hub workbench while this
       * exact board owner carries the completeness finding and focus target.
       */
      readonly kind: 'hubOpenSet';
      readonly marker: WorkspaceMarker;
      readonly owner: HubOpenSetAddress;
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
  readonly canClose: boolean;
  readonly canOpen: boolean;
  readonly hubSlotKey: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly open: boolean;
  readonly physicalDoorId: number;
  readonly room?: WorkspaceRoomSummary;
  readonly roomKind: RoomDeclaration['kind'];
  readonly visited: boolean;
}

export type WorkspaceHubVisitState = 'authored' | 'next' | 'locked';

export interface WorkspaceHubVisit {
  readonly authoring: WorkspaceHubVisitState;
  readonly marker: WorkspaceMarker;
  readonly room?: WorkspaceRoomSummary;
  readonly hubSlotKey?: string;
  readonly visitIndex: number;
}

export interface WorkspaceHubDecisionNode {
  /** Whether this is a declaration outline or an authored Hub decision. */
  readonly authoring: 'authored' | 'outline';
  readonly kind: 'hubDecision';
  readonly key: string;
  readonly hubKey: string;
  readonly marker: WorkspaceMarker;
  /** Board-level completeness owner, distinct from each physical slot. */
  readonly openSet: WorkspaceMarker;
  readonly openSlotCount: { readonly current: number; readonly min: number; readonly max: number };
  readonly owner: HubDecisionAddress;
  readonly requiredVisitCount: number;
  readonly slots: readonly WorkspaceHubSlot[];
  readonly visits: readonly WorkspaceHubVisit[];
}

export interface WorkspaceOccurrenceWorkbenchNode {
  readonly kind: 'occurrenceWorkbench';
  readonly key: string;
  /**
   * Projection-owned semantic owners for this room's additional local detail.
   * Hub child rail selection consumes these rather than inferring room policy.
   */
  readonly localDetailMarkers: readonly WorkspaceMarker[];
  readonly marker: WorkspaceMarker;
  /**
   * Hub targets keep their incoming offer on the persistent board. Their
   * occurrence workbench therefore exposes only room-local detail.
   */
  readonly inspectorPresentation: 'full' | 'hubRoomLocal';
  /** A hidden N source decision remains removable from its destination stage. */
  readonly sourceDecisionRemoval?: WorkspaceStageDecisionRemoval;
  /**
   * A physical target can fail before its room-local state does. The compact
   * rail therefore presents the target owner while retaining the occurrence
   * marker as the room's semantic identity for its inspector.
   */
  readonly railMarker?: WorkspaceMarker;
  /** Hub board rooms remain inspector destinations, not duplicated rail stops. */
  readonly railVisibility?: 'inspectorOnly';
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

/** A normalized authored biome field rendered without React consulting a layout. */
export type WorkspaceBiomeField =
  | {
      readonly address: BiomeFieldAddress;
      readonly key: string;
      readonly kind: 'boolean';
      readonly label: string;
      readonly marker: WorkspaceMarker;
      readonly value: boolean | null;
      readonly values: readonly boolean[];
    }
  | {
      readonly address: BiomeFieldAddress;
      readonly key: string;
      readonly kind: 'boundedInteger';
      readonly label: string;
      readonly marker: WorkspaceMarker;
      readonly value: number | null;
      readonly values: readonly number[];
    }
  | {
      readonly address: BiomeFieldAddress;
      readonly key: string;
      readonly kind: 'enum';
      readonly label: string;
      readonly marker: WorkspaceMarker;
      readonly value: string | null;
      readonly values: readonly string[];
    };

export type WorkspaceNode =
  | WorkspaceLinkedExitNode
  | WorkspaceOrdinaryBatchNode
  | WorkspaceTakeoverBatchNode
  | WorkspaceMixedBatchNode
  | WorkspaceHubDecisionNode
  | WorkspaceOccurrenceWorkbenchNode
  | WorkspaceCompletionNode;

/** One authored Hub visit becomes an indented occurrence-owned rail child. */
export interface WorkspaceHubVisitRailEntry {
  readonly key: string;
  readonly label: string;
  /** The visited occurrence owns rail focus and local finding navigation. */
  readonly marker: WorkspaceMarker;
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  /** The Hub visit remains available for visit-order presentation and markers. */
  readonly visitMarker: WorkspaceMarker;
  readonly visitIndex: number;
}

/** N's persistent Hub is the only nested rail group in this workspace slice. */
export interface WorkspaceHubRailEntry {
  readonly kind: 'hubGroup';
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly node: WorkspaceHubDecisionNode;
  readonly visits: readonly WorkspaceHubVisitRailEntry[];
}

/**
 * The projection owns visual rail placement. In particular, an active
 * ordinary frontier precedes derived completion endpoints in an incomplete
 * biome; React must not reconstruct that ordering from node categories.
 */
export type WorkspaceRailEntry =
  | {
      readonly kind: 'node';
      readonly key: string;
      readonly marker: WorkspaceMarker;
      readonly node: WorkspaceNode;
    }
  | WorkspaceHubRailEntry
  | {
      readonly kind: 'frontier';
      readonly frontier: Extract<
        WorkspaceAuthoringFrontier,
        { readonly kind: 'start' | 'exitDecision' }
      >;
      readonly key: string;
      readonly marker: WorkspaceMarker;
    };

/** One envelope for every biome; the node union carries its structure. */
export interface WorkspaceBiome {
  readonly biomeKey: string;
  readonly completion: readonly WorkspaceCompletionNode[];
  /** Read-only completion landmarks when a Hub owns the authoring rail. */
  readonly completionOutline: readonly WorkspaceCompletionNode[];
  readonly entry?: WorkspaceOccurrenceWorkbenchNode;
  readonly fields: readonly WorkspaceBiomeField[];
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly nodes: readonly WorkspaceNode[];
  readonly rail: readonly WorkspaceRailEntry[];
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

/**
 * Retained ordinary targets keep their declaration-owned key even when a room
 * replacement no longer exposes that door.  Normal keys are canonicalized by
 * the core as `exit${RoomExit.index}`, so the key remains the durable physical
 * ordinal for presentation and ordering.
 */
function normalExitOrdinal(exitKey: string): number | undefined {
  const match = /^exit([1-9][0-9]*)$/.exec(exitKey);
  if (match === null) return undefined;
  const index = Number(match[1]);
  return Number.isSafeInteger(index) ? index : undefined;
}

function requiredNormalExitOrdinal(exitKey: string): number {
  const index = normalExitOrdinal(exitKey);
  if (index === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${exitKey} is not a canonical normal physical exit key`,
    );
  }
  return index;
}

/** Kept solely as a defensive sort fallback; it is never a published ordinal. */
const unknownPhysicalExitSortIndex = Number.MAX_SAFE_INTEGER;

/** A linked exit is validated by the core as the source room's sole normal door. */
const linkedExitOrdinal = 1;

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

function biomeFieldLabel(field: AuthoredFieldDescriptor): string {
  switch (field.key) {
    case 'maxNonGoalRewards':
      return 'Rolled non-goal limit';
    default:
      return field.key;
  }
}

function projectBiomeFields(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  layout: BiomeLayout,
): readonly WorkspaceBiomeField[] {
  return Object.freeze(
    layout.fields.map((field) => {
      const address = createBiomeFieldAddress(context.biome, field.key);
      const value = plan.state[field.key] ?? null;
      const base = {
        address,
        key: field.key,
        label: biomeFieldLabel(field),
        marker: marker(context, address),
      };
      switch (field.kind) {
        case 'boolean':
          if (value !== null && typeof value !== 'boolean') {
            throw new StructuredWorkspaceProjectionContractError(
              `${plan.biomeKey} field ${field.key} is not boolean`,
            );
          }
          return Object.freeze({
            ...base,
            kind: 'boolean' as const,
            value,
            values: Object.freeze([false, true]),
          });
        case 'boundedInteger':
          if (value !== null && typeof value !== 'number') {
            throw new StructuredWorkspaceProjectionContractError(
              `${plan.biomeKey} field ${field.key} is not numeric`,
            );
          }
          return Object.freeze({
            ...base,
            kind: 'boundedInteger' as const,
            value,
            values: Object.freeze(
              Array.from({ length: field.max - field.min + 1 }, (_, index) => field.min + index),
            ),
          });
        case 'enum':
          if (value !== null && typeof value !== 'string') {
            throw new StructuredWorkspaceProjectionContractError(
              `${plan.biomeKey} field ${field.key} is not an enum value`,
            );
          }
          return Object.freeze({
            ...base,
            kind: 'enum' as const,
            value,
            values: field.values,
          });
      }
    }),
  );
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
  entered: boolean,
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
      const state = occurrence.state;
      const profile = context.catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} encounter profile is missing`,
        );
      }
      for (const [wheelKey, wheel] of Object.entries(state.wheels)) {
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
      // Shop state may remain persisted after its physical exit becomes an
      // unpicked offer. Inventory is a lifecycle product, not an authored
      // leaf: keep the state for a later re-pick but do not publish controls
      // before this room has actually been entered.
      if (!entered) break;
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
    case 'fixed': {
      const offer = fixedRewardOffer(room, occurrence.state);
      const rewardType = context.catalog.rewards.rewardTypes.byKey[offer.rewardType];
      if (rewardType?.payloadDomain !== undefined) {
        controls.push(
          rewardControl(
            context,
            { kind: 'incomingReward', address: incoming },
            undefined,
            offer,
            Object.freeze([offer.rewardType]),
          ),
        );
      }
      break;
    }
    case 'none':
      break;
  }
  return Object.freeze(controls);
}

function requireProjectedRewardControl<TKind extends WorkspaceRewardControl['kind']>(
  controls: readonly WorkspaceRewardControl[],
  address: SemanticAddress,
  kind: TKind,
): Extract<WorkspaceRewardControl, { readonly kind: TKind }> {
  const control = controls.find(
    (candidate) => semanticAddressKey(candidate.owner.address) === semanticAddressKey(address),
  );
  if (control?.kind !== kind) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(address)} has no ${kind} room-local control`,
    );
  }
  return control as Extract<WorkspaceRewardControl, { readonly kind: TKind }>;
}

function ordinalLabel(position: number): string {
  const remainder = position % 100;
  if (remainder >= 11 && remainder <= 13) return `${position}th`;
  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}

function ephyraSideRoomEntryOrderControl(
  address: LocalChildAddress,
  enteredSlotKeys: readonly string[],
  slotKey: string,
): WorkspaceEphyraSideRoomEntryOrderControl {
  const index = enteredSlotKeys.indexOf(slotKey);
  const withoutSlot = Object.freeze(enteredSlotKeys.filter((candidate) => candidate !== slotKey));
  const options: WorkspaceEphyraSideRoomEntryOption[] = [
    Object.freeze({
      key: 'notEntered',
      label: 'Not entered',
      position: null,
      proposedEnteredSlotKeys: withoutSlot,
    }),
  ];
  for (let insertionIndex = 0; insertionIndex <= withoutSlot.length; insertionIndex += 1) {
    const position = insertionIndex + 1;
    options.push(
      Object.freeze({
        key: `position:${position}`,
        label: ordinalLabel(position),
        position,
        proposedEnteredSlotKeys: Object.freeze([
          ...withoutSlot.slice(0, insertionIndex),
          slotKey,
          ...withoutSlot.slice(insertionIndex),
        ]),
      }),
    );
  }
  return Object.freeze({
    interactionKey: workspaceSideRoomEntryOrderKey(address),
    options: Object.freeze(options),
    selectedKey: index < 0 ? 'notEntered' : `position:${index + 1}`,
  });
}

function roomLocalForOccurrence(
  context: MutableProjectionContext,
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  controls: readonly WorkspaceRewardControl[],
  entered: boolean,
  canonical: CanonicalAuthoredRoom | undefined,
  authoredFieldsActiveCageCount: number | undefined = undefined,
): WorkspaceRoomLocal {
  const incoming = createIncomingRewardAddress(context.biome, occurrence.occurrenceId);
  switch (occurrence.state.kind) {
    case 'none':
      return Object.freeze({ kind: 'none' as const });
    case 'fixed': {
      const offer = fixedRewardOffer(room, occurrence.state);
      const rewardType = context.catalog.rewards.rewardTypes.byKey[offer.rewardType];
      const control =
        rewardType?.payloadDomain === undefined
          ? undefined
          : requireProjectedRewardControl(controls, incoming, 'explicitReward');
      return Object.freeze({
        kind: 'fixed' as const,
        marker: marker(context, incoming),
        summary: summarizeRewardOffer(context.catalog, offer),
        ...(control === undefined ? {} : { control }),
      });
    }
    case 'counted':
    case 'freeReward': {
      const control = requireProjectedRewardControl(controls, incoming, 'countedReward');
      return Object.freeze({
        kind: 'incomingReward' as const,
        control,
        ...(canonical?.clockworkReward === undefined
          ? {}
          : { clockworkReward: canonical.clockworkReward }),
      });
    }
    case 'ephyraCombat': {
      const state = occurrence.state;
      const incomingReward = requireProjectedRewardControl(controls, incoming, 'countedReward');
      const group = room.localChildren.find((child) => child.kind === 'fixedRoomSlots');
      // Ephyra combat state owns the incoming Hub reward for every Hub room;
      // only the declarations with fixed side-room slots expose the additional
      // local lifecycle. Do not invent an empty side-room group for the rest.
      if (group === undefined && Object.keys(state.sideRooms).length === 0) {
        return Object.freeze({ kind: 'incomingReward' as const, control: incomingReward });
      }
      if (group?.kind !== 'fixedRoomSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ephyra state has no fixed side-room declaration`,
        );
      }
      const groupAddress = createLocalChildGroupAddress(
        context.biome,
        occurrence.occurrenceId,
        group.key,
      );
      const enteredSlotKeys = Object.entries(state.sideRooms)
        .filter(([, side]) => side.enteredOrdinal !== null)
        .sort((left, right) => left[1].enteredOrdinal! - right[1].enteredOrdinal!)
        .map(([slotKey]) => slotKey);
      const slots = group.slots.map((slot) => {
        const side = state.sideRooms[slot.slotKey];
        if (side === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ephyra state is missing side room ${slot.slotKey}`,
          );
        }
        const sideRoom = requireRoom(context.catalog, slot.roomGameName);
        const address = createLocalChildAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slot.slotKey,
        );
        const reward = createLocalRewardAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slot.slotKey,
        );
        return Object.freeze({
          address,
          entered: side.enteredOrdinal !== null,
          enteredOrdinal: side.enteredOrdinal,
          entryOrder: ephyraSideRoomEntryOrderControl(address, enteredSlotKeys, slot.slotKey),
          generation: side.generation,
          key: slot.slotKey,
          label: sideRoom.label,
          marker: marker(context, address),
          physicalDoorId: slot.physicalDoorId,
          rewardControl: requireProjectedRewardControl(controls, reward, 'countedReward'),
        });
      });
      return Object.freeze({
        kind: 'ephyra' as const,
        incomingReward,
        sideRooms: Object.freeze({
          address: groupAddress,
          enteredSlotKeys: Object.freeze(enteredSlotKeys),
          marker: marker(context, groupAddress),
          slots: Object.freeze(slots),
        }),
      });
    }
    case 'fieldsCombat': {
      const group = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
      if (group?.kind !== 'boundedRewardSlots') {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Fields state has no bounded cage declaration`,
        );
      }
      const active = new Set(
        canonical?.localRewards?.map((reward) => semanticAddressKey(reward.origin)) ??
          (authoredFieldsActiveCageCount === undefined
            ? []
            : group.slotKeys
                .slice(0, authoredFieldsActiveCageCount)
                .map((slotKey) =>
                  semanticAddressKey(
                    createLocalRewardAddress(
                      context.biome,
                      occurrence.occurrenceId,
                      group.key,
                      slotKey,
                    ),
                  ),
                )),
      );
      const cages = group.slotKeys.map((slotKey, index) => {
        const address = createLocalRewardAddress(
          context.biome,
          occurrence.occurrenceId,
          group.key,
          slotKey,
        );
        return Object.freeze({
          active: active.has(semanticAddressKey(address)),
          control: requireProjectedRewardControl(controls, address, 'countedReward'),
          key: slotKey,
          label: `Cage ${index + 1}`,
        });
      });
      return Object.freeze({
        kind: 'fields' as const,
        cages: Object.freeze(cages),
        groupKey: group.key,
      });
    }
    case 'shipCombat': {
      const state = occurrence.state;
      const profile = context.catalog.encounterProfiles.byKey[room.encounterProfileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} Ship state has no encounter profile`,
        );
      }
      let wheelOrdinal = 0;
      const wheels = profile.phases.flatMap((phase, phaseIndex) => {
        const declaration = phase.offerPoint;
        if (declaration === undefined) return [];
        const wheel = state.wheels[declaration.key];
        if (wheel === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} Ship state is missing ${declaration.key}`,
          );
        }
        const address = createRewardWheelAddress(
          context.biome,
          occurrence.occurrenceId,
          declaration.key,
        );
        const active = phaseIndex < state.encounterCount;
        const label = `Reward wheel ${wheelOrdinal + 1}`;
        wheelOrdinal += 1;
        const offers = declaration.offerKeys.map((offerKey, offerIndex) => {
          const offerAddress = createRewardWheelOfferAddress(
            context.biome,
            occurrence.occurrenceId,
            declaration.key,
            offerKey,
          );
          return Object.freeze({
            active: active && offerIndex < wheel.offerCount,
            control: requireProjectedRewardControl(controls, offerAddress, 'countedReward'),
            key: offerKey,
            label: `Offer ${offerIndex + 1}`,
          });
        });
        return [
          Object.freeze({
            active,
            address,
            key: declaration.key,
            label,
            marker: marker(context, address),
            offerCount: wheel.offerCount,
            offers: Object.freeze(offers),
            pickedOfferIndex: wheel.pickedOfferIndex,
            storeKey: wheel.storeKey,
          }),
        ];
      });
      return Object.freeze({
        kind: 'ship' as const,
        encounterCount: state.encounterCount,
        wheels: Object.freeze(wheels),
      });
    }
    case 'shop': {
      const state = occurrence.state;
      if (!entered || state.shop === undefined) {
        return Object.freeze({
          kind: 'shop' as const,
          materialized: false,
          offers: Object.freeze([]),
        });
      }
      const shop = state.shop;
      const profile = context.catalog.rewards.shops.byKey[shop.profileKey];
      if (profile === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${room.gameName} shop profile ${shop.profileKey} is missing`,
        );
      }
      const offers = profile.slots.values.map((slot) => {
        if (shop.offers[slot.key] === undefined) {
          throw new StructuredWorkspaceProjectionContractError(
            `${room.gameName} shop state is missing ${slot.key}`,
          );
        }
        const offerAddress = createShopOfferAddress(
          context.biome,
          occurrence.occurrenceId,
          slot.key,
        );
        const purchaseAddress = createShopPurchaseAddress(
          context.biome,
          occurrence.occurrenceId,
          slot.key,
        );
        return Object.freeze({
          key: slot.key,
          label: slot.label,
          purchase: Object.freeze({
            address: purchaseAddress,
            marker: marker(context, purchaseAddress),
            purchased: shop.offers[slot.key]!.purchased,
          }),
          rewardControl: requireProjectedRewardControl(controls, offerAddress, 'explicitReward'),
        });
      });
      return Object.freeze({
        kind: 'shop' as const,
        materialized: true,
        offers: Object.freeze(offers),
      });
    }
  }
}

/**
 * A room workbench's local surface is distinct from its incoming reward. Hub
 * visits use this explicit set for child selection so board-owned offers do
 * not become child-owned merely because they share an occurrence.
 */
function localDetailMarkers(roomLocal: WorkspaceRoomLocal): readonly WorkspaceMarker[] {
  switch (roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze([]);
    case 'ephyra':
      return Object.freeze([
        roomLocal.sideRooms.marker,
        ...roomLocal.sideRooms.slots.flatMap((slot) => [slot.marker, slot.rewardControl.marker]),
      ]);
    case 'fields':
      return Object.freeze(roomLocal.cages.map((cage) => cage.control.marker));
    case 'ship':
      return Object.freeze(
        roomLocal.wheels.flatMap((wheel) => [
          wheel.marker,
          ...wheel.offers.map((offer) => offer.control.marker),
        ]),
      );
    case 'shop':
      return Object.freeze(
        roomLocal.offers.flatMap((offer) => [offer.purchase.marker, offer.rewardControl.marker]),
      );
  }
}

function projectOccurrence(
  context: MutableProjectionContext,
  occurrence: RoomOccurrence,
  entered = false,
  canonical?: CanonicalAuthoredRoom,
  authoredFieldsActiveCageCount?: number,
): WorkspaceOccurrenceWorkbenchNode {
  const room = requireRoom(context.catalog, occurrence.gameName);
  const address = createOccurrenceAddress(context.biome, occurrence.occurrenceId);
  // A dormant Shop is a dead leaf. Its persisted inventory remains available
  // to the command model if the room is picked again, but neither its offer
  // summary nor its editable lifecycle controls are currently materialized.
  const summary =
    occurrence.state.kind === 'shop' && !entered
      ? undefined
      : rewardSummary(context.catalog, room, occurrence.state);
  const rewardControls = controlsForOccurrence(context, occurrence, room, entered);
  const roomSummary: WorkspaceRoomSummary = Object.freeze({
    address,
    entered,
    gameName: occurrence.gameName,
    kind: room.kind,
    label: room.label,
    marker: marker(context, address),
    occurrenceId: occurrence.occurrenceId,
    ...(context.roomControls.get(semanticAddressKey(address)) === undefined
      ? {}
      : { roomPicker: context.roomControls.get(semanticAddressKey(address))! }),
    roomLocal: roomLocalForOccurrence(
      context,
      occurrence,
      room,
      rewardControls,
      entered,
      canonical,
      authoredFieldsActiveCageCount,
    ),
    rewardControls,
    ...(summary === undefined ? {} : { rewardSummary: summary }),
  });
  return Object.freeze({
    inspectorPresentation: 'full' as const,
    kind: 'occurrenceWorkbench' as const,
    key: `occurrence:${semanticAddressKey(address)}`,
    localDetailMarkers: localDetailMarkers(roomSummary.roomLocal),
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

function hubStageDecisionRemoval(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  owner: ExitDecisionAddress,
  stage: 'preHub' | 'preboss',
): WorkspaceStageDecisionRemoval | undefined {
  const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.progression.kind !== 'hub') return undefined;
  const isExpectedSource =
    stage === 'preHub'
      ? layout.start.kind === 'fixedAuthored' &&
        owner.source.kind === 'occurrence' &&
        authoredOccurrence(plan, owner.source.occurrenceId)?.gameName === layout.start.roomGameName
      : owner.source.kind === 'hubDecision' &&
        owner.source.decisionKey === layout.progression.hubKey;
  if (!isExpectedSource) return undefined;
  return Object.freeze({
    interactionKey: workspaceInteractionKey(owner),
    label: stage === 'preHub' ? 'Remove PreHub' : 'Remove Preboss',
  });
}

function targetNode(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  target: CanonicalTarget,
  sourceDecisionRemoval: WorkspaceStageDecisionRemoval | undefined = undefined,
): { readonly target: WorkspacePhysicalTarget; readonly node?: WorkspaceOccurrenceWorkbenchNode } {
  const occurrence = canonicalRoomOccurrence(plan, target.room);
  const targetMarker = marker(context, target.origin);
  const occurrenceNode =
    occurrence === undefined
      ? undefined
      : projectOccurrence(context, occurrence, target.room.entered, target.room);
  const node =
    occurrenceNode === undefined
      ? undefined
      : Object.freeze({
          ...occurrenceNode,
          ...(sourceDecisionRemoval === undefined ? {} : { sourceDecisionRemoval }),
          railMarker: targetMarker,
        });
  const room = node?.room;
  if (room === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${plan.biomeKey} materialized target ${target.room.occurrenceId} is absent from authored occurrences`,
    );
  }
  return Object.freeze({
    target: Object.freeze({
      ...(target.room.clockworkReward === undefined
        ? {}
        : { clockworkReward: target.room.clockworkReward }),
      exitKey: target.exit.exitKey,
      index: target.exit.index,
      marker: targetMarker,
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

function topologyRemovalScope(
  biome: BiomeAddress,
  impact: TopologyRemovalImpact,
): WorkspaceTopologyRemovalScope {
  return Object.freeze({
    removedDecisionOwners: Object.freeze(
      impact.removedExitDecisionSources.map((source) => createExitDecisionAddress(biome, source)),
    ),
    removedHubDecisionKeys: impact.removedHubDecisionKeys,
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
  return batchRepairScopeForRoots(context, plan, batch.origin, kind, roots);
}

/**
 * The command owns retained-target reconciliation. Both canonical and raw
 * authored projections ask this one domain-derived calculation for its exact
 * removal impact; blocked suffixes must not silently lose the repair that
 * their persisted topology still requires.
 */
function batchRepairScopeForRoots(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  owner: ExitDecisionAddress,
  kind: 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch',
  roots: ReadonlySet<OccurrenceId>,
): WorkspaceBatchRepairScope | undefined {
  const removal = projectRemovalScope(context.biome, plan, roots);
  if (removal === undefined) return undefined;
  return kind === 'takeoverBatch'
    ? Object.freeze({ commandKind: 'ReconcileTakeoverBatch' as const, owner, ...removal })
    : Object.freeze({
        command: Object.freeze({ kind: 'ReconcileBatchExitCapacity' as const, decision: owner }),
        commandKind: 'ReconcileBatchExitCapacity' as const,
        owner,
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

function missingTargetsForPhysicalExits(
  context: MutableProjectionContext,
  source: ExitDecisionSourceAddress,
  exits: readonly { readonly exitKey: string; readonly index: number }[],
  authoredExitKeys: ReadonlySet<string>,
  prerequisite: WorkspaceMissingTargetSetupPrerequisite | undefined = undefined,
): readonly WorkspaceMissingPhysicalTarget[] {
  let firstMissing: { readonly exitKey: string; readonly index: number } | undefined;
  const missing: WorkspaceMissingPhysicalTarget[] = [];
  for (const exit of [...exits].sort((left, right) => left.index - right.index)) {
    if (authoredExitKeys.has(exit.exitKey)) continue;
    const owner = createTargetAddress(context.biome, source, exit.exitKey);
    missing.push(
      Object.freeze({
        authoring:
          prerequisite ??
          (firstMissing === undefined
            ? Object.freeze({ kind: 'ready' as const })
            : Object.freeze({
                kind: 'awaitingPriorExit' as const,
                message: `Choose Exit ${firstMissing.index} first.`,
                prerequisiteExitKey: firstMissing.exitKey,
              })),
        exitKey: exit.exitKey,
        index: exit.index,
        marker: marker(context, owner),
        owner,
      }),
    );
    firstMissing ??= exit;
  }
  return Object.freeze(missing);
}

function missingTargetsForBatch(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  batch: CanonicalBatch,
): readonly WorkspaceMissingPhysicalTarget[] {
  if (batch.parent.origin.kind === 'hubRoom') return Object.freeze([]);
  return missingTargetsForPhysicalExits(
    context,
    batch.source,
    physicalExitsForSource(context, plan, batch.source),
    new Set(batch.targets.map((target) => target.exit.exitKey)),
  );
}

function fieldsContextForCanonicalBatch(
  context: MutableProjectionContext,
  batch: CanonicalBatch,
): WorkspaceFieldsBatchContext | undefined {
  if (batch.batchState.kind !== 'fields') return undefined;
  const support =
    context.evaluation !== undefined && 'roomGeneration' in context.evaluation
      ? context.evaluation.roomGeneration.ordinary.fieldsCageOutcomes.find(
          (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(batch.origin),
        )
      : undefined;
  return Object.freeze({
    cageOutcome: batch.batchState.cageOutcome,
    cageTargetCount: batch.batchState.cageTargetCount,
    doorCageRewardCount: batch.batchState.doorCageRewardCount,
    ...(support === undefined
      ? {}
      : {
          priorMaxOutcomes: Object.freeze({
            fieldsMaxDoorsRolled: support.fieldsMaxDoorsRolled,
            maxDoorCageCeiling: support.maxDoorCageCeiling,
          }),
        }),
  });
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
  const kind = batchKind(context.catalog, batch);
  const sourceDecisionRemoval =
    kind === 'takeoverBatch' && batch.source.kind === 'hubDecision'
      ? hubStageDecisionRemoval(context, plan, owner, 'preboss')
      : undefined;
  const projectedTargets = batch.targets.map((target) =>
    targetNode(context, plan, target, sourceDecisionRemoval),
  );
  const repairScope = batchRepairScope(context, plan, batch, kind);
  const fields = fieldsContextForCanonicalBatch(context, batch);
  const rewardStore =
    batch.rewardStore.kind === 'authoredBaseStore'
      ? marker(context, batch.rewardStore.origin)
      : undefined;
  const base = {
    batchState: batch.batchState,
    ...(fields === undefined ? {} : { fields }),
    key: `batch:${semanticAddressKey(owner)}`,
    marker: marker(context, owner),
    missingTargets: missingTargetsForBatch(context, plan, batch),
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
  const sourceDecisionRemoval = hubStageDecisionRemoval(context, plan, linked.origin, 'preHub');
  const projected = targetNode(context, plan, linked.target, sourceDecisionRemoval);
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

interface ProjectedHubTarget {
  readonly canonical?: CanonicalAuthoredRoom;
  readonly occurrenceId: OccurrenceId;
}

function hubMainRewardMarker(room: WorkspaceRoomSummary): WorkspaceMarker | undefined {
  switch (room.roomLocal.kind) {
    case 'fixed':
      return room.roomLocal.marker;
    case 'incomingReward':
      return room.roomLocal.control.marker;
    case 'ephyra':
      return room.roomLocal.incomingReward.marker;
    case 'none':
    case 'fields':
    case 'ship':
    case 'shop':
      return undefined;
  }
}

/** Hub main offers retain their semantic owner but navigate to the Hub board. */
function redirectHubMainRewardFocus(
  context: MutableProjectionContext,
  hub: WorkspaceMarker,
  mainReward: WorkspaceMarker,
): void {
  context.focusByOwner.set(
    mainReward.focusKey,
    Object.freeze({
      biomeKey: context.biome.biomeKey,
      focusAddress: hub.address,
      focusKey: hub.focusKey,
      nodeKey: `hub:${hub.focusKey}`,
      ownerAddress: mainReward.address,
      region: 'structure' as const,
      routeKey: context.routeKey,
    }),
  );
}

/**
 * The Hub board is one declaration-owned decision.  Materialization may only
 * retain a prefix of it, while the authored decision can retain later rooms
 * and visits.  Project both through the same board shape so React never has
 * to choose between topology and the simulator product.
 */
function projectHubNode(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  descriptor: HubDecisionDescriptor,
  owner: HubDecisionAddress,
  targets: ReadonlyMap<string, ProjectedHubTarget>,
  visitOrder: readonly string[],
  nextVisitIndex: number | undefined,
  boardAuthored: boolean,
): {
  readonly node: WorkspaceHubDecisionNode;
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
} {
  const hubMarker = marker(context, owner);
  const occurrences = hubOccurrenceMap(plan);
  const visited = new Set(visitOrder);
  const workbenches: WorkspaceOccurrenceWorkbenchNode[] = [];
  const roomsBySlot = new Map<string, WorkspaceRoomSummary>();
  const slots = descriptor.slots.map((slot) => {
    const target = targets.get(slot.slotKey);
    const occurrence = target === undefined ? undefined : occurrences.get(target.occurrenceId);
    const address = createHubSlotAddress(context.biome, descriptor.hubKey, slot.slotKey);
    const slotMarker = marker(context, address);
    const entered = visited.has(slot.slotKey);
    const occurrenceNode =
      occurrence === undefined
        ? undefined
        : projectOccurrence(context, occurrence, entered, target?.canonical);
    if (occurrenceNode !== undefined) {
      const workbench = Object.freeze({
        ...occurrenceNode,
        inspectorPresentation: 'hubRoomLocal' as const,
        railMarker: slotMarker,
        railVisibility: 'inspectorOnly' as const,
      });
      workbenches.push(workbench);
      roomsBySlot.set(slot.slotKey, workbench.room);
      const mainReward = hubMainRewardMarker(workbench.room);
      if (mainReward !== undefined) redirectHubMainRewardFocus(context, hubMarker, mainReward);
    }
    return Object.freeze({
      canClose: boardAuthored && target !== undefined && !entered,
      canOpen: boardAuthored && target === undefined && targets.size < descriptor.openCount.max,
      hubSlotKey: slot.slotKey,
      label: requireRoom(context.catalog, slot.roomGameName).label,
      marker: slotMarker,
      open: target !== undefined,
      physicalDoorId: slot.physicalDoorId,
      ...(occurrenceNode === undefined ? {} : { room: occurrenceNode.room }),
      roomKind: requireRoom(context.catalog, slot.roomGameName).kind,
      visited: entered,
    });
  });
  const visits = Array.from({ length: descriptor.requiredVisits }, (_, index) => {
    const visitIndex = index + 1;
    const hubSlotKey = visitOrder[index];
    const authoring =
      hubSlotKey !== undefined
        ? ('authored' as const)
        : nextVisitIndex === visitIndex
          ? ('next' as const)
          : ('locked' as const);
    return Object.freeze({
      authoring,
      marker: marker(context, createHubVisitAddress(context.biome, descriptor.hubKey, visitIndex)),
      ...(hubSlotKey === undefined ? {} : { hubSlotKey }),
      ...(hubSlotKey === undefined || roomsBySlot.get(hubSlotKey) === undefined
        ? {}
        : { room: roomsBySlot.get(hubSlotKey)! }),
      visitIndex,
    });
  });
  return Object.freeze({
    node: Object.freeze({
      authoring: boardAuthored ? ('authored' as const) : ('outline' as const),
      kind: 'hubDecision' as const,
      key: `hub:${semanticAddressKey(owner)}`,
      hubKey: descriptor.hubKey,
      marker: hubMarker,
      openSet: marker(context, createHubOpenSetAddress(context.biome, descriptor.hubKey)),
      openSlotCount: Object.freeze({
        current: targets.size,
        min: descriptor.openCount.min,
        max: descriptor.openCount.max,
      }),
      owner,
      requiredVisitCount: descriptor.requiredVisits,
      slots: Object.freeze(slots),
      visits: Object.freeze(visits),
    }),
    workbenches: Object.freeze(workbenches),
  });
}

function projectHub(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  hub: CanonicalHubDecision,
  descriptor: HubDecisionDescriptor,
  nextVisitIndex: number | undefined,
): {
  readonly node: WorkspaceHubDecisionNode;
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
} {
  const authoredHub = plan.topology?.decisions.find(
    (decision): decision is HubDecision =>
      decision.kind === 'hub' && decision.hubKey === descriptor.hubKey,
  );
  const targets = new Map<string, ProjectedHubTarget>(
    hub.board.targets.map(
      (target) =>
        [
          target.hubSlotKey,
          Object.freeze({ canonical: target.room, occurrenceId: target.room.occurrenceId }),
        ] as const,
    ),
  );
  // A progressive snapshot may stop before later, retained authored Hub
  // visits. They remain visible and unassessed rather than disappearing from
  // the workspace when an earlier owner is invalid.
  for (const target of authoredHub?.openTargets ?? []) {
    if (!targets.has(target.hubSlotKey)) {
      targets.set(target.hubSlotKey, Object.freeze({ occurrenceId: target.occurrenceId }));
    }
  }
  return projectHubNode(
    context,
    plan,
    descriptor,
    hub.origin,
    targets,
    authoredHub?.visitOrder ?? hub.visits.map((visit) => visit.target.hubSlotKey),
    nextVisitIndex,
    true,
  );
}

function projectAuthoredHub(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  hub: HubDecision,
  descriptor: HubDecisionDescriptor,
  nextVisitIndex: number | undefined,
): {
  readonly node: WorkspaceHubDecisionNode;
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
} {
  const owner = createHubDecisionAddress(context.biome, descriptor.hubKey);
  return projectHubNode(
    context,
    plan,
    descriptor,
    owner,
    new Map(
      hub.openTargets.map(
        (target) =>
          [target.hubSlotKey, Object.freeze({ occurrenceId: target.occurrenceId })] as const,
      ),
    ),
    hub.visitOrder,
    nextVisitIndex,
    true,
  );
}

function projectHubOutline(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  descriptor: HubDecisionDescriptor,
): {
  readonly node: WorkspaceHubDecisionNode;
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
} {
  return projectHubNode(
    context,
    plan,
    descriptor,
    createHubDecisionAddress(context.biome, descriptor.hubKey),
    new Map(),
    Object.freeze([]),
    undefined,
    false,
  );
}

type AuthoredBatchDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
};
type AuthoredLinkedExitDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'linked' }>;
};

/**
 * A retained or upstream-blocked Fields target has no canonical room yet, but
 * its authored batch outcome still declares exactly which cage slots are live.
 * This is a presentation fact from the normalized layout plus authored batch
 * state, not an attempt to simulate an unassessed suffix.
 */
function authoredFieldsActiveCageCount(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: AuthoredBatchDecision,
): number | undefined {
  const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
  if (
    layout?.progression.kind !== 'generated' ||
    layout.progression.batchPolicy.kind !== 'fields' ||
    decision.normal.batchState === null
  ) {
    return undefined;
  }
  let maxCount = layout.progression.batchPolicy.maxDoorCageRewards;
  for (const target of decision.normal.targets) {
    const occurrence = authoredOccurrence(plan, target.occurrenceId);
    if (occurrence === undefined) continue;
    const room = requireRoom(context.catalog, occurrence.gameName);
    const cages = room.localChildren.find((child) => child.kind === 'boundedRewardSlots');
    if (cages?.kind === 'boundedRewardSlots') {
      maxCount = Math.min(maxCount, cages.maxActiveSlots);
    }
  }
  return decision.normal.batchState.cageOutcome === 'min'
    ? layout.progression.batchPolicy.minDoorCageRewards
    : maxCount;
}

function fieldsContextForAuthoredBatch(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: AuthoredBatchDecision,
): WorkspaceFieldsBatchContext | undefined {
  if (decision.normal.batchState === null) return undefined;
  const doorCageRewardCount = authoredFieldsActiveCageCount(context, plan, decision);
  if (doorCageRewardCount === undefined) return undefined;
  const cageTargetCount = decision.normal.targets.filter((target) => {
    const occurrence = authoredOccurrence(plan, target.occurrenceId);
    if (occurrence === undefined) return false;
    return requireRoom(context.catalog, occurrence.gameName).localChildren.some(
      (child) => child.kind === 'boundedRewardSlots',
    );
  }).length;
  return Object.freeze({
    cageOutcome: decision.normal.batchState.cageOutcome,
    cageTargetCount,
    doorCageRewardCount,
  });
}

function missingTargetPrerequisite(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  decision: ExitDecision,
): WorkspaceMissingTargetSetupPrerequisite | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  if (
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    decision.normal.rewardStore.baseRewardStoreKey === null
  ) {
    return Object.freeze({
      kind: 'awaitingBatchRewardStore' as const,
      message: 'Select the batch reward store first.',
    });
  }
  const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
  if (
    layout?.progression.kind === 'generated' &&
    layout.progression.batchPolicy.kind === 'fields' &&
    decision.normal.batchState === null
  ) {
    return Object.freeze({
      kind: 'awaitingFieldsCageOutcome' as const,
      message: 'Select the Fields cage outcome first.',
    });
  }
  return undefined;
}

function physicalExitsForSource(
  context: MutableProjectionContext,
  plan: AuthoredBiomePlan,
  source: ExitDecisionSourceAddress,
): readonly DeclaredPhysicalExit[] {
  const layout = context.catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined || plan.topology === null) return Object.freeze([]);
  return (
    resolveDeclaredPhysicalExits(context.catalog, layout, plan.topology, source) ??
    Object.freeze([])
  );
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
  const kind = rawBatchKind(context, plan, decision);
  const sourceDecisionRemoval =
    kind === 'takeoverBatch' && decision.source.kind === 'hubDecision'
      ? hubStageDecisionRemoval(context, plan, owner, 'preboss')
      : undefined;
  const physical = physicalExitsForSource(context, plan, decision.source);
  const rank = new Map(physical.map((exit) => [exit.exitKey, exit.index] as const));
  const fieldsActiveCageCount = authoredFieldsActiveCageCount(context, plan, decision);
  const fields = fieldsContextForAuthoredBatch(context, plan, decision);
  const workbenches: WorkspaceOccurrenceWorkbenchNode[] = [];
  const targets = [...decision.normal.targets]
    .sort(
      (left, right) =>
        (rank.get(left.exitKey) ??
          normalExitOrdinal(left.exitKey) ??
          unknownPhysicalExitSortIndex) -
        (rank.get(right.exitKey) ??
          normalExitOrdinal(right.exitKey) ??
          unknownPhysicalExitSortIndex),
    )
    .map((target) => {
      const occurrence = authoredOccurrence(plan, target.occurrenceId);
      if (occurrence === undefined) {
        throw new StructuredWorkspaceProjectionContractError(
          `${plan.biomeKey} target ${target.occurrenceId} is absent from authored occurrences`,
        );
      }
      const targetAddress = createTargetAddress(context.biome, decision.source, target.exitKey);
      const targetMarker = marker(context, targetAddress);
      const workbench = Object.freeze({
        ...projectOccurrence(context, occurrence, false, undefined, fieldsActiveCageCount),
        ...(sourceDecisionRemoval === undefined ? {} : { sourceDecisionRemoval }),
        railMarker: targetMarker,
      });
      workbenches.push(workbench);
      const exit = physical.find((candidate) => candidate.exitKey === target.exitKey);
      return Object.freeze({
        exitKey: target.exitKey,
        index: exit?.index ?? requiredNormalExitOrdinal(target.exitKey),
        marker: targetMarker,
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
  const missingTargets = missingTargetsForPhysicalExits(
    context,
    decision.source,
    physical,
    targetsByKey,
    missingTargetPrerequisite(context, plan, decision),
  );
  const repairScope = batchRepairScopeForRoots(
    context,
    plan,
    owner,
    kind,
    new Set(
      targets
        .filter((target) => target.physicalState === 'unavailable')
        .map((target) => target.room.occurrenceId),
    ),
  );
  const base = {
    batchState: decision.normal.batchState,
    ...(fields === undefined ? {} : { fields }),
    key: `batch:${semanticAddressKey(owner)}`,
    marker: marker(context, owner),
    missingTargets,
    owner,
    ...(repairScope === undefined ? {} : { repairScope }),
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
  const owner = createExitDecisionAddress(context.biome, decision.source);
  const sourceDecisionRemoval = hubStageDecisionRemoval(context, plan, owner, 'preHub');
  const occurrence = authoredOccurrence(plan, decision.normal.occurrenceId);
  if (occurrence === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${plan.biomeKey} linked target ${decision.normal.occurrenceId} is absent from authored occurrences`,
    );
  }
  const targetAddress = createTargetAddress(
    context.biome,
    decision.source,
    decision.normal.exitKey,
  );
  const targetMarker = marker(context, targetAddress);
  const workbench = Object.freeze({
    ...projectOccurrence(context, occurrence),
    ...(sourceDecisionRemoval === undefined ? {} : { sourceDecisionRemoval }),
    railMarker: targetMarker,
  });
  const physical = physicalExitsForSource(context, plan, decision.source).find(
    (exit) => exit.exitKey === decision.normal.exitKey,
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
        index: physical?.index ?? linkedExitOrdinal,
        marker: targetMarker,
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
      physicalExitsForSource(context, plan, decision.source).map(
        (exit) => [exit.exitKey, exit.index] as const,
      ),
    );
    for (const target of [...decision.normal.targets].sort(
      (left, right) =>
        (rank.get(left.exitKey) ??
          normalExitOrdinal(left.exitKey) ??
          unknownPhysicalExitSortIndex) -
        (rank.get(right.exitKey) ??
          normalExitOrdinal(right.exitKey) ??
          unknownPhysicalExitSortIndex),
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
    case 'exitDecision': {
      const predecessorNodeKey =
        frontier.source.kind === 'occurrence'
          ? `occurrence:${semanticAddressKey(
              createOccurrenceAddress(context.biome, frontier.source.occurrenceId),
            )}`
          : undefined;
      return Object.freeze({
        kind: 'exitDecision' as const,
        interactionKey: semanticAddressKey(frontier),
        marker: marker(context, frontier),
        owner: frontier,
        ...(predecessorNodeKey === undefined ? {} : { predecessorNodeKey }),
      });
    }
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
    case 'hubOpenSet':
      return Object.freeze({
        kind: 'hubOpenSet' as const,
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

function startRoomControl(
  context: MutableProjectionContext,
  address: OccurrenceAddress,
  candidateGameNames: readonly string[],
  selectedGameName: string,
): void {
  context.roomControls.set(
    semanticAddressKey(address),
    Object.freeze({
      address,
      candidateGameNames: Object.freeze([...candidateGameNames]),
      kind: 'startRoomPicker' as const,
      selectedGameName,
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
    const exits = physicalExitsForSource(context, plan, source);
    const prerequisite = missingTargetPrerequisite(context, plan, decision);
    let encounteredMissingTarget = false;
    for (const exit of [...exits].sort((left, right) => left.index - right.index)) {
      const exitKey = exit.exitKey;
      const target = targets.find((candidate) => candidate.target.exitKey === exitKey);
      if (target === undefined && (prerequisite !== undefined || encounteredMissingTarget)) {
        encounteredMissingTarget = true;
        continue;
      }
      targetControl(
        context,
        createTargetAddress(context.biome, source, exitKey),
        target?.room?.gameName,
      );
      if (target === undefined) encounteredMissingTarget = true;
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

function createInteractionCatalog(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  services: StructuredWorkspaceContextualServices,
  roomControls: ReadonlyMap<string, WorkspaceRoomPickerControl>,
  rewardControls: ReadonlyMap<string, WorkspaceRewardControl>,
): WorkspaceInteractionCatalog {
  const candidates = services.candidateSessions.bind(project, evaluation);
  const takeoverCandidate = (gameName: string): WorkspaceTakeoverCandidate => {
    const room = requireRoom(catalog, gameName);
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
  const createCandidateTakeoverInteraction = ({
    action,
    existingTargetOccurrenceIds,
    gameNames,
    impact,
    owner,
    selected,
  }: {
    readonly action: WorkspaceCandidateTakeoverBatchInteraction['action'];
    readonly existingTargetOccurrenceIds?: ReadonlyMap<string, OccurrenceId>;
    readonly gameNames: readonly string[];
    readonly impact?: WorkspaceTakeoverReplacementImpact;
    readonly owner: ExitDecisionAddress;
    readonly selected?: WorkspaceTakeoverCandidate;
  }): WorkspaceCandidateTakeoverBatchInteraction => {
    let loaded: readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[] | undefined;
    const load = (): readonly CandidateOptionProjection<WorkspaceTakeoverCandidate>[] => {
      if (loaded === undefined) loaded = takeoverCandidates(owner, gameNames);
      return loaded;
    };
    return Object.freeze({
      action,
      commandFor(selection: WorkspaceTakeoverCandidate): TakeoverBatchCommand {
        const candidate = load().find((option) => option.value.gameName === selection.gameName);
        if (
          candidate?.evaluation.kind !== 'takeoverPrebossBatch' ||
          !candidate.evaluation.result.selectedPossible
        ) {
          throw new StructuredWorkspaceProjectionContractError(
            `Takeover candidate ${selection.gameName} is not currently applicable.`,
          );
        }
        return createTakeoverBatchCommand({
          action,
          decision: owner,
          existingTargetOccurrenceIds: existingTargetOccurrenceIds ?? new Map(),
          gameName: selection.gameName,
          requiredExitKeys: candidate.evaluation.result.requiredExitKeys,
        });
      },
      ...(impact === undefined ? {} : { impact }),
      key: semanticAddressKey(owner),
      load,
      owner,
      presentation: 'candidate' as const,
      ...(selected === undefined ? {} : { selected }),
    });
  };
  const createFixedWidthOneTakeoverInteraction = ({
    gameName,
    owner,
    requiredExitKeys,
  }: {
    readonly gameName: string;
    readonly owner: ExitDecisionAddress;
    readonly requiredExitKeys: readonly string[];
  }): WorkspaceFixedWidthOneTakeoverInteraction => {
    const candidate = takeoverCandidate(gameName);
    const room = requireRoom(catalog, gameName);
    const summary =
      room.incomingReward.kind === 'shop'
        ? `Enter ${candidate.label}. This declaration-owned transition creates one automatically entered World Shop.`
        : `Enter ${candidate.label} through this declaration-owned transition.`;
    return Object.freeze({
      execute(): WorkspaceFixedWidthOneTakeoverActionResult {
        // This fixed declaration still receives the engine's contextual
        // validation only when the player takes it. React never loads or
        // interprets a candidate result.
        const evaluated = takeoverCandidates(owner, Object.freeze([gameName]))[0];
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
            decision: owner,
            existingTargetOccurrenceIds: new Map(),
            gameName,
            // `requiredExitKeys` comes from shared topology authority.  The
            // The lazy engine evaluation above establishes whether this fixed
            // width-one takeover is currently possible; it does not make
            // React derive the physical exit vocabulary.
            requiredExitKeys,
          }),
        });
      },
      action: 'create' as const,
      key: semanticAddressKey(owner),
      label: candidate.label,
      owner,
      presentation: 'fixedWidthOneTakeover' as const,
      summary,
    });
  };
  const createCompletedHubHandoffInteraction = ({
    gameName,
    owner,
    requiredExitKeys,
  }: {
    readonly gameName: string;
    readonly owner: ExitDecisionAddress;
    readonly requiredExitKeys: readonly string[];
  }): WorkspaceCompletedHubHandoffInteraction =>
    Object.freeze({
      action: 'create' as const,
      execute: () =>
        createTakeoverBatchCommand({
          action: 'create',
          decision: owner,
          existingTargetOccurrenceIds: new Map(),
          gameName,
          requiredExitKeys,
        }),
      key: semanticAddressKey(owner),
      label: takeoverCandidate(gameName).label,
      owner,
      presentation: 'completedHubHandoff' as const,
    });
  const createTakeoverRepairInteraction = ({
    existingTargetOccurrenceIds,
    gameName,
    owner,
    requiredExitKeys,
  }: {
    readonly existingTargetOccurrenceIds: ReadonlyMap<string, OccurrenceId>;
    readonly gameName: string;
    readonly owner: ExitDecisionAddress;
    readonly requiredExitKeys: readonly string[];
  }): WorkspaceTakeoverRepairInteraction =>
    Object.freeze({
      action: 'reconcile' as const,
      execute: () =>
        createTakeoverBatchCommand({
          action: 'reconcile',
          decision: owner,
          existingTargetOccurrenceIds,
          gameName,
          requiredExitKeys,
        }),
      key: semanticAddressKey(owner),
      label: takeoverCandidate(gameName).label,
      owner,
      presentation: 'repair' as const,
    });
  const rooms = new Map<string, WorkspaceRoomInteraction>();
  for (const [key, control] of roomControls) {
    const candidateRooms = (() => {
      if (control.kind === 'startRoomPicker') {
        return Object.freeze(
          control.candidateGameNames.map((gameName) => requireRoom(catalog, gameName)),
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
  const topologyRemovals = new Map<string, WorkspaceTopologyRemovalInteraction>();

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
              ? {
                  fixedGameName: layout.start.roomGameName,
                  fixedLabel: requireRoom(catalog, layout.start.roomGameName).label,
                  kind: 'fixed' as const,
                }
              : { kind: 'choice' as const }),
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
      const fixedWidthOneTakeover = fixedWidthOneTakeoverForLayout(catalog, layout);
      topologyRemovals.set(
        semanticAddressKey(biome),
        Object.freeze({
          action: 'clearTopology' as const,
          command: Object.freeze({ kind: 'ClearTopology' as const, biome }),
          impact: topologyRemovalScope(biome, describeClearTopologyImpact(plan.topology)),
          key: semanticAddressKey(biome),
          owner: biome,
        }),
      );
      for (const decision of plan.topology.decisions) {
        if (decision.kind === 'hub') {
          if (layout.progression.kind !== 'hub' || decision.hubKey !== layout.progression.hubKey)
            continue;
          for (const slot of layout.progression.slots) {
            const opened = decision.openTargets.find(
              (target) => target.hubSlotKey === slot.slotKey,
            );
            const owner = createHubSlotAddress(biome, decision.hubKey, slot.slotKey);
            const closeImpact =
              opened === undefined
                ? undefined
                : describeHubSlotClosureImpact(
                    plan.topology,
                    decision.hubKey,
                    slot.slotKey,
                    layout.progression.openCount.min,
                  );
            const values = Object.freeze([false, true]);
            hubSlots.set(
              semanticAddressKey(owner),
              Object.freeze({
                bind: (proposedOccurrenceId: OccurrenceId) =>
                  candidateInteraction(
                    owner,
                    Object.freeze([
                      Object.freeze({ label: 'Closed', value: false }),
                      Object.freeze({ label: 'Open', value: true }),
                    ]),
                    opened !== undefined,
                    () =>
                      candidates.hubSlots(
                        owner,
                        opened?.occurrenceId ?? proposedOccurrenceId,
                        values,
                      ),
                    `${semanticAddressKey(owner)}:proposed:${proposedOccurrenceId}`,
                  ),
                ...(closeImpact === undefined
                  ? {}
                  : {
                      close: Object.freeze({
                        command: Object.freeze({ kind: 'CloseHubSlot' as const, slot: owner }),
                        impact: topologyRemovalScope(biome, closeImpact),
                      }),
                    }),
                key: semanticAddressKey(owner),
                owner,
                roomGameName: slot.roomGameName,
                selected: opened !== undefined,
              }),
            );
          }
          // Visit order is constrained by the authored board, not by candidate
          // coverage. An invalid room-local leaf can make visit evaluation
          // unassessed, but it must not expand this selector back to every
          // declaration-fixed Hub slot.
          const hubVisitSlots = Object.freeze(
            layout.progression.slots.filter((slot) =>
              decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey),
            ),
          );
          const hubVisitChoices = Object.freeze(
            hubVisitSlots.map((slot) =>
              Object.freeze({
                label: requireRoom(catalog, slot.roomGameName).label,
                value: slot.slotKey,
              }),
            ),
          );
          for (let visitIndex = 1; visitIndex <= decision.visitOrder.length + 1; visitIndex += 1) {
            if (visitIndex > layout.progression.requiredVisits) break;
            const slotKey = decision.visitOrder[visitIndex - 1];
            const owner = createHubVisitAddress(biome, decision.hubKey, visitIndex);
            const visitChoices = Object.freeze(
              hubVisitChoices.filter(
                (choice) => choice.value === slotKey || !decision.visitOrder.includes(choice.value),
              ),
            );
            hubVisits.set(
              semanticAddressKey(owner),
              candidateInteraction(owner, visitChoices, slotKey, () =>
                candidates.hubVisits(
                  owner,
                  Object.freeze(visitChoices.map((choice) => choice.value)),
                ),
              ),
            );
          }
          continue;
        }
        const owner = createExitDecisionAddress(biome, decision.source);
        const removalImpact = describeExitDecisionRemovalImpact(plan.topology, decision.source);
        if (removalImpact !== undefined) {
          topologyRemovals.set(
            semanticAddressKey(owner),
            Object.freeze({
              action: 'removeExitDecision' as const,
              command: Object.freeze({ kind: 'RemoveExitDecision' as const, decision: owner }),
              impact: topologyRemovalScope(biome, removalImpact),
              key: semanticAddressKey(owner),
              owner,
            }),
          );
        }
        if (decision.normal.kind === 'batch') {
          if (decision.selection.kind !== 'derived') {
            const declaredExits =
              resolveDeclaredPhysicalExits(catalog, layout, plan.topology, decision.source) ?? [];
            const physicalOrder = new Map<string, number>(
              declaredExits.map((exit) => [exit.exitKey, exit.index] as const),
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
                        (physicalOrder.get(left.exitKey) ??
                          normalExitOrdinal(left.exitKey) ??
                          unknownPhysicalExitSortIndex) -
                        (physicalOrder.get(right.exitKey) ??
                          normalExitOrdinal(right.exitKey) ??
                          unknownPhysicalExitSortIndex),
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
          const existingTargetOccurrenceIds = new Map(
            decision.normal.targets.map((target) => [target.exitKey, target.occurrenceId] as const),
          );
          if (takeover) {
            const gameName = targetRooms[0]?.gameName;
            const requiredExits = resolveDeclaredPhysicalExits(
              catalog,
              layout,
              plan.topology,
              decision.source,
            );
            const requiredExitKeys =
              requiredExits === undefined
                ? undefined
                : Object.freeze(requiredExits.map((exit) => exit.exitKey));
            if (gameName !== undefined && requiredExitKeys !== undefined) {
              takeoverBatches.set(
                semanticAddressKey(owner),
                createTakeoverRepairInteraction({
                  existingTargetOccurrenceIds,
                  gameName,
                  owner,
                  requiredExitKeys,
                }),
              );
            }
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
            if (
              layout.progression.kind === 'generated' &&
              fixedWidthOneTakeover === undefined &&
              takeoverGameNames.length > 0
            ) {
              const impact = takeoverReplacementImpact(biome, plan, decision);
              takeoverBatches.set(
                semanticAddressKey(owner),
                createCandidateTakeoverInteraction({
                  action: 'replace' as const,
                  existingTargetOccurrenceIds,
                  gameNames: takeoverGameNames,
                  ...(impact === undefined ? {} : { impact }),
                  owner,
                }),
              );
            }
          }
        } else if (layout.progression.kind === 'generated' && fixedWidthOneTakeover === undefined) {
          const candidatesForTakeover = catalog.rooms.values
            .filter((room) => room.biomeKey === plan.biomeKey && isTakeover(room))
            .map((room) => room.gameName);
          if (candidatesForTakeover.length > 0) {
            takeoverBatches.set(
              semanticAddressKey(owner),
              createCandidateTakeoverInteraction({
                action: 'create' as const,
                gameNames: candidatesForTakeover,
                owner,
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
            // A persisted Shop inventory is not a live editor until its room
            // lifecycle has entered it. The room-local projection publishes
            // an offer control precisely at that boundary, so re-use that
            // authority rather than inspecting selection topology here.
            const offerAddress = createShopOfferAddress(biome, occurrence.occurrenceId, offerKey);
            if (!rewardControls.has(semanticAddressKey(offerAddress))) continue;
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
            const entryOrder = ephyraSideRoomEntryOrderControl(address, entered, slot.slotKey);
            const proposals = Object.freeze(
              entryOrder.options.map((option) => option.proposedEnteredSlotKeys),
            );
            const selected = entryOrder.options.find(
              (option) => option.key === entryOrder.selectedKey,
            );
            if (selected === undefined) {
              throw new StructuredWorkspaceProjectionContractError(
                `${semanticAddressKey(address)} has no selected side-room entry position`,
              );
            }
            sideRoomEntryOrders.set(
              entryOrder.interactionKey,
              candidateInteraction(
                groupAddress,
                Object.freeze(
                  entryOrder.options.map((option) =>
                    Object.freeze({ label: option.label, value: option.proposedEnteredSlotKeys }),
                  ),
                ),
                selected.proposedEnteredSlotKeys,
                () => candidates.sideRoomEntryOrders(groupAddress, proposals),
                entryOrder.interactionKey,
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
          const fixedWidthOneTakeoverAtFrontier = fixedWidthOneTakeoverTransitionForSource(
            catalog,
            layout,
            plan.topology,
            frontier.source,
          );
          if (fixedWidthOneTakeoverAtFrontier !== undefined && existing === undefined) {
            const requiredExits = resolveDeclaredPhysicalExits(
              catalog,
              layout,
              plan.topology,
              frontier.source,
            );
            const requiredExitKeys =
              requiredExits === undefined
                ? undefined
                : Object.freeze(requiredExits.map((exit) => exit.exitKey));
            if (requiredExitKeys !== undefined) {
              takeoverBatches.set(
                semanticAddressKey(frontier),
                fixedWidthOneTakeoverAtFrontier.kind === 'completedHubHandoff'
                  ? createCompletedHubHandoffInteraction({
                      gameName: fixedWidthOneTakeoverAtFrontier.room.gameName,
                      owner: frontier,
                      requiredExitKeys,
                    })
                  : createFixedWidthOneTakeoverInteraction({
                      gameName: fixedWidthOneTakeoverAtFrontier.room.gameName,
                      owner: frontier,
                      requiredExitKeys,
                    }),
              );
            }
          } else if (
            layout.progression.kind === 'generated' &&
            fixedWidthOneTakeover === undefined &&
            gameNames.length > 0 &&
            !takeoverBatches.has(semanticAddressKey(frontier))
          ) {
            const existingTargetOccurrenceIds =
              existing?.normal.kind === 'batch'
                ? new Map(
                    existing.normal.targets.map(
                      (target) => [target.exitKey, target.occurrenceId] as const,
                    ),
                  )
                : undefined;
            takeoverBatches.set(
              semanticAddressKey(frontier),
              createCandidateTakeoverInteraction({
                action:
                  existing?.normal.kind === 'batch' ? ('replace' as const) : ('create' as const),
                ...(existingTargetOccurrenceIds === undefined
                  ? {}
                  : { existingTargetOccurrenceIds }),
                gameNames,
                owner: frontier,
              }),
            );
          }
          if (
            existing === undefined &&
            frontier.source.kind === 'occurrence' &&
            fixedWidthOneTakeoverAtFrontier === undefined
          ) {
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
    topologyRemovals,
  });
}

function railMarkerForNode(node: WorkspaceNode): WorkspaceMarker {
  return node.kind === 'occurrenceWorkbench' ? (node.railMarker ?? node.marker) : node.marker;
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
  // Structural completeness is authoritative even when simulation coverage is
  // blocked upstream.  In particular, a Hub's next visit must remain a
  // projectable frontier after its board has been authored.
  const frontier = authoringFrontier(context, plan);
  const nextHubVisitIndex = frontier?.kind === 'hubVisit' ? frontier.owner.visitIndex : undefined;
  const fields = projectBiomeFields(context, plan, layout);
  if (plan.topology !== null && layout.start.kind === 'authoredChoice') {
    const start = authoredOccurrence(plan, plan.topology.startOccurrenceId);
    if (start !== undefined) {
      startRoomControl(
        context,
        createOccurrenceAddress(context.biome, start.occurrenceId),
        layout.start.roomGameNames,
        start.gameName,
      );
    }
  }
  indexOrdinaryTargetControls(context, plan);
  const nodes: WorkspaceNode[] = [];
  let entry: WorkspaceOccurrenceWorkbenchNode | undefined;
  if (plan.topology !== null) {
    const start = authoredOccurrence(plan, plan.topology.startOccurrenceId);
    if (start !== undefined) {
      entry = projectOccurrence(
        context,
        start,
        snapshot?.entryRoom?.entered ?? false,
        snapshot?.entryRoom,
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
        const projected = projectHub(
          context,
          plan,
          decision,
          layout.progression,
          nextHubVisitIndex,
        );
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
      const projected = projectAuthoredHub(
        context,
        plan,
        authoredHub,
        hubDescriptor,
        nextHubVisitIndex,
      );
      nodes.push(projected.node, ...projected.workbenches);
    }
    if (!alreadyProjected && authoredHub === undefined) {
      const projected = projectHubOutline(context, plan, hubDescriptor);
      nodes.push(projected.node, ...projected.workbenches);
    }
  } else if (layout.progression.kind === 'hub') {
    // The board itself is always visible, including before N's fixed start
    // has been authored.  Its controls stay disabled until the Hub decision
    // exists, but React still has a complete declaration-owned outline.
    const projected = projectHubOutline(context, plan, layout.progression);
    nodes.push(projected.node, ...projected.workbenches);
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
  const structuralNodes = Object.freeze([...nodes]);
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
  const renderedOccurrenceIds = new Set(
    structuralNodes
      .filter(
        (node): node is WorkspaceOccurrenceWorkbenchNode => node.kind === 'occurrenceWorkbench',
      )
      .map((node) => node.room.occurrenceId),
  );
  const railNodes = structuralNodes
    .filter(
      (node) => node.kind !== 'occurrenceWorkbench' || node.railVisibility !== 'inspectorOnly',
    )
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
  const railEntryForNode = (node: WorkspaceNode): WorkspaceRailEntry =>
    node.kind === 'hubDecision'
      ? projectHubRailEntry(node, structuralNodes)
      : Object.freeze({
          kind: 'node' as const,
          key: node.key,
          marker: railMarkerForNode(node),
          node,
        });
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
    ...(layout.progression.kind === 'hub'
      ? []
      : completion.map((node) =>
          Object.freeze({
            kind: 'node' as const,
            key: node.key,
            marker: node.marker,
            node,
          }),
        )),
  ]);
  const biomeMarker = marker(context, biomeAddress, `biome:${routeKey}:${plan.biomeKey}`);
  const projected = Object.freeze({
    biomeKey: plan.biomeKey,
    completion: Object.freeze(completion),
    completionOutline:
      layout.progression.kind === 'hub' ? Object.freeze(completion) : Object.freeze([]),
    ...(entry === undefined ? {} : { entry }),
    fields,
    frontier,
    label: catalog.biomes.byKey[plan.biomeKey]?.label ?? plan.biomeKey,
    marker: biomeMarker,
    nodes: Object.freeze(nodes),
    rail,
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
