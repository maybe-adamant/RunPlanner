import type {
  Catalog,
  EncounterCustomizationDecision,
  EncounterSlotBinding,
  RoomDeclaration,
} from '../../catalog-schema';
import type { AuthoredEncounterCustomization } from '../model';
import { encounterSetForBinding } from './encounter-envelope';

/** Structural customization family for one declared phase; active options stay concrete elsewhere. */
export function encounterCustomizationDeclarations(
  catalog: Catalog,
  room: RoomDeclaration,
  binding: EncounterSlotBinding,
): {
  readonly active: readonly EncounterCustomizationDecision[];
  readonly structural: readonly EncounterCustomizationDecision[];
} {
  const activeDefinitionKeys =
    binding.kind === 'fixed'
      ? [binding.encounterDefinitionKey]
      : encounterSetForBinding(catalog, binding, room.gameName).encounterDefinitionKeys;
  return Object.freeze({
    active: Object.freeze(
      activeDefinitionKeys.flatMap(
        (key) => catalog.encounterDefinitions.byKey[key]?.customization ?? [],
      ),
    ),
    structural: Object.freeze(
      catalog.encounterDefinitions.values.flatMap((definition) => definition.customization ?? []),
    ),
  });
}

export function customizationDecisionOwned(
  declarations: readonly EncounterCustomizationDecision[],
  decisionKey: string,
): boolean {
  return declarations.some((decision) => decision.key === decisionKey);
}

export function customizationValueKnown(
  declarations: readonly EncounterCustomizationDecision[],
  decisionKey: string,
  value: AuthoredEncounterCustomization,
): boolean {
  return declarations.some(
    (decision) =>
      decision.key === decisionKey &&
      decision.selection.kind === value.kind &&
      (value.kind === 'single'
        ? decision.selection.choices.some((choice) => choice.key === value.choiceKey)
        : decision.selection.kind === 'orderedPrefix' &&
          value.choiceKeys.length > 0 &&
          value.choiceKeys.length <= decision.selection.maximumLength &&
          new Set(value.choiceKeys).size === value.choiceKeys.length &&
          value.choiceKeys.every((choiceKey) =>
            decision.selection.choices.some((choice) => choice.key === choiceKey),
          )),
  );
}
