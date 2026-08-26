import { catalog } from '@run-planner/hades2-catalog';
import {
  activateTemporaryArcana,
  artificerStatus,
  createArcanaFearState,
  promoteArcana,
  suppressFearVow,
  beginBiomeArcanaFearState,
  consumeOrdinaryRoomForfeit,
} from '@run-planner/engine/simulation';
import { createBiomeAddress } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { circeResolutionDomain, judgmentRequiredCount } from '../../src/simulation/arcana-fear';
import {
  initializeRewardBranches,
  publicRewardBranch,
} from '../../src/simulation/rewards/processing';
import { mergeEquivalentRewardBranches } from '../../src/simulation/rewards/branch-primitives';
import { forfeitStatus } from '../../src/simulation/rewards/run-state';

describe('progressive Arcana and Fear state', () => {
  it('uses source rarity for lower-rank temporary Arcana and orders distinct same-seam owners', () => {
    const defaults = createDefaultRouteLoadout(catalog);
    const seeded = createArcanaFearState(catalog, defaults);
    const state = Object.freeze({
      ...seeded,
      arcana: Object.freeze({
        ...seeded.arcana,
        active: Object.freeze(
          seeded.arcana.active.filter(
            (card) => !['CardDraw', 'MetaToRunUpgrade', 'ChanneledCast'].includes(card.key),
          ),
        ),
      }),
    });
    const judgmentOwner = createBiomeAddress('Underworld', 'F');
    const figurineOwner = createBiomeAddress('Underworld', 'G');
    const common = activateTemporaryArcana(
      catalog,
      state,
      ['CardDraw', 'MetaToRunUpgrade'],
      {
        owner: judgmentOwner,
        sequence: 7,
      },
      'Common',
    );
    expect(common.legal).toBe(true);
    if (!common.legal) throw new Error('Common temporary activation should be legal');
    expect(judgmentRequiredCount(catalog, common.state)).toBe(3);
    expect(artificerStatus(catalog, common.state)).toMatchObject({
      rarity: 'Common',
      capacity: 1,
    });
    const rare = activateTemporaryArcana(
      catalog,
      common.state,
      ['ChanneledCast'],
      {
        owner: figurineOwner,
        sequence: 7,
      },
      'Rare',
    );
    expect(rare.legal).toBe(true);
    if (!rare.legal) throw new Error('Distinct same-seam activation should be legal');
    expect(rare.state.arcana.active.find((card) => card.key === 'ChanneledCast')).toMatchObject({
      rarity: 'Rare',
    });
    expect(
      activateTemporaryArcana(
        catalog,
        rare.state,
        ['LowManaDamageBonus'],
        {
          owner: figurineOwner,
          sequence: 7,
        },
        'Rare',
      ),
    ).toMatchObject({ legal: false, reason: 'staleChronology' });
    expect(
      activateTemporaryArcana(
        catalog,
        rare.state,
        ['LowManaDamageBonus'],
        {
          owner: judgmentOwner,
          sequence: 7,
        },
        'Common',
      ),
    ).toMatchObject({ legal: false, reason: 'staleChronology' });
  });

  it('keeps Circe and Judgment temporary activation and promotion outside starting Grasp', () => {
    const defaults = createDefaultRouteLoadout(catalog);
    const state = createArcanaFearState(catalog, {
      ...defaults,
      fearRanks: { ...defaults.fearRanks, LimitGraspShrineUpgrade: 4 },
    });
    const owner = createBiomeAddress('Underworld', 'F');
    const activated = activateTemporaryArcana(catalog, state, ['ManaOverTime', 'CardDraw'], {
      owner,
      sequence: 1,
    });
    expect(activated).toMatchObject({ legal: true });
    if (!activated.legal) throw new Error('temporary Arcana should bypass starting Grasp');
    expect(activated.state.arcana.active).toEqual([
      { key: 'ManaOverTime', origin: 'temporary', rarity: 'Epic' },
      { key: 'CardDraw', origin: 'temporary', rarity: 'Epic' },
    ]);
    expect(
      promoteArcana(catalog, activated.state, ['ManaOverTime'], { owner, sequence: 2 }),
    ).toMatchObject({
      legal: true,
      state: {
        arcana: {
          active: expect.arrayContaining([
            { key: 'ManaOverTime', origin: 'temporary', rarity: 'Heroic' },
          ]),
        },
      },
    });
  });

  it('consumes Forfeit once per biome only while effective, retaining chronology evidence', () => {
    const loadout = createDefaultRouteLoadout(catalog);
    const state = createArcanaFearState(catalog, {
      ...loadout,
      fearRanks: { ...loadout.fearRanks, BoonSkipShrineUpgrade: 1 },
    });
    const owner = createBiomeAddress('Underworld', 'F');
    const consumed = consumeOrdinaryRoomForfeit(catalog, state, 'Boon', { owner, sequence: 1 });
    expect(consumed).toMatchObject({ consumed: true, state: { fear: { forfeitConsumed: true } } });
    expect(
      consumeOrdinaryRoomForfeit(catalog, consumed.state, 'HermesUpgrade', { owner, sequence: 2 }),
    ).toMatchObject({ consumed: false });
    expect(
      consumeOrdinaryRoomForfeit(catalog, consumed.state, 'HermesUpgrade', { owner, sequence: 1 }),
    ).toMatchObject({ consumed: false });
    expect(beginBiomeArcanaFearState(consumed.state).fear.forfeitConsumed).toBe(false);
    expect(
      consumeOrdinaryRoomForfeit(catalog, createArcanaFearState(catalog, loadout), 'Boon', {
        owner,
        sequence: 1,
      }),
    ).toMatchObject({ consumed: false });
  });

  it('keeps consumed status after Circe suppression and resets usage only at biome handoff', () => {
    const loadout = createDefaultRouteLoadout(catalog);
    const state = createArcanaFearState(catalog, {
      ...loadout,
      fearRanks: { ...loadout.fearRanks, BoonSkipShrineUpgrade: 1 },
    });
    const owner = createBiomeAddress('Underworld', 'F');
    expect(forfeitStatus(state)).toBe('available');
    const consumed = consumeOrdinaryRoomForfeit(catalog, state, 'Boon', {
      owner,
      sequence: 1,
    });
    expect(consumed.consumed).toBe(true);
    expect(forfeitStatus(consumed.state)).toBe('consumed');
    const suppressed = suppressFearVow(catalog, consumed.state, 'BoonSkipShrineUpgrade', {
      owner,
      sequence: 2,
    });
    expect(suppressed.legal).toBe(true);
    if (!suppressed.legal) throw new Error('Forfeit suppression should be legal');
    expect(suppressed.state.fear.effectiveRanks.BoonSkipShrineUpgrade).toBe(0);
    expect(forfeitStatus(suppressed.state)).toBe('consumed');

    const branch = Object.freeze({
      ...initializeTestRewardBranches(consumed.state)[0]!,
      arcanaFear: consumed.state,
    });
    const nextBiome = initializeRewardBranches([publicRewardBranch(branch)])[0]!;
    expect(nextBiome.arcanaFear.fear.forfeitConsumed).toBe(false);
    expect(forfeitStatus(nextBiome.arcanaFear)).toBe('available');
    expect(
      consumeOrdinaryRoomForfeit(catalog, nextBiome.arcanaFear, 'HermesUpgrade', {
        owner: createBiomeAddress('Underworld', 'G'),
        sequence: 3,
      }),
    ).toMatchObject({ consumed: true });
  });
  it('seeds manual and automatic origins at Epic, then retains chronological closed transitions', () => {
    const initial = createDefaultRouteLoadout(catalog);
    const state = createArcanaFearState(catalog, {
      ...initial,
      manualArcanaKeys: ['CastCount'],
      fearRanks: { ...initial.fearRanks, EnemyDamageShrineUpgrade: 2 },
    });
    const evidence = { owner: createBiomeAddress('Underworld', 'F'), sequence: 1 };
    expect(state.arcana.active).toEqual([
      { key: 'CastCount', origin: 'manual', rarity: 'Epic' },
      { key: 'SorceryRegenUpgrade', origin: 'automatic', rarity: 'Epic' },
      { key: 'BonusRarity', origin: 'automatic', rarity: 'Epic' },
      { key: 'CardDraw', origin: 'automatic', rarity: 'Epic' },
    ]);
    const activated = activateTemporaryArcana(catalog, state, ['TradeOff'], evidence);
    expect(activated.legal).toBe(true);
    if (!activated.legal) throw new Error('activation should be legal');
    const promoted = promoteArcana(catalog, activated.state, ['TradeOff'], {
      ...evidence,
      sequence: 2,
    });
    expect(promoted.legal).toBe(true);
    if (!promoted.legal) throw new Error('promotion should be legal');
    const suppressed = suppressFearVow(catalog, promoted.state, 'EnemyDamageShrineUpgrade', {
      ...evidence,
      sequence: 3,
    });
    expect(suppressed.legal).toBe(true);
    if (!suppressed.legal) throw new Error('suppression should be legal');
    expect(suppressed.state.arcana.active.find((card) => card.key === 'TradeOff')).toMatchObject({
      origin: 'temporary',
      rarity: 'Heroic',
    });
    expect(suppressed.state.fear).toMatchObject({
      configuredTotal: 3,
      effectiveRanks: { EnemyDamageShrineUpgrade: 0 },
    });
    expect(suppressed.state.events).toEqual([
      { kind: 'temporaryArcanaActivated', arcanaKeys: ['TradeOff'], ...evidence },
      { kind: 'arcanaPromoted', arcanaKeys: ['TradeOff'], ...evidence, sequence: 2 },
      { kind: 'fearVowSuppressed', vowKey: 'EnemyDamageShrineUpgrade', ...evidence, sequence: 3 },
    ]);
  });

  it('rejects unknown, already-active, Heroic, inactive, and non-removable transitions', () => {
    const loadout = createDefaultRouteLoadout(catalog);
    const state = createArcanaFearState(catalog, loadout);
    const evidence = { owner: createBiomeAddress('Underworld', 'F'), sequence: 1 };
    expect(activateTemporaryArcana(catalog, state, ['unknown'], evidence)).toMatchObject({
      legal: false,
      reason: 'unknownArcana',
      state,
    });
    expect(
      activateTemporaryArcana(catalog, state, ['ChanneledCast', 'ChanneledCast'], evidence),
    ).toMatchObject({ legal: false, reason: 'duplicateTarget', state });
    expect(promoteArcana(catalog, state, ['ChanneledCast'], evidence)).toMatchObject({
      legal: false,
      reason: 'arcanaNotActive',
      state,
    });
    expect(suppressFearVow(catalog, state, 'BossDifficultyShrineUpgrade', evidence)).toMatchObject({
      legal: false,
      reason: 'vowNotCirceRemovable',
      state,
    });
    const active = activateTemporaryArcana(catalog, state, ['ChanneledCast'], evidence);
    if (!active.legal) throw new Error('fixture activation should be legal');
    const heroic = promoteArcana(catalog, active.state, ['ChanneledCast'], {
      ...evidence,
      sequence: 2,
    });
    if (!heroic.legal) throw new Error('fixture promotion should be legal');
    expect(
      promoteArcana(catalog, heroic.state, ['ChanneledCast'], { ...evidence, sequence: 3 }),
    ).toMatchObject({ legal: false, reason: 'arcanaNotEpic' });
    expect(activateTemporaryArcana(catalog, active.state, ['CastCount'], evidence)).toMatchObject({
      legal: false,
      reason: 'staleChronology',
    });
  });

  it('keeps branches distinct when their explicit progressive state differs', () => {
    const state = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));
    const evidence = { owner: createBiomeAddress('Underworld', 'F'), sequence: 1 };
    const base = initializeTestRewardBranches(state)[0]!;
    const distinct = Object.freeze({
      ...base,
      arcanaFear: activateTemporaryArcana(catalog, state, ['ChanneledCast'], evidence).state,
    });
    expect(mergeEquivalentRewardBranches([base, distinct])).toHaveLength(2);
  });

  it('derives the complete Circe target product and catalog-owned Judgment count once', () => {
    const loadout = createDefaultRouteLoadout(catalog);
    const state = createArcanaFearState(catalog, {
      ...loadout,
      manualArcanaKeys: ['CastCount'],
      fearRanks: { ...loadout.fearRanks, EnemyDamageShrineUpgrade: 1 },
    });
    expect(circeResolutionDomain(catalog, state, 'activateArcana')).toMatchObject({
      requiredCount: 1,
      outerAvailable: true,
    });
    expect(circeResolutionDomain(catalog, state, 'promoteArcana')).toMatchObject({
      requiredCount: 2,
      outerAvailable: true,
      arcanaKeys: ['CastCount', 'SorceryRegenUpgrade', 'BonusRarity', 'CardDraw'],
    });
    expect(circeResolutionDomain(catalog, state, 'disableFear')).toMatchObject({
      requiredCount: 1,
      vowKeys: ['EnemyDamageShrineUpgrade'],
      outerAvailable: true,
    });
    expect(judgmentRequiredCount(catalog, state)).toBe(5);
  });
});
