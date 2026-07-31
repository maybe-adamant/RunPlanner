import {
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  declaredPhysicalExits as resolveDeclaredPhysicalExits,
  semanticAddressKey,
  type AuthoredBiomePlan,
  type BiomeAddress,
  type DeclaredPhysicalExit,
  type ExitDecision,
  type ExitDecisionAddress,
  type ExitDecisionSourceAddress,
  type HubDecision,
  type HubDecisionAddress,
  type OccurrenceId,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { BiomeLayout, Catalog } from '@run-planner/engine/catalog-schema';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBiome,
  CanonicalHubDecision,
  CanonicalLinkedExit,
  MaterializedBiomePrefix,
  ProjectBiomeEvaluation,
  ProjectEvaluation,
  SemanticFinding,
} from '@run-planner/engine/simulation';

import { StructuredWorkspaceProjectionContractError } from './contract';
import { compareAuthoredTargetsInPhysicalOrder, compareCodeUnitStrings } from './ordering';

export interface WorkspaceEvaluatedBatchOverlay {
  readonly batch: CanonicalBatch;
  readonly partial: boolean;
}

export interface WorkspaceBiomeSource {
  readonly biome: BiomeAddress;
  readonly entryRoom?: CanonicalAuthoredRoom;
  readonly evaluation: ProjectBiomeEvaluation | undefined;
  readonly exitDecisions: readonly ExitDecision[];
  readonly findings: readonly SemanticFinding[];
  readonly layout: BiomeLayout;
  readonly plan: AuthoredBiomePlan;
  readonly evaluatedBatch: (
    owner: ExitDecisionAddress,
  ) => WorkspaceEvaluatedBatchOverlay | undefined;
  readonly evaluatedHub: (owner: HubDecisionAddress) => CanonicalHubDecision | undefined;
  readonly evaluatedLinkedExit: (owner: ExitDecisionAddress) => CanonicalLinkedExit | undefined;
  readonly exitDecision: (source: ExitDecisionSourceAddress) => ExitDecision | undefined;
  readonly findingsFor: (owner: SemanticAddress) => readonly SemanticFinding[];
  readonly hubDecision: (hubKey: string) => HubDecision | undefined;
  readonly isAssessed: (owner: SemanticAddress) => boolean;
  readonly occurrence: (occurrenceId: OccurrenceId) => RoomOccurrence | undefined;
}

export interface WorkspaceRouteSource {
  readonly biomes: readonly WorkspaceBiomeSource[];
  readonly evaluation: ProjectEvaluation['routes'][number] | undefined;
  readonly routeKey: string;
}

export interface WorkspaceProjectSourceIndex {
  readonly routes: readonly WorkspaceRouteSource[];
}

function isSemanticAddress(value: unknown): value is SemanticAddress {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return false;
  const address = value as Readonly<Record<string, unknown>>;
  const string = (key: string) => typeof address[key] === 'string';
  const biomeOwned = () => string('routeKey') && string('biomeKey');
  const occurrenceOwned = () => biomeOwned() && string('occurrenceId');
  switch (address.kind) {
    case 'project':
      return true;
    case 'route':
      return string('routeKey');
    case 'biome':
      return biomeOwned();
    case 'biomeField':
      return biomeOwned() && string('fieldKey');
    case 'occurrence':
    case 'incomingReward':
      return occurrenceOwned();
    case 'completionRoom':
      return biomeOwned() && string('role');
    case 'exitDecision':
    case 'exitSelection':
    case 'batchRewardStore':
      return biomeOwned() && typeof address.source === 'object' && address.source !== null;
    case 'target':
      return (
        biomeOwned() &&
        string('exitKey') &&
        typeof address.source === 'object' &&
        address.source !== null
      );
    case 'hubDecision':
    case 'hubOpenSet':
    case 'hubRoom':
      return biomeOwned() && string('hubKey');
    case 'hubSlot':
      return biomeOwned() && string('hubKey') && string('hubSlotKey');
    case 'hubVisit':
      return biomeOwned() && string('hubKey') && typeof address.visitIndex === 'number';
    case 'localReward':
    case 'localChild':
      return occurrenceOwned() && string('groupKey') && string('slotKey');
    case 'localChildGroup':
      return occurrenceOwned() && string('groupKey');
    case 'rewardWheel':
      return occurrenceOwned() && string('wheelKey');
    case 'rewardWheelOffer':
      return occurrenceOwned() && string('wheelKey') && string('offerKey');
    case 'shopOffer':
    case 'shopPurchase':
      return occurrenceOwned() && string('offerKey');
    default:
      return false;
  }
}

function assessedAddresses(value: unknown): ReadonlySet<string> {
  const keys = new Set<string>();
  const visited = new WeakSet<object>();
  const visit = (candidate: unknown): void => {
    if (typeof candidate !== 'object' || candidate === null || visited.has(candidate)) return;
    visited.add(candidate);
    if (isSemanticAddress(candidate)) keys.add(semanticAddressKey(candidate));
    for (const nested of Array.isArray(candidate) ? candidate : Object.values(candidate)) {
      visit(nested);
    }
  };
  visit(value);
  return keys;
}

function indexFindings(
  findings: readonly SemanticFinding[],
): ReadonlyMap<string, readonly SemanticFinding[]> {
  const mutable = new Map<string, SemanticFinding[]>();
  for (const finding of findings) {
    const key = semanticAddressKey(finding.origin);
    const values = mutable.get(key);
    if (values === undefined) mutable.set(key, [finding]);
    else values.push(finding);
  }
  return new Map([...mutable].map(([key, value]) => [key, Object.freeze(value)] as const));
}

function materialized(
  evaluation: ProjectBiomeEvaluation | undefined,
): CanonicalBiome | MaterializedBiomePrefix | undefined {
  if (evaluation === undefined) return undefined;
  if (evaluation.authoring === 'complete') return evaluation.snapshot;
  return 'materializedPrefix' in evaluation ? evaluation.materializedPrefix : undefined;
}

function partialBatchFromPrefix(prefix: MaterializedBiomePrefix): CanonicalBatch | undefined {
  return prefix.frontier?.kind === 'exitDecision' ? prefix.frontier.partialBatch : undefined;
}

interface EvaluatedBiomeOverlay {
  readonly batches: ReadonlyMap<string, WorkspaceEvaluatedBatchOverlay>;
  readonly entryRoom?: CanonicalAuthoredRoom;
  readonly hubs: ReadonlyMap<string, CanonicalHubDecision>;
  readonly linkedExits: ReadonlyMap<string, CanonicalLinkedExit>;
}

function evaluatedBiomeOverlay(
  snapshot: CanonicalBiome | MaterializedBiomePrefix | undefined,
): EvaluatedBiomeOverlay {
  const batches = new Map<string, WorkspaceEvaluatedBatchOverlay>();
  const linkedExits = new Map<string, CanonicalLinkedExit>();
  const hubs = new Map<string, CanonicalHubDecision>();
  const insert = <T>(map: Map<string, T>, key: string, value: T, label: string): void => {
    if (map.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `evaluation has duplicate ${label} owner ${key}`,
      );
    }
    map.set(key, value);
  };
  for (const decision of snapshot?.decisions ?? []) {
    const key = semanticAddressKey(decision.origin);
    switch (decision.kind) {
      case 'batch':
        insert(batches, key, Object.freeze({ batch: decision, partial: false }), 'batch');
        break;
      case 'linkedExit':
        insert(linkedExits, key, decision, 'linked exit');
        break;
      case 'hub':
        insert(hubs, key, decision, 'Hub');
        break;
    }
  }
  const partial = snapshot?.kind === 'biomePrefix' ? partialBatchFromPrefix(snapshot) : undefined;
  if (partial !== undefined) {
    const key = semanticAddressKey(partial.origin);
    if (batches.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `evaluation has duplicate batch owner ${key}`,
      );
    }
    batches.set(key, Object.freeze({ batch: partial, partial: true }));
  }
  return Object.freeze({
    batches,
    ...(snapshot?.entryRoom === undefined ? {} : { entryRoom: snapshot.entryRoom }),
    hubs,
    linkedExits,
  });
}

function physicalExitsForSource(
  catalog: Catalog,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  source: ExitDecisionSourceAddress,
): readonly DeclaredPhysicalExit[] {
  if (plan.topology === null) return Object.freeze([]);
  return resolveDeclaredPhysicalExits(catalog, layout, plan.topology, source) ?? Object.freeze([]);
}

function authoredExitDecisionsInTopologyOrder(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  plan: AuthoredBiomePlan,
  byOwner: ReadonlyMap<string, ExitDecision>,
): readonly ExitDecision[] {
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const ordered: ExitDecision[] = [];
  const visited = new Set<string>();
  const visit = (source: ExitDecisionSourceAddress): void => {
    const key = semanticAddressKey(createExitDecisionAddress(biome, source));
    if (visited.has(key)) return;
    const decision = byOwner.get(key);
    if (decision === undefined) return;
    visited.add(key);
    ordered.push(decision);
    if (decision.normal.kind === 'linked') {
      visit({ kind: 'occurrence', occurrenceId: decision.normal.occurrenceId });
      return;
    }
    const rank = new Map(
      physicalExitsForSource(catalog, layout, plan, decision.source).map(
        (exit) => [exit.exitKey, exit.index] as const,
      ),
    );
    const targets = [...decision.normal.targets].sort((left, right) =>
      compareAuthoredTargetsInPhysicalOrder(rank, left, right),
    );
    const selectedExitKey =
      decision.selection.kind === 'normal'
        ? decision.selection.exitKey
        : decision.selection.kind === 'derived'
          ? decision.normal.targets[0]?.exitKey
          : undefined;
    const selected =
      selectedExitKey === undefined
        ? undefined
        : targets.find((target) => target.exitKey === selectedExitKey);
    for (const target of [
      ...(selected === undefined ? [] : [selected]),
      ...targets.filter((target) => target !== selected),
    ]) {
      visit({ kind: 'occurrence', occurrenceId: target.occurrenceId });
    }
  };
  visit({ kind: 'occurrence', occurrenceId: topology.startOccurrenceId });
  for (const [key, decision] of [...byOwner.entries()].sort(([left], [right]) =>
    compareCodeUnitStrings(left, right),
  )) {
    if (!visited.has(key)) visit(decision.source);
  }
  return Object.freeze(ordered);
}

function createWorkspaceBiomeSource(
  catalog: Catalog,
  routeKey: string,
  plan: AuthoredBiomePlan,
  evaluation: ProjectBiomeEvaluation | undefined,
): WorkspaceBiomeSource {
  const biome = createBiomeAddress(routeKey, plan.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined) {
    throw new StructuredWorkspaceProjectionContractError(`${plan.biomeKey} has no layout`);
  }
  const occurrencesById = new Map<OccurrenceId, RoomOccurrence>();
  const exitDecisionsByOwner = new Map<string, ExitDecision>();
  const hubDecisionsByKey = new Map<string, HubDecision>();
  const topology = plan.topology;
  if (topology !== null) {
    for (const occurrence of topology.occurrences) {
      if (occurrencesById.has(occurrence.occurrenceId)) {
        throw new StructuredWorkspaceProjectionContractError(
          semanticAddressKey(createOccurrenceAddress(biome, occurrence.occurrenceId)) +
            ' has duplicate authored occurrence identity',
        );
      }
      occurrencesById.set(occurrence.occurrenceId, occurrence);
    }
    for (const decision of topology.decisions) {
      if (decision.kind === 'exit') {
        const key = semanticAddressKey(createExitDecisionAddress(biome, decision.source));
        if (exitDecisionsByOwner.has(key)) {
          throw new StructuredWorkspaceProjectionContractError(
            key + ' has duplicate authored exit-decision owner',
          );
        }
        exitDecisionsByOwner.set(key, decision);
        continue;
      }
      const key = semanticAddressKey(createHubDecisionAddress(biome, decision.hubKey));
      if (hubDecisionsByKey.has(key)) {
        throw new StructuredWorkspaceProjectionContractError(
          key + ' has duplicate authored Hub-decision owner',
        );
      }
      hubDecisionsByKey.set(key, decision);
    }
  }
  const exitDecisions = authoredExitDecisionsInTopologyOrder(
    catalog,
    biome,
    layout,
    plan,
    exitDecisionsByOwner,
  );
  const overlay = evaluatedBiomeOverlay(materialized(evaluation));
  for (const key of overlay.batches.keys()) {
    if (exitDecisionsByOwner.get(key)?.normal.kind !== 'batch') {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has an evaluated batch without an authored batch decision`,
      );
    }
  }
  for (const key of overlay.linkedExits.keys()) {
    if (exitDecisionsByOwner.get(key)?.normal.kind !== 'linked') {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has an evaluated linked exit without an authored linked decision`,
      );
    }
  }
  for (const key of overlay.hubs.keys()) {
    if (!hubDecisionsByKey.has(key)) {
      throw new StructuredWorkspaceProjectionContractError(
        `${key} has an evaluated Hub without an authored Hub decision`,
      );
    }
  }
  const findingsByOwner = indexFindings(evaluation?.findings ?? []);
  const assessedKeys = assessedAddresses(materialized(evaluation));
  return Object.freeze({
    biome,
    ...(overlay.entryRoom === undefined ? {} : { entryRoom: overlay.entryRoom }),
    evaluation,
    evaluatedBatch: (owner: ExitDecisionAddress) => overlay.batches.get(semanticAddressKey(owner)),
    evaluatedHub: (owner: HubDecisionAddress) => overlay.hubs.get(semanticAddressKey(owner)),
    evaluatedLinkedExit: (owner: ExitDecisionAddress) =>
      overlay.linkedExits.get(semanticAddressKey(owner)),
    exitDecision: (source: ExitDecisionSourceAddress) =>
      exitDecisionsByOwner.get(semanticAddressKey(createExitDecisionAddress(biome, source))),
    exitDecisions,
    findings: Object.freeze([...(evaluation?.findings ?? [])]),
    findingsFor: (owner: SemanticAddress) =>
      findingsByOwner.get(semanticAddressKey(owner)) ?? Object.freeze([]),
    hubDecision: (hubKey: string) =>
      hubDecisionsByKey.get(semanticAddressKey(createHubDecisionAddress(biome, hubKey))),
    isAssessed: (owner: SemanticAddress) => assessedKeys.has(semanticAddressKey(owner)),
    layout,
    occurrence: (occurrenceId: OccurrenceId) => occurrencesById.get(occurrenceId),
    plan,
  });
}

/**
 * Immutable authored-first lookup for workspace assembly. It indexes source
 * identities and evaluator overlays only; room policy, physical-exit policy,
 * projection outputs, and interaction registration remain outside it.
 */
export function createWorkspaceProjectSourceIndex(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
): WorkspaceProjectSourceIndex {
  return Object.freeze({
    routes: Object.freeze(
      project.routes.map((route) => {
        const routeEvaluation = evaluation.routes.find(
          (candidate) => candidate.routeKey === route.routeKey,
        );
        return Object.freeze({
          biomes: Object.freeze(
            route.biomes.map((plan) =>
              createWorkspaceBiomeSource(
                catalog,
                route.routeKey,
                plan,
                routeEvaluation?.biomes.find((candidate) => candidate.biomeKey === plan.biomeKey),
              ),
            ),
          ),
          evaluation: routeEvaluation,
          routeKey: route.routeKey,
        });
      }),
    ),
  });
}
