import { catalog } from '@run-planner/hades2-catalog';
import { semanticAddressKey, type ProjectDocument } from '@run-planner/engine/authored-project';
import {
  composeBiomeHistory,
  evaluateBiomeCompleteness,
  evaluateBiomeRewards,
  evaluateBiomeRoomGeneration,
  materializeBiome,
} from '@run-planner/engine/simulation';

import {
  createFGenerationProject,
  fGenerationBiome,
  fGenerationTargetAddress,
  type FGenerationBatchSpec,
} from './f-generation-project';

export function fPlan(project: ProjectDocument) {
  const plan = project.route.biomes.find((biome) => biome.biomeKey === 'F');
  if (plan === undefined) throw new Error('missing F generation plan');
  return plan;
}

export function traitContext(project: ProjectDocument) {
  const route = project.route;
  if (route === undefined) throw new Error('fixture has no Underworld route');
  return route.loadout;
}

export function complete(project: ProjectDocument) {
  const result = evaluateBiomeCompleteness(catalog, fGenerationBiome, fPlan(project));
  if (result.completion !== 'complete') {
    throw new Error(`F generation fixture is incomplete: ${result.findings[0]?.code}`);
  }
  return result;
}

export function evaluate(project = createFGenerationProject()) {
  const snapshot = materializeBiome(
    catalog,
    fGenerationBiome,
    complete(project),
    traitContext(project),
  );
  const history = composeBiomeHistory(catalog, snapshot);
  const rewards = evaluateBiomeRewards(catalog, snapshot, history, 1, traitContext(project));
  return {
    snapshot,
    history,
    rewards,
    generation: evaluateBiomeRoomGeneration(catalog, snapshot, history, 1, rewards.targetHistory),
  };
}

export function pressure(
  result: ReturnType<typeof evaluate>,
  batches: readonly FGenerationBatchSpec[],
  batchIndex: number,
  exitIndex: number,
) {
  const target = fGenerationTargetAddress(batches, batchIndex, exitIndex);
  const entry = result.generation.ordinaryBatches
    .flatMap((batch) => batch.targets.map((target) => target.pressure))
    .find((candidate) => semanticAddressKey(candidate.targetOrigin) === semanticAddressKey(target));
  if (entry === undefined) {
    throw new Error(`missing pressure entry for batch ${batchIndex} exit ${exitIndex}`);
  }
  return entry;
}
