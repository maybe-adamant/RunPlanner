import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { failCommand, locateBiome, withBiome } from './contract';
import type { KeepsakeCommand } from './types';

export function applyKeepsakeCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: KeepsakeCommand,
): ProjectDocument {
  const located = locateBiome(document, catalog, command);
  if (command.selection.owner.biomeKey !== located.plan.biomeKey)
    failCommand(command, 'selection does not own this Postboss biome');
  if (located.plan.postbossKeepsakeDisposition === undefined)
    failCommand(command, 'biome has no ordinary Postboss rack');
  if (
    command.value.kind === 'replace' &&
    catalog.keepsakes.byKey[command.value.keepsakeKey] === undefined
  )
    failCommand(command, `unknown keepsake ${command.value.keepsakeKey}`);
  return withBiome(document, located, {
    ...located.plan,
    postbossKeepsakeDisposition: command.value,
  });
}
