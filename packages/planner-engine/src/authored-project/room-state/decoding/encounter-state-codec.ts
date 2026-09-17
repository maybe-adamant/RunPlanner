import type { Catalog, EncounterSlotBinding, RoomDeclaration } from '../../../catalog-schema';
import type {
  AuthoredEncounterCustomization,
  AuthoredNemesisRandomEventOutcome,
  RoomEncounterState,
} from '../../model';
import {
  normalizeAuthoredTranscendentEmbryoOutcome,
  type AuthoredTraitOffer,
  type AuthoredTranscendentEmbryoOutcome,
} from '../../traits/state';
import {
  expectArray,
  expectBoolean,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../../validation';
import {
  encounterAuthoringProfileForKey,
  encounterBindingsBySlot,
  directEncounterDefinitionKeyForSlot,
  encounterSetForBinding,
} from '../encounter-envelope';
import {
  customizationDecisionOwned,
  customizationValueKnown,
  encounterCustomizationDeclarations,
} from '../encounter-customization';
import {
  decodeEncounterTraitOffer,
  legalTraitOfferEncounterKeys,
} from './encounter-trait-offer-codec';
import { decodeGorgonPhaseResults } from './gorgon-outcome-codec';
import { decodeNemesisRandomEventOutcome } from './nemesis-outcome-codec';

export function decodeRoomEncounterState(
  value: unknown,
  catalog: Catalog,
  room: RoomDeclaration,
  path: string,
): RoomEncounterState {
  const state = expectRecord(value, path);
  expectExactKeys(
    state,
    [
      'encounterKeyByPhase',
      'figLeafSkipByPhase',
      'gorgonResultByPhase',
      ...(state.traitOffersByPhase === undefined ? [] : ['traitOffersByPhase']),
      ...(state.nemesisRandomEventByPhase === undefined ? [] : ['nemesisRandomEventByPhase']),
      ...(state.customizationByPhase === undefined ? [] : ['customizationByPhase']),
      ...(state.steadyGrowthTargetByPhase === undefined ? [] : ['steadyGrowthTargetByPhase']),
      ...(state.judgmentArcanaKeysByPhase === undefined ? [] : ['judgmentArcanaKeysByPhase']),
      ...(state.figurineArcanaKeysByPhase === undefined ? [] : ['figurineArcanaKeysByPhase']),
      ...(state.transcendentEmbryoBlessingByPhase === undefined
        ? []
        : ['transcendentEmbryoBlessingByPhase']),
    ],
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
    encounterAuthoringProfileForKey(set, encounterKey, `${path}.encounterKeyByPhase.${slotKey}`);
    encounterKeyByPhase[slotKey] = encounterKey;
  }
  const rawSkips = expectRecord(state.figLeafSkipByPhase, `${path}.figLeafSkipByPhase`);
  const figLeafSkipByPhase: Record<string, boolean> = {};
  expectExactKeys(rawSkips, [...bindings.keys()], `${path}.figLeafSkipByPhase`);
  for (const phaseKey of bindings.keys()) {
    figLeafSkipByPhase[phaseKey] = expectBoolean(
      rawSkips[phaseKey],
      `${path}.figLeafSkipByPhase.${phaseKey}`,
    );
  }
  const steadyGrowthTargetByPhase: Record<string, string> = {};
  if (state.steadyGrowthTargetByPhase !== undefined) {
    const rawTargets = expectRecord(
      state.steadyGrowthTargetByPhase,
      `${path}.steadyGrowthTargetByPhase`,
    );
    for (const [phaseKey, value] of Object.entries(rawTargets)) {
      if (!bindings.has(phaseKey))
        failProjectDocument(`${path}.steadyGrowthTargetByPhase.${phaseKey}`, 'unknown phase');
      const traitKey = expectNonBlankString(value, `${path}.steadyGrowthTargetByPhase.${phaseKey}`);
      if (catalog.traits.byKey[traitKey] === undefined)
        failProjectDocument(`${path}.steadyGrowthTargetByPhase.${phaseKey}`, 'unknown trait');
      steadyGrowthTargetByPhase[phaseKey] = traitKey;
    }
  }
  const judgmentArcanaKeysByPhase: Record<string, readonly string[]> = {};
  if (state.judgmentArcanaKeysByPhase !== undefined) {
    if (room.mode.kind !== 'authored' || room.mode.templateKey !== 'Boss')
      failProjectDocument(
        `${path}.judgmentArcanaKeysByPhase`,
        'is owned only by a Boss occurrence',
      );
    const values = expectRecord(
      state.judgmentArcanaKeysByPhase,
      `${path}.judgmentArcanaKeysByPhase`,
    );
    for (const [phaseKey, rawKeys] of Object.entries(values)) {
      if (!bindings.has(phaseKey))
        failProjectDocument(`${path}.judgmentArcanaKeysByPhase.${phaseKey}`, 'unknown Boss phase');
      const seen = new Set<string>();
      for (const key of expectArray(rawKeys, `${path}.judgmentArcanaKeysByPhase.${phaseKey}`)) {
        const arcanaKey = expectNonBlankString(
          key,
          `${path}.judgmentArcanaKeysByPhase.${phaseKey}`,
        );
        if (catalog.arcanaCards.byKey[arcanaKey] === undefined || seen.has(arcanaKey))
          failProjectDocument(
            `${path}.judgmentArcanaKeysByPhase.${phaseKey}`,
            'must contain distinct declared Arcana cards',
          );
        seen.add(arcanaKey);
      }
      judgmentArcanaKeysByPhase[phaseKey] = Object.freeze(
        catalog.arcanaCards.values.filter((card) => seen.has(card.key)).map((card) => card.key),
      );
    }
  }
  const figurineArcanaKeysByPhase: Record<string, readonly string[]> = {};
  if (state.figurineArcanaKeysByPhase !== undefined) {
    if (room.mode.kind !== 'authored' || room.mode.templateKey !== 'Boss')
      failProjectDocument(
        `${path}.figurineArcanaKeysByPhase`,
        'is owned only by a Boss occurrence',
      );
    const values = expectRecord(
      state.figurineArcanaKeysByPhase,
      `${path}.figurineArcanaKeysByPhase`,
    );
    for (const [phaseKey, rawKeys] of Object.entries(values)) {
      if (!bindings.has(phaseKey))
        failProjectDocument(`${path}.figurineArcanaKeysByPhase.${phaseKey}`, 'unknown Boss phase');
      const seen = new Set<string>();
      for (const key of expectArray(rawKeys, `${path}.figurineArcanaKeysByPhase.${phaseKey}`)) {
        const arcanaKey = expectNonBlankString(
          key,
          `${path}.figurineArcanaKeysByPhase.${phaseKey}`,
        );
        if (catalog.arcanaCards.byKey[arcanaKey] === undefined || seen.has(arcanaKey))
          failProjectDocument(
            `${path}.figurineArcanaKeysByPhase.${phaseKey}`,
            'must contain distinct declared Arcana cards',
          );
        seen.add(arcanaKey);
      }
      figurineArcanaKeysByPhase[phaseKey] = Object.freeze(
        catalog.arcanaCards.values.filter((card) => seen.has(card.key)).map((card) => card.key),
      );
    }
  }
  const transcendentEmbryoBlessingByPhase: Record<string, AuthoredTranscendentEmbryoOutcome> = {};
  if (state.transcendentEmbryoBlessingByPhase !== undefined) {
    const values = expectRecord(
      state.transcendentEmbryoBlessingByPhase,
      `${path}.transcendentEmbryoBlessingByPhase`,
    );
    for (const [phaseKey, value] of Object.entries(values)) {
      if (!bindings.has(phaseKey))
        failProjectDocument(
          `${path}.transcendentEmbryoBlessingByPhase.${phaseKey}`,
          'unknown encounter phase',
        );
      const outcome = expectRecord(value, `${path}.transcendentEmbryoBlessingByPhase.${phaseKey}`);
      expectExactKeys(
        outcome,
        ['blessingKey', 'blessingValues'],
        `${path}.transcendentEmbryoBlessingByPhase.${phaseKey}`,
      );
      const blessingKey = expectNonBlankString(
        outcome.blessingKey,
        `${path}.transcendentEmbryoBlessingByPhase.${phaseKey}.blessingKey`,
      );
      const rawValues = expectRecord(
        outcome.blessingValues,
        `${path}.transcendentEmbryoBlessingByPhase.${phaseKey}.blessingValues`,
      );
      const blessingValues: Record<string, number> = {};
      for (const [key, rawValue] of Object.entries(rawValues)) {
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue))
          failProjectDocument(
            `${path}.transcendentEmbryoBlessingByPhase.${phaseKey}.blessingValues.${key}`,
            'must be a finite number',
          );
        blessingValues[key] = rawValue;
      }
      try {
        transcendentEmbryoBlessingByPhase[phaseKey] = normalizeAuthoredTranscendentEmbryoOutcome(
          catalog,
          {
            blessingKey,
            blessingValues,
          },
        );
      } catch (error) {
        failProjectDocument(
          `${path}.transcendentEmbryoBlessingByPhase.${phaseKey}.blessingValues`,
          error instanceof Error ? error.message : 'has invalid declared operand values',
        );
      }
    }
  }
  const gorgonResultByPhase = decodeGorgonPhaseResults(
    state.gorgonResultByPhase,
    catalog,
    bindings,
    `${path}.gorgonResultByPhase`,
  );
  const traitOffersByPhase: Record<string, Record<string, AuthoredTraitOffer | null>> = {};
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
      const phaseOffers: Record<string, AuthoredTraitOffer | null> = {};
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
        phaseOffers[encounterKey] =
          rawByEncounter[encounterKey] === null
            ? null
            : decodeEncounterTraitOffer(
                rawByEncounter[encounterKey],
                catalog,
                producer.giverKey,
                `${path}.traitOffersByPhase.${phaseKey}.${encounterKey}`,
              );
      }
      traitOffersByPhase[phaseKey] = phaseOffers;
    }
  }
  for (const binding of bindings.values()) {
    const encounterKey = directEncounterDefinitionKeyForSlot(
      catalog,
      room,
      { encounterKeyByPhase },
      binding.slotKey,
      path,
    );
    if (
      encounterKey !== undefined &&
      catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer !== undefined &&
      !Object.hasOwn(traitOffersByPhase[binding.slotKey] ?? {}, encounterKey)
    )
      failProjectDocument(
        `${path}.traitOffersByPhase.${binding.slotKey}.${encounterKey}`,
        'is required for the selected trait-producing encounter',
      );
  }
  const nemesisRandomEventByPhase: Record<string, AuthoredNemesisRandomEventOutcome | null> = {};
  if (state.nemesisRandomEventByPhase !== undefined) {
    const rawByPhase = expectRecord(
      state.nemesisRandomEventByPhase,
      `${path}.nemesisRandomEventByPhase`,
    );
    for (const [phaseKey, rawOutcome] of Object.entries(rawByPhase)) {
      const binding = bindings.get(phaseKey);
      if (binding === undefined || binding.kind !== 'set')
        failProjectDocument(
          `${path}.nemesisRandomEventByPhase.${phaseKey}`,
          'has no selectable event phase',
        );
      const set = encounterSetForBinding(
        catalog,
        binding,
        `${path}.nemesisRandomEventByPhase.${phaseKey}`,
      );
      if (!set.encounterDefinitionKeys.includes('NemesisRandomEvent'))
        failProjectDocument(
          `${path}.nemesisRandomEventByPhase.${phaseKey}`,
          'does not own NemesisRandomEvent',
        );
      nemesisRandomEventByPhase[phaseKey] =
        rawOutcome === null
          ? null
          : decodeNemesisRandomEventOutcome(
              rawOutcome,
              catalog,
              `${path}.nemesisRandomEventByPhase.${phaseKey}`,
            );
    }
  }
  for (const [phaseKey] of Object.entries(encounterKeyByPhase)) {
    const encounterKey = directEncounterDefinitionKeyForSlot(
      catalog,
      room,
      { encounterKeyByPhase },
      phaseKey,
      path,
    );
    if (encounterKey === 'NemesisRandomEvent' && nemesisRandomEventByPhase[phaseKey] === undefined)
      failProjectDocument(
        `${path}.nemesisRandomEventByPhase.${phaseKey}`,
        'is required for the selected Nemesis random event',
      );
  }
  const customizationByPhase: Record<string, Record<string, AuthoredEncounterCustomization>> = {};
  if (state.customizationByPhase !== undefined) {
    const rawByPhase = expectRecord(state.customizationByPhase, `${path}.customizationByPhase`);
    for (const [phaseKey, rawDecisions] of Object.entries(rawByPhase)) {
      const binding = bindings.get(phaseKey);
      if (binding === undefined)
        failProjectDocument(`${path}.customizationByPhase.${phaseKey}`, 'unknown encounter phase');
      const declarations = encounterCustomizationDeclarations(catalog, room, binding);
      const decisions: Record<string, AuthoredEncounterCustomization> = {};
      for (const [decisionKey, rawValue] of Object.entries(
        expectRecord(rawDecisions, `${path}.customizationByPhase.${phaseKey}`),
      )) {
        if (!customizationDecisionOwned(declarations.active, decisionKey))
          failProjectDocument(
            `${path}.customizationByPhase.${phaseKey}.${decisionKey}`,
            'is not declared for this encounter phase',
          );
        const value = expectRecord(
          rawValue,
          `${path}.customizationByPhase.${phaseKey}.${decisionKey}`,
        );
        const kind = expectString(
          value.kind,
          `${path}.customizationByPhase.${phaseKey}.${decisionKey}.kind`,
        );
        if (kind === 'single') {
          expectExactKeys(
            value,
            ['kind', 'choiceKey'],
            `${path}.customizationByPhase.${phaseKey}.${decisionKey}`,
          );
          const choiceKey = expectNonBlankString(
            value.choiceKey,
            `${path}.customizationByPhase.${phaseKey}.${decisionKey}.choiceKey`,
          );
          const parsed = Object.freeze({ kind: 'single' as const, choiceKey });
          if (!customizationValueKnown(declarations.structural, decisionKey, parsed))
            failProjectDocument(
              `${path}.customizationByPhase.${phaseKey}.${decisionKey}.choiceKey`,
              'is not declaration-known',
            );
          decisions[decisionKey] = Object.freeze({ kind: 'single', choiceKey });
        } else if (kind === 'orderedPrefix') {
          expectExactKeys(
            value,
            ['kind', 'choiceKeys'],
            `${path}.customizationByPhase.${phaseKey}.${decisionKey}`,
          );
          const choiceKeys = expectArray(
            value.choiceKeys,
            `${path}.customizationByPhase.${phaseKey}.${decisionKey}.choiceKeys`,
          ).map((choice, index) =>
            expectNonBlankString(
              choice,
              `${path}.customizationByPhase.${phaseKey}.${decisionKey}.choiceKeys[${index}]`,
            ),
          );
          const parsed = Object.freeze({
            kind: 'orderedPrefix' as const,
            choiceKeys: Object.freeze(choiceKeys),
          });
          if (!customizationValueKnown(declarations.structural, decisionKey, parsed))
            failProjectDocument(
              `${path}.customizationByPhase.${phaseKey}.${decisionKey}.choiceKeys`,
              'must be a distinct bounded declaration-known prefix',
            );
          decisions[decisionKey] = Object.freeze({
            kind: 'orderedPrefix',
            choiceKeys: Object.freeze(choiceKeys),
          });
        } else {
          failProjectDocument(
            `${path}.customizationByPhase.${phaseKey}.${decisionKey}.kind`,
            'is unsupported',
          );
        }
      }
      if (Object.keys(decisions).length === 0)
        failProjectDocument(`${path}.customizationByPhase.${phaseKey}`, 'must not be empty');
      customizationByPhase[phaseKey] = decisions;
    }
  }
  return Object.freeze({
    encounterKeyByPhase: Object.freeze(encounterKeyByPhase),
    figLeafSkipByPhase: Object.freeze(figLeafSkipByPhase),
    ...(Object.keys(steadyGrowthTargetByPhase).length === 0
      ? {}
      : { steadyGrowthTargetByPhase: Object.freeze(steadyGrowthTargetByPhase) }),
    ...(Object.keys(judgmentArcanaKeysByPhase).length === 0
      ? {}
      : { judgmentArcanaKeysByPhase: Object.freeze(judgmentArcanaKeysByPhase) }),
    ...(Object.keys(figurineArcanaKeysByPhase).length === 0
      ? {}
      : { figurineArcanaKeysByPhase: Object.freeze(figurineArcanaKeysByPhase) }),
    ...(Object.keys(transcendentEmbryoBlessingByPhase).length === 0
      ? {}
      : {
          transcendentEmbryoBlessingByPhase: Object.freeze(transcendentEmbryoBlessingByPhase),
        }),
    gorgonResultByPhase: Object.freeze(gorgonResultByPhase),
    ...(Object.keys(traitOffersByPhase).length === 0
      ? {}
      : { traitOffersByPhase: Object.freeze(traitOffersByPhase) }),
    ...(Object.keys(nemesisRandomEventByPhase).length === 0
      ? {}
      : { nemesisRandomEventByPhase: Object.freeze(nemesisRandomEventByPhase) }),
    ...(Object.keys(customizationByPhase).length === 0
      ? {}
      : { customizationByPhase: Object.freeze(customizationByPhase) }),
  });
}
