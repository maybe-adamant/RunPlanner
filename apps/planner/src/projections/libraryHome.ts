import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { GamePlanSlot, GamePlanSlotNumber } from '@planner/persistence/gameModuleHost';
import { ownEntry } from '@planner/projections/gameSlotSummary';
import type { LibraryItem } from '@planner/workspace/projectLibrary';
import { plansText, type HomeContextPart } from '@planner/projections/homeContext';

/**
 * A slot holding a library plan's identity. `current` when it holds the plan as it is now;
 * `older` with the reason otherwise; null while the plan's fingerprint is still being read.
 */
export interface PlanSlotLink {
  readonly slot: GamePlanSlotNumber;
  readonly marker: 'current' | 'older' | null;
  readonly reason: string | null;
}

/** Which library plan each slot holds, and the slots of each plan. */
export interface LibrarySlotLinks {
  readonly byKey: ReadonlyMap<string, readonly PlanSlotLink[]>;
  readonly bySlot: ReadonlyMap<
    GamePlanSlotNumber,
    { readonly key: string; readonly name: string; readonly link: PlanSlotLink }
  >;
}

/** Why a slot is older than its plan, in the few words a slot row has room for. */
export const EDITED_SINCE_SENT = 'edited since sent';
export const OUTDATED_REBUILD = 'needs rebuild';
export const OUTDATED_RESEND = 'send again';

export const NO_SLOT_LINKS: LibrarySlotLinks = Object.freeze({
  byKey: new Map(),
  bySlot: new Map(),
});

/** The projectIds the slots hold, whose plans need a fingerprint to be linked. */
export function slotProjectIds(slots: readonly GamePlanSlot[]): ReadonlySet<string> {
  return new Set(
    slots.flatMap((slot) =>
      (slot.state === 'present' || slot.state === 'stale') && slot.projectId !== null
        ? [slot.projectId]
        : [],
    ),
  );
}

/**
 * Links slots to library plans by identity. A slot is current when its fingerprint is the plan's
 * own; an outdated slot is older whatever it holds, since the module cannot play it.
 */
export function projectLibrarySlotLinks(
  items: readonly LibraryItem[],
  slots: readonly GamePlanSlot[],
  fingerprints: ReadonlyMap<string, string | null> | null,
): LibrarySlotLinks {
  const byProjectId = new Map(
    items.flatMap((item) => (item.kind === 'ready' ? [[item.projectId, item] as const] : [])),
  );
  const byKey = new Map<string, PlanSlotLink[]>();
  const bySlot = new Map<
    GamePlanSlotNumber,
    { readonly key: string; readonly name: string; readonly link: PlanSlotLink }
  >();
  for (const slot of slots) {
    if (slot.state !== 'present' && slot.state !== 'stale') continue;
    const item = slot.projectId === null ? undefined : byProjectId.get(slot.projectId);
    if (item === undefined) continue;
    let link: PlanSlotLink;
    if (slot.state === 'stale') {
      link = {
        slot: slot.slot,
        marker: 'older',
        reason: slot.hasSource ? OUTDATED_REBUILD : OUTDATED_RESEND,
      };
    } else if (fingerprints === null || !fingerprints.has(item.key)) {
      link = { slot: slot.slot, marker: null, reason: null };
    } else {
      const current = fingerprints.get(item.key) === slot.planFingerprint;
      link = {
        slot: slot.slot,
        marker: current ? 'current' : 'older',
        reason: current ? null : EDITED_SINCE_SENT,
      };
    }
    byKey.set(item.key, [...(byKey.get(item.key) ?? []), link]);
    bySlot.set(slot.slot, { key: item.key, name: item.name, link });
  }
  return Object.freeze({ byKey, bySlot });
}

/** The library plan each slot holds, by name, as the slot picker names occupants. */
export function slotNamesBySlot(links: LibrarySlotLinks): ReadonlyMap<GamePlanSlotNumber, string> {
  return new Map(Array.from(links.bySlot, ([slot, linked]) => [slot, linked.name] as const));
}

export interface LibraryRowEdited {
  readonly text: string;
  readonly iso: string;
}

interface LibraryRowPlace {
  readonly key: string;
  readonly name: string;
  readonly folder: string;
  /** The folder path shown while searching the whole library, such as "Practice › Bosses". */
  readonly location: string | null;
  readonly edited: LibraryRowEdited;
}

export type LibraryRow =
  | (LibraryRowPlace & {
      readonly kind: 'ready';
      readonly projectId: string;
      readonly routeKey: string | null;
      /** Such as "Underworld · Staff, Aspect of Melinoë". */
      readonly summary: string;
      /** Such as { count: "4 of 4", trail: "to Tartarus" }; null when unknown. */
      readonly biomes: { readonly count: string; readonly trail: string | null } | null;
      readonly slots: readonly PlanSlotLink[];
    })
  | (LibraryRowPlace & {
      readonly kind: 'unopenable';
      /** Why the planner cannot open it. */
      readonly reason: string;
    });

export interface LibraryFolderRow {
  readonly path: string;
  readonly name: string;
  /** Plans in it and in its subfolders. */
  readonly planCount: number;
}

export interface LibraryCrumb {
  readonly path: string;
  readonly name: string;
}

export type LibrarySort = 'edited' | 'name';
/** A Library filter chip: every plan, one route type, or plans in a slot. */
export type LibraryChip =
  | { readonly kind: 'all' }
  | { readonly kind: 'route'; readonly routeKey: string }
  | { readonly kind: 'inGame' };

export const ALL_PLANS: LibraryChip = Object.freeze({ kind: 'all' });

/** The chips in order: All, one per route as the route chooser names it, then In game. */
export function projectLibraryChips(
  routes: readonly { readonly routeKey: string; readonly label: string }[],
): readonly { readonly chip: LibraryChip; readonly label: string; readonly id: string }[] {
  return [
    { chip: ALL_PLANS, label: 'All', id: 'all' },
    ...routes.map((route) => ({
      chip: { kind: 'route' as const, routeKey: route.routeKey },
      label: route.label,
      id: `route:${route.routeKey}`,
    })),
    { chip: { kind: 'inGame' as const }, label: 'In game', id: 'inGame' },
  ];
}

export function sameChip(left: LibraryChip, right: LibraryChip): boolean {
  return (
    left.kind === right.kind &&
    (left.kind !== 'route' || right.kind !== 'route' || left.routeKey === right.routeKey)
  );
}

export interface LibraryViewQuery {
  readonly folder: string;
  readonly filter: string;
  readonly chip: LibraryChip;
  readonly sort: LibrarySort;
}

/** One Library screen: a folder's subfolders and plans, or whole-library results. */
export interface LibraryView {
  /** A filter or chip searches the whole library, so folder rows are left out. */
  readonly searching: boolean;
  /** "Library" first, then each folder down to the one shown. */
  readonly breadcrumb: readonly LibraryCrumb[];
  readonly folders: readonly LibraryFolderRow[];
  readonly rows: readonly LibraryRow[];
  /** The whole library's plans and how many are in game, then how many a search shows. */
  readonly context: readonly HomeContextPart[];
}

function edited(modifiedMs: number, now: number): LibraryRowEdited {
  const date = new Date(modifiedMs);
  const minutes = Math.max(0, Math.round((now - modifiedMs) / 60_000));
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  const sameDay = (left: Date, right: Date) => left.toDateString() === right.toDateString();
  const text =
    minutes < 1
      ? 'Just now'
      : minutes < 60
        ? `${minutes} min ago`
        : sameDay(date, today) && minutes < 12 * 60
          ? `${Math.round(minutes / 60)} h ago`
          : sameDay(date, today)
            ? 'Today'
            : sameDay(date, yesterday)
              ? 'Yesterday'
              : date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
                });
  return { text, iso: date.toISOString() };
}

function loadoutText(
  catalog: Catalog,
  weaponKey: string | null,
  aspectKey: string | null,
): string | null {
  const weapon = ownEntry(catalog.weapons.byKey, weaponKey)?.label ?? null;
  const aspect = ownEntry(catalog.aspects.byKey, aspectKey)?.label ?? null;
  if (weapon === null) return aspect;
  return aspect === null ? weapon : `${weapon}, ${aspect}`;
}

/** Where a plan's planned biomes end, such as "to Tartarus", or the one biome; null when unknown. */
export function plannedBiomeTrail(
  catalog: Catalog,
  routeKey: string | null,
  planned: number,
): string | null {
  const route = ownEntry(catalog.routes.byKey, routeKey);
  // A Dream itinerary is chosen per plan, so its biomes are not known from the route.
  const endKey = route?.dreamItinerary === undefined ? route?.biomeKeys[planned - 1] : undefined;
  const end = ownEntry(catalog.biomes.byKey, endKey)?.label ?? null;
  return end === null ? null : planned > 1 ? `to ${end}` : end;
}

function biomeColumn(
  catalog: Catalog,
  routeKey: string | null,
  planned: number | null,
): { readonly count: string; readonly trail: string | null } | null {
  const route = ownEntry(catalog.routes.byKey, routeKey);
  if (route === undefined || planned === null) return null;
  const total = route.dreamItinerary?.biomeCount ?? route.biomeKeys.length;
  return { count: `${planned} of ${total}`, trail: plannedBiomeTrail(catalog, routeKey, planned) };
}

function chipMatches(item: LibraryItem, chip: LibraryChip, links: LibrarySlotLinks): boolean {
  switch (chip.kind) {
    case 'all':
      return true;
    case 'route':
      return item.kind === 'ready' && item.routeKey === chip.routeKey;
    case 'inGame':
      return (links.byKey.get(item.key)?.length ?? 0) > 0;
  }
}

function within(path: string, folder: string): boolean {
  return folder === '' || path === folder || path.startsWith(`${folder}/`);
}

function folderName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** A folder path for display, such as "Practice › Bosses"; the top level is "Library". */
export function folderLocation(folder: string): string {
  return folder === '' ? 'Library' : folder.split('/').join(' › ');
}

export function projectLibraryView(
  catalog: Catalog,
  listing: { readonly items: readonly LibraryItem[]; readonly folders: readonly string[] },
  links: LibrarySlotLinks,
  now: number,
  query: LibraryViewQuery,
): LibraryView {
  const needle = query.filter.trim().toLocaleLowerCase();
  const searching = needle.length > 0 || query.chip.kind !== 'all';
  const parts = query.folder === '' ? [] : query.folder.split('/');
  const breadcrumb = [
    { path: '', name: 'Library' },
    ...parts.map((name, index) => ({ path: parts.slice(0, index + 1).join('/'), name })),
  ];
  const rows = listing.items.flatMap((item): LibraryRow[] => {
    const name = item.kind === 'unreadable' ? folderName(item.key) : item.name;
    if (searching) {
      if (needle.length > 0 && !name.toLocaleLowerCase().includes(needle)) return [];
      if (!chipMatches(item, query.chip, links)) return [];
    } else if (item.folder !== query.folder) {
      return [];
    }
    const place: LibraryRowPlace = {
      key: item.key,
      name,
      folder: item.folder,
      location: searching ? folderLocation(item.folder) : null,
      edited: edited(item.modifiedMs, now),
    };
    switch (item.kind) {
      case 'ready': {
        const route = ownEntry(catalog.routes.byKey, item.routeKey)?.label ?? item.routeKey;
        const loadout = loadoutText(catalog, item.weaponKey, item.aspectKey);
        return [
          {
            ...place,
            kind: 'ready',
            projectId: item.projectId,
            routeKey: item.routeKey,
            summary: [route, loadout].filter((part) => part !== null).join(' · '),
            biomes: biomeColumn(catalog, item.routeKey, item.biomeCount),
            slots: links.byKey.get(item.key) ?? [],
          },
        ];
      }
      case 'tooNew':
        return [
          {
            ...place,
            kind: 'unopenable',
            reason: 'Made by a newer Run Planner; update to open it.',
          },
        ];
      case 'unreadable':
        return [{ ...place, kind: 'unopenable', reason: item.message }];
    }
  });
  const modified = new Map(listing.items.map((item) => [item.key, item.modifiedMs]));
  rows.sort((left, right) =>
    query.sort === 'name'
      ? left.name.localeCompare(right.name)
      : (modified.get(right.key) ?? 0) - (modified.get(left.key) ?? 0),
  );
  const folders = searching
    ? []
    : listing.folders
        .filter((path) => path !== query.folder && within(path, query.folder))
        .filter(
          (path) => !path.slice(query.folder === '' ? 0 : query.folder.length + 1).includes('/'),
        )
        .map((path) => ({
          path,
          name: folderName(path),
          planCount: listing.items.filter((item) => within(item.folder, path) && item.folder !== '')
            .length,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
  const inGame = listing.items.filter(
    (item) => item.kind === 'ready' && (links.byKey.get(item.key)?.length ?? 0) > 0,
  ).length;
  const context: HomeContextPart[] = [{ text: plansText(listing.items.length), tone: null }];
  if (inGame > 0) context.push({ text: `${inGame} in game`, tone: 'ok' });
  if (searching) context.push({ text: `${rows.length} shown`, tone: null });
  return Object.freeze({ searching, breadcrumb, folders, rows, context });
}

/**
 * A deleted plan's notice, naming the slots that still hold it, such as
 * `Deleted “Wells” · still in slots 2 and 9`; deleting never touches a slot.
 */
export function describeDeletedPlan(
  name: string,
  slots: readonly { readonly slot: GamePlanSlotNumber }[],
): string {
  const deleted = `Deleted “${name}”`;
  const numbers = slots.map((link) => String(link.slot));
  if (numbers.length === 0) return deleted;
  const listed =
    numbers.length === 1
      ? `slot ${numbers[0]}`
      : `slots ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
  return `${deleted} · still in ${listed}`;
}

/** An import's summary notice; `lasting` while a file could not be imported. */
export interface ImportSummary {
  readonly text: string;
  readonly lasting: boolean;
}

/** "Imported 4 plans", or "Imported 3 · 1 couldn’t be read: <file>: <reason>"; null when cancelled. */
export function describeImportSummary(
  imported: readonly string[],
  failed: readonly { readonly fileName: string; readonly message: string }[],
): ImportSummary | null {
  const reasons = failed.map((file) => `${file.fileName}: ${file.message}`).join('; ');
  const unread =
    failed.length === 0
      ? null
      : imported.length === 0 && failed.length === 1
        ? `Couldn’t read ${reasons}`
        : `${failed.length} couldn’t be read: ${reasons}`;
  if (imported.length === 0) return unread === null ? null : { text: unread, lasting: true };
  const done =
    imported.length === 1 && unread === null
      ? `Imported “${imported[0]}”`
      : unread === null
        ? `Imported ${imported.length} plans`
        : `Imported ${imported.length}`;
  return unread === null
    ? { text: done, lasting: false }
    : { text: `${done} · ${unread}`, lasting: true };
}
