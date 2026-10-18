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
import {
  draftDenialActive,
  draftForfeitActive,
  type DraftLoadout,
  type DraftRoute,
  type DraftSpec,
} from './spec';
import type { DraftHeldTraits } from './prerequisites';
import { draftWorldGiverKeys } from './world';

export type DraftTraitRefusal =
  | { readonly kind: 'giverNotInWorld' }
  /** Removes held traits, so a monotonic draft never takes it. */
  | { readonly kind: 'draftIllegal' }
  | { readonly kind: 'slotTaken'; readonly slot: TraitEquipmentSlot; readonly traitKey: string }
  | { readonly kind: 'wrongHammerLoadout' }
  /** The basket already holds this giver's limit. */
  | { readonly kind: 'cap'; readonly giverKey: string; readonly cap: number }
  /** The basket already holds the planner limit of god traits, Duos included. */
  | { readonly kind: 'totalCap'; readonly cap: number }
  | {
      readonly kind: 'requirement';
      readonly code: TraitFindingCode;
      readonly detail?: string;
      readonly requirementTraitKeys?: readonly string[];
    };

export interface DraftTraitAssessment {
  readonly traitKey: string;
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
  /** Every god trait, Duos included; lower under Forfeit. */
  readonly poolGodTotal: DraftCapUsage;
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
  return Object.freeze({
    traits: Object.freeze(
      [...traitKeys].map((traitKey) =>
        assessTrait(catalog, spec, worldGivers, routeStart, traitKey),
      ),
    ),
    caps: basketCaps(catalog, spec, worldGivers),
  });
}

function basketCaps(
  catalog: Catalog,
  spec: DraftSpec,
  worldGivers: readonly string[],
): DraftBasketCaps {
  const usage = (giverKey: string, cap: number): DraftGiverCapUsage =>
    Object.freeze({
      giverKey,
      count: spec.basketTraitKeys.filter(
        (key) => cappedGiver(catalog, spec, key)?.giverKey === giverKey,
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
      cap: totalCap(catalog, spec),
    }),
    poolGods: Object.freeze(
      spec.world.godKeys.map((godKey) => usage(godKey, olympianCap(catalog, spec))),
    ),
    providers: Object.freeze(
      catalog.traitGivers.values.flatMap((giver) => {
        const kind = giver.providerKind;
        if (kind !== 'hammer' && kind !== 'hermes' && kind !== 'spell') return [];
        return [Object.freeze({ ...usage(giver.key, PROVIDER_CAPS[kind]!), providerKind: kind })];
      }),
    ),
    npcs: Object.freeze(npcs),
    npcTotal: Object.freeze({
      count: npcs.reduce((sum, npc) => sum + npc.count, 0),
      cap: npcs.length * NPC_CAP,
    }),
  });
}

function totalCap(catalog: Catalog, spec: DraftSpec): number {
  return draftForfeitActive(catalog, spec.loadout)
    ? FORFEIT_OLYMPIAN_TOTAL_CAP
    : OLYMPIAN_TOTAL_CAP;
}

function assessTrait(
  catalog: Catalog,
  spec: DraftSpec,
  worldGivers: readonly string[],
  routeStart: SimulationState,
  traitKey: string,
): DraftTraitAssessment {
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined) throw new Error(`unknown draft trait ${traitKey}`);
  const others = spec.basketTraitKeys.filter((key) => key !== traitKey);
  const refusals: DraftTraitRefusal[] = [];
  const deferred = new Set<string>();
  if (!worldGivers.some((giver) => catalog.traitGivers.byKey[giver]!.traitKeys.includes(traitKey)))
    refusals.push({ kind: 'giverNotInWorld' });
  if (trait.selectedDisposition.kind === 'ransom') refusals.push({ kind: 'draftIllegal' });
  const slot = trait.equipmentSlot;
  const slotHolder =
    slot === undefined
      ? undefined
      : others.find((key) => catalog.traits.byKey[key]?.equipmentSlot === slot);
  if (slot !== undefined && slotHolder !== undefined)
    refusals.push({ kind: 'slotTaken', slot, traitKey: slotHolder });
  const capped = cappedGiver(catalog, spec, traitKey);
  if (capped !== undefined) {
    const held = others.filter(
      (key) => cappedGiver(catalog, spec, key)?.giverKey === capped.giverKey,
    );
    if (held.length >= capped.cap) refusals.push({ kind: 'cap', ...capped });
  }
  const godTotalCap = totalCap(catalog, spec);
  if (
    isGodTrait(catalog, traitKey) &&
    others.filter((key) => isGodTrait(catalog, key)).length >= godTotalCap
  )
    refusals.push({ kind: 'totalCap', cap: godTotalCap });
  const hammer = trait.hammerCompatibility;
  if (
    hammer !== undefined &&
    (spec.loadout.weaponKey !== hammer.weaponKey ||
      !hammer.aspectKeys.includes(spec.loadout.aspectKey))
  )
    refusals.push({ kind: 'wrongHammerLoadout' });
  const requirements = [...trait.eligibilityRequirements, ...trait.linkedBoonRequirements];
  if (requirements.length > 0) {
    const state = withBasket(catalog, routeStart, others);
    for (const requirement of requirements)
      for (const failure of checkStatic(catalog, requirement, trait, state, deferred))
        refusals.push({ kind: 'requirement', ...failure });
  }
  if (trait.offerDependsOnDeathDefiance === true) deferred.add('deathDefiance');
  return Object.freeze({
    traitKey,
    inBasket: spec.basketTraitKeys.includes(traitKey),
    selectable: refusals.length === 0,
    refusals: Object.freeze(refusals),
    checkedDuringSearch: Object.freeze([...deferred]),
  });
}

/**
 * Native run caps: two Hammers (HammerLootRequirements' early and late gates), two
 * Hermes boons from rooms and one Hex; the catalog encodes them only as offer requirements.
 */
const PROVIDER_CAPS: Readonly<Record<string, number>> = { hammer: 2, hermes: 2, spell: 1 };
/**
 * Planner limit on one god's own traits, Legendary included; a Duo counts for neither god.
 * Denial bans offered rows that are not taken, so it leaves room for one fewer.
 */
const OLYMPIAN_CAP = 5;
const DENIAL_OLYMPIAN_CAP = 4;

function olympianCap(catalog: Catalog, spec: DraftSpec): number {
  return draftDenialActive(catalog, spec.loadout) ? DENIAL_OLYMPIAN_CAP : OLYMPIAN_CAP;
}
/** Planner limit on god traits across the whole pool; Forfeit's lost boon rooms lower it. */
const OLYMPIAN_TOTAL_CAP = 12;
const FORFEIT_OLYMPIAN_TOTAL_CAP = 8;
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

function cappedGiver(
  catalog: Catalog,
  spec: DraftSpec,
  traitKey: string,
): { readonly giverKey: string; readonly cap: number } | undefined {
  const givers = catalog.traitGivers.values.filter((g) => g.traitKeys.includes(traitKey));
  if (givers.length !== 1) return undefined;
  const giver = givers[0]!;
  const cap =
    giver.providerKind === 'olympian'
      ? olympianCap(catalog, spec)
      : isNpcGiver(giver)
        ? NPC_CAP
        : PROVIDER_CAPS[giver.providerKind];
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
  const history = routeStartState(catalog, route, loadout).traitHistory;
  return Object.freeze({
    traitKeys: new Set(Object.keys(history.equippedTraits)),
    elementCounts: history.elementCounts,
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
