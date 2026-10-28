import {
  createBiomeAddress,
  createOccurrenceAddress,
  roomActionKey,
  type AuthoredRewardState,
  type RoomActionReference,
  type RoomOccurrence,
} from '../../authored-project';
import { roomActionAddress } from './actions';
import type { RunImportContext } from './import';
import { deliveredCageReward, deliveredIncomingReward } from './occurrences';

const OPTION_INDEX = { option1: 0, option2: 1, option3: 2 } as const;

/** The traits a reward grants when picked: each trait offer's pick and each level-up's target. */
function rewardTraits(
  reward: AuthoredRewardState | null | undefined,
  role?: string,
): {
  readonly gained: readonly string[];
  readonly upgraded: readonly string[];
} {
  if (reward === null || reward === undefined) return { gained: [], upgraded: [] };
  const ofRole = <T>(entries: Readonly<Record<string, T>>): T[] =>
    Object.entries(entries).flatMap(([key, value]) =>
      role === undefined || key === role ? [value] : [],
    );
  const gained = ofRole(reward.traitOffersByAcquisitionRole).flatMap((offer) => {
    if (offer === null) return [];
    if (offer.kind === 'chaos')
      return [offer.curseOptions[OPTION_INDEX[offer.selectedOptionKey]]!.curseKey];
    if (offer.kind !== 'traits') return [];
    const picked = offer.options[OPTION_INDEX[offer.selectedOptionKey]]?.traitKey;
    return picked === undefined ? [] : [picked];
  });
  const upgraded = ofRole(reward.levelResolutionsByAcquisitionRole ?? {}).flatMap((resolution) => {
    const target =
      resolution.kind === 'choice' ? resolution.selectedTraitKey : resolution.targetTraitKey;
    return target === null ? [] : [target];
  });
  return { gained, upgraded };
}

/** The traits one room action grants, read from the authored payload it settles. */
function actionTraits(
  occurrence: RoomOccurrence,
  reference: RoomActionReference,
): { readonly gained: readonly string[]; readonly upgraded: readonly string[] } {
  const state = occurrence.state;
  switch (reference.kind) {
    case 'interactIncomingReward':
      return rewardTraits(deliveredIncomingReward(occurrence), reference.acquisitionRole);
    case 'collectRequiredReward':
      return rewardTraits(deliveredIncomingReward(occurrence));
    case 'interactLocalReward':
      return state.kind === 'fieldsCombat'
        ? rewardTraits(
            reference.groupKey === 'cages'
              ? deliveredCageReward(occurrence, reference.slotKey)
              : state.optionalRewards[reference.slotKey],
          )
        : rewardTraits(undefined);
    case 'interactShopOffer':
      return state.kind === 'shop'
        ? rewardTraits(state.shop?.offers[reference.offerKey]?.reward)
        : rewardTraits(undefined);
    case 'interactInfernalContractPedestal':
      return rewardTraits(occurrence.infernalContractPedestal?.reward);
    case 'interactWheelReward': {
      const wheel = state.kind === 'shipCombat' ? state.wheels[reference.wheelKey] : undefined;
      return rewardTraits(wheel?.offers[`offer${wheel.pickedOfferIndex}`]);
    }
    case 'purchaseStygianWellOffer': {
      const well = occurrence.stygianWell;
      const slot = reference.generationKey.startsWith('initial:')
        ? (reference.generationKey.slice('initial:'.length) as 'healing')
        : undefined;
      const item = slot === undefined ? well?.travelDealRefillKey : well?.offerKeyBySlot[slot];
      return { gained: item === undefined || item === null ? [] : [item], upgraded: [] };
    }
    case 'interactKeepsakeRack': {
      const key = occurrence.keepsakeRack?.keepsakeKey;
      return { gained: key === undefined || key === null ? [] : [key], upgraded: [] };
    }
    case 'purchaseHermesShrineOffer':
      return { gained: reference.rushed ? [] : ['StorePendingDeliveryItem'], upgraded: [] };
    case 'interactEncounter': {
      const offers = occurrence.encounters.traitOffersByPhase?.[reference.phaseKey] ?? {};
      return {
        gained: Object.values(offers).flatMap((offer) =>
          offer?.kind === 'traits'
            ? [offer.options[OPTION_INDEX[offer.selectedOptionKey]]!.traitKey]
            : [],
        ),
        upgraded: [],
      };
    }
    default:
      return { gained: [], upgraded: [] };
  }
}

/**
 * Orders each recorded room's trait-granting actions by the world time the
 * save stamped on their traits, keeping every other action at its native
 * position. A room whose order still rests on the native schedule is reported.
 */
export function importRoomActionOrders(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const biome of project.route.biomes)
    for (const original of biome.topology?.occurrences ?? []) {
      const visits = context.occurrences.visitsOf(original.occurrenceId);
      if (visits.length === 0 || original.roomActions.order.length < 2) continue;
      const roomIndex = visits[0]!;
      const timed = timedActions(context, original, visits);
      const order = original.roomActions.order;
      const timedPositions = order.flatMap((reference, index) =>
        timed.has(roomActionKey(reference)) ? [index] : [],
      );
      const sorted = timedPositions
        .map((index) => order[index]!)
        .sort((left, right) => timed.get(roomActionKey(left))! - timed.get(roomActionKey(right))!);
      const target = [...order];
      timedPositions.forEach((position, index) => (target[position] = sorted[index]!));
      const reordered = context.transaction(() =>
        target.every((reference, toIndex) => {
          const current = context
            .assembly()
            .project.route.biomes.find((entry) => entry.biomeKey === biome.biomeKey)
            ?.topology?.occurrences.find((entry) => entry.occurrenceId === original.occurrenceId)
            ?.roomActions.order;
          const from = current?.findIndex(
            (entry) => roomActionKey(entry) === roomActionKey(reference),
          );
          if (from === undefined || from < 0) return false;
          return (
            from === toIndex ||
            context.apply({
              kind: 'MoveRoomAction',
              action: roomActionAddress(context, biome.biomeKey, original.occurrenceId, reference),
              toIndex,
            })
          );
        }),
      );
      // Actions without a trait to time keep the native schedule between the timed ones.
      if (!reordered || timed.size < order.length)
        context.note({
          area: 'roomActionOrder',
          reason: 'assumption',
          address: createOccurrenceAddress(
            createBiomeAddress(project.route.routeKey, biome.biomeKey),
            original.occurrenceId,
          ),
          record: { roomIndex, visit: 0 },
        });
    }
}

/** Each action's earliest stamped trait time across the occurrence's record visits. */
function timedActions(
  context: RunImportContext,
  occurrence: RoomOccurrence,
  visits: readonly number[],
): Map<string, number> {
  const gained = visits.flatMap((index) => context.record.rooms[index]!.traits.acquired);
  const upgraded = visits.flatMap((index) => context.record.rooms[index]!.traits.upgraded);
  const claimed = new Set<object>();
  const times = new Map<string, number>();
  for (const reference of occurrence.roomActions.order) {
    const traits = actionTraits(occurrence, reference);
    const stamps = [
      ...traits.gained.map((name) =>
        gained.find((entry) => entry.name === name && !claimed.has(entry)),
      ),
      ...traits.upgraded.map((name) =>
        upgraded.find((entry) => entry.name === name && !claimed.has(entry)),
      ),
    ];
    if (stamps.length === 0 || stamps.some((stamp) => stamp?.worldTime === undefined)) continue;
    for (const stamp of stamps) claimed.add(stamp!);
    times.set(roomActionKey(reference), Math.min(...stamps.map((stamp) => stamp!.worldTime!)));
  }
  return times;
}
