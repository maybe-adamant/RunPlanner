import type { Catalog } from '../../catalog-schema';
import { DRAFT_OPTIONS, defaultDraftGodBoons } from '../../authored-project/draft-spec';
import { ORDINARY_SOURCE_CAP } from '../../reward-kernel';
import {
  draftDenialActive,
  draftForfeitActive,
  draftPlannedBiomeKeys,
  type DraftRoute,
  type DraftSpec,
} from './spec';

/** God boons a Clockwork biome yields when its Goal is always taken, nearly all from the Preboss Shop. */
const CLOCKWORK_GOAL_EXPECTED = 3;

/** Whether the biome's doors follow the Clockwork Goal batch policy. */
function clockworkBiome(catalog: Catalog, biomeKey: string): boolean {
  const progression = catalog.biomeLayouts.byKey[biomeKey]?.progression;
  return progression?.kind === 'generated' && progression.batchPolicy.kind === 'clockwork';
}

export interface DraftGodBoonBiome {
  readonly biomeKey: string;
  /** The planned god boons for the biome. */
  readonly value: number;
  /** After Forfeit's one lost boon room. */
  readonly effective: number;
  /** The biome's default planned god boons, the drafter's measured capacity there. */
  readonly defaultValue: number;
  /** What the biome is expected to yield: its default, or less when the walk is told to skip boons there. */
  readonly expected: number;
}

/** The god boon budget of the planned biomes: the total cap, the per-god cap and their guidance. */
export interface DraftGodBoonBudget {
  readonly biomes: readonly DraftGodBoonBiome[];
  readonly total: number;
  /** The god boon cap: each planned biome's effective value, summed. */
  readonly effectiveTotal: number;
  /** Forfeit's vow takes one boon per biome. */
  readonly forfeit: boolean;
  /** Denial's vow lowers the per-god default to four. */
  readonly denial: boolean;
  /** The per-god cap. */
  readonly perGod: number;
  /** The per-god cap's default: one fewer under Denial, which bans the offered rows not taken. */
  readonly perGodDefault: number;
  /** The per-god cap's default without and with Denial. */
  readonly perGodDefaults: { readonly withoutDenial: number; readonly withDenial: number };
  /** A planned biome has a Clockwork Goal the walk can pursue. */
  readonly clockworkGoal: boolean;
  /** The most god boons the per-god cap allows across the god pool. */
  readonly reachable: number;
}

/** The per-god cap's default: one fewer under Denial, which bans the offered rows not taken. */
export function draftDefaultPerGodCap(
  catalog: Catalog,
  loadout: Pick<DraftSpec, 'loadout'>['loadout'],
): number {
  return DRAFT_OPTIONS.perGodCap.default - (draftDenialActive(catalog, loadout) ? 1 : 0);
}

/** The most boons one god may take, Legendary and hosted Duos included. */
export function draftPerGodCap(
  catalog: Catalog,
  spec: Pick<DraftSpec, 'loadout' | 'perGodCap'>,
): number {
  return spec.perGodCap ?? draftDefaultPerGodCap(catalog, spec.loadout);
}

export function draftGodBoonBudget(
  catalog: Catalog,
  route: DraftRoute,
  spec: Pick<DraftSpec, 'loadout' | 'godBoonsByBiome' | 'perGodCap' | 'pursueTartarusGoal'>,
): DraftGodBoonBudget {
  const forfeit = draftForfeitActive(catalog, spec.loadout) ? 1 : 0;
  const biomes = draftPlannedBiomeKeys(route).map((biomeKey) => {
    const defaultValue = defaultDraftGodBoons(route.routeKey, biomeKey);
    const value = spec.godBoonsByBiome?.[biomeKey] ?? defaultValue;
    return Object.freeze({
      biomeKey,
      value,
      effective: Math.max(value - forfeit, 0),
      defaultValue,
      expected:
        spec.pursueTartarusGoal === true && clockworkBiome(catalog, biomeKey)
          ? Math.min(defaultValue, CLOCKWORK_GOAL_EXPECTED)
          : defaultValue,
    });
  });
  const perGod = draftPerGodCap(catalog, spec);
  return Object.freeze({
    biomes: Object.freeze(biomes),
    total: biomes.reduce((sum, biome) => sum + biome.value, 0),
    effectiveTotal: biomes.reduce((sum, biome) => sum + biome.effective, 0),
    forfeit: forfeit === 1,
    denial: draftDenialActive(catalog, spec.loadout),
    perGod,
    perGodDefault: draftDefaultPerGodCap(catalog, spec.loadout),
    perGodDefaults: Object.freeze({
      withoutDenial: DRAFT_OPTIONS.perGodCap.default,
      withDenial: DRAFT_OPTIONS.perGodCap.default - 1,
    }),
    clockworkGoal: biomes.some((biome) => clockworkBiome(catalog, biome.biomeKey)),
    reachable: perGod * ORDINARY_SOURCE_CAP,
  });
}
