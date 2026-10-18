import type { Catalog, EncounterDefinition } from '../../catalog-schema';
import type { RequirementExpression } from '../../requirements/model';
import { ORDINARY_SOURCE_CAP } from '../../reward-kernel';
import type { DraftRoute, DraftWorld } from './spec';

export interface DraftNpcOption {
  readonly npcKey: string;
  /** Present when meeting this NPC offers its traits. */
  readonly giverKey?: string;
}

export interface DraftFieldNpcOption extends DraftNpcOption {
  /** The NPC's field encounters this biome's rooms can host. */
  readonly encounterKeys: readonly string[];
}

export interface DraftBiomeWorldOptions {
  readonly biomeKey: string;
  readonly storyNpc?: DraftNpcOption;
  readonly fieldNpcs: readonly DraftFieldNpcOption[];
}

export interface DraftWorldOptions {
  readonly maxGods: number;
  readonly godKeys: readonly string[];
  /** Hermes, Daedalus Hammer and Selene givers, present in every world. */
  readonly bonusGiverKeys: readonly string[];
  readonly biomes: readonly DraftBiomeWorldOptions[];
}

/** Story and field NPCs each itinerary biome's rooms can host, read from their encounter slots. */
export function draftWorldOptions(catalog: Catalog, route: DraftRoute): DraftWorldOptions {
  return Object.freeze({
    maxGods: ORDINARY_SOURCE_CAP,
    godKeys: Object.freeze(
      catalog.traitGivers.values.filter((g) => g.providerKind === 'olympian').map((g) => g.key),
    ),
    bonusGiverKeys: Object.freeze(
      catalog.traitGivers.values
        .filter((g) => ALWAYS_PRESENT_PROVIDER_KINDS.has(g.providerKind))
        .map((g) => g.key),
    ),
    biomes: Object.freeze(
      route.itineraryBiomeKeys.map((biomeKey) => biomeWorldOptions(catalog, biomeKey)),
    ),
  });
}

function biomeWorldOptions(catalog: Catalog, biomeKey: string): DraftBiomeWorldOptions {
  let storyNpc: DraftNpcOption | undefined;
  for (const room of catalog.rooms.values) {
    if (room.roomSetKey !== biomeKey || room.kind !== 'Story') continue;
    for (const definition of roomEncounterDefinitions(catalog, room.encounterSlotBindings))
      if (definition.kind === 'story')
        storyNpc ??= npcOption(definition.traitOfferProducer!.giverKey, definition);
  }
  return Object.freeze({
    biomeKey,
    ...(storyNpc === undefined ? {} : { storyNpc }),
    fieldNpcs: Object.freeze(
      [...biomeFieldNpcEncounters(catalog, biomeKey)].map(([npcKey, definitions]) =>
        Object.freeze({
          ...npcOption(npcKey, definitions[0]!),
          encounterKeys: Object.freeze(definitions.map((definition) => definition.key)),
        }),
      ),
    ),
  });
}

/** Each field NPC's encounters the biome's rooms can host. */
function biomeFieldNpcEncounters(
  catalog: Catalog,
  biomeKey: string,
): ReadonlyMap<string, readonly EncounterDefinition[]> {
  const byNpc = new Map<string, EncounterDefinition[]>();
  for (const room of catalog.rooms.values) {
    if (room.roomSetKey !== biomeKey) continue;
    for (const definition of roomEncounterDefinitions(catalog, room.encounterSlotBindings)) {
      const npcKey = definition.npcPresentationKey;
      if (
        definition.kind !== 'combat' ||
        npcKey === undefined ||
        !catalog.fieldNpcEncounterKeys.includes(definition.key)
      )
        continue;
      const definitions = byNpc.get(npcKey) ?? byNpc.set(npcKey, []).get(npcKey)!;
      if (!definitions.includes(definition)) definitions.push(definition);
    }
  }
  return byNpc;
}

/** Encounter keys whose earlier record on the route bars this encounter. */
function routeExclusiveEncounterKeys(definition: EncounterDefinition): ReadonlySet<string> {
  const keys = new Set<string>();
  const visit = (requirement: RequirementExpression): void => {
    if (requirement.kind === 'all') requirement.requirements.forEach(visit);
    else if (
      requirement.kind === 'encounterKeyCount' &&
      requirement.scope === 'route' &&
      requirement.range.max === 0
    )
      requirement.encounterKeys.forEach((key) => keys.add(key));
  };
  if (definition.requirements !== undefined) visit(definition.requirements);
  return keys;
}

/**
 * Field NPCs the world selects in more than one biome although meeting them
 * in one biome bars their encounters in every other selected biome.
 */
export function draftRepeatedFieldNpcs(
  catalog: Catalog,
  options: DraftWorldOptions,
  world: DraftWorld,
): readonly { readonly npcKey: string; readonly biomeKeys: readonly string[] }[] {
  const selections = new Map<string, string[]>();
  for (const { biomeKey } of options.biomes)
    for (const npcKey of world.fieldNpcsByBiome[biomeKey] ?? [])
      (selections.get(npcKey) ?? selections.set(npcKey, []).get(npcKey)!).push(biomeKey);
  const repeated: { readonly npcKey: string; readonly biomeKeys: readonly string[] }[] = [];
  for (const [npcKey, biomeKeys] of selections) {
    if (biomeKeys.length < 2) continue;
    const all = biomeKeys.flatMap((biomeKey) =>
      (
        options.biomes
          .find((biome) => biome.biomeKey === biomeKey)
          ?.fieldNpcs.find((npc) => npc.npcKey === npcKey)?.encounterKeys ?? []
      ).map((key) => catalog.encounterDefinitions.byKey[key]!),
    );
    const exclusive =
      all.length > 0 &&
      all.every((definition) => {
        const barred = routeExclusiveEncounterKeys(definition);
        return all.every((other) => barred.has(other.key));
      });
    if (exclusive) repeated.push(Object.freeze({ npcKey, biomeKeys: Object.freeze(biomeKeys) }));
  }
  return Object.freeze(repeated);
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

export interface DraftNpcGiver {
  readonly giverKey: string;
  /** The itinerary index of the biome the NPC is selected in. */
  readonly biomeIndex: number;
  readonly story: boolean;
}

/** The selected trait-giving story and field NPCs, in itinerary order. */
export function draftNpcGivers(
  catalog: Catalog,
  route: DraftRoute,
  world: DraftWorld,
): readonly DraftNpcGiver[] {
  return draftWorldOptions(catalog, route).biomes.flatMap((biome, biomeIndex) => {
    const story = biome.storyNpc;
    const selected = world.fieldNpcsByBiome[biome.biomeKey] ?? [];
    return [
      ...(story !== undefined && world.storyNpcByBiome[biome.biomeKey] === story.npcKey
        ? [{ npc: story, story: true }]
        : []),
      ...biome.fieldNpcs
        .filter((npc) => selected.includes(npc.npcKey))
        .map((npc) => ({ npc, story: false })),
    ].flatMap(({ npc, story: isStory }) =>
      npc.giverKey === undefined
        ? []
        : [Object.freeze({ giverKey: npc.giverKey, biomeIndex, story: isStory })],
    );
  });
}

/** Each basket trait a selected NPC gives, by the earliest biome index that NPC is met in. */
export function draftNpcTraitBiomes(
  catalog: Catalog,
  givers: readonly DraftNpcGiver[],
  traitKeys: readonly string[],
): ReadonlyMap<string, number> {
  const biomes = new Map<string, number>();
  for (const giver of givers)
    for (const traitKey of catalog.traitGivers.byKey[giver.giverKey]?.traitKeys ?? [])
      if (traitKeys.includes(traitKey) && !biomes.has(traitKey))
        biomes.set(traitKey, giver.biomeIndex);
  return biomes;
}

/** Givers every world has: Hermes, Daedalus Hammers and Selene; Chaos is never drafted. */
const ALWAYS_PRESENT_PROVIDER_KINDS: ReadonlySet<string> = new Set(['hermes', 'hammer', 'spell']);

/** Trait givers the world contributes: its gods, its trait-giving NPCs and the always-present givers. */
export function draftWorldGiverKeys(
  catalog: Catalog,
  route: DraftRoute,
  world: DraftWorld,
): readonly string[] {
  const options = draftWorldOptions(catalog, route);
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
  for (const key of options.bonusGiverKeys) givers.add(key);
  return Object.freeze([...givers]);
}
