import type {
  Catalog,
  EncounterDefinition,
  EncounterEnvelopeSlot,
  EncounterSet,
  EncounterSlotBinding,
  RoomDeclaration,
} from '../../catalog-schema';
import {
  traitOfferSupportsExhaustion,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
  type AuthoredCirceResolution,
} from '../traits';
import {
  TRAIT_OPTION_KEYS,
  createDefaultEncounterTraitOffer,
  traitGiverUsesOfferContext,
} from '../traits';
import type { RoomEncounterState } from '../model';
import {
  expectArray,
  expectBoolean,
  expectExactKeys,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';

function requireEnvelope(catalog: Catalog, room: RoomDeclaration, path: string) {
  const envelope = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey];
  if (envelope === undefined) {
    failProjectDocument(
      path,
      `${room.gameName} references unknown envelope ${room.encounterEnvelopeKey}`,
    );
  }
  return envelope;
}

/**
 * Validates the declaration-level exact slot relation at the authored-state
 * contact. The catalog compiler owns construction closure; this guard keeps a
 * corrupted hand-built catalog from moving selections through a wrong slot.
 */
export function encounterBindingsBySlot(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): ReadonlyMap<string, EncounterSlotBinding> {
  const envelope = requireEnvelope(catalog, room, path);
  const expectedSlotKeys = envelope.slots.map((slot) => slot.key);
  const bindings = new Map<string, EncounterSlotBinding>();
  for (const binding of room.encounterSlotBindings) {
    if (!expectedSlotKeys.includes(binding.slotKey)) {
      failProjectDocument(path, `${room.gameName} binds unknown encounter slot ${binding.slotKey}`);
    }
    if (bindings.has(binding.slotKey)) {
      failProjectDocument(path, `${room.gameName} binds ${binding.slotKey} more than once`);
    }
    bindings.set(binding.slotKey, binding);
  }
  if (bindings.size !== expectedSlotKeys.length) {
    const missing = expectedSlotKeys.find((slotKey) => !bindings.has(slotKey));
    failProjectDocument(path, `${room.gameName} omits encounter binding ${missing ?? '?'}`);
  }
  return bindings;
}

export function encounterEnvelopeSlots(
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): readonly EncounterEnvelopeSlot[] {
  return requireEnvelope(catalog, room, path).slots;
}

export function encounterSetForBinding(
  catalog: Catalog,
  binding: Extract<EncounterSlotBinding, { readonly kind: 'set' }>,
  path: string,
): EncounterSet {
  const set = catalog.encounterSets.byKey[binding.encounterSetKey];
  if (set === undefined) {
    failProjectDocument(path, `unknown encounter set ${binding.encounterSetKey}`);
  }
  return set;
}

export function encounterDefinitionForKey(
  catalog: Catalog,
  encounterKey: string,
  path: string,
): EncounterDefinition {
  const definition = catalog.encounterDefinitions.byKey[encounterKey];
  if (definition === undefined) {
    failProjectDocument(path, `unknown encounter definition ${encounterKey}`);
  }
  return definition;
}

export function selectedEncounterDefinitionKey(
  catalog: Catalog,
  room: RoomDeclaration,
  encounters: RoomEncounterState,
  slotKey: string,
  path: string,
): string {
  const binding = encounterBindingsBySlot(catalog, room, path).get(slotKey);
  if (binding === undefined) {
    failProjectDocument(path, `${room.gameName} has no encounter slot ${slotKey}`);
  }
  if (binding.kind === 'fixed') {
    if (encounters.encounterKeyByPhase[slotKey] !== undefined) {
      failProjectDocument(path, `${slotKey} is fixed and must not persist an authored selection`);
    }
    encounterDefinitionForKey(catalog, binding.encounterDefinitionKey, path);
    return binding.encounterDefinitionKey;
  }
  const encounterKey = encounters.encounterKeyByPhase[slotKey];
  if (encounterKey === undefined) {
    failProjectDocument(path, `${slotKey} has no authored encounter selection`);
  }
  const set = encounterSetForBinding(catalog, binding, path);
  if (!set.encounterDefinitionKeys.includes(encounterKey)) {
    failProjectDocument(path, `${encounterKey} is not available from ${set.key}`);
  }
  encounterDefinitionForKey(catalog, encounterKey, path);
  return encounterKey;
}

export function createDefaultRoomEncounterState(
  catalog: Catalog,
  room: RoomDeclaration,
  path = `rooms.${room.gameName}.encounters`,
): RoomEncounterState {
  const bindings = encounterBindingsBySlot(catalog, room, path);
  const values: Record<string, string> = {};
  for (const binding of bindings.values()) {
    if (binding.kind === 'fixed') {
      encounterDefinitionForKey(
        catalog,
        binding.encounterDefinitionKey,
        `${path}.${binding.slotKey}`,
      );
      continue;
    }
    const set = encounterSetForBinding(catalog, binding, `${path}.${binding.slotKey}`);
    if (!set.encounterDefinitionKeys.includes(set.defaultEncounterDefinitionKey)) {
      failProjectDocument(
        `${path}.${binding.slotKey}`,
        `${set.defaultEncounterDefinitionKey} is not a member of ${set.key}`,
      );
    }
    encounterDefinitionForKey(
      catalog,
      set.defaultEncounterDefinitionKey,
      `${path}.${binding.slotKey}`,
    );
    values[binding.slotKey] = set.defaultEncounterDefinitionKey;
  }
  const traitOffersByPhase: Record<string, Record<string, AuthoredTraitOffer>> = {};
  for (const binding of bindings.values()) {
    const encounterKey =
      binding.kind === 'fixed' ? binding.encounterDefinitionKey : values[binding.slotKey];
    if (encounterKey === undefined) continue;
    const offer = createDefaultEncounterTraitOffer(catalog, encounterKey);
    if (offer !== undefined) traitOffersByPhase[binding.slotKey] = { [encounterKey]: offer };
  }
  return Object.freeze({
    encounterKeyByPhase: Object.freeze(values),
    ...(Object.keys(traitOffersByPhase).length === 0
      ? {}
      : { traitOffersByPhase: Object.freeze(traitOffersByPhase) }),
  });
}

function decodeEncounterTraitOffer(
  value: unknown,
  catalog: Catalog,
  giverKey: string,
  path: string,
): AuthoredTraitOffer {
  const record = expectRecord(value, path);
  const conditionApplicable = traitGiverUsesOfferContext(
    catalog,
    giverKey,
    'deathDefianceConditionMet',
  );
  if (expectString(record.giverKey, `${path}.giverKey`) !== giverKey) {
    failProjectDocument(`${path}.giverKey`, `expected ${giverKey}`);
  }
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) failProjectDocument(path, `unknown giver ${giverKey}`);
  const kind = expectString(record.kind, `${path}.kind`);
  if (kind === 'fallbackGold') {
    expectExactKeys(record, ['kind', 'giverKey'], path);
    if (!traitOfferSupportsExhaustion(giver))
      failProjectDocument(path, 'Fallback Gold is not supported by this giver');
    return Object.freeze({ kind: 'fallbackGold', giverKey });
  }
  if (kind !== 'traits') failProjectDocument(`${path}.kind`, 'must be traits or fallbackGold');
  expectExactKeys(
    record,
    [
      'kind',
      'giverKey',
      'options',
      'selectedOptionKey',
      ...(conditionApplicable ? ['deathDefianceConditionMet'] : []),
    ],
    path,
  );
  const rawOptions = expectArray(record.options, `${path}.options`);
  if (rawOptions.length < 1 || rawOptions.length > TRAIT_OPTION_KEYS.length)
    failProjectDocument(`${path}.options`, 'must contain one to three options');
  if (!traitOfferSupportsExhaustion(giver) && rawOptions.length !== TRAIT_OPTION_KEYS.length)
    failProjectDocument(`${path}.options`, 'this giver requires exactly three options');
  const options: AuthoredTraitOption[] = [];
  const seen = new Set<string>();
  for (const [index, optionKey] of TRAIT_OPTION_KEYS.entries()) {
    if (index >= rawOptions.length) break;
    const option = expectRecord(rawOptions[index], `${path}.options.${optionKey}`);
    const hasRarity = option.rarity !== undefined;
    const hasTarget = option.targetTraitKey !== undefined;
    const hasCirceResolution = option.circeResolution !== undefined;
    expectExactKeys(
      option,
      [
        'traitKey',
        ...(hasRarity ? ['rarity'] : []),
        ...(hasTarget ? ['targetTraitKey'] : []),
        ...(hasCirceResolution ? ['circeResolution'] : []),
      ],
      `${path}.options.${optionKey}`,
    );
    const traitKey = expectString(option.traitKey, `${path}.options.${optionKey}.traitKey`);
    if (seen.has(traitKey))
      failProjectDocument(`${path}.options.${optionKey}`, `${traitKey} is duplicated`);
    seen.add(traitKey);
    const trait = catalog.traits.byKey[traitKey];
    if (trait === undefined || !giver.traitKeys.includes(traitKey))
      failProjectDocument(
        `${path}.options.${optionKey}.traitKey`,
        `${traitKey} is not in giver ${giverKey}`,
      );
    const rarity = hasRarity
      ? expectString(option.rarity, `${path}.options.${optionKey}.rarity`)
      : undefined;
    if (trait.rarityDomain.kind === 'none' && rarity !== undefined)
      failProjectDocument(`${path}.options.${optionKey}.rarity`, 'Hammer options have no rarity');
    if (
      trait.rarityDomain.kind === 'ranked' &&
      (rarity === undefined || !trait.rarityDomain.equippedRarities.includes(rarity as never))
    )
      failProjectDocument(
        `${path}.options.${optionKey}.rarity`,
        `unsupported authored rarity for ${traitKey}`,
      );
    if (giver.rarityPolicy.kind === 'fixed' && rarity !== giver.rarityPolicy.rarity)
      failProjectDocument(
        `${path}.options.${optionKey}.rarity`,
        `${traitKey} must use fixed rarity ${giver.rarityPolicy.rarity}`,
      );
    const targetTraitKey = hasTarget
      ? expectString(option.targetTraitKey, `${path}.options.${optionKey}.targetTraitKey`)
      : undefined;
    let circeResolution: AuthoredCirceResolution | undefined;
    if (hasCirceResolution) {
      const resolution = expectRecord(
        option.circeResolution,
        `${path}.options.${optionKey}.circeResolution`,
      );
      const kind = expectString(
        resolution.kind,
        `${path}.options.${optionKey}.circeResolution.kind`,
      );
      if (kind === 'disableFear') {
        expectExactKeys(
          resolution,
          ['kind', 'vowKey'],
          `${path}.options.${optionKey}.circeResolution`,
        );
        if (resolution.vowKey !== null && typeof resolution.vowKey !== 'string')
          failProjectDocument(
            `${path}.options.${optionKey}.circeResolution.vowKey`,
            'must be a Vow key or null',
          );
        if (
          typeof resolution.vowKey === 'string' &&
          catalog.fearVows.byKey[resolution.vowKey] === undefined
        )
          failProjectDocument(`${path}.options.${optionKey}.circeResolution.vowKey`, 'unknown Vow');
        circeResolution = Object.freeze({ kind, vowKey: resolution.vowKey as string | null });
      } else if (kind === 'activateArcana' || kind === 'promoteArcana') {
        expectExactKeys(
          resolution,
          ['kind', 'arcanaKeys'],
          `${path}.options.${optionKey}.circeResolution`,
        );
        const keys = expectArray(
          resolution.arcanaKeys,
          `${path}.options.${optionKey}.circeResolution.arcanaKeys`,
        ).map((entry, keyIndex) =>
          expectString(
            entry,
            `${path}.options.${optionKey}.circeResolution.arcanaKeys[${keyIndex}]`,
          ),
        );
        if (
          keys.length > catalog.arcanaCards.values.length ||
          new Set(keys).size !== keys.length ||
          keys.some((key) => catalog.arcanaCards.byKey[key] === undefined)
        )
          failProjectDocument(
            `${path}.options.${optionKey}.circeResolution`,
            'must contain distinct known Arcana keys',
          );
        circeResolution = Object.freeze({
          kind,
          arcanaKeys: Object.freeze(
            catalog.arcanaCards.values
              .filter((card) => keys.includes(card.key))
              .map((card) => card.key),
          ),
        });
      } else
        failProjectDocument(
          `${path}.options.${optionKey}.circeResolution.kind`,
          'unknown Circe resolution',
        );
      const expected =
        trait.selectedDisposition.kind === 'circe' ? trait.selectedDisposition.effect : undefined;
      if (expected === undefined || circeResolution!.kind !== expected)
        failProjectDocument(
          `${path}.options.${optionKey}.circeResolution`,
          'does not match the selected Circe trait policy',
        );
    }
    if (targetTraitKey !== undefined) {
      if (trait.targetedAcquisition === undefined)
        failProjectDocument(
          `${path}.options.${optionKey}.targetTraitKey`,
          `${traitKey} does not target another trait on acquisition`,
        );
      if (catalog.traits.byKey[targetTraitKey] === undefined)
        failProjectDocument(
          `${path}.options.${optionKey}.targetTraitKey`,
          `unknown trait ${targetTraitKey}`,
        );
    }
    const decodedOption: AuthoredTraitOption =
      rarity === undefined
        ? {
            traitKey,
            ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
            ...(circeResolution === undefined ? {} : { circeResolution }),
          }
        : {
            traitKey,
            rarity: rarity as NonNullable<AuthoredTraitOption['rarity']>,
            ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
            ...(circeResolution === undefined ? {} : { circeResolution }),
          };
    options.push(Object.freeze(decodedOption));
  }
  const selectedOptionKey = expectString(record.selectedOptionKey, `${path}.selectedOptionKey`);
  if (
    !(TRAIT_OPTION_KEYS as readonly string[]).includes(selectedOptionKey) ||
    options[TRAIT_OPTION_KEYS.indexOf(selectedOptionKey as never)] === undefined
  )
    failProjectDocument(`${path}.selectedOptionKey`, 'must select option1, option2, or option3');
  return Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: selectedOptionKey as AuthoredTraitOfferTraits['selectedOptionKey'],
    ...(conditionApplicable
      ? {
          deathDefianceConditionMet: expectBoolean(
            record.deathDefianceConditionMet,
            `${path}.deathDefianceConditionMet`,
          ),
        }
      : {}),
  });
}

function legalTraitOfferEncounterKeys(
  catalog: Catalog,
  binding: EncounterSlotBinding,
): readonly string[] {
  if (binding.kind === 'fixed') return [];
  return encounterSetForBinding(catalog, binding, 'encounter trait offers').encounterDefinitionKeys;
}

export function decodeRoomEncounterState(
  value: unknown,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): RoomEncounterState {
  const state = expectRecord(value, path);
  expectExactKeys(
    state,
    state.traitOffersByPhase === undefined
      ? ['encounterKeyByPhase']
      : ['encounterKeyByPhase', 'traitOffersByPhase'],
    path,
  );
  const rawSelections = expectRecord(state.encounterKeyByPhase, `${path}.encounterKeyByPhase`);
  const bindings = encounterBindingsBySlot(catalog, room, path);
  const selectedSlotKeys = [...bindings.values()]
    .filter(
      (binding): binding is Extract<EncounterSlotBinding, { readonly kind: 'set' }> =>
        binding.kind === 'set',
    )
    .map((binding) => binding.slotKey);
  expectExactKeys(rawSelections, selectedSlotKeys, `${path}.encounterKeyByPhase`);
  const encounterKeyByPhase: Record<string, string> = {};
  for (const slotKey of selectedSlotKeys) {
    const encounterKey = expectString(
      rawSelections[slotKey],
      `${path}.encounterKeyByPhase.${slotKey}`,
    );
    const binding = bindings.get(slotKey);
    if (binding?.kind !== 'set') {
      failProjectDocument(`${path}.encounterKeyByPhase.${slotKey}`, 'has no selectable binding');
    }
    const set = encounterSetForBinding(catalog, binding, `${path}.encounterKeyByPhase.${slotKey}`);
    if (!set.encounterDefinitionKeys.includes(encounterKey)) {
      failProjectDocument(
        `${path}.encounterKeyByPhase.${slotKey}`,
        `${encounterKey} is not a member of ${set.key}`,
      );
    }
    encounterDefinitionForKey(catalog, encounterKey, `${path}.encounterKeyByPhase.${slotKey}`);
    encounterKeyByPhase[slotKey] = encounterKey;
  }
  const traitOffersByPhase: Record<string, Record<string, AuthoredTraitOffer>> = {};
  if (state.traitOffersByPhase !== undefined) {
    const rawByPhase = expectRecord(state.traitOffersByPhase, `${path}.traitOffersByPhase`);
    // Fixed phases are persistable only when their declaration owns a trait
    // offer; selectable phases retain the established sparse offer surface.
    const legalPhaseKeys = [...bindings.values()]
      .filter((binding) => {
        if (binding.kind === 'fixed') {
          return (
            catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]
              ?.traitOfferProducer !== undefined
          );
        }
        return true;
      })
      .map((binding) => binding.slotKey);
    for (const phaseKey of Object.keys(rawByPhase)) {
      if (!legalPhaseKeys.includes(phaseKey))
        failProjectDocument(`${path}.traitOffersByPhase.${phaseKey}`, 'unknown encounter phase');
      const binding = bindings.get(phaseKey);
      if (binding === undefined)
        failProjectDocument(`${path}.traitOffersByPhase.${phaseKey}`, 'unknown encounter phase');
      const rawByEncounter = expectRecord(
        rawByPhase[phaseKey],
        `${path}.traitOffersByPhase.${phaseKey}`,
      );
      const legalEncounterKeys =
        binding.kind === 'fixed'
          ? [binding.encounterDefinitionKey]
          : legalTraitOfferEncounterKeys(catalog, binding);
      if (Object.keys(rawByEncounter).length === 0)
        failProjectDocument(`${path}.traitOffersByPhase.${phaseKey}`, 'must not be empty');
      const phaseOffers: Record<string, AuthoredTraitOffer> = {};
      for (const encounterKey of Object.keys(rawByEncounter)) {
        if (!legalEncounterKeys.includes(encounterKey))
          failProjectDocument(
            `${path}.traitOffersByPhase.${phaseKey}.${encounterKey}`,
            'is not available from this encounter set',
          );
        const producer = catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer;
        if (producer === undefined)
          failProjectDocument(
            `${path}.traitOffersByPhase.${phaseKey}.${encounterKey}`,
            'encounter has no trait offer producer',
          );
        phaseOffers[encounterKey] = decodeEncounterTraitOffer(
          rawByEncounter[encounterKey],
          catalog,
          producer.giverKey,
          `${path}.traitOffersByPhase.${phaseKey}.${encounterKey}`,
        );
      }
      traitOffersByPhase[phaseKey] = phaseOffers;
    }
  }
  return Object.freeze({
    encounterKeyByPhase: Object.freeze(encounterKeyByPhase),
    ...(Object.keys(traitOffersByPhase).length === 0
      ? {}
      : { traitOffersByPhase: Object.freeze(traitOffersByPhase) }),
  });
}

/**
 * Replacement preserves only an exact stable slot whose retained concrete
 * definition is still legal in the replacement slot's declared set. It never
 * consults current simulation eligibility or repairs a context-invalid choice.
 */
export function reconcileRoomEncounterState(
  catalog: Catalog,
  previousRoom: RoomDeclaration,
  previous: RoomEncounterState,
  replacementRoom: RoomDeclaration,
  replacement: RoomEncounterState,
): RoomEncounterState {
  const previousBindings = encounterBindingsBySlot(
    catalog,
    previousRoom,
    `rooms.${previousRoom.gameName}.encounters`,
  );
  const replacementBindings = encounterBindingsBySlot(
    catalog,
    replacementRoom,
    `rooms.${replacementRoom.gameName}.encounters`,
  );
  const selections: Record<string, string> = {};
  for (const binding of replacementBindings.values()) {
    if (binding.kind !== 'set') continue;
    const fallback = replacement.encounterKeyByPhase[binding.slotKey];
    if (fallback === undefined) {
      failProjectDocument(
        `rooms.${replacementRoom.gameName}.encounters.${binding.slotKey}`,
        'replacement default is missing',
      );
    }
    const previousBinding = previousBindings.get(binding.slotKey);
    const retained = previous.encounterKeyByPhase[binding.slotKey];
    const set = encounterSetForBinding(
      catalog,
      binding,
      `rooms.${replacementRoom.gameName}.encounters.${binding.slotKey}`,
    );
    selections[binding.slotKey] =
      previousBinding?.kind === 'set' &&
      retained !== undefined &&
      set.encounterDefinitionKeys.includes(retained)
        ? retained
        : fallback;
  }
  const traitOffersByPhase: Record<string, Record<string, AuthoredTraitOffer>> = {};
  for (const binding of replacementBindings.values()) {
    const selected =
      binding.kind === 'fixed' ? binding.encounterDefinitionKey : selections[binding.slotKey];
    const legalKeys = new Set(
      binding.kind === 'fixed'
        ? [binding.encounterDefinitionKey]
        : encounterSetForBinding(
            catalog,
            binding,
            `rooms.${replacementRoom.gameName}.encounters.${binding.slotKey}`,
          ).encounterDefinitionKeys,
    );
    const priorPhase = previous.traitOffersByPhase?.[binding.slotKey];
    const phaseOffers: Record<string, AuthoredTraitOffer> = {};
    if (priorPhase !== undefined) {
      for (const [encounterKey, offer] of Object.entries(priorPhase)) {
        if (
          legalKeys.has(encounterKey) &&
          catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer?.giverKey ===
            offer.giverKey
        ) {
          phaseOffers[encounterKey] = offer;
        }
      }
    }
    if (selected !== undefined && phaseOffers[selected] === undefined) {
      const fallback = createDefaultEncounterTraitOffer(catalog, selected);
      if (fallback !== undefined) phaseOffers[selected] = fallback;
    }
    if (Object.keys(phaseOffers).length > 0) traitOffersByPhase[binding.slotKey] = phaseOffers;
  }
  return Object.freeze({
    encounterKeyByPhase: Object.freeze(selections),
    ...(Object.keys(traitOffersByPhase).length === 0
      ? {}
      : { traitOffersByPhase: Object.freeze(traitOffersByPhase) }),
  });
}
