import {
  createBiomeAddress,
  createHubDecisionAddress,
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
  type HubDecisionAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { storeEntryOnRoute } from '@run-planner/engine/reward-kernel';
import {
  type ProjectEvaluationAssembly,
  type RunStateSnapshot,
  heldKeepsakeRanks,
  hubDepartureSnapshotForProjectEvaluationAssembly,
  runStateSnapshotForProjectEvaluationAssembly,
  snapshotTraitInventory,
} from '@run-planner/engine/simulation';
import type { RunRecord, RunRecordHeldTrait } from './run-record/model';
import { authoredOccurrence, recordHubStay, type RecordOccurrences } from './occurrences';
import type {
  RunImportArea,
  RunImportMismatch,
  RunImportReportEntry,
  RunImportUncheckedFamily,
} from './report';

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

/** Rarify charges the plan's keepsake state leaves on one source keepsake. */
export function rarifyCharges(
  catalog: Catalog,
  keepsakes: RunStateSnapshot['keepsakes'],
  key: string,
): number | undefined {
  return catalog.keepsakes.byKey[key]?.effect?.kind === 'callingCard'
    ? keepsakes.callingCard?.remainingCharges
    : keepsakes.olympianSources.find((source) => source.keepsakeKey === key)
        ?.remainingRarificationUses;
}

/** An occurrence the record names, with its biome. */
export interface RecordOccurrence {
  readonly biomeKey: string;
  readonly occurrenceId: OccurrenceId;
}

/** Where the plan holds the run state a record room's entry save wrote. */
export type EntrySource =
  /** The run's first save follows the opening room's own draw: its `roomEntered`. */
  | { readonly kind: 'opening'; readonly occurrence: RecordOccurrence }
  /** Leaving a room writes the next entry save: its `beforeRoomExit`. */
  | { readonly kind: 'exit'; readonly occurrence: RecordOccurrence }
  /** Leaving a Hub stay: the Run State captured at that departure. */
  | {
      readonly kind: 'hubDeparture';
      readonly hub: HubDecisionAddress;
      /** The room visits completed before the stay. */
      readonly stay: number;
    };

/** Why a record room's entry save is not compared at all. */
export type EntryUncheckedReason =
  /** The record carries no entry saves. */
  | 'noEntrySaves'
  /** The plan's evaluation did not reach the save's moment. */
  | 'unreached'
  /** A restored room's later departure replays no lifecycle, so no state is captured there. */
  | 'restoredDeparture';

/**
 * Where a record room's entry save is compared: the moment its source holds,
 * and the entered room when this is its first visit to an occurrence that
 * publishes its entry, which follows the grants made as the previous room was
 * left.
 */
export type EntryCheckpoint =
  | {
      readonly kind: 'compared';
      readonly roomIndex: number;
      /** The entered room's visit ordinal of its occurrence. */
      readonly visit: number;
      readonly source: EntrySource;
      readonly entered?: RecordOccurrence;
    }
  | {
      readonly kind: 'unchecked';
      readonly roomIndex: number;
      readonly visit: number;
      readonly reason: 'restoredDeparture';
    };

export function entryCheckpoint(
  occurrences: RecordOccurrences,
  project: ProjectDocument,
  roomIndex: number,
): EntryCheckpoint {
  const at = (index: number): RecordOccurrence => ({
    biomeKey: occurrences.biomeOfRoom[index]!,
    occurrenceId: occurrences.occurrenceOf(index),
  });
  const visits = (index: number) => occurrences.visitsOf(occurrences.occurrenceOf(index));
  const firstVisit = (index: number) => visits(index)[0] === index;
  const visit = Math.max(0, visits(roomIndex).indexOf(roomIndex));
  // A Ship room publishes its phases' states instead of its entry.
  const entered =
    firstVisit(roomIndex) &&
    recordHubStay(project, occurrences, roomIndex) === undefined &&
    authoredOccurrence(project, at(roomIndex).biomeKey, at(roomIndex).occurrenceId)?.state.kind !==
      'shipCombat'
      ? { entered: at(roomIndex) }
      : {};
  if (roomIndex === 0)
    return { kind: 'compared', roomIndex, visit, source: { kind: 'opening', occurrence: at(0) } };
  const left = roomIndex - 1;
  const stay = recordHubStay(project, occurrences, left);
  if (stay !== undefined)
    return {
      kind: 'compared',
      roomIndex,
      visit,
      source: {
        kind: 'hubDeparture',
        hub: createHubDecisionAddress(
          createBiomeAddress(project.route.routeKey, occurrences.biomeOfRoom[left]!),
          stay.hub.hubKey,
        ),
        stay: stay.stay,
      },
      ...entered,
    };
  // A room's `beforeRoomExit` is captured once, as its first visit is left.
  if (!firstVisit(left))
    return { kind: 'unchecked', roomIndex, visit, reason: 'restoredDeparture' };
  return {
    kind: 'compared',
    roomIndex,
    visit,
    source: { kind: 'exit', occurrence: at(left) },
    ...entered,
  };
}

/** The plan's run state at an entry save's source, when evaluation reached it. */
export function sourceSnapshot(
  assembly: ProjectEvaluationAssembly,
  source: EntrySource,
): RunStateSnapshot | undefined {
  switch (source.kind) {
    case 'opening':
      return occurrenceSnapshot(assembly, source.occurrence, 'roomEntered');
    case 'exit':
      return occurrenceSnapshot(assembly, source.occurrence, 'beforeRoomExit');
    case 'hubDeparture':
      return hubDepartureSnapshotForProjectEvaluationAssembly(assembly, source.hub, source.stay);
  }
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
  rarifySources: ReadonlySet<string>,
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
  const simulated = new Map(snapshotTraitInventory(snapshot).map((row) => [row.traitKey, row]));
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

  // Rarify charges left on each source whose charges the record carries; a
  // source the save no longer holds has none.
  for (const key of rarifySources) {
    const held = saved.traits.get(key);
    if (held !== undefined && held.rarityUpgradeUses === undefined) continue;
    const expected = held?.rarityUpgradeUses;
    const actual = rarifyCharges(catalog, snapshot.keepsakes, key);
    if ((expected ?? 0) !== (actual ?? 0))
      differ('keepsake', key, { expected: show(expected), actual: show(actual) });
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

/** The plan's run-state snapshot at one occurrence checkpoint, when evaluation reached it. */
export function occurrenceSnapshot(
  assembly: ProjectEvaluationAssembly,
  occurrence: RecordOccurrence,
  kind: 'roomEntered' | 'beforeRoomExit',
): RunStateSnapshot | undefined {
  return runStateSnapshotForProjectEvaluationAssembly(
    assembly,
    createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(
        createBiomeAddress(assembly.project.route.routeKey, occurrence.biomeKey),
        occurrence.occurrenceId,
      ),
      { kind },
    ),
  );
}

/** The plan's run state at a record room's entry save, when it has one. */
export function entrySnapshot(
  assembly: ProjectEvaluationAssembly,
  occurrences: RecordOccurrences,
  roomIndex: number,
): RunStateSnapshot | undefined {
  const checkpoint = entryCheckpoint(occurrences, assembly.project, roomIndex);
  return checkpoint.kind === 'compared' ? sourceSnapshot(assembly, checkpoint.source) : undefined;
}

/** A record's entry saves, folded once for every comparison against them. */
export interface EntrySaves {
  readonly states: readonly RecordedEntryState[];
  /** Rarify sources whose charges the record carries; an older record has none. */
  readonly rarifySources: ReadonlySet<string>;
}

export function entrySaves(record: RunRecord): EntrySaves {
  const states = recordedEntryStates(record);
  return {
    states,
    rarifySources: new Set(
      states.flatMap((state) =>
        [...state.traits]
          .filter(([, row]) => row.rarityUpgradeUses !== undefined)
          .map(([name]) => name),
      ),
    ),
  };
}

/** Every run-state value one compared entry save and the plan disagree on. */
export interface EntryComparison {
  readonly kind: 'compared';
  /** The entered record room whose entry save is compared. */
  readonly roomIndex: number;
  /** The entered room's visit ordinal of its occurrence. */
  readonly visit: number;
  readonly differences: readonly EntryDifference[];
  /** The fact families the save holds that no plan state at its moment compares. */
  readonly unchecked: readonly RunImportUncheckedFamily[];
}

/** An entry save no plan state compares. */
export interface EntryUnchecked {
  readonly kind: 'unchecked';
  readonly roomIndex: number;
  readonly visit: number;
  readonly reason: EntryUncheckedReason;
}

export interface EntryDifference extends RunImportMismatch {
  readonly area: RunImportArea;
  /** What stays the same while the difference persists. */
  readonly persists: string;
}

/**
 * Compares one record room's entry save with the plan's state at the same
 * moment: the previous room's `beforeRoomExit`, or the Hub departure that
 * left its stay.
 */
export function compareEntrySave(
  catalog: Catalog,
  record: RunRecord,
  saves: EntrySaves,
  occurrences: RecordOccurrences,
  assembly: ProjectEvaluationAssembly,
  roomIndex: number,
): EntryComparison | EntryUnchecked {
  const checkpoint = entryCheckpoint(occurrences, assembly.project, roomIndex);
  const { visit } = checkpoint;
  const saved = saves.states[roomIndex];
  if (saved === undefined) return { kind: 'unchecked', roomIndex, visit, reason: 'noEntrySaves' };
  if (checkpoint.kind === 'unchecked')
    return { kind: 'unchecked', roomIndex, visit, reason: checkpoint.reason };
  const snapshot = sourceSnapshot(assembly, checkpoint.source);
  if (snapshot === undefined) return { kind: 'unchecked', roomIndex, visit, reason: 'unreached' };
  const entered =
    checkpoint.entered === undefined
      ? undefined
      : occurrenceSnapshot(assembly, checkpoint.entered, 'roomEntered');
  const unchecked: RunImportUncheckedFamily[] =
    entered !== undefined
      ? []
      : [
          {
            family: 'elements',
            reason: checkpoint.entered === undefined ? 'noEntrySnapshot' : 'unreached',
          },
        ];
  const differences = compareEntry(
    catalog,
    record,
    assembly.project.route.routeKey,
    saved,
    snapshot,
    entered,
    saves.rarifySources,
  ).map(({ persists, ...difference }) => ({
    ...difference,
    persists: persists ?? `${difference.expected} ${difference.actual}`,
  }));
  return { kind: 'compared', roomIndex, visit, differences, unchecked };
}

/**
 * Compares each record room's entry save through `throughRoom` with the
 * plan's state at the same moment; a save no plan state compares is left out.
 */
export function compareEntrySaves(
  catalog: Catalog,
  record: RunRecord,
  occurrences: RecordOccurrences,
  assembly: ProjectEvaluationAssembly,
  throughRoom: number,
): readonly EntryComparison[] {
  const saves = entrySaves(record);
  const comparisons: EntryComparison[] = [];
  const last = Math.min(throughRoom, record.rooms.length - 1);
  for (let roomIndex = 1; roomIndex <= last; roomIndex += 1) {
    const comparison = compareEntrySave(catalog, record, saves, occurrences, assembly, roomIndex);
    if (comparison.kind === 'compared') comparisons.push(comparison);
  }
  return comparisons;
}

/**
 * The entry saves' differences as report entries: a difference that persists
 * is reported where it begins and again where it changes.
 */
export function mismatchEntries(
  comparisons: readonly EntryComparison[],
): readonly RunImportReportEntry[] {
  const entries: RunImportReportEntry[] = [];
  const previous = new Map<string, string>();
  for (const { roomIndex, visit, differences } of comparisons) {
    for (const { area, field, expected, actual, persists } of differences)
      if (previous.get(`${area} ${field}`) !== persists)
        entries.push({
          area,
          reason: 'mismatch',
          record: { roomIndex, visit },
          mismatch: { field, expected, actual },
        });
    previous.clear();
    for (const { area, field, persists } of differences) previous.set(`${area} ${field}`, persists);
  }
  return entries;
}

/** The entry saves' differences through `throughRoom` as report entries. */
export function compareImportToRecord(
  catalog: Catalog,
  record: RunRecord,
  occurrences: RecordOccurrences,
  assembly: ProjectEvaluationAssembly,
  throughRoom: number,
): readonly RunImportReportEntry[] {
  return mismatchEntries(compareEntrySaves(catalog, record, occurrences, assembly, throughRoom));
}
