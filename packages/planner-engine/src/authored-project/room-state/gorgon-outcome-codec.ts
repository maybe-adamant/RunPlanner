import type { Catalog, EncounterSlotBinding } from '../../catalog-schema';
import type { AuthoredGorgonPhaseResult } from '../model';
import { expectBoolean, expectExactKeys, expectRecord, failProjectDocument } from '../validation';
import { decodeGorgonAthenaOffer } from './encounter-trait-offers';
import { encounterSetForBinding } from './encounter-envelope';

export function decodeGorgonPhaseResults(
  value: unknown,
  catalog: Catalog,
  bindings: ReadonlyMap<string, EncounterSlotBinding>,
  path: string,
): Readonly<Record<string, AuthoredGorgonPhaseResult>> {
  const rawGorgon = expectRecord(value, path);
  const gorgonEffect = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
  )?.effect;
  if (gorgonEffect?.kind !== 'gorgonAmulet')
    failProjectDocument(path, 'catalog has no Gorgon Amulet descriptor');
  const hostingPhaseKeys = [...bindings.values()]
    .filter((binding) => {
      if (binding.kind === 'fixed')
        return (
          catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]?.hostsGorgon === true
        );
      const set = encounterSetForBinding(catalog, binding, `${path}.${binding.slotKey}`);
      return set.encounterDefinitionKeys.some(
        (key) => catalog.encounterDefinitions.byKey[key]?.hostsGorgon === true,
      );
    })
    .map((binding) => binding.slotKey);
  expectExactKeys(rawGorgon, hostingPhaseKeys, path);
  const results: Record<string, AuthoredGorgonPhaseResult> = {};
  for (const phaseKey of hostingPhaseKeys) {
    const result = expectRecord(rawGorgon[phaseKey], `${path}.${phaseKey}`);
    const hasOffer = result.athenaOffer !== undefined;
    expectExactKeys(
      result,
      hasOffer ? ['athenaTriggerConditionMet', 'athenaOffer'] : ['athenaTriggerConditionMet'],
      `${path}.${phaseKey}`,
    );
    const athenaTriggerConditionMet = expectBoolean(
      result.athenaTriggerConditionMet,
      `${path}.${phaseKey}.athenaTriggerConditionMet`,
    );
    if (athenaTriggerConditionMet && !hasOffer)
      failProjectDocument(
        `${path}.${phaseKey}.athenaOffer`,
        'is required while the Gorgon condition is active',
      );
    const athenaOffer = !hasOffer
      ? undefined
      : result.athenaOffer === null
        ? null
        : decodeGorgonAthenaOffer(
            result.athenaOffer,
            catalog,
            gorgonEffect.providerKey,
            `${path}.${phaseKey}.athenaOffer`,
          );
    results[phaseKey] = Object.freeze({
      athenaTriggerConditionMet,
      ...(athenaOffer === undefined ? {} : { athenaOffer }),
    });
  }
  return Object.freeze(results);
}
