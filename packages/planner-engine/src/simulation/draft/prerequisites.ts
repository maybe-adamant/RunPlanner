import type { Catalog, TraitRequirementExpression } from '../../catalog-schema';
import type { TraitElement } from '../../catalog-schema/traits';
import { BASE_TRAIT_ELEMENTS, highestBaseElementCount } from '../traits/history/fold';

type PrerequisiteLeaf = Extract<
  TraitRequirementExpression,
  { readonly kind: 'anyEquippedTrait' | 'elementCount' | 'highestBaseElementCount' }
>;

/** Traits held, and the element counts the run has from them and everything else. */
export interface DraftHeldTraits {
  readonly traitKeys: ReadonlySet<string>;
  readonly elementCounts: Readonly<Record<TraitElement, number>>;
}

/** One way to meet a need: basket traits whose contributions reach the shortfall. */
export interface DraftPrerequisiteOption {
  readonly weights: ReadonlyMap<string, number>;
  readonly needed: number;
}

/** A requirement unmet at route start, with every basket way to meet it; none when it cannot. */
export type DraftPrerequisiteNeed = readonly DraftPrerequisiteOption[];

export interface DraftPrerequisites {
  /** Each basket trait's needs the route start leaves unmet. */
  readonly needs: ReadonlyMap<string, readonly DraftPrerequisiteNeed[]>;
  /** The subset of `needs` for held traits, without element thresholds. */
  readonly heldTraitNeeds: ReadonlyMap<string, readonly DraftPrerequisiteNeed[]>;
  /** Whether the trait's held-trait and element requirements all hold. */
  ready(traitKey: string, held: DraftHeldTraits): boolean;
  /** Whether the trait waits only on element thresholds. */
  elementWaiting(traitKey: string, held: DraftHeldTraits): boolean;
  /** Elements whose unmet threshold the trait waits on; any base element for a highest-count need. */
  missingElements(traitKey: string, held: DraftHeldTraits): readonly TraitElement[];
  /** Wanted basket traits that some unmet need of a waiting trait, by default any wanted one, could use. */
  waitedOn(
    wanted: readonly string[],
    held: DraftHeldTraits,
    waiting?: readonly string[],
  ): ReadonlySet<string>;
}

/** Held-trait and element requirements from both requirement lists, through `all`. */
function prerequisiteLeaves(catalog: Catalog, traitKey: string): readonly PrerequisiteLeaf[] {
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined) return [];
  const leaves: PrerequisiteLeaf[] = [];
  const visit = (requirement: TraitRequirementExpression): void => {
    if (requirement.kind === 'all') requirement.requirements.forEach(visit);
    else if (
      requirement.kind === 'anyEquippedTrait' ||
      requirement.kind === 'elementCount' ||
      requirement.kind === 'highestBaseElementCount'
    )
      leaves.push(requirement);
  };
  [...trait.eligibilityRequirements, ...trait.linkedBoonRequirements].forEach(visit);
  // Latest Model upgrades a held Hammer, so it waits on one.
  if (trait.targetedAcquisition?.kind === 'upgradeHammerToRank2')
    leaves.push({
      kind: 'anyEquippedTrait',
      traitKeys: catalog.traits.values
        .filter((candidate) => candidate.hammerCompatibility !== undefined)
        .map((candidate) => candidate.key),
    });
  return leaves;
}

function leafHeld(leaf: PrerequisiteLeaf, held: DraftHeldTraits): boolean {
  switch (leaf.kind) {
    case 'anyEquippedTrait':
      return leaf.traitKeys.some((key) => held.traitKeys.has(key));
    case 'elementCount':
      return held.elementCounts[leaf.element] >= leaf.minimum;
    case 'highestBaseElementCount':
      return highestBaseElementCount(held.elementCounts) >= leaf.minimum;
  }
}

function leafOptions(
  catalog: Catalog,
  leaf: PrerequisiteLeaf,
  others: readonly string[],
  start: DraftHeldTraits,
): DraftPrerequisiteNeed {
  const elementOption = (element: TraitElement, minimum: number): DraftPrerequisiteOption => ({
    weights: new Map(
      others.flatMap((key) => {
        const amount = catalog.traits.byKey[key]?.elementContributions[element] ?? 0;
        return amount > 0 ? [[key, amount] as const] : [];
      }),
    ),
    needed: minimum - start.elementCounts[element],
  });
  const options =
    leaf.kind === 'anyEquippedTrait'
      ? [
          {
            weights: new Map(
              others.filter((key) => leaf.traitKeys.includes(key)).map((key) => [key, 1]),
            ),
            needed: 1,
          },
        ]
      : leaf.kind === 'elementCount'
        ? [elementOption(leaf.element, leaf.minimum)]
        : BASE_TRAIT_ELEMENTS.map((element) => elementOption(element, leaf.minimum));
  return options.filter((option) => total(option, () => true) >= option.needed);
}

function total(option: DraftPrerequisiteOption, counted: (key: string) => boolean): number {
  let sum = 0;
  for (const [key, weight] of option.weights) if (counted(key)) sum += weight;
  return sum;
}

/** The basket's prerequisite needs over what the loadout holds at route start. */
export function createDraftPrerequisites(
  catalog: Catalog,
  basketTraitKeys: readonly string[],
  start: DraftHeldTraits,
): DraftPrerequisites {
  const leaves = new Map<string, readonly PrerequisiteLeaf[]>();
  const leavesOf = (traitKey: string) => {
    let cached = leaves.get(traitKey);
    if (cached === undefined)
      leaves.set(traitKey, (cached = prerequisiteLeaves(catalog, traitKey)));
    return cached;
  };
  const unmet = new Map(
    basketTraitKeys.map((traitKey) => {
      const others = basketTraitKeys.filter((key) => key !== traitKey);
      return [
        traitKey,
        leavesOf(traitKey)
          .filter((leaf) => !leafHeld(leaf, start))
          .map((leaf) => ({ leaf, options: leafOptions(catalog, leaf, others, start) })),
      ] as const;
    }),
  );
  return Object.freeze({
    needs: new Map([...unmet].map(([key, needs]) => [key, needs.map((need) => need.options)])),
    heldTraitNeeds: new Map(
      [...unmet].map(([key, needs]) => [
        key,
        needs.filter((need) => need.leaf.kind === 'anyEquippedTrait').map((need) => need.options),
      ]),
    ),
    ready: (traitKey: string, held: DraftHeldTraits) =>
      leavesOf(traitKey).every((leaf) => leafHeld(leaf, held)),
    missingElements: (traitKey: string, held: DraftHeldTraits) =>
      leavesOf(traitKey)
        .filter((leaf) => !leafHeld(leaf, held))
        .flatMap((leaf): readonly TraitElement[] =>
          leaf.kind === 'elementCount'
            ? [leaf.element]
            : leaf.kind === 'highestBaseElementCount'
              ? BASE_TRAIT_ELEMENTS
              : [],
        ),
    elementWaiting: (traitKey: string, held: DraftHeldTraits) => {
      const waiting = leavesOf(traitKey).filter((leaf) => !leafHeld(leaf, held));
      return waiting.length > 0 && waiting.every((leaf) => leaf.kind !== 'anyEquippedTrait');
    },
    waitedOn: (wanted: readonly string[], held: DraftHeldTraits, waiting = wanted) => {
      const waited = new Set<string>();
      for (const traitKey of waiting)
        for (const need of unmet.get(traitKey) ?? [])
          if (!leafHeld(need.leaf, held))
            for (const option of need.options)
              for (const key of option.weights.keys())
                if (!held.traitKeys.has(key) && wanted.includes(key)) waited.add(key);
      return waited;
    },
  });
}

/** How many basket traits wait, directly or through a chain, on each basket trait. */
function dependentCounts(
  needs: ReadonlyMap<string, readonly DraftPrerequisiteNeed[]>,
): ReadonlyMap<string, number> {
  const dependents = new Map<string, Set<string>>();
  for (const [traitKey, traitNeeds] of needs)
    for (const option of traitNeeds.flat())
      for (const key of option.weights.keys())
        (dependents.get(key) ?? dependents.set(key, new Set()).get(key)!).add(traitKey);
  const counts = new Map<string, number>();
  for (const traitKey of needs.keys()) {
    const seen = new Set<string>();
    const stack = [...(dependents.get(traitKey) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (seen.has(next) || next === traitKey) continue;
      seen.add(next);
      stack.push(...(dependents.get(next) ?? []));
    }
    counts.set(traitKey, seen.size);
  }
  return counts;
}

/**
 * Traits that unlock more basket traits first, each placed once its needs can
 * be met by placed traits or traits outside the order; a need the basket
 * cannot meet never blocks. In a cycle the first pending trait is placed next.
 */
export function prerequisiteOrder(
  order: readonly string[],
  needs: ReadonlyMap<string, readonly DraftPrerequisiteNeed[]>,
): string[] {
  const counts = dependentCounts(needs);
  const pending = order
    .map((key, index) => ({ key, index }))
    .sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0) || a.index - b.index)
    .map((entry) => entry.key);
  const placed = new Set<string>();
  const counted = (key: string) => placed.has(key) || !order.includes(key);
  const result: string[] = [];
  while (pending.length > 0) {
    const ready = pending.findIndex((key) =>
      (needs.get(key) ?? []).every(
        (need) =>
          need.length === 0 || need.some((option) => total(option, counted) >= option.needed),
      ),
    );
    const [key] = pending.splice(ready < 0 ? 0 : ready, 1);
    placed.add(key!);
    result.push(key!);
  }
  return result;
}

/**
 * The earliest biome index by which every need can be met, given each member's
 * due biome; a member without one, or a need the basket cannot meet, is due last.
 */
export function prerequisiteDue(
  needs: readonly DraftPrerequisiteNeed[],
  dueOf: (traitKey: string) => number | undefined,
  last: number,
): number {
  let due = 0;
  for (const need of needs) {
    let needDue = last;
    for (const option of need) {
      const members = [...option.weights].sort(
        ([a], [b]) => (dueOf(a) ?? last) - (dueOf(b) ?? last),
      );
      let sum = 0;
      for (const [key, weight] of members) {
        sum += weight;
        if (sum >= option.needed) {
          needDue = Math.min(needDue, dueOf(key) ?? last);
          break;
        }
      }
    }
    due = Math.max(due, needDue);
  }
  return due;
}
