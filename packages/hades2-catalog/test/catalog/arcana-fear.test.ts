import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';

describe('Arcana and Fear catalog', () => {
  it('normalizes the complete rank-III board and ranked Vow inventory', () => {
    const arcanaMatrix = catalog.arcanaCards.values.map(
      (card) =>
        `${card.key}|${card.label}|${card.traitKey}|${card.row},${card.column}|${card.graspCost}|${
          card.activation.kind === 'manual' ? 'manual' : JSON.stringify(card.activation.rule)
        }`,
    );
    expect(arcanaMatrix).toEqual([
      'ChanneledCast|The Sorceress|ChannelSlowMetaUpgrade|1,1|1|manual',
      'HealthRegen|The Wayward Son|DoorHealMetaUpgrade|1,2|1|manual',
      'LowManaDamageBonus|The Huntress|LowManaDamageMetaupgrade|1,3|2|manual',
      'CastCount|Eternity|CastDamageMetaUpgrade|1,4|3|manual',
      'SorceryRegenUpgrade|The Moon|SorceryRegenMetaUpgrade|1,5|0|{"kind":"adjacentActive"}',
      'CastBuff|The Furies|InsideCastBuffMetaUpgrade|2,1|2|manual',
      'BonusHealth|Persistence|HealthManaBonusMetaUpgrade|2,2|2|manual',
      'BonusDodge|The Messenger|DodgeBonusMetaUpgrade|2,3|1|manual',
      'ManaOverTime|The Unseen|ManaOverTimeMetaUpgrade|2,4|5|manual',
      'MagicCrit|Night|MagicCritMetaUpgrade|2,5|2|manual',
      'SprintShield|The Swift Runner|SprintShieldMetaUpgrade|3,1|1|manual',
      'LastStand|Death|LastStandSlowTimeMetaUpgrade|3,2|4|manual',
      'MaxHealthPerRoom|The Centaur|ChamberHealthMetaUpgrade|3,3|0|{"kind":"manualCostsOneThroughFive"}',
      'StatusVulnerability|Origination|EffectVulnerabilityMetaUpgrade|3,4|5|manual',
      'ChanneledBlock|The Lovers|BossShieldMetaUpgrade|3,5|3|manual',
      'DoorReroll|The Enchantress|DoorRerollMetaUpgrade|4,1|3|manual',
      'StartingGold|The Boatman|StartingGoldMetaUpgrade|4,2|5|manual',
      'MetaToRunUpgrade|The Artificer|MetaToRunMetaUpgrade|4,3|3|manual',
      'RarityBoost|Excellence|RarityBoostMetaUpgrade|4,4|5|manual',
      'BonusRarity|The Queen|DuoRarityBoostMetaUpgrade|4,5|0|{"kind":"manualCostMultiplicityAtMost","maximum":2}',
      'TradeOff|The Fates|RerollTradeOffMetaUpgrade|5,1|0|{"kind":"surroundingCellsActive"}',
      'ScreenReroll|The Champions|PanelRerollMetaUpgrade|5,2|4|manual',
      'LowHealthBonus|Strength|LowHealthBuffMetaUpgrade|5,3|4|manual',
      'EpicRarityBoost|Divinity|EpicRarityBoostMetaUpgrade|5,4|0|{"kind":"completeOtherRowOrColumn"}',
      'CardDraw|Judgment|BossProgressionMetaUpgrade|5,5|0|{"kind":"manualCardCount","minimum":1,"maximum":3}',
    ]);
    expect(
      new Set(catalog.arcanaCards.values.map((card) => `${card.row}:${card.column}`)).size,
    ).toBe(25);
    expect(catalog.arcanaCards.values.every((card) => card.permanentRank === 3)).toBe(true);
    expect(catalog.arcanaCards.byKey.CardDraw?.postBossActivationCounts).toEqual({
      Epic: 5,
      Heroic: 6,
    });
    expect(
      catalog.fearVows.values.map(
        (vow) => `${vow.key}|${vow.label}|${vow.incrementalFear.join(',')}|${vow.circeRemovable}`,
      ),
    ).toEqual([
      'HealingReductionShrineUpgrade|Vow of Scars|1,1,2|true',
      'ShopPricesShrineUpgrade|Vow of Debt|1,1|true',
      'EnemyHealthShrineUpgrade|Vow of Grit|1,1,1|true',
      'EnemyDamageShrineUpgrade|Vow of Pain|1,2,2|true',
      'EnemySpeedShrineUpgrade|Vow of Frenzy|3,3|true',
      'EnemyShieldShrineUpgrade|Vow of Wards|1,1|true',
      'EnemyCountShrineUpgrade|Vow of Hordes|1,1,1|true',
      'EnemyRespawnShrineUpgrade|Vow of Return|1,1|true',
      'NextBiomeEnemyShrineUpgrade|Vow of Menace|1,2|true',
      'BiomeSpeedShrineUpgrade|Vow of Time|1,2,3|true',
      'MinibossCountShrineUpgrade|Vow of Shadow|2|true',
      'BossDifficultyShrineUpgrade|Vow of Rivals|2,3,3,4|false',
      'BoonSkipShrineUpgrade|Vow of Forfeit|3|true',
      'BoonManaReserveShrineUpgrade|Vow of Hubris|1,1|true',
      'BanUnpickedBoonsShrineUpgrade|Vow of Denial|2|true',
      'LimitGraspShrineUpgrade|Vow of Void|1,1,1,2|true',
      'EnemyEliteShrineUpgrade|Vow of Fangs|2,3|true',
    ]);
    expect(catalog.fearVows.byKey.BanUnpickedBoonsShrineUpgrade?.effect).toEqual({
      kind: 'banUnselectedTraits',
      count: 2,
    });
    expect(
      catalog.traitGivers.values
        .filter((giver) => giver.denialParticipates)
        .map((giver) => giver.key),
    ).toEqual([
      'Aphrodite',
      'Apollo',
      'Ares',
      'Demeter',
      'Hephaestus',
      'Hera',
      'Hestia',
      'Poseidon',
      'Zeus',
      'Hermes',
    ]);
  });

  it('rejects incomplete boards, unknown attached traits, and invalid Vow ranks', () => {
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          givers: [...declarations.traitCatalog.givers].reverse(),
        },
      }),
    ).not.toThrow();
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          givers: declarations.traitCatalog.givers.map((giver) =>
            giver.key === 'Hermes' ? { ...giver, denialParticipates: false } : giver,
          ),
        },
      }),
    ).toThrow(/missing: Hermes/);
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          givers: declarations.traitCatalog.givers.map((giver) =>
            giver.key === 'Medea' ? { ...giver, denialParticipates: true } : giver,
          ),
        },
      }),
    ).toThrow(/unexpected: Medea/);
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          givers: declarations.traitCatalog.givers.map((giver) =>
            giver.key === 'Hermes' ? { ...giver, denialParticipates: 'yes' } : giver,
          ) as unknown as typeof declarations.traitCatalog.givers,
        },
      }),
    ).toThrow(/denialParticipates.*boolean/);
    expect(() =>
      createCatalog({ ...declarations, arcanaCards: declarations.arcanaCards.slice(1) }),
    ).toThrow(/must declare all 25 cards/);
    expect(() =>
      createCatalog({
        ...declarations,
        arcanaCards: declarations.arcanaCards.map((card, index) =>
          index === 0 ? { ...card, traitKey: 'MissingArcanaTrait' } : card,
        ),
      }),
    ).toThrow(/unknown trait MissingArcanaTrait/);
    expect(() =>
      createCatalog({
        ...declarations,
        arcanaCards: declarations.arcanaCards.map((card) => {
          if (card.key !== 'CardDraw') return card;
          return Object.fromEntries(
            Object.entries(card).filter(([key]) => key !== 'postBossActivationCounts'),
          ) as unknown as typeof card;
        }),
      }),
    ).toThrow(/Judgment must declare only Epic and Heroic counts/);
    expect(() =>
      createCatalog({
        ...declarations,
        arcanaCards: declarations.arcanaCards.map((card) =>
          card.key === 'CastCount'
            ? { ...card, postBossActivationCounts: { Epic: 5, Heroic: 6 } }
            : card,
        ),
      }),
    ).toThrow(/only Judgment may declare post-Boss activation counts/);
    expect(() =>
      createCatalog({
        ...declarations,
        arcanaCards: declarations.arcanaCards.map((card) =>
          card.key === 'CardDraw'
            ? { ...card, postBossActivationCounts: { Epic: 0, Heroic: 6 } }
            : card,
        ),
      }),
    ).toThrow(/must be a positive integer/);
    expect(() =>
      createCatalog({
        ...declarations,
        fearVows: declarations.fearVows.map((vow) =>
          vow.key === 'BanUnpickedBoonsShrineUpgrade'
            ? Object.fromEntries(Object.entries(vow).filter(([key]) => key !== 'effect'))
            : vow,
        ) as unknown as typeof declarations.fearVows,
      }),
    ).toThrow(/Denial must declare/);
    expect(() =>
      createCatalog({
        ...declarations,
        fearVows: declarations.fearVows.map((vow) =>
          vow.key === 'BoonSkipShrineUpgrade'
            ? { ...vow, effect: { kind: 'banUnselectedTraits', count: 2 } }
            : vow,
        ),
      }),
    ).toThrow(/only Vow of Denial/);
    expect(() =>
      createCatalog({
        ...declarations,
        arcanaCards: declarations.arcanaCards.map((card) =>
          card.key === 'CardDraw'
            ? { ...card, postBossActivationCounts: { Epic: 6, Heroic: 5 } }
            : card,
        ),
      }),
    ).toThrow(/Heroic count must not be lower than Epic/);
    expect(() =>
      createCatalog({
        ...declarations,
        fearVows: declarations.fearVows.map((vow, index) =>
          index === 0 ? { ...vow, incrementalFear: [0] } : vow,
        ),
      }),
    ).toThrow(/must be a positive integer/);
    expect(() =>
      createCatalog({
        ...declarations,
        arcanaCards: declarations.arcanaCards.map((card, index) =>
          index === 0 ? { ...card, graspCost: 0 } : card,
        ),
      }),
    ).toThrow(/manual cards must have a positive Grasp cost/);
  });
});
