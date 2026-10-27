import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  type ProjectCommand,
} from '../../authored-project';
import type { RunImportContext } from './import';

type ConversionKind = 'artificer' | 'timePiece';

function recordedConversions(context: RunImportContext, roomIndex: number): ConversionKind[] {
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
    const room = context.record.rooms[roomIndex]!;
    const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
    const occurrenceId = context.occurrences.occurrenceOf(roomIndex);
    const state = project.route.biomes
      .find((biome) => biome.biomeKey === biomeKey)
      ?.topology?.occurrences.find((entry) => entry.occurrenceId === occurrenceId)?.state;
    if (state === undefined || !('reward' in state) || state.reward === null) continue;
    const acquisition = createAcquisitionRoleAddress(
      createIncomingRewardAddress(
        createBiomeAddress(project.route.routeKey, biomeKey),
        occurrenceId,
      ),
      'self',
    );
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'acquisitionConversion', acquisition });
    if (evaluation.kind !== 'acquisitionConversion') continue;
    context.used.add(used);
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
      continue;
    }
    if (kind !== 'artificer') continue;
    const after = context.candidates().evaluate({ kind: 'acquisitionConversion', acquisition });
    const entry =
      after.kind === 'acquisitionConversion' ? after.result.artificerReplacementAddress : undefined;
    const types =
      after.kind === 'acquisitionConversion'
        ? (after.result.artificerReplacementRewardTypes ?? [])
        : [];
    const replacement = types.find(
      (type) => type !== state.reward!.offer.rewardType && (room.uses[type] ?? 0) > 0,
    );
    if (entry === undefined || replacement === undefined) {
      context.note({ area: 'conversion', reason: 'notInRecord', address: acquisition, record });
      continue;
    }
    const command: ProjectCommand = {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: { rewardType: replacement },
    };
    // The replacement is inferred from the room's uses, not recorded as such.
    context.note({
      area: 'conversion',
      reason: context.apply(command) ? 'assumption' : 'refused',
      address: entry,
      applied: command,
      record,
    });
  }
}

/**
 * Conversions never placed: a room recording two, or one whose pickup is not a
 * room reward (a ship wheel's, a later import step).
 */
export function reportUnplacedDispositions(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const roomIndex of context.record.rooms.keys()) {
    const kinds = recordedConversions(context, roomIndex);
    if (kinds.length === 0 || context.used.has(`conversion:${roomIndex}`)) continue;
    const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
    const occurrenceId = context.occurrences.occurrenceOf(roomIndex);
    const state = project.route.biomes
      .find((biome) => biome.biomeKey === biomeKey)
      ?.topology?.occurrences.find((entry) => entry.occurrenceId === occurrenceId)?.state;
    const roomReward = state !== undefined && 'reward' in state && state.reward !== null;
    for (let count = 0; count < kinds.length; count++)
      context.note({
        area: roomReward ? 'conversion' : 'wheel',
        reason: roomReward ? 'notInRecord' : 'unsupportedArea',
        record: { roomIndex, visit: 0 },
      });
  }
}

/**
 * Room actions keep the native schedule settlement gives them; the record's
 * acquisition times are not read to reorder them. Each recorded room whose plan
 * orders two or more actions is reported once.
 */
export function reportRoomActionOrders(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
      const visits = context.occurrences.visitsOf(occurrence.occurrenceId);
      if (visits.length === 0 || occurrence.roomActions.order.length < 2) continue;
      context.note({
        area: 'roomActionOrder',
        reason: 'assumption',
        address: createOccurrenceAddress(
          createBiomeAddress(project.route.routeKey, biome.biomeKey),
          occurrence.occurrenceId,
        ),
        record: { roomIndex: visits[0]!, visit: 0 },
      });
    }
}
