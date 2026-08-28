import type { Catalog, EncounterSlotBinding, RoomDeclaration } from '../../catalog-schema';
import type { AuthoredNemesisRandomEventOutcome, RoomEncounterState } from '../model';
import type { AuthoredTraitOffer } from '../traits';
import {
  expectArray,
  expectBoolean,
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';
import {
  encounterBindingsBySlot,
  encounterDefinitionForKey,
  encounterSetForBinding,
} from './encounter-envelope';
import { decodeEncounterTraitOffer, legalTraitOfferEncounterKeys } from './encounter-trait-offers';
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
    if (!set.encounterDefinitionKeys.includes(encounterKey)) {
      failProjectDocument(
        `${path}.encounterKeyByPhase.${slotKey}`,
        `${encounterKey} is not a member of ${set.key}`,
      );
    }
    encounterDefinitionForKey(catalog, encounterKey, `${path}.encounterKeyByPhase.${slotKey}`);
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
  const transcendentEmbryoBlessingByPhase: Record<string, string> = {};
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
      const blessingKey = expectNonBlankString(
        value,
        `${path}.transcendentEmbryoBlessingByPhase.${phaseKey}`,
      );
      if (
        catalog.chaos.blessings.byKey[blessingKey] === undefined ||
        catalog.chaos.blessings.byKey[blessingKey]?.fixedRarity !== undefined
      )
        failProjectDocument(
          `${path}.transcendentEmbryoBlessingByPhase.${phaseKey}`,
          'must be a declared in-run Chaos blessing',
        );
      transcendentEmbryoBlessingByPhase[phaseKey] = blessingKey;
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
    const encounterKey =
      binding.kind === 'fixed'
        ? binding.encounterDefinitionKey
        : encounterKeyByPhase[binding.slotKey];
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
  for (const [phaseKey, encounterKey] of Object.entries(encounterKeyByPhase)) {
    if (encounterKey === 'NemesisRandomEvent' && nemesisRandomEventByPhase[phaseKey] === undefined)
      failProjectDocument(
        `${path}.nemesisRandomEventByPhase.${phaseKey}`,
        'is required for the selected Nemesis random event',
      );
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
  });
}
