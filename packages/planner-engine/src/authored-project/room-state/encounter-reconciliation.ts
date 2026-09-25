import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { RoomEncounterState } from '../model';
import type { AuthoredTraitOffer } from '../traits/state';
import { failProjectDocument } from '../validation';
import {
  encounterAuthoringProfiles,
  encounterBindingsBySlot,
  directEncounterDefinitionKeyForSlot,
  encounterSetForBinding,
} from './encounter-envelope';
import {
  customizationDecisionOwned,
  customizationValueRepresentable,
  encounterCustomizationDeclarations,
} from './encounter-customization';

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
  const figLeafSkipByPhase: Record<string, boolean> = {};
  const gorgonResultByPhase: Record<string, import('../model').AuthoredGorgonPhaseResult> = {};
  for (const binding of replacementBindings.values()) {
    figLeafSkipByPhase[binding.slotKey] = previous.figLeafSkipByPhase[binding.slotKey] === true;
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
      encounterAuthoringProfiles(set).some((profile) => profile.key === retained)
        ? retained
        : fallback;
  }
  for (const binding of replacementBindings.values()) {
    const hostsGorgon =
      binding.kind === 'fixed'
        ? catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]?.hostsGorgon === true
        : encounterSetForBinding(
            catalog,
            binding,
            `rooms.${replacementRoom.gameName}.encounters.${binding.slotKey}`,
          ).encounterDefinitionKeys.some(
            (key) => catalog.encounterDefinitions.byKey[key]?.hostsGorgon === true,
          );
    if (!hostsGorgon) continue;
    const priorGorgon = previous.gorgonResultByPhase[binding.slotKey];
    gorgonResultByPhase[binding.slotKey] =
      priorGorgon === undefined
        ? Object.freeze({ athenaTriggerConditionMet: false })
        : Object.freeze({
            athenaTriggerConditionMet: priorGorgon.athenaTriggerConditionMet,
            ...(priorGorgon.athenaOffer === undefined
              ? {}
              : { athenaOffer: priorGorgon.athenaOffer }),
          });
  }
  const traitOffersByPhase: Record<string, Record<string, AuthoredTraitOffer | null>> = {};
  const customizationByPhase: Record<
    string,
    Record<string, import('../model').AuthoredEncounterCustomization>
  > = {};
  for (const binding of replacementBindings.values()) {
    const selected = directEncounterDefinitionKeyForSlot(
      catalog,
      replacementRoom,
      Object.freeze({
        encounterKeyByPhase: Object.freeze(selections),
        figLeafSkipByPhase: Object.freeze(figLeafSkipByPhase),
        gorgonResultByPhase: Object.freeze(gorgonResultByPhase),
      }),
      binding.slotKey,
      `rooms.${replacementRoom.gameName}.encounters.${binding.slotKey}`,
    );
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
    const phaseOffers: Record<string, AuthoredTraitOffer | null> = {};
    if (priorPhase !== undefined) {
      for (const [encounterKey, offer] of Object.entries(priorPhase)) {
        if (
          legalKeys.has(encounterKey) &&
          (offer === null ||
            catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer?.giverKey ===
              offer.giverKey)
        ) {
          phaseOffers[encounterKey] = offer;
        }
      }
    }
    if (
      selected !== undefined &&
      phaseOffers[selected] === undefined &&
      catalog.encounterDefinitions.byKey[selected]?.traitOfferProducer !== undefined
    )
      phaseOffers[selected] = null;
    if (Object.keys(phaseOffers).length > 0) traitOffersByPhase[binding.slotKey] = phaseOffers;
  }
  for (const binding of replacementBindings.values()) {
    const prior = previous.customizationByPhase?.[binding.slotKey];
    if (prior === undefined) continue;
    const declarations = encounterCustomizationDeclarations(catalog, replacementRoom, binding);
    const retained: Record<string, import('../model').AuthoredEncounterCustomization> = {};
    for (const [decisionKey, value] of Object.entries(prior)) {
      if (
        customizationDecisionOwned(declarations.active, decisionKey) &&
        customizationValueRepresentable(declarations.structural, decisionKey, value)
      )
        retained[decisionKey] = value;
    }
    if (Object.keys(retained).length > 0) customizationByPhase[binding.slotKey] = retained;
  }
  return Object.freeze({
    encounterKeyByPhase: Object.freeze(selections),
    figLeafSkipByPhase: Object.freeze(figLeafSkipByPhase),
    gorgonResultByPhase: Object.freeze(gorgonResultByPhase),
    ...(Object.keys(traitOffersByPhase).length === 0
      ? {}
      : { traitOffersByPhase: Object.freeze(traitOffersByPhase) }),
    ...(Object.keys(customizationByPhase).length === 0
      ? {}
      : { customizationByPhase: Object.freeze(customizationByPhase) }),
  });
}
