import { catalog } from '@run-planner/hades2-catalog';
import {
  assessTraitOption,
  assessTraitOffer,
  boonRarityFactsForOffer,
  assessTraitOfferComposition,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  traitCandidates,
  recordReachedTraitOffer,
  traitOfferStartingOutcome,
  evaluateReachedTraitOffer,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import type { AuthoredTraitOffer } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';

const owner = { kind: 'project' } as const;

function history(entries: readonly [string, string, string][]) {
  return foldTraitHistoryEvents(
    catalog,
    entries.map(([giverKey, traitKey, rarity], index) => {
      const giver = catalog.traitGivers.byKey[giverKey]!;
      return {
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: `seed${index}`,
        sequence: index,
        giverKey,
        options: Object.freeze([
          { traitKey, rarity },
          { traitKey: giver.traitKeys[1]! },
          { traitKey: giver.traitKeys[2]! },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
      };
    }),
  );
}

function offer(
  giverKey: string,
  options: Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
): Extract<AuthoredTraitOffer, { kind: 'traits' }> {
  return Object.freeze({ kind: 'traits', giverKey, options, selectedOptionKey: 'option1' });
}

function narrowApolloCatalog() {
  const giver = catalog.traitGivers.byKey.Apollo;
  if (giver === undefined) throw new Error('Apollo giver is missing');
  const traitKeys = ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon'] as const;
  const narrowed = Object.freeze({
    ...giver,
    traitKeys: Object.freeze([...traitKeys]),
    priorityTraitKeys: Object.freeze([...traitKeys]),
  });
  return Object.freeze({
    ...catalog,
    traitGivers: Object.freeze({
      ...catalog.traitGivers,
      values: Object.freeze(
        catalog.traitGivers.values.map((candidate) =>
          candidate.key === 'Apollo' ? narrowed : candidate,
        ),
      ),
      byKey: Object.freeze({ ...catalog.traitGivers.byKey, Apollo: narrowed }),
    }),
  });
}

function exhaustedApolloCatalog() {
  const narrowed = narrowApolloCatalog();
  const giver = narrowed.traitGivers.byKey.Apollo!;
  const exhausted = Object.freeze({
    ...giver,
    traitKeys: Object.freeze([]),
    priorityTraitKeys: Object.freeze([]),
  });
  return Object.freeze({
    ...narrowed,
    traitGivers: Object.freeze({
      ...narrowed.traitGivers,
      values: Object.freeze(
        narrowed.traitGivers.values.map((candidate) =>
          candidate.key === 'Apollo' ? exhausted : candidate,
        ),
      ),
      byKey: Object.freeze({ ...narrowed.traitGivers.byKey, Apollo: exhausted }),
    }),
  });
}

function narrowHeraDraftCatalog() {
  const giver = catalog.traitGivers.byKey.Hera!;
  const traitKeys = ['BoonDecayBoon', 'BoonGrowthBoon'] as const;
  const narrowed = Object.freeze({
    ...giver,
    traitKeys: Object.freeze([...traitKeys]),
    priorityTraitKeys: Object.freeze([...traitKeys]),
  });
  return Object.freeze({
    ...catalog,
    traitGivers: Object.freeze({
      ...catalog.traitGivers,
      values: Object.freeze(
        catalog.traitGivers.values.map((candidate) =>
          candidate.key === 'Hera' ? narrowed : candidate,
        ),
      ),
      byKey: Object.freeze({ ...catalog.traitGivers.byKey, Hera: narrowed }),
    }),
  });
}

function historyFor(testCatalog: typeof catalog, entries: readonly [string, string, string][]) {
  return foldTraitHistoryEvents(
    testCatalog,
    entries.map(([giverKey, traitKey, rarity], index) => {
      const giver = testCatalog.traitGivers.byKey[giverKey]!;
      return {
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: `seed${index}`,
        sequence: index,
        giverKey,
        options: Object.freeze([
          { traitKey, rarity },
          { traitKey: giver.traitKeys[1]! },
          { traitKey: giver.traitKeys[2]! },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
      };
    }),
  );
}

describe('derived Olympian trait replacement', () => {
  it('applies Hymn’s level bonus to every displayed replacement alternative', () => {
    const testCatalog = narrowApolloCatalog();
    const before = historyFor(testCatalog, [
      ['Zeus', 'ZeusWeaponBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Rare'],
      ['Zeus', 'ZeusCastBoon', 'Epic'],
    ]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Epic' },
        { traitKey: 'ApolloCastBoon', rarity: 'Heroic' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    expect(
      assessTraitOffer(testCatalog, value, before, { limitedSwapUses: 1 }).map(
        (assessment) => assessment.replacementTransition?.levelBonus,
      ),
    ).toEqual([2, 2, 2]);
    for (const options of [value.options, [...value.options].reverse()]) {
      const initial = initializeTestRewardBranches()[0]!;
      const settlement = settleEncounterTraitOffer(
        testCatalog,
        {
          ...initial,
          state: Object.freeze({
            ...initial.state,
            traitHistory: before,
            stygianWell: { ...initial.state.stygianWell, hymnUses: 2 },
          }),
        },
        owner,
        {
          ...value,
          options: options as typeof value.options,
          selectedOptionKey: 'option2',
        },
        4,
        'encounterCompleted',
      );
      expect(settlement.branch.state.stygianWell.hymnUses).toBe(1);
      expect(settlement.branch.state.traitHistory?.equippedTraits.ApolloSpecialBoon).toMatchObject({
        rarity: 'Epic',
        level: 3,
      });
      expect(settlement.branch.state.traitHistory?.equippedTraits.ZeusSpecialBoon).toBeUndefined();
    }
  });

  it('publishes a reached valid fallback without recording an event or mutating history', () => {
    const testCatalog = exhaustedApolloCatalog();
    const before = createTraitHistoryState();
    const evaluation = evaluateReachedTraitOffer(
      testCatalog,
      owner,
      'source',
      Object.freeze({ kind: 'fallbackGold', giverKey: 'Apollo' }),
      before,
      {},
      4,
    );
    expect(evaluation.reached).toBe(true);
    expect(evaluation.composition.legal).toBe(true);
    expect(evaluation.generation?.legal).toBe(true);
    expect(evaluation.assessments).toEqual([]);

    const recorded = recordReachedTraitOffer(testCatalog, evaluation, 4, 'test');
    expect(recorded.event).toBeUndefined();
    expect(recorded.history).toBe(before);
    expect(recorded.history.events).toEqual([]);
    expect(recorded.history.equippedTraits).toEqual({});
  });

  it('retains Hymn when an individually valid replacement belongs to an invalid screen', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const value = offer('Apollo', [
      { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
    ]);
    const initial = initializeTestRewardBranches()[0]!;
    const settled = settleEncounterTraitOffer(
      catalog,
      {
        ...initial,
        state: Object.freeze({
          ...initial.state,
          traitHistory: before,
          stygianWell: { ...initial.state.stygianWell, hymnUses: 1 },
        }),
      },
      owner,
      value,
      2,
      'encounterCompleted',
    );
    const evaluation = settled.branch.traitEvaluations?.at(-1);
    expect(evaluation?.assessments[0]?.replacementTransition).toBeDefined();
    expect(evaluation?.generation?.legal).toBe(false);
    expect(settled.branch.state.traitHistory?.events).toEqual(before.events);
    expect(settled.branch.state.stygianWell.hymnUses).toBe(1);
  });

  it('retains a mandatory targeted ordinary trait in an unselected sparse row', () => {
    const testCatalog = narrowHeraDraftCatalog();
    const before = historyFor(testCatalog, [['Hephaestus', 'HephaestusWeaponBoon', 'Common']]);
    const draft = traitOfferStartingOutcome(testCatalog, 'Hera', before);
    if (draft?.kind !== 'traits') throw new Error('expected a Hera trait draft');
    expect(draft?.options.map((option) => option.traitKey)).toEqual(
      expect.arrayContaining(['BoonDecayBoon', 'BoonGrowthBoon']),
    );
    expect(draft.options[Number(draft.selectedOptionKey.slice(-1)) - 1]?.traitKey).not.toBe(
      'BoonDecayBoon',
    );
    expect(
      evaluateReachedTraitOffer(testCatalog, owner, 'source', draft, before, {}, 1).generation
        ?.legal,
    ).toBe(true);
  });

  it.each([
    ['Common', 'Rare'],
    ['Rare', 'Epic'],
    ['Epic', 'Heroic'],
  ] as const)('promotes %s occupants exactly to %s', (oldRarity, requiredRarity) => {
    const before = history([['Zeus', 'ZeusWeaponBoon', oldRarity]]);
    const assessment = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      before,
      { resolvedProviderKey: 'Apollo' },
      requiredRarity,
    );
    expect(assessment.legal).toBe(true);
    expect(assessment.replacementTransition).toEqual({
      slot: 'Melee',
      replacedTraitKey: 'ZeusWeaponBoon',
      oldRarity,
      newTraitKey: 'ApolloWeaponBoon',
      requiredRarity,
    });
  });

  it('preserves exact replacement promotion under a fresh-rarity override', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const context = { resolvedProviderKey: 'Apollo', freshRarityOverride: 'Common' as const };
    const replacement = assessTraitOption(catalog, 'ApolloWeaponBoon', before, context, 'Rare');
    expect(replacement.legal).toBe(true);
    expect(replacement.replacementTransition?.requiredRarity).toBe('Rare');

    const mixed = offer('Apollo', [
      { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
      { traitKey: 'ApolloCastBoon', rarity: 'Common' },
    ]);
    expect(
      evaluateReachedTraitOffer(catalog, owner, 'source', mixed, before, context, 1).generation
        ?.legal,
    ).toBe(false);
  });

  it('preserves promoted rarity when fresh Epic is guaranteed', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const facts = boonRarityFactsForOffer(catalog, before, {
      resolvedProviderKey: 'Apollo',
      boonRarityRoomOverride: catalog.rooms.byKey.Q_MiniBoss02!.boonRarityOverride!,
      temporaryBoonRarityUses: 1,
    })!;
    const context = {
      resolvedProviderKey: 'Apollo',
      boonRarityFacts: {
        ...facts,
        contributions: [
          ...facts.contributions,
          catalog.arcanaCards.byKey.EpicRarityBoost!.boonRarityContributions!.Rare,
        ],
      },
    };
    const replacement = assessTraitOption(catalog, 'ApolloWeaponBoon', before, context, 'Rare');
    expect(replacement).toMatchObject({
      legal: true,
      findings: [],
      replacementTransition: {
        replacedTraitKey: 'ZeusWeaponBoon',
        oldRarity: 'Common',
        requiredRarity: 'Rare',
      },
    });

    const candidates = traitCandidates(catalog, 'Apollo', before, context);
    expect(
      candidates.filter(
        (candidate) => candidate.traitKey === 'ApolloWeaponBoon' && candidate.available,
      ),
    ).toEqual([expect.objectContaining({ rarity: 'Rare', assessment: replacement })]);
    expect(
      assessTraitOption(catalog, 'ApolloWeaponBoon', before, context, 'Epic').findings,
    ).toContainEqual({
      code: 'replacementRarityMismatch',
      traitKey: 'ApolloWeaponBoon',
      detail: 'Rare:Epic',
    });
    const invalid = offer('Apollo', [
      { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
      { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
      { traitKey: 'ApolloCastBoon', rarity: 'Epic' },
    ]);
    expect(
      evaluateReachedTraitOffer(catalog, owner, 'source', invalid, before, context, 1).generation
        ?.legal,
    ).toBe(false);

    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer('Apollo', [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Epic' },
        { traitKey: 'ApolloCastBoon', rarity: 'Epic' },
      ]),
      before,
      context,
      1,
    );
    const applied = recordReachedTraitOffer(catalog, evaluation, 2, 'test');
    expect(applied.event?.replacementTransition?.requiredRarity).toBe('Rare');
    expect(applied.history.equippedTraits.ZeusWeaponBoon).toBeUndefined();
    expect(applied.history.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Rare');
  });

  it('rejects Heroic occupants and wrong promoted rarity', () => {
    const heroic = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      history([['Zeus', 'ZeusWeaponBoon', 'Heroic']]),
      { resolvedProviderKey: 'Apollo' },
      'Heroic',
    );
    expect(heroic.legal).toBe(false);
    expect(heroic.findings.map((finding) => finding.code)).toContain('replacementMaximumRarity');
    const wrong = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      history([['Zeus', 'ZeusWeaponBoon', 'Common']]),
      { resolvedProviderKey: 'Apollo' },
      'Epic',
    );
    expect(wrong.legal).toBe(false);
    expect(wrong.findings).toContainEqual({
      code: 'replacementRarityMismatch',
      traitKey: 'ApolloWeaponBoon',
      detail: 'Rare:Epic',
    });
  });

  it('reports both fresh-domain and promotion errors for stale Heroic replacement rarity', () => {
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer(
        'Apollo',
        Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Heroic' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      ),
      history([['Zeus', 'ZeusWeaponBoon', 'Common']]),
      {},
      1,
    );
    const assessment = evaluation.assessments[0];
    expect(assessment).toBeDefined();
    if (assessment === undefined) throw new Error('Apollo replacement assessment is missing');
    expect(assessment.legal).toBe(false);
    expect(assessment.findings).toEqual([
      {
        code: 'replacementRarityMismatch',
        traitKey: 'ApolloWeaponBoon',
        detail: 'Rare:Heroic',
      },
      {
        code: 'freshRarityUnavailable',
        traitKey: 'ApolloWeaponBoon',
        detail: 'Heroic',
      },
    ]);
    expect(recordReachedTraitOffer(catalog, evaluation, 2, 'test').event).toBeUndefined();
  });

  it('folds only the selected replacement and recomputes the equipped ledger', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const evaluation = evaluateReachedTraitOffer(catalog, owner, 'source', value, before, {}, 1);
    const applied = recordReachedTraitOffer(catalog, evaluation, 2, 'test');
    expect(applied.event?.replacementTransition?.replacedTraitKey).toBe('ZeusWeaponBoon');
    expect(applied.history.equippedTraits.ZeusWeaponBoon).toBeUndefined();
    expect(applied.history.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Rare');
    expect(applied.history.equippedSlots.Melee?.traitKey).toBe('ApolloWeaponBoon');
    expect(applied.history.events).toHaveLength(2);
  });

  it('rejects a stale Heroic fresh offer after its upstream occupant is replaced away', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Epic']]);
    const replacement = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer(
        'Apollo',
        Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Heroic' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      ),
      before,
      {},
      1,
    );
    const after = recordReachedTraitOffer(catalog, replacement, 2, 'test').history;
    expect(after.equippedTraits.ZeusWeaponBoon).toBeUndefined();
    expect(after.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Heroic');

    const stale = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer(
        'Zeus',
        Object.freeze([
          { traitKey: 'ZeusSpecialBoon', rarity: 'Heroic' },
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
        ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      ),
      after,
      {},
      2,
    );
    expect(stale.assessments[0]).toEqual({
      legal: false,
      findings: [
        {
          code: 'freshRarityUnavailable',
          traitKey: 'ZeusSpecialBoon',
          detail: 'Heroic',
        },
      ],
    });
    expect(recordReachedTraitOffer(catalog, stale, 3, 'test').event).toBeUndefined();
  });

  it('allows two replacements when one ordinary key remains', () => {
    const testCatalog = narrowApolloCatalog();
    const before = historyFor(testCatalog, [
      ['Zeus', 'ZeusWeaponBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Common'],
    ]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const composition = evaluateReachedTraitOffer(
      testCatalog,
      owner,
      'source',
      value,
      before,
      {},
      1,
    ).generation;
    expect(composition).toMatchObject({
      legal: true,
    });
  });

  it('allows three replacements when no ordinary key remains', () => {
    const testCatalog = narrowApolloCatalog();
    const before = historyFor(testCatalog, [
      ['Zeus', 'ZeusWeaponBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Common'],
      ['Zeus', 'ZeusCastBoon', 'Common'],
    ]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
        { traitKey: 'ApolloCastBoon', rarity: 'Rare' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const composition = evaluateReachedTraitOffer(
      testCatalog,
      owner,
      'source',
      value,
      before,
      {},
      1,
    ).generation;
    expect(composition).toMatchObject({
      legal: true,
    });
  });

  it('does not mutate state for unselected replacement alternatives', () => {
    const before = history([['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      Object.freeze({
        kind: 'traits',
        giverKey: 'Apollo',
        options: Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
        selectedOptionKey: 'option2' as const,
      }),
      before,
      {},
      1,
    );
    const applied = recordReachedTraitOffer(catalog, evaluation, 2, 'test');
    expect(applied.event?.selectedOptionKey).toBe('option2');
    expect(applied.history.equippedTraits.ZeusWeaponBoon).toBeDefined();
    expect(applied.history.equippedTraits.ApolloSpecialBoon).toBeDefined();
  });

  it('rejects a replacement with an undeclared promoted rarity', () => {
    const assessment = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      history([['Zeus', 'ZeusWeaponBoon', 'Common']]),
      { resolvedProviderKey: 'Apollo', devotionNoDuo: true },
      'Duo',
    );
    expect(assessment.legal).toBe(false);
    expect(assessment.findings).toEqual([
      { code: 'replacementRarityMismatch', traitKey: 'ApolloWeaponBoon', detail: 'Rare:Duo' },
      { code: 'freshRarityUnavailable', traitKey: 'ApolloWeaponBoon', detail: 'Duo' },
    ]);
  });

  it('recomputes derived facts after a selected replacement', () => {
    const before = history([['Zeus', 'ZeusCastBoon', 'Common']]);
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer(
        'Apollo',
        Object.freeze([
          { traitKey: 'ApolloCastBoon', rarity: 'Rare' },
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      ),
      before,
      {},
      1,
    );
    const after = recordReachedTraitOffer(catalog, evaluation, 2, 'test').history;
    expect(after.elementCounts).toEqual({ Aether: 0, Earth: 0, Air: 0, Fire: 1, Water: 0 });
    expect(after.godBoonRarityCounts).toEqual({ Rare: 1 });
    expect(after.upgradableTraitCount).toBe(1);
    expect(after.equippedSlots.Ranged?.traitKey).toBe('ApolloCastBoon');
  });

  it('limits replacements independently of ordinary option legality', () => {
    const before = history([
      ['Zeus', 'ZeusWeaponBoon', 'Common'],
      ['Zeus', 'ZeusSpecialBoon', 'Common'],
      ['Zeus', 'ZeusCastBoon', 'Common'],
    ]);
    const value = offer(
      'Apollo',
      Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Rare' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' },
        { traitKey: 'ApolloCastBoon', rarity: 'Rare' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    );
    const composition = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      value,
      before,
      {},
      1,
    ).generation;
    expect(composition?.legal).toBe(false);
  });

  it('does not expose Heroic as a fresh candidate', () => {
    const candidates = traitCandidates(catalog, 'Apollo', createTraitHistoryState());
    expect(candidates.some((candidate) => candidate.rarity === 'Heroic')).toBe(false);
  });

  it('rejects an in-memory traits draft whose selection is not materialized', () => {
    const invalid = Object.freeze({
      kind: 'traits' as const,
      giverKey: 'Apollo',
      options: Object.freeze([{ traitKey: 'ApolloWeaponBoon', rarity: 'Common' }]) as readonly [
        { readonly traitKey: string; readonly rarity: 'Common' },
      ],
      selectedOptionKey: 'option3' as const,
    });
    expect(assessTraitOfferComposition(catalog, invalid)).toMatchObject({
      legal: false,
      findings: [{ code: 'traitOfferSelectionUnavailable' }],
    });
  });

  it('rejects sparse rarityless-provider drafts through the selected assessment authority', () => {
    const value = Object.freeze({
      kind: 'traits' as const,
      giverKey: 'Icarus',
      options: Object.freeze([{ traitKey: 'OmegaExplodeBoon' }]) as readonly [
        { readonly traitKey: string },
      ],
      selectedOptionKey: 'option1' as const,
    });
    expect(assessTraitOfferComposition(catalog, value)).toEqual(
      expect.objectContaining({
        legal: false,
        findings: [{ code: 'unsupportedSparseTraitOffer' }],
      }),
    );
  });
});
