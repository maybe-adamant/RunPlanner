import { deriveRouteLoadout } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ExecutionPlan, ExecutionStartState } from '@run-planner/engine/execution-plan';
import type { GamePlanSlotSummary } from '@planner/persistence/gameModuleHost';
import { startPointLabel } from '@planner/projections/startPointCopy';

/** Wire keys are untrusted, so only the catalog's own entries are read. */
export function ownEntry<Entry>(
  records: Readonly<Record<string, Entry | undefined>>,
  key: string | null | undefined,
): Entry | undefined {
  return key != null && Object.hasOwn(records, key) ? records[key] : undefined;
}

const ASPECT_PREFIX = 'Aspect of ';

/** An aspect's name without "Aspect of": "Circe", "Melinoë", "The Morrigan". */
export function aspectShortLabel(label: string): string {
  if (!label.startsWith(ASPECT_PREFIX)) return label;
  const name = label.slice(ASPECT_PREFIX.length);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * A loadout's aspect and weapon as the slot table shows it, such as "Circe (Staff)". A plan
 * with a weapon but no aspect starts without one.
 */
export function slotAspectLabel(
  catalog: Catalog,
  weaponKey: string | null,
  aspectKey: string | null,
): string {
  const weapon =
    weaponKey === null
      ? undefined
      : (ownEntry(catalog.weapons.byKey, weaponKey)?.shortLabel ?? weaponKey);
  const aspectLabel = ownEntry(catalog.aspects.byKey, aspectKey)?.label;
  const aspect =
    aspectLabel !== undefined
      ? aspectShortLabel(aspectLabel)
      : (aspectKey ?? (weaponKey === null ? 'Unknown' : 'None'));
  return weapon === undefined ? aspect : `${aspect} (${weapon})`;
}

function sharedAspectName(catalog: Catalog, shortName: string): boolean {
  return (
    catalog.aspects.values.filter((entry) => aspectShortLabel(entry.label) === shortName).length > 1
  );
}

/**
 * A plan's name in the in-game slot picker, such as "Circe - Surface". It names the weapon too
 * when several aspects share the short name, and only the weapon without an aspect.
 */
export function slotPickerLabel(
  catalog: Catalog,
  weaponKey: string | null,
  aspectKey: string | null,
  routeKey: string,
): string {
  const aspectLabel = ownEntry(catalog.aspects.byKey, aspectKey)?.label;
  const route = ownEntry(catalog.routes.byKey, routeKey)?.label ?? routeKey;
  const shortName =
    aspectLabel === undefined
      ? weaponKey === null
        ? 'Unknown'
        : (ownEntry(catalog.weapons.byKey, weaponKey)?.shortLabel ?? weaponKey)
      : sharedAspectName(catalog, aspectShortLabel(aspectLabel))
        ? slotAspectLabel(catalog, weaponKey, aspectKey)
        : aspectShortLabel(aspectLabel);
  return `${shortName} - ${route}`;
}

/** The compiled plan fields a slot summary reads. */
export type GameSlotSummaryPlan = Pick<
  ExecutionPlan,
  'displayName' | 'routeKey' | 'startingLoadout' | 'startingKeepsake' | 'extent'
> & { readonly startState?: Pick<ExecutionStartState, 'biomeKey' | 'point'> };

/**
 * The display summary the slot overview records for a plan sent at `sentAt`. Its Fear is the
 * configured total the Oath shows, before any vow Circe later disables.
 */
export function projectGameSlotSummary(
  plan: GameSlotSummaryPlan,
  catalog: Catalog,
  sentAt: Date,
): GamePlanSlotSummary {
  const { weaponKey, aspectKey = null, fear } = plan.startingLoadout;
  const route = ownEntry(catalog.routes.byKey, plan.routeKey)?.label ?? plan.routeKey;
  const terminal = plan.extent.terminalBiomeKey;
  const keepsakeKey = plan.startingKeepsake.keepsakeKey;
  const start = plan.startState;
  const aspect = slotAspectLabel(catalog, weaponKey, aspectKey);
  return {
    label: slotPickerLabel(catalog, weaponKey, aspectKey, plan.routeKey),
    ...(plan.displayName === undefined ? {} : { planName: plan.displayName }),
    sentAt: sentAt.toISOString(),
    aspect,
    route,
    endBiome: ownEntry(catalog.biomes.byKey, terminal)?.label ?? terminal,
    ...(keepsakeKey === undefined
      ? {}
      : {
          startingKeepsake: ownEntry(catalog.keepsakes.byKey, keepsakeKey)?.label ?? keepsakeKey,
        }),
    startingFear: deriveRouteLoadout(catalog, {
      manualArcanaKeys: [],
      fearRanks: fear.configuredRanks,
    }).fearTotal,
    ...(start === undefined
      ? {}
      : {
          practiceStart: startPointLabel(catalog, { biomeKey: start.biomeKey, point: start.point }),
        }),
  };
}
