import type {
  Catalog,
  RoomDeclaration,
  RoomLifecycleOperation,
  RoomLifecycleProfile,
} from '../../catalog-schema';
import type { ProducerLifecyclePointKey } from '../../reward-kernel/model';
import { producerPointsBeforeCombat } from '../../authored-project/room-actions/event-graph';

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

const cache = new WeakMap<
  RoomLifecycleProfile,
  WeakMap<RoomDeclaration, readonly RoomWalkStep[]>
>();

/**
 * The room's walk: its profile's room-level steps with its encounters in place
 * of the script step. The room reward's points a gate's pickup or the reward
 * before combat take precede the encounters; the rest follow them and any
 * pylon completion.
 */
export function roomWalkSteps(
  catalog: Catalog,
  profile: RoomLifecycleProfile,
  declaration: RoomDeclaration,
): readonly RoomWalkStep[] {
  let byDeclaration = cache.get(profile);
  if (byDeclaration === undefined) {
    byDeclaration = new WeakMap();
    cache.set(profile, byDeclaration);
  }
  const cached = byDeclaration.get(declaration);
  if (cached !== undefined) return cached;
  const slots = catalog.encounterEnvelopes.byKey[declaration.encounterEnvelopeKey]?.slots ?? [];
  const points = profile.producer.kind === 'none' ? [] : profile.producer.points;
  const beforeCombat = producerPointsBeforeCombat(catalog, profile, declaration);
  const before = points.filter((point) => beforeCombat.has(point));
  const after = points.filter((point) => !before.includes(point));
  const operation = (value: RoomLifecycleOperation): RoomWalkStep =>
    Object.freeze({ kind: 'operation' as const, operation: value });
  const steps: RoomWalkStep[] = [];
  profile.steps.forEach((step, index) => {
    if (step.kind === 'runEncounterScripts') {
      steps.push(...before.map((point) => operation(advance(point))));
      if (slots.length > 0) steps.push(Object.freeze({ kind: 'encounters' as const }));
      if (slots.length === 1) steps.push(Object.freeze({ kind: 'encounterEnds' as const }));
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
