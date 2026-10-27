import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  type AcquisitionRoleAddress,
  type ProjectCommand,
} from '../../authored-project';
import type { RunImportContext } from './import';

export type ConversionKind = 'artificer' | 'timePiece';

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
    if (convertAcquisition(context, acquisition, kind, state.reward.offer.rewardType, roomIndex))
      context.used.add(used);
  }
}

/**
 * Applies a recorded conversion to one acquisition. Artificer's replacement is
 * the reward the room's uses name that the converted pickup is not. False when
 * the acquisition has no conversion context yet.
 */
export function convertAcquisition(
  context: RunImportContext,
  acquisition: AcquisitionRoleAddress,
  kind: ConversionKind,
  convertedRewardType: string,
  roomIndex: number,
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
  const replacement = types.find(
    (type) => type !== convertedRewardType && (room.uses[type] ?? 0) > 0,
  );
  if (entry === undefined || replacement === undefined) {
    context.note({ area: 'conversion', reason: 'notInRecord', address: acquisition, record });
    return true;
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
  return true;
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
