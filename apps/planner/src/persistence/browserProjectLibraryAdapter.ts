import {
  EMPTY_LIBRARY_SESSION,
  summarizeProjectJson,
  type LibrarySession,
  type OutsideProjectFile,
  type ProjectLibraryAdapter,
  type ProjectLibraryEntry,
  type ProjectLibraryListing,
} from './projectLibrary';

const DATABASE_NAME = 'run-planner-library';
const DATABASE_VERSION = 3;
const PLANS = 'plans';
const SESSION = 'session';
const FOLDERS = 'folders';
const SESSION_RECORD = 'session';

interface StoredPlan {
  readonly key: string;
  readonly json: string;
  readonly modifiedMs: number;
  /** The folder path; absent in plans stored before folders, which are at the top level. */
  readonly folder?: string;
}

interface StoredFolder {
  readonly path: string;
}

/** Whether `path` is `folder` or inside it. */
function within(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

/** Every folder a path needs, itself and its parents. */
function withParents(folder: string): string[] {
  const parts = folder.split('/');
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
}

interface StoredSession extends LibrarySession {
  readonly id: typeof SESSION_RECORD;
}

export interface BrowserProjectLibraryEnvironment {
  readonly indexedDB: () => IDBFactory;
  /** Hosts the transient file input that picks a plan to import. */
  readonly document: Document;
  readonly now?: () => number;
  readonly mintKey?: () => string;
}

/** Asks for one plan file through a transient file input; null when cancelled. */
function chooseFile(document: Document): Promise<OutsideProjectFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.accept = '.runplanner.json,.json,application/json';
    input.hidden = true;
    input.type = 'file';
    let settled = false;
    const finish = (result: OutsideProjectFile | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      input.remove();
      if (error === undefined) resolve(result);
      else reject(error instanceof Error ? error : new Error(String(error)));
    };
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0];
        if (file === undefined) {
          finish(null);
          return;
        }
        void file.text().then(
          (json) => finish(Object.freeze({ fileName: file.name, json })),
          (error: unknown) => finish(null, error),
        );
      },
      { once: true },
    );
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.append(input);
    try {
      input.click();
    } catch (error) {
      finish(null, error);
    }
  });
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
    folder: plan.folder ?? '',
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
        if (!upgrading.objectStoreNames.contains(SESSION)) {
          upgrading.createObjectStore(SESSION, { keyPath: 'id' });
        }
        if (!upgrading.objectStoreNames.contains(FOLDERS)) {
          upgrading.createObjectStore(FOLDERS, { keyPath: 'path' });
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
    async list(): Promise<ProjectLibraryListing> {
      const [plans, folders] = await transact(
        await database(),
        [PLANS, FOLDERS],
        'readonly',
        (transaction) =>
          Promise.all([
            settle<StoredPlan[]>(transaction.objectStore(PLANS).getAll()),
            settle<StoredFolder[]>(transaction.objectStore(FOLDERS).getAll()),
          ]),
      );
      return Object.freeze({
        folders: Object.freeze(folders.map((folder) => folder.path).sort()),
        entries: Object.freeze(plans.map(entryFor)),
      });
    },
    async read(key: string): Promise<string> {
      const plan = await transact(await database(), [PLANS], 'readonly', (transaction) =>
        stored(transaction, key),
      );
      return plan.json;
    },
    async create(json: string, folder: string): Promise<ProjectLibraryEntry> {
      filedIdentity(json);
      const plan: StoredPlan = { key: mintKey(), json, modifiedMs: now(), folder };
      await transact(await database(), [PLANS, FOLDERS], 'readwrite', async (transaction) => {
        if (folder !== '') {
          await Promise.all(
            withParents(folder).map((path) =>
              settle(transaction.objectStore(FOLDERS).put({ path })),
            ),
          );
        }
        await settle(transaction.objectStore(PLANS).add(plan));
      });
      return entryFor(plan);
    },
    async write(key: string, json: string): Promise<ProjectLibraryEntry> {
      filedIdentity(json);
      const plan = await transact(await database(), [PLANS], 'readwrite', async (transaction) => {
        const previous = await stored(transaction, key);
        const next: StoredPlan = { ...previous, json, modifiedMs: now() };
        await settle(transaction.objectStore(PLANS).put(next));
        return next;
      });
      return entryFor(plan);
    },
    async movePlan(key: string, folder: string): Promise<ProjectLibraryEntry> {
      const plan = await transact(
        await database(),
        [PLANS, FOLDERS],
        'readwrite',
        async (transaction) => {
          const previous = await stored(transaction, key);
          const next: StoredPlan = { ...previous, folder };
          if (folder !== '') {
            await Promise.all(
              withParents(folder).map((path) =>
                settle(transaction.objectStore(FOLDERS).put({ path })),
              ),
            );
          }
          await settle(transaction.objectStore(PLANS).put(next));
          return next;
        },
      );
      return entryFor(plan);
    },
    async createFolder(folder: string): Promise<void> {
      await transact(await database(), [FOLDERS], 'readwrite', (transaction) =>
        Promise.all(
          withParents(folder).map((path) => settle(transaction.objectStore(FOLDERS).put({ path }))),
        ),
      );
    },
    async moveFolder(from: string, to: string): Promise<void> {
      if (within(to, from)) throw new Error(`${from} cannot be moved into itself.`);
      await transact(await database(), [PLANS, FOLDERS], 'readwrite', async (transaction) => {
        const folders = transaction.objectStore(FOLDERS);
        const all = await settle<StoredFolder[]>(folders.getAll());
        if (!all.some((folder) => folder.path === from)) {
          throw new Error(`${from} is not in the library.`);
        }
        if (all.some((folder) => folder.path === to)) {
          throw new Error(`${to} is already in the library.`);
        }
        const moved = (path: string) => `${to}${path.slice(from.length)}`;
        for (const folder of all.filter((candidate) => within(candidate.path, from))) {
          await settle(folders.delete(folder.path));
          await settle(folders.put({ path: moved(folder.path) }));
        }
        for (const path of withParents(to)) await settle(folders.put({ path }));
        const plans = transaction.objectStore(PLANS);
        for (const plan of await settle<StoredPlan[]>(plans.getAll())) {
          if (plan.folder !== undefined && within(plan.folder, from)) {
            await settle(plans.put({ ...plan, folder: moved(plan.folder) }));
          }
        }
      });
    },
    async deleteFolder(folder: string): Promise<void> {
      await transact(await database(), [PLANS, FOLDERS], 'readwrite', async (transaction) => {
        const folders = transaction.objectStore(FOLDERS);
        for (const stored of await settle<StoredFolder[]>(folders.getAll())) {
          if (within(stored.path, folder)) await settle(folders.delete(stored.path));
        }
        const plans = transaction.objectStore(PLANS);
        for (const plan of await settle<StoredPlan[]>(plans.getAll())) {
          if (plan.folder !== undefined && within(plan.folder, folder)) {
            await settle(plans.delete(plan.key));
          }
        }
      });
    },
    async delete(key: string): Promise<void> {
      await transact(await database(), [PLANS], 'readwrite', async (transaction) => {
        await stored(transaction, key);
        await settle(transaction.objectStore(PLANS).delete(key));
      });
    },
    // Browser storage has no recycle bin, so an older plan is rewritten in place.
    preserveOriginal: () => Promise.resolve(),
    reveal: () => Promise.reject(new Error('The library is not a folder in this browser.')),
    chooseImportFile: () => chooseFile(environment.document),
    previousActiveFile: () => Promise.resolve(null),
    async readSession(): Promise<LibrarySession> {
      const session = await transact(await database(), [SESSION], 'readonly', (transaction) =>
        settle<StoredSession | undefined>(transaction.objectStore(SESSION).get(SESSION_RECORD)),
      );
      return session === undefined
        ? EMPTY_LIBRARY_SESSION
        : Object.freeze({
            previousFileOffered: session.previousFileOffered,
          });
    },
    async writeSession(session: LibrarySession): Promise<void> {
      const record: StoredSession = { id: SESSION_RECORD, ...session };
      await transact(await database(), [SESSION], 'readwrite', (transaction) =>
        settle(transaction.objectStore(SESSION).put(record)),
      );
    },
  });
}
