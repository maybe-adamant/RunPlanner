import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { deriveRunStateEffects } from '../../../src/simulation/rewards/run-state-effects';
import type { SimulationState } from '../../../src/simulation/state/model';
import { initializeTestRewardBranches } from '../../support/arcana-fear';

const base = initializeTestRewardBranches()[0]!.state;
const occurrence = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('run-state-effects'),
);

function withState(patch: Partial<SimulationState>): SimulationState {
  return Object.freeze({ ...base, ...patch });
}

function equipped(
  traitKeys: readonly string[],
  identities: readonly string[] = [],
): SimulationState['traitHistory']['equippedTraits'] {
  return Object.freeze(
    Object.fromEntries(
      traitKeys.map((traitKey, index) => [
        traitKey,
        {
          traitKey,
          giverKey: 'test',
          providerKind: 'god',
          sourceRole: 'test',
          ...(identities[index] === undefined ? {} : { acquisitionIdentity: identities[index] }),
        },
      ]),
    ),
  ) as unknown as SimulationState['traitHistory']['equippedTraits'];
}

function offer(sequence: number, acquisitionIdentity: string, traitKey = 'ZeusWeaponBoon') {
  return {
    kind: 'traitOffer',
    sequence,
    acquisitionIdentity,
    options: [{ traitKey, rarity: 'Common' }],
    selectedOptionKey: 'option1',
  };
}

function wellTimedItem() {
  const option = catalog.rewards.shops.byKey
    .RoomShop!.groups.values.flatMap((group) => group.options.values)
    .find((candidate) => candidate.stygianWell?.grant.kind === 'timedTrait')!;
  const grant = option.stygianWell!.grant as Extract<
    NonNullable<typeof option.stygianWell>['grant'],
    { kind: 'timedTrait' }
  >;
  return { option, grant };
}

describe('Run State effect clocks', () => {
  it('states Well timed buffs and held charges as countdowns of what is left', () => {
    const { option, grant } = wellTimedItem();
    const source = { occurrence, generationKey: 'slot-1' } as never;
    const yarn = catalog.rewards.shops.byKey
      .RoomShop!.groups.values.flatMap((group) => group.options.values)
      .find((candidate) => {
        const charge = candidate.stygianWell?.grant;
        return charge?.kind === 'charge' && charge.charge === 'yarn';
      })!;
    const effects = deriveRunStateEffects(
      catalog,
      withState({
        stygianWell: Object.freeze({
          ...base.stygianWell,
          yarnUses: 2,
          timedInstances: Object.freeze([
            {
              itemKey: option.key,
              traitKey: grant.traitKey,
              clock: grant.clock,
              remainingUses: 1,
              source,
            },
            {
              itemKey: option.key,
              traitKey: grant.traitKey,
              clock: 'bosses' as const,
              remainingUses: 2,
              source,
            },
          ]),
        }),
      }),
    );
    expect(effects.stygianWell).toEqual([
      { itemKey: option.key, clock: { unit: grant.clock, direction: 'remaining', value: 1 } },
      { itemKey: option.key, clock: { unit: 'guardians', direction: 'remaining', value: 2 } },
      { itemKey: yarn.key, clock: { unit: 'charges', direction: 'remaining', value: 2 } },
    ]);
  });

  it('names Chaos curse clocks in game units and surfaces Barren', () => {
    const effects = deriveRunStateEffects(
      catalog,
      withState({
        traitHistory: Object.freeze({
          ...base.traitHistory,
          activeChaosCurses: Object.freeze([
            {
              acquisitionIdentity: 'a',
              owner: occurrence,
              curseKey: 'ChaosHiddenRoomRewardCurse',
              duration: 5,
              remaining: 3,
              clock: 'locations' as const,
              curseValues: {},
              blessingKey: 'ChaosHealthBlessing',
              rarity: 'Rare' as const,
              blessingValues: {},
            },
            {
              acquisitionIdentity: 'b',
              owner: occurrence,
              curseKey: 'ChaosMetaUpgradeCurse',
              duration: 4,
              remaining: 2,
              clock: 'encounters' as const,
              semanticTag: 'Barren' as const,
              curseValues: {},
              blessingKey: 'ChaosHealthBlessing',
              rarity: 'Common' as const,
              blessingValues: {},
            },
          ]),
        }),
      }),
    );
    expect(effects.chaosCurses.map((curse) => curse.clock)).toEqual([
      { unit: 'rooms', direction: 'remaining', value: 3 },
      { unit: 'encounters', direction: 'remaining', value: 2 },
    ]);
    expect(effects.arcanaBarren).toEqual({ unit: 'encounters', direction: 'remaining', value: 2 });
  });

  it('counts each Path of Stars talent once per invested node, in first-investment order', () => {
    const effects = deriveRunStateEffects(
      catalog,
      withState({
        hexProgress: Object.freeze({
          spellTraitKey: 'X',
          tree: Object.freeze({
            layoutKey: 'Lung' as const,
            nodes: Object.freeze({ '1:1': 'TalentA', '2:1': 'TalentB', '2:2': 'TalentA' }),
          }),
          bankedPathPoints: 0,
          investedNodeKeys: Object.freeze(['1:1', '2:1', '2:2']),
        }),
      }),
    );
    expect(effects.hexTalents).toEqual([
      { talentKey: 'TalentA', level: 2 },
      { talentKey: 'TalentB', level: 1 },
    ]);
  });

  it('states the equipped keepsake first with its effect and rank', () => {
    const cardKey = catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === 'callingCard',
    )!.key;
    const effects = deriveRunStateEffects(
      catalog,
      withState({
        keepsakes: Object.freeze({
          ...base.keepsakes,
          currentKey: cardKey,
          callingCard: Object.freeze({ remainingCharges: 2 }),
        }),
      }),
    );
    expect(effects.keepsakes[0]).toEqual({
      keepsakeKey: cardKey,
      rank: catalog.keepsakes.byKey[cardKey]!.rank,
      state: { kind: 'clock', clock: { unit: 'charges', direction: 'remaining', value: 2 } },
    });
  });

  it('publishes Infusion activation from folded element facts and scaling element counts', () => {
    const traitStatesAt = (
      traitKeys: readonly string[],
      elementCounts: SimulationState['traitHistory']['elementCounts'],
    ) =>
      deriveRunStateEffects(
        catalog,
        withState({
          traitHistory: Object.freeze({
            ...base.traitHistory,
            equippedTraits: equipped(traitKeys),
            elementCounts,
            highestBaseElementCount: Math.max(
              elementCounts.Earth,
              elementCounts.Air,
              elementCounts.Fire,
              elementCounts.Water,
            ),
          }),
        }),
      ).traitStates;
    const infusions = [
      'ElementalRarityUpgradeBoon',
      'ElementalUnifiedBoon',
      'ElementalRallyBoon',
      'ElementalDamageFloorBoon',
      'ElementalHealthBoon',
    ];
    const active = { kind: 'status', status: 'active' };
    const inactive = { kind: 'status', status: 'inactive' };
    expect(traitStatesAt(infusions, { Aether: 0, Earth: 2, Air: 5, Fire: 2, Water: 4 })).toEqual({
      ElementalRarityUpgradeBoon: active,
      ElementalUnifiedBoon: inactive,
      ElementalRallyBoon: inactive,
      ElementalDamageFloorBoon: active,
      ElementalHealthBoon: { kind: 'elementCount', element: 'Water', count: 4 },
    });
    expect(traitStatesAt(infusions, { Aether: 9, Earth: 1, Air: 4, Fire: 8, Water: 0 })).toEqual({
      ElementalRarityUpgradeBoon: inactive,
      ElementalUnifiedBoon: active,
      ElementalRallyBoon: active,
      ElementalDamageFloorBoon: inactive,
      ElementalHealthBoon: { kind: 'elementCount', element: 'Water', count: 0 },
    });
  });

  it('marks Gold Gold Gold pending while equipped and consumed in its acquisition place', () => {
    const effectsWith = (traitHistory: Partial<SimulationState['traitHistory']>) =>
      deriveRunStateEffects(
        catalog,
        withState({ traitHistory: Object.freeze({ ...base.traitHistory, ...traitHistory }) }),
      );
    const pending = effectsWith({
      equippedTraits: equipped(['EchoDoubleShop']),
      events: Object.freeze([offer(1, 'b', 'EchoDoubleShop')]) as never,
    });
    expect(pending.traitStates.EchoDoubleShop).toEqual({ kind: 'status', status: 'pending' });
    const consumed = effectsWith({
      equippedTraits: equipped(['ZeusWeaponBoon', 'HeraManaBoon'], ['a', 'c']),
      events: Object.freeze([
        offer(1, 'a'),
        offer(2, 'b', 'EchoDoubleShop'),
        offer(3, 'c'),
        {
          kind: 'traitRemoval',
          sequence: 4,
          traitKey: 'EchoDoubleShop',
          acquisitionIdentity: 'b',
          acquisitionRole: 'echoShopDuplicateConsumed',
        },
      ]) as never,
    });
    expect(consumed.traitEntries).toEqual([
      { kind: 'trait', traitKey: 'ZeusWeaponBoon' },
      { kind: 'consumedTrait', traitKey: 'EchoDoubleShop', acquisitionIdentity: 'b' },
      { kind: 'trait', traitKey: 'HeraManaBoon' },
    ]);
  });

  it('orders matured Chaos blessings among traits by acquisition', () => {
    const effects = deriveRunStateEffects(
      catalog,
      withState({
        traitHistory: Object.freeze({
          ...base.traitHistory,
          equippedTraits: equipped(['ZeusWeaponBoon', 'HeraManaBoon'], ['a', 'c']),
          events: Object.freeze([
            offer(1, 'a'),
            { kind: 'chaosPair', sequence: 2, acquisitionIdentity: 'b' },
            offer(3, 'c'),
          ]) as never,
          maturedChaosBlessings: Object.freeze([
            {
              acquisitionIdentity: 'b',
              blessingKey: 'ChaosHealthBlessing',
              rarity: 'Epic' as const,
              blessingValues: {},
            },
          ]),
        }),
      }),
    );
    expect(effects.traitEntries).toEqual([
      { kind: 'trait', traitKey: 'ZeusWeaponBoon' },
      {
        kind: 'chaosBlessing',
        acquisitionIdentity: 'b',
        blessingKey: 'ChaosHealthBlessing',
        rarity: 'Epic',
      },
      { kind: 'trait', traitKey: 'HeraManaBoon' },
    ]);
  });

  it('gives a keepsake-granted Hammer its encounters left as an ordinary trait clock', () => {
    const hammer = catalog.traits.values.find((trait) => trait.hammerCompatibility !== undefined)!;
    const effects = deriveRunStateEffects(
      catalog,
      withState({
        traitHistory: Object.freeze({
          ...base.traitHistory,
          equippedTraits: equipped([hammer.key]),
        }),
        keepsakes: Object.freeze({
          ...base.keepsakes,
          experimentalHammers: Object.freeze([
            { traitKey: hammer.key, remainingUses: 3, acquisitionIdentity: 'h', active: true },
          ]),
        }),
      }),
    );
    expect(effects.traitStates[hammer.key]).toEqual({
      kind: 'clock',
      clock: { unit: 'encounters', direction: 'remaining', value: 3 },
    });
  });

  it('states one-use keepsake effects while equipped and a spent Gorgon as used', () => {
    const owner = (kind: string) =>
      catalog.keepsakes.values.find((keepsake) => keepsake.effect?.kind === kind)!.key;
    const stateOf = (kind: string, keepsakes: Partial<SimulationState['keepsakes']>) =>
      deriveRunStateEffects(
        catalog,
        withState({
          keepsakes: Object.freeze({ ...base.keepsakes, currentKey: owner(kind), ...keepsakes }),
        }),
      ).keepsakes[0]?.state;
    expect(
      stateOf('gorgonAmulet', { gorgon: Object.freeze({ status: 'pending', rarityLevel: 1 }) }),
    ).toEqual({ kind: 'clock', clock: { unit: 'charges', direction: 'remaining', value: 1 } });
    expect(stateOf('gorgonAmulet', { gorgon: Object.freeze({ status: 'expired' }) })).toEqual({
      kind: 'status',
      status: 'used',
    });
    expect(stateOf('gorgonAmulet', { gorgon: Object.freeze({ status: 'consumed' }) })).toEqual({
      kind: 'status',
      status: 'used',
    });
    expect(stateOf('fountainRarity', { phial: Object.freeze({ status: 'pending' }) })).toEqual({
      kind: 'status',
      status: 'ready',
    });
    expect(
      stateOf('concaveStone', {
        stone: Object.freeze({ origin: 'ordinary', status: 'pending', rank: 'Common' }),
      }),
    ).toEqual({ kind: 'status', status: 'active' });
    expect(
      stateOf('crystalFigurine', {
        figurine: Object.freeze({ origin: 'ordinary', status: 'consumed', rarity: 'Common' }),
      }),
    ).toEqual({ kind: 'status', status: 'used' });
  });

  it('states a forced-boon keepsake ready until delivered and Jeweled Pom active or inactive', () => {
    const bangle = 'ForceZeusBoonKeepsake';
    const forced = (remainingForceUses: 0 | 1) =>
      deriveRunStateEffects(
        catalog,
        withState({
          keepsakes: Object.freeze({
            ...base.keepsakes,
            currentKey: bangle,
            olympianSources: Object.freeze([
              {
                keepsakeKey: bangle,
                providerKey: 'Zeus',
                origin: 'ordinary' as const,
                acquisitionOrder: 0,
                remainingForceUses,
                remainingRarificationUses: 1,
                maximumSourceRarityLevel: 3,
              },
            ]),
          }) as SimulationState['keepsakes'],
        }),
      ).keepsakes[0]?.state;
    expect(forced(1)).toEqual({ kind: 'status', status: 'ready' });
    expect(forced(0)).toEqual({ kind: 'status', status: 'used' });
    const pom = (active: boolean) =>
      deriveRunStateEffects(
        catalog,
        withState({
          keepsakes: Object.freeze({
            ...base.keepsakes,
            currentKey: 'HadesAndPersephoneKeepsake',
            jeweledPom: Object.freeze({
              grantedTraitKey: 'X',
              active,
              levels: 1,
              acquisitionIdentity: 'p',
            }),
          }),
        }),
      ).keepsakes[0]?.state;
    expect(pom(true)).toEqual({ kind: 'status', status: 'active' });
    expect(pom(false)).toEqual({ kind: 'status', status: 'inactive' });
  });

  it('ranks the equipped aspect V, or VI once a Perfect-raising trait was picked', () => {
    const perfect = catalog.traits.values.find((trait) => trait.raisesAspectToPerfect === true)!;
    const aspectKey = catalog.aspects.values[0]!.key;
    const rankWith = (previouslyPickedTraitKeys: readonly string[]) =>
      deriveRunStateEffects(
        catalog,
        withState({
          equipment: Object.freeze({ ...base.equipment, aspectKey }),
          traitHistory: Object.freeze({
            ...base.traitHistory,
            previouslyPickedTraitKeys: Object.freeze([...previouslyPickedTraitKeys]),
          }),
        }),
      ).aspect;
    expect(rankWith([])).toEqual({ aspectKey, rank: 5 });
    expect(rankWith([perfect.key])).toEqual({ aspectKey, rank: 6 });
  });

  it('lists one keepsake chain per entered biome with a postboss choice on the biome it ends', () => {
    const effects = deriveRunStateEffects(
      catalog,
      withState({
        reached: Object.freeze({
          ...base.reached,
          routePosition: Object.freeze({
            ...base.reached.routePosition,
            ordinal: 3,
            itineraryBiomeKeys: Object.freeze(['F', 'G', 'H', 'I']),
          }),
        }),
        keepsakes: Object.freeze({
          ...base.keepsakes,
          history: Object.freeze([
            { key: 'RarifyKeepsake', kind: 'start' as const, biomeNumber: 1 },
            { key: 'ManaOverTimeRefundKeepsake', kind: 'replace' as const, biomeNumber: 2 },
            { key: 'GoldifyKeepsake', kind: 'replace' as const, biomeNumber: 4 },
          ]),
        }),
      }),
    );
    expect(effects.keepsakeHistory).toEqual([
      { biomeKey: 'F', keepsakeKeys: ['RarifyKeepsake', 'ManaOverTimeRefundKeepsake'] },
      { biomeKey: 'G', keepsakeKeys: ['ManaOverTimeRefundKeepsake'] },
      { biomeKey: 'H', keepsakeKeys: ['ManaOverTimeRefundKeepsake', 'GoldifyKeepsake'] },
    ]);
  });

  it('reports pending Shrine deliveries as encounter countdowns', () => {
    const effects = deriveRunStateEffects(
      catalog,
      withState({
        pendingHermesShrineDeliveries: Object.freeze({
          entry: {
            entryKey: 'entry',
            source: occurrence,
            generationKey: 'slot' as never,
            rewardType: 'SpellDrop',
            rushed: false,
            remainingUses: 2,
          },
        }),
      }),
    );
    expect(effects.hermesDeliveries).toEqual([
      {
        entryKey: 'entry',
        rewardType: 'SpellDrop',
        clock: { unit: 'encounters', direction: 'remaining', value: 2 },
      },
    ]);
  });
});
