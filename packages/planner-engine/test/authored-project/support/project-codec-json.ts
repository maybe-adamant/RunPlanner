import { encodeProjectDocument, type ProjectDocument } from '@run-planner/engine/authored-project';

export type JsonRecord = Record<string, unknown>;

export function encoded(project: ProjectDocument): JsonRecord {
  return JSON.parse(encodeProjectDocument(project)) as JsonRecord;
}

export function biome(document: JsonRecord, routeKey: string, biomeKey: string): JsonRecord {
  const route = document.route as JsonRecord | undefined;
  if (route !== undefined && route.routeKey !== routeKey) {
    throw new Error(`document contains ${String(route.routeKey)}, not ${routeKey}`);
  }
  const plan = (route?.biomes as JsonRecord[] | undefined)?.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (plan === undefined) throw new Error(`missing ${routeKey}/${biomeKey}`);
  return plan;
}

export function occurrence(
  document: JsonRecord,
  biomeKey: string,
  occurrenceId: string,
): JsonRecord {
  const topology = biome(
    document,
    biomeKey === 'F' || biomeKey === 'G' || biomeKey === 'H' || biomeKey === 'I'
      ? 'Underworld'
      : 'Surface',
    biomeKey,
  ).topology as JsonRecord;
  const value = (topology.occurrences as JsonRecord[]).find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (value === undefined) throw new Error(`missing ${biomeKey} occurrence ${occurrenceId}`);
  return value;
}

export function gorgonResults(owner: JsonRecord): JsonRecord {
  return ((owner.encounters as JsonRecord).gorgonResultByPhase ?? {}) as JsonRecord;
}
