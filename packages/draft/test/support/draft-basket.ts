import { catalog } from '@run-planner/hades2-catalog';

/**
 * A basket by giver from trait keys in order: each trait under its only giver, a Duo under the
 * god `hosts` names or else the first `pool` god listing it, and an unknown key under `Unknown`.
 */
export function draftBasket(
  traitKeys: readonly string[],
  hosts: Readonly<Record<string, string>> = {},
  pool: readonly string[] = [],
): Readonly<Record<string, readonly string[]>> {
  const basket: Record<string, string[]> = {};
  for (const traitKey of traitKeys) {
    const givers = catalog.traitGivers.values.filter((giver) => giver.traitKeys.includes(traitKey));
    const giverKey =
      hosts[traitKey] ??
      (givers.length === 1
        ? givers[0]!.key
        : givers.length === 0
          ? 'Unknown'
          : pool.find((godKey) => givers.some((giver) => giver.key === godKey)));
    if (giverKey === undefined) throw new Error(`${traitKey} needs a host`);
    (basket[giverKey] ??= []).push(traitKey);
  }
  return basket;
}
