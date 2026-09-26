import type { WorkspaceAspectHexTreeControl } from './traits';
import type { WorkspaceChaosExitControl, WorkspaceZagreusContractControl } from './features';
import type { WorkspaceLocalVisitDecision } from './locals';
import type { WorkspaceRewardControl } from './rewards';
import type {
  AuthoredBatchState,
  BiomeAddress,
  BiomeFieldAddress,
  ExitDecisionAddress,
  ExitDecisionSourceAddress,
  HubAction,
  HubDecisionAddress,
  HubFountainAddress,
  HubOpenSetAddress,
  HubVisitAddress,
  HubSlotAddress,
  KeepsakeEquipResultAddress,
  OccurrenceId,
  ProjectCommand,
  SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { CanonicalBatch, ProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import type { TakeoverBatchCommand } from '@planner/workspace/takeoverBatchInteraction';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';

import type {
  WorkspaceCandidateInteraction,
  WorkspaceCommandIntent,
  WorkspacePickerCandidateInteraction,
  WorkspaceInteractionCatalog,
  WorkspaceInteractionChoice,
  WorkspaceProjectionSource,
  WorkspaceRoomSummary,
  WorkspaceStatus,
} from '../contract';
import type {
  WorkspaceDefaultInspectorDestination,
  WorkspaceInspectorDestination,
  WorkspaceMarker,
} from './navigation';
import type { WorkspaceRunStateLauncher } from './run-state';
import type { WorkspaceFountainRarityControl } from './timeline';

export interface WorkspaceAnomalyControl {
  readonly mapChoices: readonly WorkspaceInteractionChoice<string>[];
  readonly rememberedRoomLabel: string;
  readonly success: boolean;
}

export interface WorkspaceDoorReward {
  readonly control?: WorkspaceRewardControl;
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly offer: ResolvedRewardOffer | null;
  readonly summary: string;
}

/** One immutable predecessor-owned physical-door handoff product. */
export interface WorkspaceDoorContract {
  /** Complete room-owned offer surface; visibility is a lossy door/rail concern. */
  readonly offerRewardSurface: {
    readonly visibility: 'hidden' | 'visible';
    readonly rewards: readonly WorkspaceDoorReward[];
  };
  readonly room: WorkspaceRoomSummary;
}

export interface WorkspacePhysicalTarget {
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly door: WorkspaceDoorContract;
  readonly exitKey: string;
  readonly exitTypeLabel?: string;
  readonly index: number;
  readonly marker: WorkspaceMarker;
  readonly physicalState: 'available' | 'unavailable';
  readonly selected: boolean;
  readonly retained: boolean;
  readonly nextPath: 'continuesSpine' | 'deadLeaf';
  /** Occurrence workbench identity; door UI and decision rails consume `door`. */
  readonly room: WorkspaceRoomSummary;
  /** A declaration-owned target capability, not a React eligibility result. */
  readonly anomalyTakeover?: {
    readonly label: string;
  };
}

/** One selected door continuation, shared by rail and decision navigation. */
export interface WorkspaceSelectedContinuationNavigation {
  readonly door: WorkspaceDoorContract;
  readonly marker: WorkspaceMarker;
}

export type WorkspaceMissingTargetAuthoring =
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'awaitingPriorExit';
      readonly prerequisiteExitKey: string;
    }
  | { readonly kind: 'awaitingBatchRewardStore' }
  | { readonly kind: 'awaitingFieldsCageOutcome' };

export type WorkspaceBatchRepairIntent = WorkspaceCommandIntent<
  Extract<ProjectCommand, { readonly kind: 'ReconcileBatchExitCapacity' }>
>;

export interface WorkspaceMissingPhysicalTarget {
  readonly authoring: WorkspaceMissingTargetAuthoring;
  readonly exitKey: string;
  readonly exitTypeLabel?: string;
  readonly index: number;
  readonly marker: WorkspaceMarker;
}

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
 * What becomes of the pool this door carries — the one presentation for that
 * question. Usually a concrete store: the one a forced room substitutes for the
 * batch's own. Where the room takes the pool without naming a store, the label
 * says what it does with it instead and no `storeKey` accompanies it.
 */
export interface WorkspaceEffectiveRewardStore {
  readonly label: string;
  /** Present only when the outcome is a concrete store. */
  readonly storeKey?: string;
}

/**
 * A door whose store was already decided by its ShipCombat source's last
 * active reward wheel. Read-only: the wheel owns the choice, so this row
 * reports the resolved pool and links to the control that decides it.
 */
export interface WorkspaceInheritedRewardStore {
  /** Short presentation copy for why this door carries no pool selector. */
  readonly explanation: string;
  readonly label: string;
  readonly storeKey: string;
  /** Navigation to the owning wheel; the ship occurrence owns this marker. */
  readonly wheel: WorkspaceMarker;
}

interface WorkspaceBatchNodeBase {
  readonly batchState: CanonicalBatch['batchState'] | AuthoredBatchState;
  /** Present only when a forced room changes an evaluated authored base store. */
  readonly effectiveRewardStore?: WorkspaceEffectiveRewardStore;
  readonly fields?: WorkspaceFieldsBatchContext;
  /** Present only where the source's own wheel decided this batch's store. */
  readonly inheritedRewardStore?: WorkspaceInheritedRewardStore;
  /** An authored additional exit is a sibling of normal targets, never a target row. */
  readonly chaos?: WorkspaceChaosExitControl;
  readonly zagreusContract?: WorkspaceZagreusContractControl;
  readonly fieldsCageOutcome?: WorkspaceMarker;
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly missingTargets: readonly WorkspaceMissingPhysicalTarget[];
  readonly owner: ExitDecisionAddress;
  readonly persistence: 'authored' | 'uncommitted';
  readonly repairIntent?: WorkspaceBatchRepairIntent;
  readonly rewardStore?: WorkspaceMarker;
  /** Projection-supplied label for the one editable batch store control. */
  readonly rewardStoreLabel?: string;
  readonly selection: WorkspaceMarker;
  /** Present only when exactly one normal or additional occurrence is selected. */
  readonly selectedContinuation?: WorkspaceSelectedContinuationNavigation;
  readonly source: ExitDecisionSourceAddress;
  readonly targets: readonly WorkspacePhysicalTarget[];
  readonly topologyState: 'complete' | 'partial' | 'retained';
  readonly runState?: WorkspaceRunStateLauncher;
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
      readonly predecessorNodeKey?: string;
      readonly provisionalBatch?:
        WorkspaceOrdinaryBatchNode | WorkspaceTakeoverBatchNode | WorkspaceMixedBatchNode;
    }
  | {
      readonly kind: 'hubVisit';
      readonly interactionKey: string;
      readonly marker: WorkspaceMarker;
      readonly owner: HubVisitAddress;
    }
  | {
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

export interface WorkspaceMixedBatchNode extends WorkspaceBatchNodeBase {
  readonly kind: 'mixedBatch';
  readonly targetInteraction: 'replaceable';
}

export interface WorkspaceHubSlot {
  readonly canClose: boolean;
  readonly canOpen: boolean;
  /** Fixed declaration identity, retained even while the slot is closed. */
  readonly gameName: string;
  readonly hubSlotKey: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly open: boolean;
  readonly physicalDoorId: number;
  /** Exact immutable main-door handoff owned by the Hub slot. */
  readonly door?: WorkspaceDoorContract;
  readonly room?: WorkspaceRoomSummary;
  readonly roomKind: RoomDeclaration['kind'];
  readonly visited: boolean;
}

export type WorkspaceHubVisitState = 'authored' | 'next' | 'locked';

export interface WorkspaceHubVisit {
  readonly authoring: WorkspaceHubVisitState;
  readonly marker: WorkspaceMarker;
  /** The authored visit carries its slot-owned door without reconstructing reward identity. */
  readonly door?: WorkspaceDoorContract;
  readonly room?: WorkspaceRoomSummary;
  readonly hubSlotKey?: string;
  readonly visitIndex: number;
  /** One-based position in the combined Hub action order, including the fountain use. */
  readonly actionPosition?: number;
}

/**
 * The Hub-owned fountain use. Ordering stays in Hub Timeline; its Phial target
 * displays after the preceding room, including the Hub source for an entry use.
 */
export interface WorkspaceHubFountain {
  readonly address: HubFountainAddress;
  readonly hub: HubDecisionAddress;
  readonly marker: WorkspaceMarker;
  /** One-based position in the combined Hub action order, absent while unused. */
  readonly actionPosition?: number;
  /** The complete appended order, offered only while the fountain is unused. */
  readonly appendActions?: readonly HubAction[];
  /** The Phial outcome owner; its target control is present only while one is required. */
  readonly outcomeMarker: WorkspaceMarker;
  readonly rarity?: WorkspaceFountainRarityControl;
  readonly controlsHost?: {
    readonly kind: 'room';
    readonly label: string;
    readonly occurrenceId: OccurrenceId;
  };
}

export interface WorkspaceHubDecisionNode {
  readonly authoring: 'authored';
  readonly kind: 'hubDecision';
  readonly key: string;
  readonly hubKey: string;
  /** The static Hub terminal declaration used by the optional board reference. */
  readonly gameName: string;
  readonly marker: WorkspaceMarker;
  readonly openSet: WorkspaceMarker;
  readonly openSlotCount: { readonly current: number; readonly min: number; readonly max: number };
  readonly owner: HubDecisionAddress;
  readonly requiredVisitCount: number;
  /** The declaration-owned fixed exit and its exact authored readiness state. */
  readonly completedExit:
    | {
        readonly kind: 'locked';
        readonly marker: WorkspaceMarker;
        readonly targetLabel: string;
      }
    | {
        readonly kind: 'ready';
        readonly marker: WorkspaceMarker;
        readonly targetLabel: string;
      }
    | {
        readonly kind: 'opened';
        readonly marker: WorkspaceMarker;
        readonly target: { readonly label: string; readonly marker: WorkspaceMarker };
        readonly targetLabel: string;
      };
  readonly slots: readonly WorkspaceHubSlot[];
  readonly visits: readonly WorkspaceHubVisit[];
  readonly fountain: WorkspaceHubFountain;
  readonly runState?: WorkspaceRunStateLauncher;
}

export interface WorkspaceOccurrenceWorkbenchNode {
  readonly kind: 'occurrenceWorkbench';
  /** True only for the biome's authored Opening/Intro occurrence. */
  readonly isEntry?: boolean;
  readonly key: string;
  readonly localDetailMarkers: readonly WorkspaceMarker[];
  /** Parent-owned local topology; local payloads remain ordinary occurrence workbenches. */
  readonly localVisit?: WorkspaceLocalVisitDecision;
  readonly marker: WorkspaceMarker;
  /** A completed-Hub outer decision rendered through its visible Preboss room. */
  readonly runState?: WorkspaceRunStateLauncher;
  readonly inspectorPresentation: 'doorTarget' | 'full' | 'hubRoomLocal';
  /** Predecessor-owned door context. The occurrence may only render this read-only. */
  readonly incomingDoor?: WorkspaceDoorContract;
  readonly sourceDecisionRemoval?: WorkspaceStageDecisionRemoval;
  readonly railMarker?: WorkspaceMarker;
  readonly railVisibility?: 'inspectorOnly';
  readonly room: WorkspaceRoomSummary;
  /** Hub fountain controls presented before this room's chronology. */
  readonly hubFountain?: WorkspaceHubFountain;
  /** Stable Hub Timeline destination for visited rooms and the fountain's room host. */
  readonly hubTimeline?: WorkspaceMarker;
}

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
  | WorkspaceOrdinaryBatchNode
  | WorkspaceTakeoverBatchNode
  | WorkspaceMixedBatchNode
  | WorkspaceHubDecisionNode
  | WorkspaceOccurrenceWorkbenchNode;

export type WorkspaceOccurrenceStageOutgoing =
  | {
      readonly kind: 'authoredDecision';
      readonly decisionNodeKey: string;
    }
  | {
      readonly kind: 'frontier';
      readonly frontier: Extract<WorkspaceAuthoringFrontier, { readonly kind: 'exitDecision' }>;
    }
  | {
      readonly kind: 'blockedOrUnentered';
      readonly marker: WorkspaceMarker;
      readonly message: string;
    }
  | {
      readonly kind: 'topologyOwned';
      readonly label: string;
      readonly marker: WorkspaceMarker;
    }
  | {
      readonly kind: 'terminal';
      readonly label: string;
      readonly marker: WorkspaceMarker;
    }
  | {
      /** Engine-declared fixed completion continuation, rendered as a fixed exit. */
      readonly kind: 'fixedRoom';
      readonly label: string;
      readonly marker: WorkspaceMarker;
    };

/** Projection-owned occurrence/decision composition consumed by React as a keyed stage. */
export interface WorkspaceOccurrenceStage {
  readonly outgoing: WorkspaceOccurrenceStageOutgoing;
  readonly sourceOccurrenceNodeKey: string;
}

export interface WorkspaceHubVisitRailEntry {
  readonly key: string;
  readonly label: string;
  /** The visited room's one primary reward, never an aggregate of local detail rewards. */
  readonly mainReward?: WorkspaceRailReward;
  readonly marker: WorkspaceMarker;
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  /** Entered local occurrences owned by this main Hub visit. */
  readonly sideVisits: readonly WorkspaceHubSideVisitRailEntry[];
  readonly visitMarker: WorkspaceMarker;
  readonly visitIndex: number;
}

export interface WorkspaceHubSideVisitRailEntry {
  readonly key: string;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  /** Parent-local slot marker retained for assessment and finding display. */
  readonly visitMarker: WorkspaceMarker;
}

export interface WorkspaceHubRailEntry {
  readonly kind: 'hubGroup';
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly node: WorkspaceHubDecisionNode;
  readonly visits: readonly WorkspaceHubVisitRailEntry[];
}

/**
 * One resolved primary room reward retained as a presentation-ready token.
 * The current rail renders `label`; a later compact token can render `offer`
 * without changing workspace policy. It never represents an aggregate of
 * room-local rewards.
 */
export interface WorkspaceRailReward {
  readonly label: string;
  readonly offer: ResolvedRewardOffer;
}

/**
 * Progressive authored context for one numbered decision. A selected room is
 * useful independently of whether its reward surface can be represented as
 * one unambiguous compact reward.
 */
export interface WorkspaceRailSelectedTarget {
  readonly reward?: WorkspaceRailReward;
  readonly roomLabel: string;
}

export interface WorkspaceDecisionRailEntry {
  readonly kind: 'node';
  /**
   * A selected decision continues into its target occurrence stage. The rail
   * keeps the decision marker for assessment while navigation uses this exact
   * occurrence marker.
   */
  readonly focusMarker: WorkspaceMarker;
  readonly key: string;
  readonly label: string;
  /** Only direct room stages and Hub visits expose primary-reward context. */
  readonly mainReward?: never;
  readonly marker: WorkspaceMarker;
  readonly node: WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode;
  readonly selectedTarget?: WorkspaceRailSelectedTarget;
}

export interface WorkspaceStageRailEntry {
  readonly kind: 'node';
  /** Exact occurrence or stage owner opened by this presentation stop. */
  readonly focusMarker: WorkspaceMarker;
  readonly key: string;
  readonly label: string;
  /** Optional primary reward context for a directly rendered room stage. */
  readonly mainReward?: WorkspaceRailReward;
  readonly marker: WorkspaceMarker;
  readonly node: Exclude<WorkspaceNode, WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode>;
  /** Only numbered decision rail entries may expose selected-target context. */
  readonly selectedTarget?: never;
}

export type WorkspaceRailEntry =
  | WorkspaceDecisionRailEntry
  | WorkspaceStageRailEntry
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

export interface WorkspaceBiome {
  readonly biomeKey: string;
  /** Fixed-linked Boss/Postboss occurrence workbenches in outline order. */
  readonly completionOutline: readonly WorkspaceOccurrenceWorkbenchNode[];
  /** Explicitly null only when this workspace has no renderable subject. */
  readonly defaultInspectorDestination: WorkspaceDefaultInspectorDestination | null;
  readonly entry?: WorkspaceOccurrenceWorkbenchNode;
  readonly echoKeepsakeReplay?: {
    readonly address: KeepsakeEquipResultAddress & {
      readonly resultKind: 'experimentalHammer' | 'transcendentEmbryo';
    };
    readonly marker: WorkspaceMarker;
  };
  readonly fields: readonly WorkspaceBiomeField[];
  readonly frontier: WorkspaceAuthoringFrontier | null;
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly nodes: readonly WorkspaceNode[];
  readonly occurrenceStages: readonly WorkspaceOccurrenceStage[];
  readonly owner: BiomeAddress;
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
  /** The route-owned offer; any acquisition payload remains on the first entry Timeline. */
  readonly startingReward: WorkspaceRewardControl;
  readonly startingArcana: readonly { readonly key: string; readonly rarity: string }[];
  readonly aspectHexTree?: WorkspaceAspectHexTreeControl;
  readonly biomes: readonly WorkspaceBiome[];
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly rail: readonly WorkspaceRouteRailBiome[];
  /** Assessed route-owned selected successful resource outcomes. */
  readonly resources: readonly {
    readonly family: import('@run-planner/engine/catalog-schema').ResourceFamily;
    readonly placement?: {
      readonly biomeKey: string;
      readonly locationLabel: string;
      readonly occurrenceId: OccurrenceId;
    };
    readonly reasons: readonly string[];
    readonly valid: boolean;
  }[];
  readonly routeKey: string;
  readonly status: WorkspaceStatus;
}

export interface StructuredWorkspaceProjection {
  /** Exact engine-owned readiness query for every semantic control root. */
  readonly authoringReadiness: (
    owner: SemanticAddress,
  ) => import('@run-planner/engine/simulation').AuthoringReadiness;
  readonly findingsByRepairTarget: ReadonlyMap<
    string,
    readonly import('@run-planner/engine/simulation').SemanticFinding[]
  >;
  readonly focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly marker: WorkspaceMarker;
  readonly runStateLaunchers: ReadonlyMap<string, WorkspaceRunStateLauncher>;
  readonly route: WorkspaceRoute;
  readonly status: WorkspaceStatus;
}

export interface StructuredWorkspaceProjectionService {
  project(assembly: ProjectEvaluationAssembly): StructuredWorkspaceProjection;
}

export interface WorkspaceBatchRewardStoreInteraction extends WorkspacePickerCandidateInteraction<string> {
  readonly intentFor: (storeKey: string) => WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      {
        readonly kind:
          'ReplaceBatchRewardStore' | 'ReplaceBossDoorRewardStore' | 'InitializeExitDecision';
      }
    >
  >;
}

type WorkspaceCreateStartIntent = WorkspaceCommandIntent<
  Extract<ProjectCommand, { readonly kind: 'CreateStart' }>
>;

/** Generic topology creation; the resulting occurrence owns all room authoring. */
export interface WorkspaceStartInteraction {
  readonly picker: ContextualPickerModel<string>;
  readonly intent: (gameName: string) => WorkspaceCreateStartIntent;
  readonly key: string;
  readonly owner: BiomeAddress;
}

export interface WorkspaceTopologyRemovalInteraction {
  readonly intent: WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'ClearTopology' | 'RemoveExitDecision' | 'RemoveHubDecision' }
    >
  >;
  readonly key: string;
  readonly owner: BiomeAddress | ExitDecisionAddress | HubDecisionAddress;
}

/** A visible stage can carry removal for its hidden source decision. */
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

/** Clears Hub-owned contents while retaining the decision and its source. */
export interface WorkspaceHubBoardResetInteraction {
  readonly intent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ResetHubBoard' }>
  >;
  readonly key: string;
  readonly owner: HubDecisionAddress;
}

/** One explicitly activated opening attempt owns its provisional occurrence identity. */
export interface WorkspaceHubSlotOpeningAttempt extends WorkspaceCandidateInteraction<boolean> {
  readonly intentFor: (
    open: true,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'OpenHubSlot' }>>;
}

export interface WorkspaceHubSlotCloseInteraction extends WorkspaceCandidateInteraction<boolean> {
  readonly intentFor: (
    open: false,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'CloseHubSlot' }>>;
}

export type WorkspaceHubSlotInteraction =
  | {
      readonly beginOpeningAttempt: () => WorkspaceHubSlotOpeningAttempt;
      readonly key: string;
      readonly owner: HubSlotAddress;
      readonly selected: false;
    }
  | {
      readonly close?: WorkspaceHubSlotCloseInteraction;
      readonly key: string;
      readonly owner: HubSlotAddress;
      readonly selected: true;
    };

/** One lazily-evaluated complete Hub action-order proposal. */
export interface WorkspaceHubActionOrderProposal extends WorkspaceCandidateInteraction<
  readonly HubAction[]
> {
  readonly intent: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceHubActionOrder' }>
  >;
}

/**
 * The Hub decision owns one aggregate action-order interaction. Room cards may
 * request a complete proposed prefix, but individual rendered positions never
 * become command owners. Room visits are a derived view of the same order.
 */
export interface WorkspaceHubActionOrderInteraction {
  readonly key: string;
  readonly owner: HubDecisionAddress;
  readonly proposalFor: (actions: readonly HubAction[]) => WorkspaceHubActionOrderProposal;
  readonly selectedActions: readonly HubAction[];
  readonly selectedHubSlotKeys: readonly string[];
}

interface WorkspaceTakeoverBatchInteractionBase {
  readonly key: string;
  readonly owner: ExitDecisionAddress;
}

export interface WorkspaceCompletedHubHandoffInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'create';
  readonly intent: () => WorkspaceTakeoverCommandIntent;
  readonly label: string;
  readonly presentation: 'completedHubHandoff';
}

export interface WorkspaceTakeoverRepairInteraction extends WorkspaceTakeoverBatchInteractionBase {
  readonly action: 'reconcile';
  readonly intent: () => WorkspaceTakeoverCommandIntent;
  readonly label: string;
  readonly presentation: 'repair';
}

export type WorkspaceTakeoverBatchInteraction =
  WorkspaceCompletedHubHandoffInteraction | WorkspaceTakeoverRepairInteraction;

type WorkspaceTakeoverCommandIntent = WorkspaceCommandIntent<TakeoverBatchCommand>;
