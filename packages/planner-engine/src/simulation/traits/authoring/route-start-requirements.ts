import type {
  Catalog,
  TraitDeclaration,
  TraitElement,
  TraitRequirementExpression,
} from '../../../catalog-schema';
import type {
  AuthoredRoutePlan,
  RouteLoadout,
  RouteWeaponAspectLoadout,
} from '../../../authored-project/model';
import type { EquippedTrait } from '../../../authored-project/traits/state';
import { resolveRoutePosition } from '../../../authored-project/route-context';
import { createArcanaFearState } from '../../arcana-fear';
import { createRouteStartHistoryView } from '../../history/fold';
import { createInitialSimulationState } from '../../state/construction';
import type { SimulationState } from '../../state/model';
import { replaceSimulationTraitHistory } from '../../state/transitions';
import { checkRequirement } from '../level-effects';
import type { TraitAssessmentFinding } from '../offer-domain';
import { initialOfferCoreOnlyKeys } from './initial-composition';

/** One requirement the trait fails over the route start and the assumed traits. */
export type TraitRequirementFailure = Omit<TraitAssessmentFinding, 'traitKey'>;

export interface RouteStartTraitAssessment {
  readonly failures: readonly TraitRequirementFailure[];
  /**
   * Requirement kinds the route start cannot decide, each once in requirement order:
   * `offerContext:<context>` for an offer context, else the kind.
   */
  readonly contextual: readonly string[];
}

export interface RouteStartTraitRequirements {
  /** Traits held at the reached route start, and their counts. */
  readonly held: {
    readonly traitKeys: ReadonlySet<string>;
    readonly elementCounts: Readonly<Record<TraitElement, number>>;
    readonly godBoonRarityCounts: Readonly<Record<string, number>>;
  };
  /** The vacant cores a god's fresh first offer holds from this start; undefined when unrestricted. */
  coreFirstOfferTraitKeys(giverKey: string): readonly string[] | undefined;
  /**
   * The trait's requirements the loadout decides, judged with the route-start traits plus
   * `assumedTraitKeys` equipped over the route-start Arcana and Fear. The union is the contract:
   * a trait held at the route start counts exactly like an assumed one.
   */
  assess(traitKey: string, assumedTraitKeys: readonly string[]): RouteStartTraitAssessment;
}

/** Requirements over the loadout's reached route start, before anything is acquired. */
export function prepareRouteStartTraitRequirements(
  catalog: Catalog,
  route: Pick<AuthoredRoutePlan, 'routeKey' | 'itineraryBiomeKeys'>,
  loadout: RouteWeaponAspectLoadout &
    Pick<RouteLoadout, 'familiarKey' | 'manualArcanaKeys' | 'fearRanks' | 'startingKeepsakeKey'>,
): RouteStartTraitRequirements {
  const routeStart = createInitialSimulationState(
    catalog,
    loadout,
    loadout.startingKeepsakeKey,
    createArcanaFearState(catalog, loadout),
    Object.freeze({
      routePosition: resolveRoutePosition(catalog, route, route.itineraryBiomeKeys[0]!),
      historyView: createRouteStartHistoryView(),
    }),
  );
  const history = routeStart.traitHistory;
  return Object.freeze({
    held: Object.freeze({
      traitKeys: new Set(Object.keys(history.equippedTraits)),
      elementCounts: history.elementCounts,
      godBoonRarityCounts: history.godBoonRarityCounts,
    }),
    coreFirstOfferTraitKeys: (giverKey: string) =>
      initialOfferCoreOnlyKeys(catalog, giverKey, history),
    assess: (traitKey: string, assumedTraitKeys: readonly string[]) => {
      const trait = catalog.traits.byKey[traitKey];
      if (trait === undefined) throw new Error(`unknown trait ${traitKey}`);
      const requirements = [...trait.eligibilityRequirements, ...trait.linkedBoonRequirements];
      const failures: TraitRequirementFailure[] = [];
      const contextual = new Set<string>();
      if (requirements.length > 0) {
        const state = withAssumedTraits(catalog, routeStart, assumedTraitKeys);
        for (const requirement of requirements)
          failures.push(...checkDecidable(catalog, requirement, trait, state, contextual));
      }
      return Object.freeze({
        failures: Object.freeze(failures),
        contextual: Object.freeze([...contextual]),
      });
    },
  });
}

/** Loadout facts that cannot change during the run; the rest depend on run context. */
function decidableAtRouteStart(requirement: TraitRequirementExpression): boolean {
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

function checkDecidable(
  catalog: Catalog,
  requirement: TraitRequirementExpression,
  trait: TraitDeclaration,
  state: SimulationState,
  contextual: Set<string>,
): readonly TraitRequirementFailure[] {
  if (requirement.kind === 'all')
    return requirement.requirements.flatMap((child) =>
      checkDecidable(catalog, child, trait, state, contextual),
    );
  if (!decidableAtRouteStart(requirement)) {
    contextual.add(
      requirement.kind === 'offerContext'
        ? `offerContext:${requirement.context}`
        : requirement.kind,
    );
    return [];
  }
  const failure = checkRequirement(catalog, requirement, trait, state, {});
  return failure === undefined ? [] : [failure];
}

/** The route-start state with the assumed traits equipped beside the held ones. */
function withAssumedTraits(
  catalog: Catalog,
  routeStart: SimulationState,
  traitKeys: readonly string[],
): SimulationState {
  const equippedTraits: Record<string, EquippedTrait> = {
    ...routeStart.traitHistory.equippedTraits,
  };
  for (const traitKey of traitKeys) {
    if (equippedTraits[traitKey] !== undefined) continue;
    const giver = catalog.traitGivers.values.find((g) => g.traitKeys.includes(traitKey));
    if (giver === undefined) continue;
    equippedTraits[traitKey] = Object.freeze({
      traitKey,
      giverKey: giver.key,
      providerKind: giver.providerKind,
      sourceRole: 'assumed',
    });
  }
  return replaceSimulationTraitHistory(
    routeStart,
    Object.freeze({ ...routeStart.traitHistory, equippedTraits: Object.freeze(equippedTraits) }),
  );
}
