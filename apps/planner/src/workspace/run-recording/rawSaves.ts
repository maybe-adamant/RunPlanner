import type { RawSavesHost, SaveFileDelivery } from '@planner/persistence/recordHost';

/** An open run's raw saves wait in its profile's folder until the run is kept or dropped. */
export const openRawFolder = (profile: number) => `open-p${profile}`;

const openRawProfile = (folder: string): number | undefined => {
  const match = /^open-p(\d{1,4})$/.exec(folder);
  return match === null ? undefined : Number(match[1]);
};

/** `NNN-<save file name>`: the arrival number, then the name the save was delivered under. */
const SEQUENCED = /^(\d+)-(.+)$/;

const sequenced = (names: readonly string[]) =>
  names
    .flatMap((name) => {
      const match = SEQUENCED.exec(name);
      return match === null ? [] : [{ name, index: Number(match[1]), fileName: match[2]! }];
    })
    .sort((left, right) => left.index - right.index);

/**
 * Every save accepted for a recorded run, byte for byte, in arrival order: one folder per
 * open run, renamed to its stored run's id when the run is kept.
 */
export interface RawSaveCapture {
  /** Adds a save to the profile's open run; `fresh` first clears what an earlier run left. */
  append(profile: number, delivery: SaveFileDelivery, fresh: boolean): Promise<void>;
  /** The profile's open run was kept as `id`; its saves become that run's. */
  keep(profile: number, id: string): Promise<void>;
  /** The profile's open run was not kept. */
  discard(profile: number): Promise<void>;
  /** A stored run's saves in arrival order; none when it has no folder. */
  read(id: string): Promise<readonly SaveFileDelivery[]>;
  delete(id: string): Promise<void>;
  /** Removes every folder but the stored runs' and the open runs' of `profiles`. */
  prune(ids: ReadonlySet<string>, profiles: ReadonlySet<number>): Promise<void>;
}

export function createRawSaveCapture(host: RawSavesHost): RawSaveCapture {
  /** Each open folder's next arrival number, once known. */
  const next = new Map<number, number>();
  const nextIndex = async (profile: number) => {
    const known = next.get(profile);
    if (known !== undefined) return known;
    const last = sequenced(await host.list(openRawFolder(profile))).at(-1);
    return last === undefined ? 0 : last.index + 1;
  };
  const close = (profile: number, task: Promise<void>) => {
    next.delete(profile);
    return task;
  };
  return Object.freeze({
    async append(profile: number, delivery: SaveFileDelivery, fresh: boolean) {
      const folder = openRawFolder(profile);
      if (fresh) {
        next.delete(profile);
        await host.delete(folder);
      }
      const index = fresh ? 0 : await nextIndex(profile);
      await host.write(
        folder,
        `${String(index).padStart(3, '0')}-${delivery.fileName}`,
        delivery.bytes,
      );
      next.set(profile, index + 1);
    },
    keep: (profile: number, id: string) => close(profile, host.move(openRawFolder(profile), id)),
    discard: (profile: number) => close(profile, host.delete(openRawFolder(profile))),
    async read(id: string) {
      const saves: SaveFileDelivery[] = [];
      for (const { name, fileName } of sequenced(await host.list(id)))
        saves.push({ fileName, bytes: await host.read(id, name) });
      return saves;
    },
    delete: (id: string) => host.delete(id),
    async prune(ids: ReadonlySet<string>, profiles: ReadonlySet<number>) {
      for (const folder of await host.folders()) {
        const profile = openRawProfile(folder);
        if (profile === undefined ? ids.has(folder) : profiles.has(profile)) continue;
        if (profile !== undefined) next.delete(profile);
        await host.delete(folder);
      }
    },
  });
}
