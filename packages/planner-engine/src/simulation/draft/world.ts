import type { Catalog, EncounterDefinition } from '../../catalog-schema';
import type { RequirementExpression } from '../../requirements/model';
import { locallyValidRewardOffers, ORDINARY_SOURCE_CAP } from '../../reward-kernel';
import {
  routeRoomDeclaration,
  routeSaveFileGodHistory,
} from '../../authored-project/route-profile';
import { traitGiverForAcquisitionRole } from '../../authored-project/traits/state';
import {
  draftKeepsakeOptions,
  draftPlannedBiomeKeys,
  type DraftRoute,
  type DraftSpec,
  type DraftWorld,
} from './spec';

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
  /** Olympians whose boons the route can offer. */
  readonly godKeys: readonly string[];
  /** Gods every pool must lead with, in order: the route's forced first-run god. */
  readonly requiredGodKeys: readonly string[];
  /** Hermes, Daedalus Hammer and Selene givers some reward source on the route can offer. */
  readonly bonusGiverKeys: readonly string[];
  readonly biomes: readonly DraftBiomeWorldOptions[];
}

/**
 * Whether a requirement fails in every state of this route: a route-key leaf decides it, and
 * an `all` with one such failing child or an `any` with every child failing.
 */
export function draftRouteBarred(
  requirement: RequirementExpression | undefined,
  routeKey: string,
): boolean {
  if (requirement === undefined) return false;
  switch (requirement.kind) {
    case 'routeKeyEquals':
      return requirement.routeKey !== routeKey;
    case 'not':
      return (
        requirement.requirement.kind === 'routeKeyEquals' &&
        requirement.requirement.routeKey === routeKey
      );
    case 'all':
      return requirement.requirements.some((child) => draftRouteBarred(child, routeKey));
    case 'any':
      return requirement.requirements.every((child) => draftRouteBarred(child, routeKey));
    default:
      return false;
  }
}

/** Story and field NPCs each itinerary biome's rooms can host, read from their encounter slots. */
export function draftWorldOptions(catalog: Catalog, route: DraftRoute): DraftWorldOptions {
  const routeKey = route.routeKey;
  const godKeys = catalog.traitGivers.values
    .filter((g) => g.providerKind === 'olympian' && !godRouteBarred(catalog, g.key, routeKey))
    .map((g) => g.key);
  const offered = routeOfferedGiverKeys(catalog, routeKey);
  return Object.freeze({
    maxGods: ORDINARY_SOURCE_CAP,
    godKeys: Object.freeze(godKeys),
    requiredGodKeys: Object.freeze(
      draftFirstRunOfferGiverKeys(catalog, routeKey).filter((key) => godKeys.includes(key)),
    ),
    bonusGiverKeys: Object.freeze(
      catalog.traitGivers.values
        .filter((g) => ALWAYS_PRESENT_PROVIDER_KINDS.has(g.providerKind) && offered.has(g.key))
        .map((g) => g.key),
    ),
    biomes: Object.freeze(
      route.itineraryBiomeKeys.map((biomeKey) => biomeWorldOptions(catalog, biomeKey, routeKey)),
    ),
  });
}

/** Why a pool god cannot be added now. */
export type DraftGodRefusal =
  | { readonly kind: 'poolFull'; readonly maxGods: number }
  /** The route forces this god's boon first, so it joins the pool before any other. */
  | { readonly kind: 'requiredFirst'; readonly godKey: string }
  /** The route offers this god only once the run has used one of these, none in the pool. */
  | { readonly kind: 'needsGod'; readonly needsGodKeys: readonly string[] };

export interface DraftGodAssessment {
  readonly godKey: string;
  readonly selected: boolean;
  /** A selected god can always be removed; its dependants then carry the pool's refusals. */
  readonly selectable: boolean;
  readonly refusals: readonly DraftGodRefusal[];
}

/** Each route god's selectability against the current pool, in world option order. */
export function assessDraftGods(
  catalog: Catalog,
  route: DraftRoute,
  godKeys: readonly string[],
): readonly DraftGodAssessment[] {
  const options = draftWorldOptions(catalog, route);
  const missingRequired = options.requiredGodKeys.find((key) => !godKeys.includes(key));
  return Object.freeze(
    options.godKeys.map((godKey) => {
      const selected = godKeys.includes(godKey);
      const refusals: DraftGodRefusal[] = [];
      if (!selected) {
        if (godKeys.length >= options.maxGods)
          refusals.push({ kind: 'poolFull', maxGods: options.maxGods });
        if (missingRequired !== undefined && missingRequired !== godKey)
          refusals.push({ kind: 'requiredFirst', godKey: missingRequired });
        const unreachable = draftUnreachableGods(catalog, route.routeKey, [
          ...godKeys,
          godKey,
        ]).find((entry) => entry.godKey === godKey);
        if (unreachable !== undefined)
          refusals.push({ kind: 'needsGod', needsGodKeys: unreachable.needsGodKeys });
      }
      return Object.freeze({
        godKey,
        selected,
        selectable: refusals.length === 0,
        refusals: Object.freeze(refusals),
      });
    }),
  );
}

/** A god whose acquisition's loot requirement fails on every state of the route. */
function godRouteBarred(catalog: Catalog, giverKey: string, routeKey: string): boolean {
  return Object.entries(catalog.traitGiverByAcquisitionGameName).some(
    ([source, key]) =>
      key === giverKey &&
      draftRouteBarred(catalog.rewards.acquisitions.byKey[source]?.lootRequirement, routeKey),
  );
}

/**
 * Pool gods the route can never offer with this pool: a loot requirement on lifetime god use
 * that a closed save history leaves to this run, met by none of the pool's gods.
 */
export function draftUnreachableGods(
  catalog: Catalog,
  routeKey: string,
  godKeys: readonly string[],
): readonly { readonly godKey: string; readonly needsGodKeys: readonly string[] }[] {
  if (routeSaveFileGodHistory(catalog, routeKey) !== 'closed') return [];
  const sourceGod = (source: string) => catalog.traitGiverByAcquisitionGameName[source];
  const unreachable: { readonly godKey: string; readonly needsGodKeys: readonly string[] }[] = [];
  for (const [source, godKey] of Object.entries(catalog.traitGiverByAcquisitionGameName)) {
    if (!godKeys.includes(godKey)) continue;
    for (const needed of lifetimeGodUseNeeds(
      catalog.rewards.acquisitions.byKey[source]?.lootRequirement,
    )) {
      const needsGodKeys = needed.flatMap((key) => sourceGod(key) ?? []);
      if (!needsGodKeys.some((key) => godKeys.includes(key)))
        unreachable.push(Object.freeze({ godKey, needsGodKeys: Object.freeze(needsGodKeys) }));
    }
  }
  return Object.freeze(unreachable);
}

/** The route's pool rules: gods it requires first, and gods it offers only after others. */
export interface DraftGodRules {
  readonly requiredGodKeys: readonly string[];
  /** Gods offered only once the run has used one of `needsGodKeys`, grouped by that need. */
  readonly needs: readonly {
    readonly godKeys: readonly string[];
    readonly needsGodKeys: readonly string[];
  }[];
}

export function draftGodRules(catalog: Catalog, route: DraftRoute): DraftGodRules {
  const options = draftWorldOptions(catalog, route);
  const needs: { godKeys: string[]; needsGodKeys: readonly string[] }[] = [];
  if (routeSaveFileGodHistory(catalog, route.routeKey) === 'closed')
    for (const [source, godKey] of Object.entries(catalog.traitGiverByAcquisitionGameName)) {
      if (!options.godKeys.includes(godKey)) continue;
      for (const needed of lifetimeGodUseNeeds(
        catalog.rewards.acquisitions.byKey[source]?.lootRequirement,
      )) {
        const needsGodKeys = needed.flatMap(
          (key) => catalog.traitGiverByAcquisitionGameName[key] ?? [],
        );
        const group = needs.find((entry) => entry.needsGodKeys.join() === needsGodKeys.join());
        if (group === undefined) needs.push({ godKeys: [godKey], needsGodKeys });
        else if (!group.godKeys.includes(godKey)) group.godKeys.push(godKey);
      }
    }
  return Object.freeze({
    requiredGodKeys: options.requiredGodKeys,
    needs: Object.freeze(
      needs.map((entry) =>
        Object.freeze({
          godKeys: Object.freeze(entry.godKeys),
          needsGodKeys: Object.freeze([...entry.needsGodKeys]),
        }),
      ),
    ),
  });
}

/** Each lifetime god use the requirement needs at least one of, read through `all`. */
function lifetimeGodUseNeeds(
  requirement: RequirementExpression | undefined,
): readonly (readonly string[])[] {
  if (requirement === undefined) return [];
  if (requirement.kind === 'all') return requirement.requirements.flatMap(lifetimeGodUseNeeds);
  return requirement.kind === 'recordCount' &&
    requirement.record === 'lifetimeGodUseRecord' &&
    (requirement.range.min ?? 0) >= 1
    ? [requirement.keys]
    : [];
}

/** The givers of the route's first-run forced offers, such as Fresh File's opening Apollo boon. */
export function draftFirstRunOfferGiverKeys(catalog: Catalog, routeKey: string): string[] {
  const keys: string[] = [];
  for (const room of catalog.rooms.values) {
    if (room.firstRunOffer?.routeKey !== routeKey) continue;
    for (const giver of catalog.traitGivers.values)
      if (
        room.firstRunOffer.traitKeys.some((key) => giver.traitKeys.includes(key)) &&
        !keys.includes(giver.key)
      )
        keys.push(giver.key);
  }
  return keys;
}

/** Trait givers a reward-store entry or Shop option not barred on the route resolves to. */
function routeOfferedGiverKeys(catalog: Catalog, routeKey: string): ReadonlySet<string> {
  const rewardTypes = new Set<string>();
  for (const store of catalog.rewards.stores.values)
    for (const entry of store.entries)
      if (
        (entry.routeKeys === undefined || entry.routeKeys.includes(routeKey)) &&
        !draftRouteBarred(entry.requirement, routeKey)
      )
        rewardTypes.add(entry.rewardType);
  for (const shop of catalog.rewards.shops.values)
    for (const group of shop.groups.values)
      for (const option of group.options.values)
        if (!draftRouteBarred(option.requirement, routeKey)) rewardTypes.add(option.rewardType);
  const giverKeys = new Set<string>();
  for (const rewardType of rewardTypes)
    for (const offer of locallyValidRewardOffers(catalog.rewards, rewardType))
      for (const role of catalog.rewards.rewardTypes.byKey[rewardType]?.acquisitionRoles.values ??
        []) {
        const giverKey = traitGiverForAcquisitionRole(catalog, offer, role.key);
        if (giverKey !== undefined) giverKeys.add(giverKey);
      }
  return giverKeys;
}

function biomeWorldOptions(
  catalog: Catalog,
  biomeKey: string,
  routeKey: string,
): DraftBiomeWorldOptions {
  let storyNpc: DraftNpcOption | undefined;
  for (const declared of catalog.rooms.values) {
    const room = routeRoomDeclaration(declared, routeKey);
    if (room.roomSetKey !== biomeKey || room.kind !== 'Story') continue;
    if (draftRouteBarred(room.eligibility, routeKey)) continue;
    for (const definition of roomEncounterDefinitions(catalog, room.encounterSlotBindings))
      if (definition.kind === 'story' && !draftRouteBarred(definition.requirements, routeKey))
        storyNpc ??= npcOption(definition.traitOfferProducer!.giverKey, definition);
  }
  return Object.freeze({
    biomeKey,
    ...(storyNpc === undefined ? {} : { storyNpc }),
    fieldNpcs: Object.freeze(
      [...biomeFieldNpcEncounters(catalog, biomeKey, routeKey)].map(([npcKey, definitions]) =>
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
  routeKey: string,
): ReadonlyMap<string, readonly EncounterDefinition[]> {
  const byNpc = new Map<string, EncounterDefinition[]>();
  for (const declared of catalog.rooms.values) {
    const room = routeRoomDeclaration(declared, routeKey);
    if (room.roomSetKey !== biomeKey) continue;
    for (const definition of roomEncounterDefinitions(catalog, room.encounterSlotBindings)) {
      const npcKey = definition.npcPresentationKey;
      if (
        definition.kind !== 'combat' ||
        npcKey === undefined ||
        !catalog.fieldNpcEncounterKeys.includes(definition.key) ||
        draftRouteBarred(definition.requirements, routeKey)
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

export function roomEncounterDefinitions(
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

/** What a draft's world reads from its spec: the world and the keepsakes it equips. */
export type DraftWorldSpec = Pick<DraftSpec, 'world' | 'rackKeepsakeKeys'> & {
  readonly loadout: Pick<DraftSpec['loadout'], 'startingKeepsakeKey'>;
};

/**
 * The selected trait-giving story and field NPCs of the planned biomes, in itinerary order,
 * then the Gorgon Amulet's Athena.
 */
function npcGivers(
  catalog: Catalog,
  options: DraftWorldOptions,
  spec: DraftWorldSpec,
  route: DraftRoute,
): readonly DraftNpcGiver[] {
  const world = spec.world;
  const planned = draftPlannedBiomeKeys(route).length;
  const selectedNpcs = options.biomes.slice(0, planned).flatMap((biome, biomeIndex) => {
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
  const gorgon = gorgonGiver(catalog, route, spec);
  return gorgon === undefined ? selectedNpcs : [...selectedNpcs, gorgon];
}

/**
 * The Gorgon Amulet's Athena, met from the first planned biome the amulet is equipped for:
 * the starting keepsake, or a rack keepsake equipped after a planned biome.
 */
function gorgonGiver(
  catalog: Catalog,
  route: DraftRoute,
  spec: DraftWorldSpec,
): DraftNpcGiver | undefined {
  const keepsake = catalog.keepsakes.values.find((k) => k.effect?.kind === 'gorgonAmulet');
  if (keepsake?.effect?.kind !== 'gorgonAmulet') return undefined;
  const planned = draftPlannedBiomeKeys(route);
  let biomeIndex: number | undefined;
  if (spec.loadout.startingKeepsakeKey === keepsake.key) biomeIndex = 0;
  else {
    const slot = spec.rackKeepsakeKeys.indexOf(keepsake.key);
    const after = draftKeepsakeOptions(catalog, route).rackSlots[slot]?.afterBiomeKey;
    const next = after === undefined ? -1 : planned.indexOf(after) + 1;
    if (next > 0 && next < planned.length) biomeIndex = next;
  }
  return biomeIndex === undefined
    ? undefined
    : Object.freeze({ giverKey: keepsake.effect.providerKey, biomeIndex, story: false });
}

/** Givers every world has where the route offers them: Hermes, Daedalus Hammers and Selene; Chaos is never drafted. */
const ALWAYS_PRESENT_PROVIDER_KINDS: ReadonlySet<string> = new Set(['hermes', 'hammer', 'spell']);

function worldGiverKeys(
  options: DraftWorldOptions,
  world: DraftWorld,
  givers: readonly DraftNpcGiver[],
): readonly string[] {
  return Object.freeze([
    ...new Set([
      ...world.godKeys,
      ...givers.map((giver) => giver.giverKey),
      ...options.bonusGiverKeys,
    ]),
  ]);
}

/** Trait givers the world contributes: its gods, its trait-giving NPCs and the always-present givers. */
export function draftWorldGiverKeys(
  catalog: Catalog,
  route: DraftRoute,
  spec: DraftWorldSpec,
): readonly string[] {
  const options = draftWorldOptions(catalog, route);
  return worldGiverKeys(options, spec.world, npcGivers(catalog, options, spec, route));
}

/** What one draft reads from its world, derived once. */
export interface DraftWorldProduct {
  readonly giverKeys: readonly string[];
  readonly npcGivers: readonly DraftNpcGiver[];
  /** Each basket trait a selected NPC gives, by the earliest itinerary index that NPC is met in. */
  readonly npcTraitBiomes: ReadonlyMap<string, number>;
}

export function draftWorld(
  catalog: Catalog,
  route: DraftRoute,
  spec: DraftWorldSpec & Pick<DraftSpec, 'basketTraitKeys'>,
): DraftWorldProduct {
  const options = draftWorldOptions(catalog, route);
  const givers = npcGivers(catalog, options, spec, route);
  const npcTraitBiomes = new Map<string, number>();
  for (const giver of givers)
    for (const traitKey of catalog.traitGivers.byKey[giver.giverKey]?.traitKeys ?? [])
      if (
        spec.basketTraitKeys.includes(traitKey) &&
        giver.biomeIndex < (npcTraitBiomes.get(traitKey) ?? Infinity)
      )
        npcTraitBiomes.set(traitKey, giver.biomeIndex);
  return Object.freeze({
    giverKeys: worldGiverKeys(options, spec.world, givers),
    npcGivers: Object.freeze(givers),
    npcTraitBiomes,
  });
}
