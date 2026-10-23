import type { Catalog } from '@run-planner/engine/catalog-schema';

/** A named set of manual Arcana cards, kept by the planner and never in a plan. */
export interface ArcanaPreset {
  readonly id: string;
  readonly name: string;
  readonly cardKeys: readonly string[];
}

/** A named set of Vow ranks; Vows it leaves out are at rank 0. */
export interface VowPreset {
  readonly id: string;
  readonly name: string;
  readonly ranks: Readonly<Record<string, number>>;
}

export interface LoadoutPresets {
  readonly arcana: readonly ArcanaPreset[];
  readonly vows: readonly VowPreset[];
}

export type LoadoutPresetKind = 'arcana' | 'vows';

export interface LoadoutPresetsSnapshot extends LoadoutPresets {
  /** How many saved cards, Vows or presets this planner did not know and dropped when read. */
  readonly dropped: number;
}

export interface LoadoutPresetController {
  getSnapshot(): LoadoutPresetsSnapshot;
  subscribe(listener: () => void): () => void;
  saveArcana(preset: Omit<ArcanaPreset, 'id'> & { readonly id?: string }): void;
  saveVows(preset: Omit<VowPreset, 'id'> & { readonly id?: string }): void;
  rename(kind: LoadoutPresetKind, id: string, name: string): void;
  remove(kind: LoadoutPresetKind, id: string): void;
  /** Puts a removed preset back at `index`, where it was. */
  restore(
    deleted:
      | { readonly kind: 'arcana'; readonly preset: ArcanaPreset }
      | { readonly kind: 'vows'; readonly preset: VowPreset },
    index: number,
  ): void;
}

const STORAGE_KEY = 'run-planner.loadout-presets';
const FORMAT_VERSION = 1;
export const PRESET_NAME_MAX = 60;

/** A preset's name as kept: trimmed and bounded; empty names are refused by the caller. */
export function presetName(name: string): string {
  return Array.from(name.trim()).slice(0, PRESET_NAME_MAX).join('');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the stored presets against the catalog: cards that are not manual Arcana, unknown
 * Vows and out-of-range ranks are dropped and counted, as is a preset that is not readable.
 */
export function decodeLoadoutPresets(
  catalog: Catalog,
  json: string | null,
): LoadoutPresetsSnapshot {
  if (json === null) return { arcana: [], vows: [], dropped: 0 };
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { arcana: [], vows: [], dropped: 1 };
  }
  if (!isRecord(value) || value.version !== FORMAT_VERSION)
    return { arcana: [], vows: [], dropped: 1 };
  let dropped = 0;
  const named = (entry: unknown): entry is Record<string, unknown> & { id: string; name: string } =>
    isRecord(entry) &&
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    presetName(entry.name) !== '';
  const arcana = (Array.isArray(value.arcana) ? value.arcana : []).flatMap(
    (entry): ArcanaPreset[] => {
      if (!named(entry) || !Array.isArray(entry.cardKeys)) {
        dropped += 1;
        return [];
      }
      const cardKeys = entry.cardKeys.filter(
        (key): key is string =>
          typeof key === 'string' && catalog.arcanaCards.byKey[key]?.activation.kind === 'manual',
      );
      dropped += entry.cardKeys.length - cardKeys.length;
      return [{ id: entry.id, name: presetName(entry.name), cardKeys: [...new Set(cardKeys)] }];
    },
  );
  const vows = (Array.isArray(value.vows) ? value.vows : []).flatMap((entry): VowPreset[] => {
    if (!named(entry) || !isRecord(entry.ranks)) {
      dropped += 1;
      return [];
    }
    const ranks: Record<string, number> = {};
    for (const [key, rank] of Object.entries(entry.ranks)) {
      const vow = catalog.fearVows.byKey[key];
      if (
        vow === undefined ||
        typeof rank !== 'number' ||
        !Number.isInteger(rank) ||
        rank < 0 ||
        rank > vow.incrementalFear.length
      ) {
        dropped += 1;
        continue;
      }
      if (rank > 0) ranks[key] = rank;
    }
    return [{ id: entry.id, name: presetName(entry.name), ranks }];
  });
  return { arcana, vows, dropped };
}

export function encodeLoadoutPresets(presets: LoadoutPresets): string {
  return JSON.stringify({ version: FORMAT_VERSION, arcana: presets.arcana, vows: presets.vows });
}

/**
 * The planner's Arcana and Vow presets, kept beside the app scale in device-local storage; a
 * storage failure keeps them for this session.
 */
export function createBrowserLoadoutPresets(
  catalog: Catalog,
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
  mintId: () => string = () => globalThis.crypto.randomUUID(),
): LoadoutPresetController {
  let stored: string | null = null;
  try {
    stored = storage().getItem(STORAGE_KEY);
  } catch {
    // Restricted storage starts with no presets.
  }
  let snapshot = decodeLoadoutPresets(catalog, stored);
  const listeners = new Set<() => void>();
  const update = (next: LoadoutPresets) => {
    snapshot = Object.freeze({ arcana: next.arcana, vows: next.vows, dropped: snapshot.dropped });
    try {
      storage().setItem(STORAGE_KEY, encodeLoadoutPresets(next));
    } catch {
      // The change stays for this session.
    }
    for (const listener of listeners) listener();
  };
  const upsert = <Preset extends { readonly id: string }>(
    list: readonly Preset[],
    preset: Preset,
  ): readonly Preset[] =>
    list.some((entry) => entry.id === preset.id)
      ? list.map((entry) => (entry.id === preset.id ? preset : entry))
      : [...list, preset];
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    saveArcana(preset) {
      update({
        ...snapshot,
        arcana: upsert(snapshot.arcana, {
          id: preset.id ?? mintId(),
          name: presetName(preset.name),
          cardKeys: preset.cardKeys,
        }),
      });
    },
    saveVows(preset) {
      update({
        ...snapshot,
        vows: upsert(snapshot.vows, {
          id: preset.id ?? mintId(),
          name: presetName(preset.name),
          ranks: Object.fromEntries(Object.entries(preset.ranks).filter(([, rank]) => rank > 0)),
        }),
      });
    },
    rename(kind, id, name) {
      const renamed = <Preset extends { readonly id: string; readonly name: string }>(
        list: readonly Preset[],
      ) => list.map((entry) => (entry.id === id ? { ...entry, name: presetName(name) } : entry));
      update(
        kind === 'arcana'
          ? { ...snapshot, arcana: renamed(snapshot.arcana) }
          : { ...snapshot, vows: renamed(snapshot.vows) },
      );
    },
    restore(deleted, index) {
      const at = <Preset>(list: readonly Preset[], preset: Preset): readonly Preset[] => [
        ...list.slice(0, index),
        preset,
        ...list.slice(index),
      ];
      update(
        deleted.kind === 'arcana'
          ? { ...snapshot, arcana: at(snapshot.arcana, deleted.preset) }
          : { ...snapshot, vows: at(snapshot.vows, deleted.preset) },
      );
    },
    remove(kind, id) {
      update(
        kind === 'arcana'
          ? { ...snapshot, arcana: snapshot.arcana.filter((entry) => entry.id !== id) }
          : { ...snapshot, vows: snapshot.vows.filter((entry) => entry.id !== id) },
      );
    },
  };
}
