import type { Catalog, InRunTraitRarity, KeepsakeRank } from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type {
  DecisionRewardBagCount,
  MaxStatSource,
  MaxStats,
  RunStateClock,
  RunStateEffectState,
  RunStateSnapshot,
  RunStateStatus,
} from '@run-planner/engine/simulation';
import { hexBaseCapacity, hexEffectiveCapacity } from '@run-planner/engine/simulation';

import { workspaceRewardStoreLabel } from '../assembly/reward-labels';
import type {
  WorkspaceRunStateBagCondition,
  WorkspaceRunStateBagEntry,
  WorkspaceRunStateBagSection,
  WorkspaceRunStatePresentation,
  WorkspaceRunStateRow,
  WorkspaceRunStateSection,
} from '../contracts/run-state';

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
    case 'encounterCompletionCount':
      return `Requires route completion count for ${requirement.encounterKeys.join(', ')} to be ${rangeText(requirement.range)}.`;
    case 'previousRoomEncounterKeyCount':
      return `Requires ${requirement.encounterKeys.join(', ')} in the previous ${requirement.roomWindow} rooms to be ${rangeText(requirement.range)}.`;
    case 'notInCurrentRoomShopOptions':
      return `Requires ${requirement.rewardType} not to be a current Shop option.`;
    case 'rewardLookupExcludes':
      return `Requires ${requirement.rewardType} to be excluded by ${requirement.lookupKey}.`;
    case 'offeredRewardExcludes':
      return `Requires the way into this room not to have offered ${requirement.rewardType}.`;
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
    case 'routeKeyEquals':
      return `Requires route ${requirement.routeKey}.`;
    case 'equippedAspectEquals':
      return `Requires equipped aspect ${requirement.aspectKey}.`;
  }
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

/** Where no door rolls, the biome's bankable keys say what it does instead of naming a dead target. */
function unrolledTargetLabel(bankableStoreKeys: readonly string[] | undefined): string {
  const only = bankableStoreKeys?.length === 1 ? bankableStoreKeys[0] : undefined;
  if (only !== undefined) return `This biome rolls only ${workspaceRewardStoreLabel(only)}.`;
  return bankableStoreKeys?.length === 0
    ? 'This biome ignores Reward Store.'
    : 'This biome rolls no base store.';
}

function rewardStoreSection(
  controller: RunStateSnapshot['rewardStoreController'],
): WorkspaceRunStateSection {
  // Three decimals on both ratios so a reading lines up with the declared target digit for digit.
  return section(
    'reward-store',
    'Reward Store Ratio',
    [
      row('entered', 'Entered stores', {
        right: `${controller.enteredStoreCount} entered, ${controller.enteredMetaStoreCount} ${workspaceRewardStoreLabel('MetaProgress')}`,
      }),
      row('ratio', 'Current ratio', {
        right:
          controller.currentMetaRatio === null
            ? 'None counted yet'
            : controller.currentMetaRatio.toFixed(3),
      }),
      row('target', 'Biome target', {
        right:
          controller.targetMetaRewardsRatio === undefined
            ? unrolledTargetLabel(controller.bankableStoreKeys)
            : controller.targetMetaRewardsRatio.toFixed(3),
      }),
    ],
    'Every counted room entered so far this run. A door rolls Minor Reward with chance 11 × target − 10 × ratio.',
  );
}

function maxStatSourceLabel(catalog: Catalog, source: MaxStatSource): string {
  switch (source.kind) {
    case 'base':
      return 'Base';
    case 'pickups':
      return 'Pickups';
    case 'aspect':
      return catalog.aspects.byKey[source.key]?.label ?? source.key;
    case 'familiar':
      return catalog.familiars.byKey[source.key]?.label ?? source.key;
    case 'arcana':
      return catalog.arcanaCards.byKey[source.key]?.label ?? source.key;
    case 'keepsake':
      return catalog.keepsakes.byKey[source.key]?.label ?? source.key;
    case 'trait':
      return catalog.traits.byKey[source.key]?.label ?? source.key;
    case 'chaos':
      return (
        catalog.chaos.blessings.byKey[source.key]?.label ??
        catalog.chaos.curses.byKey[source.key]?.label ??
        source.key
      );
  }
}

function signedAmount(value: number): string | undefined {
  if (value === 0) return undefined;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return value > 0 ? `+${text}` : text;
}

function healthAndMagick(health: string | undefined, magick: string | undefined): string {
  return [
    health === undefined ? undefined : `${health} health`,
    magick === undefined ? undefined : `${magick} Magick`,
  ]
    .filter((part) => part !== undefined)
    .join(' · ');
}

function maxStatsPresentation(
  catalog: Catalog,
  stats: MaxStats,
): WorkspaceRunStatePresentation['maxStats'] {
  const multiplier = (value: number) => (value === 1 ? undefined : `×${value.toFixed(2)}`);
  const healthMultiplier = multiplier(stats.multipliers.maxHealth);
  const magickMultiplier = multiplier(stats.multipliers.maxMana);
  const converted = signedAmount(stats.convertedHealth);
  const cap = stats.maxHealthCap;
  return Object.freeze({
    rows: Object.freeze([
      row('max-health', 'Max Health', {
        ...(cap === undefined
          ? {}
          : { bracket: `(Fixed by ${keepsakeLabel(catalog, cap.keepsakeKey)})` }),
        right: `${stats.maxHealth}`,
      }),
      row('max-magick', 'Max Magick', { right: `${stats.maxMana}` }),
    ]),
    sources: Object.freeze([
      ...stats.flat.map((entry) =>
        row(
          entry.source.kind === 'base' || entry.source.kind === 'pickups'
            ? entry.source.kind
            : `${entry.source.kind}:${entry.source.key}`,
          maxStatSourceLabel(catalog, entry.source),
          { right: healthAndMagick(signedAmount(entry.maxHealth), signedAmount(entry.maxMana)) },
        ),
      ),
      ...(converted === undefined
        ? []
        : [row('converted', 'From Magick', { right: healthAndMagick(converted, undefined) })]),
      ...(healthMultiplier === undefined && magickMultiplier === undefined
        ? []
        : [
            row('multipliers', 'Multipliers', {
              right: healthAndMagick(healthMultiplier, magickMultiplier),
            }),
          ]),
    ]),
  });
}

const slotBoonKeys = Object.freeze(['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const);

const keepsakeStars: Readonly<Record<KeepsakeRank, string>> = Object.freeze({
  Common: '★',
  Rare: '★★',
  Epic: '★★★',
  Heroic: '★★★★',
});

const arcanaRanks: Readonly<Record<InRunTraitRarity, string>> = Object.freeze({
  Common: 'Rank I',
  Rare: 'Rank II',
  Epic: 'Rank III',
  Heroic: 'Rank IV',
});

function roman(value: number): string {
  const numerals = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ] as const;
  let rest = value;
  let text = '';
  for (const [amount, numeral] of numerals) {
    while (rest >= amount) {
      text += numeral;
      rest -= amount;
    }
  }
  return text;
}

const singularUnits: Readonly<Record<RunStateClock['unit'], string>> = Object.freeze({
  charges: 'charge',
  uses: 'use',
  encounters: 'encounter',
  rooms: 'room',
  guardians: 'guardian',
  boons: 'boon',
});

function countText(value: number, unit: RunStateClock['unit']): string {
  return `${value} ${value === 1 ? singularUnits[unit] : unit}`;
}

/** A countdown shows only what is left; a build-up shows progress toward its total. */
function clockBracket(clock: RunStateClock): string {
  return clock.direction === 'progress'
    ? `(${clock.value}/${clock.total} ${clock.unit})`
    : `(${countText(clock.value, clock.unit)})`;
}

const statusLabels: Readonly<Record<RunStateStatus, string>> = Object.freeze({
  active: 'Active',
  inactive: 'Inactive',
  ready: 'Ready',
  used: 'Used',
  pending: 'Pending',
});

function effectBracket(state: RunStateEffectState): string {
  switch (state.kind) {
    case 'clock':
      return clockBracket(state.clock);
    case 'status':
      return `(${statusLabels[state.status]})`;
    case 'bonus':
      return percentBracket(state.fraction, true);
    case 'elementCount':
      return `(${state.element} ${state.count})`;
  }
}

function percentBracket(fraction: number, signed: boolean): string {
  const percent = Math.round(fraction * 1000) / 10;
  return `(${signed && percent > 0 ? '+' : ''}${percent}%)`;
}

function row(
  key: string,
  name: string,
  parts: { readonly bracket?: string; readonly tag?: string; readonly right?: string } = {},
): WorkspaceRunStateRow {
  return Object.freeze({
    key,
    name,
    ...(parts.bracket === undefined ? {} : { bracket: parts.bracket }),
    ...(parts.tag === undefined ? {} : { tag: parts.tag }),
    ...(parts.right === undefined || parts.right === '' ? {} : { right: parts.right }),
  });
}

function sections(
  ...candidates: readonly (WorkspaceRunStateSection | undefined)[]
): readonly WorkspaceRunStateSection[] {
  return Object.freeze(
    candidates.filter(
      (section): section is WorkspaceRunStateSection =>
        section !== undefined && section.rows.length > 0,
    ),
  );
}

function section(
  key: string,
  heading: string | undefined,
  rows: readonly WorkspaceRunStateRow[],
  note?: string,
): WorkspaceRunStateSection {
  return Object.freeze({
    key,
    ...(heading === undefined ? {} : { heading }),
    ...(note === undefined ? {} : { note }),
    rows: Object.freeze([...rows]),
  });
}

function traitLabel(catalog: Catalog, traitKey: string): string {
  return catalog.traits.byKey[traitKey]?.label ?? traitKey;
}

function keepsakeLabel(catalog: Catalog, key: string): string {
  return catalog.keepsakes.byKey[key]?.label ?? key;
}

function biomeLabel(catalog: Catalog, key: string | undefined): string {
  return key === undefined ? '' : (catalog.biomes.byKey[key]?.label ?? key);
}

function wellItemLabel(catalog: Catalog, itemKey: string): string {
  return (
    catalog.rewards.shops.byKey.RoomShop?.groups.values
      .flatMap((group) => group.options.values)
      .find((option) => option.key === itemKey)?.label ?? itemKey
  );
}

/** `Rarity · Lv. N`, or `Rank II` for an upgraded Hammer; each part only when it applies. */
function traitRight(equipped: RunStateSnapshot['traits']['equippedTraits'][string]): string {
  if (equipped.hammerRank !== undefined) return equipped.hammerRank === 'RankII' ? 'Rank II' : '';
  return [equipped.rarity, equipped.level === undefined ? undefined : `Lv. ${equipped.level}`]
    .filter((part) => part !== undefined)
    .join(' · ');
}

function traitRow(catalog: Catalog, snapshot: RunStateSnapshot, traitKey: string) {
  const equipped = snapshot.traits.equippedTraits[traitKey];
  if (equipped === undefined) return undefined;
  const state = snapshot.effects.traitStates[traitKey];
  const decay = equipped.roomDecay;
  return row(`trait:${traitKey}`, traitLabel(catalog, traitKey), {
    ...(state !== undefined
      ? { bracket: effectBracket(state) }
      : decay !== undefined
        ? { bracket: percentBracket(decay.fraction, false) }
        : {}),
    right: traitRight(equipped),
  });
}

function hexTalentLabel(catalog: Catalog, snapshot: RunStateSnapshot, talentKey: string): string {
  const spellKey = snapshot.hexProgress.spellTraitKey;
  const hex = spellKey === undefined ? undefined : catalog.hexes.byKey[spellKey];
  if (hex === undefined) return talentKey;
  if (hex.godSent.olympianTalentKey === talentKey) return hex.godSent.olympianTalentLabel;
  if (hex.godSent.lineageTalentKey === talentKey) return hex.godSent.lineageTalentLabel;
  return (
    hex.rareCandidates.byKey[talentKey]?.label ??
    hex.epicCandidates.byKey[talentKey]?.label ??
    hex.repeatableCandidates.byKey[talentKey]?.label ??
    talentKey
  );
}

const aspectRanks = Object.freeze({ 5: 'Rank V', 6: 'Rank VI' } as const);

function loadoutRows(
  catalog: Catalog,
  snapshot: RunStateSnapshot,
): readonly WorkspaceRunStateRow[] {
  const { aspect, familiarKey } = snapshot.effects;
  return Object.freeze([
    ...(aspect === undefined
      ? []
      : [
          row('aspect', catalog.aspects.byKey[aspect.aspectKey]?.label ?? aspect.aspectKey, {
            right: aspectRanks[aspect.rank],
          }),
        ]),
    ...(familiarKey === undefined
      ? []
      : [row('familiar', catalog.familiars.byKey[familiarKey]?.label ?? familiarKey)]),
  ]);
}

function overviewSections(
  catalog: Catalog,
  snapshot: RunStateSnapshot,
): readonly WorkspaceRunStateSection[] {
  const slotRows = slotBoonKeys.flatMap((slotKey) => {
    const equipped = snapshot.traits.equippedSlots[slotKey];
    const traitRowValue =
      equipped === undefined ? undefined : traitRow(catalog, snapshot, equipped.traitKey);
    return traitRowValue === undefined ? [] : [traitRowValue];
  });
  const otherRows = snapshot.effects.traitEntries.flatMap((entry) => {
    switch (entry.kind) {
      case 'trait': {
        const traitRowValue = traitRow(catalog, snapshot, entry.traitKey);
        return traitRowValue === undefined ? [] : [traitRowValue];
      }
      case 'consumedTrait':
        return [
          row(`consumed:${entry.acquisitionIdentity}`, traitLabel(catalog, entry.traitKey), {
            bracket: '(Consumed)',
          }),
        ];
      case 'chaosBlessing':
        return [
          row(
            `blessing:${entry.acquisitionIdentity}`,
            catalog.chaos.blessings.byKey[entry.blessingKey]?.label ?? entry.blessingKey,
            { right: entry.rarity },
          ),
        ];
    }
  });
  const spell = snapshot.traits.equippedSlots.Spell;
  const hexRows = [
    ...(spell === undefined
      ? []
      : [row(`hex:${spell.traitKey}`, traitLabel(catalog, spell.traitKey))]),
    ...snapshot.effects.hexTalents.map((talent) =>
      row(`talent:${talent.talentKey}`, hexTalentLabel(catalog, snapshot, talent.talentKey), {
        right: `Lv. ${talent.level}`,
      }),
    ),
  ];
  const elements = Object.entries(snapshot.traits.elementCounts)
    .filter(([, value]) => value > 0)
    .sort(([, left], [, right]) => right - left)
    .map(([key, value]) => `${key} ${value}`)
    .join(' · ');
  const keepsakeRows = snapshot.effects.keepsakes.map((keepsake) =>
    row(`keepsake:${keepsake.keepsakeKey}`, keepsakeLabel(catalog, keepsake.keepsakeKey), {
      ...(keepsake.state === undefined ? {} : { bracket: effectBracket(keepsake.state) }),
      ...(keepsake.rank === undefined ? {} : { right: keepsakeStars[keepsake.rank] }),
    }),
  );
  return sections(
    section('keepsake', 'Keepsake', keepsakeRows),
    section('elements', 'Elements', elements === '' ? [] : [row('elements', elements)]),
    section('traits', 'Traits', [...slotRows, ...otherRows]),
    section('hex', 'Hex', hexRows),
  );
}

function effectSections(
  catalog: Catalog,
  snapshot: RunStateSnapshot,
): readonly WorkspaceRunStateSection[] {
  const wellRows = snapshot.effects.stygianWell.map((entry, index) =>
    row(`well:${index}:${entry.itemKey}`, wellItemLabel(catalog, entry.itemKey), {
      bracket: clockBracket(entry.clock),
    }),
  );
  const shrineRows = snapshot.effects.hermesDeliveries.map((delivery) =>
    row(
      `shrine:${delivery.entryKey}`,
      catalog.rewards.rewardTypes.byKey[delivery.rewardType]?.label ?? delivery.rewardType,
      { bracket: clockBracket(delivery.clock) },
    ),
  );
  const chaosRows = snapshot.effects.chaosCurses.map((curse, index) =>
    row(
      `chaos:${index}:${curse.curseKey}`,
      `${catalog.chaos.curses.byKey[curse.curseKey]?.label ?? curse.curseKey} → ${
        catalog.chaos.blessings.byKey[curse.blessingKey]?.label ?? curse.blessingKey
      }`,
      { bracket: clockBracket(curse.clock), right: curse.rarity },
    ),
  );
  return sections(
    section('well', 'Well', wellRows),
    section('shrine', 'Shrine', shrineRows),
    section('chaos', 'Chaos', chaosRows),
  );
}

/** One row per entered biome with its keepsake; a postboss swap reads `old → new`. */
function keepsakeHistorySections(
  catalog: Catalog,
  snapshot: RunStateSnapshot,
): readonly WorkspaceRunStateSection[] {
  const keepsakes = snapshot.keepsakes;
  const biomeRows = snapshot.effects.keepsakeHistory.map((entry, index) =>
    row(
      `biome:${index + 1}`,
      `${biomeLabel(catalog, entry.biomeKey)} · ${entry.keepsakeKeys
        .map((key) => keepsakeLabel(catalog, key))
        .join(' → ')}`,
    ),
  );
  const keptRows = (keepsakes.retained ?? []).map((entry) =>
    row(`kept:${entry.key}`, keepsakeLabel(catalog, entry.key), {
      right: keepsakeStars[entry.rank],
    }),
  );
  return sections(
    section('history', undefined, biomeRows),
    section('kept', 'Kept', keptRows),
    section(
      'fated',
      undefined,
      keepsakes.fatedStatus === 'Unknown' ? [] : [row('fated', keepsakes.fatedStatus)],
    ),
  );
}

function arcanaSections(
  catalog: Catalog,
  snapshot: RunStateSnapshot,
): readonly WorkspaceRunStateSection[] {
  const cardLabel = (key: string) => catalog.arcanaCards.byKey[key]?.label ?? key;
  const active = snapshot.arcanaFear.arcana.active;
  const equipped = active
    .filter((card) => card.origin !== 'temporary')
    .map((card) => {
      const clock = snapshot.effects.arcanaClocks[card.key];
      return row(`arcana:${card.key}`, cardLabel(card.key), {
        ...(clock === undefined ? {} : { bracket: clockBracket(clock) }),
        ...(card.origin === 'automatic' ? { tag: 'Automatic' } : {}),
        right: arcanaRanks[card.rarity],
      });
    });
  const temporary = active
    .filter((card) => card.origin === 'temporary')
    .map((card) => {
      const clock = snapshot.effects.arcanaClocks[card.key];
      return row(`temporary:${card.key}`, cardLabel(card.key), {
        ...(clock === undefined ? {} : { bracket: clockBracket(clock) }),
        right: arcanaRanks[card.rarity],
      });
    });
  const barren =
    snapshot.effects.arcanaBarren === undefined
      ? []
      : [row('barren', 'Barren', { bracket: clockBracket(snapshot.effects.arcanaBarren) })];
  return sections(
    section('equipped', undefined, equipped),
    section('temporary', 'Temporary', temporary),
    section('barren', 'Run effects', barren),
  );
}

function fearSections(
  catalog: Catalog,
  snapshot: RunStateSnapshot,
): readonly WorkspaceRunStateSection[] {
  const fear = snapshot.arcanaFear.fear;
  const vows = catalog.fearVows.values.flatMap((vow) => {
    const rank = fear.effectiveRanks[vow.key] ?? 0;
    return rank > 0 ? [row(`vow:${vow.key}`, vow.label, { right: `Rank ${roman(rank)}` })] : [];
  });
  const forfeit =
    snapshot.forfeitStatus === 'inactive'
      ? []
      : [
          row('forfeit', 'Forfeit', {
            right: snapshot.forfeitStatus === 'consumed' ? 'Used' : 'Unused',
          }),
        ];
  const disabled = fear.disabledVowKeys.flatMap((key) => {
    const rank = fear.configuredRanks[key] ?? 0;
    return rank > 0
      ? [
          row(`disabled:${key}`, catalog.fearVows.byKey[key]?.label ?? key, {
            right: `Rank ${roman(rank)}`,
          }),
        ]
      : [];
  });
  const banned = snapshot.traits.bannedTraitKeys.map((key) =>
    row(`banned:${key}`, traitLabel(catalog, key)),
  );
  return sections(
    section('vows', undefined, vows),
    section('forfeit', 'Effects', forfeit),
    section('disabled', 'Disabled by Circe', disabled),
    section('banned', 'Banned', banned),
  );
}

function moreInfoSections(
  catalog: Catalog,
  snapshot: RunStateSnapshot,
): readonly WorkspaceRunStateSection[] {
  const hex = snapshot.hexProgress;
  const spell = snapshot.traits.equippedSlots.Spell;
  const base = hexBaseCapacity(catalog, hex);
  const effective = hexEffectiveCapacity(catalog, hex);
  const layout =
    hex.spellTraitKey === undefined || hex.tree === undefined
      ? undefined
      : (catalog.hexes.byKey[hex.spellTraitKey]?.layouts.byKey[hex.tree.layoutKey]?.label ??
        hex.tree.layoutKey);
  // Moon Beam banks Path points before any Hex is equipped.
  const pathRows =
    spell === undefined && hex.bankedPathPoints === 0
      ? []
      : [
          row('hex-banked', 'Path points banked', { right: `${hex.bankedPathPoints}` }),
          row('hex-invested', 'Path points invested', { right: `${hex.investedNodeKeys.length}` }),
        ];
  const hexRows = [
    ...(spell === undefined
      ? []
      : [
          ...(layout === undefined ? [] : [row('hex-layout', 'Layout', { right: layout })]),
          ...(base === undefined
            ? []
            : [
                row('hex-capacity', 'Capacity', {
                  right:
                    effective === undefined || effective === base
                      ? `${base}`
                      : `${base} → ${effective}`,
                }),
              ]),
          row('hex-god-sent', 'God Sent', {
            right: hex.godSentAdded === true ? 'Added' : 'Not added',
          }),
        ]),
    ...pathRows,
  ];
  const gods = snapshot.godPool.acquiredSourceKeys
    .map(
      (key) =>
        catalog.rewards.rewardTypes.values.find((rewardType) => rewardType.gameName === key)
          ?.label ?? key,
    )
    .join(' · ');
  return sections(
    section('gods', 'Gods in pool', gods === '' ? [] : [row('gods', gods)]),
    section('hex', 'Hex', hexRows),
    rewardStoreSection(snapshot.rewardStoreController),
    section(
      'counters',
      'Counters',
      Object.entries(snapshot.counters).flatMap(([key, value]) =>
        typeof value === 'number' ? [row(`counter:${key}`, key, { right: `${value}` })] : [],
      ),
    ),
  );
}

/** Presentation joins only: the engine has already folded every clock and evaluated every bag. */
export function presentRunState(
  catalog: Catalog,
  snapshot: RunStateSnapshot,
  momentLead: string,
): WorkspaceRunStatePresentation {
  return Object.freeze({
    moment: `${momentLead} · ${biomeLabel(catalog, snapshot.biomeKey)}`,
    loadout: loadoutRows(catalog, snapshot),
    maxStats: maxStatsPresentation(catalog, snapshot.maxStats),
    overview: overviewSections(catalog, snapshot),
    effects: effectSections(catalog, snapshot),
    keepsakes: keepsakeHistorySections(catalog, snapshot),
    arcana: arcanaSections(catalog, snapshot),
    fear: fearSections(catalog, snapshot),
    moreInfo: Object.freeze({
      sections: moreInfoSections(catalog, snapshot),
      bags: Object.freeze(
        snapshot.bags.map((bag) => {
          const eligible = bagSection(catalog, bag.entries, 'eligible');
          const ineligible = bagSection(catalog, bag.entries, 'ineligible');
          return Object.freeze({
            eligible,
            ineligible,
            label: workspaceRewardStoreLabel(bag.storeKey),
            rows: Object.freeze([
              row('remaining', 'Remaining', { right: count(bag.remaining) }),
              row('eligible', 'Eligible', { right: eligible.total }),
              row('ineligible', 'Ineligible', { right: ineligible.total }),
            ]),
            technicalKey: bag.storeKey,
          });
        }),
      ),
    }),
  });
}
