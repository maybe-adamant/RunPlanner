import { describe, expect, it } from 'vitest';

import {
  evaluateRequirement,
  hasRequirementEvaluator,
  requirementEvaluatorRegistry,
  type RequirementEvaluationContext,
} from './requirementEvaluator';

const baseContext = {
  counters: {
    biomeDepthCache: 4,
    biomeEncounterDepth: 2,
    encounterDepth: 7,
    enteredBiomes: 1,
    upgradableTraitCount: 0,
  },
  records: {
    biomeUseRecord: {},
    lootTypeHistory: {},
    roomsEntered: {},
    useRecord: {},
  },
  currentRoomShopOptionNames: new Set<string>(),
  currentRoomRewardType: undefined,
  runDepthCache: 10,
  lastEventRunDepthCaches: {},
  recentEncounterPhases: [],
  offeredExitCount: 2,
  flags: {
    allSpellInvested: false,
    pendingSpellDrop: false,
  },
} satisfies RequirementEvaluationContext;

describe('requirement evaluator registry', () => {
  it('registers every normalized current-run requirement kind', () => {
    expect(Object.keys(requirementEvaluatorRegistry)).toEqual([
      'all',
      'any',
      'not',
      'counterRange',
      'recordCount',
      'distinctRecordKeyCount',
      'recentEncounterPhaseCount',
      'notInCurrentRoomShopOptions',
      'minRoomsSinceEvent',
      'minExits',
      'currentRoomRewardExcludes',
      'flagEquals',
    ]);
    expect(hasRequirementEvaluator('counterRange')).toBe(true);
    expect(hasRequirementEvaluator('externalSavePredicate')).toBe(false);
  });

  it('evaluates recursive boolean expressions and inclusive counter ranges', () => {
    expect(
      evaluateRequirement(
        {
          kind: 'all',
          requirements: [
            {
              kind: 'counterRange',
              axis: 'biomeDepthCache',
              range: { min: 4, max: 4 },
            },
            {
              kind: 'not',
              requirement: {
                kind: 'counterRange',
                axis: 'enteredBiomes',
                range: { min: 2 },
              },
            },
            {
              kind: 'any',
              requirements: [
                {
                  kind: 'counterRange',
                  axis: 'upgradableTraitCount',
                  range: { min: 1 },
                },
                {
                  kind: 'counterRange',
                  axis: 'encounterDepth',
                  range: { min: 7 },
                },
              ],
            },
          ],
        },
        baseContext,
      ),
    ).toBe(true);
  });

  it('keeps store options, the chosen room reward, records, exits, and flags distinct', () => {
    const context = {
      ...baseContext,
      records: {
        ...baseContext.records,
        lootTypeHistory: { ApolloUpgrade: 1, ZeusUpgrade: 1 },
      },
      currentRoomShopOptionNames: new Set(['TalentDrop']),
      currentRoomRewardType: 'SpellDrop',
      flags: { ...baseContext.flags, pendingSpellDrop: true },
    } satisfies RequirementEvaluationContext;

    expect(
      evaluateRequirement(
        {
          kind: 'recordCount',
          record: 'lootTypeHistory',
          keys: ['ApolloUpgrade', 'ZeusUpgrade'],
          range: { min: 2, max: 2 },
        },
        context,
      ),
    ).toBe(true);
    expect(
      evaluateRequirement(
        {
          kind: 'distinctRecordKeyCount',
          record: 'lootTypeHistory',
          keys: ['ApolloUpgrade', 'ZeusUpgrade'],
          range: { min: 2, max: 2 },
        },
        { ...context, records: { ...context.records, lootTypeHistory: { ApolloUpgrade: 5 } } },
      ),
    ).toBe(false);
    expect(
      evaluateRequirement(
        { kind: 'notInCurrentRoomShopOptions', rewardType: 'TalentDrop' },
        context,
      ),
    ).toBe(false);
    expect(
      evaluateRequirement(
        { kind: 'currentRoomRewardExcludes', rewardTypes: ['SpellDrop'] },
        context,
      ),
    ).toBe(false);
    expect(evaluateRequirement({ kind: 'minExits', count: 2 }, context)).toBe(true);
    expect(
      evaluateRequirement({ kind: 'flagEquals', flag: 'pendingSpellDrop', value: false }, context),
    ).toBe(false);
  });

  it('counts a requested encounter phase at most once per recent room', () => {
    const requirement = {
      kind: 'recentEncounterPhaseCount',
      profileKey: 'ShipCombat',
      phaseKey: 'Intro',
      roomWindow: 3,
      range: { min: 2, max: 2 },
    } as const;
    expect(
      evaluateRequirement(requirement, {
        ...baseContext,
        recentEncounterPhases: [
          { profileKey: 'Other', phaseKeys: ['Intro'] },
          { profileKey: 'ShipCombat', phaseKeys: ['Intro', 'Combat1'] },
          { profileKey: 'ShipCombat', phaseKeys: ['Intro', 'Combat1', 'Combat2'] },
        ],
      }),
    ).toBe(true);
  });

  it('matches the game spacing rule, including same-room peer generation', () => {
    const requirement = { kind: 'minRoomsSinceEvent', event: 'Devotion', count: 15 } as const;

    expect(evaluateRequirement(requirement, baseContext)).toBe(true);
    expect(
      evaluateRequirement(requirement, {
        ...baseContext,
        lastEventRunDepthCaches: { Devotion: 10 },
      }),
    ).toBe(true);
    expect(
      evaluateRequirement(requirement, {
        ...baseContext,
        runDepthCache: 24,
        lastEventRunDepthCaches: { Devotion: 10 },
      }),
    ).toBe(false);
    expect(
      evaluateRequirement(requirement, {
        ...baseContext,
        runDepthCache: 25,
        lastEventRunDepthCaches: { Devotion: 10 },
      }),
    ).toBe(true);
  });
});
