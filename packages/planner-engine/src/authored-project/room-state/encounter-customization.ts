import type {
  Catalog,
  EncounterCustomizationDecision,
  EncounterSlotBinding,
  RoomDeclaration,
} from '../../catalog-schema';
import type { AuthoredEncounterCustomization } from '../model';
import { encounterSetForBinding } from './encounter-envelope';
import { decodeGeneratedEncounterCustomization } from './decoding/generated-encounter-codec';

export function supportsGeneratedEncounterCustomization(room: RoomDeclaration): boolean {
  return room.kind === 'Combat' || room.gameName === 'O_Devotion01';
}

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
      activeDefinitionKeys.flatMap((key) =>
        (catalog.encounterDefinitions.byKey[key]?.customization ?? []).filter(
          (decision) =>
            decision.selection.kind !== 'generated' ||
            supportsGeneratedEncounterCustomization(room),
        ),
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
  if (value.kind === 'generated') {
    const choices = declarations
      .filter((decision) => decision.key === decisionKey && decision.selection.kind === 'generated')
      .flatMap((decision) => decision.selection.choices);
    if (choices.length === 0) return false;
    const parsed = decodeGeneratedEncounterCustomization(value, 'generated customization');
    const known = new Set(choices.map((choice) => choice.key));
    const sources = declarations.flatMap((decision) =>
      decision.key === decisionKey && decision.selection.kind === 'generated'
        ? [...decision.selection.choices, ...decision.selection.fixedEnemies]
        : [],
    );
    const sourceKeys = new Set(sources.map((source) => source.key));
    const targets = new Set(
      sources.flatMap((source) =>
        source.menace?.kind === 'mapped'
          ? [source.menace.targetNativeId]
          : source.menace?.kind === 'random'
            ? source.menace.targetNativeIds
            : [],
      ),
    );
    return (
      (parsed.menace ?? []).every((wave) =>
        Object.entries(wave.conversions).every(
          ([key, conversion]) =>
            sourceKeys.has(key) &&
            (conversion.targetKey === undefined || targets.has(conversion.targetKey)),
        ),
      ) &&
      (parsed.highlightKey === undefined || known.has(parsed.highlightKey)) &&
      (parsed.waves ?? []).every(
        (wave) =>
          wave.typeKeys.every((key) => known.has(key)) &&
          Object.keys(wave.allocations ?? {}).every((key) => known.has(key)),
      )
    );
  }
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
