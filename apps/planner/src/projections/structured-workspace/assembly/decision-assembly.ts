import {
  createBatchRewardStoreAddress,
  createAdditionalExitAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createTargetAddress,
  ordinaryTargetAuthoringEligibility,
  normalDecisionProgressionForLayout,
  selectedExitTarget,
  semanticAddressKey,
  type DeclaredPhysicalExit,
  type ExitDecision,
  type ExitDecisionAddress,
  type HubDecisionAddress,
  type OccurrenceId,
  type TargetAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  CanonicalAdditionalContinuation,
  CanonicalBatch,
  CanonicalTarget,
  FieldsBatchFacts,
} from '@run-planner/engine/simulation';
import {
  fieldsBatchFacts,
  fieldsBatchOwnsCageOutcome,
  targetContinuation,
} from '@run-planner/engine/simulation';

import { requireWorkspaceRoom } from './catalog-room';
import {
  StructuredWorkspaceProjectionContractError,
  workspaceInteractionKey,
  type WorkspaceBatchRepairIntent,
  type WorkspaceEffectiveRewardStore,
  type WorkspaceFieldsBatchContext,
  type WorkspaceMissingPhysicalTarget,
  type WorkspaceMissingTargetAuthoring,
  type WorkspaceOccurrenceWorkbenchNode,
  type WorkspacePhysicalTarget,
  type WorkspaceRewardControl,
  type WorkspaceRoomPickerControl,
  type WorkspaceStageDecisionRemoval,
} from '../contract';
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
import type { WorkspaceBiomeSource, WorkspaceEvaluatedBatchOverlay } from '../source-index';
import { workspaceDeclaredPhysicalExits } from './topology-presentation';

export type WorkspaceAuthoredBatchDecision = ExitDecision & {
  readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
};
type AuthoredBatchDecision = WorkspaceAuthoredBatchDecision;
type AuthoredBatchTarget = WorkspaceAuthoredBatchDecision['normal']['targets'][number];

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
  /** A separately assembled terminal-Hub requirement for this exact decision. */
  readonly hubTakeover?: {
    readonly interactionKey: string;
    readonly owner: HubDecisionAddress;
  };
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
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

function hubStageDecisionRemoval(
  input: WorkspaceDecisionAssemblyBaseInput,
  owner: ExitDecisionAddress,
): WorkspaceStageDecisionRemoval | undefined {
  const { source } = input;
  const layout = source.layout;
  if (layout.progression.kind !== 'hub') return undefined;
  const isExpectedSource =
    owner.source.kind === 'hubDecision' && owner.source.decisionKey === layout.progression.hubKey;
  if (!isExpectedSource) return undefined;
  return Object.freeze({
    interactionKey: workspaceInteractionKey(owner),
    label: 'Remove Preboss',
  });
}

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
  markerDestinations.redirect(workspaceDecisionOwnedMarkers(node), node.key);
}

function batchRepairIntentForUnavailableTargets(
  owner: ExitDecisionAddress,
  kind: 'ordinaryBatch' | 'takeoverBatch' | 'mixedBatch',
  roots: ReadonlySet<OccurrenceId>,
): WorkspaceBatchRepairIntent | undefined {
  if (kind === 'takeoverBatch' || roots.size === 0) return undefined;
  return Object.freeze({
    command: Object.freeze({ kind: 'ReconcileBatchExitCapacity' as const, decision: owner }),
    focus: Object.freeze({ owner, timing: 'before' as const }),
  });
}

function missingTargetsForPhysicalExits(
  input: WorkspaceDecisionAssemblyBaseInput,
  source: ExitDecision['source'],
  exits: readonly { readonly exitKey: string; readonly index: number }[],
  authoredExitKeys: ReadonlySet<string>,
  prerequisite: WorkspaceMissingTargetSetupPrerequisite | undefined = undefined,
): readonly WorkspaceMissingPhysicalTarget[] {
  let firstMissing: { readonly exitKey: string; readonly index: number } | undefined;
  const missing: WorkspaceMissingPhysicalTarget[] = [];
  for (const exit of [...exits].sort((left, right) => left.index - right.index)) {
    if (authoredExitKeys.has(exit.exitKey)) continue;
    const owner = createTargetAddress(input.source.biome, source, exit.exitKey);
    missing.push(
      Object.freeze({
        authoring:
          prerequisite ??
          (firstMissing === undefined
            ? Object.freeze({ kind: 'ready' as const })
            : Object.freeze({
                kind: 'awaitingPriorExit' as const,
                message: `Choose Door ${firstMissing.index} first.`,
                prerequisiteExitKey: firstMissing.exitKey,
              })),
        exitKey: exit.exitKey,
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
      ? evaluation.roomGeneration.ordinary.fieldsCageOutcomes.find(
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

function effectiveRewardStoreForBatch(
  decision: AuthoredBatchDecision,
  evaluated: WorkspaceEvaluatedBatchOverlay | undefined,
): WorkspaceEffectiveRewardStore | undefined {
  if (
    decision.normal.rewardStore.kind !== 'authoredBaseStore' ||
    decision.normal.rewardStore.baseRewardStoreKey === null
  ) {
    return undefined;
  }
  const resolvedStoreKey = evaluated?.batch.resolvedSharedRewardStoreKey;
  if (
    resolvedStoreKey === undefined ||
    resolvedStoreKey === decision.normal.rewardStore.baseRewardStoreKey
  ) {
    return undefined;
  }
  return Object.freeze({
    label: workspaceRewardStoreLabel(resolvedStoreKey),
    storeKey: resolvedStoreKey,
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
      message: 'Choose the reward pool first.',
    });
  }
  if (fieldsBatchOwnsOutcome && decision.normal.batchState === null) {
    return Object.freeze({
      kind: 'awaitingFieldsCageOutcome' as const,
      message: 'Choose the Fields door roll first.',
    });
  }
  return undefined;
}

/**
 * Candidate evaluation can be unavailable behind a retained prefix. This
 * engine-owned static domain keeps that authored-first allowance precise: it
 * permits only ordinary rooms whose exact `CreateTarget` command can succeed
 * at this physical target, without consulting evaluation coverage.
 */
function ordinaryTargetGameNames(
  input: WorkspaceDecisionAssemblyBaseInput,
  target: TargetAddress,
): readonly string[] {
  const topology = input.source.plan.topology;
  if (topology === null) return Object.freeze([]);
  return Object.freeze(
    input.catalog.rooms.values.flatMap((room) =>
      ordinaryTargetAuthoringEligibility(
        input.catalog,
        input.source.layout,
        topology,
        target,
        room.gameName,
      ).kind === 'authorable'
        ? [room.gameName]
        : [],
    ),
  );
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

function takeoverGameNames(catalog: Catalog, biomeKey: string): readonly string[] {
  return Object.freeze(
    catalog.rooms.values
      .filter((room) => room.roomSetKey === biomeKey && workspaceRoomTakesOverNormalDoors(room))
      .map((room) => room.gameName),
  );
}

function projectAuthoredTargetWithOverlay(
  input: WorkspaceDecisionAssemblyBaseInput,
  decision: AuthoredBatchDecision,
  target: AuthoredBatchTarget,
  fieldsFacts: FieldsBatchFacts | undefined,
  physical: readonly DeclaredPhysicalExit[],
  sourceDecisionRemoval: WorkspaceStageDecisionRemoval | undefined,
  evaluatedTarget: CanonicalTarget | undefined,
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
  const physicalState =
    evaluatedTarget?.exit.kind ??
    (declaredExit === undefined ? ('unavailable' as const) : ('available' as const));
  const fallbackContinuation: WorkspacePhysicalTarget['nextPath'] = targetContinuation(
    selected,
    requireWorkspaceRoom(input.catalog, occurrence.gameName).kind,
  );
  const markerForTarget = input.markerDestinations.marker(address);
  const anomalyTakeoverAvailable =
    input.source.evaluation !== undefined && 'roomGeneration' in input.source.evaluation
      ? input.source.evaluation.roomGeneration.ordinary.anomalyTakeovers.some(
          (support) =>
            semanticAddressKey(support.origin) === semanticAddressKey(address) &&
            support.selectedPossible,
        )
      : false;
  const occurrenceAssembly = input.assembleOccurrence(
    Object.freeze({
      ...(evaluatedTarget === undefined ? {} : { evaluatedRoom: evaluatedTarget.room }),
      ...(fieldsFacts === undefined ? {} : { fieldsBatchFacts: fieldsFacts }),
      occurrence,
    }),
  );
  const node = Object.freeze({
    ...occurrenceAssembly.node,
    ...(sourceDecisionRemoval === undefined ? {} : { sourceDecisionRemoval }),
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
      exitKey: target.exitKey,
      index:
        evaluatedTarget?.exit.index ??
        declaredExit?.index ??
        requiredNormalExitOrdinal(target.exitKey),
      marker: markerForTarget,
      physicalState,
      selected,
      retained: evaluatedTarget === undefined || physicalState === 'unavailable',
      nextPath: evaluatedTarget?.continuation ?? fallbackContinuation,
      room: node.room,
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
  for (const exit of orderedPhysical) {
    const target = targetsByExit.get(exit.exitKey);
    if (target !== undefined) {
      controls.push(
        Object.freeze({
          address: createTargetAddress(input.source.biome, decision.source, target.exitKey),
          kind: 'targetRoomPicker' as const,
          target: Object.freeze({
            kind: 'existing' as const,
            occurrence: target.room.address,
            selectedGameName: target.room.gameName,
          }),
        }),
      );
      continue;
    }
    const missing = missingByExit.get(exit.exitKey);
    if (emptyNormalDecision && exit.exitKey === firstPhysicalExitKey && missing !== undefined) {
      const address = createTargetAddress(input.source.biome, decision.source, missing.exitKey);
      controls.push(
        Object.freeze({
          address,
          decisionOwner,
          kind: 'decisionEntryRoomPicker' as const,
          ordinaryTargetAuthoring: missing.authoring,
          ordinaryTargetGameNames: ordinaryTargetGameNames(input, address),
          takeoverGameNames:
            input.source.layout.progression.kind === 'generated'
              ? takeoverGameNames(input.catalog, input.source.plan.biomeKey)
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
    decision.selection.kind === 'derived' && batch.zagreusContract === undefined
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
  if (
    exitSelection === undefined &&
    rewardStore === undefined &&
    fieldsCageOutcome === undefined &&
    zagreusContract === undefined
  ) {
    return Object.freeze([]);
  }
  return Object.freeze([
    Object.freeze({
      ...(exitSelection === undefined ? {} : { exitSelection }),
      ...(fieldsCageOutcome === undefined ? {} : { fieldsCageOutcome }),
      kind: 'batchControls' as const,
      owner: batch.owner,
      ...(rewardStore === undefined ? {} : { rewardStore }),
      ...(zagreusContract === undefined ? {} : { zagreusContract }),
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
  for (const additional of evaluated?.batch.additional ?? []) {
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
  // Evaluation may clamp away the target whose cage needs repair. Activation
  // remains a fact of the complete authored batch, not overlay membership.
  const authoredFieldsFacts = fieldsBatchFacts(
    input.catalog,
    source.layout,
    source.occurrence,
    decision,
  );
  const sourceDecisionRemoval =
    kind === 'takeoverBatch' && decision.source.kind === 'hubDecision'
      ? hubStageDecisionRemoval(input, owner)
      : undefined;
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
        sourceDecisionRemoval,
        overlay,
      );
    });
  if (evaluatedTargets.size > 0) {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner)} has evaluated targets with no authored target`,
    );
  }
  const targets = projectedTargets.map((value) => value.target);
  const missingTargets = missingTargetsForPhysicalExits(
    input,
    decision.source,
    physical,
    new Set(decision.normal.targets.map((target) => target.exitKey)),
    missingTargetPrerequisite(input, decision, fieldsBatchOwnsOutcome),
  );
  const targetRoomControls = roomControlsForBatch(
    input,
    decision,
    kind,
    physical,
    targets,
    missingTargets,
  );
  const repairIntent = batchRepairIntentForUnavailableTargets(
    owner,
    kind,
    new Set(
      targets
        .filter((target) => target.physicalState === 'unavailable')
        .map((target) => target.room.occurrenceId),
    ),
  );
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
  const effectiveRewardStore = effectiveRewardStoreForBatch(decision, evaluated);
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
            selected:
              decision.selection.kind === 'additional' &&
              decision.selection.additionalExitKey === zagreusAdditional.key,
            assembly: contractAssembly,
          });
        })();
  const base = {
    batchState: decision.normal.batchState,
    ...(effectiveRewardStore === undefined ? {} : { effectiveRewardStore }),
    ...(fieldsCageOutcome === undefined ? {} : { fieldsCageOutcome }),
    ...(fields === undefined ? {} : { fields }),
    ...(zagreusContract === undefined
      ? {}
      : {
          zagreusContract: Object.freeze({
            contractRoom: zagreusContract.contractRoom,
            marker: zagreusContract.marker,
            owner: zagreusContract.owner,
            selected: zagreusContract.selected,
          }),
        }),
    ...(input.hubTakeover === undefined
      ? {}
      : {
          hubTakeover: Object.freeze({
            interactionKey: input.hubTakeover.interactionKey,
            marker: input.markerDestinations.marker(input.hubTakeover.owner),
          }),
        }),
    key: `batch:${semanticAddressKey(owner)}`,
    marker: input.markerDestinations.marker(owner),
    missingTargets,
    owner,
    ...(repairIntent === undefined ? {} : { repairIntent }),
    ...(hasEditableAuthoredRewardStore
      ? {
          rewardStore: input.markerDestinations.marker(
            createBatchRewardStoreAddress(source.biome, decision.source),
          ),
        }
      : {}),
    selection: input.markerDestinations.marker(
      createExitSelectionAddress(source.biome, decision.source),
    ),
    source: decision.source,
    targets: Object.freeze(targets),
    topologyState: topologyStateForAuthoredBatch(input, owner, evaluated),
  } as const;
  const batch: WorkspaceDecisionBatchNode =
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
  redirectDecisionFocus(input.markerDestinations, batch);
  if (sourceDecisionRemoval !== undefined) {
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
    ]),
    roomControls: Object.freeze([
      ...projectedTargets.flatMap((target) => target.roomControls),
      ...targetRoomControls,
    ]),
    rewardControls: Object.freeze([
      ...projectedTargets.flatMap((target) => target.rewardControls),
      ...(zagreusContract === undefined ? [] : zagreusContract.assembly.rewardControls),
    ]),
    workbenches: Object.freeze(projectedTargets.map((target) => target.node)),
  });
}

export function assembleWorkspaceDecision(
  input: WorkspaceDecisionAssemblyInput,
): WorkspaceDecisionAssembly {
  return assembleBatchDecision(input);
}
