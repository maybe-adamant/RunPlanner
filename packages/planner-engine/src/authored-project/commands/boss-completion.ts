import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import { failCommand, withBiome, type LocatedBiome } from './contract';
import type { BossCompletionCommand } from './types';

/** Stores only a declaration-canonical set; progressive state determines whether it is active. */
export function applyBossCompletionCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: BossCompletionCommand,
): ProjectDocument {
  const seen = new Set<string>();
  for (const key of command.arcanaKeys) {
    if (catalog.arcanaCards.byKey[key] === undefined || seen.has(key))
      failCommand(command, `invalid Boss-completion Arcana ${key}`);
    seen.add(key);
  }
  const arcanaKeys = Object.freeze(
    catalog.arcanaCards.values.filter((card) => seen.has(card.key)).map((card) => card.key),
  );
  if (
    arcanaKeys.length === (located.plan.bossCompletionArcanaKeys ?? []).length &&
    arcanaKeys.every((key, index) => key === located.plan.bossCompletionArcanaKeys?.[index])
  )
    return document;
  return withBiome(document, located, { ...located.plan, bossCompletionArcanaKeys: arcanaKeys });
}
