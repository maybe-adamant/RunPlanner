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
import type { DraftRoute, DraftSpec } from './spec';
import { draftWorldGiverKeys } from './world';

export type DraftTraitRefusal =
  | { readonly kind: 'giverNotInWorld' }
  /** Removes held traits, so a monotonic draft never takes it. */
  | { readonly kind: 'draftIllegal' }
  | { readonly kind: 'slotTaken'; readonly slot: TraitEquipmentSlot; readonly traitKey: string }
  | { readonly kind: 'wrongHammerLoadout' }
  /** The basket already holds this giver's limit. */
  | { readonly kind: 'cap'; readonly giverKey: string; readonly cap: number }
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

export interface DraftBasketAssessment {
  /** The world givers' traits, then any basket trait outside them. */
  readonly traits: readonly DraftTraitAssessment[];
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
  const routeStart = routeStartState(catalog, route);
  return Object.freeze({
    traits: Object.freeze(
      [...traitKeys].map((traitKey) =>
        assessTrait(catalog, route, spec, worldGivers, routeStart, traitKey),
      ),
    ),
  });
}

function assessTrait(
  catalog: Catalog,
  route: DraftRoute,
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
  const capped = cappedGiver(catalog, traitKey);
  if (capped !== undefined) {
    const held = others.filter((key) => cappedGiver(catalog, key)?.giverKey === capped.giverKey);
    if (held.length >= capped.cap) refusals.push({ kind: 'cap', ...capped });
  }
  const hammer = trait.hammerCompatibility;
  if (
    hammer !== undefined &&
    (route.loadout.weaponKey !== hammer.weaponKey ||
      route.loadout.aspectKey === null ||
      !hammer.aspectKeys.includes(route.loadout.aspectKey))
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

/** Native run caps: two Hammers and two Hermes boons from rooms, one Hex. */
const PROVIDER_CAPS: Readonly<Record<string, number>> = { hammer: 2, hermes: 2, spell: 1 };
/** Planner limit on one god's own traits, Legendary included; a Duo counts for neither god. */
const OLYMPIAN_CAP = 5;

function cappedGiver(
  catalog: Catalog,
  traitKey: string,
): { readonly giverKey: string; readonly cap: number } | undefined {
  const givers = catalog.traitGivers.values.filter((g) => g.traitKeys.includes(traitKey));
  if (givers.length !== 1) return undefined;
  const giver = givers[0]!;
  const cap = giver.providerKind === 'olympian' ? OLYMPIAN_CAP : PROVIDER_CAPS[giver.providerKind];
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

/** The reached route-start snapshot of the loadout, before anything is acquired. */
function routeStartState(catalog: Catalog, route: DraftRoute): SimulationState {
  return createInitialSimulationState(
    catalog,
    route.loadout,
    route.loadout.startingKeepsakeKey,
    createArcanaFearState(catalog, route.loadout),
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
