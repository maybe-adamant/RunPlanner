/**
 * An in-memory IndexedDB covering the calls the browser library adapter makes: open with an
 * upgrade, key-path object stores, and get/getAll/count/add/put/delete in transactions that
 * commit when no request is pending and roll back when a request fails. Events fire as tasks.
 */

type Row = Record<string, unknown>;
type Stores = Map<string, { keyPath: string; rows: Map<string, Row> }>;

class MemoryRequest<T> {
  result = undefined as T;
  error: Error | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: (() => void) | null = null;
}

function later(task: () => void): void {
  setTimeout(task, 0);
}

class MemoryTransaction {
  error: Error | null = null;
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  #pending = 0;
  #finished = false;
  readonly #snapshot: Map<string, Map<string, Row>>;

  constructor(
    readonly stores: Stores,
    readonly names: readonly string[],
    readonly mode: IDBTransactionMode,
  ) {
    this.#snapshot = new Map(names.map((name) => [name, new Map(this.#store(name).rows)]));
    later(() => this.#settle());
  }

  #store(name: string) {
    const store = this.stores.get(name);
    if (store === undefined || !this.names.includes(name)) {
      throw new Error(`NotFoundError: ${name} is not in this transaction`);
    }
    return store;
  }

  objectStore(name: string) {
    const store = this.#store(name);
    const request = <T>(operation: () => T, writes: boolean): MemoryRequest<T> => {
      if (this.#finished) throw new Error('TransactionInactiveError');
      if (writes && this.mode === 'readonly') throw new Error('ReadOnlyError');
      const pending = new MemoryRequest<T>();
      this.#pending += 1;
      later(() => {
        this.#pending -= 1;
        if (this.#finished) return;
        try {
          pending.result = operation();
          pending.onsuccess?.();
          later(() => this.#settle());
        } catch (error) {
          pending.error = error instanceof Error ? error : new Error(String(error));
          pending.onerror?.();
          this.#abort(pending.error);
        }
      });
      return pending;
    };
    const keyOf = (value: Row): string => {
      const key = value[store.keyPath];
      if (typeof key !== 'string') throw new Error('DataError: missing key');
      return key;
    };
    return {
      get: (key: string) => request(() => structuredClone(store.rows.get(key)), false),
      getAll: () =>
        request(() => [...store.rows.values()].map((row) => structuredClone(row)), false),
      count: (key: string) => request(() => (store.rows.has(key) ? 1 : 0), false),
      add: (value: Row) =>
        request(() => {
          const key = keyOf(value);
          if (store.rows.has(key)) throw new Error('ConstraintError: key already exists');
          store.rows.set(key, structuredClone(value));
          return key;
        }, true),
      put: (value: Row) =>
        request(() => {
          const key = keyOf(value);
          store.rows.set(key, structuredClone(value));
          return key;
        }, true),
      delete: (key: string) =>
        request(() => {
          store.rows.delete(key);
          return undefined;
        }, true),
    };
  }

  #settle(): void {
    if (this.#finished || this.#pending > 0) return;
    this.#finished = true;
    this.oncomplete?.();
  }

  #abort(error: Error): void {
    if (this.#finished) return;
    this.#finished = true;
    for (const [name, rows] of this.#snapshot) this.#store(name).rows = rows;
    this.error = error;
    this.onerror?.();
    this.onabort?.();
  }
}

class MemoryDatabase {
  constructor(readonly stores: Stores) {}

  readonly objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };

  createObjectStore(name: string, options: { keyPath: string }): void {
    this.stores.set(name, { keyPath: options.keyPath, rows: new Map() });
  }

  transaction(names: readonly string[] | string, mode: IDBTransactionMode = 'readonly') {
    return new MemoryTransaction(this.stores, typeof names === 'string' ? [names] : names, mode);
  }
}

/** A factory whose databases outlive the adapters opened over it, as a browser profile does. */
export function createMemoryIndexedDb(): IDBFactory {
  const databases = new Map<string, { version: number; stores: Stores }>();
  const factory = {
    open(name: string, version = 1) {
      const request = new MemoryRequest<MemoryDatabase>();
      later(() => {
        let known = databases.get(name);
        const upgrade = known === undefined || known.version < version;
        known ??= { version, stores: new Map() };
        known.version = version;
        databases.set(name, known);
        request.result = new MemoryDatabase(known.stores);
        if (upgrade) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  return factory as unknown as IDBFactory;
}
