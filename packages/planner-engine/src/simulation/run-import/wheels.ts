import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  routeRoomDeclaration,
  type OccurrenceId,
  type ProjectCommand,
  type RewardWheelOfferAddress,
  type RewardWheelState,
  type RoomOccurrence,
} from '../../authored-project';
import { requireShipCombatWheels } from '../../authored-project/room-state/declaration';
import { locallyValidRewardOffers, type ResolvedRewardOffer } from '../../reward-kernel';
import type { RunRecordRoom, RunRecordWheel } from '../../run-record/model';
import { countedRewardTypeDomain } from '../evaluation/project-evaluation-assembly';
import type { SemanticFinding } from '../model';
import { entrySnapshot, occurrenceSnapshot, recordedEntryStates, storeCounts } from './conformance';
import { convertAcquisition, recordedConversions } from './dispositions';
import type { RunImportContext } from './import';
import { authoredOccurrence } from './occurrences';
import type { RunImportReportEntry } from './report';
import {
  bracketDrawsAuthored,
  prependReplaced,
  roomPressTargets,
  type PressTarget,
} from './rerolls';
import {
  bracketClosed,
  bracketDraws,
  bracketStoresMatch,
  poolSpends,
  type Counts,
  type Replaced,
} from './store-brackets';

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

/**
 * Each wheel's picked offer: Left is the first roll, Right the second. When a
 * room's two-offer wheels used both sides, the record does not say which took
 * which; the first wheels in setup order take the Left uses, a canonical split
 * the solve checks against every other.
 */
function pickedIndices(room: RunRecordRoom): readonly (number | undefined)[] {
  const left = mixedLeftUses(room);
  return (room.wheels ?? []).map((wheel, index) =>
    wheel.offers === 1 || wheel.side === 'left'
      ? 1
      : wheel.side === 'right'
        ? 2
        : left === undefined
          ? undefined
          : index < left
            ? 1
            : 2,
  );
}

/** The Left uses of a room whose two-offer wheels used both sides; undefined otherwise. */
function mixedLeftUses(room: RunRecordRoom): number | undefined {
  const wheels = room.wheels ?? [];
  const left = room.uses['ShipsSteeringWheelLeft'] ?? 0;
  const right = room.uses['ShipsSteeringWheelRight'] ?? 0;
  return left > 0 &&
    right > 0 &&
    left + right === wheels.length &&
    wheels.every((wheel) => wheel.offers === 2 && wheel.side === undefined)
    ? left
    : undefined;
}

/**
 * Every way to give `left` of `count` wheels in setup order the Left pick, as
 * picked offer indices, the canonical split (Left picks first) first.
 */
export function sideSplits(count: number, left: number): readonly (readonly number[])[] {
  const splits: (readonly number[])[] = [];
  const extend = (prefix: readonly number[], lefts: number) => {
    if (prefix.length === count) {
      if (lefts === 0) splits.push(prefix);
      return;
    }
    if (lefts > 0) extend([...prefix, 1], lefts - 1);
    if (count - prefix.length > lefts) extend([...prefix, 2], lefts);
  };
  extend([], left);
  return splits;
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
      importShipWheels(context, biome.biomeKey, occurrence, visit.room, visit.roomIndex);
    }
}

function importShipWheels(
  context: RunImportContext,
  biomeKey: string,
  occurrence: RoomOccurrence,
  room: RunRecordRoom,
  roomIndex: number,
): void {
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  const picks = pickedIndices(room);
  for (const [index, recorded] of (room.wheels ?? []).entries()) {
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
    const picked = picks[index];
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
    // Neither the save nor the use record shows which of two offers was taken;
    // a split of mixed sides is settled by the solve instead.
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
 * A wheel offer from the record: the picked one is the setup's pick; a god
 * the save never names takes the first eligible one. The other offer of a
 * two-offer wheel whose side is known is not saved: it takes a provisional
 * value that `solveWheelOffers` settles from the room's saved stores.
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
  if (offerIndex !== state.pickedOfferIndex)
    return (
      recorded.offers !== undefined &&
      pickedIndices(visit.room)[index] !== undefined &&
      answerProvisionally(context, offer, visit.roomIndex)
    );
  const { type, lootName } = recorded.picked;
  const named = (source: string) =>
    (visit.room.uses[source] ?? 0) > 0 ||
    visit.room.traitScreens.some((screen) => screen.giver === source);
  const values = locallyValidRewardOffers(context.catalog.rewards, type)
    .filter((value) => lootName === undefined || boonSource(value) === lootName)
    .sort(
      (left, right) =>
        Number(boonSource(right) !== undefined && named(boonSource(right)!)) -
        Number(boonSource(left) !== undefined && named(boonSource(left)!)),
    );
  for (const value of values) {
    if (!wheelOfferSupported(context, offer, value)) continue;
    const command: ProjectCommand = { kind: 'ReplaceRewardWheelOffer', offer, value };
    if (!context.applyValid(command)) continue;
    const god = boonSource(value);
    if (god !== undefined && god !== lootName && !named(god))
      context.note({
        area: 'wheel',
        reason: 'notInRecord',
        address: offer,
        applied: command,
        record: record(visit.roomIndex),
      });
    return true;
  }
  context.refuse();
  return false;
}

const boonSource = (value: ResolvedRewardOffer) =>
  value.payload?.kind === 'BoonSource' ? value.payload.source : undefined;

function wheelOfferSupported(
  context: RunImportContext,
  offer: RewardWheelOfferAddress,
  value: ResolvedRewardOffer,
): boolean {
  const evaluation = context.candidates().evaluate({ kind: 'rewardWheelOffer', offer, value });
  return (
    evaluation.kind === 'rewardWheelOffer' &&
    evaluation.result.supported &&
    evaluation.result.findings.length === 0
  );
}

/**
 * The first value of a type the engine supports for a wheel offer; a Boon
 * takes the first god in catalog order the wheel's peer rule admits.
 */
function firstSupported(
  context: RunImportContext,
  offer: RewardWheelOfferAddress,
  rewardType: string,
): ResolvedRewardOffer | undefined {
  return locallyValidRewardOffers(context.catalog.rewards, rewardType).find((value) =>
    wheelOfferSupported(context, offer, value),
  );
}

/**
 * An unpicked offer's provisional value: the first supported type of the
 * wheel's domain, so that a door or pick answered before the solve is less
 * likely to be refused: types the room's wheels picked last, then those the
 * saved store lost most of across the room first.
 */
function answerProvisionally(
  context: RunImportContext,
  offer: RewardWheelOfferAddress,
  roomIndex: number,
): boolean {
  const occurrence = authoredOccurrence(
    context.assembly().project,
    offer.biomeKey,
    offer.occurrenceId,
  );
  const wheel =
    occurrence?.state.kind === 'shipCombat' ? occurrence.state.wheels[offer.wheelKey] : undefined;
  const room = routeRoomDeclaration(
    context.catalog.rooms.byKey[occurrence?.gameName ?? ''],
    offer.routeKey,
  );
  const binding =
    room === undefined || occurrence === undefined
      ? undefined
      : requireShipCombatWheels(context.catalog, room, occurrence.gameName).find(
          (attachment) => attachment.key === offer.wheelKey,
        )?.reward;
  if (wheel === undefined || binding === undefined) return false;
  const saved = recordedEntryStates(context.record);
  const lost = (rewardType: string) =>
    (saved[roomIndex]?.rewardStores.get(wheel.storeKey)?.[rewardType] ?? 0) -
    (saved[roomIndex + 1]?.rewardStores.get(wheel.storeKey)?.[rewardType] ?? 0);
  const picked = new Set(
    context.record.rooms[roomIndex]?.wheels?.map((entry) => entry.picked.type),
  );
  const types = [
    ...countedRewardTypeDomain(context.catalog, context.assembly(), offer, binding),
  ].sort(
    (left, right) =>
      Number(picked.has(left)) - Number(picked.has(right)) || lost(right) - lost(left),
  );
  for (const rewardType of types) {
    const value = firstSupported(context, offer, rewardType);
    if (
      value !== undefined &&
      context.applyValid({ kind: 'ReplaceRewardWheelOffer', offer, value })
    )
      return true;
  }
  return false;
}

/** An unpicked offer of a wheel whose side the record names or the canonical split assumes. */
interface UnknownOffer {
  readonly address: RewardWheelOfferAddress;
  readonly wheel: RunRecordWheel;
}

/**
 * A ship room's unknown offers in setup order, for the given picks or the
 * record's; `complete` when every wheel's side is known.
 */
function unknownOffers(
  context: RunImportContext,
  roomIndex: number,
  picks: readonly (number | undefined)[] = pickedIndices(context.record.rooms[roomIndex]!),
): { readonly offers: readonly UnknownOffer[]; readonly complete: boolean } | undefined {
  const wheels = context.record.rooms[roomIndex]!.wheels ?? [];
  const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
  const occurrenceId = context.occurrences.occurrenceOf(roomIndex);
  const occurrence = authoredOccurrence(context.assembly().project, biomeKey, occurrenceId);
  if (occurrence?.state.kind !== 'shipCombat') return undefined;
  const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
  const offers = wheels.flatMap((wheel, index): UnknownOffer[] =>
    wheel.offers === 2 && picks[index] !== undefined
      ? [
          {
            address: createRewardWheelOfferAddress(
              biome,
              occurrence.occurrenceId,
              wheelKey(index),
              `offer${3 - picks[index]!}`,
            ),
            wheel,
          },
        ]
      : [],
  );
  return {
    offers,
    complete: wheels.every(
      (wheel, index) => wheel.offers !== undefined && picks[index] !== undefined,
    ),
  };
}

function offerValue(
  context: RunImportContext,
  offer: RewardWheelOfferAddress,
): ResolvedRewardOffer | undefined {
  const occurrence = authoredOccurrence(
    context.assembly().project,
    offer.biomeKey,
    offer.occurrenceId,
  );
  return occurrence?.state.kind === 'shipCombat'
    ? (occurrence.state.wheels[offer.wheelKey]?.offers[offer.offerKey]?.offer ?? undefined)
    : undefined;
}

const sameOffer = (left: ResolvedRewardOffer | undefined, right: ResolvedRewardOffer) =>
  JSON.stringify(left) === JSON.stringify(right);

/** One assignment that reproduces the saved wheel stores, with the ship's exit state. */
export interface WheelFit<Value> {
  readonly values: readonly Value[];
  /** The ship's exit stores, priorities, god pool and rerolls; equal fits are interchangeable. */
  readonly fingerprint: string;
}

/**
 * The fit to author, the first in canonical order, and per offer the values
 * the first fit of each other exit state holds instead; undefined when none fits.
 */
export function chooseWheelFit<Value>(
  fits: readonly WheelFit<Value>[],
  same: (left: Value, right: Value) => boolean,
):
  | { readonly chosen: readonly Value[]; readonly alternatives: readonly (readonly Value[])[] }
  | undefined {
  const chosen = fits[0];
  if (chosen === undefined) return undefined;
  const others = fits.filter(
    (fit, index) =>
      fit.fingerprint !== chosen.fingerprint &&
      fits.findIndex((first) => first.fingerprint === fit.fingerprint) === index,
  );
  return {
    chosen: chosen.values,
    alternatives: chosen.values.map((value, index) =>
      others
        .map((fit) => fit.values[index]!)
        .filter(
          (other, position, all) =>
            !same(other, value) && all.findIndex((entry) => same(entry, other)) === position,
        ),
    ),
  };
}

/**
 * Settles each ship room's unpicked offers once its save-to-save window
 * closes: the next room entered, every draw authored and any conversion
 * applied. The saved stores give the multiset of draws the plan does not know;
 * each way to give the unpicked offers their types from it, the rest left to
 * the room's rerolls, is simulated, and those reproducing the saved wheel
 * stores fit. Fits with one exit state are interchangeable and the first in
 * canonical order is authored; otherwise each differing offer is reported with
 * its alternatives. Returns whether any room's window closed.
 */
export function solveWheelOffers(context: RunImportContext): boolean {
  let closed = false;
  for (const [roomIndex, room] of context.record.rooms.entries()) {
    const used = `wheelSolve:${roomIndex}`;
    if (room.wheels === undefined || context.used.has(used)) continue;
    if (!bracketClosed(context, roomIndex)) continue;
    const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
    const sourceId = context.occurrences.occurrenceOf(roomIndex);
    const biome = createBiomeAddress(context.assembly().project.route.routeKey, biomeKey);
    const targets = roomPressTargets(context, biome, sourceId);
    if (!bracketDrawsAuthored(context, biomeKey, sourceId, targets)) continue;
    if (
      recordedConversions(context, roomIndex).length > 0 &&
      !context.used.has(`conversion:${roomIndex}`)
    )
      continue;
    context.used.add(used);
    closed = true;
    solveShip(context, roomIndex, targets);
  }
  return closed;
}

function solveShip(
  context: RunImportContext,
  roomIndex: number,
  targets: readonly PressTarget[],
): void {
  const room = context.record.rooms[roomIndex]!;
  const unknown = unknownOffers(context, roomIndex);
  if (unknown === undefined || !unknown.complete) return;
  const { offers } = unknown;
  const solved = `wheelSolved:${roomIndex}`;
  if (offers.length === 0) {
    context.used.add(solved);
    return;
  }
  const provisional = offers.map((offer) => offerValue(context, offer.address));
  if (provisional.some((value) => value === undefined)) return;
  const planned = offers.map((offer, index) => ({
    storeKey: offer.wheel.store,
    rewardType: provisional[index]!.rewardType,
  }));
  const rerolls = Math.max(
    0,
    poolSpends(context, roomIndex) ?? context.record.rooms[roomIndex]!.rerolls ?? 0,
  );
  const draws = bracketDraws(context, roomIndex, offers.length + rerolls, planned);
  if (draws === undefined) return;
  context.used.add(solved);
  const wheelStores = new Set(offers.map((offer) => offer.wheel.store));
  // Mixed sides add the split as a dimension; every wheel then has an unknown offer.
  const left = mixedLeftUses(room);
  const splits: readonly (readonly number[] | undefined)[] =
    left === undefined ? [undefined] : sideSplits(offers.length, left);
  const offersOf = (split: readonly number[] | undefined) =>
    split === undefined ? offers : unknownOffers(context, roomIndex, split)!.offers;
  const biome = createBiomeAddress(
    context.assembly().project.route.routeKey,
    context.occurrences.biomeOfRoom[roomIndex]!,
  );
  const sourceId = context.occurrences.occurrenceOf(roomIndex);
  const fits: (WheelFit<ResolvedRewardOffer> & { readonly split?: readonly number[] })[] = [];
  const types = assignments(offers, draws.solutions);
  for (const split of splits)
    for (const { types: assigned, remainder } of types)
      context.probe(() => {
        const values: ResolvedRewardOffer[] = [];
        const placed = context.transaction(() => {
          if (!pickSides(context, offersOf(split), split)) return false;
          // A press redraws the offers left unpicked, so the targets follow the split.
          const pressTargets =
            split === undefined ? targets : roomPressTargets(context, biome, sourceId);
          return (
            placeOffers(context, offersOf(split), assigned, (offer, index) => {
              const value = firstSupported(context, offer.address, assigned[index]!);
              if (value !== undefined) values.push(value);
              return value;
            }) && remainder.every((entry) => prependReplaced(context, pressTargets, entry))
          );
        });
        if (placed && bracketStoresMatch(context, roomIndex, wheelStores))
          fits.push({
            values,
            fingerprint: exitFingerprint(context, roomIndex),
            ...(split === undefined ? {} : { split }),
          });
      });
  const choice = chooseWheelFit(fits, sameOffer);
  const at = record(roomIndex);
  if (choice === undefined) {
    for (const storeKey of wheelStores)
      context.note({
        area: 'wheel',
        reason: 'mismatch',
        address: wheelOf(offers.find((offer) => offer.wheel.store === storeKey)!.address),
        record: at,
        mismatch: { field: storeKey, ...roomLoss(context, roomIndex, storeKey) },
      });
    for (const entry of sideGuesses(context, roomIndex, offers)) context.note(entry);
    for (const entry of provisionalOffers(context, roomIndex, offers)) context.note(entry);
    return;
  }
  const split = fits[0]!.split;
  const chosenOffers = offersOf(split);
  const commands = chosenOffers.map((offer, index): ProjectCommand => ({
    kind: 'ReplaceRewardWheelOffer',
    offer: offer.address,
    value: choice.chosen[index]!,
  }));
  const applied = context.transaction(
    () =>
      pickSides(context, chosenOffers, split) &&
      placeOffers(
        context,
        chosenOffers,
        choice.chosen.map((value) => value.rewardType),
        (_offer, index) => choice.chosen[index],
      ),
  );
  if (applied && split !== undefined) {
    const sides = chooseWheelFit(
      fits.map((fit) => ({ values: fit.split!, fingerprint: fit.fingerprint })),
      (left: number, right: number) => left === right,
    )!;
    for (const [index, offer] of chosenOffers.entries())
      if (sides.alternatives[index]!.length > 0)
        context.note(sideGuess(offer, sides.chosen[index]!, sides.alternatives[index]!, at));
  }
  for (const [index, offer] of chosenOffers.entries()) {
    const alternatives = choice.alternatives[index]!;
    if (!applied)
      context.note({
        area: 'wheel',
        reason: 'refused',
        address: offer.address,
        applied: commands[index]!,
        record: at,
      });
    else if (alternatives.length > 0)
      context.note({
        area: 'wheel',
        reason: 'notInRecord',
        address: offer.address,
        applied: commands[index]!,
        alternatives: alternatives.map((value): ProjectCommand => ({
          kind: 'ReplaceRewardWheelOffer',
          offer: offer.address,
          value,
        })),
        record: at,
      });
  }
}

/**
 * Swaps each wheel whose authored pick is not the split's, carrying the
 * picked offer's authorship to the other side; no split leaves the picks.
 */
function pickSides(
  context: RunImportContext,
  offers: readonly UnknownOffer[],
  split: readonly number[] | undefined,
): boolean {
  if (split === undefined) return true;
  return offers.every((offer, index) => {
    const occurrence = authoredOccurrence(
      context.assembly().project,
      offer.address.biomeKey,
      offer.address.occurrenceId,
    );
    const wheel =
      occurrence?.state.kind === 'shipCombat'
        ? occurrence.state.wheels[offer.address.wheelKey]
        : undefined;
    return (
      wheel !== undefined &&
      (wheel.pickedOfferIndex === split[index] ||
        context.apply({ kind: 'SwapRewardWheelOffers', wheel: wheelOf(offer.address) }))
    );
  });
}

/** A wheel's side the record leaves open: the pick authored, and the others that fit. */
function sideGuess(
  offer: UnknownOffer,
  picked: number,
  alternatives: readonly number[],
  at: RunImportReportEntry['record'],
): RunImportReportEntry {
  const wheel = wheelOf(offer.address);
  return {
    area: 'wheel',
    reason: 'notInRecord',
    address: wheel,
    applied: { kind: 'ReplaceRewardWheelPicked', wheel, pickedOfferIndex: picked },
    alternatives: alternatives.map((pickedOfferIndex): ProjectCommand => ({
      kind: 'ReplaceRewardWheelPicked',
      wheel,
      pickedOfferIndex,
    })),
    ...(at === undefined ? {} : { record: at }),
  };
}

/** Each wheel of a mixed-side room the solve did not settle: its canonical side, or the other. */
function sideGuesses(
  context: RunImportContext,
  roomIndex: number,
  offers: readonly UnknownOffer[],
): readonly RunImportReportEntry[] {
  const room = context.record.rooms[roomIndex]!;
  if (mixedLeftUses(room) === undefined) return [];
  const picks = pickedIndices(room);
  return offers.map((offer, index) =>
    sideGuess(offer, picks[index]!, [3 - picks[index]!], record(roomIndex)),
  );
}

/**
 * Gives every unknown offer its type before any takes its value, so that no
 * offer's earlier value leaves another's draw unavailable, then each its value
 * in setup order. The probes and the chosen fit go through the same steps.
 */
function placeOffers(
  context: RunImportContext,
  offers: readonly UnknownOffer[],
  types: readonly string[],
  valueOf: (offer: UnknownOffer, index: number) => ResolvedRewardOffer | undefined,
): boolean {
  const replace = (offer: UnknownOffer, value: ResolvedRewardOffer) =>
    sameOffer(offerValue(context, offer.address), value) ||
    context.apply({ kind: 'ReplaceRewardWheelOffer', offer: offer.address, value });
  return (
    offers.every((offer, index) => {
      if (offerValue(context, offer.address)?.rewardType === types[index]) return true;
      const value = locallyValidRewardOffers(context.catalog.rewards, types[index]!)[0];
      return value !== undefined && replace(offer, value);
    }) &&
    offers.every((offer, index) => {
      const value = valueOf(offer, index);
      return value !== undefined && replace(offer, value);
    })
  );
}

const wheelOf = (offer: RewardWheelOfferAddress) =>
  createRewardWheelAddress(
    createBiomeAddress(offer.routeKey, offer.biomeKey),
    offer.occurrenceId,
    offer.wheelKey,
  );

/**
 * Each distinct way to give the unknown offers, in setup order, a type of
 * their own store from one multiset of draws, the rest of it left to the
 * room's rerolls.
 */
function assignments(
  offers: readonly UnknownOffer[],
  solutions: readonly (readonly Replaced[])[],
): readonly { readonly types: readonly string[]; readonly remainder: readonly Replaced[] }[] {
  const found: { types: readonly string[]; remainder: readonly Replaced[] }[] = [];
  const seen = new Set<string>();
  for (const draws of solutions) {
    const pick = (index: number, types: readonly string[], rest: readonly Replaced[]) => {
      if (index === offers.length) {
        const key = JSON.stringify([types, rest]);
        if (!seen.has(key)) {
          seen.add(key);
          found.push({ types, remainder: rest });
        }
        return;
      }
      const tried = new Set<string>();
      for (const [position, draw] of rest.entries()) {
        if (draw.storeKey !== offers[index]!.wheel.store || tried.has(draw.rewardType)) continue;
        tried.add(draw.rewardType);
        pick(
          index + 1,
          [...types, draw.rewardType],
          rest.filter((_entry, other) => other !== position),
        );
      }
    };
    pick(0, [], draws);
  }
  return found;
}

/** The ship's exit state a later room reads from the draws: stores, priorities, god pool and rerolls. */
function exitFingerprint(context: RunImportContext, roomIndex: number): string {
  const assembly = context.assembly();
  const snapshot = occurrenceSnapshot(
    assembly,
    {
      biomeKey: context.occurrences.biomeOfRoom[roomIndex]!,
      occurrenceId: context.occurrences.occurrenceOf(roomIndex) as OccurrenceId,
    },
    'beforeRoomExit',
  );
  if (snapshot === undefined) return '';
  return JSON.stringify([
    [...storeCounts(context.catalog, assembly.project.route.routeKey, snapshot)].map(
      ([storeKey, { counts }]) => [storeKey, counts],
    ),
    snapshot.rewardPriorities,
    snapshot.godPool,
    snapshot.rerolls.remaining,
  ]);
}

/** What the saved store and the plan's lost across a room, by the names they differ on. */
function roomLoss(
  context: RunImportContext,
  roomIndex: number,
  storeKey: string,
): { readonly expected: string; readonly actual: string } {
  const saved = recordedEntryStates(context.record);
  const routeKey = context.assembly().project.route.routeKey;
  const planned = (index: number) => {
    const snapshot = entrySnapshot(context.assembly(), context.occurrences, index);
    return snapshot === undefined
      ? {}
      : (storeCounts(context.catalog, routeKey, snapshot).get(storeKey)?.counts ?? {});
  };
  const loss = (before: Counts, after: Counts) =>
    Object.fromEntries(
      [...new Set([...Object.keys(before), ...Object.keys(after)])].map((name) => [
        name,
        (before[name] ?? 0) - (after[name] ?? 0),
      ]),
    ) as Counts;
  const expected = loss(
    saved[roomIndex]?.rewardStores.get(storeKey) ?? {},
    saved[roomIndex + 1]?.rewardStores.get(storeKey) ?? {},
  );
  const actual = loss(planned(roomIndex), planned(roomIndex + 1));
  const names = [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    .filter((name) => (expected[name] ?? 0) !== (actual[name] ?? 0))
    .sort();
  const list = (counts: Counts) => names.map((name) => `${name} ${counts[name] ?? 0}`).join(', ');
  return { expected: list(expected), actual: list(actual) };
}

/** Each unknown offer holding its provisional value, as a guess the record does not answer. */
function provisionalOffers(
  context: RunImportContext,
  roomIndex: number,
  offers: readonly UnknownOffer[],
): readonly RunImportReportEntry[] {
  return offers.flatMap(({ address }): RunImportReportEntry[] => {
    const value = offerValue(context, address);
    return value === undefined
      ? []
      : [
          {
            area: 'wheel',
            reason: 'notInRecord',
            address,
            applied: { kind: 'ReplaceRewardWheelOffer', offer: address, value },
            record: record(roomIndex),
          },
        ];
  });
}

/**
 * Unpicked offers of ship rooms the solve never settled, such as the last
 * room, one whose walk stopped before the next, or a record without entry
 * saves: the plan holds their provisional values.
 */
export function unsolvedWheels(context: RunImportContext): readonly RunImportReportEntry[] {
  return context.record.rooms.flatMap((room, roomIndex) =>
    room.wheels === undefined || context.used.has(`wheelSolved:${roomIndex}`)
      ? []
      : [
          ...sideGuesses(context, roomIndex, unknownOffers(context, roomIndex)?.offers ?? []),
          ...provisionalOffers(context, roomIndex, unknownOffers(context, roomIndex)?.offers ?? []),
        ],
  );
}

/**
 * Artificer and Time Piece act on a wheel pickup the room's uses do not show:
 * Artificer on a Meta pickup it replaced, Time Piece on one it turned to Gold.
 */
export function importWheelConversions(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
      if (occurrence.state.kind !== 'shipCombat') continue;
      const visit = shipVisit(context, occurrence.occurrenceId);
      if (visit === undefined) continue;
      const used = `conversion:${visit.roomIndex}`;
      const kinds = recordedConversions(context, visit.roomIndex);
      if (kinds.length === 0 || context.used.has(used)) continue;
      // Once the window closes the room's pickups are as reached as they will be.
      const closed = bracketClosed(context, visit.roomIndex);
      if (!closed && !context.pending(occurrence.occurrenceId)) continue;
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
      const refused = () =>
        context.note({
          area: 'conversion',
          reason: 'refused',
          address: createOccurrenceAddress(biomeAddress, occurrence.occurrenceId as OccurrenceId),
          record: record(visit.roomIndex),
        });
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
      ) {
        if (closed) {
          context.used.add(used);
          kinds.forEach(() => refused());
        }
        continue;
      }
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
          refused();
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
