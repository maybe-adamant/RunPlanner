import type { Catalog, TraitDeclaration, TraitRequirementExpression } from '../../catalog-schema';
import type { TraitEquipmentSlot } from '../../catalog-schema/traits';
import type { EquippedTrait } from '../../authored-project/traits/state';
import { resolveRoutePosition } from '../../authored-project/route-context';
import { createArcanaFearState } from '../arcana-fear';
import { createRouteStartHistoryView } from '../history/fold';
import { createInitialSimulationState } from '../state/construction';
import type { SimulationState } from '../state/model';
import { replaceSimulationTraitHistory } from '../state/transitions';
import { createTraitHistoryState } from '../traits/history/fold';
import { checkRequirement } from '../traits/level-effects';
import type { TraitFindingCode } from '../model';
import { draftPlannedBiomeKeys, type DraftLoadout, type DraftRoute, type DraftSpec } from './spec';
import {
  createDraftPrerequisites,
  type DraftHeldTraits,
  type DraftPrerequisites,
} from './prerequisites';
import { draftWorldGiverKeys } from './world';
import { draftGodBoonBudget, draftPerGodCap } from './budget';

export type DraftTraitRefusal =
  | { readonly kind: 'giverNotInWorld' }
  /** Removes held traits or replays acquisitions, so a draft never takes it. */
  | { readonly kind: 'draftIllegal' }
  | { readonly kind: 'slotTaken'; readonly slot: TraitEquipmentSlot; readonly traitKey: string }
  | { readonly kind: 'wrongHammerLoadout' }
  /** The basket already holds this giver's limit. */
  | { readonly kind: 'cap'; readonly giverKey: string; readonly cap: number }
  /** The basket already holds the planner limit of god traits, Duos included. */
  | { readonly kind: 'totalCap'; readonly cap: number }
  /** The basket already holds the planner limit of Hermes and Hammer traits together. */
  | { readonly kind: 'supplyCap'; readonly cap: number }
  /** Its need can only be met by its god's traits queued after it. */
  | { readonly kind: 'prerequisiteAfter'; readonly traitKeys: readonly string[] }
  | {
      readonly kind: 'requirement';
      readonly code: TraitFindingCode;
      readonly detail?: string;
      readonly requirementTraitKeys?: readonly string[];
    };

/** How the basket picker and the schedule group a trait. */
export type DraftTraitKind = 'core' | 'other' | 'legendary' | 'duo';

/** Duos and Legendaries by their offered rarity; core traits by their boon slot. */
export function draftTraitKind(trait: TraitDeclaration): DraftTraitKind {
  const rarities =
    trait.rarityDomain.kind === 'ranked' ? trait.rarityDomain.freshOfferRarities : [];
  if (rarities.includes('Duo')) return 'duo';
  if (rarities.includes('Legendary')) return 'legendary';
  return trait.equipmentSlot !== undefined && trait.equipmentSlot !== 'Spell' ? 'core' : 'other';
}

export interface DraftTraitAssessment {
  readonly traitKey: string;
  readonly kind: DraftTraitKind;
  readonly inBasket: boolean;
  /** Judged against the rest of the basket and the loadout. */
  readonly selectable: boolean;
  readonly refusals: readonly DraftTraitRefusal[];
  /** Run-context conditions the search checks instead. */
  readonly checkedDuringSearch: readonly string[];
}

export interface DraftCapUsage {
  /** Basket traits counted against the cap. */
  readonly count: number;
  readonly cap: number;
}

export interface DraftGiverCapUsage extends DraftCapUsage {
  readonly giverKey: string;
}

/** The basket's use of each planner and native cap, for the world it targets. */
export interface DraftBasketCaps {
  /** Every god trait, Duos included; lower under Forfeit; scaled by the planned share. */
  readonly poolGodTotal: DraftCapUsage;
  /** Hermes and Hammer traits together: one per planned biome. */
  readonly supplyTotal: DraftCapUsage;
  /** Each pool god's own traits, Legendaries included and Duos not; 4 under Denial. */
  readonly poolGods: readonly DraftGiverCapUsage[];
  /** Hammers, Hermes and Selene, in catalog order. */
  readonly providers: readonly (DraftGiverCapUsage & {
    readonly providerKind: 'hammer' | 'hermes' | 'spell';
  })[];
  /** Each trait-giving NPC the world selects. */
  readonly npcs: readonly DraftGiverCapUsage[];
  readonly npcTotal: DraftCapUsage;
}

export interface DraftBasketAssessment {
  /** The world givers' traits, then any basket trait outside them. */
  readonly traits: readonly DraftTraitAssessment[];
  readonly caps: DraftBasketCaps;
}

/** Static legality of each world trait over the basket plus the project's loadout. */
export function assessDraftBasket(
  catalog: Catalog,
  route: DraftRoute,
  spec: DraftSpec,
): DraftBasketAssessment {
  const worldGivers = draftWorldGiverKeys(catalog, route, spec.world);
  const traitKeys = new Set(
    worldGivers.flatMap((key) => catalog.traitGivers.byKey[key]!.traitKeys),
  );
  for (const key of spec.basketTraitKeys) traitKeys.add(key);
  const routeStart = routeStartState(catalog, route, spec.loadout);
  const budget = draftGodBoonBudget(catalog, route, spec);
  const plan: DraftPlanScale = {
    godTotalCap: budget.effectiveTotal,
    perGodCap: budget.perGod,
    supplyCap: supplyCap(route),
  };
  const order: DraftOrderContext = {
    queues: draftSourceQueues(catalog, spec),
    prerequisites: createDraftPrerequisites(catalog, spec.basketTraitKeys, heldTraits(routeStart)),
  };
  return Object.freeze({
    traits: Object.freeze(
      [...traitKeys].map((traitKey) =>
        assessTrait(catalog, spec, worldGivers, routeStart, order, plan, traitKey),
      ),
    ),
    caps: basketCaps(catalog, spec, worldGivers, plan),
  });
}

function basketCaps(
  catalog: Catalog,
  spec: DraftSpec,
  worldGivers: readonly string[],
  plan: DraftPlanScale,
): DraftBasketCaps {
  const usage = (giverKey: string, cap: number): DraftGiverCapUsage =>
    Object.freeze({
      giverKey,
      count: spec.basketTraitKeys.filter(
        (key) => draftCappedGiver(catalog, spec, key)?.giverKey === giverKey,
      ).length,
      cap,
    });
  const npcs = worldGivers
    .map((key) => catalog.traitGivers.byKey[key]!)
    .filter((giver) => isNpcGiver(giver))
    .map((giver) => usage(giver.key, NPC_CAP));
  return Object.freeze({
    poolGodTotal: Object.freeze({
      count: spec.basketTraitKeys.filter((key) => isGodTrait(catalog, key)).length,
      cap: plan.godTotalCap,
    }),
    supplyTotal: Object.freeze({
      count: spec.basketTraitKeys.filter((key) => isSupplyTrait(catalog, key)).length,
      cap: plan.supplyCap,
    }),
    poolGods: Object.freeze(
      spec.world.godKeys.map((godKey) => usage(godKey, draftPerGodCap(catalog, spec))),
    ),
    providers: Object.freeze(
      catalog.traitGivers.values.flatMap((giver) => {
        const kind = giver.providerKind;
        if (!isProviderKind(kind)) return [];
        return [
          Object.freeze({ ...usage(giver.key, DRAFT_PROVIDER_CAPS[kind]), providerKind: kind }),
        ];
      }),
    ),
    npcs: Object.freeze(npcs),
    npcTotal: Object.freeze({
      count: npcs.reduce((sum, npc) => sum + npc.count, 0),
      cap: npcs.length * NPC_CAP,
    }),
  });
}

/** How the planned prefix sizes the route-wide caps. */
interface DraftPlanScale {
  readonly godTotalCap: number;
  readonly perGodCap: number;
  readonly supplyCap: number;
}

/** One Hermes or Hammer trait per planned biome; each giver keeps its own cap of two. */
function supplyCap(route: DraftRoute): number {
  return draftPlannedBiomeKeys(route).length;
}

/** A Hermes or Daedalus Hammer trait. */
function isSupplyTrait(catalog: Catalog, traitKey: string): boolean {
  return catalog.traitGivers.values.some(
    (giver) =>
      (giver.providerKind === 'hermes' || giver.providerKind === 'hammer') &&
      giver.traitKeys.includes(traitKey),
  );
}

function assessTrait(
  catalog: Catalog,
  spec: DraftSpec,
  worldGivers: readonly string[],
  routeStart: SimulationState,
  order: DraftOrderContext,
  plan: DraftPlanScale,
  traitKey: string,
): DraftTraitAssessment {
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined) throw new Error(`unknown draft trait ${traitKey}`);
  const others = spec.basketTraitKeys.filter((key) => key !== traitKey);
  const refusals: DraftTraitRefusal[] = [];
  const deferred = new Set<string>();
  // A Duo is offered only once both of its gods are met, so every giver listing it must be in the world.
  const inWorld =
    draftTraitKind(trait) === 'duo'
      ? catalog.traitGivers.values.every(
          (giver) => !giver.traitKeys.includes(traitKey) || worldGivers.includes(giver.key),
        )
      : worldGivers.some((giver) => catalog.traitGivers.byKey[giver]!.traitKeys.includes(traitKey));
  if (!inWorld) refusals.push({ kind: 'giverNotInWorld' });
  if (draftIllegalTrait(trait)) refusals.push({ kind: 'draftIllegal' });
  const slot = trait.equipmentSlot;
  const slotHolder =
    slot === undefined
      ? undefined
      : others.find((key) => catalog.traits.byKey[key]?.equipmentSlot === slot);
  if (slot !== undefined && slotHolder !== undefined)
    refusals.push({ kind: 'slotTaken', slot, traitKey: slotHolder });
  const capped = draftCappedGiver(catalog, spec, traitKey);
  if (capped !== undefined) {
    const held = others.filter(
      (key) => draftCappedGiver(catalog, spec, key)?.giverKey === capped.giverKey,
    );
    if (held.length >= capped.cap) refusals.push({ kind: 'cap', ...capped });
  }
  const godTotalCap = plan.godTotalCap;
  if (
    isGodTrait(catalog, traitKey) &&
    others.filter((key) => isGodTrait(catalog, key)).length >= godTotalCap
  )
    refusals.push({ kind: 'totalCap', cap: godTotalCap });
  const supplyTotalCap = plan.supplyCap;
  if (
    isSupplyTrait(catalog, traitKey) &&
    others.filter((key) => isSupplyTrait(catalog, key)).length >= supplyTotalCap
  )
    refusals.push({ kind: 'supplyCap', cap: supplyTotalCap });
  const hammer = trait.hammerCompatibility;
  if (
    hammer !== undefined &&
    (spec.loadout.weaponKey !== hammer.weaponKey ||
      !hammer.aspectKeys.includes(spec.loadout.aspectKey))
  )
    refusals.push({ kind: 'wrongHammerLoadout' });
  // Latest Model upgrades a held Hammer, so the basket must bring one.
  if (trait.targetedAcquisition?.kind === 'upgradeHammerToRank2') {
    const hammers = compatibleHammerKeys(catalog, spec.loadout);
    if (!others.some((key) => hammers.includes(key)))
      refusals.push({
        kind: 'requirement',
        code: 'missingPrerequisite',
        requirementTraitKeys: hammers,
      });
  }
  const requirements = [...trait.eligibilityRequirements, ...trait.linkedBoonRequirements];
  if (requirements.length > 0) {
    const state = withBasket(catalog, routeStart, others);
    for (const requirement of requirements)
      for (const failure of checkStatic(catalog, requirement, trait, state, deferred))
        refusals.push({ kind: 'requirement', ...failure });
  }
  if (spec.basketTraitKeys.includes(traitKey)) {
    const later = prerequisitesQueuedAfter(order, traitKey);
    if (later.length > 0) refusals.push({ kind: 'prerequisiteAfter', traitKeys: later });
  }
  if (trait.offerDependsOnDeathDefiance === true) deferred.add('deathDefiance');
  return Object.freeze({
    traitKey,
    kind: draftTraitKind(trait),
    inBasket: spec.basketTraitKeys.includes(traitKey),
    selectable: refusals.length === 0,
    refusals: Object.freeze(refusals),
    checkedDuringSearch: Object.freeze([...deferred]),
  });
}

/** Hammers the loadout's weapon and Aspect can take. */
function compatibleHammerKeys(catalog: Catalog, loadout: DraftLoadout): readonly string[] {
  return catalog.traits.values
    .filter(
      (trait) =>
        trait.hammerCompatibility?.weaponKey === loadout.weaponKey &&
        trait.hammerCompatibility.aspectKeys.includes(loadout.aspectKey),
    )
    .map((trait) => trait.key);
}

/** Echo choices that replay or duplicate acquisitions, so they can break the draft's caps. */
export const DRAFT_ILLEGAL_ECHO_TRAIT_KEYS: ReadonlySet<string> = new Set([
  'EchoLastReward',
  'EchoRepeatKeepsakeBoon',
  'EchoDoubleShop',
]);

/** A trait a draft never selects: a Ransom exchange or a replaying Echo choice. */
export function draftIllegalTrait(trait: TraitDeclaration): boolean {
  return (
    trait.selectedDisposition.kind === 'ransom' || DRAFT_ILLEGAL_ECHO_TRAIT_KEYS.has(trait.key)
  );
}

export type DraftProviderKind = 'hammer' | 'hermes' | 'spell';

function isProviderKind(kind: string): kind is DraftProviderKind {
  return kind === 'hammer' || kind === 'hermes' || kind === 'spell';
}

/**
 * Native run caps: two Hammers (HammerLootRequirements' early and late gates), two
 * Hermes boons from rooms and one Hex; the catalog encodes them only as offer requirements.
 */
export const DRAFT_PROVIDER_CAPS: Readonly<Record<DraftProviderKind, number>> = {
  hammer: 2,
  hermes: 2,
  spell: 1,
};
/** Planner limit on each trait-giving NPC: one of its traits per draft. */
const NPC_CAP = 1;

function isNpcGiver(giver: Catalog['traitGivers']['values'][number]): boolean {
  return giver.providerKind === 'npc' && giver.traitKeys.length > 0;
}

function isGodTrait(catalog: Catalog, traitKey: string): boolean {
  return catalog.traitGivers.values.some(
    (giver) => giver.providerKind === 'olympian' && giver.traitKeys.includes(traitKey),
  );
}

/** The one giver whose cap a trait counts against; a Duo counts for neither god. */
export function draftCappedGiver(
  catalog: Catalog,
  spec: DraftSpec,
  traitKey: string,
): { readonly giverKey: string; readonly cap: number } | undefined {
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined || draftTraitKind(trait) === 'duo') return undefined;
  const givers = catalog.traitGivers.values.filter((g) => g.traitKeys.includes(traitKey));
  if (givers.length !== 1) return undefined;
  const giver = givers[0]!;
  const cap =
    giver.providerKind === 'olympian'
      ? draftPerGodCap(catalog, spec)
      : isNpcGiver(giver)
        ? NPC_CAP
        : isProviderKind(giver.providerKind)
          ? DRAFT_PROVIDER_CAPS[giver.providerKind]
          : undefined;
  return cap === undefined ? undefined : { giverKey: giver.key, cap };
}

/** Loadout facts that cannot change during the run; the rest depend on run context. */
function isStatic(requirement: TraitRequirementExpression): boolean {
  switch (requirement.kind) {
    case 'anyEquippedTrait':
    case 'notEquippedTrait':
    case 'routeKeyNot':
    case 'anyActiveArcana':
    case 'manualArcanaGraspCost':
      return true;
    case 'offerContext':
      return requirement.context === 'circeRemovableFearVow';
    default:
      return false;
  }
}

function checkStatic(
  catalog: Catalog,
  requirement: TraitRequirementExpression,
  trait: TraitDeclaration,
  state: SimulationState,
  deferred: Set<string>,
): readonly Omit<Extract<DraftTraitRefusal, { kind: 'requirement' }>, 'kind'>[] {
  if (requirement.kind === 'all')
    return requirement.requirements.flatMap((child) =>
      checkStatic(catalog, child, trait, state, deferred),
    );
  if (!isStatic(requirement)) {
    deferred.add(
      requirement.kind === 'offerContext'
        ? `offerContext:${requirement.context}`
        : requirement.kind,
    );
    return [];
  }
  const failure = checkRequirement(catalog, requirement, trait, state, {});
  return failure === undefined ? [] : [failure];
}

/** What the loadout holds at route start: its traits and their element counts. */
export function draftStartTraits(
  catalog: Catalog,
  route: DraftRoute,
  loadout: DraftLoadout,
): DraftHeldTraits {
  return heldTraits(routeStartState(catalog, route, loadout));
}

function heldTraits(state: SimulationState): DraftHeldTraits {
  const history = state.traitHistory;
  return Object.freeze({
    traitKeys: new Set(Object.keys(history.equippedTraits)),
    elementCounts: history.elementCounts,
    godBoonRarityCounts: history.godBoonRarityCounts,
  });
}

/** The reached route-start snapshot of the loadout, before anything is acquired. */
function routeStartState(
  catalog: Catalog,
  route: DraftRoute,
  loadout: DraftLoadout,
): SimulationState {
  return createInitialSimulationState(
    catalog,
    loadout,
    loadout.startingKeepsakeKey,
    createArcanaFearState(catalog, loadout),
    Object.freeze({
      routePosition: resolveRoutePosition(catalog, route, route.itineraryBiomeKeys[0]!),
      historyView: createRouteStartHistoryView(),
    }),
  );
}

/** The basket as a synthetic equipped set over the route-start state. */
function withBasket(
  catalog: Catalog,
  state: SimulationState,
  traitKeys: readonly string[],
): SimulationState {
  const equippedTraits: Record<string, EquippedTrait> = {};
  for (const traitKey of traitKeys) {
    const giver = catalog.traitGivers.values.find((g) => g.traitKeys.includes(traitKey));
    if (giver === undefined) continue;
    equippedTraits[traitKey] = Object.freeze({
      traitKey,
      giverKey: giver.key,
      providerKind: giver.providerKind,
      sourceRole: 'draftBasket',
    });
  }
  return replaceSimulationTraitHistory(
    state,
    Object.freeze({ ...createTraitHistoryState(), equippedTraits: Object.freeze(equippedTraits) }),
  );
}

/**
 * One acquisition source's basket traits in basket order, the order the draft
 * takes them: a world god's own traits (Duos excluded), Hermes or a Hammer giver.
 */
export interface DraftSourceQueue {
  readonly giverKey: string;
  readonly traitKeys: readonly string[];
}

/** World gods first, then the Hermes and Hammer givers, in catalog order. */
export function draftSourceQueues(catalog: Catalog, spec: DraftSpec): readonly DraftSourceQueue[] {
  const givers = [
    ...spec.world.godKeys.filter(
      (godKey) => catalog.traitGivers.byKey[godKey]?.providerKind === 'olympian',
    ),
    ...catalog.traitGivers.values
      .filter((giver) => giver.providerKind === 'hermes' || giver.providerKind === 'hammer')
      .map((giver) => giver.key),
  ];
  return Object.freeze(
    givers.map((giverKey) =>
      Object.freeze({
        giverKey,
        traitKeys: Object.freeze(
          spec.basketTraitKeys.filter(
            (key) => draftCappedGiver(catalog, spec, key)?.giverKey === giverKey,
          ),
        ),
      }),
    ),
  );
}

/**
 * Order legality for reorderings of the spec's basket: each basket trait queued
 * above a same-source trait its held-trait need must use, with those later traits.
 */
export function draftOrderRefusals(
  catalog: Catalog,
  route: DraftRoute,
  spec: DraftSpec,
): (basketTraitKeys: readonly string[]) => ReadonlyMap<string, readonly string[]> {
  const prerequisites = createDraftPrerequisites(
    catalog,
    spec.basketTraitKeys,
    draftStartTraits(catalog, route, spec.loadout),
  );
  return (basketTraitKeys) => {
    const order = {
      queues: draftSourceQueues(catalog, { ...spec, basketTraitKeys }),
      prerequisites,
    };
    const refusals = new Map<string, readonly string[]>();
    for (const queue of order.queues)
      for (const traitKey of queue.traitKeys) {
        const later = prerequisitesQueuedAfter(order, traitKey);
        if (later.length > 0) refusals.set(traitKey, later);
      }
    return refusals;
  };
}

interface DraftOrderContext {
  readonly queues: readonly DraftSourceQueue[];
  readonly prerequisites: DraftPrerequisites;
}

/**
 * Same-source traits queued after this one that some held-trait need must use: each need is
 * judged with those traits left out, and every other basket trait counted.
 */
function prerequisitesQueuedAfter(order: DraftOrderContext, traitKey: string): readonly string[] {
  const queue = order.queues
    .map((godQueue) => godQueue.traitKeys)
    .find((traitKeys) => traitKeys.includes(traitKey));
  if (queue === undefined) return [];
  const after = new Set(queue.slice(queue.indexOf(traitKey) + 1));
  const later = new Set<string>();
  // A trait waiting only on run state is passed over, so only held-trait needs order it.
  for (const need of order.prerequisites.heldTraitNeeds.get(traitKey) ?? []) {
    if (need.length === 0) continue;
    const met = need.some((option) => {
      let sum = 0;
      for (const [key, weight] of option.weights) if (!after.has(key)) sum += weight;
      return sum >= option.needed;
    });
    if (met) continue;
    for (const option of need)
      for (const key of option.weights.keys()) if (after.has(key)) later.add(key);
  }
  return Object.freeze([...later]);
}
