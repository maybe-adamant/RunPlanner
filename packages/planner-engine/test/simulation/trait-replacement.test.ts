import { catalog } from '@run-planner/hades2-catalog';
import {
  assessTraitOption,
  assessTraitOfferComposition,
  assessTraitOfferDomainComposition,
  assessTraitReplacementComposition,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  nextTraitOfferDraft,
  nextOptionalHighTierTraitOfferDraft,
  previousOptionalHighTierTraitOfferDraft,
  traitOfferCompositionDomains,
  traitCandidates,
  recordReachedTraitOffer,
  traitOfferStartingDraft,
  evaluateReachedTraitOffer,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import type { AuthoredTraitOffer } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

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
): AuthoredTraitOffer {
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

function optionalHighTierApolloCatalog() {
  const giver = catalog.traitGivers.byKey.Apollo!;
  const traitKeys = ['ApolloWeaponBoon', 'DoubleExManaBoon', 'ApolloSecondStageCastBoon'] as const;
  const narrowedGiver = Object.freeze({
    ...giver,
    traitKeys: Object.freeze([...traitKeys]),
    priorityTraitKeys: Object.freeze([...traitKeys]),
  });
  const highTierKeys = new Set(traitKeys.slice(1));
  const narrowedTraits = Object.freeze(
    Object.fromEntries(
      Object.entries(catalog.traits.byKey).map(([key, declaration]) => [
        key,
        highTierKeys.has(key as (typeof traitKeys)[number])
          ? Object.freeze({ ...declaration, offerRequirements: Object.freeze([]) })
          : declaration,
      ]),
    ),
  ) as typeof catalog.traits.byKey;
  return Object.freeze({
    ...catalog,
    traitGivers: Object.freeze({
      ...catalog.traitGivers,
      values: Object.freeze(
        catalog.traitGivers.values.map((candidate) =>
          candidate.key === 'Apollo' ? narrowedGiver : candidate,
        ),
      ),
      byKey: Object.freeze({ ...catalog.traitGivers.byKey, Apollo: narrowedGiver }),
    }),
    traits: Object.freeze({
      ...catalog.traits,
      values: Object.freeze(
        catalog.traits.values.map((declaration) => narrowedTraits[declaration.key]!),
      ),
      byKey: narrowedTraits,
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
    expect(evaluation.replacementComposition.legal).toBe(true);
    expect(evaluation.assessments).toEqual([]);

    const recorded = recordReachedTraitOffer(testCatalog, evaluation, 4, 'test');
    expect(recorded.event).toBeUndefined();
    expect(recorded.history).toBe(before);
    expect(recorded.history.events).toEqual([]);
    expect(recorded.history.equippedTraits).toEqual({});
  });

  it('retains a mandatory targeted ordinary trait in an unselected sparse row', () => {
    const testCatalog = narrowHeraDraftCatalog();
    const before = historyFor(testCatalog, [['Hephaestus', 'HephaestusWeaponBoon', 'Common']]);
    const draft = traitOfferStartingDraft(testCatalog, 'Hera', before);
    expect(draft?.options.map((option) => option.traitKey)).toEqual(
      expect.arrayContaining(['BoonDecayBoon', 'BoonGrowthBoon']),
    );
    expect(draft?.options[0]?.traitKey).not.toBe('BoonDecayBoon');
    expect(assessTraitReplacementComposition(testCatalog, draft!, before).legal).toBe(true);
  });

  it.each([
    ['O3 full triple', 3, 0, 0, ['ordinary', 'ordinary', 'ordinary'], false, true],
    ['O2 no R sparse pair', 2, 0, 0, ['ordinary', 'ordinary'], false, true],
    ['O2 forced R', 2, 0, 1, ['ordinary', 'ordinary', 'replacement'], false, true],
    ['O1 H plus R', 1, 1, 1, ['ordinary', 'highTier', 'replacement'], false, true],
    ['O1 two R', 1, 0, 2, ['ordinary', 'replacement', 'replacement'], false, true],
    ['O1 no R sparse singleton', 1, 0, 0, ['ordinary'], false, true],
    ['O0 H plus R', 0, 1, 2, ['highTier', 'replacement', 'replacement'], false, true],
    ['O0 R only', 0, 0, 2, ['replacement', 'replacement'], false, true],
    ['O0 empty fallback', 0, 0, 0, [], true, true],
    ['O0 eligible unrolled H fallback', 0, 2, 0, [], true, true],
  ] as const)(
    'applies the universal exhaustion matrix: %s',
    (_name, ordinaryCount, highTierCount, replacementCount, authoredKinds, fallbackGold, legal) => {
      const keys = (prefix: string, count: number) =>
        Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
      const authored = authoredKinds.map((kind, index) =>
        Object.freeze({ traitKey: `${kind}${index + 1}`, kind }),
      );
      const result = assessTraitOfferDomainComposition({
        ordinaryKeys: keys('ordinary', ordinaryCount),
        highTierKeys: keys('highTier', highTierCount),
        replacementKeys: keys('replacement', replacementCount),
        authored: Object.freeze(authored),
        fallbackGold,
        replacementRollChance: 0.1,
      });
      expect(result.legal).toBe(legal);
    },
  );

  it.each([
    [
      'O3 cannot be sparse',
      3,
      0,
      0,
      ['ordinary', 'ordinary'],
      false,
      'fullTraitOfferWidthRequired',
    ],
    ['O2 cannot omit ordinary', 2, 0, 0, ['ordinary'], false, 'missingMandatoryOrdinary'],
    ['O2 must fill R', 2, 0, 1, ['ordinary', 'ordinary'], false, 'missingForcedReplacement'],
    [
      'O1 H must still fill R',
      1,
      1,
      1,
      ['ordinary', 'highTier'],
      false,
      'missingForcedReplacement',
    ],
    [
      'O1 two R requires both',
      1,
      0,
      2,
      ['ordinary', 'replacement'],
      false,
      'missingForcedReplacement',
    ],
    ['O0 H must fill R', 0, 1, 2, ['highTier'], false, 'missingForcedReplacement'],
    [
      'O0 R requires all available fill',
      0,
      0,
      2,
      ['replacement'],
      false,
      'missingForcedReplacement',
    ],
    ['fallback rejects ordinary', 1, 0, 0, [], true, 'fallbackGoldUnavailable'],
    ['fallback rejects replacement', 0, 0, 1, [], true, 'fallbackGoldUnavailable'],
  ] as const)(
    'rejects incomplete universal exhaustion result: %s',
    (_name, ordinaryCount, highTierCount, replacementCount, authoredKinds, fallbackGold, code) => {
      const keys = (prefix: string, count: number) =>
        Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);
      const result = assessTraitOfferDomainComposition({
        ordinaryKeys: keys('ordinary', ordinaryCount),
        highTierKeys: keys('highTier', highTierCount),
        replacementKeys: keys('replacement', replacementCount),
        authored: Object.freeze(
          authoredKinds.map((kind, index) => ({ traitKey: `${kind}${index + 1}`, kind })),
        ),
        fallbackGold,
        replacementRollChance: 0.1,
      });
      expect(result.legal).toBe(false);
      expect(result.findings.map((finding) => finding.code)).toContain(code);
    },
  );
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

    expect(
      assessTraitOption(catalog, 'ApolloSpecialBoon', before, context, 'Rare').findings,
    ).toContainEqual({
      code: 'freshRarityUnavailable',
      traitKey: 'ApolloSpecialBoon',
      detail: 'Rare',
    });
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
    const composition = assessTraitReplacementComposition(testCatalog, value, before);
    expect(composition).toMatchObject({
      ordinaryCandidateCount: 1,
      maximumReplacementCount: 2,
      replacementCount: 2,
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
    const composition = assessTraitReplacementComposition(testCatalog, value, before);
    expect(composition).toMatchObject({
      ordinaryCandidateCount: 0,
      maximumReplacementCount: 3,
      replacementCount: 3,
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

  it('keeps failed offer requirements on replacement-shaped options', () => {
    const assessment = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      history([['Zeus', 'ZeusWeaponBoon', 'Common']]),
      { resolvedProviderKey: 'Apollo', devotionNoDuo: true },
      'Duo',
    );
    expect(assessment.legal).toBe(false);
    expect(assessment.findings).toEqual([
      { code: 'offerContext', traitKey: 'ApolloWeaponBoon', detail: 'devotionNoDuo' },
      { code: 'occupiedBoonSlot', traitKey: 'ApolloWeaponBoon', detail: 'Melee' },
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
    const composition = assessTraitReplacementComposition(catalog, value, before);
    expect(composition.ordinaryCandidateCount).toBeGreaterThanOrEqual(2);
    expect(composition.maximumReplacementCount).toBe(1);
    expect(composition.replacementCount).toBe(3);
    expect(composition.legal).toBe(false);
  });

  it('does not expose Heroic as a fresh candidate', () => {
    const candidates = traitCandidates(catalog, 'Apollo', createTraitHistoryState());
    expect(candidates.some((candidate) => candidate.rarity === 'Heroic')).toBe(false);
  });

  it('uses the exact first-Olympian priority domain for composition and draft growth', () => {
    const before = createTraitHistoryState();
    const domains = traitOfferCompositionDomains(catalog, 'Apollo', before);
    expect(new Set(domains.ordinary.map((candidate) => candidate.traitKey))).toEqual(
      new Set(catalog.traitGivers.byKey.Apollo!.priorityTraitKeys),
    );
    const sparse = offer(
      'Apollo',
      Object.freeze([{ traitKey: 'ApolloWeaponBoon', rarity: 'Common' }]),
    );
    const next = nextTraitOfferDraft(
      catalog,
      sparse as Extract<AuthoredTraitOffer, { kind: 'traits' }>,
      before,
    );
    // The draft may remain incomplete, but the engine only exposes a next
    // position that has a valid completion path through the shared domain.
    expect(next?.options).toHaveLength(2);
    const completed = nextTraitOfferDraft(catalog, next!, before);
    expect(completed?.options).toHaveLength(3);
    expect(assessTraitReplacementComposition(catalog, completed!, before).legal).toBe(true);
  });

  it('exposes shape transitions only for optional Duo and Legendary outcomes', () => {
    const testCatalog = optionalHighTierApolloCatalog();
    const before = createTraitHistoryState();
    const initial = traitOfferStartingDraft(testCatalog, 'Apollo', before);
    expect(initial?.options.map((option) => option.rarity)).toEqual(['Common', 'Legendary', 'Duo']);
    const withoutDuo = previousOptionalHighTierTraitOfferDraft(testCatalog, initial!);
    expect(withoutDuo?.options.map((option) => option.rarity)).toEqual(['Common', 'Legendary']);
    const withoutHighTier = previousOptionalHighTierTraitOfferDraft(testCatalog, withoutDuo!);
    expect(withoutHighTier?.options.map((option) => option.rarity)).toEqual(['Common']);
    expect(previousOptionalHighTierTraitOfferDraft(testCatalog, withoutHighTier!)).toBeUndefined();
    expect(
      nextOptionalHighTierTraitOfferDraft(testCatalog, withoutHighTier!, before)?.options.map(
        (option) => option.rarity,
      ),
    ).toEqual(['Common', 'Legendary']);

    const ordinaryOnly = offer(
      'Apollo',
      Object.freeze([{ traitKey: 'ApolloWeaponBoon', rarity: 'Common' }]),
    ) as Extract<AuthoredTraitOffer, { kind: 'traits' }>;
    expect(
      nextOptionalHighTierTraitOfferDraft(narrowApolloCatalog(), ordinaryOnly, before),
    ).toBeUndefined();
  });

  it('reports typed whole-offer findings for unsupported fallback and missing exhaustion fill', () => {
    const fallback = assessTraitReplacementComposition(
      catalog,
      Object.freeze({ kind: 'fallbackGold', giverKey: 'Apollo' }),
      createTraitHistoryState(),
    );
    expect(fallback.findings).toEqual([{ code: 'fallbackGoldUnavailable' }]);

    const testCatalog = narrowApolloCatalog();
    const before = historyFor(testCatalog, [['Zeus', 'ZeusWeaponBoon', 'Common']]);
    const incomplete = offer(
      'Apollo',
      Object.freeze([{ traitKey: 'ApolloCastBoon', rarity: 'Common' }]),
    );
    expect(assessTraitReplacementComposition(testCatalog, incomplete, before).findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missingMandatoryOrdinary' })]),
    );
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
    expect(assessTraitOfferComposition(catalog, invalid, createTraitHistoryState())).toMatchObject({
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
    expect(assessTraitReplacementComposition(catalog, value, createTraitHistoryState())).toEqual(
      expect.objectContaining({
        applies: false,
        legal: false,
        findings: [{ code: 'unsupportedSparseTraitOffer' }],
      }),
    );
  });
});
