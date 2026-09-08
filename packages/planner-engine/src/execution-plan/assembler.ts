import { assertExactProjectEvaluationAssembly } from '../simulation/project-evaluation-assembly';
import type { RunStateSnapshot } from '../simulation/rewards/run-state';
import {
  EXECUTION_CATALOG_VERSION,
  type ExecutionConfiguredExtent,
  type ExecutionSemanticProduct,
} from './model';
import { ExecutionCompilerError as CompilerError } from './assembler-errors';
import { executionKeepsakeEquipResults } from './assembly/overview';
import {
  completeExecutionBiomes,
  executionBatchesByRoom,
  executionFixedTargetsByRoom,
  executionRoomSnapshots,
  orderedExecutionRooms,
  executionHubs,
} from './assembly/route';
import { hubBySource, hubExitByRoom } from './assembly/hub';
import { executionRoomOwnerKey } from './assembly/support';
import { executionOccurrence } from './assembly/occurrence';
import { validateExecutionProduct } from './assembly/validation';
import { executionTimelineTransactions } from './assembly/timeline-transactions';
import { executionStartingLoadout } from './assembly/loadout';
import { semanticAddressKey } from '../authored-project/addresses';
import {
  EMPTY_PLANNER_TIMELINE_FACTS,
  mergePlannerTimelineFacts,
} from '../simulation/timeline-facts';
import { deriveRoomExitConformanceDeltas } from '../simulation/rewards/run-state-conformance';

export function assembleExecutionProduct({
  assembly,
}: import('./model').ExecutionAssemblerInput): ExecutionSemanticProduct {
  assertExactProjectEvaluationAssembly(assembly);
  const { evaluation } = assembly;
  if (evaluation.catalogVersion !== EXECUTION_CATALOG_VERSION) {
    throw new CompilerError('unsupportedExtent', 'execution catalog version is unsupported');
  }
  const routeKey = evaluation.route.routeKey;
  if (routeKey !== 'Underworld' && routeKey !== 'Surface')
    throw new CompilerError(
      'unsupportedRoute',
      'execution supports only Underworld or Surface routes',
    );
  const keys = evaluation.route.configuredBiomeKeys;
  const invalidUnderworldPrefix =
    !(keys.length === 1 && keys[0] === 'F') &&
    !(keys.length === 2 && keys[0] === 'F' && keys[1] === 'G') &&
    !(keys.length === 3 && keys[0] === 'F' && keys[1] === 'G' && keys[2] === 'H') &&
    !(
      keys.length === 4 &&
      keys[0] === 'F' &&
      keys[1] === 'G' &&
      keys[2] === 'H' &&
      keys[3] === 'I'
    );
  const invalidSurfacePrefix =
    !(keys.length === 1 && keys[0] === 'N') &&
    !(keys.length === 2 && keys[0] === 'N' && keys[1] === 'O') &&
    !(keys.length === 3 && keys[0] === 'N' && keys[1] === 'O' && keys[2] === 'P') &&
    !(
      keys.length === 4 &&
      keys[0] === 'N' &&
      keys[1] === 'O' &&
      keys[2] === 'P' &&
      keys[3] === 'Q'
    );
  if (
    (routeKey === 'Underworld' && invalidUnderworldPrefix) ||
    (routeKey === 'Surface' && invalidSurfacePrefix)
  ) {
    throw new CompilerError(
      'unsupportedExtent',
      'execution supports only configured Underworld or Surface prefixes',
    );
  }
  const biomes = completeExecutionBiomes(assembly);
  const rooms = orderedExecutionRooms(biomes);
  if (rooms.length === 0 || rooms.length > 256) {
    throw new CompilerError('openingMissing', 'execution route has no bounded room product');
  }
  const selectedOccurrenceIds = Object.freeze(
    biomes.flatMap((biome) =>
      biome.history.rooms.flatMap((view) =>
        view.origin.kind === 'occurrence' ? [view.origin.occurrenceId] : [],
      ),
    ),
  );
  const selectedOccurrenceIdSet = new Set(selectedOccurrenceIds);
  if (selectedOccurrenceIds.length === 0 || selectedOccurrenceIds[0] !== rooms[0]!.occurrenceId) {
    throw new CompilerError('openingMissing', 'execution route has no selected opening occurrence');
  }
  const batches = executionBatchesByRoom(biomes);
  const hubs = executionHubs(biomes);
  const hubsBySource = hubBySource(hubs);
  const hubExitsBySource = hubExitByRoom(
    hubs,
    biomes.flatMap((biome) =>
      biome.snapshot.decisions.filter(
        (decision): decision is import('../simulation/materialization').CanonicalBatch =>
          decision.kind === 'batch',
      ),
    ),
  );
  const localSlotsByParent = new Map(
    hubs.flatMap((hub) =>
      hub.visits.map((visit) => [visit.target.room.occurrenceId, visit.localSlots] as const),
    ),
  );
  const fixedTargets = executionFixedTargetsByRoom(biomes);
  const snapshots = new Map<string, RunStateSnapshot>();
  for (const biome of biomes) {
    for (const [key, value] of executionRoomSnapshots(biome)) snapshots.set(key, value);
  }
  const entryByBiome = new Map(
    biomes.map((biome) => [biome.biomeKey, biome.snapshot.entryRoom] as const),
  );
  const roomById = new Map(rooms.map((room) => [room.occurrenceId, room] as const));
  const roomExitConformance = deriveRoomExitConformanceDeltas(
    selectedOccurrenceIds.flatMap((id) => {
      const room = roomById.get(id);
      return room === undefined ? [] : [room.origin];
    }),
    snapshots,
  );
  const timelineInputs = rooms.map((room) => {
    const biome = biomes.find((candidate) => candidate.biomeKey === room.origin.biomeKey);
    if (biome === undefined) {
      throw new CompilerError(
        'executionCoverageMissing',
        `${room.gameName} has no complete-valid biome evaluation`,
      );
    }
    const allFacts = mergePlannerTimelineFacts(
      room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
      biome.rewards.timelineFacts,
    );
    // Publication is the planner-owned semantic boundary: only nodes marked
    // included by the reward fold become execution transactions.  Generic
    // relation assembly receives the already-filtered product below.
    const transactions = executionTimelineTransactions(room, biome, allFacts);
    const transactionOwners = new Set(transactions.map((transaction) => transaction.owner));
    const facts = Object.freeze({
      nodes: Object.freeze(
        allFacts.nodes.filter((node) => transactionOwners.has(semanticAddressKey(node.owner))),
      ),
      dependencies: Object.freeze(
        allFacts.dependencies.filter(
          (dependency) =>
            transactionOwners.has(semanticAddressKey(dependency.owner)) &&
            transactionOwners.has(semanticAddressKey(dependency.afterOwner)),
        ),
      ),
    });
    const nodes = new Map(
      facts.nodes.map((node) => [semanticAddressKey(node.owner), node] as const),
    );
    for (const owner of transactionOwners) {
      if (!nodes.has(owner))
        throw new CompilerError(
          'executionCoverageMissing',
          `missing planner timeline node ${owner}`,
        );
    }
    return Object.freeze({
      room,
      biome,
      transactions,
      facts,
    });
  });
  const occurrences = timelineInputs.map(({ room, biome, transactions, facts }) => {
    const index = keys.indexOf(room.origin.biomeKey);
    const nextBiomeKey = index >= 0 ? keys[index + 1] : undefined;
    const crossBiomeTarget =
      nextBiomeKey !== undefined && room.gameName === `${room.origin.biomeKey}_PostBoss01`
        ? entryByBiome.get(nextBiomeKey)
        : undefined;
    const crossBiomeSourceId =
      crossBiomeTarget === undefined ? undefined : executionRoomOwnerKey(room);
    return executionOccurrence(
      room,
      snapshots,
      batches,
      fixedTargets,
      crossBiomeTarget,
      crossBiomeSourceId,
      biome,
      transactions,
      facts,
      roomExitConformance.get(room.occurrenceId),
      hubsBySource.get(executionRoomOwnerKey(room)),
      hubExitsBySource.get(executionRoomOwnerKey(room)),
      localSlotsByParent.get(room.occurrenceId),
      room.roomKind === 'PostBoss' && selectedOccurrenceIdSet.has(room.occurrenceId)
        ? 'postbossEntry'
        : undefined,
    );
  });
  const extent = Object.freeze({
    kind: 'configuredPrefix' as const,
    biomeKeys: Object.freeze([...keys]),
    terminalBiomeKey: keys[keys.length - 1],
  }) as ExecutionConfiguredExtent;
  const startingEquipResults = executionKeepsakeEquipResults(
    assembly.project.route.loadout.keepsakeEquipResults,
  );
  // Route-start state is the first captured snapshot, before any selected
  // room's rewards can mutate the loadout-derived ledgers.
  const openingSnapshot = biomes[0]!.rewards.runStateSnapshots[0];
  const startingLoadout = executionStartingLoadout(assembly, openingSnapshot);
  const resources = evaluation.route.resources;
  const product = Object.freeze({
    catalogVersion: evaluation.catalogVersion,
    projectId: evaluation.projectId,
    routeKey,
    startingLoadout,
    startingKeepsake: Object.freeze({
      keepsakeKey: assembly.project.route.loadout.startingKeepsakeKey,
      ...(startingEquipResults === undefined ? {} : { equipResults: startingEquipResults }),
    }),
    extent,
    selectedOccurrenceIds,
    resources,
    occurrences: Object.freeze(occurrences),
  });
  validateExecutionProduct(product);
  return product;
}
