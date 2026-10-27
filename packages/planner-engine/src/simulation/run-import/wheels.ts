import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  type OccurrenceId,
  type ProjectCommand,
  type RewardWheelState,
  type RoomOccurrence,
} from '../../authored-project';
import { locallyValidRewardOffers, type ResolvedRewardOffer } from '../../reward-kernel';
import type { RunRecordRoom, RunRecordWheel } from '../../run-record/model';
import type { SemanticFinding } from '../model';
import { convertAcquisition, recordedConversions } from './dispositions';
import type { RunImportContext } from './import';
import { authoredOccurrence } from './occurrences';

const record = (roomIndex: number) => ({ roomIndex, visit: 0 });

/** A ship's wheels in setup order: the record lists one per encounter that rolled a wheel. */
const wheelKey = (index: number) => `wheel${index + 1}`;

function shipVisit(
  context: RunImportContext,
  occurrenceId: string,
): { readonly roomIndex: number; readonly room: RunRecordRoom } | undefined {
  for (const roomIndex of context.occurrences.visitsOf(occurrenceId)) {
    const room = context.record.rooms[roomIndex]!;
    if (room.wheels !== undefined) return { roomIndex, room };
  }
  return undefined;
}

/** The offer a wheel's side picked: Left is the first roll, Right the second. */
function pickedIndex(wheel: RunRecordWheel): number | undefined {
  if (wheel.offers === 1) return 1;
  return wheel.side === 'left' ? 1 : wheel.side === 'right' ? 2 : undefined;
}

/**
 * Each recorded wheel's store, offer count and picked side, authored once its
 * ship is entered; what the record leaves open keeps the default and is reported.
 */
export function importWheels(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
      const used = `wheels:${occurrence.occurrenceId}`;
      if (
        occurrence.state.kind !== 'shipCombat' ||
        context.used.has(used) ||
        !context.pending(occurrence.occurrenceId)
      )
        continue;
      const visit = shipVisit(context, occurrence.occurrenceId);
      if (visit === undefined) continue;
      context.used.add(used);
      importShipWheels(context, biome.biomeKey, occurrence, visit.room.wheels!, visit.roomIndex);
    }
}

function importShipWheels(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  wheels: readonly RunRecordWheel[],
  roomIndex: number,
): void {
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  for (const [index, recorded] of wheels.entries()) {
    const wheel = createRewardWheelAddress(biome, occurrence.occurrenceId, wheelKey(index));
    const state = (): RewardWheelState | undefined => {
      const current = authoredOccurrence(
        context.assembly().project,
        biomeKey,
        occurrence.occurrenceId,
      );
      return current?.state.kind === 'shipCombat'
        ? current.state.wheels[wheel.wheelKey]
        : undefined;
    };
    if (state() === undefined) {
      context.note({ area: 'wheel', reason: 'refused', address: wheel, record: record(roomIndex) });
      continue;
    }
    const steps: ProjectCommand[] = [];
    if (state()!.storeKey !== recorded.store)
      steps.push({ kind: 'ReplaceRewardWheelStore', wheel, storeKey: recorded.store });
    if (recorded.offers !== undefined && state()!.offerCount !== recorded.offers)
      steps.push({ kind: 'ReplaceRewardWheelOfferCount', wheel, offerCount: recorded.offers });
    const picked = pickedIndex(recorded);
    if (picked !== undefined && state()!.pickedOfferIndex !== picked)
      steps.push({ kind: 'ReplaceRewardWheelPicked', wheel, pickedOfferIndex: picked });
    for (const step of steps)
      if (!context.applyValid(step))
        context.note({
          area: 'wheel',
          reason: 'refused',
          address: wheel,
          applied: step,
          record: record(roomIndex),
        });
    // Neither the save nor the use record shows which of two wheels was taken.
    if (recorded.offers === undefined || picked === undefined)
      context.note({
        area: 'wheel',
        reason: 'notInRecord',
        address: wheel,
        record: record(roomIndex),
      });
  }
}

/**
 * A wheel offer from the record: the picked one is the setup's pick, the
 * other the store's other roll. A god the save never names takes the first
 * eligible one; an unpicked wheel boon's god is never saved.
 */
export function answerWheels(context: RunImportContext, reason: SemanticFinding): boolean {
  const offer = reason.origin;
  if (offer.kind !== 'rewardWheelOffer' || reason.code !== 'rewardMissing') return false;
  const visit = shipVisit(context, offer.occurrenceId);
  const index = Number(/^wheel(\d+)$/.exec(offer.wheelKey)?.[1]) - 1;
  const recorded = visit?.room.wheels?.[index];
  const state = (() => {
    const current = authoredOccurrence(
      context.assembly().project,
      offer.biomeKey,
      offer.occurrenceId,
    );
    return current?.state.kind === 'shipCombat' ? current.state.wheels[offer.wheelKey] : undefined;
  })();
  if (visit === undefined || recorded === undefined || state === undefined) return false;
  const offerIndex = Number(/^offer(\d+)$/.exec(offer.offerKey)?.[1]);
  const isPicked = offerIndex === state.pickedOfferIndex;
  const type = isPicked ? recorded.picked.type : recorded.unpicked?.type;
  const lootName = isPicked ? recorded.picked.lootName : undefined;
  const named = (source: string) =>
    (visit.room.uses[source] ?? 0) > 0 ||
    visit.room.traitScreens.some((screen) => screen.giver === source);
  const boon = (value: ResolvedRewardOffer) =>
    value.payload?.kind === 'BoonSource' ? value.payload.source : undefined;
  const values = (type === undefined ? [] : locallyValidRewardOffers(context.catalog.rewards, type))
    .filter((value) => lootName === undefined || boon(value) === lootName)
    .sort(
      (left, right) =>
        Number(isPicked && boon(right) !== undefined && named(boon(right)!)) -
        Number(isPicked && boon(left) !== undefined && named(boon(left)!)),
    );
  for (const value of values) {
    const evaluation = context.candidates().evaluate({ kind: 'rewardWheelOffer', offer, value });
    if (
      evaluation.kind !== 'rewardWheelOffer' ||
      !evaluation.result.supported ||
      evaluation.result.findings.length > 0
    )
      continue;
    const command: ProjectCommand = { kind: 'ReplaceRewardWheelOffer', offer, value };
    if (!context.applyValid(command)) continue;
    const god = boon(value);
    const exact = god === undefined || god === lootName || (isPicked && named(god));
    if (!exact)
      context.note({
        area: 'wheel',
        reason: isPicked ? 'notInRecord' : 'assumption',
        address: offer,
        applied: command,
        record: record(visit.roomIndex),
      });
    return true;
  }
  if (type !== undefined) context.refuse();
  return false;
}

/**
 * Artificer and Time Piece act on a wheel pickup the room's uses do not show:
 * Artificer on a Meta pickup it replaced, Time Piece on one it turned to Gold.
 */
export function importWheelConversions(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
      if (occurrence.state.kind !== 'shipCombat' || !context.pending(occurrence.occurrenceId))
        continue;
      const visit = shipVisit(context, occurrence.occurrenceId);
      if (visit === undefined) continue;
      const used = `conversion:${visit.roomIndex}`;
      const kinds = recordedConversions(context, visit.roomIndex);
      if (kinds.length === 0 || context.used.has(used)) continue;
      const wheels = Object.entries(occurrence.state.wheels).slice(
        0,
        visit.room.wheels?.length ?? 0,
      );
      const pickups = wheels.flatMap(([key, wheel]) => {
        const reward = wheel.offers[`offer${wheel.pickedOfferIndex}`];
        if (reward === null || reward === undefined) return [];
        const role = Object.keys(reward.dispositionByAcquisitionRole)[0];
        return role === undefined
          ? []
          : [{ key, offerKey: `offer${wheel.pickedOfferIndex}`, reward, role }];
      });
      const biomeAddress = createBiomeAddress(project.route.routeKey, biome.biomeKey);
      const acquisitionOf = (pickup: (typeof pickups)[number]) =>
        createAcquisitionRoleAddress(
          createRewardWheelOfferAddress(
            biomeAddress,
            occurrence.occurrenceId,
            pickup.key,
            pickup.offerKey,
          ),
          pickup.role,
        );
      // Conversions wait for every wheel pickup to be authored and reached.
      if (
        pickups.length !== wheels.length ||
        pickups.some(
          (pickup) =>
            context.candidates().evaluate({
              kind: 'acquisitionConversion',
              acquisition: acquisitionOf(pickup),
            }).kind !== 'acquisitionConversion',
        )
      )
        continue;
      context.used.add(used);
      const uncollected = pickups.filter(
        ({ reward }) =>
          (visit.room.uses[reward.offer.rewardType] ?? 0) === 0 &&
          !(
            reward.offer.payload?.kind === 'BoonSource' &&
            (visit.room.uses[reward.offer.payload.source] ?? 0) > 0
          ),
      );
      for (const kind of kinds) {
        const target = uncollected.find((pickup) => {
          const evaluation = context
            .candidates()
            .evaluate({ kind: 'acquisitionConversion', acquisition: acquisitionOf(pickup) });
          return (
            evaluation.kind === 'acquisitionConversion' &&
            (kind === 'artificer'
              ? evaluation.result.artificerSupported
              : evaluation.result.timePieceSupported)
          );
        });
        if (target === undefined) {
          context.note({
            area: 'conversion',
            reason: 'refused',
            address: createOccurrenceAddress(biomeAddress, occurrence.occurrenceId as OccurrenceId),
            record: record(visit.roomIndex),
          });
          continue;
        }
        uncollected.splice(uncollected.indexOf(target), 1);
        convertAcquisition(
          context,
          acquisitionOf(target),
          kind,
          target.reward.offer.rewardType,
          visit.roomIndex,
        );
      }
    }
}
