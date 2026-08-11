import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { AcquisitionSiteCommand } from './types';

/**
 * The first authorable settlement point is a materialized Shop's room-exit
 * point.  The closed branch is deliberately narrow: future pickup families
 * add their own active-entry-domain authority here rather than making the
 * command infer room names or presentation state.
 */
export function applyAcquisitionSiteCommand(
  document: ProjectDocument,
  _catalog: Catalog,
  located: LocatedBiome,
  command: AcquisitionSiteCommand,
): ProjectDocument {
  if (command.site.owner.kind !== 'occurrence' || command.site.pointKey !== 'roomExit') {
    failCommand(command, 'is not an authorable acquisition site');
  }
  if (
    !Array.isArray(command.entryKeys) ||
    !command.entryKeys.every((key) => typeof key === 'string')
  ) {
    failCommand(command, 'entryKeys must be an array of entry keys');
  }
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.site.owner.occurrenceId, command);
  if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
    failCommand(command, 'does not own a materialized Shop acquisition site');
  }
  const seen = new Set<string>();
  for (const key of command.entryKeys) {
    if (occurrence.state.shop.offers[key] === undefined)
      failCommand(command, `unknown entry ${key}`);
    if (seen.has(key)) failCommand(command, `entry ${key} is duplicated`);
    seen.add(key);
  }
  const existing = occurrence.acquisitionSites?.[command.site.pointKey]?.order ?? [];
  if (sameOccurrenceValue(command.entryKeys, existing)) return document;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        acquisitionSites: Object.freeze({
          ...(occurrence.acquisitionSites ?? {}),
          [command.site.pointKey]: Object.freeze({ order: Object.freeze([...command.entryKeys]) }),
        }),
      }),
    ),
  );
}
