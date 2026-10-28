import type { Catalog } from '../../../catalog-schema';
import type { InfernalContractPedestalState, ProjectDocument, RoomOccurrence } from '../../model';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from '../contract';
import { replaceOccurrence, updateOccurrenceTopology } from './mutation';
import { sameOccurrenceValue } from './leaf-value';
import type { InfernalContractPedestalCommand } from '../types';
import { createUnresolvedAcquisitionRewardState } from '../../traits/state';
import { rewardSourceResolvesAtAcquisition } from '../../acquisition/reward-state';
import { reconcileAcquisitionResolvedRewardEntry } from '../../acquisition/acquisition-entry';
import { structurallyActiveOccurrenceIds } from '../../room-actions/defaults';
import {
  createDefaultInfernalContractPedestal,
  infernalContractPedestalCollected,
  infernalContractPedestalProfile,
  INFERNAL_CONTRACT_ENTRY_KEY,
  INFERNAL_CONTRACT_PEDESTAL_SITE_KEY,
} from '../../infernal-contract-pedestal';

const COLLECT = Object.freeze({ kind: 'interactInfernalContractPedestal' as const });

function withPedestal(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  pedestal: InfernalContractPedestalState,
  collected: boolean,
): RoomOccurrence {
  const order = occurrence.roomActions.order;
  const wasCollected = infernalContractPedestalCollected(occurrence);
  const nextOrder =
    collected === wasCollected
      ? order
      : collected
        ? Object.freeze([...order, COLLECT])
        : Object.freeze(
            order.filter((reference) => reference.kind !== 'interactInfernalContractPedestal'),
          );
  return reconcileAcquisitionResolvedRewardEntry(
    catalog,
    Object.freeze({
      ...occurrence,
      infernalContractPedestal: pedestal,
      roomActions:
        nextOrder === order ? occurrence.roomActions : Object.freeze({ order: nextOrder }),
    }),
    INFERNAL_CONTRACT_ENTRY_KEY,
    collected,
    pedestal.reward,
    INFERNAL_CONTRACT_PEDESTAL_SITE_KEY,
  );
}

export function applyInfernalContractPedestalCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: InfernalContractPedestalCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.pedestal.occurrenceId, command);
  const pedestal = occurrence.infernalContractPedestal;
  if (pedestal === undefined)
    failCommand(command, `${occurrence.gameName} has no Contract pedestal`);
  const collected = infernalContractPedestalCollected(occurrence);
  const publish = (next: RoomOccurrence) =>
    next === occurrence
      ? document
      : updateOccurrenceTopology(document, located, replaceOccurrence(topology, next));

  switch (command.kind) {
    case 'SetInfernalContractPedestalCollected':
      if (command.collected === collected) return document;
      if (
        command.collected &&
        !structurallyActiveOccurrenceIds(topology).has(occurrence.occurrenceId)
      )
        failCommand(command, 'an unentered Preboss cannot collect its pedestal item');
      return publish(withPedestal(catalog, occurrence, pedestal, command.collected));
    case 'ClearInfernalContractPedestal':
      if (pedestal.reward === null && pedestal.optionKey === null && !collected) return document;
      return publish(
        withPedestal(catalog, occurrence, createDefaultInfernalContractPedestal(), false),
      );
    case 'ReplaceInfernalContractPedestalOffer':
    case 'ReplaceInfernalContractPedestalOption':
      break;
  }

  const profile = infernalContractPedestalProfile(catalog, occurrence.gameName);
  const slot = profile?.slots.byKey[INFERNAL_CONTRACT_ENTRY_KEY];
  const optionDomain =
    slot === undefined ? undefined : profile?.groups.byKey[slot.groupKey]?.options.values;
  if (profile === undefined || optionDomain === undefined)
    failCommand(command, `${occurrence.gameName} declares no Contract pedestal pool`);
  const selectedOffer =
    command.kind === 'ReplaceInfernalContractPedestalOption' ? command.value.offer : command.value;
  const retainedOption =
    pedestal.optionKey === null
      ? undefined
      : optionDomain.find((candidate) => candidate.key === pedestal.optionKey);
  const compatibleOptions = [
    ...new Map(
      optionDomain
        .filter((candidate) => candidate.rewardType === selectedOffer.rewardType)
        .map((option) => [option.key, option]),
    ).values(),
  ];
  const selectedOptionKey =
    command.kind === 'ReplaceInfernalContractPedestalOption'
      ? command.value.optionKey
      : retainedOption?.rewardType === selectedOffer.rewardType
        ? retainedOption.key
        : compatibleOptions.length === 1
          ? compatibleOptions[0]!.key
          : null;
  const option =
    selectedOptionKey === null
      ? undefined
      : optionDomain.find((candidate) => candidate.key === selectedOptionKey);
  if (command.kind === 'ReplaceInfernalContractPedestalOption' && option === undefined)
    failCommand(command, `unknown pedestal option ${command.value.optionKey}`);
  if (option !== undefined && option.rewardType !== selectedOffer.rewardType)
    failCommand(command, `${option.key} does not produce ${selectedOffer.rewardType}`);
  const resolvesAtAcquisition = rewardSourceResolvesAtAcquisition(catalog, selectedOffer);
  const sameReward =
    pedestal.reward !== null &&
    pedestal.reward.offer.rewardType === selectedOffer.rewardType &&
    ((resolvesAtAcquisition && pedestal.reward.offer.payload === undefined) ||
      sameOccurrenceValue(pedestal.reward.offer, selectedOffer));
  if (sameReward && pedestal.optionKey === selectedOptionKey) return document;
  const replacement: InfernalContractPedestalState = sameReward
    ? Object.freeze({ ...pedestal, optionKey: selectedOptionKey })
    : Object.freeze({
        optionKey: selectedOptionKey,
        reward: resolvesAtAcquisition
          ? Object.freeze({
              offer: Object.freeze({ rewardType: selectedOffer.rewardType }),
              traitOffersByAcquisitionRole: Object.freeze({}),
              dispositionByAcquisitionRole: Object.freeze({}),
            })
          : createUnresolvedAcquisitionRewardState(
              catalog,
              selectedOffer,
              { kind: 'shopProfile', key: profile.key },
              located.routePosition.routeKey,
            ),
      });
  return publish(withPedestal(catalog, occurrence, replacement, collected));
}
