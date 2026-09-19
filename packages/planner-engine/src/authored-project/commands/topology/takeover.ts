import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import { createInitialBatchRewardStore } from '../../batchState';
import type { ExitDecisionSourceAddress } from '../../addresses';
import type {
  BiomeTopology,
  ExitDecision,
  ExitSelection,
  FixedRoomLink,
  HubDecision,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../../model';
import { fixedCompletionOccurrenceId, fixedRoomLink } from '../../fixed-room-links';
import type { RoomOccurrenceRole } from '../../room-state/declaration';
import { resolveCompletionBoss } from '../../completion-boss';
import {
  additionalExitsForDecision,
  exitDecisionForSource,
  hubDecisionHandoffReadiness,
  normalDecisionProgressionForLayout,
  selectedExitKey,
} from '../../topology/query';
import { applyTopologyRemovalImpact, describeTopologyRemovalImpact } from '../../topology/impact';
import { sameExitDecisionSource } from '../../topology/source-identity';
import { failCommand, requireRoom, requireTopology, type LocatedBiome } from '../contract';
import type { TopologyCommand } from '../types';
import {
  sourceFromAddress,
  exitKeysForSource,
  sourceRoom,
  appendDecision,
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
  return owner?.normal.kind === 'batch' ? resolvedStoreKey(owner.normal.rewardStore) : undefined;
}

function prebossFreeRewardStore(
  room: RoomDeclaration,
  incomingStore: string | undefined,
): string | undefined {
  return room.forcedRewardStoreKey ?? room.individualRewardStoreKey ?? incomingStore;
}

function compatiblePrebossOccurrence(
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  role: RoomOccurrenceRole,
  entryActive: boolean,
): boolean {
  if (occurrence.gameName !== room.gameName) return false;
  if (role !== 'prebossShop') return occurrence.state.kind === 'freeReward';
  return occurrence.state.kind === 'shop' && (occurrence.state.shop !== undefined) === entryActive;
}

function completionChainForSelection(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  prebossOccurrenceId: OccurrenceId,
  command: TopologyCommand,
): BiomeTopology {
  const preboss = topology.occurrences.find(
    (occurrence) => occurrence.occurrenceId === prebossOccurrenceId,
  );
  if (preboss === undefined) failCommand(command, 'selected Preboss occurrence is missing');
  const prebossRoom = requireRoom(catalog, preboss.gameName, located.layout.biomeKey, command);
  if (prebossRoom.kind !== 'Preboss') return topology;
  const bossOccurrenceId = fixedCompletionOccurrenceId(prebossOccurrenceId, 'boss');
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
          postbossOccurrenceId,
          'ordinary',
          true,
          undefined,
          located.loadout,
        );
  const fixedRoomLinks: FixedRoomLink[] = [fixedRoomLink(prebossOccurrenceId, bossOccurrenceId)];
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
  command: TopologyCommand,
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

export function replaceTakeoverBatch(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    TopologyCommand,
    { readonly kind: 'CreateTakeoverBatch' | 'ReplaceWithTakeoverBatch' | 'ReconcileTakeoverBatch' }
  >,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (
    (located.layout.progression.kind === 'hub' && command.decision.source.kind !== 'hubDecision') ||
    (located.layout.progression.kind === 'generated' &&
      command.decision.source.kind !== 'occurrence')
  ) {
    failCommand(command, 'takeover source does not match this progression');
  }
  if (command.decision.source.kind === 'hubDecision') {
    const hubSource = command.decision.source;
    if (located.layout.progression.kind !== 'hub') {
      failCommand(command, 'only a Hub progression has a completed-Hub exit');
    }
    const hub = topology.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === hubSource.decisionKey,
    );
    if (hubDecisionHandoffReadiness(located.layout.progression, hub).kind !== 'ready') {
      failCommand(
        command,
        'complete the declared Hub board and required visits before creating its Preboss batch',
      );
    }
  }
  const existing = exitDecisionForSource(topology, command.decision.source);
  if (command.kind === 'CreateTakeoverBatch' && existing !== undefined)
    failCommand(command, 'exit decision already exists');
  if (
    command.kind !== 'CreateTakeoverBatch' &&
    (existing === undefined || existing.normal.kind !== 'batch')
  )
    failCommand(command, 'normal-door batch does not exist');
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
  if (
    existing?.normal.kind === 'batch' &&
    existing.normal.targets.length === exitKeys.length &&
    existing.normal.targets.every(
      (target, index) =>
        target.exitKey === exitKeys[index] &&
        target.occurrenceId === ids[index] &&
        topology.occurrences.find((occurrence) => occurrence.occurrenceId === target.occurrenceId)
          ?.gameName === room.gameName,
    )
  ) {
    return document;
  }
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
        `takeover repair must retain ${target.exitKey} occurrence ${oldTarget.occurrenceId}`,
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
  const replacements = targets.map((target, index): RoomOccurrence => {
    const oldTarget = oldTargetByExitKey.get(target.exitKey);
    const role = expectedPrebossRole(room, index, command);
    const old = oldTarget === undefined ? undefined : occurrencesById.get(oldTarget.occurrenceId);
    const entryActive = target.exitKey === selectedTakeoverExitKey;
    return old !== undefined && compatiblePrebossOccurrence(old, room, role, entryActive)
      ? old
      : defaultOccurrence(
          catalog,
          room,
          target.occurrenceId,
          role,
          entryActive,
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
  let next = Object.freeze({
    ...withoutOld,
    occurrences: Object.freeze([
      ...retainedOccurrences,
      ...replacements.filter(
        (replacement) =>
          !retainedOccurrences.some(
            (occurrence) => occurrence.occurrenceId === replacement.occurrenceId,
          ),
      ),
    ]),
  });
  for (const oldTarget of oldTargets) {
    next = removeCompletionChainForSelection(next, oldTarget.occurrenceId);
  }
  const withDecision = appendDecision(next, decision);
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
