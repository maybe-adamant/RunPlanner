import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type {
  DecisionRewardBagCount,
  DecisionRunStateSnapshot,
} from '@run-planner/engine/simulation';

import type {
  WorkspaceRunStateBagCondition,
  WorkspaceRunStateBagEntry,
  WorkspaceRunStateBagSection,
  WorkspaceRunStatePresentation,
  WorkspaceRunStateSource,
} from '../contract';
import { workspaceRewardStoreLabel } from '../assembly/reward-labels';

const coreTraitSlots = Object.freeze([
  Object.freeze({ label: 'Attack', slotKey: 'Melee' }),
  Object.freeze({ label: 'Special', slotKey: 'Secondary' }),
  Object.freeze({ label: 'Cast', slotKey: 'Ranged' }),
  Object.freeze({ label: 'Sprint', slotKey: 'Rush' }),
  Object.freeze({ label: 'Magick', slotKey: 'Mana' }),
] as const);

function count(value: DecisionRewardBagCount): string {
  return value.kind === 'exact' ? `x${value.count}` : `x${value.min}–${value.max}`;
}

function sumCounts(values: readonly DecisionRewardBagCount[]): string {
  const min = values.reduce(
    (total, value) => total + (value.kind === 'exact' ? value.count : value.min),
    0,
  );
  const max = values.reduce(
    (total, value) => total + (value.kind === 'exact' ? value.count : value.max),
    0,
  );
  return min === max ? `x${min}` : `x${min}–${max}`;
}

function rangeText(range: { readonly min?: number; readonly max?: number }): string {
  if (range.min !== undefined && range.max !== undefined) return `${range.min}–${range.max}`;
  if (range.min !== undefined) return `at least ${range.min}`;
  if (range.max !== undefined) return `at most ${range.max}`;
  return 'any value';
}

/**
 * Static requirement copy is a presentation of declaration evidence, never an
 * evaluation. Runtime satisfaction remains the engine-owned entry grouping.
 */
function requirementExplanation(requirement: RequirementExpression): string {
  switch (requirement.kind) {
    case 'all':
      return `Requires all of: ${requirement.requirements.map(requirementExplanation).join('; ')}`;
    case 'any':
      return `Requires one of: ${requirement.requirements.map(requirementExplanation).join('; ')}`;
    case 'not':
      return `Requires not: ${requirementExplanation(requirement.requirement)}`;
    case 'counterRange':
      return `Requires ${requirement.axis} ${rangeText(requirement.range)}.`;
    case 'recordCount':
      return `Requires ${requirement.record} count for ${requirement.keys.join(', ')} to be ${rangeText(requirement.range)}.`;
    case 'distinctRecordKeyCount':
      return `Requires distinct ${requirement.record} keys (${requirement.keys.join(', ')}) to be ${rangeText(requirement.range)}.`;
    case 'recentEnvelopeSlotCount':
      return `Requires ${requirement.envelopeKey}/${requirement.slotKey} within the last ${requirement.roomWindow} rooms to be ${rangeText(requirement.range)}.`;
    case 'encounterKeyCount':
      return `Requires ${requirement.scope} encounter count for ${requirement.encounterKeys.join(', ')} to be ${rangeText(requirement.range)}.`;
    case 'previousRoomEncounterKeyCount':
      return `Requires ${requirement.encounterKeys.join(', ')} in the previous ${requirement.roomWindow} rooms to be ${rangeText(requirement.range)}.`;
    case 'notInCurrentRoomShopOptions':
      return `Requires ${requirement.rewardType} not to be a current Shop option.`;
    case 'rewardLookupExcludes':
      return `Requires ${requirement.rewardType} to be excluded by ${requirement.lookupKey}.`;
    case 'minRoomsSinceEvent':
      return `Requires at least ${requirement.count} rooms since ${requirement.event}.`;
    case 'minExits':
      return `Requires at least ${requirement.count} exits.`;
    case 'currentRoomRewardExcludes':
      return `Requires the current room reward to exclude ${requirement.rewardTypes.join(', ')}.`;
    case 'currentRoomStructuralTagsInclude':
      return `Requires current-room tags: ${requirement.tags.join(', ')}.`;
    case 'currentBatchTargetCount':
      return `Requires current target count ${rangeText(requirement.range)}.`;
    case 'currentBatchRoomCount':
      return `Requires count of ${requirement.roomGameNames.join(', ')} in this batch to be ${rangeText(requirement.range)}.`;
    case 'clockworkGoalsRemaining':
      return `Requires Clockwork goals remaining ${rangeText(requirement.range)}.`;
    case 'clockworkNonGoalCapacity':
      return `Requires ${requirement.reserve} Clockwork non-goal capacity remaining.`;
    case 'flagEquals':
      return `Requires ${requirement.flag} to be ${requirement.value}.`;
    case 'authoredCondition':
      return `Requires ${requirement.condition} to be ${requirement.value}.`;
  }
}

function sourcePresentation(catalog: Catalog, sourceKey: string): WorkspaceRunStateSource {
  const source = catalog.rewards.rewardTypes.values.find(
    (rewardType) => rewardType.gameName === sourceKey,
  );
  return Object.freeze({ key: sourceKey, label: source?.label ?? sourceKey });
}

function traitPresentation(
  catalog: Catalog,
  equipped: DecisionRunStateSnapshot['traits']['equippedTraits'][string],
) {
  const trait = catalog.traits.byKey[equipped.traitKey];
  return Object.freeze({
    label: trait?.label ?? equipped.traitKey,
    ...(equipped.rarity === undefined ? {} : { rarity: equipped.rarity }),
    ...(equipped.hammerRank === undefined ? {} : { hammerRank: equipped.hammerRank }),
    traitKey: equipped.traitKey,
  });
}

function bagSection(
  catalog: Catalog,
  entries: DecisionRunStateSnapshot['bags'][number]['entries'],
  eligibility: 'eligible' | 'ineligible',
): WorkspaceRunStateBagSection {
  const selected = entries.filter((entry) => entry.eligibility === eligibility);
  const rows: WorkspaceRunStateBagEntry[] = selected.map((entry) =>
    Object.freeze({
      conditions: Object.freeze(
        entry.conditions.map((condition): WorkspaceRunStateBagCondition =>
          Object.freeze({
            count: count(condition.remaining),
            explanation:
              condition.requirement === undefined
                ? 'No additional condition.'
                : requirementExplanation(condition.requirement),
            technicalKey: condition.requirement?.kind ?? 'unconditional',
          }),
        ),
      ),
      count: count(entry.remaining),
      label: catalog.rewards.rewardTypes.byKey[entry.rewardType]?.label ?? entry.rewardType,
      technicalKey: entry.rewardType,
    }),
  );
  return Object.freeze({
    entries: Object.freeze(rows),
    total: sumCounts(selected.map((entry) => entry.remaining)),
  });
}

/** Presentation joins only: the engine has already evaluated all bag conditions. */
export function presentRunState(
  catalog: Catalog,
  snapshot: DecisionRunStateSnapshot,
): WorkspaceRunStatePresentation {
  const coreTraitKeys = new Set(
    Object.values(snapshot.traits.ordinaryBoonSlots).map(({ traitKey }) => traitKey),
  );
  return Object.freeze({
    bags: Object.freeze(
      snapshot.bags.map((bag) =>
        Object.freeze({
          eligible: bagSection(catalog, bag.entries, 'eligible'),
          ineligible: bagSection(catalog, bag.entries, 'ineligible'),
          label: workspaceRewardStoreLabel(bag.storeKey),
          remaining: count(bag.remaining),
          technicalKey: bag.storeKey,
        }),
      ),
    ),
    counters: Object.freeze(
      Object.entries(snapshot.counters)
        .filter(([, value]) => typeof value === 'number')
        .map(([key, value]) => Object.freeze({ key, value: value as number })),
    ),
    elements: Object.freeze(
      Object.entries(snapshot.traits.elementCounts).map(([key, value]) =>
        Object.freeze({ key, value }),
      ),
    ),
    godPool: Object.freeze({
      inPool: Object.freeze(
        snapshot.godPool.acquiredSourceKeys.map((key) => sourcePresentation(catalog, key)),
      ),
    }),
    traits: Object.freeze({
      ...(snapshot.traits.minimumScalableGodTraitRarity === undefined
        ? {}
        : { activeMinimumScalableRarity: snapshot.traits.minimumScalableGodTraitRarity }),
      coreSlots: Object.freeze(
        coreTraitSlots.map(({ label, slotKey }) => {
          const equipped = snapshot.traits.ordinaryBoonSlots[slotKey];
          return Object.freeze({
            label,
            slotKey,
            ...(equipped === undefined ? {} : { trait: traitPresentation(catalog, equipped) }),
          });
        }),
      ),
      other: Object.freeze(
        Object.values(snapshot.traits.equippedTraits)
          .filter(({ traitKey }) => !coreTraitKeys.has(traitKey))
          .map((equipped) => traitPresentation(catalog, equipped)),
      ),
    }),
  });
}
