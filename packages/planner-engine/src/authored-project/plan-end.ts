import type { AuthoredBiomePlan, OccurrenceId } from './model';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from './validation';

/** The room after whose settlement the plan ends; absent is a plan to its configured end. */
export interface PlanEnd {
  readonly biomeKey: string;
  readonly occurrenceId: OccurrenceId;
}

/** The named occurrence must exist in a configured biome's topology. */
export function decodePlanEnd(
  raw: unknown,
  path: string,
  biomes: readonly Pick<AuthoredBiomePlan, 'biomeKey' | 'topology'>[],
): PlanEnd {
  const record = expectRecord(raw, path);
  expectExactKeys(record, ['biomeKey', 'occurrenceId'], path);
  const biomeKey = expectString(record.biomeKey, `${path}.biomeKey`);
  const occurrenceId = expectString(record.occurrenceId, `${path}.occurrenceId`) as OccurrenceId;
  const biome = biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) failProjectDocument(`${path}.biomeKey`, `${biomeKey} is not configured`);
  if (
    biome.topology?.occurrences.some((occurrence) => occurrence.occurrenceId === occurrenceId) !==
    true
  )
    failProjectDocument(`${path}.occurrenceId`, `${occurrenceId} is not in ${biomeKey}`);
  return Object.freeze({ biomeKey, occurrenceId });
}

export function samePlanEnd(left: PlanEnd | undefined, right: PlanEnd | undefined): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined) return false;
  return left.biomeKey === right.biomeKey && left.occurrenceId === right.occurrenceId;
}

/** Whether the plan end still names an occurrence of a configured biome. */
export function planEndExists(
  planEnd: PlanEnd,
  biomes: readonly Pick<AuthoredBiomePlan, 'biomeKey' | 'topology'>[],
): boolean {
  return (
    biomes
      .find((biome) => biome.biomeKey === planEnd.biomeKey)
      ?.topology?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === planEnd.occurrenceId,
      ) === true
  );
}
