import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import type { ProjectCommand } from '../../authored-project/commands/types';
import type { RoomLayout } from '../../authored-project/model';
import { layoutWithEntry, layoutWithFlip } from '../room-layout/choices';
import type { RoomEntryOption } from '../room-layout/derivation';
import type { RoomLayoutSettlement } from '../room-layout/settlement';
import type { ProjectEvaluationAssembly } from './evaluation-products';

type ReplaceRoomLayout = Extract<ProjectCommand, { readonly kind: 'ReplaceRoomLayout' }>;

/**
 * A reached room's layout as settled at its entry, with the choices it
 * leaves open. Each command replaces the whole layout, so picking an entry
 * that needs one flip sets that flip too, and picking a flip drops an entry
 * it rules out: no command reaches an impossible combination.
 */
export interface RoomLayoutAuthoring {
  readonly settlement: RoomLayoutSettlement;
  readonly authored?: RoomLayout;
  /** Each entry the game can pick with the command choosing it; empty when the entry is decided. */
  readonly entries: readonly {
    readonly option: RoomEntryOption;
    readonly command: ReplaceRoomLayout;
  }[];
  /** Both flips with their commands while the flip is a roll; empty otherwise. */
  readonly flips: readonly { readonly flipped: boolean; readonly command: ReplaceRoomLayout }[];
  /** Returns the whole layout to the game; present while anything is authored. */
  readonly clear?: ReplaceRoomLayout;
}

function settlementFor(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): RoomLayoutSettlement | undefined {
  const biome = assembly.evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === occurrence.biomeKey,
  );
  if (biome === undefined || !('rewards' in biome)) return undefined;
  const key = semanticAddressKey(occurrence);
  return biome.rewards.roomLayouts.find(
    (settlement) => semanticAddressKey(settlement.owner) === key,
  );
}

/** The reached room's layout choices; undefined while its entry is unreached. */
export function roomLayoutAuthoringForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): RoomLayoutAuthoring | undefined {
  const settlement = settlementFor(assembly, occurrence);
  if (settlement === undefined) return undefined;
  const authored = assembly.project.route.biomes
    .find((plan) => plan.biomeKey === occurrence.biomeKey)
    ?.topology?.occurrences.find((entry) => entry.occurrenceId === occurrence.occurrenceId)?.layout;
  const replace = (layout: RoomLayout): ReplaceRoomLayout =>
    Object.freeze({ kind: 'ReplaceRoomLayout', occurrence, layout: Object.freeze(layout) });
  const entries =
    settlement.entry.kind !== 'choice'
      ? []
      : settlement.entry.eligible.map((option) =>
          Object.freeze({
            option,
            command: replace(layoutWithEntry(settlement, authored, option.startPointId)),
          }),
        );
  const flips =
    settlement.flip.kind !== 'roll'
      ? []
      : [false, true].map((flipped) =>
          Object.freeze({
            flipped,
            command: replace(layoutWithFlip(settlement, authored, flipped)),
          }),
        );
  return Object.freeze({
    settlement,
    ...(authored === undefined ? {} : { authored, clear: replace({}) }),
    entries: Object.freeze(entries),
    flips: Object.freeze(flips),
  });
}
