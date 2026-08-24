import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  semanticAddressKey,
  type EncounterPhaseAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  BiomeHistoryPrefix,
  CanonicalBiomeHistory,
  ProjectRouteEvaluation,
  RoomHistoryOrigin,
} from '@run-planner/engine/simulation';

import type { WorkspaceInspectorDestination } from './structured-workspace';

/** A resolved NPC encounter together with its exact semantic navigation owner. */
export interface RouteNpcIndexEntry {
  readonly encounterKey: string;
  readonly label: string;
  readonly locationLabel: string;
  readonly phase: EncounterPhaseAddress;
  readonly sequence: number;
}

/** Presentation-only group declared by an encounter definition. */
export interface RouteNpcIndexGroup {
  readonly entries: readonly RouteNpcIndexEntry[];
  readonly presentationKey: string;
}

/** Read-only, route-local index of resolved presentation-bearing encounters. */
export interface RouteNpcIndex {
  readonly groups: readonly RouteNpcIndexGroup[];
}

export class RouteNpcIndexProjectionContractError extends Error {
  constructor(detail: string) {
    super(`Route NPC index: ${detail}`);
  }
}

type HistoryBearingBiome = Extract<
  ProjectRouteEvaluation['biomes'][number],
  { readonly history: CanonicalBiomeHistory | BiomeHistoryPrefix }
>;

function hasHistory(biome: ProjectRouteEvaluation['biomes'][number]): biome is HistoryBearingBiome {
  return 'history' in biome;
}

/**
 * Each biome history ledger is seeded from all committed route history. The
 * latest available ledger therefore has the full route view without repeating
 * entries from earlier biome ledgers.
 */
function latestHistoryBearingBiome(route: ProjectRouteEvaluation): HistoryBearingBiome | undefined {
  for (let index = route.biomes.length - 1; index >= 0; index -= 1) {
    const biome = route.biomes[index];
    if (biome !== undefined && hasHistory(biome)) return biome;
  }
  return undefined;
}

function phaseForEncounterRecord(
  origin: RoomHistoryOrigin,
  slotKey: string,
): EncounterPhaseAddress {
  const biome = createBiomeAddress(origin.routeKey, origin.biomeKey);
  switch (origin.kind) {
    case 'occurrence':
      return createEncounterPhaseAddress(
        biome,
        { kind: 'occurrence', occurrenceId: origin.occurrenceId },
        slotKey,
      );
    case 'hubRoom':
      throw new RouteNpcIndexProjectionContractError(
        `${origin.kind} ${semanticAddressKey(origin)} cannot own encounter phase ${slotKey}`,
      );
  }
}

function requireExactInspectorDestination(
  focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>,
  phase: EncounterPhaseAddress,
): void {
  const ownerKey = semanticAddressKey(phase);
  const destination = focusByOwner.get(ownerKey);
  if (destination === undefined) {
    throw new RouteNpcIndexProjectionContractError(
      `${ownerKey} has no exact workspace focus destination`,
    );
  }
  if (semanticAddressKey(destination.ownerAddress) !== ownerKey) {
    throw new RouteNpcIndexProjectionContractError(
      `${ownerKey} is routed through ${semanticAddressKey(destination.ownerAddress)}`,
    );
  }
  if (destination.routeKey !== phase.routeKey || destination.biomeKey !== phase.biomeKey) {
    throw new RouteNpcIndexProjectionContractError(
      `${ownerKey} is routed outside ${phase.routeKey}/${phase.biomeKey}`,
    );
  }
  if (
    destination.inspectorSubject?.kind !== 'node' ||
    destination.inspectorSubject.nodeKey !== destination.nodeKey
  ) {
    throw new RouteNpcIndexProjectionContractError(
      `${ownerKey} has no exact containing workspace inspector`,
    );
  }
}

/**
 * Projects only resolved records whose definition opts into presentation.
 * The engine owns resolution and history; the structured workspace owns exact
 * containment. This application projection joins those completed products
 * without reevaluating candidates, sets, requirements, or NPC families.
 */
export function projectRouteNpcIndex(
  catalog: Catalog,
  route: ProjectRouteEvaluation,
  focusByOwner: ReadonlyMap<string, WorkspaceInspectorDestination>,
): RouteNpcIndex {
  const historyBiome = latestHistoryBearingBiome(route);
  if (historyBiome === undefined) return Object.freeze({ groups: Object.freeze([]) });

  const entriesByPresentationKey = new Map<string, RouteNpcIndexEntry[]>();
  for (const record of historyBiome.history.ledgers.encounterRecords) {
    const definition = catalog.encounterDefinitions.byKey[record.encounterKey];
    if (definition === undefined) {
      throw new RouteNpcIndexProjectionContractError(
        `resolved encounter record references unknown definition ${record.encounterKey}`,
      );
    }
    const presentationKey = definition.npcPresentationKey;
    if (presentationKey === undefined) continue;
    const phase = phaseForEncounterRecord(record.origin, record.slotKey);
    if (phase.routeKey !== route.routeKey) {
      throw new RouteNpcIndexProjectionContractError(
        `${semanticAddressKey(phase)} belongs to ${phase.routeKey}, not ${route.routeKey}`,
      );
    }
    requireExactInspectorDestination(focusByOwner, phase);
    const biome = catalog.biomes.byKey[phase.biomeKey];
    if (biome === undefined) {
      throw new RouteNpcIndexProjectionContractError(
        `${semanticAddressKey(phase)} references unknown biome ${phase.biomeKey}`,
      );
    }
    const entries = entriesByPresentationKey.get(presentationKey);
    const entry = Object.freeze({
      encounterKey: definition.key,
      label: definition.label,
      locationLabel: `${biome.label} · ${phase.phaseKey}`,
      phase,
      sequence: record.sequence,
    });
    if (entries === undefined) {
      entriesByPresentationKey.set(presentationKey, [entry]);
    } else {
      entries.push(entry);
    }
  }

  return Object.freeze({
    groups: Object.freeze(
      [...entriesByPresentationKey].map(([presentationKey, entries]) =>
        Object.freeze({ entries: Object.freeze(entries), presentationKey }),
      ),
    ),
  });
}
