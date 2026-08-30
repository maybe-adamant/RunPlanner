import type { Catalog } from '../catalog-schema';
import {
  createAdditionalExitAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
} from './addresses';
import type {
  AuthoredBiomePlan,
  AuthoredRoutePlan,
  BiomeTopology,
  IxionGeneratedChaosOrigin,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
  StygianWellGenerationKey,
} from './model';
import { exitDecisionForSource, selectedExitContinuation } from './topology/query';
import { applyRouteDetourCommand } from './commands/route-detours';
import type { LocatedBiome } from './commands/contract';

interface ReachedOccurrence {
  readonly biomeKey: string;
  readonly occurrence: RoomOccurrence;
}

interface IxionPurchase {
  readonly sourceBiomeKey: string;
  readonly sourceOccurrenceId: OccurrenceId;
  readonly generationKey: StygianWellGenerationKey;
}

interface ChaosSatisfaction {
  readonly host: ReachedOccurrence;
  readonly purchase: IxionPurchase;
  readonly generated: boolean;
}

function occurrenceById(topology: BiomeTopology, occurrenceId: OccurrenceId) {
  return topology.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
}

function localVisits(topology: BiomeTopology, sourceOccurrenceId: OccurrenceId) {
  const decision = topology.decisions.find(
    (candidate) =>
      candidate.kind === 'localVisit' && candidate.sourceOccurrenceId === sourceOccurrenceId,
  );
  if (decision?.kind !== 'localVisit') return Object.freeze([]);
  return Object.freeze(
    decision.visitOrder.flatMap((occurrenceId) => {
      const occurrence = occurrenceById(topology, occurrenceId);
      return occurrence === undefined ? [] : [occurrence];
    }),
  );
}

function reachedBiome(plan: AuthoredBiomePlan, catalog: Catalog): ReachedBiome {
  const topology = plan.topology;
  if (topology === null) return Object.freeze({ complete: false, occurrences: Object.freeze([]) });
  const reached: ReachedOccurrence[] = [];
  const visited = new Set<OccurrenceId>();
  let current = occurrenceById(topology, topology.startOccurrenceId);
  while (current !== undefined && !visited.has(current.occurrenceId)) {
    visited.add(current.occurrenceId);
    reached.push(Object.freeze({ biomeKey: plan.biomeKey, occurrence: current }));
    for (const local of localVisits(topology, current.occurrenceId)) {
      if (!visited.has(local.occurrenceId)) {
        visited.add(local.occurrenceId);
        reached.push(Object.freeze({ biomeKey: plan.biomeKey, occurrence: local }));
      }
    }

    const fixed = topology.fixedRoomLinks.find(
      (link) => link.sourceOccurrenceId === current!.occurrenceId,
    );
    if (fixed !== undefined) {
      current = occurrenceById(topology, fixed.targetOccurrenceId);
      continue;
    }
    const source = { kind: 'occurrence' as const, occurrenceId: current.occurrenceId };
    const exit = exitDecisionForSource(topology, source);
    if (exit !== undefined) {
      const continuation = selectedExitContinuation(
        exit,
        current.additionalExits ?? Object.freeze([]),
      );
      if (continuation === undefined)
        return Object.freeze({ complete: false, occurrences: Object.freeze(reached) });
      current = occurrenceById(
        topology,
        continuation.kind === 'normal'
          ? continuation.target.occurrenceId
          : continuation.exit.occurrenceId,
      );
      continue;
    }
    const hub = topology.decisions.find(
      (candidate) =>
        candidate.kind === 'hub' && candidate.source.occurrenceId === current!.occurrenceId,
    );
    if (hub?.kind === 'hub') {
      for (const slotKey of hub.visitOrder) {
        const target = hub.openTargets.find((candidate) => candidate.hubSlotKey === slotKey);
        const visit =
          target === undefined ? undefined : occurrenceById(topology, target.occurrenceId);
        if (visit === undefined || visited.has(visit.occurrenceId)) continue;
        visited.add(visit.occurrenceId);
        reached.push(Object.freeze({ biomeKey: plan.biomeKey, occurrence: visit }));
        for (const local of localVisits(topology, visit.occurrenceId)) {
          if (!visited.has(local.occurrenceId)) {
            visited.add(local.occurrenceId);
            reached.push(Object.freeze({ biomeKey: plan.biomeKey, occurrence: local }));
          }
        }
      }
      const handoff = exitDecisionForSource(topology, {
        kind: 'hubDecision',
        decisionKey: hub.hubKey,
      });
      const target = handoff?.normal.targets.find(
        (candidate) =>
          handoff.selection.kind === 'normal' && candidate.exitKey === handoff.selection.exitKey,
      );
      if (target === undefined)
        return Object.freeze({ complete: false, occurrences: Object.freeze(reached) });
      current = occurrenceById(topology, target.occurrenceId);
      continue;
    }
    const room = catalog.rooms.byKey[current.gameName];
    return Object.freeze({
      complete: room?.kind === 'Boss' || room?.kind === 'PostBoss',
      occurrences: Object.freeze(reached),
    });
  }
  return Object.freeze({ complete: false, occurrences: Object.freeze(reached) });
}

interface ReachedBiome {
  readonly complete: boolean;
  readonly occurrences: readonly ReachedOccurrence[];
}

function reachedRoute(route: AuthoredRoutePlan, catalog: Catalog): readonly ReachedOccurrence[] {
  const reached: ReachedOccurrence[] = [];
  for (const plan of route.biomes) {
    const biome = reachedBiome(plan, catalog);
    reached.push(...biome.occurrences);
    if (!biome.complete) break;
  }
  return Object.freeze(reached);
}

function purchasedIxionUses(reached: ReachedOccurrence): readonly IxionPurchase[] {
  const well = reached.occurrence.stygianWell;
  if (well === undefined || !well.interacted) return Object.freeze([]);
  const purchases: IxionPurchase[] = [];
  for (const action of reached.occurrence.roomActions.order) {
    if (action.kind !== 'purchaseStygianWellOffer') continue;
    const slot = action.generationKey.startsWith('initial:')
      ? (action.generationKey.slice('initial:'.length) as keyof typeof well.offerKeyBySlot)
      : undefined;
    const itemKey =
      action.generationKey === 'travelDealRefill'
        ? well.travelDealRefillKey
        : slot === undefined
          ? undefined
          : well.offerKeyBySlot[slot];
    if (itemKey === 'TemporaryForcedSecretDoorTrait')
      purchases.push(
        Object.freeze({
          sourceBiomeKey: reached.biomeKey,
          sourceOccurrenceId: reached.occurrence.occurrenceId,
          generationKey: action.generationKey,
        }),
      );
  }
  return Object.freeze(purchases);
}

function chaosGate(room: RoomOccurrence) {
  return room.additionalExits.find((exit) => exit.kind === 'chaos');
}

function canHostChaos(catalog: Catalog, occurrence: RoomOccurrence): boolean {
  const room = catalog.rooms.byKey[occurrence.gameName];
  return room?.additionalExits.some((exit) => exit.kind === 'chaos' && exit.canHost) === true;
}

function purchaseKey(purchase: IxionPurchase): string {
  return `${purchase.sourceBiomeKey}:${purchase.sourceOccurrenceId}:${purchase.generationKey}`;
}

function desiredChaosSatisfaction(
  route: AuthoredRoutePlan,
  catalog: Catalog,
): readonly ChaosSatisfaction[] {
  const pending: IxionPurchase[] = [];
  const satisfied: ChaosSatisfaction[] = [];
  for (const reached of reachedRoute(route, catalog)) {
    if (pending.length > 0 && canHostChaos(catalog, reached.occurrence)) {
      const purchase = pending.shift()!;
      const gate = chaosGate(reached.occurrence);
      satisfied.push(
        Object.freeze({
          host: reached,
          purchase,
          // An Ixion-generated gate owned by another purchase must be replaced
          // in place when FIFO ownership changes. An authored gate remains
          // the user's gate and satisfies the pending use without being claimed.
          generated:
            gate === undefined ||
            (gate.origin?.kind === 'ixionGenerated' && !sameOrigin(gate.origin, purchase)),
        }),
      );
    }
    pending.push(...purchasedIxionUses(reached));
  }
  return Object.freeze(satisfied);
}

function locatedBiome(
  document: ProjectDocument,
  catalog: Catalog,
  biomeIndex: number,
): LocatedBiome {
  const route = document.route;
  const plan = route.biomes[biomeIndex]!;
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined) throw new Error(`unknown biome layout ${plan.biomeKey}`);
  return Object.freeze({
    routeKey: route.routeKey,
    biomeIndex,
    loadout: route.loadout,
    plan,
    layout,
  });
}

function generatedChaosOccurrenceId(topology: BiomeTopology, sourceOccurrenceId: OccurrenceId) {
  const base = `${sourceOccurrenceId}:chaos`;
  let value = base;
  let suffix = 2;
  while (topology.occurrences.some((occurrence) => occurrence.occurrenceId === value)) {
    value = `${base}:${suffix}`;
    suffix += 1;
  }
  return createOccurrenceId(value);
}

export function forcedChaosOccurrenceKeysForRoute(
  route: AuthoredRoutePlan,
  catalog: Catalog,
): ReadonlySet<string> {
  const forced = new Set<string>();
  for (const satisfaction of desiredChaosSatisfaction(route, catalog))
    forced.add(
      semanticAddressKey(
        createOccurrenceAddress(
          createBiomeAddress(route.routeKey, satisfaction.host.biomeKey),
          satisfaction.host.occurrence.occurrenceId,
        ),
      ),
    );
  return forced;
}

/**
 * Returns only the occurrences whose persisted gate was inserted by Ixion.
 * This is deliberately separate from forcedChaosOccurrenceKeysForRoute: the
 * latter includes a manually authored gate while it satisfies pending Ixion
 * pressure for generation and validation, whereas editor removal ownership is
 * determined only by persisted provenance.
 */
export function ixionGeneratedChaosOccurrenceKeysForRoute(
  route: AuthoredRoutePlan,
): ReadonlySet<string> {
  const generated = new Set<string>();
  for (const plan of route.biomes) {
    for (const occurrence of plan.topology?.occurrences ?? []) {
      if (
        occurrence.additionalExits.some(
          (exit) => exit.kind === 'chaos' && exit.origin?.kind === 'ixionGenerated',
        )
      ) {
        generated.add(
          semanticAddressKey(
            createOccurrenceAddress(
              createBiomeAddress(route.routeKey, plan.biomeKey),
              occurrence.occurrenceId,
            ),
          ),
        );
      }
    }
  }
  return generated;
}

export function ixionGeneratedChaosOccurrenceKeys(document: ProjectDocument): ReadonlySet<string> {
  const generated = new Set<string>();
  for (const key of ixionGeneratedChaosOccurrenceKeysForRoute(document.route)) generated.add(key);
  return generated;
}

export function forcedChaosOccurrenceKeys(
  document: ProjectDocument,
  catalog: Catalog,
): ReadonlySet<string> {
  const forced = new Set<string>();
  for (const key of forcedChaosOccurrenceKeysForRoute(document.route, catalog)) forced.add(key);
  return forced;
}

function sameOrigin(left: IxionGeneratedChaosOrigin | undefined, right: IxionPurchase): boolean {
  return (
    left?.kind === 'ixionGenerated' &&
    left.sourceBiomeKey === right.sourceBiomeKey &&
    left.sourceOccurrenceId === right.sourceOccurrenceId &&
    left.generationKey === right.generationKey
  );
}

export function reconcileChaosTopology(
  document: ProjectDocument,
  catalog: Catalog,
): ProjectDocument {
  let next = document;
  {
    const route = next.route;
    const satisfactions = desiredChaosSatisfaction(route, catalog);
    const retainedOrigins = new Set(
      satisfactions
        .filter((satisfaction) => {
          if (satisfaction.generated) return false;
          const gate = chaosGate(satisfaction.host.occurrence);
          return gate?.origin !== undefined && sameOrigin(gate.origin, satisfaction.purchase);
        })
        .map((satisfaction) => purchaseKey(satisfaction.purchase)),
    );
    const routeKey = route.routeKey;
    for (let biomeIndex = 0; biomeIndex < route.biomes.length; biomeIndex += 1) {
      const plan = next.route.biomes[biomeIndex]!;
      for (const source of plan.topology?.occurrences ?? []) {
        const generated = source.additionalExits.find(
          (exit) => exit.kind === 'chaos' && exit.origin?.kind === 'ixionGenerated',
        );
        if (
          generated?.kind !== 'chaos' ||
          generated.origin?.kind !== 'ixionGenerated' ||
          retainedOrigins.has(purchaseKey(generated.origin))
        )
          continue;
        const located = locatedBiome(next, catalog, biomeIndex);
        next = applyRouteDetourCommand(next, catalog, located, {
          kind: 'RemoveGeneratedChaos',
          additional: createAdditionalExitAddress(
            createBiomeAddress(routeKey, plan.biomeKey),
            source.occurrenceId,
            'chaos',
          ),
        });
      }
    }
    for (const satisfaction of satisfactions.filter((entry) => entry.generated)) {
      const { biomeKey, occurrence } = satisfaction.host;
      const biomeIndex = next.route.biomes.findIndex((plan) => plan.biomeKey === biomeKey);
      if (biomeIndex < 0) continue;
      const plan = next.route.biomes[biomeIndex]!;
      const topology = plan.topology;
      const source =
        topology === null ? undefined : occurrenceById(topology, occurrence.occurrenceId);
      if (topology === null || source === undefined || chaosGate(source) !== undefined) continue;
      const located = locatedBiome(next, catalog, biomeIndex);
      next = applyRouteDetourCommand(next, catalog, located, {
        kind: 'GenerateChaos',
        additional: createAdditionalExitAddress(
          createBiomeAddress(routeKey, biomeKey),
          occurrence.occurrenceId,
          'chaos',
        ),
        occurrenceId: generatedChaosOccurrenceId(topology, occurrence.occurrenceId),
        sourceBiomeKey: satisfaction.purchase.sourceBiomeKey,
        sourceOccurrenceId: satisfaction.purchase.sourceOccurrenceId,
        generationKey: satisfaction.purchase.generationKey,
      });
    }
  }
  return next;
}
