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
  });

  it('rejects incomplete boards, unknown attached traits, and invalid Vow ranks', () => {
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
