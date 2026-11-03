import { semanticAddressKey, type HubDecisionAddress } from '../../authored-project/addresses';
import type { RunStateOwner, RunStateSnapshot } from '../rewards/run-state';
import type { BiomeRewardSimulation } from '../rewards/model';
import type { ProjectEvaluationAssembly } from './evaluation-products';

const snapshotsByRewards = new WeakMap<
  BiomeRewardSimulation,
  ReadonlyMap<string, RunStateSnapshot>
>();

function publishedSnapshots(rewards: BiomeRewardSimulation): ReadonlyMap<string, RunStateSnapshot> {
  let snapshots = snapshotsByRewards.get(rewards);
  if (snapshots === undefined) {
    snapshots = new Map(
      rewards.runStateSnapshots.map((snapshot) => [semanticAddressKey(snapshot.owner), snapshot]),
    );
    snapshotsByRewards.set(rewards, snapshots);
  }
  return snapshots;
}

/**
 * The Run State snapshot the evaluation published at one checkpoint, or
 * undefined when coverage did not reach it.
 */
export function runStateSnapshotForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  owner: RunStateOwner,
): RunStateSnapshot | undefined {
  if (owner.routeKey !== assembly.project.route.routeKey) return undefined;
  const biome = assembly.evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === owner.biomeKey,
  );
  if (biome === undefined || !('rewards' in biome)) return undefined;
  return publishedSnapshots(biome.rewards).get(semanticAddressKey(owner));
}

/**
 * The Run State the evaluation captured as the Hub was left after
 * `precedingVisitCount` completed visits, or undefined when coverage did not
 * reach that departure.
 */
export function hubDepartureSnapshotForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  hub: HubDecisionAddress,
  precedingVisitCount: number,
): RunStateSnapshot | undefined {
  if (hub.routeKey !== assembly.project.route.routeKey) return undefined;
  const biome = assembly.evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === hub.biomeKey,
  );
  if (biome === undefined || !('rewards' in biome)) return undefined;
  const key = semanticAddressKey(hub);
  return biome.rewards.hubDepartures.find(
    (departure) =>
      departure.precedingVisitCount === precedingVisitCount &&
      semanticAddressKey(departure.hub) === key,
  )?.departure;
}
