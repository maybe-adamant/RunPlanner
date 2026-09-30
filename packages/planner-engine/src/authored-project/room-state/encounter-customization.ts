import type {
  Catalog,
  EncounterCustomizationDecision,
  EncounterSlotBinding,
  RoomDeclaration,
} from '../../catalog-schema';
import type { AuthoredEncounterCustomization } from '../model';
import { encounterBindingsBySlot, encounterSetForBinding } from './encounter-envelope';
import { decodeGeneratedEncounterCustomization } from './decoding/generated-encounter-codec';

export function supportsGeneratedEncounterCustomization(room: RoomDeclaration): boolean {
  return (
    room.kind === 'Combat' ||
    room.kind === 'Opening' ||
    room.kind === 'PreHub' ||
    room.gameName === 'O_Devotion01'
  );
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

/**
 * Decisions a phase's authored owner declares that its resolved identity does
 * not: the route-free binding under an entry-contextual fixed rule, or the
 * authored choice's members when a first-biome identity resolved instead. A
 * value retained for one of them is removal-only.
 */
export function contextuallyReplacedCustomizationDecisions(
  catalog: Catalog,
  routeFreeRoom: RoomDeclaration,
  contextualRoom: RoomDeclaration,
  slotKey: string,
  resolved?: { readonly authoredChoiceKey: string; readonly encounterDefinitionKey: string },
): readonly EncounterCustomizationDecision[] {
  const contextual = encounterBindingsBySlot(catalog, contextualRoom, contextualRoom.gameName).get(
    slotKey,
  );
  if (contextual?.kind === 'set') {
    const profile =
      resolved === undefined
        ? undefined
        : encounterSetForBinding(
            catalog,
            contextual,
            contextualRoom.gameName,
          ).authoringProfiles.find((candidate) => candidate.key === resolved.authoredChoiceKey);
    if (profile === undefined) return Object.freeze([]);
    const owned = (definitionKey: string) =>
      (catalog.encounterDefinitions.byKey[definitionKey]?.customization ?? []).filter(
        (decision) =>
          decision.selection.kind !== 'generated' ||
          supportsGeneratedEncounterCustomization(contextualRoom),
      );
    const active = owned(resolved!.encounterDefinitionKey);
    const replaced = new Map<string, EncounterCustomizationDecision>();
    for (const decision of profile.encounterDefinitionKeys.flatMap(owned))
      if (!customizationDecisionOwned(active, decision.key) && !replaced.has(decision.key))
        replaced.set(decision.key, decision);
    return Object.freeze([...replaced.values()]);
  }
  const routeFree = encounterBindingsBySlot(catalog, routeFreeRoom, routeFreeRoom.gameName).get(
    slotKey,
  );
  if (
    contextual?.kind !== 'fixed' ||
    routeFree === undefined ||
    (routeFree.kind === 'fixed' &&
      routeFree.encounterDefinitionKey === contextual.encounterDefinitionKey)
  )
    return Object.freeze([]);
  const active = encounterCustomizationDeclarations(catalog, contextualRoom, contextual).active;
  return Object.freeze(
    encounterCustomizationDeclarations(catalog, routeFreeRoom, routeFree).active.filter(
      (decision) => !customizationDecisionOwned(active, decision.key),
    ),
  );
}

export function customizationDecisionOwned(
  declarations: readonly EncounterCustomizationDecision[],
  decisionKey: string,
): boolean {
  return declarations.some((decision) => decision.key === decisionKey);
}

/** Whether a single or ordered-prefix value names a choice its route excludes. */
export function customizationValueRouteExcluded(
  decision: EncounterCustomizationDecision,
  value: AuthoredEncounterCustomization,
  routeKey: string,
): boolean {
  if (decision.selection.kind !== 'single' && decision.selection.kind !== 'orderedPrefix')
    return false;
  const keys =
    value.kind === 'single'
      ? [value.choiceKey]
      : value.kind === 'orderedPrefix'
        ? value.choiceKeys
        : [];
  return decision.selection.choices.some(
    (choice) => keys.includes(choice.key) && choice.excludedRouteKeys?.includes(routeKey) === true,
  );
}

/** The decision restricted to the choices its route can produce. */
export function customizationDecisionOnRoute<Decision extends EncounterCustomizationDecision>(
  decision: Decision,
  routeKey: string,
): Decision {
  if (decision.selection.kind !== 'single' && decision.selection.kind !== 'orderedPrefix')
    return decision;
  const choices = decision.selection.choices.filter(
    (choice) => choice.excludedRouteKeys?.includes(routeKey) !== true,
  );
  if (choices.length === decision.selection.choices.length) return decision;
  return Object.freeze({
    ...decision,
    selection: Object.freeze({ ...decision.selection, choices: Object.freeze(choices) }),
  }) as Decision;
}

export function customizationValueKnown(
  declarations: readonly EncounterCustomizationDecision[],
  decisionKey: string,
  value: AuthoredEncounterCustomization,
): boolean {
  if (value.kind === 'generated') {
    const choices = declarations.flatMap((decision) =>
      decision.key === decisionKey && decision.selection.kind === 'generated'
        ? decision.selection.choices
        : [],
    );
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
  return declarations.some((decision) => {
    if (decision.key !== decisionKey) return false;
    const selection = decision.selection;
    switch (value.kind) {
      case 'cocoonRewardPoint':
        return (
          selection.kind === 'cocoonRewardPoint' &&
          Number.isInteger(value.spawnPointId) &&
          value.spawnPointId > 0
        );
      case 'single':
        return (
          selection.kind === 'single' &&
          selection.choices.some((choice) => choice.key === value.choiceKey)
        );
      case 'orderedPrefix':
        return (
          selection.kind === 'orderedPrefix' &&
          value.choiceKeys.length > 0 &&
          value.choiceKeys.length <= selection.maximumLength &&
          new Set(value.choiceKeys).size === value.choiceKeys.length &&
          value.choiceKeys.every((choiceKey) =>
            selection.choices.some((choice) => choice.key === choiceKey),
          )
        );
      case 'cocoonCount':
        return (
          selection.kind === 'cocoonCount' &&
          Number.isInteger(value.count) &&
          value.count >= selection.minimum &&
          value.count <= selection.maximum
        );
      case 'infiniteRoster':
        return (
          selection.kind === 'infiniteRoster' &&
          value.typeKeys.length >= selection.types.min &&
          value.typeKeys.length <= selection.types.max &&
          new Set(value.typeKeys).size === value.typeKeys.length &&
          value.typeKeys.every((key) => selection.choices.some((choice) => choice.key === key))
        );
    }
  });
}

/** Persistable shape: an out-of-range cocoon count is retained for a preparation finding. */
export function customizationValueRepresentable(
  declarations: readonly EncounterCustomizationDecision[],
  decisionKey: string,
  value: AuthoredEncounterCustomization,
): boolean {
  return value.kind === 'cocoonCount'
    ? declarations.some(
        (decision) => decision.key === decisionKey && decision.selection.kind === 'cocoonCount',
      )
    : customizationValueKnown(declarations, decisionKey, value);
}
