import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../../authored-project/model';
import { ProjectDocumentContractError } from '../../authored-project/validation';
import { assessDraftBasket, type DraftTraitRefusal } from './basket';
import { draftKeepsakeOptions, draftLoadoutProject, forcesGod, type DraftSpec } from './spec';
import { draftRepeatedFieldNpcs, draftWorldOptions } from './world';

export type DraftRefusal =
  | { readonly kind: 'freshFileRoute' }
  /** The project codec rejects the loadout. */
  | { readonly kind: 'invalidLoadout'; readonly path: string; readonly detail: string }
  | { readonly kind: 'godStartingKeepsake'; readonly keepsakeKey: string }
  | { readonly kind: 'rackSlotCount'; readonly slotCount: number }
  | {
      readonly kind: 'rackKeepsake';
      readonly index: number;
      readonly keepsakeKey: string;
      readonly reason: 'forcesGod' | 'unknown';
    }
  | { readonly kind: 'tooManyGods'; readonly maxGods: number }
  | { readonly kind: 'notAGod'; readonly godKey: string }
  | { readonly kind: 'storyNpc'; readonly biomeKey: string; readonly npcKey: string }
  | { readonly kind: 'fieldNpc'; readonly biomeKey: string; readonly npcKey: string }
  /** A once-per-run field NPC selected in several biomes. */
  | {
      readonly kind: 'repeatedFieldNpc';
      readonly npcKey: string;
      readonly biomeKeys: readonly string[];
    }
  | { readonly kind: 'unknownTrait'; readonly traitKey: string }
  | {
      readonly kind: 'basketTrait';
      readonly traitKey: string;
      readonly refusals: readonly DraftTraitRefusal[];
    };

/** Reasons the base project cannot be drafted with this spec, from the engine's static rules. */
export function draftRefusals(
  catalog: Catalog,
  base: ProjectDocument,
  spec: DraftSpec,
): readonly DraftRefusal[] {
  const refusals: DraftRefusal[] = [];
  const { loadout, world } = spec;
  let loadoutValid = true;
  if (catalog.routes.byKey[base.route.routeKey]?.initialProfile.kind === 'freshFile') {
    refusals.push({ kind: 'freshFileRoute' });
    loadoutValid = false;
  } else
    try {
      draftLoadoutProject(catalog, base, loadout);
    } catch (error) {
      if (!(error instanceof ProjectDocumentContractError)) throw error;
      refusals.push({ kind: 'invalidLoadout', path: error.path, detail: error.detail });
      loadoutValid = false;
    }
  if (forcesGod(catalog, loadout.startingKeepsakeKey))
    refusals.push({ kind: 'godStartingKeepsake', keepsakeKey: loadout.startingKeepsakeKey });

  const slotCount = draftKeepsakeOptions(catalog, base.route).rackSlots.length;
  if (spec.rackKeepsakeKeys.length !== slotCount)
    refusals.push({ kind: 'rackSlotCount', slotCount });
  spec.rackKeepsakeKeys.forEach((keepsakeKey, index) => {
    if (keepsakeKey === null) return;
    if (catalog.keepsakes.byKey[keepsakeKey] === undefined)
      refusals.push({ kind: 'rackKeepsake', index, keepsakeKey, reason: 'unknown' });
    else if (forcesGod(catalog, keepsakeKey))
      refusals.push({ kind: 'rackKeepsake', index, keepsakeKey, reason: 'forcesGod' });
  });

  const options = draftWorldOptions(catalog, base.route);
  let worldValid = true;
  const refuse = (refusal: DraftRefusal) => {
    refusals.push(refusal);
    worldValid = false;
  };
  if (world.godKeys.length > options.maxGods)
    refuse({ kind: 'tooManyGods', maxGods: options.maxGods });
  for (const godKey of world.godKeys)
    if (!options.godKeys.includes(godKey)) refuse({ kind: 'notAGod', godKey });
  for (const [biomeKey, npcKey] of Object.entries(world.storyNpcByBiome))
    if (options.biomes.find((biome) => biome.biomeKey === biomeKey)?.storyNpc?.npcKey !== npcKey)
      refuse({ kind: 'storyNpc', biomeKey, npcKey });
  for (const [biomeKey, npcKeys] of Object.entries(world.fieldNpcsByBiome)) {
    const hosted = options.biomes.find((biome) => biome.biomeKey === biomeKey)?.fieldNpcs ?? [];
    for (const npcKey of npcKeys)
      if (!hosted.some((npc) => npc.npcKey === npcKey))
        refuse({ kind: 'fieldNpc', biomeKey, npcKey });
  }
  for (const repeated of draftRepeatedFieldNpcs(catalog, options, world))
    refuse({ kind: 'repeatedFieldNpc', ...repeated });

  const unknown = spec.basketTraitKeys.filter((key) => catalog.traits.byKey[key] === undefined);
  for (const traitKey of unknown) refusals.push({ kind: 'unknownTrait', traitKey });
  if (loadoutValid && worldValid && unknown.length === 0)
    for (const trait of assessDraftBasket(catalog, base.route, spec).traits)
      if (trait.inBasket && !trait.selectable)
        refusals.push({ kind: 'basketTrait', traitKey: trait.traitKey, refusals: trait.refusals });
  return Object.freeze(refusals);
}
