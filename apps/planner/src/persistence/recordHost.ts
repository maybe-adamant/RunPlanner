import { Channel, invoke as tauriInvoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

/** One changed profile save, read when its change was seen. */
export interface SaveFileDelivery {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/** The recent-runs documents, by id; their meaning and limit are the planner's. */
export interface RecentRunsHost {
  list(): Promise<readonly string[]>;
  read(id: string): Promise<string>;
  write(id: string, json: string): Promise<void>;
  delete(id: string): Promise<void>;
}

/** The desktop host's Hades II save watch; the web build has none. */
export interface RecordHost {
  /** The save folder found on this computer, if any. */
  discoverFolder(): Promise<string | null>;
  /**
   * Watches `folder`, or the discovered folder when null, and delivers each changed
   * save in write order, starting with the saves already there; a delivery that
   * cannot be read goes to `onProblem`. Resolves with the folder.
   */
  start(
    folder: string | null,
    onSave: (delivery: SaveFileDelivery) => void,
    onProblem: (problem: string) => void,
  ): Promise<string>;
  stop(): Promise<void>;
  /** Reads a save of the watched folder again. */
  readSave(fileName: string): Promise<Uint8Array>;
  /** Asks for a save folder, starting at `current`; null when the user cancels. */
  chooseFolder(current: string | null): Promise<string | null>;
  readonly recentRuns: RecentRunsHost;
}

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const utf8 = new TextDecoder('utf-8');

/** Reads the host's save frame: a `u16` name length, the UTF-8 name, then the file. */
export function readSaveFrame(frame: ArrayBuffer): SaveFileDelivery {
  const bytes = new Uint8Array(frame);
  if (bytes.length < 2) throw new Error('save frame is too short');
  const nameLength = bytes[0]! | (bytes[1]! << 8);
  if (bytes.length < 2 + nameLength) throw new Error('save frame name is cut short');
  return {
    fileName: utf8.decode(bytes.subarray(2, 2 + nameLength)),
    bytes: bytes.subarray(2 + nameLength),
  };
}

type OpenFolderDialog = (current: string | null) => Promise<string | null>;

const openFolderDialog: OpenFolderDialog = async (current) => {
  const chosen = await open({
    directory: true,
    multiple: false,
    title: 'Hades II save folder',
    ...(current === null ? {} : { defaultPath: current }),
  });
  return typeof chosen === 'string' ? chosen : null;
};

export function createTauriRecordHost(
  invoke: Invoke = tauriInvoke,
  createChannel: (onMessage: (frame: ArrayBuffer) => void) => unknown = (onMessage) =>
    new Channel<ArrayBuffer>(onMessage),
  chooseFolder: OpenFolderDialog = openFolderDialog,
): RecordHost {
  return Object.freeze({
    discoverFolder: () => invoke<string | null>('record_save_folder_discover'),
    start: (
      folder: string | null,
      onSave: (delivery: SaveFileDelivery) => void,
      onProblem: (problem: string) => void,
    ) =>
      invoke<string>('record_watch_start', {
        folder,
        onSave: createChannel((frame) => {
          let delivery: SaveFileDelivery;
          try {
            delivery = readSaveFrame(frame);
          } catch (error) {
            onProblem(error instanceof Error ? error.message : String(error));
            return;
          }
          onSave(delivery);
        }),
      }),
    stop: () => invoke<void>('record_watch_stop'),
    readSave: async (fileName: string) =>
      new Uint8Array(await invoke<ArrayBuffer>('record_save_read', { fileName })),
    chooseFolder,
    recentRuns: Object.freeze({
      list: () => invoke<readonly string[]>('recent_runs_list'),
      read: (id: string) => invoke<string>('recent_runs_read', { id }),
      write: (id: string, json: string) => invoke<void>('recent_runs_write', { id, json }),
      delete: (id: string) => invoke<void>('recent_runs_delete', { id }),
    }),
  });
}

/** Recording on or off and the chosen save folder; device-local, like the app scale. */
export interface RecordingPreference {
  read(): { readonly enabled: boolean; readonly folder: string | null };
  write(value: { readonly enabled: boolean; readonly folder: string | null }): void;
}

const preferenceKey = 'run-planner.recording';

export function createBrowserRecordingPreference(
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
): RecordingPreference {
  let memory = { enabled: false, folder: null as string | null };
  return {
    read() {
      try {
        const raw = storage().getItem(preferenceKey);
        if (raw === null) return memory;
        const value = JSON.parse(raw) as { enabled?: unknown; folder?: unknown };
        return {
          enabled: value.enabled === true,
          folder: typeof value.folder === 'string' && value.folder !== '' ? value.folder : null,
        };
      } catch {
        // Restricted or damaged storage keeps this session's choice.
        return memory;
      }
    },
    write(value) {
      memory = { enabled: value.enabled, folder: value.folder };
      try {
        storage().setItem(preferenceKey, JSON.stringify(memory));
      } catch {
        // Recording still follows the choice for this session.
      }
    },
  };
}
