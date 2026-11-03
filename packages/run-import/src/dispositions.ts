import {
  acquisitionSiteStorageKey,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  type AcquisitionEntryAddress,
  type AcquisitionRoleAddress,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { RunImportContext } from './import';
import { authoredOccurrence, deliveredIncomingReward, occurrenceIdOf } from './occurrences';

export type ConversionKind = 'artificer' | 'timePiece';

/** The store an Artificer replacement draws from. */
export const ARTIFICER_STORE = 'RunProgress';

/** An Artificer replacement a search pinned; `assumed` unless the next entry save settled it. */
export interface ConversionReplacement {
  readonly rewardType: string;
  readonly assumed: boolean;
}

export function recordedConversions(
  context: RunImportContext,
  roomIndex: number,
): ConversionKind[] {
  const conversions = context.record.rooms[roomIndex]!.conversions;
  return [
    ...((conversions?.artificer ?? 0) > 0 ? (['artificer'] as const) : []),
    ...((conversions?.timePiece ?? 0) > 0 ? (['timePiece'] as const) : []),
  ];
}

/**
 * A room's recorded Artificer or Time Piece conversion acts on its room reward
 * pickup. Artificer's replacement is the reward the room's uses name that its
 * own reward does not. A room recording both converts two pickups, which the
 * record does not tell apart.
 */
export function importDispositions(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const roomIndex of context.record.rooms.keys()) {
    const kinds = recordedConversions(context, roomIndex);
    const used = `conversion:${roomIndex}`;
    if (kinds.length !== 1 || context.used.has(used)) continue;
    const kind = kinds[0]!;
    const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
    const occurrenceId = context.occurrences.occurrenceOf(roomIndex);
    const occurrence = authoredOccurrence(project, biomeKey, occurrenceId);
    const reward = occurrence === undefined ? undefined : deliveredIncomingReward(occurrence);
    if (reward === undefined || reward === null) continue;
    const acquisition = createAcquisitionRoleAddress(
      createIncomingRewardAddress(
        createBiomeAddress(project.route.routeKey, biomeKey),
        occurrenceId,
      ),
      'self',
    );
    if (convertAcquisition(context, acquisition, kind, reward.offer.rewardType, roomIndex))
      context.used.add(used);
  }
}

/**
 * Applies a recorded conversion to one acquisition. Artificer's replacement is
 * the first reward the room's uses name that the converted pickup is not, of
 * the type a search pinned. False when the acquisition has no
 * conversion context yet, or the pinned replacement does not place.
 */
export function convertAcquisition(
  context: RunImportContext,
  acquisition: AcquisitionRoleAddress,
  kind: ConversionKind,
  convertedRewardType: string,
  roomIndex: number,
  pinned?: ConversionReplacement,
): boolean {
  const room = context.record.rooms[roomIndex]!;
  const evaluation = context.candidates().evaluate({ kind: 'acquisitionConversion', acquisition });
  if (evaluation.kind !== 'acquisitionConversion') return false;
  const record = { roomIndex, visit: 0 };
  const supported =
    kind === 'artificer'
      ? evaluation.result.artificerSupported
      : evaluation.result.timePieceSupported;
  if (
    !supported ||
    !context.apply({ kind: 'ReplaceAcquisitionDisposition', acquisition, value: { kind } })
  ) {
    context.note({ area: 'conversion', reason: 'refused', address: acquisition, record });
    return true;
  }
  if (kind !== 'artificer') return true;
  const after = context.candidates().evaluate({ kind: 'acquisitionConversion', acquisition });
  const entry =
    after.kind === 'acquisitionConversion' ? after.result.artificerReplacementAddress : undefined;
  const types =
    after.kind === 'acquisitionConversion'
      ? (after.result.artificerReplacementRewardTypes ?? [])
      : [];
  const replacement = types
    .filter((type) => type !== convertedRewardType)
    .flatMap((type) =>
      type === 'Boon' ? replacementBoons(context, roomIndex) : [{ rewardType: type }],
    )
    .find(
      (offer) =>
        (pinned === undefined || offer.rewardType === pinned.rewardType) &&
        (offer.rewardType === 'Boon' || (room.uses[offer.rewardType] ?? 0) > 0),
    );
  if (entry === undefined || replacement === undefined) {
    if (pinned !== undefined) return false;
    context.note({ area: 'conversion', reason: 'notInRecord', address: acquisition, record });
    return true;
  }
  const command: ProjectCommand = {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry,
    value: replacement,
  };
  const applied = context.apply(command);
  if (!applied && pinned !== undefined) return false;
  if (applied && pinned?.assumed === false) return true;
  // The replacement is inferred from the room's uses, not recorded as such.
  context.note({
    area: 'conversion',
    reason: applied ? 'assumption' : 'refused',
    address: entry,
    applied: command,
    record,
  });
  return true;
}

/** A room reward's placed Artificer replacement: its entry, its reward, and the types the engine admits there. */
export interface RoomArtificer {
  readonly entry: AcquisitionEntryAddress;
  readonly current: ResolvedRewardOffer;
  readonly rewardTypes: readonly string[];
}

/** The room reward's Artificer replacement once the conversion placed one; undefined otherwise. */
export function roomRewardArtificer(
  context: RunImportContext,
  roomIndex: number,
): RoomArtificer | undefined {
  if (!recordedConversions(context, roomIndex).includes('artificer')) return undefined;
  const project = context.assembly().project;
  const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
  const acquisition = createAcquisitionRoleAddress(
    createIncomingRewardAddress(
      createBiomeAddress(project.route.routeKey, biomeKey),
      context.occurrences.occurrenceOf(roomIndex),
    ),
    'self',
  );
  const evaluation = context.candidates().evaluate({ kind: 'acquisitionConversion', acquisition });
  const entry =
    evaluation.kind === 'acquisitionConversion'
      ? evaluation.result.artificerReplacementAddress
      : undefined;
  const hostId = entry === undefined ? undefined : occurrenceIdOf(entry);
  const current =
    entry === undefined || hostId === undefined
      ? undefined
      : authoredOccurrence(project, entry.biomeKey, hostId)?.acquisitionSites?.[
          acquisitionSiteStorageKey(entry.site)
        ]?.pickupEntries?.[entry.entryKey]?.offer;
  if (entry === undefined || current === undefined || evaluation.kind !== 'acquisitionConversion')
    return undefined;
  return {
    entry,
    current,
    rewardTypes: evaluation.result.artificerReplacementRewardTypes ?? [],
  };
}

/** Replaces a placed Artificer replacement with one of `rewardType`; a boon takes a god the room used. */
export function pinArtificerReplacement(
  context: RunImportContext,
  roomIndex: number,
  artificer: RoomArtificer,
  rewardType: string,
): boolean {
  if (artificer.current.rewardType === rewardType) return true;
  const values = rewardType === 'Boon' ? replacementBoons(context, roomIndex) : [{ rewardType }];
  return values.some((value) =>
    context.transaction(() =>
      context.apply({ kind: 'ReplaceAcquisitionEntryOffer', entry: artificer.entry, value }),
    ),
  );
}

/**
 * A boon pickup counts under its god's loot name, not `Boon`: a replacement boon
 * is a god loot the room used, whose screen it opened, that its own reward is not.
 */
function replacementBoons(context: RunImportContext, roomIndex: number): ResolvedRewardOffer[] {
  const room = context.record.rooms[roomIndex]!;
  return Object.keys(room.uses)
    .filter(
      (loot) =>
        loot !== room.reward?.lootName &&
        context.catalog.traitGiverByAcquisitionGameName[loot] !== undefined &&
        room.traitScreens.some((screen) => screen.giver === loot),
    )
    .map((loot) => ({ rewardType: 'Boon', payload: { kind: 'BoonSource', source: loot } }));
}

/**
 * Conversions never placed: a room recording two on its room reward, or one
 * whose pickup the record does not identify.
 */
export function reportUnplacedDispositions(context: RunImportContext): void {
  for (const roomIndex of context.record.rooms.keys()) {
    const kinds = recordedConversions(context, roomIndex);
    if (kinds.length === 0 || context.used.has(`conversion:${roomIndex}`)) continue;
    for (let count = 0; count < kinds.length; count++)
      context.note({
        area: 'conversion',
        reason: 'notInRecord',
        record: { roomIndex, visit: 0 },
      });
  }
}
