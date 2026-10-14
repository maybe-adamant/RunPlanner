import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import { createInitialBatchRewardStore } from '../../batchState';
import { createOccurrenceId, type ExitDecisionSourceAddress } from '../../addresses';
import type {
  BiomeTopology,
  ExitDecision,
  ExitSelection,
  ExitTargetReference,
  FixedRoomLink,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../../model';
import { fixedCompletionOccurrenceId, fixedRoomLink } from '../../fixed-room-links';
import { resolveCompletionBoss } from '../../completion-boss';
import {
  additionalExitsForDecision,
  batchTakesOverNormalDoors,
  bossDeclarationTakesAuthoredRewardStore,
  bossDoorRewardStoreKeysForLayout,
  exitDecisionForSource,
  normalDecisionProgressionForLayout,
  selectedExitKey,
  selectedExitTarget,
  takeoverPrebossDeclarationForBatch,
  takeoverPrebossFillsDeclaredExits,
} from '../../topology/query';
import { applyTopologyRemovalImpact, describeTopologyRemovalImpact } from '../../topology/impact';
import { sameExitDecisionSource } from '../../topology/source-identity';
import { failCommand, requireRoom, requireTopology, type LocatedBiome } from '../contract';
import type { RouteDetourCommand, TopologyCommand } from '../types';
import { reconcileNormalTargetEntryStates } from '../selection-state';
import {
  sourceFromAddress,
  exitKeysForSource,
  exitKeysForTopologySource,
  sourceRoom,
  appendDecision,
  replaceDecision,
  resolvedStoreKey,
  expectedPrebossRole,
  updateTopology,
} from './construction';
import { defaultOccurrence } from '../../topology/construction';

/**
 * A target may only own a subsequent decision while it remains on the selected
 * spine. Structural replacement and capacity repair remove that downstream
 * subtree explicitly; no command leaves a now-dead target as a decision source.
 */
function removeDownstreamDecisions(
  topology: BiomeTopology,
  sourceOccurrenceIds: ReadonlySet<OccurrenceId>,
): BiomeTopology {
  return applyTopologyRemovalImpact(
    topology,
    describeTopologyRemovalImpact(topology, sourceOccurrenceIds),
  );
}

function sourceIncomingStore(
  topology: BiomeTopology,
  source: ExitDecisionSourceAddress,
): string | undefined {
  if (source.kind !== 'occurrence') return undefined;
  const owner = topology.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.kind === 'batch' &&
      decision.normal.targets.some((target) => target.occurrenceId === source.occurrenceId),
  );
  return owner?.normal.kind === 'batch'
    ? resolvedStoreKey(owner.normal.rewardStore, topology, owner.source)
    : undefined;
}

function prebossFreeRewardStore(
  room: RoomDeclaration,
  incomingStore: string | undefined,
): string | undefined {
  return room.individualRewardStoreKey ?? room.forcedRewardStoreKey ?? incomingStore;
}

function completionChainForSelection(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  prebossOccurrenceId: OccurrenceId,
  command: TopologyCommand | RouteDetourCommand,
): BiomeTopology {
  const preboss = topology.occurrences.find(
    (occurrence) => occurrence.occurrenceId === prebossOccurrenceId,
  );
  if (preboss === undefined) failCommand(command, 'selected Preboss occurrence is missing');
  const prebossRoom = requireRoom(catalog, preboss.gameName, located.layout.biomeKey, command);
  if (prebossRoom.kind !== 'Preboss') return topology;
  const bossOccurrenceId = fixedCompletionOccurrenceId(prebossOccurrenceId, 'boss');
  // An authored boss-door store survives reconstruction. The key bound is per
  // layout, not per boss room, so a store chosen before the chain was rebuilt
  // stays legal and must not be silently discarded — but whether the door takes
  // a store at all is the NEW boss declaration's call, so the preserved key is
  // re-checked against it below before it is written back.
  const preservedStoreKey = topology.fixedRoomLinks.find(
    (link) => link.sourceOccurrenceId === prebossOccurrenceId,
  )?.rewardStoreKey;
  if (
    topology.fixedRoomLinks.some(
      (link) =>
        link.sourceOccurrenceId === prebossOccurrenceId &&
        link.targetOccurrenceId === bossOccurrenceId,
    )
  ) {
    return topology;
  }
  const bossRoom = resolveCompletionBoss(
    catalog,
    located.routePosition,
    located.loadout.fearRanks.BossDifficultyShrineUpgrade ?? 0,
  );
  const postbossGameName = located.routePosition.completion.postbossRoomGameName;
  const postbossRoom =
    postbossGameName === null ? undefined : catalog.rooms.byKey[postbossGameName];
  if (postbossGameName !== null && postbossRoom === undefined) {
    failCommand(command, `unknown PostBoss room ${postbossGameName}`);
  }
  if (postbossRoom !== undefined && postbossRoom.kind !== 'PostBoss') {
    failCommand(command, `${postbossGameName} is not a PostBoss room`);
  }
  const postbossOccurrenceId = fixedCompletionOccurrenceId(prebossOccurrenceId, 'postboss');
  const chainIds = new Set<OccurrenceId>([
    bossOccurrenceId,
    ...(postbossRoom === undefined ? [] : [postbossOccurrenceId]),
  ]);
  const withoutOldChain = Object.freeze({
    ...topology,
    occurrences: Object.freeze(
      topology.occurrences.filter((occurrence) => !chainIds.has(occurrence.occurrenceId)),
    ),
    fixedRoomLinks: Object.freeze(
      topology.fixedRoomLinks.filter(
        (link) => !chainIds.has(link.sourceOccurrenceId) && !chainIds.has(link.targetOccurrenceId),
      ),
    ),
  });
  const boss = defaultOccurrence(
    catalog,
    bossRoom,
    located.routeKey,
    bossOccurrenceId,
    'ordinary',
    true,
    undefined,
    located.loadout,
  );
  const postboss =
    postbossRoom === undefined
      ? undefined
      : defaultOccurrence(
          catalog,
          postbossRoom,
          located.routeKey,
          postbossOccurrenceId,
          'ordinary',
          true,
          undefined,
          located.loadout,
        );
  // A Rivals swap can replace the boss with one that pins or forgoes its
  // entered store; such a door takes no authored key, so the preserved one is
  // dropped rather than carried onto a boss the command would refuse.
  const authoredBossStoreKey = bossDeclarationTakesAuthoredRewardStore(bossRoom)
    ? preservedStoreKey
    : undefined;
  const fixedRoomLinks: FixedRoomLink[] = [
    fixedRoomLink(prebossOccurrenceId, bossOccurrenceId, authoredBossStoreKey),
  ];
  if (postboss !== undefined)
    fixedRoomLinks.push(fixedRoomLink(bossOccurrenceId, postbossOccurrenceId));
  return Object.freeze({
    ...withoutOldChain,
    occurrences: Object.freeze([
      ...withoutOldChain.occurrences,
      boss,
      ...(postboss === undefined ? [] : [postboss]),
    ]),
    fixedRoomLinks: Object.freeze([...withoutOldChain.fixedRoomLinks, ...fixedRoomLinks]),
  });
}

/**
 * Writes the authored store on the Preboss -> Boss door. The boss door is an
 * ordinary door in native, so this mirrors `replaceBatchRewardStore`: it is
 * addressed by the same `BatchRewardStoreAddress` the completeness finding
 * raises, and it refuses any key the door's policy does not offer. The bound
 * comes from `bossDoorRewardStoreKeysForLayout`, the single authority the
 * decoder shares, so the UI and a hand-edited document agree.
 */
export function replaceBossDoorRewardStore(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'ReplaceBossDoorRewardStore' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const source = command.rewardStore.source;
  if (source.kind !== 'occurrence') {
    failCommand(command, 'boss-door reward store is addressed by its Preboss occurrence');
  }
  const link = topology.fixedRoomLinks.find(
    (candidate) => candidate.sourceOccurrenceId === source.occurrenceId,
  );
  if (link === undefined) failCommand(command, 'no fixed boss link for this Preboss');
  const boss = topology.occurrences.find(
    (occurrence) => occurrence.occurrenceId === link.targetOccurrenceId,
  );
  const bossRoom = boss === undefined ? undefined : catalog.rooms.byKey[boss.gameName];
  if (bossRoom === undefined || !bossDeclarationTakesAuthoredRewardStore(bossRoom)) {
    failCommand(command, 'this boss door does not take an authored reward store');
  }
  if (!bossDoorRewardStoreKeysForLayout(located.layout).includes(command.storeKey)) {
    failCommand(command, `${command.storeKey} is not available from this boss-door policy`);
  }
  if (link.rewardStoreKey === command.storeKey) return document;
  return updateTopology(
    document,
    located,
    Object.freeze({
      ...topology,
      fixedRoomLinks: Object.freeze(
        topology.fixedRoomLinks.map((candidate) =>
          candidate === link
            ? fixedRoomLink(link.sourceOccurrenceId, link.targetOccurrenceId, command.storeKey)
            : candidate,
        ),
      ),
    }),
  );
}

function removeCompletionChainForSelection(
  topology: BiomeTopology,
  prebossOccurrenceId: OccurrenceId,
): BiomeTopology {
  const chainIds = new Set<OccurrenceId>([
    fixedCompletionOccurrenceId(prebossOccurrenceId, 'boss'),
    fixedCompletionOccurrenceId(prebossOccurrenceId, 'postboss'),
  ]);
  return Object.freeze({
    ...topology,
    occurrences: Object.freeze(
      topology.occurrences.filter((occurrence) => !chainIds.has(occurrence.occurrenceId)),
    ),
    fixedRoomLinks: Object.freeze(
      topology.fixedRoomLinks.filter(
        (link) => !chainIds.has(link.sourceOccurrenceId) && !chainIds.has(link.targetOccurrenceId),
      ),
    ),
  });
}

export function reconcileCompletionChain(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  previousPrebossOccurrenceId: OccurrenceId | undefined,
  nextPrebossOccurrenceId: OccurrenceId | undefined,
  command: TopologyCommand | RouteDetourCommand,
): BiomeTopology {
  if (previousPrebossOccurrenceId === nextPrebossOccurrenceId) {
    if (nextPrebossOccurrenceId === undefined) return topology;
    const bossId = fixedCompletionOccurrenceId(nextPrebossOccurrenceId, 'boss');
    if (
      topology.fixedRoomLinks.some(
        (link) =>
          link.sourceOccurrenceId === nextPrebossOccurrenceId && link.targetOccurrenceId === bossId,
      )
    ) {
      return topology;
    }
  }
  let next = topology;
  if (previousPrebossOccurrenceId !== undefined) {
    next = removeCompletionChainForSelection(next, previousPrebossOccurrenceId);
  }
  if (nextPrebossOccurrenceId === undefined) return next;
  return completionChainForSelection(catalog, located, next, nextPrebossOccurrenceId, command);
}

/**
 * Appends a Hub's fixed completed-Hub exit: the width-one Preboss batch and,
 * through the fixed links, its Boss and route-position Postboss.
 */
export function appendCompletedHubChain(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  hubKey: string,
  prebossOccurrenceId: OccurrenceId,
  command: TopologyCommand,
): BiomeTopology {
  const progression = located.layout.progression;
  if (progression.kind !== 'hub' || progression.hubKey !== hubKey) {
    failCommand(command, 'only a Hub progression has a completed-Hub exit');
  }
  const room = requireRoom(
    catalog,
    progression.completedExit.roomGameName,
    located.layout.biomeKey,
    command,
  );
  if (located.routePosition.completion.prebossRoomGameName !== room.gameName)
    failCommand(command, `${room.gameName} is not this route position's declared Preboss`);
  const createdIds = [
    prebossOccurrenceId,
    fixedCompletionOccurrenceId(prebossOccurrenceId, 'boss'),
    fixedCompletionOccurrenceId(prebossOccurrenceId, 'postboss'),
  ];
  if (topology.occurrences.some((occurrence) => createdIds.includes(occurrence.occurrenceId))) {
    failCommand(
      command,
      `occurrence ${prebossOccurrenceId} or its completion chain already exists`,
    );
  }
  const decision: ExitDecision = Object.freeze({
    kind: 'exit',
    source: Object.freeze({ kind: 'hubDecision', decisionKey: hubKey }),
    normal: Object.freeze({
      kind: 'batch',
      rewardStore: createInitialBatchRewardStore(
        normalDecisionProgressionForLayout(located.layout) ??
          failCommand(command, 'layout has no normal-door decision policy'),
      ),
      batchState: null,
      targets: Object.freeze([
        Object.freeze({
          exitKey: progression.completedExit.exitKey,
          occurrenceId: prebossOccurrenceId,
        }),
      ]),
    }),
    selection: Object.freeze({ kind: 'derived' }),
  });
  const preboss = defaultOccurrence(
    catalog,
    room,
    located.routeKey,
    prebossOccurrenceId,
    expectedPrebossRole(room, 0, command),
    true,
    undefined,
    located.loadout,
  );
  const withPreboss = appendDecision(
    Object.freeze({
      ...topology,
      occurrences: Object.freeze([...topology.occurrences, preboss]),
    }),
    decision,
  );
  return completionChainForSelection(catalog, located, withPreboss, prebossOccurrenceId, command);
}

export function replaceTakeoverBatch(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    TopologyCommand,
    { readonly kind: 'CreateTakeoverBatch' | 'ReplaceWithTakeoverBatch' }
  >,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (command.decision.source.kind === 'hubDecision') {
    failCommand(command, 'the completed-Hub exit is created and removed only with its Hub');
  }
  if (located.layout.progression.kind !== 'generated') {
    failCommand(command, 'takeover source does not match this progression');
  }
  const existing = exitDecisionForSource(topology, command.decision.source);
  if (command.kind === 'CreateTakeoverBatch' && existing !== undefined)
    failCommand(command, 'exit decision already exists');
  if (
    command.kind !== 'CreateTakeoverBatch' &&
    (existing === undefined || existing.normal.kind !== 'batch')
  )
    failCommand(command, 'normal-door batch does not exist');
  if (existing !== undefined && batchTakesOverNormalDoors(catalog, topology, existing))
    failCommand(command, 'a takeover batch repairs through ReconcileBatchExitCapacity');
  const room = requireRoom(catalog, command.gameName, located.layout.biomeKey, command);
  if (room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors')
    failCommand(command, `${room.gameName} is not a takeover Preboss declaration`);
  if (located.routePosition.completion.prebossRoomGameName !== room.gameName)
    failCommand(command, `${room.gameName} is not this route position's declared Preboss`);
  const exitKeys = exitKeysForSource(catalog, located, command.decision.source, command);
  const supplied = Object.keys(command.targetOccurrenceIds);
  if (
    supplied.length !== exitKeys.length ||
    exitKeys.some((exitKey) => command.targetOccurrenceIds[exitKey] === undefined)
  ) {
    failCommand(
      command,
      'takeover batch must provide one occurrence ID for every declaration-owned normal exit',
    );
  }
  const ids = exitKeys.map((exitKey) => command.targetOccurrenceIds[exitKey] as OccurrenceId);
  if (new Set(ids).size !== ids.length)
    failCommand(command, 'takeover target occurrence IDs must be unique');
  if (room.prebossBatchPolicy.remainingOffers.kind === 'none' && ids.length !== 1)
    failCommand(command, `${room.gameName} cannot fill remaining normal exits`);
  const oldTargets = existing?.normal.kind === 'batch' ? existing.normal.targets : [];
  const occurrencesById = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const oldTargetByExitKey = new Map(oldTargets.map((target) => [target.exitKey, target]));
  const removed = new Set(oldTargets.map((target) => target.occurrenceId));
  const withoutDownstream = removeDownstreamDecisions(topology, removed);
  const retainedOccurrences = withoutDownstream.occurrences.filter(
    (occurrence) => !removed.has(occurrence.occurrenceId),
  );
  const selection: ExitSelection =
    ids.length === 1 &&
    (existing === undefined ? true : additionalExitsForDecision(topology, existing).length === 0)
      ? Object.freeze({ kind: 'derived' })
      : existing?.selection.kind === 'normal' && exitKeys.includes(existing.selection.exitKey)
        ? existing.selection
        : existing?.selection.kind === 'additional'
          ? existing.selection
          : Object.freeze({ kind: 'unresolved' });
  const targets = Object.freeze(
    exitKeys.map((exitKey, index) =>
      Object.freeze({ exitKey, occurrenceId: ids[index] as OccurrenceId }),
    ),
  );
  for (const target of targets) {
    const oldTarget = oldTargetByExitKey.get(target.exitKey);
    if (oldTarget !== undefined && target.occurrenceId !== oldTarget.occurrenceId) {
      failCommand(
        command,
        `takeover replacement must retain ${target.exitKey} occurrence ${oldTarget.occurrenceId}`,
      );
    }
    if (oldTarget === undefined && occurrencesById.has(target.occurrenceId)) {
      failCommand(command, `occurrence ${target.occurrenceId} is already structurally owned`);
    }
  }
  const sourceRoomValue = sourceRoom(catalog, located, command.decision.source, command);
  const decision: ExitDecision = Object.freeze({
    kind: 'exit',
    source: sourceFromAddress(command.decision.source),
    normal: Object.freeze({
      kind: 'batch',
      rewardStore:
        existing?.normal.kind === 'batch'
          ? existing.normal.rewardStore
          : createInitialBatchRewardStore(
              normalDecisionProgressionForLayout(located.layout) ??
                failCommand(command, 'layout has no normal-door decision policy'),
              sourceRoomValue?.mode.kind === 'authored'
                ? sourceRoomValue.mode.templateKey
                : undefined,
            ),
      batchState: null,
      targets,
    }),
    selection,
  });
  const selectedTakeoverExitKey = selectedExitKey(decision);
  // Replaced targets were ordinary rooms, so every takeover target starts from its default.
  const replacements = targets.map((target, index): RoomOccurrence => {
    const role = expectedPrebossRole(room, index, command);
    return defaultOccurrence(
      catalog,
      room,
      located.routeKey,
      target.occurrenceId,
      role,
      target.exitKey === selectedTakeoverExitKey,
      role === 'prebossFreeReward'
        ? prebossFreeRewardStore(room, sourceIncomingStore(topology, command.decision.source))
        : undefined,
      located.loadout,
    );
  });
  const withoutOld =
    existing === undefined
      ? withoutDownstream
      : Object.freeze({
          ...withoutDownstream,
          decisions: Object.freeze(
            withoutDownstream.decisions.filter(
              (candidate) =>
                candidate.kind !== 'exit' ||
                !sameExitDecisionSource(candidate.source, command.decision.source),
            ),
          ),
        });
  const withDecision = appendDecision(
    Object.freeze({
      ...withoutOld,
      occurrences: Object.freeze([...retainedOccurrences, ...replacements]),
    }),
    decision,
  );
  const selectedTarget =
    selectedTakeoverExitKey === undefined
      ? undefined
      : targets.find((target) => target.exitKey === selectedTakeoverExitKey)?.occurrenceId;
  const selectedRoom =
    selectedTarget === undefined
      ? undefined
      : withDecision.occurrences.find((occurrence) => occurrence.occurrenceId === selectedTarget);
  return updateTopology(
    document,
    located,
    selectedRoom !== undefined && catalog.rooms.byKey[selectedRoom.gameName]?.kind === 'Preboss'
      ? completionChainForSelection(
          catalog,
          located,
          withDecision,
          selectedRoom.occurrenceId,
          command,
        )
      : withDecision,
  );
}

/** A takeover door appended by exit repair; a door removed and re-added reuses it. */
function takeoverTargetOccurrenceId(
  sourceOccurrenceId: OccurrenceId,
  exitKey: string,
): OccurrenceId {
  return createOccurrenceId(`${sourceOccurrenceId}:${exitKey}`);
}

/**
 * `removeUndeclared` drops doors the source no longer declares;
 * `matchDeclared` also appends a default Preboss offer for each missing door.
 */
export type TakeoverExitReconciliation = 'removeUndeclared' | 'matchDeclared';

/**
 * Brings a takeover batch to its source's declared doors. Surviving doors keep
 * their occurrence, room-local state and completion chain; a removed door
 * takes its downstream topology with it. A removed selection falls back as
 * ordinary capacity repair does, and a newly selected door gains its chain.
 */
export function reconcileTakeoverBatchExits(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  decision: ExitDecision,
  reconciliation: TakeoverExitReconciliation,
  command: TopologyCommand | RouteDetourCommand,
): BiomeTopology {
  const source = decision.source;
  if (source.kind !== 'occurrence') {
    failCommand(command, 'the completed-Hub exit is created and removed only with its Hub');
  }
  const room = takeoverPrebossDeclarationForBatch(catalog, topology, decision);
  if (room?.prebossBatchPolicy?.kind !== 'takeOverNormalDoors') {
    failCommand(command, 'normal-door batch is not a takeover batch');
  }
  const declared = exitKeysForTopologySource(catalog, located, topology, source, command);
  const declaredKeys = new Set(declared);
  const removedIds = new Set(
    decision.normal.targets
      .filter((target) => !declaredKeys.has(target.exitKey))
      .map((target) => target.occurrenceId),
  );
  const authoredKeys = new Set(decision.normal.targets.map((target) => target.exitKey));
  const missing =
    reconciliation === 'matchDeclared'
      ? declared.filter((exitKey) => !authoredKeys.has(exitKey))
      : [];
  if (
    reconciliation === 'matchDeclared' &&
    !takeoverPrebossFillsDeclaredExits(room, declared.length)
  ) {
    failCommand(command, `${room.gameName} cannot fill remaining normal exits`);
  }
  if (removedIds.size === 0 && missing.length === 0) return topology;

  const withoutRemoved =
    removedIds.size === 0
      ? topology
      : applyTopologyRemovalImpact(topology, describeTopologyRemovalImpact(topology, removedIds));
  const takenIds = new Set(withoutRemoved.occurrences.map((occurrence) => occurrence.occurrenceId));
  const appended = missing.map((exitKey): ExitTargetReference => {
    const occurrenceId = takeoverTargetOccurrenceId(source.occurrenceId, exitKey);
    if (
      [
        occurrenceId,
        fixedCompletionOccurrenceId(occurrenceId, 'boss'),
        fixedCompletionOccurrenceId(occurrenceId, 'postboss'),
      ].some((id) => takenIds.has(id))
    ) {
      failCommand(command, `occurrence ${occurrenceId} is already structurally owned`);
    }
    return Object.freeze({ exitKey, occurrenceId });
  });
  // Declared exits are contiguous exit1..N, so a survivor keeps its index and
  // therefore its Shop or free-offer role.
  const targets = Object.freeze(
    declared.flatMap((exitKey) => {
      const target =
        decision.normal.targets.find((candidate) => candidate.exitKey === exitKey) ??
        appended.find((candidate) => candidate.exitKey === exitKey);
      return target === undefined ? [] : [target];
    }),
  );

  const previousSelected = selectedExitTarget(decision);
  const survivingSelected = targets.find(
    (target) => target.occurrenceId === previousSelected?.occurrenceId,
  );
  const additionalExits = additionalExitsForDecision(withoutRemoved, decision);
  const existingSelection = decision.selection;
  const selection: ExitSelection =
    targets.length === 1 && additionalExits.length === 0
      ? Object.freeze({ kind: 'derived' })
      : existingSelection.kind !== 'additional' && survivingSelected !== undefined
        ? Object.freeze({ kind: 'normal', exitKey: survivingSelected.exitKey })
        : existingSelection.kind === 'additional' &&
            additionalExits.some((exit) => exit.key === existingSelection.additionalExitKey)
          ? existingSelection
          : Object.freeze({ kind: 'unresolved' });
  const nextDecision: ExitDecision = Object.freeze({
    ...decision,
    normal: Object.freeze({ ...decision.normal, targets }),
    selection,
  });
  const nextSelectedExitKey = selectedExitKey(nextDecision);
  const incomingStore = sourceIncomingStore(withoutRemoved, source);
  const appendedOccurrences = appended.map((target) => {
    const role = expectedPrebossRole(room, targets.indexOf(target), command);
    return defaultOccurrence(
      catalog,
      room,
      located.routeKey,
      target.occurrenceId,
      role,
      target.exitKey === nextSelectedExitKey,
      role === 'prebossFreeReward' ? prebossFreeRewardStore(room, incomingStore) : undefined,
      located.loadout,
    );
  });
  const withTargets = replaceDecision(
    Object.freeze({
      ...withoutRemoved,
      occurrences: Object.freeze([...withoutRemoved.occurrences, ...appendedOccurrences]),
    }),
    nextDecision,
  );
  return reconcileCompletionChain(
    catalog,
    located,
    reconcileNormalTargetEntryStates(
      catalog,
      located,
      withTargets,
      nextDecision,
      nextSelectedExitKey,
      command,
    ),
    previousSelected?.occurrenceId,
    selectedExitTarget(nextDecision)?.occurrenceId,
    command,
  );
}
