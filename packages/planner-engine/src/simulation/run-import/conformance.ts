import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
  semanticAddressKey,
  type OccurrenceId,
} from '../../authored-project';
import type { RunRecord, RunRecordHeldTrait } from '../../run-record/model';
import { storeEntryOnRoute } from '../../reward-kernel';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import type { RunStateSnapshot } from '../rewards/run-state';
import { heldKeepsakeRanks, hubDepartureTraitInventory } from '../rewards/run-state-conformance';
import type { RecordOccurrences } from './occurrences';
import type { RunImportArea, RunImportReportEntry } from './report';

/** A room's entry save with the record's deltas folded in. */
export interface RecordedEntryState {
  readonly traits: ReadonlyMap<string, RunRecordHeldTrait>;
  readonly keepsake?: string;
  readonly elements: Readonly<Record<string, number>>;
  readonly rewardStores: ReadonlyMap<string, Readonly<Record<string, number>>>;
  readonly bannedTraits: readonly string[];
  readonly metaConversionUses: number;
  readonly wellShopPurchases: Readonly<Record<string, number>>;
  readonly biomeBoonSkipCount: number;
  readonly numRerolls: number;
  readonly investedTalents: readonly string[];
}

/** Each room's full entry state; empty when the record carries no entry saves. */
export function recordedEntryStates(record: RunRecord): readonly RecordedEntryState[] {
  const states: RecordedEntryState[] = [];
  let traits = new Map<string, RunRecordHeldTrait>();
  let stores = new Map<string, Readonly<Record<string, number>>>();
  for (const room of record.rooms) {
    const entry = room.entry;
    if (entry === undefined) return [];
    traits = new Map(traits);
    for (const name of entry.lostTraits ?? []) traits.delete(name);
    for (const [name, row] of Object.entries(entry.traits ?? {})) traits.set(name, row);
    stores = new Map([...stores, ...Object.entries(entry.rewardStores ?? {})]);
    states.push({
      traits,
      ...(entry.keepsake === undefined ? {} : { keepsake: entry.keepsake }),
      elements: entry.elements ?? {},
      rewardStores: stores,
      bannedTraits: entry.bannedTraits ?? [],
      metaConversionUses: entry.metaConversionUses ?? 0,
      wellShopPurchases: entry.wellShopPurchases ?? {},
      biomeBoonSkipCount: entry.biomeBoonSkipCount ?? 0,
      numRerolls: entry.numRerolls ?? 0,
      investedTalents: entry.investedTalents ?? [],
    });
  }
  return states;
}

/** An occurrence the record names, with its biome. */
export interface RecordOccurrence {
  readonly biomeKey: string;
  readonly occurrenceId: OccurrenceId;
}

/**
 * The record rooms whose entry save is compared. Leaving the previous room
 * writes the entry save, so it holds that room's `beforeRoomExit` moment; the
 * entered room is named for the effects that settle after it. The first room,
 * and a room left from an occurrence visited more than once (a Hub or a
 * revisited room), are not compared.
 */
export function entryCheckpoints(
  record: RunRecord,
  occurrences: RecordOccurrences,
  throughRoom: number,
): readonly {
  readonly roomIndex: number;
  /** The entered room's visit ordinal of its occurrence. */
  readonly visit: number;
  readonly left: RecordOccurrence;
  /** Absent when the entered occurrence is visited more than once. */
  readonly entered?: RecordOccurrence;
}[] {
  const at = (roomIndex: number): RecordOccurrence => ({
    biomeKey: occurrences.biomeOfRoom[roomIndex]!,
    occurrenceId: occurrences.occurrenceOf(roomIndex),
  });
  const visits = (roomIndex: number) => occurrences.visitsOf(occurrences.occurrenceOf(roomIndex));
  const once = (roomIndex: number) => visits(roomIndex).length === 1;
  const checkpoints = [];
  const last = Math.min(throughRoom, record.rooms.length - 1);
  for (let roomIndex = 1; roomIndex <= last; roomIndex += 1)
    if (once(roomIndex - 1))
      checkpoints.push({
        roomIndex,
        visit: Math.max(0, visits(roomIndex).indexOf(roomIndex)),
        left: at(roomIndex - 1),
        ...(once(roomIndex) ? { entered: at(roomIndex) } : {}),
      });
  return checkpoints;
}

const FORFEIT_VOW = 'BoonSkipShrineUpgrade';

const show = (value: number | string | undefined) =>
  value === undefined ? 'absent' : String(value);

function grade(row: { readonly rarity?: string; readonly level?: number } | undefined): string {
  if (row === undefined) return 'absent';
  return (
    [row.rarity, row.level === undefined ? undefined : `level ${row.level}`]
      .filter((part) => part !== undefined)
      .join(' ') || 'held'
  );
}

interface Values {
  readonly expected: string;
  readonly actual: string;
  /** What stays the same while the difference persists; the values themselves by default. */
  readonly persists?: string;
}

interface Difference extends Values {
  readonly area: RunImportArea;
  readonly field: string;
}

/**
 * `name count` pairs of the keys whose counts differ, zero for an absent key.
 * The difference persists while each key's offset does.
 */
function countDiff(
  expected: Readonly<Record<string, number>>,
  actual: Readonly<Record<string, number>>,
): Values | undefined {
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    .filter((key) => (expected[key] ?? 0) !== (actual[key] ?? 0))
    .sort();
  if (keys.length === 0) return undefined;
  const list = (counts: Readonly<Record<string, number>>) =>
    keys.map((key) => `${key} ${counts[key] ?? 0}`).join(', ');
  return {
    expected: list(expected),
    actual: list(actual),
    persists: keys.map((key) => `${key} ${(expected[key] ?? 0) - (actual[key] ?? 0)}`).join(', '),
  };
}

function setDiff(
  expected: readonly string[],
  actual: readonly string[],
): { readonly expected: string; readonly actual: string } | undefined {
  const left = new Set(expected);
  const right = new Set(actual);
  const onlyLeft = [...left].filter((key) => !right.has(key)).sort();
  const onlyRight = [...right].filter((key) => !left.has(key)).sort();
  if (onlyLeft.length === 0 && onlyRight.length === 0) return undefined;
  const list = (keys: readonly string[]) => (keys.length === 0 ? 'none other' : keys.join(', '));
  return { expected: list(onlyLeft), actual: list(onlyRight) };
}

/**
 * Each exact simulated store's entry counts by name. The game's store also
 * keeps, from each fill, every entry declared for another route; no draw here
 * takes one, but the fills are not simulated facts, so names with such an
 * entry are left out.
 */
export function storeCounts(catalog: Catalog, routeKey: string, snapshot: RunStateSnapshot) {
  const result = new Map<
    string,
    { readonly counts: Readonly<Record<string, number>>; readonly offRoute: ReadonlySet<string> }
  >();
  for (const store of snapshot.rewardStores) {
    const declaration = catalog.rewards.stores.byKey[store.storeKey];
    if (declaration === undefined) continue;
    const offRoute = new Set(
      declaration.entries
        .filter((entry) => !storeEntryOnRoute(entry, routeKey))
        .map((entry) => entry.rewardType),
    );
    const counts: Record<string, number> = {};
    declaration.entries.forEach((entry, index) => {
      const count = store.remainingEntryCounts[index] ?? 0;
      if (count > 0 && !offRoute.has(entry.rewardType))
        counts[entry.rewardType] = (counts[entry.rewardType] ?? 0) + count;
    });
    result.set(store.storeKey, { counts, offRoute });
  }
  return result;
}

/** Every v1 run-state value the entry save and the simulated room exit disagree on. */
function compareEntry(
  catalog: Catalog,
  record: RunRecord,
  routeKey: string,
  saved: RecordedEntryState,
  snapshot: RunStateSnapshot,
  entered: RunStateSnapshot | undefined,
): readonly Difference[] {
  const found: Difference[] = [];
  const differ = (area: RunImportArea, field: string, values: Values | undefined) => {
    if (values !== undefined && values.expected !== values.actual)
      found.push({ area, field, ...values });
  };

  // Held traits the trait ledger models: Arcana cards and Chaos keep their own ledgers.
  const { curses, blessings } = catalog.chaos;
  const curseKeys = new Set(curses.values.map((curse) => curse.key));
  const blessingKeys = new Set(blessings.values.map((blessing) => blessing.key));
  const arcanaTraits = new Set(catalog.arcanaCards.values.map((card) => card.traitKey));
  const simulated = new Map(hubDepartureTraitInventory(snapshot).map((row) => [row.traitKey, row]));
  for (const [key, row] of simulated) {
    const held = saved.traits.get(key);
    // The game reads a trait's level as its `StackNum`, one when unset.
    const compared =
      held === undefined
        ? undefined
        : {
            ...(row.rarity === undefined ? {} : { rarity: held.rarity }),
            ...(row.level === undefined ? {} : { level: held.level ?? 1 }),
          };
    differ('traits', key, {
      expected: grade(compared),
      actual: grade({
        ...(row.rarity === undefined ? {} : { rarity: row.rarity }),
        ...(row.level === undefined ? {} : { level: row.level }),
      }),
    });
  }
  for (const [name, held] of saved.traits)
    if (
      !simulated.has(name) &&
      catalog.traits.byKey[name] !== undefined &&
      !arcanaTraits.has(name) &&
      !curseKeys.has(name) &&
      !blessingKeys.has(name)
    )
      differ('traits', name, { expected: grade(held), actual: 'absent' });

  const keepsakes = heldKeepsakeRanks(catalog, snapshot);
  differ('keepsake', 'Keepsake', {
    expected: show(saved.keepsake),
    actual: show(keepsakes.find((keepsake) => keepsake.slotted)?.key),
  });

  const stores = storeCounts(catalog, routeKey, snapshot);
  for (const [store, { counts, offRoute }] of stores) {
    // Every Chaos gate offered draws Secrets' TrialUpgrade, which refills itself and nothing reads.
    if (store === 'Secrets') continue;
    const recorded = saved.rewardStores.get(store);
    if (recorded !== undefined)
      differ(
        'stores',
        store,
        countDiff(
          Object.fromEntries(Object.entries(recorded).filter(([name]) => !offRoute.has(name))),
          counts,
        ),
      );
  }

  differ('denial', 'BannedTraits', setDiff(saved.bannedTraits, snapshot.traits.bannedTraitKeys));

  differ('conversion', 'MetaConversionUses', {
    expected: show(saved.metaConversionUses),
    actual: show(snapshot.artificer?.usedCount ?? 0),
  });
  const timePiece = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'timePiece',
  );
  if (timePiece !== undefined) {
    const expected = saved.traits.get(timePiece.key)?.boonConversionUses;
    const actual = snapshot.keepsakes.timePiece?.remainingCharges;
    if (expected !== undefined || actual !== undefined)
      differ('conversion', timePiece.key, { expected: show(expected), actual: show(actual) });
  }

  differ(
    'well',
    'WellShopPurchases',
    countDiff(saved.wellShopPurchases, snapshot.stygianWell.directPurchases),
  );

  // Chaos: each held curse's remaining uses and each matured blessing's rarity.
  const activeCurses = new Map(
    snapshot.traits.chaos.active.map((curse) => [curse.curseKey, curse.remaining]),
  );
  for (const key of new Set([
    ...activeCurses.keys(),
    ...[...saved.traits.keys()].filter((name) => curseKeys.has(name)),
  ]))
    differ('chaos', key, {
      expected: show(
        saved.traits.has(key) ? (saved.traits.get(key)!.remainingUses ?? 'held') : undefined,
      ),
      actual: show(activeCurses.get(key)),
    });
  const matured = new Map(
    snapshot.traits.chaos.matured.map((blessing) => [blessing.blessingKey, blessing.rarity]),
  );
  for (const key of new Set([
    ...matured.keys(),
    ...[...saved.traits.keys()].filter((name) => blessingKeys.has(name)),
  ]))
    differ('chaos', key, {
      expected: saved.traits.has(key) ? (saved.traits.get(key)!.rarity ?? 'held') : 'absent',
      actual: show(matured.get(key)),
    });

  differ(
    'pathOfStars',
    'Invested',
    setDiff(saved.investedTalents, snapshot.hexProgress.investedNodeKeys),
  );

  // The planner's reroll pool against the game's; an empty saved pool is absent.
  differ('reroll', 'NumRerolls', {
    expected: show(saved.numRerolls),
    actual: show(snapshot.rerolls.remaining),
    persists: String(saved.numRerolls - snapshot.rerolls.remaining),
  });

  // The game derives Forfeit from the biome's skip count against the Vow's rank.
  const rank = record.loadout.vows[FORFEIT_VOW] ?? 0;
  differ('forfeit', 'BiomeBoonSkipCount', {
    expected: rank <= 0 ? 'inactive' : saved.biomeBoonSkipCount >= rank ? 'consumed' : 'available',
    actual: snapshot.forfeitStatus,
  });

  // Gathering grants its element as the room is left, after its `beforeRoomExit`.
  if (entered !== undefined)
    differ('elements', 'Elements', countDiff(saved.elements, entered.traits.elementCounts));
  return found;
}

const snapshotsByAssembly = new WeakMap<
  ProjectEvaluationAssembly,
  ReadonlyMap<string, RunStateSnapshot>
>();

/** The plan's run-state snapshot at one occurrence checkpoint, when evaluation reached it. */
export function occurrenceSnapshot(
  assembly: ProjectEvaluationAssembly,
  occurrence: RecordOccurrence,
  kind: 'roomEntered' | 'beforeRoomExit',
): RunStateSnapshot | undefined {
  let snapshots = snapshotsByAssembly.get(assembly);
  if (snapshots === undefined) {
    const byOwner = new Map<string, RunStateSnapshot>();
    for (const biome of assembly.evaluation.route.biomes)
      if ('rewards' in biome)
        for (const snapshot of biome.rewards.runStateSnapshots)
          byOwner.set(semanticAddressKey(snapshot.owner), snapshot);
    snapshotsByAssembly.set(assembly, byOwner);
    snapshots = byOwner;
  }
  return snapshots.get(
    semanticAddressKey(
      createRoomRunStateCheckpointAddress(
        createOccurrenceAddress(
          createBiomeAddress(assembly.project.route.routeKey, occurrence.biomeKey),
          occurrence.occurrenceId,
        ),
        { kind },
      ),
    ),
  );
}

/**
 * The plan's run state at a record room's entry save: the left room's exit,
 * or, leaving a Hub visit or a room visited more than once, and for the run's
 * first room, the entered room's first entry.
 */
export function entrySnapshot(
  assembly: ProjectEvaluationAssembly,
  occurrences: RecordOccurrences,
  roomIndex: number,
): RunStateSnapshot | undefined {
  const at = (index: number): RecordOccurrence => ({
    biomeKey: occurrences.biomeOfRoom[index]!,
    occurrenceId: occurrences.occurrenceOf(index),
  });
  // The run's first save follows the opening room's own draw.
  if (roomIndex === 0) return occurrenceSnapshot(assembly, at(0), 'roomEntered');
  const left = occurrences.occurrenceOf(roomIndex - 1);
  const exit =
    occurrences.visitsOf(left).length === 1
      ? occurrenceSnapshot(assembly, at(roomIndex - 1), 'beforeRoomExit')
      : undefined;
  if (exit !== undefined) return exit;
  return occurrences.visitsOf(occurrences.occurrenceOf(roomIndex))[0] === roomIndex
    ? occurrenceSnapshot(assembly, at(roomIndex), 'roomEntered')
    : undefined;
}

/**
 * Compares each record room's entry save with the plan's simulated state at
 * the same moment, the previous room's `beforeRoomExit`, through `throughRoom`.
 * A room whose checkpoint the evaluation did not reach is not compared.
 */
export function compareImportToRecord(
  catalog: Catalog,
  record: RunRecord,
  occurrences: RecordOccurrences,
  assembly: ProjectEvaluationAssembly,
  throughRoom: number,
): readonly RunImportReportEntry[] {
  const states = recordedEntryStates(record);
  if (states.length === 0) return [];
  const routeKey = assembly.project.route.routeKey;
  const snapshot = (occurrence: RecordOccurrence, kind: 'roomEntered' | 'beforeRoomExit') =>
    occurrenceSnapshot(assembly, occurrence, kind);
  const entries: RunImportReportEntry[] = [];
  // A difference that persists is reported where it begins and again where it changes.
  const previous = new Map<string, string>();
  for (const { roomIndex, visit, left, entered } of entryCheckpoints(
    record,
    occurrences,
    throughRoom,
  )) {
    const exit = snapshot(left, 'beforeRoomExit');
    if (exit === undefined) continue;
    const found = compareEntry(
      catalog,
      record,
      routeKey,
      states[roomIndex]!,
      exit,
      entered === undefined ? undefined : snapshot(entered, 'roomEntered'),
    );
    const current = new Map(
      found.map((entry) => [
        `${entry.area} ${entry.field}`,
        entry.persists ?? `${entry.expected} ${entry.actual}`,
      ]),
    );
    for (const { area, field, expected, actual } of found)
      if (previous.get(`${area} ${field}`) !== current.get(`${area} ${field}`))
        entries.push({
          area,
          reason: 'mismatch',
          record: { roomIndex, visit },
          mismatch: { field, expected, actual },
        });
    previous.clear();
    for (const [key, value] of current) previous.set(key, value);
  }
  return entries;
}
