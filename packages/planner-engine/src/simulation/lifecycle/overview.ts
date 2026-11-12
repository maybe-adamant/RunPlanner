import type {
  Catalog,
  RoomDeclaration,
  RoomLifecycleOperation,
  RoomLifecycleProfile,
} from '../../catalog-schema';
import type { ProducerLifecyclePointKey } from '../../reward-kernel/model';
import { runsOneEncounter } from '../../authored-project/room-actions/event-graph';

/**
 * One step of a room's walk; every history event records the step it was
 * emitted under. The room's encounters run in the `encounters` step: a room
 * with one encounter slot ends it in its own `encounterEnds` step, while a
 * multi-encounter run interleaves its phases' ends with their rows in one step.
 */
export type RoomWalkStep =
  | { readonly kind: 'operation'; readonly operation: RoomLifecycleOperation }
  | { readonly kind: 'encounters' }
  | { readonly kind: 'encounterEnds' };

const overviewOperationKinds: ReadonlySet<RoomLifecycleOperation['kind']> = new Set([
  'prepareRoom',
  'materializeOfferPoint',
  'enterRoom',
]);

function advance(point: ProducerLifecyclePointKey): RoomLifecycleOperation {
  return Object.freeze({
    kind: 'advanceProducer' as const,
    point,
    effects: Object.freeze(['recordProducerPoint' as const]),
  });
}

/**
 * The producer points a room takes before its encounters run: the reward
 * before combat and the point any bound encounter's gate pickup is taken at.
 */
function pointsBeforeEncounters(
  catalog: Catalog,
  profile: RoomLifecycleProfile,
  declaration: RoomDeclaration,
): ReadonlySet<ProducerLifecyclePointKey> {
  if (profile.producer.kind === 'none') return new Set();
  const gateRoles = new Set(
    declaration.encounterSlotBindings
      .flatMap((binding) =>
        binding.kind === 'set'
          ? (catalog.encounterSets.byKey[binding.encounterSetKey]?.encounterDefinitionKeys ?? [])
          : [
              binding.encounterDefinitionKey,
              ...(binding.rivalsEncounterDefinitionKey === undefined
                ? []
                : [binding.rivalsEncounterDefinitionKey]),
              ...(binding.shadowEncounterDefinitionKey === undefined
                ? []
                : [binding.shadowEncounterDefinitionKey]),
            ],
      )
      .flatMap((key) => {
        const gate = catalog.encounterDefinitions.byKey[key]?.script.gate;
        return gate?.kind === 'useItemRole' ? [gate.role] : [];
      }),
  );
  const points = new Set<ProducerLifecyclePointKey>(
    profile.producer.points.filter((point) => point === 'beforeCombat'),
  );
  for (const key of profile.producer.lifecycleProfileKeys)
    for (const reward of catalog.rewards.producerLifecycles.byKey[key]?.rewardTypes.values ?? [])
      for (const binding of reward.acquisitionLifecycle)
        if (gateRoles.has(binding.role)) points.add(binding.lifecyclePoint);
  return points;
}

const caches = {
  producer: new WeakMap<RoomLifecycleProfile, WeakMap<RoomDeclaration, readonly RoomWalkStep[]>>(),
  none: new WeakMap<RoomLifecycleProfile, WeakMap<RoomDeclaration, readonly RoomWalkStep[]>>(),
};

/**
 * The room's walk: its profile's room-level steps with its encounters in place
 * of the script step. A room whose reward runs a producer takes its points: a
 * gate's pickup and the reward before combat precede the encounters, the rest
 * follow them and any pylon completion.
 */
export function roomWalkSteps(
  catalog: Catalog,
  profile: RoomLifecycleProfile,
  declaration: RoomDeclaration,
  producer: boolean,
): readonly RoomWalkStep[] {
  const cache = producer ? caches.producer : caches.none;
  let byDeclaration = cache.get(profile);
  if (byDeclaration === undefined) {
    byDeclaration = new WeakMap();
    cache.set(profile, byDeclaration);
  }
  const cached = byDeclaration.get(declaration);
  if (cached !== undefined) return cached;
  const envelope = catalog.encounterEnvelopes.byKey[declaration.encounterEnvelopeKey];
  const points = !producer || profile.producer.kind === 'none' ? [] : profile.producer.points;
  const beforeCombat = producer
    ? pointsBeforeEncounters(catalog, profile, declaration)
    : new Set<ProducerLifecyclePointKey>();
  const before = points.filter((point) => beforeCombat.has(point));
  const after = points.filter((point) => !before.includes(point));
  const operation = (value: RoomLifecycleOperation): RoomWalkStep =>
    Object.freeze({ kind: 'operation' as const, operation: value });
  const steps: RoomWalkStep[] = [];
  profile.steps.forEach((step, index) => {
    if (step.kind === 'runEncounterScripts') {
      steps.push(...before.map((point) => operation(advance(point))));
      if ((envelope?.slots.length ?? 0) > 0)
        steps.push(Object.freeze({ kind: 'encounters' as const }));
      // One encounter ends at its own step; a sequence ends each fight in turn.
      if (envelope !== undefined && runsOneEncounter(envelope))
        steps.push(Object.freeze({ kind: 'encounterEnds' as const }));
      if (profile.steps[index + 1]?.kind !== 'completeRequiredObjects')
        steps.push(...after.map((point) => operation(advance(point))));
      return;
    }
    steps.push(operation(step));
    if (step.kind === 'completeRequiredObjects')
      steps.push(...after.map((point) => operation(advance(point))));
  });
  const result = Object.freeze(steps);
  byDeclaration.set(declaration, result);
  return result;
}

/**
 * A room's Overview is its leading preparation, inventory and entry steps;
 * the Timeline starts at the first other step.
 */
export function roomOverviewStepCount(steps: readonly RoomWalkStep[]): number {
  const timelineStart = steps.findIndex(
    (step) => step.kind !== 'operation' || !overviewOperationKinds.has(step.operation.kind),
  );
  return timelineStart < 0 ? steps.length : timelineStart;
}
