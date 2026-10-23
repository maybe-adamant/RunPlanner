import {
  assessStartingArcanaGrasp,
  deriveRouteLoadout,
  planFearRanksReplacement,
  planManualArcanaReplacement,
  routeLoadoutEditDomain,
  type DerivedRouteLoadout,
  type LoadoutReplacement,
  type ProjectCommand,
  type RouteLoadout,
  type RouteLoadoutEditDomain,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { ArcanaPreset, VowPreset } from '@planner/persistence/loadoutPresets';

type ArcanaFearLoadout = Pick<RouteLoadout, 'manualArcanaKeys' | 'fearRanks'>;

/** Every Vow at its preset rank, the ones a preset leaves out at 0. */
export function presetFearRanks(
  catalog: Catalog,
  ranks: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  return Object.fromEntries(catalog.fearVows.values.map((vow) => [vow.key, ranks[vow.key] ?? 0]));
}

/** A preset being edited in Settings: a loadout of its own, edited as a plan's would be. */
export interface PresetLoadoutEditor {
  readonly loadout: ArcanaFearLoadout;
  readonly domain: RouteLoadoutEditDomain;
  readonly derived: DerivedRouteLoadout;
}

/** An Arcana preset is edited with no Vows; a Vow preset with no Arcana. */
export function projectPresetLoadoutEditor(
  catalog: Catalog,
  loadout: ArcanaFearLoadout,
): PresetLoadoutEditor {
  return Object.freeze({
    loadout,
    domain: routeLoadoutEditDomain(catalog, loadout),
    derived: deriveRouteLoadout(catalog, loadout),
  });
}

/** A new preset's name: "Arcana preset", then "Arcana preset 2" and on while one is taken. */
export function nextPresetName(
  kind: 'arcana' | 'vows',
  presets: readonly { readonly name: string }[],
): string {
  const base = kind === 'arcana' ? 'Arcana preset' : 'Vow preset';
  const taken = new Set(presets.map((preset) => preset.name));
  if (!taken.has(base)) return base;
  let number = 2;
  while (taken.has(`${base} ${number}`)) number += 1;
  return `${base} ${number}`;
}

/** A Settings row's summary, such as "5 cards · 18 Grasp" or "Fear 22 · 6 Vows". */
export function describeArcanaPreset(catalog: Catalog, preset: ArcanaPreset): string {
  const grasp = assessStartingArcanaGrasp(catalog, preset.cardKeys, presetFearRanks(catalog, {}));
  const cards = preset.cardKeys.length;
  return `${cards} ${cards === 1 ? 'card' : 'cards'} · ${grasp.cost} Grasp`;
}

export function describeVowPreset(catalog: Catalog, preset: VowPreset): string {
  const derived = deriveRouteLoadout(catalog, {
    manualArcanaKeys: [],
    fearRanks: presetFearRanks(catalog, preset.ranks),
  });
  const vows = Object.keys(preset.ranks).length;
  return `Fear ${derived.fearTotal} · ${vows} ${vows === 1 ? 'Vow' : 'Vows'}`;
}

/** A preset chip in the editor's Arcana or Fear picker, and what clicking it does. */
export interface PresetChip {
  readonly id: string;
  readonly name: string;
  /** The plan already has exactly this preset. */
  readonly current: boolean;
  readonly outcome:
    | { readonly kind: 'apply'; readonly commands: readonly ProjectCommand[] }
    | { readonly kind: 'unchanged' }
    | { readonly kind: 'refused'; readonly reason: string };
}

function chip(
  preset: { readonly id: string; readonly name: string },
  replacement: LoadoutReplacement,
  refusal: (cost: number, capacity: number) => string,
): PresetChip {
  return Object.freeze({
    id: preset.id,
    name: preset.name,
    current: replacement.kind === 'unchanged',
    outcome:
      replacement.kind === 'refused'
        ? {
            kind: 'refused' as const,
            reason: refusal(replacement.grasp.cost, replacement.grasp.capacity),
          }
        : replacement,
  });
}

export function projectArcanaPresetChips(
  catalog: Catalog,
  routeKey: string,
  loadout: ArcanaFearLoadout,
  presets: readonly ArcanaPreset[],
): readonly PresetChip[] {
  return presets.map((preset) =>
    chip(
      preset,
      planManualArcanaReplacement(catalog, routeKey, loadout, preset.cardKeys),
      (cost, capacity) => `Needs ${cost} Grasp; your Vows allow ${capacity}.`,
    ),
  );
}

export function projectVowPresetChips(
  catalog: Catalog,
  routeKey: string,
  loadout: ArcanaFearLoadout,
  presets: readonly VowPreset[],
): readonly PresetChip[] {
  return presets.map((preset) =>
    chip(
      preset,
      planFearRanksReplacement(catalog, routeKey, loadout, preset.ranks),
      (cost, capacity) => `Your Arcana need ${cost} Grasp; these Vows allow ${capacity}.`,
    ),
  );
}
