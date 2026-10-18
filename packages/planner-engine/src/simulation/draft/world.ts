import type { Catalog, EncounterDefinition } from '../../catalog-schema';
import { ORDINARY_SOURCE_CAP } from '../../reward-kernel';
import type { DraftLoadout, DraftWorld } from './spec';

export interface DraftNpcOption {
  readonly npcKey: string;
  /** Present when meeting this NPC offers its traits. */
  readonly giverKey?: string;
}

export interface DraftBiomeWorldOptions {
  readonly biomeKey: string;
  readonly storyNpc?: DraftNpcOption;
  readonly fieldNpcs: readonly DraftNpcOption[];
}

export interface DraftWorldOptions {
  readonly maxGods: number;
  readonly godKeys: readonly string[];
  readonly biomes: readonly DraftBiomeWorldOptions[];
}

/** Story and field NPCs each itinerary biome's rooms can host, read from their encounter slots. */
export function draftWorldOptions(catalog: Catalog, loadout: DraftLoadout): DraftWorldOptions {
  return Object.freeze({
    maxGods: ORDINARY_SOURCE_CAP,
    godKeys: Object.freeze(
      catalog.traitGivers.values.filter((g) => g.providerKind === 'olympian').map((g) => g.key),
    ),
    biomes: Object.freeze(
      loadout.itineraryBiomeKeys.map((biomeKey) => biomeWorldOptions(catalog, biomeKey)),
    ),
  });
}

function biomeWorldOptions(catalog: Catalog, biomeKey: string): DraftBiomeWorldOptions {
  let storyNpc: DraftNpcOption | undefined;
  const fieldNpcs = new Map<string, DraftNpcOption>();
  for (const room of catalog.rooms.values) {
    if (room.roomSetKey !== biomeKey) continue;
    for (const definition of roomEncounterDefinitions(catalog, room.encounterSlotBindings)) {
      if (room.kind === 'Story' && definition.kind === 'story')
        storyNpc ??= npcOption(definition.traitOfferProducer!.giverKey, definition);
      else if (
        definition.kind === 'combat' &&
        definition.npcPresentationKey !== undefined &&
        catalog.fieldNpcEncounterKeys.includes(definition.key)
      )
        fieldNpcs.set(
          definition.npcPresentationKey,
          npcOption(definition.npcPresentationKey, definition),
        );
    }
  }
  return Object.freeze({
    biomeKey,
    ...(storyNpc === undefined ? {} : { storyNpc }),
    fieldNpcs: Object.freeze([...fieldNpcs.values()]),
  });
}

function roomEncounterDefinitions(
  catalog: Catalog,
  bindings: Catalog['rooms']['values'][number]['encounterSlotBindings'],
): readonly EncounterDefinition[] {
  return bindings.flatMap((binding) =>
    (binding.kind === 'fixed'
      ? [binding.encounterDefinitionKey]
      : catalog.encounterSets.byKey[binding.encounterSetKey]!.encounterDefinitionKeys
    ).map((key) => catalog.encounterDefinitions.byKey[key]!),
  );
}

function npcOption(npcKey: string, definition: EncounterDefinition): DraftNpcOption {
  const giverKey = definition.traitOfferProducer?.giverKey;
  return Object.freeze({ npcKey, ...(giverKey === undefined ? {} : { giverKey }) });
}

/** Givers every world has: Hermes, Daedalus Hammers and Selene; Chaos is never drafted. */
const ALWAYS_PRESENT_PROVIDER_KINDS: ReadonlySet<string> = new Set(['hermes', 'hammer', 'spell']);

/** Trait givers the world contributes: its gods, its trait-giving NPCs and the always-present givers. */
export function draftWorldGiverKeys(
  catalog: Catalog,
  loadout: DraftLoadout,
  world: DraftWorld,
): readonly string[] {
  const options = draftWorldOptions(catalog, loadout);
  const givers = new Set(world.godKeys);
  for (const biome of options.biomes) {
    const story = biome.storyNpc;
    if (story?.giverKey !== undefined && world.storyNpcByBiome[biome.biomeKey] === story.npcKey)
      givers.add(story.giverKey);
    const selected = world.fieldNpcsByBiome[biome.biomeKey] ?? [];
    for (const field of biome.fieldNpcs)
      if (field.giverKey !== undefined && selected.includes(field.npcKey))
        givers.add(field.giverKey);
  }
  for (const giver of catalog.traitGivers.values)
    if (ALWAYS_PRESENT_PROVIDER_KINDS.has(giver.providerKind)) givers.add(giver.key);
  return Object.freeze([...givers]);
}
