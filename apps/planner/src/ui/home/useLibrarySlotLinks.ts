import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type {
  GamePlanSlot,
  GameStatusController,
  GameStatusSnapshot,
} from '@planner/persistence/gameModuleHost';
import {
  NO_SLOT_LINKS,
  projectLibrarySlotLinks,
  slotProjectIds,
  type LibrarySlotLinks,
} from '@planner/projections/libraryHome';
import type { LibraryItem } from '@planner/workspace/projectLibrary';
import type { ProjectOperations } from '@planner/workspace/projectOperations';

const EMPTY_SNAPSHOT: GameStatusSnapshot = Object.freeze({ status: null, error: null, readAt: 0 });
const NO_SNAPSHOT = () => EMPTY_SNAPSHOT;
const NO_SUBSCRIPTION = () => () => undefined;
const NO_SLOTS: readonly GamePlanSlot[] = Object.freeze([]);
const NO_FOLDERS: readonly string[] = Object.freeze([]);

/** The game status as last read, or an empty snapshot outside the desktop application. */
export function useGameStatusSnapshot(gameStatus: GameStatusController | undefined) {
  return useSyncExternalStore(
    gameStatus?.subscribe ?? NO_SUBSCRIPTION,
    gameStatus?.getSnapshot ?? NO_SNAPSHOT,
    NO_SNAPSHOT,
  );
}

/** Reads the game status now and whenever the window regains focus. */
export function useGameStatusRefresh(gameStatus: GameStatusController | undefined) {
  useEffect(() => {
    if (gameStatus === undefined) return;
    const refresh = () => {
      gameStatus.refresh().catch(() => undefined);
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [gameStatus]);
}

/**
 * Reads the library again when the window regains focus and each time the Library is shown
 * again, so plans added to the folder by hand appear; there is no file watcher.
 */
export function useLibraryRescan(refresh: () => void, libraryShown: boolean) {
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
  const wasShown = useRef(libraryShown);
  useEffect(() => {
    if (libraryShown && !wasShown.current) refresh();
    wasShown.current = libraryShown;
  }, [libraryShown, refresh]);
}

export interface LibrarySlotIndex {
  /** Null until the library is first read. */
  readonly items: readonly LibraryItem[] | null;
  /** Every folder, as `/`-separated paths. */
  readonly folders: readonly string[];
  /** When the library was last read, for relative edit times. */
  readonly readAt: number;
  readonly links: LibrarySlotLinks;
  readonly error: string | null;
  refresh(): void;
}

/**
 * The library's plans and the slots each one is in, read again on `refresh`. Without
 * `compare`, slots are linked by identity only and carry no current or older marker.
 */
export function useLibrarySlotLinks(
  operations: ProjectOperations,
  gameStatus: GameStatusController | undefined,
  { compare = true }: { readonly compare?: boolean } = {},
): LibrarySlotIndex {
  const snapshot = useGameStatusSnapshot(gameStatus);
  const slots = snapshot.status?.inspection?.planSlots ?? NO_SLOTS;
  const [listed, setListed] = useState<{
    readonly items: readonly LibraryItem[];
    readonly folders: readonly string[];
    readonly readAt: number;
  } | null>(null);
  const items = listed?.items ?? null;
  const [error, setError] = useState<string | null>(null);
  const [fingerprints, setFingerprints] = useState<ReadonlyMap<string, string | null> | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let live = true;
    operations.listLibrary().then(
      (read) => {
        if (!live) return;
        setListed({ items: read.items, folders: read.folders, readAt: Date.now() });
        setError(null);
      },
      (failure: unknown) => {
        if (live) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      live = false;
    };
  }, [operations, revision]);

  useEffect(() => {
    if (items === null || !compare) return;
    let live = true;
    void operations.inspectLibraryGamePlans(items, slotProjectIds(slots)).then((read) => {
      if (live) setFingerprints(read);
    });
    return () => {
      live = false;
    };
  }, [compare, items, operations, slots]);

  const links = useMemo(
    () => (items === null ? NO_SLOT_LINKS : projectLibrarySlotLinks(items, slots, fingerprints)),
    [fingerprints, items, slots],
  );
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  return {
    items,
    folders: listed?.folders ?? NO_FOLDERS,
    readAt: listed?.readAt ?? 0,
    links,
    error,
    refresh,
  };
}
