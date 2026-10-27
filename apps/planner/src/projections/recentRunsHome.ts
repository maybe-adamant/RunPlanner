import {
  TRAIT_OPTION_KEYS,
  type AuthoredTraitOffer,
  type AuthoredTraitOption,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RunImportArea, RunImportReason } from '@run-planner/engine/simulation';

import type { HomeContextPart } from '@planner/projections/homeContext';
import { ownEntry } from '@planner/projections/gameSlotSummary';
import type { RecordingStatus } from '@planner/state/recordingSessionSlice';
import type { LibraryItem } from '@planner/workspace/projectLibrary';
import type { RecentRunEntry, RecentRunSummary } from '@planner/workspace/run-recording/recentRuns';

/** The library-copy key a recorded run is remembered under, beside catalog entries. */
export function recentRunCopyKey(id: string): string {
  return `recent-run:${id}`;
}

export type RecentRunRowAction =
  | { readonly kind: 'add' }
  | { readonly kind: 'inLibrary'; readonly key: string }
  /** No plan was built, so there is nothing to add. */
  | { readonly kind: 'none' };

export interface RecentRunMarker {
  readonly kind: 'cut' | 'partial' | 'failed';
  readonly label: string;
  /** Why, when the marker alone does not say it. */
  readonly hint: string | null;
}

export interface RecentRunRow {
  readonly id: string;
  readonly runCount: number;
  readonly played: { readonly text: string; readonly iso: string };
  /** Such as "Profile 2 · Run 1001 · Attempt 1". */
  readonly identity: string;
  /** Biome names in visit order, such as "Erebus › Oceanus". */
  readonly route: string;
  /** The catalog route whose biomes the run walked, null when none matches. */
  readonly routeKey: string | null;
  readonly rooms: string;
  readonly loadout: string | null;
  readonly outcome: {
    readonly text: string;
    readonly tone: 'ok' | null;
    /** Where it ended, such as "Thessaly · Eris". */
    readonly room: string | null;
  };
  readonly guesses: number;
  readonly marker: RecentRunMarker | null;
  readonly action: RecentRunRowAction;
  /** The plan can be imported again from the stored record. */
  readonly rebuildable: boolean;
  /** The name a library copy takes. */
  readonly planName: string;
}

export interface RecentRunsView {
  readonly rows: readonly RecentRunRow[];
  readonly context: readonly HomeContextPart[];
}

const OUTCOME_TEXT: Readonly<Record<RecentRunSummary['outcome'], string>> = {
  victory: 'Victory',
  death: 'Death',
  reset: 'Reset',
  unfinished: 'Unfinished',
};

/** The catalog route a recorded run walked: the Dream route, or the route opening on its first biome. */
function recordedRouteKey(catalog: Catalog, route: RecentRunSummary['route']): string | null {
  const first = route.biomes[0];
  const match = catalog.routes.values.find((candidate) =>
    route.dream ? candidate.dreamItinerary !== undefined : candidate.biomeKeys[0] === first,
  );
  return match?.key ?? null;
}

function played(startedAt: number, now: number): { readonly text: string; readonly iso: string } {
  const date = new Date(startedAt * 1000);
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  const sameDay = (left: Date, right: Date) => left.toDateString() === right.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const day = sameDay(date, today)
    ? 'Today'
    : sameDay(date, yesterday)
      ? 'Yesterday'
      : date.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
        });
  return { text: `${day}, ${time}`, iso: date.toISOString() };
}

function biomeLabel(catalog: Catalog, biomeKey: string | undefined): string | null {
  return ownEntry(catalog.biomes.byKey, biomeKey)?.label ?? null;
}

/** A recorded room by game name, with its biome, such as "Erebus · Combat 01". */
export function recordedRoomLabel(catalog: Catalog, gameName: string): string {
  const room = ownEntry(catalog.rooms.byKey, gameName);
  if (room === undefined) return gameName;
  const biome = biomeLabel(catalog, room.roomSetKey);
  return biome === null ? room.label : `${biome} · ${room.label}`;
}

function loadoutText(catalog: Catalog, summary: RecentRunSummary): string | null {
  if (summary.loadout === undefined) return null;
  const weapon = ownEntry(catalog.weapons.byKey, summary.loadout.weapon)?.label ?? null;
  const aspect = ownEntry(catalog.aspects.byKey, summary.loadout.aspect)?.label ?? null;
  if (weapon === null) return aspect;
  return aspect === null ? weapon : `${weapon}, ${aspect}`;
}

function marker(summary: RecentRunSummary): RecentRunMarker | null {
  if (summary.failure !== undefined)
    return { kind: 'failed', label: 'Not imported', hint: summary.failure };
  if (summary.gap)
    return { kind: 'cut', label: 'Cut', hint: 'A room was missed; the plan ends before it.' };
  if (summary.importKind === 'stopped')
    return { kind: 'partial', label: 'Partial', hint: 'The plan ends early; see guesses.' };
  return null;
}

/** Recorded runs, newest first, each with what it offers the library. */
export function projectRecentRunsView(
  catalog: Catalog,
  runs: readonly RecentRunSummary[],
  library: {
    readonly items: readonly LibraryItem[] | null;
    readonly copies: Readonly<Record<string, string>>;
  },
  now: number,
): RecentRunsView {
  const keyByProjectId = new Map(
    (library.items ?? []).flatMap((item) =>
      item.kind === 'ready' ? [[item.projectId, item.key] as const] : [],
    ),
  );
  const rows = runs.map((summary): RecentRunRow => {
    const copyKey = recentRunCopyKey(summary.id);
    const copy = Object.hasOwn(library.copies, copyKey)
      ? keyByProjectId.get(library.copies[copyKey]!)
      : undefined;
    const route = summary.route.dream
      ? 'Dream'
      : summary.route.biomes.map((biome) => biomeLabel(catalog, biome) ?? biome).join(' › ');
    const identity = `Profile ${summary.profile} · Run ${summary.runCount} · Attempt ${summary.attempt}`;
    return {
      id: summary.id,
      runCount: summary.runCount,
      played: played(summary.startedAt, now),
      identity,
      route,
      routeKey: recordedRouteKey(catalog, summary.route),
      rooms: `${summary.route.rooms} ${summary.route.rooms === 1 ? 'room' : 'rooms'}`,
      loadout: loadoutText(catalog, summary),
      outcome: {
        text: OUTCOME_TEXT[summary.outcome],
        tone: summary.outcome === 'victory' ? 'ok' : null,
        room:
          summary.route.endingRoom === ''
            ? null
            : recordedRoomLabel(catalog, summary.route.endingRoom),
      },
      guesses: summary.reportCount,
      marker: marker(summary),
      action:
        copy !== undefined
          ? { kind: 'inLibrary', key: copy }
          : summary.failure === undefined
            ? { kind: 'add' }
            : { kind: 'none' },
      rebuildable: summary.hasRecord,
      planName: `${identity} (${OUTCOME_TEXT[summary.outcome]})`,
    };
  });
  return Object.freeze({
    rows,
    context: [{ text: `${rows.length} ${rows.length === 1 ? 'run' : 'runs'}`, tone: null }],
  });
}

/**
 * A save folder as shown on screen: inside the home folder it starts at `%USERPROFILE%` on
 * Windows or `~` elsewhere, so the user name stays off screen.
 */
export function shownSaveFolder(folder: string, home: string | null): string {
  // A drive letter or UNC share marks a Windows home, whose paths ignore case and take either
  // separator.
  const windows = home !== null && /^([A-Za-z]:[\\/]|\\\\)/.test(home);
  const base = home?.replace(/[\\/]+$/, '') ?? '';
  if (base === '') return folder;
  const comparable = (path: string) => (windows ? path.replaceAll('/', '\\').toLowerCase() : path);
  const rest = folder.slice(base.length);
  if (comparable(folder.slice(0, base.length)) !== comparable(base)) return folder;
  if (rest !== '' && !(windows ? /^[\\/]/ : /^\//).test(rest)) return folder;
  return `${windows ? '%USERPROFILE%' : '~'}${rest}`;
}

/** The recording indicator: what the watch is doing, in a few words. */
export function recordingIndicator(status: RecordingStatus): {
  readonly text: string;
  readonly tone: 'ok' | 'next' | 'error' | null;
} {
  switch (status.kind) {
    case 'off':
      return { text: 'Off', tone: null };
    case 'watching':
      return { text: 'Waiting for a run', tone: 'ok' };
    case 'runOpen': {
      const runs = status.runs.map(
        (run) => `profile ${run.profile} · ${run.rooms} ${run.rooms === 1 ? 'room' : 'rooms'}`,
      );
      return { text: `Recording ${runs.join(', ')}`, tone: 'next' };
    }
    case 'importing':
      return { text: 'Importing…', tone: 'next' };
    case 'error':
      return { text: 'Stopped', tone: 'error' };
  }
}

const AREA_LABELS: Readonly<Record<RunImportArea, string>> = {
  loadout: 'Loadout',
  route: 'Route',
  doors: 'Doors',
  hub: 'Hub',
  reward: 'Rewards',
  encounter: 'Encounters',
  traitOffer: 'Boon offers',
  conversion: 'Reward swaps',
  roomActionOrder: 'Pickup order',
  shop: 'Shops',
  well: 'Wells',
  pool: 'Purging Pools',
  anvil: 'Anvils',
  embryo: 'Embryo',
  pathOfStars: 'Path of Stars',
  chaosGate: 'Chaos gates',
  rack: 'Keepsake racks',
  fountain: 'Fountains',
  wheel: 'Ship wheels',
  fields: 'Fields cages',
  resource: 'Gathering points',
  npc: 'NPCs',
  menace: 'Menace',
  reroll: 'Rerolls',
  dream: 'Dream',
  traits: 'Traits',
  keepsake: 'Keepsake',
  stores: 'Reward stores',
  denial: 'Vow of Denial',
  chaos: 'Chaos',
  forfeit: 'Vow of Forfeit',
  elements: 'Elements',
  other: 'Other',
};

const REASON_TEXT: Readonly<Record<RunImportReason, string>> = {
  notInRecord: 'Guessed',
  refused: 'Replaced',
  inverseMismatch: 'Default foes',
  unsupportedArea: 'Not supported',
  assumption: 'Assumed',
  stopped: 'Plan ends here',
  mismatch: 'Differs',
};

/** The trait a trait offer selected, when it offers traits. */
function selectedTraitKey(offer: AuthoredTraitOffer): string | undefined {
  if (offer.kind !== 'traits') return undefined;
  const options: readonly AuthoredTraitOption[] = offer.options;
  return options[TRAIT_OPTION_KEYS.indexOf(offer.selectedOptionKey)]?.traitKey;
}

/** The value an applied command chose, by its catalog name, when it names one. */
export function appliedValue(catalog: Catalog, command: ProjectCommand | undefined): string | null {
  if (command === undefined) return null;
  switch (command.kind) {
    case 'CreateTarget':
      return ownEntry(catalog.rooms.byKey, command.gameName)?.label ?? command.gameName;
    case 'ReplaceAcquisitionEntryOffer':
    case 'ReplaceLocalReward':
      return (
        ownEntry(catalog.rewards.rewardTypes.byKey, command.value.rewardType)?.label ??
        command.value.rewardType
      );
    case 'ReplaceTraitOffer': {
      const traitKey = selectedTraitKey(command.value);
      return traitKey === undefined
        ? null
        : (ownEntry(catalog.traits.byKey, traitKey)?.label ?? traitKey);
    }
    default:
      return null;
  }
}

export interface RunGuessLine {
  readonly key: string;
  /** The record room's place in the run, from 1. */
  readonly order: number | null;
  readonly room: string | null;
  readonly text: string;
}

/** The decision an area's value-less assumptions concern, where it differs from the area. */
const ASSUMED_LABELS: Partial<Record<RunImportArea, string>> = {
  doors: 'Door order',
};

export interface RunGuessGroup {
  readonly area: RunImportArea;
  readonly label: string;
  /** The area's assumptions that name no value, as one line, such as "Door order assumed in 19 rooms". */
  readonly assumed: string | null;
  /** Entries that name a value or are not plain assumptions, each on its own line. */
  readonly lines: readonly RunGuessLine[];
}

/**
 * A run's import report, by area in first-seen order. Lines name their room; an area's
 * value-less assumptions collapse into one line.
 */
export function projectRunGuesses(
  catalog: Catalog,
  entry: RecentRunEntry,
): readonly RunGuessGroup[] {
  const groups = new Map<
    RunImportArea,
    { lines: RunGuessLine[]; assumedRooms: Set<number>; assumedCount: number }
  >();
  for (const [position, reported] of (entry.report?.entries ?? []).entries()) {
    const roomIndex = reported.record?.roomIndex;
    const value = appliedValue(catalog, reported.applied);
    const group = groups.get(reported.area) ?? {
      lines: [],
      assumedRooms: new Set<number>(),
      assumedCount: 0,
    };
    groups.set(reported.area, group);
    if (reported.reason === 'assumption' && value === null) {
      group.assumedCount += 1;
      if (roomIndex !== undefined) group.assumedRooms.add(roomIndex);
      continue;
    }
    const room = roomIndex === undefined ? undefined : entry.record?.rooms[roomIndex];
    group.lines.push({
      key: String(position),
      order: roomIndex === undefined ? null : roomIndex + 1,
      room: room === undefined ? null : recordedRoomLabel(catalog, room.name),
      text:
        value === null ? REASON_TEXT[reported.reason] : `${REASON_TEXT[reported.reason]} ${value}`,
    });
  }
  return [...groups].map(([area, group]) => {
    const rooms = group.assumedRooms.size;
    const noun = ASSUMED_LABELS[area] ?? AREA_LABELS[area];
    return {
      area,
      label: AREA_LABELS[area],
      assumed:
        group.assumedCount === 0
          ? null
          : rooms === 0
            ? `${noun} assumed`
            : `${noun} assumed in ${rooms} ${rooms === 1 ? 'room' : 'rooms'}`,
      lines: group.lines,
    };
  });
}
