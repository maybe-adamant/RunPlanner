import type { RecentRunsHost, RecordHost, SaveFileDelivery } from '@planner/persistence/recordHost';

/** A record host whose save folder the test drives and whose recent runs live in memory. */
export interface MemoryRecordHost extends RecordHost {
  readonly recentRuns: RecentRunsHost & { readonly files: Map<string, string> };
  /** Files a re-read returns, by name; a read of any other name fails. */
  readonly folder: Map<string, Uint8Array>;
  readonly watched: () => string | null;
  /** Delivers a save to the current watch, as the host's poller would. */
  deliver(delivery: SaveFileDelivery): void;
  startFailure: string | null;
  /** What the folder picker returns. */
  chosenFolder: string | null;
}

export function createMemoryRecordHost(discovered = '/saves/Hades II'): MemoryRecordHost {
  const files = new Map<string, string>();
  const folder = new Map<string, Uint8Array>();
  let watch: { folder: string; onSave: (delivery: SaveFileDelivery) => void } | null = null;
  const host: MemoryRecordHost = {
    folder,
    startFailure: null,
    chosenFolder: null,
    watched: () => watch?.folder ?? null,
    deliver: (delivery) => watch?.onSave(delivery),
    discoverFolder: () => Promise.resolve(discovered),
    start(chosen, onSave) {
      if (host.startFailure !== null) return Promise.reject(new Error(host.startFailure));
      watch = { folder: chosen ?? discovered, onSave };
      return Promise.resolve(watch.folder);
    },
    stop() {
      watch = null;
      return Promise.resolve();
    },
    chooseFolder: () => Promise.resolve(host.chosenFolder),
    readSave(fileName) {
      const bytes = folder.get(fileName);
      return bytes === undefined
        ? Promise.reject(new Error(`${fileName} is missing`))
        : Promise.resolve(bytes);
    },
    recentRuns: {
      files,
      list: () => Promise.resolve([...files.keys()].sort()),
      read: (id) => {
        const json = files.get(id);
        return json === undefined
          ? Promise.reject(new Error(`${id} is missing`))
          : Promise.resolve(json);
      },
      write: (id, json) => Promise.resolve(void files.set(id, json)),
      delete: (id) => Promise.resolve(void files.delete(id)),
    },
  };
  return host;
}
