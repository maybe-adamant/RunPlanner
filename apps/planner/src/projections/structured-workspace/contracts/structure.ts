import type { WorkspaceAspectHexTreeControl } from './traits';
import type { WorkspaceChaosExitControl, WorkspaceZagreusContractControl } from './features';
import type { WorkspaceLocalVisitDecision } from './locals';
import type { WorkspaceRewardControl, WorkspaceRewardOfferResolver } from './rewards';
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
  OccurrenceAddress,
  PhantomExitAddress,
  ProjectCommand,
  RerolledRewardOwner,
  RerollTarget,
  RoomActionAddress,
  SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { CanonicalBatch, ProjectEvaluationAssembly } from '@run-planner/engine/simulation';
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
  /** Goals remaining shown on a Clockwork Goal door's countdown. */
  readonly clockworkGoalsRemaining?: number;
  /** The reward the door offers after its rerolls, where it differs from the first draw. */
  readonly rerolledOffer?: ResolvedRewardOffer;
  readonly rerolledSummary?: string;
  /**
   * A kept rerolled reward that no longer matches: adopt the last reroll's
   * reward, or drop it where no reroll remains.
   */
  readonly rerolledRewardRepair?: {
    readonly owner: RerolledRewardOwner;
    readonly repair: 'adopt' | 'drop';
  };
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

/**
 * `effect` says whether the repair removes unavailable doors or adds missing
 * ones. `markOwner` is present when the repair carries the batch's finding mark.
 */
export type WorkspaceBatchRepairIntent = WorkspaceCommandIntent<
  Extract<ProjectCommand, { readonly kind: 'ReconcileBatchExitCapacity' }>
> & {
  readonly effect: 'removeUnavailable' | 'addMissing';
  readonly markOwner?: ExitDecisionAddress;
};

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
 * A batch store already decided by its ShipCombat source's last active reward
 * wheel. Read-only: the wheel owns the choice, so the value links to it.
 */
export interface WorkspaceInheritedRewardStore {
  readonly label: string;
  readonly storeKey: string;
  /** Navigation to the owning wheel; the ship occurrence owns this marker. */
  readonly wheel: WorkspaceMarker;
}

/** The pool row of a batch that has a pool. */
export interface WorkspaceBatchRewardPool {
  /** What the selected exit counts, only where it differs from the carried pool. */
  readonly effective?: string;
  /** Present where the source's wheel decided the pool instead of the batch picker. */
  readonly inherited?: WorkspaceInheritedRewardStore;
}

interface WorkspaceBatchNodeBase {
  readonly batchState: CanonicalBatch['batchState'] | AuthoredBatchState;
  readonly fields?: WorkspaceFieldsBatchContext;
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
  /** Present wherever the batch carries a pool: an editable picker or a ship-decided value. */
  readonly rewardPool?: WorkspaceBatchRewardPool;
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
  /** The source room's ordered door and cage rerolls, where it can or did reroll. */
  readonly rerolls?: WorkspaceRoomRerolls;
}

/** One door or Fields cage a press may name. */
export interface WorkspaceRerollTarget {
  readonly key: string;
  readonly target: RerollTarget;
  readonly label: string;
  /** Why the game refuses a press of it; absent when it can be rerolled or is unreached. */
  readonly unavailable?: 'notRerollable' | 'slotEntered';
}

/** One authored press in the room's action order. */
export interface WorkspaceRerollRow {
  readonly address: RoomActionAddress;
  readonly key: string;
  readonly marker: WorkspaceMarker;
  readonly targetLabel: string;
  readonly reward: ResolvedRewardOffer;
}

/** A room's door and cage rerolls in action order, with a press appended at the end. */
export interface WorkspaceRoomRerolls {
  readonly owner: OccurrenceAddress;
  readonly interactionKey: string;
  /** The run's pool at the append point; absent while unreached. */
  readonly poolRemaining?: number;
  readonly rows: readonly WorkspaceRerollRow[];
  /** Why a press cannot be appended: unreached, no held card, or no pool left. */
  readonly appendLocked?: 'unreached' | 'notEnabled' | 'poolEmpty';
}

/** Engine-backed pickers and edits of one room's rerolls. */
export interface WorkspaceRoomRerollsInteraction {
  readonly key: string;
  readonly owner: OccurrenceAddress;
  /** The targets a new press may name, by key; a refused one is listed with its reason. */
  readonly targets: (selectedKey: string | undefined) => ContextualPickerModel<string>;
  /** The reward picker of one authored press. */
  readonly rowReward: (rowKey: string) => WorkspaceRewardOfferResolver;
  /** The reward picker of a press not yet authored, on one target. */
  readonly pendingReward: (targetKey: string) => WorkspaceRewardOfferResolver;
  readonly replaceRewardIntent: (
    rowKey: string,
    reward: ResolvedRewardOffer,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceRerollReward' }>>;
  readonly removeIntent: (
    rowKey: string,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'RemoveRoomAction' }>>;
  readonly appendIntent: (
    targetKey: string,
    reward: ResolvedRewardOffer,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'InsertReroll' }>>;
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
  /** The Phial outcome owner; its target control is present whenever the fountain is used. */
  readonly outcomeMarker: WorkspaceMarker;
  readonly rarity?: WorkspaceFountainRarityControl;
  readonly controlsHost?: {
    readonly kind: 'room';
    readonly label: string;
    readonly occurrenceId: OccurrenceId;
  };
}

/** What each Hub tab still requires, from the authored board and its declaration. */
export interface WorkspaceHubRequirements {
  readonly openRooms: {
    readonly current: number;
    readonly min: number;
    readonly max: number;
    readonly met: boolean;
  };
  readonly visits: {
    readonly planned: number;
    readonly required: number;
    readonly met: boolean;
    readonly fountainUsed: boolean;
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
  readonly requirements: WorkspaceHubRequirements;
  /** The completed-Hub exit and the Preboss it always owns. */
  readonly completedExit: {
    readonly marker: WorkspaceMarker;
    readonly target: { readonly label: string; readonly marker: WorkspaceMarker };
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
  /** The Preboss of a Hub's completed exit, shown as its own stage. */
  readonly completedHubExitStage?: true;
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

/**
 * The hidden door back to the Hub that a room fills when its doors first
 * unlock: a placeholder room and the reward drawn for it. Each field shows its
 * effective value, pinned or settled by the simulation; `locked` names why it
 * cannot be chosen now.
 */
export interface WorkspacePhantomExitControl {
  readonly address: PhantomExitAddress;
  readonly interactionKey: string;
  readonly marker: WorkspaceMarker;
  /** Whether either field is authored rather than left to the simulation. */
  readonly pinned: boolean;
  /** The settled room and reward, once the room's doors unlock is reached. */
  readonly summary?: string;
  readonly room: {
    readonly summary: string;
    readonly locked?: 'unreached';
  };
  readonly reward: {
    readonly summary: string;
    /** `autoRoom`: the room is unpinned; `noDraw`: the room draws no reward. */
    readonly locked?: 'unreached' | 'autoRoom' | 'noDraw';
  };
}

/** Engine-backed pickers for one hidden door; reset returns both fields to the simulation. */
export interface WorkspacePhantomExitInteraction {
  readonly key: string;
  readonly owner: PhantomExitAddress;
  readonly rooms: { readonly load: () => ContextualPickerModel<string> };
  readonly rewards: { readonly load: () => Promise<ContextualPickerModel<string>> };
  readonly roomIntent: (
    placeholderRoomGameName: string,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplacePhantomExit' }>>;
  readonly rewardIntent: (
    rewardType: string,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplacePhantomExit' }>>;
  readonly resetIntent: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplacePhantomExit' }>
  >;
}

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
      readonly destination:
        | { readonly kind: 'room'; readonly label: string; readonly gameName?: string }
        | { readonly kind: 'biome'; readonly label: string }
        | { readonly kind: 'complete'; readonly message: string };
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
/** What a rail room line's leading icon depicts, from the room's catalog declaration. */
export type WorkspaceRailRoomIcon =
  | {
      readonly kind: 'combat' | 'empty' | 'fountain' | 'boss';
      readonly biomeKey: string;
    }
  | { readonly kind: 'shop' | 'chaos' | 'contract' }
  | { readonly kind: 'miniboss'; readonly encounterDefinitionKey?: string }
  | { readonly kind: 'story'; readonly npcKey?: string };

export interface WorkspaceRailSelectedTarget {
  readonly roomIcon: WorkspaceRailRoomIcon;
  /** The additional exit taken, such as a Chaos gate; absent for a physical door. */
  readonly exitTypeKey?: string;
  /** Goals remaining shown on the selected Clockwork Goal door. */
  readonly clockworkGoalsRemaining?: number;
  readonly reward?: WorkspaceRailReward;
  /** Every resolved reward the selected room offers, in offer order, shown on its door or not. */
  readonly roomRewards: readonly ResolvedRewardOffer[];
  readonly roomLabel: string;
  /** The selected room is a shop, such as a Preboss shop entered instead of its reward door. */
  readonly shop?: true;
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
  /** A Preboss takeover exposes the door it continues through; a shop stage, its shop. */
  readonly selectedTarget?: WorkspaceRailSelectedTarget;
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

export type WorkspaceRunModifierDraftResult =
  | { readonly kind: 'valid'; readonly intent: WorkspaceCommandIntent }
  | { readonly kind: 'invalid'; readonly message: string };

export interface WorkspaceStartPointOption {
  readonly biomeKey: string;
  readonly point: import('@run-planner/engine/authored-project').RunStartPoint['point'];
  readonly label: string;
  readonly selected: boolean;
  readonly available: boolean;
  /** Hover reason for an unavailable start point whose cause is not evident from the plan. */
  readonly unavailableHint?: string;
}

export interface WorkspaceStartPointRow {
  readonly biomeKey: string;
  readonly label: string;
  readonly options: readonly WorkspaceStartPointOption[];
}

export interface WorkspaceStartPointControl {
  readonly label: string;
  readonly value: import('@run-planner/engine/authored-project').RunStartPoint | undefined;
  /** The authored start point; empty when none is set. */
  readonly valueLabel: string;
  /** The authored start point cannot start the run; the publish block states why. */
  readonly unavailable?: true;
  /** The route's start-point domain, evaluated when the picker opens. */
  readonly loadDomain: () => readonly WorkspaceStartPointRow[];
  /** Complete replacement choosing a start point (keeping its gold) or none. */
  readonly selectIntent: (
    next:
      | Pick<import('@run-planner/engine/authored-project').RunStartPoint, 'biomeKey' | 'point'>
      | undefined,
  ) => WorkspaceCommandIntent;
  /** Complete replacement of the start point's added base gold; empty adds none. */
  readonly goldDraftIntent: (draft: string) => WorkspaceRunModifierDraftResult;
}

export interface WorkspaceRunModifiersControl {
  /** The route's Practice mode start point. */
  readonly startPoint: WorkspaceStartPointControl;
  /** Why the authored start point blocks publication; only where it is authored. */
  readonly startPointBlock?: import('@run-planner/engine/execution-plan').StartPointPublicationBlock;
  readonly value: import('@run-planner/engine/authored-project').RunModifiers;
  /** Declarations authored in this build, in declaration order. */
  readonly declarations: readonly import('@run-planner/engine/authored-project').RunModifierDeclaration[];
  /** Complete replacement for a boolean modifier. */
  readonly setValue: (
    declaration: import('@run-planner/engine/authored-project').BooleanRunModifierDeclaration,
    value: boolean,
  ) => WorkspaceCommandIntent;
  /** Complete replacement turning an optional modifier off. */
  readonly clearValue: (
    declaration: import('@run-planner/engine/authored-project').OptionalPercentageRunModifierDeclaration,
  ) => WorkspaceCommandIntent;
  /** Complete replacement enabling an optional modifier once its draft text is within the percentage domain. */
  readonly draftIntent: (
    declaration: import('@run-planner/engine/authored-project').OptionalPercentageRunModifierDeclaration,
    draft: string,
  ) => WorkspaceRunModifierDraftResult;
}

export interface WorkspaceRoute {
  readonly runModifiers: WorkspaceRunModifiersControl;
  /**
   * The route-owned offer; any acquisition payload remains on the first entry Timeline.
   * Absent when the route's save profile starts without a reward.
   */
  readonly startingReward?: WorkspaceRewardControl;
  readonly startingArcana: readonly { readonly key: string; readonly rarity: string }[];
  readonly aspectHexTree?: WorkspaceAspectHexTreeControl;
  /** Engine-assessed Arcana toggles and Vow ranks from the authored loadout. */
  readonly loadoutEditDomain: import('@run-planner/engine/authored-project').RouteLoadoutEditDomain;
  readonly biomes: readonly WorkspaceBiome[];
  readonly label: string;
  readonly marker: WorkspaceMarker;
  readonly rail: readonly WorkspaceRouteRailBiome[];
  /** Assessed route-owned selected successful resource outcomes. */
  readonly resources: readonly {
    readonly family: import('@run-planner/engine/catalog-schema').ResourceFamily;
    /** The element a success grants, from the placement room's rule or any declaring room. */
    readonly element?: 'Fire' | 'Air' | 'Earth' | 'Water';
    readonly placement?: {
      readonly biomeKey: string;
      readonly locationLabel: string;
      readonly occurrenceId: OccurrenceId;
    };
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
  /** Marks inside an open trait dialog: each finding on its own owner's control. */
  readonly traitDialogFindings: (
    trait: import('@run-planner/engine/authored-project').TraitOfferAddress,
  ) => ReadonlyMap<string, readonly import('@run-planner/engine/simulation').SemanticFinding[]>;
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
      readonly contextReached: boolean;
      readonly key: string;
      readonly owner: HubSlotAddress;
      readonly selected: false;
    }
  | {
      readonly close?: WorkspaceHubSlotCloseInteraction;
      readonly contextReached: boolean;
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
  /** Read from retained products; appends and resets wait on an earlier choice when false. */
  readonly contextReached: boolean;
  readonly key: string;
  readonly owner: HubDecisionAddress;
  readonly proposalFor: (actions: readonly HubAction[]) => WorkspaceHubActionOrderProposal;
  readonly selectedActions: readonly HubAction[];
  readonly selectedHubSlotKeys: readonly string[];
}
