import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  createTraitAcquisitionTargetAddress,
  createAllTogetherSetAddress,
  createNaturalSelectionResultAddress,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
  type OneToEight,
} from '@run-planner/engine/authored-project';
import { normalizeAuthoredChaosTraitOffer } from '../../src/authored-project/traits/state';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  type TraitOfferEvent,
} from '../../src/simulation';
import { applyTraitOfferForAcquisition } from '../../src/simulation/rewards/trait-settlement/coordinator';
import { selectedTraitOfferProducts } from '../../src/simulation/rewards/biome/selected-trait-products';
import { advanceCurrentKeepsake, createKeepsakeState } from '../../src/simulation/keepsakes/state';
import {
  applyEchoConcaveStoneReplay,
  concaveStoneProcSupport,
  concaveStoneResidualOptionKeys,
  consumeConcaveStone,
} from '../../src/simulation/keepsakes/trait-effects';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer/capability';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { describe, expect, it } from 'vitest';

const biome = createBiomeAddress('Underworld', 'F');
const origin = createIncomingRewardAddress(biome, createOccurrenceId('concave-stone-test'));
const trait = createTraitOfferAddress(origin, 'self');

function offer(
  result?: AuthoredTraitOfferTraits['concaveStoneResult'],
  rejectedOptionKey?: AuthoredTraitOfferTraits['rejectedOptionKey'],
): AuthoredTraitOfferTraits {
  const options = [
    { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
    { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
    { traitKey: 'ApolloCastBoon', rarity: 'Common' },
  ] as const;
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Apollo',
    options,
    selectedOptionKey: 'option1',
    ...(rejectedOptionKey === undefined ? {} : { rejectedOptionKey }),
    ...(result === undefined ? {} : { concaveStoneResult: result }),
  });
}

function branchWithStone(
  rank: 'Common' | 'Rare' | 'Epic' | 'Heroic' = 'Common',
  traitHistory = createTraitHistoryState(),
) {
  const branch = initializeTestRewardBranches()[0];
  if (branch === undefined) throw new Error('missing test reward branch');
  const source = createKeepsakeState(catalog, 'UnpickedBoonKeepsake');
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
    keepsakes: Object.freeze({
      ...source,
      stone: Object.freeze({ ...source.stone!, rank }),
    }),
  });
}

function settle(
  value: AuthoredTraitOfferTraits,
  rank: 'Common' | 'Rare' | 'Epic' | 'Heroic' = 'Common',
  traitContext: Record<string, unknown> = {},
  traitHistory = createTraitHistoryState(),
) {
  const branch = branchWithStone(rank, traitHistory);
  return applyTraitOfferForAcquisition(
    catalog,
    branch,
    {
      origin,
      traitOffersByAcquisitionRole: Object.freeze({ self: value }),
      traitContext: Object.freeze(traitContext),
    },
    'self',
    'traitAcquired',
    1,
  );
}

function settleWithKeepsakes(
  value: AuthoredTraitOfferTraits,
  keepsakes: ReturnType<typeof createKeepsakeState>,
) {
  const branch = initializeTestRewardBranches()[0];
  if (branch === undefined) throw new Error('missing test reward branch');
  return applyTraitOfferForAcquisition(
    catalog,
    Object.freeze({ ...branch, keepsakes }),
    {
      origin,
      traitOffersByAcquisitionRole: Object.freeze({ self: value }),
      traitContext: Object.freeze({}),
    },
    'self',
    'traitAcquired',
    1,
  );
}

function rejectedChaosHistory() {
  const curse = catalog.chaos.curses.byKey.ChaosRestrictBoonCurse;
  const blessing = catalog.chaos.blessings.byKey.ChaosElementalBlessing;
  if (curse === undefined || blessing === undefined) throw new Error('missing Rejected Chaos data');
  const offer = normalizeAuthoredChaosTraitOffer(catalog, {
    kind: 'chaos',
    giverKey: 'Chaos',
    curseOptions: [
      { curseKey: curse.key, requirementCount: curse.duration.minimum },
      { curseKey: curse.key, requirementCount: curse.duration.minimum },
      { curseKey: curse.key, requirementCount: curse.duration.minimum },
    ],
    selectedOptionKey: 'option1',
    selectedCurseValues: Object.freeze(
      Object.fromEntries(curse.operands.map((operand) => [operand.key, operand.minimum])),
    ),
    blessingKey: blessing.key,
    rarity: 'Common',
    blessingValues: Object.freeze(
      Object.fromEntries(
        blessing.operands.map((operand) => [
          operand.key,
          operand.byRarity?.Common?.minimum ?? operand.minimum,
        ]),
      ),
    ),
  });
  return foldTraitHistoryEvents(catalog, [
    Object.freeze({
      kind: 'chaosPair' as const,
      owner: origin,
      acquisitionRole: 'chaos',
      sequence: 0,
      acquisitionPoint: 'test',
      acquisitionIdentity: 'chaos:0',
      offer,
    }),
  ]);
}

function cherishedPrerequisiteHistory() {
  return foldTraitHistoryEvents(catalog, [
    {
      kind: 'traitOffer' as const,
      owner: { kind: 'project' } as const,
      acquisitionRole: 'seed',
      sequence: 0,
      giverKey: 'Demeter',
      options: [{ traitKey: 'DemeterWeaponBoon', rarity: 'Common' as const }],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'test',
    },
    {
      kind: 'traitOffer' as const,
      owner: { kind: 'project' } as const,
      acquisitionRole: 'seed',
      sequence: 1,
      giverKey: 'Hera',
      options: [{ traitKey: 'HeraWeaponBoon', rarity: 'Common' as const }],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'test',
    },
  ]);
}

describe('Concave Stone declaration and source ledger', () => {
  it('declares one use, all four support values, and a Common Gift source', () => {
    expect(catalog.keepsakes.byKey.UnpickedBoonKeepsake?.effect).toEqual({
      kind: 'concaveStone',
      uses: 1,
      procSupportByRank: { Common: 25, Rare: 50, Epic: 75, Heroic: 100 },
    });
    expect(catalog.keepsakes.byKey.UnpickedBoonKeepsake?.echoGift).toEqual({
      availability: 'eligible',
      effect: { kind: 'concaveStone', schedule: 'oneShot' },
    });
    const state = createKeepsakeState(catalog, 'UnpickedBoonKeepsake');
    expect(concaveStoneProcSupport(catalog, state)).toBe(75);
    expect(concaveStoneProcSupport(catalog, advanceCurrentKeepsake(catalog, state, 1))).toBe(100);
    expect(concaveStoneProcSupport(catalog, consumeConcaveStone(state))).toBeUndefined();
    expect(
      concaveStoneProcSupport(
        catalog,
        applyEchoConcaveStoneReplay(
          catalog,
          createKeepsakeState(catalog, 'SilverWheelKeepsake'),
          'UnpickedBoonKeepsake',
        ),
      ),
    ).toBe(25);
  });

  it('keeps only original unpicked non-replacement rows in the residual domain', () => {
    expect(concaveStoneResidualOptionKeys(offer(undefined, 'option2'))).toEqual(['option3']);
    expect(concaveStoneResidualOptionKeys(offer(), ['option2'])).toEqual(['option3']);
    expect(concaveStoneResidualOptionKeys(offer())).toEqual(['option2', 'option3']);
  });
});

describe('Concave Stone trait settlement', () => {
  it('repairs and settles All Together carried by the residual option', () => {
    const before = foldTraitHistoryEvents(
      catalog,
      ['HeraWeaponBoon', 'CommonGlobalDamageBoon', 'DamageSharePotencyBoon'].map(
        (traitKey, sequence): TraitOfferEvent => ({
          kind: 'traitOffer',
          owner: origin,
          acquisitionRole: 'prior',
          sequence,
          acquisitionPoint: 'prior',
          giverKey: 'Hera',
          selectedOptionKey: 'option1',
          options: [{ traitKey, rarity: 'Common' }],
        }),
      ),
    );
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Hera',
      selectedOptionKey: 'option1',
      options: [
        { traitKey: 'BoonDecayBoon', rarity: 'Common', targetTraitKey: 'HeraWeaponBoon' },
        { traitKey: 'AllElementalBoon', rarity: 'Legendary' },
        { traitKey: 'HeraSprintBoon', rarity: 'Common' },
      ],
      concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
    };
    const missing = settle(value, 'Common', {}, before);
    expect(missing.findingEntries.map((entry) => entry.finding.origin)).toContainEqual(
      createAllTogetherSetAddress(trait, 'option2', 'earth'),
    );
    const result = {
      earth: 'ElementalDamageBoon',
      fire: 'ElementalBaseDamageBoon',
      air: 'ElementalDamageFloorBoon',
      water: 'ElementalHealthBoon',
    };
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(trait),
          [{ before, context: {}, keepsakes: branchWithStone('Common', before).keepsakes }],
        ],
      ]),
    ).at(trait)!;
    expect(capability.allTogetherSet(value, 'option2', 'earth')[0]).toContain(result.earth);
    const unresolvedPrimary: AuthoredTraitOfferTraits = {
      ...value,
      options: [
        { traitKey: 'BoonDecayBoon', rarity: 'Common' },
        value.options[1]!,
        value.options[2]!,
      ],
    };
    expect(capability.allTogetherSet(unresolvedPrimary, 'option2', 'earth')).toEqual([]);
    const repaired = settle(
      {
        ...value,
        options: [
          value.options[0]!,
          { ...value.options[1]!, allTogetherResult: result },
          value.options[2]!,
        ],
      },
      'Common',
      {},
      before,
    );
    expect(repaired.findingEntries).toEqual([]);
    expect(repaired.blockedChild).toBeUndefined();
    expect(repaired.branch.traitHistory?.equippedTraits.HeraWeaponBoon).toMatchObject({
      rarity: 'Heroic',
      level: 2,
    });
    for (const key of Object.values(result))
      expect(repaired.branch.traitHistory?.equippedTraits[key]).toBeDefined();
  });
  it('repairs a Stone Natural Selection prefix using post-primary targets and settles exactly its increments', () => {
    const before = foldTraitHistoryEvents(
      catalog,
      [
        ['Poseidon', 'PoseidonWeaponBoon'],
        ['Demeter', 'DemeterSpecialBoon'],
        ['Demeter', 'PlantHealthBoon'],
      ].map(([giverKey, traitKey], sequence): TraitOfferEvent => ({
        kind: 'traitOffer',
        owner: origin,
        acquisitionRole: 'prior',
        sequence,
        acquisitionPoint: 'prior',
        giverKey: giverKey!,
        selectedOptionKey: 'option1',
        options: [{ traitKey: traitKey!, rarity: 'Common' }],
      })),
    );
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Demeter',
      selectedOptionKey: 'option1',
      options: [
        { traitKey: 'DemeterCastBoon', rarity: 'Common' },
        { traitKey: 'GoodStuffBoon', rarity: 'Duo' },
        { traitKey: 'DemeterSprintBoon', rarity: 'Common' },
      ],
      concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
    };
    const address = createNaturalSelectionResultAddress(trait, 'option2');
    const missing = settle(value, 'Common', {}, before);
    expect(missing.blockedChild?.address).toEqual(address);
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(trait),
          [
            {
              before,
              context: {},
              keepsakes: branchWithStone('Common', before).keepsakes,
            },
          ],
        ],
      ]),
    ).at(trait)!;
    const disposition = catalog.traits.byKey.GoodStuffBoon!.selectedDisposition;
    if (disposition.kind !== 'naturalSelection')
      throw new Error('missing Natural Selection declaration');
    const assess = (targets?: readonly string[]) =>
      capability.naturalSelectionTargets(
        value,
        'option2',
        disposition.levelCount,
        disposition.slots,
        targets,
      )[0]!;
    const targets: string[] = [];
    expect(assess().nextTargetTraitKeys).toContain('DemeterCastBoon');
    for (let index = 0; index < 8; index++) {
      const next = assess(targets).nextTargetTraitKeys;
      const target = index === 0 ? 'DemeterCastBoon' : next[0];
      expect(next).toContain(target);
      if (target === undefined) throw new Error('missing increment target');
      targets.push(target);
    }
    expect(assess(targets)).toMatchObject({ complete: true, legal: true });
    const withTargets = (sequence: readonly string[]): AuthoredTraitOfferTraits => ({
      ...value,
      options: [
        value.options[0]!,
        { ...value.options[1]!, naturalSelectionTargets: sequence as OneToEight<string> },
        value.options[2]!,
      ],
    });
    const stale = settle(withTargets(['HeraWeaponBoon']), 'Common', {}, before);
    expect(stale.blockedChild?.address).toEqual(address);
    expect(assess(['HeraWeaponBoon']).legal).toBe(false);
    const repairedValue = withTargets(targets);
    const repaired = settle(repairedValue, 'Common', {}, before);
    expect(repaired.blockedChild).toBeUndefined();
    expect(repaired.findingEntries).toEqual([]);
    for (const key of new Set(targets)) {
      expect(repaired.branch.traitHistory?.equippedTraits[key]?.level).toBe(
        1 + targets.filter((target) => target === key).length,
      );
    }
    const dormant = settle(
      { ...repairedValue, concaveStoneResult: { kind: 'noProc' } },
      'Common',
      {},
      before,
    );
    expect(dormant.branch.traitHistory?.equippedTraits.GoodStuffBoon).toBeUndefined();
    expect(dormant.branch.traitHistory?.equippedTraits.DemeterCastBoon?.level).toBe(1);
    expect(repairedValue.options[1]?.naturalSelectionTargets).toEqual(targets);
  });
  it('settles a residual target after the primary boon and reports its original option owner', () => {
    const before = foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer',
        owner: origin,
        acquisitionRole: 'prior',
        sequence: 0,
        acquisitionPoint: 'prior',
        giverKey: 'Apollo',
        selectedOptionKey: 'option1',
        options: [{ traitKey: 'ApolloWeaponBoon', rarity: 'Common' }],
      },
    ]);
    const value: AuthoredTraitOfferTraits = {
      kind: 'traits',
      giverKey: 'Hera',
      selectedOptionKey: 'option1',
      options: [
        { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
        { traitKey: 'BoonDecayBoon', rarity: 'Common' },
        { traitKey: 'HeraCastBoon', rarity: 'Common' },
      ],
      concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
    };
    const missing = settle(value, 'Common', {}, before);
    expect(missing.blockedChild?.address).toEqual(
      createTraitAcquisitionTargetAddress(trait, 'option2'),
    );
    const repaired = settle(
      {
        ...value,
        options: [
          value.options[0]!,
          {
            ...value.options[1]!,
            targetTraitKey: 'HeraSpecialBoon',
          },
          value.options[2]!,
        ],
      },
      'Common',
      {},
      before,
    );
    expect(repaired.blockedChild).toBeUndefined();
    expect(repaired.findingEntries).toEqual([]);
    expect(repaired.branch.traitHistory?.equippedTraits.HeraSpecialBoon?.rarity).toBe('Heroic');
  });
  it('keeps an existing later offer valid when an earlier Stone proc is removed', () => {
    const later = offer();
    const priorProc = settle(offer({ kind: 'proc', optionKey: 'option2' }));
    expect(settleWithKeepsakes(later, priorProc.branch.keepsakes).blockedChild).toBeUndefined();
    const priorNoProc = settle(offer());
    const afterEdit = settleWithKeepsakes(later, priorNoProc.branch.keepsakes);
    expect(afterEdit.blockedChild).toBeUndefined();
    expect(afterEdit.findingEntries).toEqual([]);
    expect(afterEdit.branch.keepsakes.stone?.status).toBe('pending');
    expect(later.concaveStoneResult).toBeUndefined();
    const published = selectedTraitOfferProducts([afterEdit.branch]).selectedTraitOffers[0]?.offer;
    expect(published).toMatchObject({ concaveStoneResult: { kind: 'noProc' } });
    expect(
      settleWithKeepsakes(offer({ kind: 'noProc' }), priorProc.branch.keepsakes).blockedChild,
    ).toBeUndefined();
  });

  it.each([
    ['Common', 25],
    ['Rare', 50],
    ['Epic', 75],
  ] as const)(
    'accepts an explicit no-proc at %s rank with %i%% support and preserves the use',
    (rank: 'Common' | 'Rare' | 'Epic', support: number) => {
      const result = settle(offer({ kind: 'noProc' }), rank);
      expect(result.blockedChild).toBeUndefined();
      expect(result.branch.keepsakes.stone).toMatchObject({ status: 'pending', rank });
      expect(concaveStoneProcSupport(catalog, result.branch.keepsakes)).toBe(support);
      expect(result.branch.traitHistory?.equippedTraits.ApolloWeaponBoon).toBeDefined();
      expect(
        result.branch.traitHistory?.events.filter((event) => event.kind === 'traitOffer'),
      ).toHaveLength(1);
      const implicit = settle(offer(), rank);
      expect(implicit.blockedChild).toBeUndefined();
      expect(implicit.branch.keepsakes).toEqual(result.branch.keepsakes);
    },
  );

  it('consumes Stone before acquiring a selected frozen residual row without recomposing an offer', () => {
    const result = settle(offer({ kind: 'proc', optionKey: 'option2' }));
    expect(result.blockedChild).toBeUndefined();
    expect(result.branch.keepsakes.stone).toMatchObject({ status: 'consumed' });
    expect(result.branch.traitHistory?.equippedTraits.ApolloWeaponBoon).toBeDefined();
    expect(result.branch.traitHistory?.equippedTraits.ApolloSpecialBoon).toBeDefined();
    const traitEvents = result.branch.traitHistory?.events.filter(
      (event): event is TraitOfferEvent => event.kind === 'traitOffer',
    );
    expect(traitEvents).toHaveLength(1);
    expect(traitEvents?.[0]?.acquisitionRole).toBe('self');
    const secondaryEvents = result.branch.traitHistory?.events.filter(
      (event) => event.kind === 'concaveStoneSecondary',
    );
    expect(secondaryEvents).toHaveLength(1);
    expect(secondaryEvents?.[0]?.options).toEqual([
      { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
    ]);
    expect(result.branch.traitEvaluations).toHaveLength(1);
  });

  it("uses Calling Card's once-rarified frozen row without replaying its charge", () => {
    const base = createKeepsakeState(catalog, 'RarifyKeepsake');
    const result = settleWithKeepsakes(
      Object.freeze({
        ...offer({ kind: 'proc', optionKey: 'option2' }),
        rarificationActions: Object.freeze(['option2' as const]),
      }),
      Object.freeze({
        ...base,
        callingCard: Object.freeze({ remainingCharges: 1 }),
        stone: Object.freeze({
          origin: 'echo' as const,
          status: 'pending' as const,
          rank: 'Common' as const,
        }),
      }),
    );
    expect(result.branch.keepsakes.callingCard?.remainingCharges).toBe(0);
    expect(result.branch.traitHistory?.equippedTraits.ApolloSpecialBoon?.rarity).toBe('Rare');
    expect(
      result.branch.traitHistory?.events.filter((event) => event.kind === 'traitOffer'),
    ).toHaveLength(1);
  });

  it('keeps an Echo Common Stone pending across no-proc, then consumes its unslotted one-shot source', () => {
    const replayed = applyEchoConcaveStoneReplay(
      catalog,
      createKeepsakeState(catalog, 'SilverWheelKeepsake'),
      'UnpickedBoonKeepsake',
    );
    const noProc = settleWithKeepsakes(offer({ kind: 'noProc' }), replayed);
    expect(noProc.branch.keepsakes.stone).toEqual({
      origin: 'echo',
      status: 'pending',
      rank: 'Common',
    });
    const proc = settleWithKeepsakes(
      offer({ kind: 'proc', optionKey: 'option2' }),
      noProc.branch.keepsakes,
    );
    expect(proc.branch.keepsakes.stone).toEqual({
      origin: 'echo',
      status: 'consumed',
      rank: 'Common',
    });
    expect(
      applyEchoConcaveStoneReplay(catalog, proc.branch.keepsakes, 'UnpickedBoonKeepsake'),
    ).toBe(proc.branch.keepsakes);
  });

  it('acquires the frozen row without replaying active Chaos composition', () => {
    const result = settle(
      offer({ kind: 'proc', optionKey: 'option2' }, 'option3'),
      'Common',
      {},
      rejectedChaosHistory(),
    );
    expect(result.blockedChild).toBeUndefined();
    expect(result.branch.traitHistory?.equippedTraits.ApolloSpecialBoon).toBeDefined();
    expect(result.branch.traitEvaluations).toHaveLength(1);
  });

  it('forces a Heroic proc only when a residual row exists and excludes a replacement row', () => {
    expect(settle(offer(), 'Heroic').blockedChild?.address).toEqual(trait);
    const noProc = settle(offer({ kind: 'noProc' }), 'Heroic');
    expect(noProc.blockedChild?.address).toEqual(trait);
    expect(noProc.branch.keepsakes.stone).toMatchObject({ status: 'pending', rank: 'Heroic' });

    const replacementHistory = foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer' as const,
        owner: { kind: 'project' } as const,
        acquisitionRole: 'seed',
        sequence: 0,
        giverKey: 'Zeus',
        options: Object.freeze([
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' as const },
          { traitKey: 'ZeusSpecialBoon', rarity: 'Common' as const },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' as const },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option2' as const,
        acquisitionPoint: 'test',
      },
    ]);
    const replacement = settle(
      Object.freeze({
        ...offer({ kind: 'proc', optionKey: 'option2' }),
        options: Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Rare' as const },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
        ]) as AuthoredTraitOfferTraits['options'],
      }),
      'Heroic',
      {},
      replacementHistory,
    );
    expect(replacement.blockedChild?.address).toEqual(trait);
    expect(replacement.branch.keepsakes.stone).toMatchObject({ status: 'pending' });
    expect(replacement.branch.traitHistory?.equippedTraits.ApolloSpecialBoon).toBeUndefined();
  });

  it('checks Stone after primary Cherished reconstruction, forcing an Epic source to proc', () => {
    const cherishedFirst = Object.freeze({
      ...offer({ kind: 'proc', optionKey: 'option2' }),
      giverKey: 'Demeter',
      options: Object.freeze([
        { traitKey: 'KeepsakeLevelBoon', rarity: 'Duo' as const },
        { traitKey: 'DemeterSpecialBoon', rarity: 'Common' as const },
        { traitKey: 'DemeterCastBoon', rarity: 'Common' as const },
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const proc = settle(cherishedFirst, 'Epic', {}, cherishedPrerequisiteHistory());
    expect(proc.blockedChild).toBeUndefined();
    expect(proc.branch.keepsakes.stone).toMatchObject({ status: 'consumed', rank: 'Heroic' });
    expect(
      proc.branch.traitHistory?.events.filter(
        (event) => event.kind === 'traitOffer' && event.acquisitionRole === 'self',
      ),
    ).toHaveLength(1);
    expect(
      proc.branch.traitHistory?.events.filter((event) => event.kind === 'concaveStoneSecondary'),
    ).toHaveLength(1);
  });

  it('consumes Stone before frozen Cherished acquires, preventing a third boon', () => {
    const cherishedSecond = Object.freeze({
      ...offer({ kind: 'proc', optionKey: 'option2' }),
      giverKey: 'Demeter',
      options: Object.freeze([
        { traitKey: 'DemeterSpecialBoon', rarity: 'Common' as const },
        { traitKey: 'KeepsakeLevelBoon', rarity: 'Duo' as const },
        { traitKey: 'DemeterCastBoon', rarity: 'Common' as const },
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const proc = settle(cherishedSecond, 'Epic', {}, cherishedPrerequisiteHistory());
    expect(proc.blockedChild).toBeUndefined();
    expect(proc.branch.keepsakes.stone).toMatchObject({ status: 'consumed', rank: 'Epic' });
    expect(proc.branch.traitHistory?.equippedTraits.KeepsakeLevelBoon).toBeDefined();
    expect(
      proc.branch.traitHistory?.events.filter((event) => event.kind === 'concaveStoneSecondary'),
    ).toHaveLength(1);
  });
});

describe('Concave Stone candidate capability', () => {
  it('exposes optional and forced retained-result support without changing the residual rows', () => {
    const state = createKeepsakeState(catalog, 'UnpickedBoonKeepsake');
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(trait),
          [
            {
              before: createTraitHistoryState(),
              context: Object.freeze({}),
              keepsakes: state,
            },
          ],
        ],
      ]),
    );
    const capability = artifacts.at(trait);
    if (capability === undefined) throw new Error('missing Stone candidate capability');
    expect(capability.concaveStone(offer())).toMatchObject([
      { required: false, resultSupport: 'possible', supported: true },
    ]);
    expect(capability.concaveStone(offer({ kind: 'noProc' }))).toMatchObject([
      {
        procSupport: 75,
        residualOptionKeys: ['option2', 'option3'],
        required: false,
        resultSupport: 'possible',
        supported: true,
      },
    ]);
    const heroicState = Object.freeze({
      ...state,
      stone: Object.freeze({ ...state.stone!, rank: 'Heroic' as const }),
    });
    const heroic = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(trait),
          [{ before: createTraitHistoryState(), context: {}, keepsakes: heroicState }],
        ],
      ]),
    ).at(trait);
    if (heroic === undefined) throw new Error('missing Stone candidate capability');
    expect(heroic.concaveStone(offer())).toMatchObject([
      { procSupport: 100, required: true, resultSupport: 'impossible', supported: false },
    ]);
  });

  it('retains a Stone result as unavailable after the source is gone', () => {
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(trait),
          [
            {
              before: createTraitHistoryState(),
              context: {},
              keepsakes: createKeepsakeState(catalog, 'SilverWheelKeepsake'),
            },
          ],
        ],
      ]),
    );
    const capability = artifacts.at(trait);
    if (capability === undefined) throw new Error('missing retained Stone candidate capability');
    expect(capability.concaveStone(offer({ kind: 'proc', optionKey: 'option2' }))).toMatchObject([
      { procSupport: 0, residualOptionKeys: [], resultSupport: 'impossible', supported: false },
    ]);
  });
});
