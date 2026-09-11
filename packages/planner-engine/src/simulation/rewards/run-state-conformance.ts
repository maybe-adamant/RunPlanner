import {
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import type { RunStateSnapshot } from './run-state';
import type { KeepsakeState } from '../keepsakes/state';

export interface PendingKeepsakeEffects {
  readonly olympianSources: KeepsakeState['olympianSources'];
  readonly jeweledPom: KeepsakeState['jeweledPom'] | null;
  readonly experimentalHammers: KeepsakeState['experimentalHammers'];
  readonly callingCard: KeepsakeState['callingCard'] | null;
  readonly timePiece: KeepsakeState['timePiece'] | null;
  readonly figLeaf: KeepsakeState['figLeaf'] | null;
  readonly gorgon: KeepsakeState['gorgon'] | null;
  readonly phial: KeepsakeState['phial'] | null;
  readonly figurine: KeepsakeState['figurine'] | null;
  readonly stone: KeepsakeState['stone'] | null;
  readonly transcendentEmbryo: KeepsakeState['transcendentEmbryo'] | null;
}

export function pendingKeepsakeEffects(state: KeepsakeState): PendingKeepsakeEffects {
  return Object.freeze({
    olympianSources: state.olympianSources,
    jeweledPom: state.jeweledPom ?? null,
    experimentalHammers: state.experimentalHammers,
    callingCard: state.callingCard ?? null,
    timePiece: state.timePiece ?? null,
    figLeaf: state.figLeaf ?? null,
    gorgon: state.gorgon ?? null,
    phial: state.phial ?? null,
    figurine: state.figurine ?? null,
    stone: state.stone ?? null,
    transcendentEmbryo: state.transcendentEmbryo ?? null,
  });
}

export type RoomExitConformanceFactKind =
  | 'traitInventory'
  | 'elementCounts'
  | 'steadyGrowth'
  | 'chaos'
  | 'keepsakeEffects'
  | 'rewardPriorities'
  | 'pathOfStars'
  | 'forfeit'
  | 'stygianWell';

export interface RoomExitConformanceDelta {
  readonly occurrenceId: string;
  readonly facts: readonly { readonly kind: RoomExitConformanceFactKind }[];
}

function stable(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value as Readonly<Record<string, unknown>>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
    .join(',')}}`;
}

function changed(left: unknown, right: unknown): boolean {
  return stable(left) !== stable(right);
}

/**
 * The execution boundary only needs the native-observable portion of the
 * modeled trait ledger.  Keep this projection here, beside the canonical
 * snapshots, so room-exit conformance does not accidentally publish the
 * simulation's private acquisition metadata.
 */
function modeledTraitInventory(snapshot: RunStateSnapshot): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.values(snapshot.traits.equippedTraits).map((trait) => [
      trait.traitKey,
      {
        traitKey: trait.traitKey,
        ...(trait.rarity === undefined ? {} : { rarity: trait.rarity }),
        ...(trait.level === undefined ? {} : { level: trait.level }),
        ...(trait.hammerRank === undefined ? {} : { hammerRank: trait.hammerRank }),
      },
    ]),
  );
}

function snapshotFor(
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
  occurrence: OccurrenceAddress,
  checkpoint: 'roomEntered' | 'beforeRoomExit',
): RunStateSnapshot | undefined {
  return snapshots.get(
    semanticAddressKey(createRoomRunStateCheckpointAddress(occurrence, { kind: checkpoint })),
  );
}

/**
 * Derive the sparse carry-state boundary from canonical Run State only.
 * The execution assembler supplies route order and copies the returned facts;
 * it never inspects action or effect semantics.
 */
export function deriveRoomExitConformanceDeltas(
  occurrences: readonly OccurrenceAddress[],
  snapshots: ReadonlyMap<string, RunStateSnapshot>,
): ReadonlyMap<string, RoomExitConformanceDelta> {
  const result = new Map<string, RoomExitConformanceDelta>();
  let previousExit: RunStateSnapshot | undefined;
  for (const occurrence of occurrences) {
    const currentExit = snapshotFor(snapshots, occurrence, 'beforeRoomExit');
    if (currentExit === undefined) {
      // A room without the closed checkpoint cannot serve as a carry-state
      // baseline for a later room. The next reached room compares against its
      // own entry state instead of inheriting changes across an unobserved gap.
      previousExit = undefined;
      continue;
    }
    const roomEntry = snapshotFor(snapshots, occurrence, 'roomEntered');
    const baseline = previousExit ?? snapshotFor(snapshots, occurrence, 'roomEntered');
    previousExit = currentExit;
    const facts: { readonly kind: RoomExitConformanceFactKind }[] = [
      Object.freeze({ kind: 'elementCounts' }),
    ];
    if (baseline === undefined) {
      result.set(
        occurrence.occurrenceId,
        Object.freeze({ occurrenceId: occurrence.occurrenceId, facts: Object.freeze(facts) }),
      );
      continue;
    }
    const add = (kind: RoomExitConformanceFactKind, before: unknown, after: unknown) => {
      if (changed(before, after)) facts.push(Object.freeze({ kind }));
    };
    // Unlike carry-state facts, this proof is deliberately local to the
    // room's canonical entry and exit snapshots.  A later room must not prove
    // a trait mutation that happened before an unobserved room boundary.
    if (
      roomEntry !== undefined &&
      changed(modeledTraitInventory(roomEntry), modeledTraitInventory(currentExit))
    ) {
      facts.push(Object.freeze({ kind: 'traitInventory' }));
    }
    add('steadyGrowth', baseline.traits.steadyGrowth, currentExit.traits.steadyGrowth);
    add('chaos', baseline.traits.chaos, currentExit.traits.chaos);
    add(
      'keepsakeEffects',
      pendingKeepsakeEffects(baseline.keepsakes),
      pendingKeepsakeEffects(currentExit.keepsakes),
    );
    add('rewardPriorities', baseline.rewardPriorities, currentExit.rewardPriorities);
    // This is the complete graph-free Hex projection, not just the mutable
    // point bank. A zero-bonus Spell selection, native-only investment, or a
    // late God Sent insertion can change the actual tree without changing the
    // previously compared bank/closure pair.
    add('pathOfStars', baseline.hexObserver, currentExit.hexObserver);
    add('forfeit', baseline.forfeitStatus, currentExit.forfeitStatus);
    add('stygianWell', baseline.stygianWell, currentExit.stygianWell);
    if (facts.length > 0)
      result.set(
        occurrence.occurrenceId,
        Object.freeze({ occurrenceId: occurrence.occurrenceId, facts: Object.freeze(facts) }),
      );
  }
  return result;
}
