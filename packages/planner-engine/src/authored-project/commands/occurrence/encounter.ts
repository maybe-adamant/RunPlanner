import type { Catalog, EncounterSlotBinding, RoomDeclaration } from '../../../catalog-schema';
import type { EncounterPhaseAddress } from '../../addresses';
import type {
  AuthoredNemesisRandomEventKind,
  AuthoredNemesisRandomEventOutcome,
  ProjectDocument,
  RoomEncounterState,
} from '../../model';
import {
  encounterAuthoringProfiles,
  encounterBindingsBySlot,
  encounterSetForBinding,
} from '../../room-state/encounter-envelope';
import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from '../contract';
import { replaceOccurrence, updateOccurrenceTopology } from './mutation';
import { createUnresolvedPickupRewardState } from '../../traits/state';
import { nemesisGeneratedPickupSiteKey } from '../../acquisition/pickup-producers';
import { sameOccurrenceValue } from './leaf-value';
import type { EncounterOccurrenceCommand, NemesisRandomEventInteraction } from '../types';

function validateNemesisInteraction(
  catalog: Catalog,
  command: Extract<
    EncounterOccurrenceCommand,
    { readonly kind: 'ReplaceNemesisRandomEventInteraction' }
  >,
): void {
  const policy = catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent;
  if (policy === undefined) failCommand(command, 'catalog has no Nemesis random-event policy');
  if (
    command.value.kind === 'traitTrade' &&
    command.value.traitKey !== null &&
    catalog.traits.byKey[command.value.traitKey] === undefined
  )
    failCommand(command, 'trait trade target is not a catalog trait');
  const reward = nemesisInteractionReward(catalog, command);
  if (reward === null) return;
  const rewardType = reward.rewardType;
  switch (command.value.kind) {
    case 'freeItem':
      if (!(policy.freeItem.resultRewardTypes as readonly string[]).includes(rewardType))
        failCommand(command, 'free item result is outside its declared pool');
      return;
    case 'goldTrade': {
      const variant = policy.goldTrade.variants.find(
        (candidate) => candidate.rewardType === rewardType,
      );
      if (variant === undefined)
        failCommand(command, 'Gold trade result is outside its declared pool');
      return;
    }
    case 'damageTrade': {
      const variant = policy.damageTrade.variants.find(
        (candidate) => candidate.rewardType === rewardType,
      );
      if (variant === undefined)
        failCommand(command, 'damage trade result is outside its declared pool');
      return;
    }
    case 'traitTrade':
      if (rewardType !== policy.traitTrade.fixedResultRewardType)
        failCommand(command, 'trait trade must produce fixed Triple Gold');
      return;
    case 'damageContest':
      if (command.value.result === 'failure') {
        if (rewardType !== policy.damageContest.failureResultRewardType)
          failCommand(command, 'contest failure must produce fixed Consolation');
      } else if (
        !(policy.damageContest.successResultRewardTypes as readonly string[]).includes(rewardType)
      )
        failCommand(command, 'contest success result is outside its declared pool');
      return;
  }
}

function defaultNemesisOutcome(
  family: AuthoredNemesisRandomEventKind,
): AuthoredNemesisRandomEventOutcome {
  switch (family) {
    case 'freeItem':
      return Object.freeze({ kind: family });
    case 'goldTrade':
    case 'damageTrade':
      return Object.freeze({ kind: family, response: 'decline' });
    case 'traitTrade':
      return Object.freeze({ kind: family, traitKey: null, response: 'decline' });
    case 'damageContest':
      return Object.freeze({ kind: family, result: 'failure' });
  }
}

function interactionOutcome(
  value: NemesisRandomEventInteraction,
): AuthoredNemesisRandomEventOutcome {
  const { reward: _reward, ...outcome } = value;
  void _reward;
  return Object.freeze(outcome) as AuthoredNemesisRandomEventOutcome;
}

function fixedNemesisReward(
  catalog: Catalog,
  outcome: AuthoredNemesisRandomEventOutcome,
): import('../../../reward-kernel/model').ResolvedRewardOffer | null {
  const policy = catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent;
  if (policy === undefined) return null;
  if (outcome.kind === 'traitTrade')
    return Object.freeze({ rewardType: policy.traitTrade.fixedResultRewardType });
  if (outcome.kind === 'damageContest' && outcome.result === 'failure')
    return Object.freeze({ rewardType: policy.damageContest.failureResultRewardType });
  return null;
}

function selectableBinding(
  catalog: Catalog,
  room: RoomDeclaration,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): Extract<EncounterSlotBinding, { readonly kind: 'set' }> {
  const binding = encounterBindingsBySlot(catalog, room, room.gameName).get(phase.phaseKey);
  if (binding === undefined) {
    failCommand(command, `${room.gameName} has no encounter phase ${phase.phaseKey}`);
  }
  if (binding.kind !== 'set') {
    failCommand(command, `${room.gameName}.${phase.phaseKey} is a fixed encounter phase`);
  }
  return binding;
}

function gorgonSlotOwnedByDeclaration(
  catalog: Catalog,
  binding: EncounterSlotBinding,
  path: string,
): boolean {
  if (binding.kind === 'fixed') {
    return catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]?.hostsGorgon === true;
  }
  return encounterSetForBinding(catalog, binding, path).encounterDefinitionKeys.some(
    (key) => catalog.encounterDefinitions.byKey[key]?.hostsGorgon === true,
  );
}

function updatedSelections(
  catalog: Catalog,
  room: RoomDeclaration,
  current: RoomEncounterState,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): RoomEncounterState {
  if (
    command.kind === 'ReplaceFigLeafSkip' ||
    command.kind === 'ReplaceNemesisRandomEventInteraction' ||
    command.kind === 'ReplaceGorgonDeathDefianceCondition'
  )
    return current;
  const binding = selectableBinding(catalog, room, phase, command);
  const set = encounterSetForBinding(catalog, binding, room.gameName);
  const encounterKey =
    command.kind === 'ResetEncounter'
      ? set.defaultAuthoringProfileKey
      : command.kind === 'SelectNemesisRandomEventFamily'
        ? 'NemesisRandomEvent'
        : command.encounterKey;
  if (!encounterAuthoringProfiles(set).some((profile) => profile.key === encounterKey)) {
    failCommand(command, `${encounterKey} is not available from ${set.key}`);
  }
  const selectionUnchanged = current.encounterKeyByPhase[phase.phaseKey] === encounterKey;
  const priorOffers = current.traitOffersByPhase ?? {};
  const phaseOffers = { ...(priorOffers[phase.phaseKey] ?? {}) };
  const producer = catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer;
  if (selectionUnchanged && command.kind !== 'ResetEncounter') return current;
  if (selectionUnchanged && producer === undefined) return current;
  if (
    producer !== undefined &&
    (command.kind === 'ResetEncounter' || phaseOffers[encounterKey] === undefined)
  ) {
    phaseOffers[encounterKey] = null;
  }
  const traitOffersByPhase =
    Object.keys(phaseOffers).length === 0
      ? Object.keys(priorOffers).length === 0
        ? undefined
        : priorOffers
      : Object.freeze({ ...priorOffers, [phase.phaseKey]: Object.freeze(phaseOffers) });
  const gorgonResultByPhase = { ...(current.gorgonResultByPhase ?? {}) };
  if (gorgonSlotOwnedByDeclaration(catalog, binding, room.gameName)) {
    gorgonResultByPhase[phase.phaseKey] ??= { athenaTriggerConditionMet: false };
  }
  const priorNemesis = current.nemesisRandomEventByPhase ?? {};
  const nemesisRandomEventByPhase =
    encounterKey === 'NemesisRandomEvent' &&
    (command.kind === 'ResetEncounter' || priorNemesis[phase.phaseKey] === undefined)
      ? Object.freeze({
          ...priorNemesis,
          [phase.phaseKey]: null,
        })
      : current.nemesisRandomEventByPhase;
  return Object.freeze({
    encounterKeyByPhase: Object.freeze({
      ...current.encounterKeyByPhase,
      [phase.phaseKey]: encounterKey,
    }),
    figLeafSkipByPhase: current.figLeafSkipByPhase,
    gorgonResultByPhase: Object.freeze(gorgonResultByPhase),
    ...(traitOffersByPhase === undefined ? {} : { traitOffersByPhase }),
    ...(nemesisRandomEventByPhase === undefined ? {} : { nemesisRandomEventByPhase }),
  });
}

function updatedNemesisRandomEvent(
  catalog: Catalog,
  room: RoomDeclaration,
  current: RoomEncounterState,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): RoomEncounterState {
  if (
    command.kind !== 'SelectNemesisRandomEventFamily' &&
    command.kind !== 'ReplaceNemesisRandomEventInteraction'
  )
    return current;
  if (command.event.encounter.phaseKey !== phase.phaseKey)
    failCommand(command, 'event owner must match its encounter phase');
  const binding = selectableBinding(catalog, room, phase, command);
  const set = encounterSetForBinding(catalog, binding, room.gameName);
  if (!set.encounterDefinitionKeys.includes('NemesisRandomEvent'))
    failCommand(command, `${phase.phaseKey} does not support NemesisRandomEvent`);
  const selected = current.encounterKeyByPhase[phase.phaseKey];
  if (selected !== 'NemesisRandomEvent')
    failCommand(command, `${phase.phaseKey} has not selected NemesisRandomEvent`);
  const currentOutcome = current.nemesisRandomEventByPhase?.[phase.phaseKey];
  if (
    command.kind === 'SelectNemesisRandomEventFamily' &&
    currentOutcome !== null &&
    currentOutcome !== undefined &&
    currentOutcome.kind === command.family
  )
    return current;
  const outcome =
    command.kind === 'SelectNemesisRandomEventFamily'
      ? defaultNemesisOutcome(command.family)
      : (() => {
          if (currentOutcome === null || currentOutcome === undefined)
            failCommand(command, 'select a Nemesis event family before editing its interaction');
          if (currentOutcome.kind !== command.value.kind)
            failCommand(command, 'Nemesis interaction cannot change its selected family');
          validateNemesisInteraction(catalog, command);
          return interactionOutcome(command.value);
        })();
  return Object.freeze({
    ...current,
    nemesisRandomEventByPhase: Object.freeze({
      ...(current.nemesisRandomEventByPhase ?? {}),
      [phase.phaseKey]: outcome,
    }),
  });
}

function nemesisInteractionReward(
  catalog: Catalog,
  command: Extract<
    EncounterOccurrenceCommand,
    { readonly kind: 'SelectNemesisRandomEventFamily' | 'ReplaceNemesisRandomEventInteraction' }
  >,
): import('../../../reward-kernel/model').ResolvedRewardOffer | null {
  if (command.kind === 'SelectNemesisRandomEventFamily')
    return fixedNemesisReward(catalog, defaultNemesisOutcome(command.family));
  const fixed = fixedNemesisReward(catalog, command.value);
  if (fixed !== null) return fixed;
  if (
    command.value.kind === 'damageContest' &&
    command.value.result === 'success' &&
    command.value.reward?.rewardType ===
      catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent?.damageContest
        .failureResultRewardType
  )
    return null;
  return command.value.reward;
}

function hasActiveNemesisPickup(
  outcome: AuthoredNemesisRandomEventOutcome,
  reward: import('../../../reward-kernel/model').ResolvedRewardOffer | null,
): boolean {
  return reward !== null && !('response' in outcome && outcome.response === 'decline');
}

function updatedGorgonResult(
  catalog: Catalog,
  room: RoomDeclaration,
  current: RoomEncounterState,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): RoomEncounterState {
  if (command.kind !== 'ReplaceGorgonDeathDefianceCondition') return current;
  const binding = encounterBindingsBySlot(catalog, room, room.gameName).get(phase.phaseKey);
  if (binding === undefined)
    failCommand(command, `${room.gameName} has no encounter phase ${phase.phaseKey}`);
  const prior = current.gorgonResultByPhase?.[phase.phaseKey];
  if (prior === undefined)
    failCommand(command, `${room.gameName} has no Gorgon result ${phase.phaseKey}`);
  const selectedKey =
    binding.kind === 'fixed'
      ? binding.encounterDefinitionKey
      : current.encounterKeyByPhase[phase.phaseKey];
  if (selectedKey === undefined || !gorgonSlotOwnedByDeclaration(catalog, binding, room.gameName))
    failCommand(command, `${room.gameName}.${phase.phaseKey} is not a Gorgon-hosting declaration`);
  const nextOffer =
    command.value === true && prior.athenaOffer === undefined ? null : prior.athenaOffer;
  const next = Object.freeze({
    athenaTriggerConditionMet: command.value,
    ...(nextOffer === undefined ? {} : { athenaOffer: nextOffer }),
  });
  return Object.freeze({
    ...current,
    gorgonResultByPhase: Object.freeze({
      ...(current.gorgonResultByPhase ?? {}),
      [phase.phaseKey]: next,
    }),
  });
}

function updatedFigLeafSkip(
  catalog: Catalog,
  room: RoomDeclaration,
  current: RoomEncounterState,
  phase: EncounterPhaseAddress,
  command: EncounterOccurrenceCommand,
): RoomEncounterState {
  if (command.kind !== 'ReplaceFigLeafSkip') return current;
  const binding = encounterBindingsBySlot(catalog, room, room.gameName).get(phase.phaseKey);
  if (binding === undefined)
    failCommand(command, `${room.gameName} has no encounter phase ${phase.phaseKey}`);
  const next = { ...current.figLeafSkipByPhase, [phase.phaseKey]: command.value };
  return Object.freeze({
    ...current,
    figLeafSkipByPhase: Object.freeze(next),
  });
}

function replaceTopLevel(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: EncounterOccurrenceCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const phase =
    command.kind === 'SelectNemesisRandomEventFamily' ||
    command.kind === 'ReplaceNemesisRandomEventInteraction'
      ? command.event.encounter
      : command.phase;
  const occurrence = requireOccurrence(located.plan, phase.owner.occurrenceId, command);
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  const encounters = updatedSelections(catalog, room, occurrence.encounters, phase, command);
  const withFigLeaf = updatedFigLeafSkip(catalog, room, encounters, phase, command);
  const withGorgon = updatedGorgonResult(catalog, room, withFigLeaf, phase, command);
  const withNemesis = updatedNemesisRandomEvent(catalog, room, withGorgon, phase, command);
  if (withNemesis === occurrence.encounters) return document;
  const withEventSite =
    (command.kind !== 'SelectNemesisRandomEventFamily' &&
      command.kind !== 'ReplaceNemesisRandomEventInteraction') ||
    (command.kind === 'SelectNemesisRandomEventFamily' &&
      occurrence.encounters.nemesisRandomEventByPhase?.[phase.phaseKey]?.kind === command.family)
      ? occurrence
      : (() => {
          const siteKey = nemesisGeneratedPickupSiteKey(phase.phaseKey);
          const prior = occurrence.acquisitionSites?.[siteKey]?.pickupEntries?.result;
          const rewardOffer = nemesisInteractionReward(catalog, command);
          const outcome = withNemesis.nemesisRandomEventByPhase?.[phase.phaseKey];
          const sameOffer =
            prior !== undefined &&
            prior !== null &&
            rewardOffer !== null &&
            sameOccurrenceValue(prior.offer, rewardOffer);
          const reward =
            rewardOffer !== null
              ? sameOffer
                ? prior
                : createUnresolvedPickupRewardState(catalog, rewardOffer, 'NemesisEventPickup')
              : null;
          const pickupActive =
            outcome !== undefined &&
            outcome !== null &&
            hasActiveNemesisPickup(outcome, rewardOffer);
          return Object.freeze({
            ...occurrence,
            // Keep compatible offered detail, but retract an inactive or replaced pickup.
            ...(!pickupActive
              ? {
                  roomActions: Object.freeze({
                    order: Object.freeze(
                      occurrence.roomActions.order.filter(
                        (reference) =>
                          reference.kind !== 'interactAcquisitionEntry' ||
                          reference.siteKey !== siteKey ||
                          reference.entryKey !== 'result',
                      ),
                    ),
                  }),
                }
              : {}),
            ...(reward === null && prior === undefined
              ? {}
              : {
                  acquisitionSites: Object.freeze({
                    ...(occurrence.acquisitionSites ?? {}),
                    [siteKey]: Object.freeze({ pickupEntries: Object.freeze({ result: reward }) }),
                  }),
                }),
          });
        })();
  const suppressesIncomingReward = Object.values(withNemesis.encounterKeyByPhase).some(
    (encounterKey) =>
      catalog.encounterDefinitions.byKey[encounterKey]?.suppressesIncomingReward === true,
  );
  // F/G's draw remains authored, but the selected event disables its producer
  // lifecycle entirely. Remove the now-stale interaction from persisted room
  // chronology; selecting another encounter lets normal action reconciliation
  // restore any declaration-required incoming action.
  const roomActions = suppressesIncomingReward
    ? Object.freeze({
        order: Object.freeze(
          withEventSite.roomActions.order.filter(
            (reference) => reference.kind !== 'interactIncomingReward',
          ),
        ),
      })
    : withEventSite.roomActions;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({ ...withEventSite, encounters: withNemesis, roomActions }),
    ),
  );
}

/**
 * Encounter commands mutate only exact persisted room-instance state. Dynamic
 * candidate legality is published by simulation; a retained selection may be
 * context-invalid and is deliberately not repaired by this command path.
 */
export function applyEncounterOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: EncounterOccurrenceCommand,
): ProjectDocument {
  return replaceTopLevel(document, catalog, located, command);
}
