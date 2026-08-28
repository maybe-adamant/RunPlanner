import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type { DecisionRewardBagCount, RunStateSnapshot } from '@run-planner/engine/simulation';
import {
  artificerStatus,
  hexBaseCapacity,
  hexEffectiveCapacity,
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
  Object.freeze({ label: 'Spell', slotKey: 'Spell' }),
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
  equipped: RunStateSnapshot['traits']['equippedTraits'][string],
  steadyGrowth: RunStateSnapshot['traits']['steadyGrowth'],
) {
  const trait = catalog.traits.byKey[equipped.traitKey];
  return Object.freeze({
    label: trait?.label ?? equipped.traitKey,
    ...(equipped.rarity === undefined ? {} : { rarity: equipped.rarity }),
    ...(equipped.level === undefined ? {} : { level: equipped.level }),
    ...(equipped.hammerRank === undefined ? {} : { hammerRank: equipped.hammerRank }),
    ...(steadyGrowth?.[equipped.traitKey] === undefined
      ? {}
      : {
          steadyGrowthInterval: steadyGrowth[equipped.traitKey]!.interval,
          steadyGrowthProgress: steadyGrowth[equipped.traitKey]!.progress,
        }),
    traitKey: equipped.traitKey,
  });
}

function bagSection(
  catalog: Catalog,
  entries: RunStateSnapshot['bags'][number]['entries'],
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
  snapshot: RunStateSnapshot,
): WorkspaceRunStatePresentation {
  const coreTraitKeys = new Set(
    Object.values(snapshot.traits.equippedSlots).map(({ traitKey }) => traitKey),
  );
  const artificer = artificerStatus(catalog, snapshot.arcanaFear);
  const equippedSpell = snapshot.traits.equippedSlots.Spell;
  const hexBase = hexBaseCapacity(catalog, snapshot.hexProgress);
  const hexEffective = hexEffectiveCapacity(catalog, snapshot.hexProgress);
  return Object.freeze({
    hexProgress: Object.freeze({
      ...(equippedSpell === undefined
        ? {}
        : {
            baseSpellLabel:
              catalog.traits.byKey[equippedSpell.traitKey]?.label ?? equippedSpell.traitKey,
          }),
      ...(snapshot.hexProgress.spellTraitKey === undefined ||
      snapshot.hexProgress.tree === undefined
        ? {}
        : {
            layoutLabel:
              catalog.hexes.byKey[snapshot.hexProgress.spellTraitKey]?.layouts.byKey[
                snapshot.hexProgress.tree.layoutKey
              ]?.label ?? snapshot.hexProgress.tree.layoutKey,
          }),
      ...(hexBase === undefined
        ? {}
        : {
            baseCapacity: hexBase,
            ...(hexEffective === undefined ? {} : { effectiveCapacity: hexEffective }),
          }),
      godSentAdded: snapshot.hexProgress.godSentAdded === true,
      talentDropsClosed: snapshot.hexProgress.talentDropsClosed === true,
      bankedPathPoints: snapshot.hexProgress.bankedPathPoints,
      investedPathPoints: snapshot.hexProgress.investedPathPoints,
    }),
    keepsakes: Object.freeze({
      currentLabel:
        catalog.keepsakes.byKey[snapshot.keepsakes.currentKey]?.label ??
        snapshot.keepsakes.currentKey,
      chronology: Object.freeze(
        snapshot.keepsakes.history.map((entry) =>
          Object.freeze({
            biomeNumber: entry.biomeNumber,
            label: catalog.keepsakes.byKey[entry.key]?.label ?? entry.key,
          }),
        ),
      ),
      fatedStatus: snapshot.keepsakes.fatedStatus,
      pendingRewardPriorities: Object.freeze([...snapshot.rewardPriorities]),
      olympianSources: Object.freeze(
        snapshot.keepsakes.olympianSources.map((source) =>
          Object.freeze({
            providerKey: source.providerKey,
            providerLabel:
              catalog.traitGivers.byKey[source.providerKey]?.label ?? source.providerKey,
            origin: source.origin,
            forceRemaining: source.remainingForceUses,
            rarificationRemaining: source.remainingRarificationUses,
            maximumSourceRarityLevel: source.maximumSourceRarityLevel,
          }),
        ),
      ),
      jeweledPomStatus:
        snapshot.keepsakes.jeweledPom === undefined
          ? 'inactive'
          : snapshot.keepsakes.jeweledPom.active
            ? 'active'
            : 'invalidated',
      experimentalHammers: Object.freeze(
        snapshot.keepsakes.experimentalHammers.map((hammer) =>
          Object.freeze({
            status: hammer.active ? ('active' as const) : ('expired' as const),
            traitLabel: catalog.traits.byKey[hammer.traitKey]?.label ?? hammer.traitKey,
            remainingUses: hammer.remainingUses,
            acquisitionIdentity: hammer.acquisitionIdentity,
          }),
        ),
      ),
      ...(snapshot.keepsakes.transcendentEmbryo === undefined
        ? {}
        : {
            transcendentEmbryo: Object.freeze({
              origin: snapshot.keepsakes.transcendentEmbryo.origin,
              rarity: snapshot.keepsakes.transcendentEmbryo.rarity,
              progress: snapshot.keepsakes.transcendentEmbryo.progress,
              interval: 8,
              markedBlessingLabel:
                catalog.chaos.blessings.byKey[
                  snapshot.keepsakes.transcendentEmbryo.markedBlessingKey
                ]?.label ?? snapshot.keepsakes.transcendentEmbryo.markedBlessingKey,
              markedBlessingAcquisitionIdentity:
                snapshot.keepsakes.transcendentEmbryo.markedBlessingAcquisitionIdentity,
            }),
          }),
      ...(() => {
        const gift = snapshot.traits.equippedTraits.EchoRepeatKeepsakeBoon;
        const captured = gift?.echoRepeatedKeepsakeKey;
        const declaration = captured === undefined ? undefined : catalog.keepsakes.byKey[captured];
        if (
          gift === undefined ||
          captured === undefined ||
          declaration?.echoGift.availability !== 'eligible'
        )
          return {};
        const replayCount = gift.echoKeepsakeReplayCount ?? 0;
        const effect = declaration.echoGift.effect;
        return {
          echoGift: Object.freeze({
            capturedKeepsakeLabel: declaration.label,
            replayCount,
            status:
              effect.kind === 'modeledNeutral'
                ? ('effectNeutral' as const)
                : effect.schedule === 'everyBiome'
                  ? ('everyBiome' as const)
                  : replayCount > 0
                    ? ('oneShotApplied' as const)
                    : ('pending' as const),
          }),
        };
      })(),
      ...(snapshot.keepsakes.callingCard === undefined
        ? {}
        : { callingCardRemainingCharges: snapshot.keepsakes.callingCard.remainingCharges }),
      ...(snapshot.keepsakes.timePiece === undefined
        ? {}
        : { timePieceRemainingCharges: snapshot.keepsakes.timePiece.remainingCharges }),
      ...(snapshot.keepsakes.figLeaf === undefined
        ? {}
        : {
            figLeafRemainingUses: snapshot.keepsakes.figLeaf.remainingUses,
            figLeafActivatedThisBiome: snapshot.keepsakes.figLeaf.activatedThisBiome,
          }),
      ...(snapshot.keepsakes.gorgon === undefined
        ? {}
        : {
            gorgonStatus: snapshot.keepsakes.gorgon.status,
            ...(snapshot.keepsakes.gorgon.status === 'pending'
              ? { gorgonRarity: snapshot.keepsakes.gorgon.rarity }
              : {}),
          }),
      ...(snapshot.keepsakes.phial === undefined
        ? {}
        : { phialStatus: snapshot.keepsakes.phial.status }),
      ...(snapshot.keepsakes.figurine === undefined
        ? {}
        : {
            figurineStatus: snapshot.keepsakes.figurine.status,
            figurineOrigin: snapshot.keepsakes.figurine.origin,
            figurineRarity: snapshot.keepsakes.figurine.rarity,
          }),
      ...(snapshot.keepsakes.stone === undefined
        ? {}
        : {
            stoneStatus: snapshot.keepsakes.stone.status,
            stoneOrigin: snapshot.keepsakes.stone.origin,
            stoneRank: snapshot.keepsakes.stone.rank,
          }),
    }),
    arcana: Object.freeze(
      snapshot.arcanaFear.arcana.active.map((card) =>
        Object.freeze({
          key: card.key,
          label: catalog.arcanaCards.byKey[card.key]?.label ?? card.key,
          origin: card.origin,
          rarity: card.rarity,
        }),
      ),
    ),
    ...(artificer === undefined ? {} : { artificer }),
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
    fear: Object.freeze({
      configuredTotal: snapshot.arcanaFear.fear.configuredTotal,
      active: Object.freeze(
        catalog.fearVows.values.flatMap((vow) => {
          const rank = snapshot.arcanaFear.fear.effectiveRanks[vow.key] ?? 0;
          return rank > 0 ? [Object.freeze({ key: vow.key, label: vow.label, rank })] : [];
        }),
      ),
      disabled: Object.freeze(
        snapshot.arcanaFear.fear.disabledVowKeys.flatMap((key) => {
          const rank = snapshot.arcanaFear.fear.configuredRanks[key] ?? 0;
          return rank > 0
            ? [Object.freeze({ key, label: catalog.fearVows.byKey[key]?.label ?? key, rank })]
            : [];
        }),
      ),
      forfeitStatus: snapshot.forfeitStatus,
    }),
    traits: Object.freeze({
      ...(snapshot.traits.echoShopDuplicateStatus === undefined
        ? {}
        : { echoShopDuplicateStatus: snapshot.traits.echoShopDuplicateStatus }),
      ...(snapshot.traits.properUpbringingActive === undefined
        ? {}
        : { properUpbringingActive: true as const }),
      coreSlots: Object.freeze(
        coreTraitSlots.map(({ label, slotKey }) => {
          const equipped = snapshot.traits.equippedSlots[slotKey];
          return Object.freeze({
            label,
            slotKey,
            ...(equipped === undefined
              ? {}
              : { trait: traitPresentation(catalog, equipped, snapshot.traits.steadyGrowth) }),
          });
        }),
      ),
      other: Object.freeze(
        Object.values(snapshot.traits.equippedTraits)
          .filter(({ traitKey }) => !coreTraitKeys.has(traitKey))
          .map((equipped) => traitPresentation(catalog, equipped, snapshot.traits.steadyGrowth)),
      ),
      banned: Object.freeze(
        snapshot.traits.bannedTraitKeys.map((key) =>
          Object.freeze({ key, label: catalog.traits.byKey[key]?.label ?? key }),
        ),
      ),
    }),
  });
}
