import type { RawTraitCatalogInput, RawTraitGiverDeclaration } from '../declarations/traits';
import { requireArray, requireNonEmpty, requireObject } from './common';
import { fail } from './errors';

function closedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of ${values.join(', ')}`);
  }
  return value as Values[number];
}
export function collectCoreGodTraitKeys(raw: RawTraitCatalogInput['givers']): ReadonlySet<string> {
  const keys = new Set<string>();
  requireArray(raw, 'givers').forEach((value, index) => {
    const path = `givers[${index}]`;
    const giver = requireObject(value, path) as unknown as RawTraitGiverDeclaration;
    const providerKind = closedValue(
      giver.providerKind,
      ['olympian', 'hermes', 'hammer', 'npc', 'spell', 'chaos'] as const,
      `${path}.providerKind`,
    );
    if (providerKind !== 'olympian') return;
    (requireArray(giver.traitKeys, `${path}.traitKeys`) as readonly string[]).forEach(
      (traitKey, traitIndex) => {
        keys.add(requireNonEmpty(traitKey, `${path}.traitKeys[${traitIndex}]`));
      },
    );
  });
  return keys;
}
