import {
  summarizeProjectJson,
  type OutsideProjectFile,
  type ProjectLibraryAdapter,
  type ProjectLibraryEntry,
} from './projectLibrary';

const DATABASE_NAME = 'run-planner-library';
const DATABASE_VERSION = 1;
const PLANS = 'plans';
const BIN = 'bin';
/** How long a deleted plan stays restorable in browser storage. */
const BIN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredPlan {
  readonly key: string;
  readonly json: string;
  readonly modifiedMs: number;
}

interface BinnedPlan extends StoredPlan {
  readonly deletedMs: number;
}

export interface BrowserProjectLibraryEnvironment {
  readonly indexedDB: () => IDBFactory;
  /** Picks a file through the browser's file input and reads it; null when cancelled. */
  readonly chooseFile: () => Promise<OutsideProjectFile | null>;
  readonly now?: () => number;
  readonly mintKey?: () => string;
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Browser storage request failed'));
  });
}

/** Runs `body` in one transaction and resolves with its value once the transaction commits. */
function transact<T>(
  database: IDBDatabase,
  stores: readonly string[],
  mode: IDBTransactionMode,
  body: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const transaction = database.transaction([...stores], mode);
  const committed = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Browser storage transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Browser storage transaction aborted'));
  });
  return Promise.all([body(transaction), committed]).then(([value]) => value);
}

function filedIdentity(json: string): void {
  const content = summarizeProjectJson(json);
  if (content.status === 'unreadable') throw new Error(content.message);
  if ((content.summary.projectId ?? '').trim().length === 0) {
    throw new Error('The plan has no project identity.');
  }
  if ((content.summary.name ?? '').trim().length === 0) throw new Error('The plan has no name.');
}

function entryFor(plan: StoredPlan): ProjectLibraryEntry {
  return Object.freeze({
    key: plan.key,
    modifiedMs: plan.modifiedMs,
    content: summarizeProjectJson(plan.json),
  });
}

/** The library in this browser's IndexedDB; there is no folder to show. */
export function createBrowserProjectLibraryAdapter(
  environment: BrowserProjectLibraryEnvironment,
): ProjectLibraryAdapter {
  const now = environment.now ?? (() => Date.now());
  const mintKey = environment.mintKey ?? (() => globalThis.crypto.randomUUID());
  let opened: Promise<IDBDatabase> | null = null;
  const database = (): Promise<IDBDatabase> => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = environment.indexedDB().open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const upgrading = request.result;
        if (!upgrading.objectStoreNames.contains(PLANS)) {
          upgrading.createObjectStore(PLANS, { keyPath: 'key' });
        }
        if (!upgrading.objectStoreNames.contains(BIN)) {
          upgrading.createObjectStore(BIN, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open browser storage'));
    }).catch((error: unknown) => {
      opened = null;
      throw error;
    });
    return opened;
  };
  const stored = async (transaction: IDBTransaction, key: string): Promise<StoredPlan> => {
    const plan = await settle<StoredPlan | undefined>(transaction.objectStore(PLANS).get(key));
    if (plan === undefined) throw new Error(`${key} is not in the library.`);
    return plan;
  };

  return Object.freeze({
    supportsReveal: false,
    async list(): Promise<readonly ProjectLibraryEntry[]> {
      const plans = await transact(await database(), [PLANS], 'readonly', (transaction) =>
        settle<StoredPlan[]>(transaction.objectStore(PLANS).getAll()),
      );
      return Object.freeze(plans.map(entryFor));
    },
    async read(key: string): Promise<string> {
      const plan = await transact(await database(), [PLANS], 'readonly', (transaction) =>
        stored(transaction, key),
      );
      return plan.json;
    },
    async create(json: string): Promise<ProjectLibraryEntry> {
      filedIdentity(json);
      const plan: StoredPlan = { key: mintKey(), json, modifiedMs: now() };
      await transact(await database(), [PLANS], 'readwrite', (transaction) =>
        settle(transaction.objectStore(PLANS).add(plan)),
      );
      return entryFor(plan);
    },
    async write(key: string, json: string): Promise<ProjectLibraryEntry> {
      filedIdentity(json);
      const plan: StoredPlan = { key, json, modifiedMs: now() };
      await transact(await database(), [PLANS], 'readwrite', (transaction) =>
        settle(transaction.objectStore(PLANS).put(plan)),
      );
      return entryFor(plan);
    },
    async delete(key: string): Promise<void> {
      const deletedMs = now();
      await transact(await database(), [PLANS, BIN], 'readwrite', async (transaction) => {
        const plan = await stored(transaction, key);
        const bin = transaction.objectStore(BIN);
        const binned = await settle<BinnedPlan[]>(bin.getAll());
        const expired = binned.filter((item) => deletedMs - item.deletedMs > BIN_RETENTION_MS);
        await Promise.all([
          settle(transaction.objectStore(PLANS).delete(key)),
          settle(bin.put({ ...plan, deletedMs } satisfies BinnedPlan)),
          ...expired.map((item) => settle(bin.delete(item.key))),
        ]);
      });
    },
    async restore(key: string): Promise<ProjectLibraryEntry> {
      return transact(await database(), [PLANS, BIN], 'readwrite', async (transaction) => {
        const plans = transaction.objectStore(PLANS);
        if ((await settle(plans.count(key))) > 0)
          throw new Error(`${key} is already in the library.`);
        const bin = transaction.objectStore(BIN);
        const binned = await settle<BinnedPlan | undefined>(bin.get(key));
        if (binned === undefined) throw new Error('The plan is no longer in the trash.');
        const plan: StoredPlan = { key, json: binned.json, modifiedMs: binned.modifiedMs };
        await Promise.all([settle(plans.add(plan)), settle(bin.delete(key))]);
        return entryFor(plan);
      });
    },
    reveal: () => Promise.reject(new Error('The library is not a folder in this browser.')),
    chooseImportFile: () => environment.chooseFile(),
    previousActiveFile: () => Promise.resolve(null),
  });
}
