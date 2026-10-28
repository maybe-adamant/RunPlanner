import {
  createBatchRewardStoreAddress,
  createAdditionalExitAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createTargetAddress,
  sourceOfferPointStoreResolution,
  ordinaryTargetGameNames,
  takeoverPrebossGameNames,
  normalDecisionProgressionForLayout,
  hubTerminalTakeoverForSource,
  takeoverBatchExitRepairAvailable,
  selectedExitTarget,
  semanticAddressKey,
  type DeclaredPhysicalExit,
  type ExitDecision,
  type ExitDecisionAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomExit } from '@run-planner/engine/catalog-schema';
import type {
  CanonicalAdditionalContinuation,
  CanonicalBatch,
  CanonicalTarget,
  FieldsBatchFacts,
} from '@run-planner/engine/simulation';
import {
  authoredBatchEnteredRewardStores,
  canonicalBatchEnteredRewardStores,
  clockworkDoorGoalsRemaining,
  fieldsBatchFacts,
  fieldsBatchOwnsCageOutcome,
  targetContinuation,
} from '@run-planner/engine/simulation';

import { requireWorkspaceRoom } from './catalog-room';
import { olympusExitTypeLabel } from '@planner/projections/roomSelectorProjection';
import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceRoomPickerControl,
} from '../contract';
import type { WorkspaceRewardControl } from '../contracts/rewards';
import type {
  WorkspaceBatchInteractionRequirement,
  WorkspaceOccurrenceInteractionRequirement,
} from '../interactions/interaction-requirements';
import {
  workspaceDecisionOwnedMarkers,
  type WorkspaceDecisionBatchNode,
} from '../navigation/marker-ownership';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { compareAuthoredTargetsInPhysicalOrder, requiredNormalExitOrdinal } from './ordering';
import type { WorkspaceOccurrenceAssembler } from './occurrence-assembly';
import { workspaceRoomRetainsNormalPeers, workspaceRoomTakesOverNormalDoors } from './room-policy';
import { workspaceRewardStoreLabel } from './reward-labels';
import { presentRunState } from '../presentation/run-state';
import type { WorkspaceBiomeSource, WorkspaceEvaluatedBatchOverlay } from '../source-index';
import { workspaceDeclaredPhysicalExits } from './topology-presentation';
import { projectWorkspaceDoorContract } from './door-contract';
import { assembleRoomRerolls } from './reroll-assembly';
import type {
  WorkspaceBatchRepairIntent,
  WorkspaceBatchRewardPool,
  WorkspaceFieldsBatchContext,
  WorkspaceInheritedRewardStore,
  WorkspaceMissingPhysicalTarget,
  WorkspaceMissingTargetAuthoring,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspacePhysicalTarget,
} from '../contracts/structure';

export type WorkspaceAuthoredBatchDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
};
type AuthoredBatchDecision = WorkspaceAuthoredBatchDecision;
type AuthoredBatchTarget = WorkspaceAuthoredBatchDecision['normal']['targets'][number];

function additionalPhysicalExit(
  input: WorkspaceDecisionAssemblyInput,
  decision: AuthoredBatchDecision,
  kind: 'chaos' | 'zagreusContract',
): Omit<RoomExit, 'index'> {
  if (decision.source.kind !== 'occurrence') {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(createExitDecisionAddress(input.source.biome, decision.source))} has ${kind} without an occurrence source`,
    );
  }
  const sourceOccurrence = input.source.occurrence(decision.source.occurrenceId);
  const declaration =
    sourceOccurrence === undefined
      ? undefined
      : requireWorkspaceRoom(input.catalog, sourceOccurrence.gameName).additionalExits.find(
          (exit) => exit.kind === kind,
        );
  if (declaration === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${decision.source.occurrenceId} has authored ${kind} without a declaration`,
    );
  }
  return declaration.physicalExit;
}

const additionalExitTypeLabels = Object.freeze({
  chaos: 'Chaos gate',
  zagreusContract: 'Infernal Contract',
} as const satisfies Record<'chaos' | 'zagreusContract', string>);

/** An additional exit's destination room declares its one fixed reward. */
function additionalExitFixedRewardLabel(catalog: Catalog, roomGameName: string): string {
  const room = requireWorkspaceRoom(catalog, roomGameName);
  const rewardType =
    room.incomingReward.kind === 'fixed'
      ? catalog.rewards.rewardTypes.byKey[room.incomingReward.rewardType]
      : undefined;
  if (rewardType === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${roomGameName} is an additional exit destination without a fixed reward`,
    );
  }
  return rewardType.label;
}

type WorkspaceMissingTargetSetupPrerequisite = Extract<
  WorkspaceMissingTargetAuthoring,
  { readonly kind: 'awaitingBatchRewardStore' | 'awaitingFieldsCageOutcome' }
>;

/**
 * The decision layer can assemble room-local products, but cannot inspect the
 * occurrence assembler's inputs or marker registration state.
 */
interface WorkspaceDecisionAssemblyBaseInput {
  readonly assembleOccurrence: WorkspaceOccurrenceAssembler;
  readonly catalog: Catalog;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  readonly persistence: 'authored' | 'uncommitted';
  readonly source: WorkspaceBiomeSource;
}

/** One authored normal-door batch and its optional evaluator overlay. */
export type WorkspaceDecisionAssemblyInput = WorkspaceDecisionAssemblyBaseInput & {
  readonly decision: AuthoredBatchDecision;
  readonly evaluated?: WorkspaceEvaluatedBatchOverlay;
  readonly kind: 'batch';
};

export interface WorkspaceBatchDecisionAssembly {
  readonly batch: WorkspaceDecisionBatchNode;
  readonly batchInteractionRequirements: readonly WorkspaceBatchInteractionRequirement[];
  readonly kind: 'batch';
  readonly occurrenceInteractionRequirements: readonly WorkspaceOccurrenceInteractionRequirement[];
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly workbenches: readonly WorkspaceOccurrenceWorkbenchNode[];
}

export type WorkspaceDecisionAssembly = WorkspaceBatchDecisionAssembly;

/**
 * Ordinary offer and finding owners remain exact semantic addresses, while
 * their visible workbench is the decision that contains them. Hub-owned
 * stages keep their existing board/visit routing.
 */
function redirectDecisionFocus(
  markerDestinations: WorkspaceMarkerDestinationEmitter,
  node: WorkspaceDecisionBatchNode,
): void {
  if (node.source.kind === 'hubDecision') return;
  const markers = workspaceDecisionOwnedMarkers(node);
  markerDestinations.redirect(markers, node.key);
  markerDestinations.setRoomTab(markers, 'doors');
}

/**
 * Ordinary doors repair only when one is unavailable; a takeover batch repairs
 * whenever the engine can match it to its source's declared doors, and that
 * repair carries the batch's finding mark. Declared exits and authored targets
 * are both exit1-prefixes, so a takeover is only ever too wide or too narrow;
 * any unavailable door makes the repair a removal.
 */
function batchExitCapacityRepairIntent(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: AuthoredBatchDecision,
  owner: ExitDecisionAddress,
  kind: 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch',
  targets: readonly WorkspacePhysicalTarget[],
): WorkspaceBatchRepairIntent | undefined {
  const unavailable = targets.some((target) => target.physicalState === 'unavailable');
  const command = Object.freeze({ kind: 'ReconcileBatchExitCapacity' as const, decision: owner });
  const focus = Object.freeze({ owner, timing: 'before' as const });
  if (kind !== 'takeoverBatch') {
    return unavailable
      ? Object.freeze({ command, effect: 'removeUnavailable' as const, focus })
      : undefined;
  }
  const topology = input.source.plan.topology;
  if (
    topology === null ||
    !takeoverBatchExitRepairAvailable(input.catalog, input.source.layout, topology, decision)
  ) {
    return undefined;
  }
  return Object.freeze({
    command,
    effect: unavailable ? ('removeUnavailable' as const) : ('addMissing' as const),
    focus,
    markOwner: owner,
  });
}

function missingTargetsForPhysicalExits(
  input: WorkspaceDecisionAssemblyBaseInput,
  source: ExitDecision['source'],
  exits: readonly DeclaredPhysicalExit[],
  authoredExitKeys: ReadonlySet<string>,
  prerequisite: WorkspaceMissingTargetSetupPrerequisite | undefined = undefined,
): readonly WorkspaceMissingPhysicalTarget[] {
  let firstMissing: { readonly exitKey: string; readonly index: number } | undefined;
  const missing: WorkspaceMissingPhysicalTarget[] = [];
  for (const exit of [...exits].sort((left, right) => left.index - right.index)) {
    if (authoredExitKeys.has(exit.exitKey)) continue;
    const owner = createTargetAddress(input.source.biome, source, exit.exitKey);
    const exitTypeLabel = olympusExitTypeLabel(exit.type);
    missing.push(
      Object.freeze({
        authoring:
          prerequisite ??
          (firstMissing === undefined
            ? Object.freeze({ kind: 'ready' as const })
            : Object.freeze({
                kind: 'awaitingPriorExit' as const,
                prerequisiteExitKey: firstMissing.exitKey,
              })),
        exitKey: exit.exitKey,
        ...(exitTypeLabel === undefined ? {} : { exitTypeLabel }),
        index: exit.index,
        marker: input.markerDestinations.marker(owner),
      }),
    );
    firstMissing ??= exit;
  }
  return Object.freeze(missing);
}

function fieldsContextForCanonicalBatch(
  input: WorkspaceDecisionAssemblyBaseInput,
  batch: CanonicalBatch,
): WorkspaceFieldsBatchContext | undefined {
  if (batch.batchState.kind !== 'fields') return undefined;
  const evaluation = input.source.evaluation;
  const support =
    evaluation !== undefined && 'roomGeneration' in evaluation
      ? evaluation.roomGeneration.ordinary.ordinaryBatches.find(
          (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(batch.origin),
        )?.fields
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

function fieldsContextForAuthoredBatch(
  facts: FieldsBatchFacts | undefined,
): WorkspaceFieldsBatchContext | undefined {
  if (facts === undefined) return undefined;
  return Object.freeze({
    cageOutcome: facts.cageOutcome,
    cageTargetCount: facts.cageTargetCount,
    doorCageRewardCount: facts.doorCageRewardCount,
  });
}

/**
 * The ship-decided pool. A `sourceOfferPoint` batch carries no authored store:
 * its ShipCombat source's last active reward wheel already fixed it, so the row
 * reports that resolution and links to the wheel.
 */
function inheritedRewardStoreForBatch(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: AuthoredBatchDecision,
): WorkspaceInheritedRewardStore | undefined {
  if (decision.normal.rewardStore.kind !== 'sourceOfferPoint') return undefined;
  const topology = input.source.plan.topology;
  if (topology === null) return undefined;
  const resolution = sourceOfferPointStoreResolution(topology, decision.source);
  // The resolution already rejects a non-occurrence source; the check here only
  // narrows the type for the wheel address below.
  if (resolution === undefined || decision.source.kind !== 'occurrence') return undefined;
  return Object.freeze({
    label: workspaceRewardStoreLabel(resolution.storeKey),
    storeKey: resolution.storeKey,
    wheel: input.markerDestinations.marker(
      createRewardWheelAddress(
        input.source.biome,
        decision.source.occurrenceId,
        resolution.wheelKey,
      ),
    ),
  });
}

/**
 * What the selected exit counts for the store ratio, only where it differs from
 * the pool the batch carries. The engine resolves the counted store; this only
 * names it.
 */
function effectiveRewardPool(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: AuthoredBatchDecision,
  evaluated: WorkspaceEvaluatedBatchOverlay | undefined,
  carriedStoreKey: string | undefined,
): string | undefined {
  const topology = input.source.plan.topology;
  const stores =
    evaluated !== undefined
      ? canonicalBatchEnteredRewardStores(input.catalog, evaluated.batch)
      : topology === null
        ? undefined
        : authoredBatchEnteredRewardStores(input.catalog, topology, decision);
  const selected = stores?.selected;
  if (selected === undefined) return undefined;
  const exitLabel =
    selected.exit.kind === 'additional'
      ? additionalExitTypeLabels[selected.exit.additionalExitKey]
      : requireWorkspaceRoom(input.catalog, selected.gameName).label;
  switch (selected.entered.kind) {
    case 'unresolved':
      return undefined;
    case 'none':
      return `Discarded by ${exitLabel}`;
    case 'store': {
      const { storeKey } = selected.entered;
      if (storeKey === carriedStoreKey) return undefined;
      const label = workspaceRewardStoreLabel(storeKey);
      return selected.exit.kind === 'additional' ? `${label} · ${exitLabel}` : label;
    }
  }
}

/**
 * The batch's one pool row wherever the batch has a pool: the editable picker
 * or the ship-decided value, beside what the selected exit counts.
 */
function rewardPoolForBatch(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: AuthoredBatchDecision,
  evaluated: WorkspaceEvaluatedBatchOverlay | undefined,
  editable: boolean,
): WorkspaceBatchRewardPool | undefined {
  const inherited = inheritedRewardStoreForBatch(input, decision);
  if (!editable && inherited === undefined) return undefined;
  const rewardStore = decision.normal.rewardStore;
  const carried =
    inherited?.storeKey ??
    (rewardStore.kind === 'authoredBaseStore'
      ? (rewardStore.baseRewardStoreKey ?? undefined)
      : undefined);
  const effective = effectiveRewardPool(input, decision, evaluated, carried);
  return Object.freeze({
    ...(effective === undefined ? {} : { effective }),
    ...(inherited === undefined ? {} : { inherited }),
  });
}

function missingTargetPrerequisite(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: ExitDecision,
  fieldsBatchOwnsOutcome: boolean,
): WorkspaceMissingTargetSetupPrerequisite | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  if (
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    decision.normal.rewardStore.baseRewardStoreKey === null
  ) {
    return Object.freeze({
      kind: 'awaitingBatchRewardStore' as const,
    });
  }
  if (fieldsBatchOwnsOutcome && decision.normal.batchState === null) {
    return Object.freeze({
      kind: 'awaitingFieldsCageOutcome' as const,
    });
  }
  return undefined;
}

function rawBatchKind(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: AuthoredBatchDecision,
): 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch' {
  const rooms = decision.normal.targets.flatMap((target) => {
    const occurrence = input.source.occurrence(target.occurrenceId);
    return occurrence === undefined
      ? []
      : [requireWorkspaceRoom(input.catalog, occurrence.gameName)];
  });
  if (rooms.length > 0 && rooms.every(workspaceRoomTakesOverNormalDoors)) return 'takeoverBatch';
  if (rooms.some(workspaceRoomRetainsNormalPeers)) return 'mixedBatch';
  return 'ordinaryBatch';
}

function rawBatchTopologyState(
  input: WorkspaceDecisionAssemblyBaseInput,
  owner: ExitDecisionAddress,
): 'partial' | 'retained' {
  const evaluation = input.source.evaluation;
  return evaluation?.authoring === 'incomplete' &&
    evaluation.coverage.kind === 'prefix' &&
    semanticAddressKey(evaluation.frontier) === semanticAddressKey(owner)
    ? 'partial'
    : 'retained';
}

function projectAuthoredTargetWithOverlay(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: AuthoredBatchDecision,
  target: AuthoredBatchTarget,
  fieldsFacts: FieldsBatchFacts | undefined,
  physical: readonly DeclaredPhysicalExit[],
  completedHubExitStage: boolean,
  evaluatedTarget: CanonicalTarget | undefined,
  clockworkGoalsRemaining: number | undefined,
  batchKind: 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch',
): {
  readonly node: WorkspaceOccurrenceWorkbenchNode;
  readonly occurrenceInteractionRequirements: readonly WorkspaceOccurrenceInteractionRequirement[];
  readonly roomControls: readonly WorkspaceRoomPickerControl[];
  readonly rewardControls: readonly WorkspaceRewardControl[];
  readonly target: WorkspacePhysicalTarget;
} {
  const { source } = input;
  const occurrence = source.occurrence(target.occurrenceId);
  if (occurrence === undefined) {
    throw new StructuredWorkspaceProjectionContractError(
      `${source.plan.biomeKey} target ${target.occurrenceId} is absent from authored occurrences`,
    );
  }
  const address = createTargetAddress(source.biome, decision.source, target.exitKey);
  if (evaluatedTarget !== undefined) {
    if (semanticAddressKey(evaluatedTarget.origin) !== semanticAddressKey(address)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(address)} received an evaluated target for ${semanticAddressKey(evaluatedTarget.origin)}`,
      );
    }
    const occurrenceAddress = createOccurrenceAddress(source.biome, occurrence.occurrenceId);
    if (
      evaluatedTarget.room.occurrenceId !== occurrence.occurrenceId ||
      evaluatedTarget.room.gameName !== occurrence.gameName ||
      semanticAddressKey(evaluatedTarget.room.origin) !== semanticAddressKey(occurrenceAddress)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(address)} evaluated room does not match its authored occurrence`,
      );
    }
  }
  const selected = selectedExitTarget(decision)?.exitKey === target.exitKey;
  const declaredExit = physical.find((candidate) => candidate.exitKey === target.exitKey);
  const exitTypeLabel = olympusExitTypeLabel(declaredExit?.type);
  const physicalState =
    evaluatedTarget?.exit.kind ??
    (declaredExit === undefined ? ('unavailable' as const) : ('available' as const));
  const fallbackContinuation: WorkspacePhysicalTarget['nextPath'] = targetContinuation(selected);
  const markerForTarget = input.markerDestinations.marker(address);
  const anomalyTakeoverAvailable =
    input.source.evaluation !== undefined && 'roomGeneration' in input.source.evaluation
      ? input.source.evaluation.roomGeneration.ordinary.ordinaryBatches.some((batch) =>
          batch.targets.some(
            (target) =>
              semanticAddressKey(target.origin) === semanticAddressKey(address) &&
              target.anomaly?.selectedPossible,
          ),
        )
      : false;
  const roomPicker: WorkspaceRoomPickerControl | undefined =
    batchKind === 'takeoverBatch'
      ? undefined
      : Object.freeze({
          address,
          kind: 'targetRoomPicker' as const,
          target: Object.freeze({
            kind: 'existing' as const,
            occurrence: createOccurrenceAddress(source.biome, occurrence.occurrenceId),
            selectedGameName: occurrence.gameName,
          }),
        });
  const occurrenceAssembly = input.assembleOccurrence(
    Object.freeze({
      ...(evaluatedTarget === undefined ? {} : { evaluatedRoom: evaluatedTarget.room }),
      ...(clockworkGoalsRemaining === undefined ? {} : { clockworkGoalsRemaining }),
      ...(fieldsFacts === undefined ? {} : { fieldsBatchFacts: fieldsFacts }),
      occurrence,
      ...(roomPicker === undefined ? {} : { roomPicker }),
    }),
  );
  const door = projectWorkspaceDoorContract(
    occurrenceAssembly.node.room,
    declaredExit?.behavior.rewardPreview ?? 'visible',
  );
  const node = Object.freeze({
    ...occurrenceAssembly.node,
    incomingDoor: door,
    inspectorPresentation: 'doorTarget' as const,
    ...(completedHubExitStage ? { completedHubExitStage: true as const } : {}),
    railMarker: markerForTarget,
  });
  return Object.freeze({
    node,
    occurrenceInteractionRequirements: occurrenceAssembly.occurrenceInteractionRequirements,
    roomControls: occurrenceAssembly.roomControls,
    rewardControls: occurrenceAssembly.rewardControls,
    target: Object.freeze({
      ...(evaluatedTarget?.room.clockworkReward === undefined
        ? {}
        : { clockworkReward: evaluatedTarget.room.clockworkReward }),
      door,
      exitKey: target.exitKey,
      ...(exitTypeLabel === undefined ? {} : { exitTypeLabel }),
      index:
        evaluatedTarget?.exit.index ??
        declaredExit?.index ??
        requiredNormalExitOrdinal(target.exitKey),
      marker: markerForTarget,
      physicalState,
      selected,
      retained: evaluatedTarget === undefined || physicalState === 'unavailable',
      nextPath: evaluatedTarget?.continuation ?? fallbackContinuation,
      room: door.room,
      ...(occurrence.state.kind === 'counted' &&
      occurrence.anomalyReplacement === undefined &&
      anomalyTakeoverAvailable
        ? { anomalyTakeover: Object.freeze({ label: 'Replace with Anomaly' }) }
        : {}),
    }),
  });
}

function topologyStateForAuthoredBatch(
  input: WorkspaceDecisionAssemblyBaseInput,
  owner: ExitDecisionAddress,
  evaluated: WorkspaceEvaluatedBatchOverlay | undefined,
): 'complete' | 'partial' | 'retained' {
  if (evaluated?.partial === true || rawBatchTopologyState(input, owner) === 'partial') {
    return 'partial';
  }
  if (evaluated === undefined) return 'retained';
  return evaluated.batch.targets.some((target) => target.exit.kind === 'unavailable')
    ? 'retained'
    : 'complete';
}

/**
 * A normal decision owns its target pickers. This consumes the same physical
 * target and missing-target products rendered by the workbench, rather than
 * creating controls in an earlier unrelated topology pass.
 */
function roomControlsForBatch(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: AuthoredBatchDecision,
  kind: 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch',
  physical: readonly DeclaredPhysicalExit[],
  targets: readonly WorkspacePhysicalTarget[],
  missingTargets: readonly WorkspaceMissingPhysicalTarget[],
): readonly WorkspaceRoomPickerControl[] {
  if (kind === 'takeoverBatch' || decision.source.kind !== 'occurrence') {
    return Object.freeze([]);
  }
  const decisionOwner = createExitDecisionAddress(input.source.biome, decision.source);
  const emptyNormalDecision =
    decision.normal.targets.length === 0 &&
    normalDecisionProgressionForLayout(input.source.layout) !== undefined;
  const targetsByExit = new Map(targets.map((target) => [target.exitKey, target] as const));
  const missingByExit = new Map(missingTargets.map((target) => [target.exitKey, target] as const));
  const controls: WorkspaceRoomPickerControl[] = [];
  const orderedPhysical = [...physical].sort((left, right) => left.index - right.index);
  const firstPhysicalExitKey = orderedPhysical[0]?.exitKey;
  const hubTerminal =
    emptyNormalDecision &&
    decision.normal.targets.length === 0 &&
    decision.selection.kind !== 'additional' &&
    input.source.plan.topology !== null
      ? hubTerminalTakeoverForSource(
          input.catalog,
          input.source.layout,
          input.source.plan.topology,
          decision.source,
        )
      : undefined;
  if (hubTerminal !== undefined) {
    const address = createTargetAddress(input.source.biome, decision.source, 'exit1');
    controls.push(
      Object.freeze({
        address,
        decisionOwner,
        hub: Object.freeze({
          decision: createHubDecisionAddress(input.source.biome, hubTerminal.hubKey),
          gameName: hubTerminal.room.gameName,
        }),
        kind: 'decisionEntryRoomPicker' as const,
        ordinaryTargetAuthoring: Object.freeze({ kind: 'ready' as const }),
        ordinaryTargetGameNames: Object.freeze([]),
        persistence: input.persistence,
        takeoverGameNames: Object.freeze([]),
      }),
    );
  }
  for (const exit of orderedPhysical) {
    if (hubTerminal !== undefined) continue;
    const target = targetsByExit.get(exit.exitKey);
    if (target !== undefined) continue;
    const missing = missingByExit.get(exit.exitKey);
    if (emptyNormalDecision && exit.exitKey === firstPhysicalExitKey && missing !== undefined) {
      const address = createTargetAddress(input.source.biome, decision.source, missing.exitKey);
      controls.push(
        Object.freeze({
          address,
          decisionOwner,
          kind: 'decisionEntryRoomPicker' as const,
          ordinaryTargetAuthoring: missing.authoring,
          ordinaryTargetGameNames:
            input.source.plan.topology === null
              ? Object.freeze([])
              : ordinaryTargetGameNames(
                  input.catalog,
                  input.source.layout,
                  input.source.plan.topology,
                  address,
                  input.persistence,
                ),
          persistence: input.persistence,
          takeoverGameNames:
            input.source.layout.progression.kind === 'generated'
              ? takeoverPrebossGameNames(input.catalog, input.source.plan.biomeKey)
              : Object.freeze([]),
        }),
      );
      continue;
    }
    if (missing?.authoring.kind === 'ready') {
      const address = createTargetAddress(input.source.biome, decision.source, missing.exitKey);
      controls.push(
        Object.freeze({
          address,
          kind: 'targetRoomPicker' as const,
          target: Object.freeze({ kind: 'missing' as const }),
        }),
      );
    }
  }
  return Object.freeze(controls);
}

function batchInteractionRequirements(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: AuthoredBatchDecision,
  batch: WorkspaceDecisionBatchNode,
): readonly WorkspaceBatchInteractionRequirement[] {
  const exitSelection =
    (input.persistence === 'uncommitted' && batch.targets.length === 0) ||
    (decision.selection.kind === 'derived' &&
      batch.zagreusContract === undefined &&
      batch.chaos === undefined)
      ? undefined
      : Object.freeze({
          owner: createExitSelectionAddress(input.source.biome, decision.source),
          ...(decision.selection.kind === 'normal'
            ? { selectedExitKey: decision.selection.exitKey }
            : {}),
          targets: Object.freeze(
            batch.targets.map((target) =>
              Object.freeze({ label: target.exitKey, value: target.exitKey }),
            ),
          ),
        });
  const policy =
    input.source.layout.progression.kind === 'generated'
      ? input.source.layout.progression.rewardStorePolicy
      : undefined;
  const authoredRewardStore =
    decision.normal.rewardStore.kind === 'authoredBaseStore'
      ? decision.normal.rewardStore
      : undefined;
  const rewardStore =
    authoredRewardStore !== undefined &&
    (batch.kind !== 'takeoverBatch' || authoredRewardStore.baseRewardStoreKey !== null) &&
    policy?.kind === 'authoredBaseStore'
      ? Object.freeze({
          owner: createBatchRewardStoreAddress(input.source.biome, decision.source),
          ...(authoredRewardStore.baseRewardStoreKey === null
            ? {}
            : { selected: authoredRewardStore.baseRewardStoreKey }),
          storeChoices: Object.freeze(
            policy.storeKeys.map((value) =>
              Object.freeze({ label: workspaceRewardStoreLabel(value), value }),
            ),
          ),
        })
      : undefined;
  const fieldsCageOutcome =
    batch.fieldsCageOutcome === undefined
      ? undefined
      : Object.freeze({
          owner: batch.owner,
          outcomeChoices: Object.freeze([
            Object.freeze({ label: 'Minimum', value: 'min' as const }),
            Object.freeze({ label: 'Maximum', value: 'max' as const }),
          ]),
          ...(decision.normal.batchState?.cageOutcome === undefined
            ? {}
            : { selected: decision.normal.batchState.cageOutcome }),
        });
  const zagreusContract =
    batch.zagreusContract === undefined
      ? undefined
      : Object.freeze({ owner: batch.zagreusContract.owner });
  const chaos =
    batch.chaos === undefined
      ? undefined
      : Object.freeze({
          forced: batch.chaos.forced,
          kind: batch.chaos.kind,
          owner: batch.chaos.owner,
          occurrence: batch.chaos.door.room.address,
          mapChoices: batch.chaos.mapChoices,
        });
  if (
    exitSelection === undefined &&
    rewardStore === undefined &&
    fieldsCageOutcome === undefined &&
    zagreusContract === undefined &&
    chaos === undefined
  ) {
    return Object.freeze([]);
  }
  return Object.freeze([
    Object.freeze({
      ...(exitSelection === undefined ? {} : { exitSelection }),
      ...(fieldsCageOutcome === undefined ? {} : { fieldsCageOutcome }),
      kind: 'batchControls' as const,
      owner: batch.owner,
      persistence: input.persistence,
      ...(rewardStore === undefined ? {} : { rewardStore }),
      ...(zagreusContract === undefined ? {} : { zagreusContract }),
      ...(chaos === undefined ? {} : { chaos }),
    }),
  ]);
}

function assembleBatchDecision(
  input: Extract<WorkspaceDecisionAssemblyInput, { readonly kind: 'batch' }>,
): WorkspaceBatchDecisionAssembly {
  const { decision, evaluated, source } = input;
  const owner = createExitDecisionAddress(source.biome, decision.source);
  if (
    evaluated !== undefined &&
    semanticAddressKey(evaluated.batch.origin) !== semanticAddressKey(owner)
  ) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} received an evaluated batch for ${semanticAddressKey(evaluated.batch.origin)}`,
    );
  }
  const evaluatedTargets = new Map<string, CanonicalTarget>();
  for (const target of evaluated?.batch.targets ?? []) {
    if (evaluatedTargets.has(target.exit.exitKey)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} has duplicate evaluated target ${target.exit.exitKey}`,
      );
    }
    evaluatedTargets.set(target.exit.exitKey, target);
  }
  const evaluatedAdditional = new Map<string, CanonicalAdditionalContinuation>();
  for (const additional of source.evaluatedAdditional(owner)) {
    if (evaluatedAdditional.has(additional.key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} has duplicate evaluated additional exit ${additional.key}`,
      );
    }
    evaluatedAdditional.set(additional.key, additional);
  }
  const canonicalAdditionalByKey = new Map<string, CanonicalAdditionalContinuation>();
  const authoredAdditional =
    decision.source.kind === 'occurrence'
      ? (source.occurrence(decision.source.occurrenceId)?.additionalExits ?? Object.freeze([]))
      : Object.freeze([]);
  for (const additional of authoredAdditional) {
    const evaluatedAdditionalExit = evaluatedAdditional.get(additional.key);
    if (evaluatedAdditionalExit === undefined) continue;
    evaluatedAdditional.delete(additional.key);
    const occurrence = source.occurrence(additional.occurrenceId);
    const additionalOwner = createAdditionalExitAddress(
      source.biome,
      decision.source.kind === 'occurrence'
        ? decision.source.occurrenceId
        : additional.occurrenceId,
      additional.key,
    );
    const occurrenceOwner = createOccurrenceAddress(source.biome, additional.occurrenceId);
    if (
      occurrence === undefined ||
      semanticAddressKey(evaluatedAdditionalExit.origin) !== semanticAddressKey(additionalOwner) ||
      evaluatedAdditionalExit.room.occurrenceId !== additional.occurrenceId ||
      evaluatedAdditionalExit.room.gameName !== occurrence.gameName ||
      semanticAddressKey(evaluatedAdditionalExit.room.origin) !==
        semanticAddressKey(occurrenceOwner)
    ) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(additionalOwner)} evaluated additional exit does not match its authored occurrence`,
      );
    }
    canonicalAdditionalByKey.set(additional.key, evaluatedAdditionalExit);
  }
  if (evaluatedAdditional.size > 0) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} has evaluated additional exits with no authored exit`,
    );
  }
  const kind = rawBatchKind(input, decision);
  const fieldsBatchOwnsOutcome = fieldsBatchOwnsCageOutcome(
    input.catalog,
    source.layout,
    source.occurrence,
    decision,
  );
  // Assessment may stop before the target whose cage needs repair. Activation
  // remains a fact of the complete authored batch, not overlay membership.
  const authoredFieldsFacts = fieldsBatchFacts(
    input.catalog,
    source.layout,
    source.occurrence,
    decision,
  );
  const completedHubExitStage = decision.source.kind === 'hubDecision';
  const physical = workspaceDeclaredPhysicalExits(
    input.catalog,
    source.layout,
    source.plan,
    decision.source,
  );
  const rank = new Map(physical.map((exit) => [exit.exitKey, exit.index] as const));
  const projectedTargets = [...decision.normal.targets]
    .sort((left, right) => compareAuthoredTargetsInPhysicalOrder(rank, left, right))
    .map((target) => {
      const overlay = evaluatedTargets.get(target.exitKey);
      evaluatedTargets.delete(target.exitKey);
      return projectAuthoredTargetWithOverlay(
        input,
        decision,
        target,
        authoredFieldsFacts,
        physical,
        completedHubExitStage,
        overlay,
        overlay === undefined || evaluated === undefined
          ? undefined
          : clockworkDoorGoalsRemaining(evaluated.batch, overlay),
        kind,
      );
    });
  if (evaluatedTargets.size > 0) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} has evaluated targets with no authored target`,
    );
  }
  const rerollSource =
    input.persistence === 'authored' && decision.source.kind === 'occurrence'
      ? source.occurrence(decision.source.occurrenceId)
      : undefined;
  const rerolls = assembleRoomRerolls({
    catalog: input.catalog,
    markerDestinations: input.markerDestinations,
    source,
    ...(rerollSource === undefined ? {} : { sourceOccurrence: rerollSource }),
    targets: projectedTargets.map((value) => value.target),
  });
  const targets = rerolls.targets;
  const missingTargets = missingTargetsForPhysicalExits(
    input,
    decision.source,
    physical,
    new Set(decision.normal.targets.map((target) => target.exitKey)),
    missingTargetPrerequisite(input, decision, fieldsBatchOwnsOutcome),
  );
  const terminalHub =
    decision.normal.targets.length === 0 &&
    decision.selection.kind !== 'additional' &&
    input.source.plan.topology !== null
      ? hubTerminalTakeoverForSource(
          input.catalog,
          input.source.layout,
          input.source.plan.topology,
          decision.source,
        )
      : undefined;
  const visibleMissingTargets =
    terminalHub === undefined
      ? missingTargets
      : Object.freeze([
          Object.freeze({
            authoring: Object.freeze({ kind: 'ready' as const }),
            exitKey: 'exit1',
            index: 1,
            marker: input.markerDestinations.marker(
              createTargetAddress(input.source.biome, decision.source, 'exit1'),
            ),
          }),
        ]);
  const targetRoomControls = roomControlsForBatch(
    input,
    decision,
    kind,
    physical,
    targets,
    visibleMissingTargets,
  );
  const repairIntent = batchExitCapacityRepairIntent(input, decision, owner, kind, targets);
  const fieldsCageOutcome = fieldsBatchOwnsOutcome
    ? input.markerDestinations.marker(owner)
    : undefined;
  const fields =
    evaluated === undefined
      ? fieldsContextForAuthoredBatch(authoredFieldsFacts)
      : fieldsContextForCanonicalBatch(input, evaluated.batch);
  const hasEditableAuthoredRewardStore =
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    (kind !== 'takeoverBatch' || decision.normal.rewardStore.baseRewardStoreKey !== null);
  const rewardPool = rewardPoolForBatch(input, decision, evaluated, hasEditableAuthoredRewardStore);
  const zagreusAdditional = authoredAdditional.find(
    (additional) => additional.kind === 'zagreusContract',
  );
  const zagreusContract =
    zagreusAdditional === undefined
      ? undefined
      : (() => {
          const occurrence = source.occurrence(zagreusAdditional.occurrenceId);
          if (occurrence === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(owner)} has no authored Zagreus contract occurrence`,
            );
          }
          const evaluatedContract = canonicalAdditionalByKey.get(zagreusAdditional.key);
          const contractAssembly = input.assembleOccurrence(
            Object.freeze({
              ...(evaluatedContract === undefined ? {} : { evaluatedRoom: evaluatedContract.room }),
              occurrence,
            }),
          );
          return Object.freeze({
            contractRoom: contractAssembly.node.room,
            marker: input.markerDestinations.marker(
              createAdditionalExitAddress(
                source.biome,
                decision.source.kind === 'occurrence'
                  ? decision.source.occurrenceId
                  : zagreusAdditional.occurrenceId,
                zagreusAdditional.key,
              ),
            ),
            owner: createAdditionalExitAddress(
              source.biome,
              decision.source.kind === 'occurrence'
                ? decision.source.occurrenceId
                : zagreusAdditional.occurrenceId,
              zagreusAdditional.key,
            ),
            physicalExit: additionalPhysicalExit(input, decision, 'zagreusContract'),
            selected:
              decision.selection.kind === 'additional' &&
              decision.selection.additionalExitKey === zagreusAdditional.key,
            assembly: contractAssembly,
          });
        })();
  const chaosAdditional = authoredAdditional.find((additional) => additional.kind === 'chaos');
  const chaos =
    chaosAdditional === undefined
      ? undefined
      : (() => {
          if (decision.source.kind !== 'occurrence') {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(owner)} has a Chaos exit without an occurrence source`,
            );
          }
          const occurrence = source.occurrence(chaosAdditional.occurrenceId);
          if (occurrence === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(owner)} has no authored Chaos occurrence`,
            );
          }
          const evaluatedChaos = canonicalAdditionalByKey.get(chaosAdditional.key);
          const chaosAssembly = input.assembleOccurrence(
            Object.freeze({
              ...(evaluatedChaos === undefined ? {} : { evaluatedRoom: evaluatedChaos.room }),
              occurrence,
            }),
          );
          const host = source.layout.chaos;
          if (host === undefined) {
            throw new StructuredWorkspaceProjectionContractError(
              `${semanticAddressKey(owner)} has Chaos without a host map domain`,
            );
          }
          const additionalOwner = createAdditionalExitAddress(
            source.biome,
            decision.source.occurrenceId,
            chaosAdditional.key,
          );
          return Object.freeze({
            chaosRoom: chaosAssembly.node.room,
            forced: source.chaosGateForced(
              createOccurrenceAddress(source.biome, decision.source.occurrenceId),
            ),
            kind: chaosAdditional.kind,
            marker: input.markerDestinations.marker(additionalOwner),
            mapChoices: Object.freeze(
              host.roomGameNames.map((gameName) => {
                const room = requireWorkspaceRoom(input.catalog, gameName);
                return Object.freeze({ label: room.label, value: room.gameName });
              }),
            ),
            owner: additionalOwner,
            physicalExit: additionalPhysicalExit(input, decision, chaosAdditional.kind),
            selected:
              decision.selection.kind === 'additional' &&
              decision.selection.additionalExitKey === chaosAdditional.key,
            assembly: chaosAssembly,
          });
        })();
  const runState =
    input.persistence === 'authored' && owner.source.kind === 'hubDecision'
      ? input.source.runState(owner)
      : undefined;
  const base = {
    batchState: decision.normal.batchState,
    ...(fieldsCageOutcome === undefined ? {} : { fieldsCageOutcome }),
    ...(fields === undefined ? {} : { fields }),
    ...(zagreusContract === undefined
      ? {}
      : {
          zagreusContract: Object.freeze({
            door: projectWorkspaceDoorContract(
              zagreusContract.contractRoom,
              zagreusContract.physicalExit.behavior.rewardPreview,
            ),
            exitTypeKey: zagreusContract.physicalExit.type,
            exitTypeLabel: additionalExitTypeLabels.zagreusContract,
            fixedRewardLabel: additionalExitFixedRewardLabel(
              input.catalog,
              zagreusContract.contractRoom.gameName,
            ),
            marker: zagreusContract.marker,
            owner: zagreusContract.owner,
            selected: zagreusContract.selected,
          }),
        }),
    ...(chaos === undefined
      ? {}
      : {
          chaos: Object.freeze({
            door: projectWorkspaceDoorContract(
              chaos.chaosRoom,
              chaos.physicalExit.behavior.rewardPreview,
            ),
            exitTypeKey: chaos.physicalExit.type,
            exitTypeLabel: additionalExitTypeLabels[chaos.kind],
            fixedRewardLabel: additionalExitFixedRewardLabel(
              input.catalog,
              chaos.chaosRoom.gameName,
            ),
            forced: chaos.forced,
            kind: chaos.kind,
            mapChoices: chaos.mapChoices,
            marker: chaos.marker,
            owner: chaos.owner,
            selected: chaos.selected,
          }),
        }),
    key: `batch:${semanticAddressKey(owner)}`,
    marker: input.markerDestinations.marker(owner),
    missingTargets: visibleMissingTargets,
    owner,
    persistence: input.persistence,
    ...(repairIntent === undefined ? {} : { repairIntent }),
    ...(rerolls.rerolls === undefined ? {} : { rerolls: rerolls.rerolls }),
    ...(rewardPool === undefined ? {} : { rewardPool }),
    ...(hasEditableAuthoredRewardStore
      ? {
          rewardStore: input.markerDestinations.marker(
            createBatchRewardStoreAddress(source.biome, decision.source),
          ),
          // One term for the pool everywhere it is named, including the
          // disposition lines that say what becomes of it.
          rewardStoreLabel: 'Reward Pool',
        }
      : {}),
    selection: input.markerDestinations.marker(
      createExitSelectionAddress(source.biome, decision.source),
    ),
    source: decision.source,
    targets: Object.freeze(targets),
    topologyState: topologyStateForAuthoredBatch(input, owner, evaluated),
    ...(runState === undefined
      ? {}
      : {
          runState:
            runState.availability === 'available'
              ? Object.freeze({
                  availability: 'available' as const,
                  owner,
                  state: presentRunState(input.catalog, runState.snapshot, 'Leaving the Hub'),
                  title: 'Decision',
                })
              : Object.freeze({
                  availability: 'unavailable' as const,
                  owner,
                  title: 'Decision',
                }),
        }),
  } as const;
  const batch: WorkspaceDecisionBatchNode =
    kind === 'takeoverBatch'
      ? Object.freeze({
          ...base,
          kind: 'takeoverBatch' as const,
          targetInteraction: 'readOnly' as const,
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
  redirectDecisionFocus(input.markerDestinations, batch);
  // A takeover's missing doors have no row; their door-set repair carries the mark.
  if (batch.repairIntent?.markOwner !== undefined) {
    for (const missing of batch.missingTargets) {
      input.markerDestinations.redirectTo(missing.marker, batch.marker, batch.key, batch.marker);
    }
  }
  // An impossible Anomaly is repaired by restoring its remembered room; navigation stays on the door.
  if (batch.source.kind !== 'hubDecision') {
    for (const target of batch.targets) {
      if (batch.kind !== 'takeoverBatch' && target.door.room.anomaly !== undefined)
        input.markerDestinations.redirectToContext(
          target.marker,
          target.marker,
          batch.key,
          target.door.room.marker,
          'revertAnomaly',
        );
    }
  }
  if (completedHubExitStage) {
    const workbench = projectedTargets[0]?.node;
    if (workbench === undefined) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} Hub handoff has no authored target workbench`,
      );
    }
    input.markerDestinations.redirect(workspaceDecisionOwnedMarkers(batch), workbench.key);
  }
  return Object.freeze({
    batch,
    batchInteractionRequirements: batchInteractionRequirements(input, decision, batch),
    kind: 'batch' as const,
    occurrenceInteractionRequirements: Object.freeze([
      ...projectedTargets.flatMap((target) => target.occurrenceInteractionRequirements),
      ...(zagreusContract === undefined
        ? []
        : zagreusContract.assembly.occurrenceInteractionRequirements),
      ...(chaos === undefined ? [] : chaos.assembly.occurrenceInteractionRequirements),
      ...(rerolls.requirement === undefined ? [] : [rerolls.requirement]),
    ]),
    roomControls: Object.freeze([
      ...projectedTargets.flatMap((target) => target.roomControls),
      ...targetRoomControls,
    ]),
    rewardControls: Object.freeze([
      ...projectedTargets.flatMap((target) => target.rewardControls),
      ...(zagreusContract === undefined ? [] : zagreusContract.assembly.rewardControls),
      ...(chaos === undefined ? [] : chaos.assembly.rewardControls),
    ]),
    workbenches: Object.freeze([
      // A room's header names the door reward its rerolls left.
      ...projectedTargets.map((target, index) => {
        const door = targets[index]?.door;
        return door === undefined || door === target.target.door
          ? target.node
          : Object.freeze({ ...target.node, incomingDoor: door });
      }),
      ...(zagreusContract === undefined
        ? []
        : [
            Object.freeze({
              ...zagreusContract.assembly.node,
              incomingDoor: batch.zagreusContract!.door,
              inspectorPresentation: 'doorTarget' as const,
            }),
          ]),
      ...(chaos === undefined
        ? []
        : [
            Object.freeze({
              ...chaos.assembly.node,
              incomingDoor: batch.chaos!.door,
              inspectorPresentation: 'doorTarget' as const,
            }),
          ]),
    ]),
  });
}

export function assembleWorkspaceDecision(
  input: WorkspaceDecisionAssemblyInput,
): WorkspaceDecisionAssembly {
  return assembleBatchDecision(input);
}
