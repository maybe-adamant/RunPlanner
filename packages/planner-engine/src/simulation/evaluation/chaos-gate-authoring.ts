import type { AdditionalExitAddress } from '../../authored-project/addresses';
import { chaosGateSpawnPointIndices } from '../../authored-project/chaos-gate-position';
import type { Catalog } from '../../catalog-schema';
import type { ProjectEvaluationAssembly } from './evaluation-products';

/** An authored Chaos gate's spawn point in its source room, with the points it can take. */
export interface ChaosGatePositionAuthoring {
  /** The stored one-based `SecretPoint` index; settlement stores one once the room is reached. */
  readonly spawnPointIndex?: number;
  /** Every point the source room offers a gate. */
  readonly spawnPointIndices: readonly number[];
}

/**
 * Where the authored Chaos gate spawns; undefined while the source room holds
 * no gate or offers it no point. Static: it reads authorship and the room, not
 * a reached state.
 */
export function chaosGatePositionForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  gate: AdditionalExitAddress,
): ChaosGatePositionAuthoring | undefined {
  const project = assembly.project;
  if (gate.routeKey !== project.route.routeKey) return undefined;
  const source = project.route.biomes
    .find((plan) => plan.biomeKey === gate.biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === gate.occurrenceId);
  const authored = source?.additionalExits.find(
    (exit) => exit.kind === 'chaos' && exit.key === gate.additionalExitKey,
  );
  const room = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
  if (authored?.kind !== 'chaos' || room === undefined) return undefined;
  const spawnPointIndices = chaosGateSpawnPointIndices(room);
  if (spawnPointIndices.length === 0) return undefined;
  return Object.freeze({
    ...(authored.spawnPointIndex === undefined
      ? {}
      : { spawnPointIndex: authored.spawnPointIndex }),
    spawnPointIndices,
  });
}
