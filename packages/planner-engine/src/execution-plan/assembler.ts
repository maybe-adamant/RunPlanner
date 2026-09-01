import { assertExactProjectEvaluationAssembly } from '../simulation/project-evaluation-assembly';
import type { RunStateSnapshot } from '../simulation/rewards/run-state';
import { EXECUTION_CATALOG_VERSION, type ExecutionSemanticProduct } from './model';
import { ExecutionCompilerError as CompilerError } from './assembler-errors';
import { executionKeepsakeEquipResults } from './assembly/overview';
import {
  completeExecutionBiomes,
  executionBatchesByRoom,
  executionFixedTargetsByRoom,
  executionRoomSnapshots,
  orderedExecutionRooms,
} from './assembly/route';
import { executionRoomOwnerKey } from './assembly/support';
import { executionOccurrence } from './assembly/occurrence';
import { validateExecutionProduct } from './assembly/validation';
import { assembleWellRetainedEffects } from './assembly/timeline-relations';

export function assembleExecutionProduct({
  assembly,
}: import('./model').ExecutionAssemblerInput): ExecutionSemanticProduct {
  assertExactProjectEvaluationAssembly(assembly);
  const { evaluation } = assembly;
  if (evaluation.catalogVersion !== EXECUTION_CATALOG_VERSION) {
    throw new CompilerError('unsupportedExtent', 'execution catalog version is unsupported');
  }
  if (evaluation.route.routeKey !== 'Underworld') {
    throw new CompilerError('unsupportedRoute', 'F/G execution supports only the Underworld route');
  }
  const keys = evaluation.route.configuredBiomeKeys;
  if (
    !(keys.length === 1 && keys[0] === 'F') &&
    !(keys.length === 2 && keys[0] === 'F' && keys[1] === 'G')
  ) {
    throw new CompilerError(
      'unsupportedExtent',
      'execution supports only configured F or F/G prefixes',
    );
  }
  const biomes = completeExecutionBiomes(assembly);
  const rooms = orderedExecutionRooms(biomes);
  if (rooms.length === 0 || rooms.length > 256) {
    throw new CompilerError('openingMissing', 'execution route has no bounded room product');
  }
  const batches = executionBatchesByRoom(biomes);
  const fixedTargets = executionFixedTargetsByRoom(biomes);
  const snapshots = new Map<string, RunStateSnapshot>();
  for (const biome of biomes) {
    for (const [key, value] of executionRoomSnapshots(biome)) snapshots.set(key, value);
  }
  const entryByBiome = new Map(
    biomes.map((biome) => [biome.biomeKey, biome.snapshot.entryRoom] as const),
  );
  const occurrences = rooms.map((room) => {
    const index = keys.indexOf(room.origin.biomeKey);
    const nextBiomeKey = index >= 0 ? keys[index + 1] : undefined;
    const crossBiomeTarget =
      nextBiomeKey !== undefined && room.gameName === `${room.origin.biomeKey}_PostBoss01`
        ? entryByBiome.get(nextBiomeKey)
        : undefined;
    const crossBiomeSourceId =
      crossBiomeTarget === undefined ? undefined : executionRoomOwnerKey(room);
    const biome = biomes.find((candidate) => candidate.biomeKey === room.origin.biomeKey);
    if (biome === undefined) {
      throw new CompilerError(
        'executionCoverageMissing',
        `${room.gameName} has no complete-valid biome evaluation`,
      );
    }
    return executionOccurrence(
      room,
      snapshots,
      batches,
      fixedTargets,
      crossBiomeTarget,
      crossBiomeSourceId,
      biome,
    );
  });
  const extent = Object.freeze({
    kind: 'configuredPrefix' as const,
    biomeKeys: Object.freeze([...keys]) as readonly ['F'] | readonly ['F', 'G'],
    terminalBiomeKey: keys[keys.length - 1] as 'F' | 'G',
  });
  const startingEquipResults = executionKeepsakeEquipResults(
    assembly.project.route.loadout.keepsakeEquipResults,
  );
  const selectedOccurrenceIds = Object.freeze(
    biomes.flatMap((biome) =>
      biome.history.rooms.flatMap((view) =>
        view.origin.kind === 'occurrence' ? [view.origin.occurrenceId] : [],
      ),
    ),
  );
  if (selectedOccurrenceIds.length === 0 || selectedOccurrenceIds[0] !== rooms[0]!.occurrenceId) {
    throw new CompilerError('openingMissing', 'execution route has no selected opening occurrence');
  }
  const occurrenceById = new Map(
    occurrences.map((occurrence) => [occurrence.id, occurrence] as const),
  );
  const selectedOccurrences = selectedOccurrenceIds.map((id) => {
    const occurrence = occurrenceById.get(id);
    if (occurrence === undefined)
      throw new CompilerError('executionCoverageMissing', `selected occurrence ${id} is missing`);
    return occurrence;
  });
  const product = Object.freeze({
    catalogVersion: evaluation.catalogVersion,
    projectId: evaluation.projectId,
    routeKey: 'Underworld' as const,
    startingKeepsake: Object.freeze({
      keepsakeKey: assembly.project.route.loadout.startingKeepsakeKey,
      ...(startingEquipResults === undefined ? {} : { equipResults: startingEquipResults }),
    }),
    extent,
    selectedOccurrenceIds,
    occurrences: Object.freeze(occurrences),
    wellRetainedEffects: assembleWellRetainedEffects(selectedOccurrences),
  });
  validateExecutionProduct(product);
  return product;
}
