import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createProjectDocument,
  planFearRanksReplacement,
  planManualArcanaReplacement,
  type LoadoutReplacement,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

const FULL_GRASP = [
  'ManaOverTime',
  'StatusVulnerability',
  'StartingGold',
  'RarityBoost',
  'LastStand',
  'ScreenReroll',
  'BonusHealth',
];

function project(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'loadout',
    name: 'Loadout',
    routeKey: 'Underworld',
    configuredBiomeCount: 1,
  });
}

function apply(document: ProjectDocument, plan: LoadoutReplacement): ProjectDocument {
  if (plan.kind !== 'apply') throw new Error(`expected commands, got ${plan.kind}`);
  return plan.commands.reduce(
    (next, command) => applyProjectCommand(next, catalog, command),
    document,
  );
}

const withRanks = (ranks: Readonly<Record<string, number>>) =>
  apply(project(), planFearRanksReplacement(catalog, 'Underworld', project().route.loadout, ranks));

describe('loadout replacement', () => {
  it('replaces the manual Arcana in catalog order, or says the loadout already has them', () => {
    const start = project();
    const plan = planManualArcanaReplacement(catalog, 'Underworld', start.route.loadout, [
      'LastStand',
      'ChanneledCast',
    ]);
    expect(plan).toMatchObject({
      kind: 'apply',
      commands: [
        { kind: 'ReplaceManualArcanaSelection', arcanaKeys: ['ChanneledCast', 'LastStand'] },
      ],
    });
    const replaced = apply(start, plan);
    expect(replaced.route.loadout.manualArcanaKeys).toEqual(['ChanneledCast', 'LastStand']);
    expect(
      planManualArcanaReplacement(catalog, 'Underworld', replaced.route.loadout, [
        'LastStand',
        'ChanneledCast',
      ]),
    ).toEqual({ kind: 'unchanged' });
    // An empty selection clears them.
    expect(
      apply(
        replaced,
        planManualArcanaReplacement(catalog, 'Underworld', replaced.route.loadout, []),
      ).route.loadout.manualArcanaKeys,
    ).toEqual([]);
  });

  it('refuses Arcana the current Vows cannot hold', () => {
    const voided = withRanks({ LimitGraspShrineUpgrade: 2 });
    expect(
      planManualArcanaReplacement(catalog, 'Underworld', voided.route.loadout, FULL_GRASP),
    ).toEqual({ kind: 'refused', grasp: { cost: 30, capacity: 12, legal: false } });
  });

  it('replaces every Vow rank, the ones left out at 0, changing only those that differ', () => {
    const start = withRanks({ EnemyDamageShrineUpgrade: 2, ShopPricesShrineUpgrade: 1 });
    const plan = planFearRanksReplacement(catalog, 'Underworld', start.route.loadout, {
      EnemyDamageShrineUpgrade: 2,
      EnemyHealthShrineUpgrade: 3,
    });
    if (plan.kind !== 'apply') throw new Error('expected commands');
    const changed: Readonly<Record<string, number>> = {
      EnemyHealthShrineUpgrade: 3,
      ShopPricesShrineUpgrade: 0,
    };
    // In catalog order, so the same preset always writes the same steps.
    expect(
      plan.commands.map((command) =>
        command.kind === 'ReplaceFearVowRank' ? [command.vowKey, command.rank] : command.kind,
      ),
    ).toEqual(
      catalog.fearVows.values
        .filter((vow) => vow.key in changed)
        .map((vow) => [vow.key, changed[vow.key]]),
    );
    const replaced = apply(start, plan);
    expect(replaced.route.loadout.fearRanks).toMatchObject({
      EnemyDamageShrineUpgrade: 2,
      EnemyHealthShrineUpgrade: 3,
      ShopPricesShrineUpgrade: 0,
    });
    expect(
      planFearRanksReplacement(catalog, 'Underworld', replaced.route.loadout, {
        EnemyDamageShrineUpgrade: 2,
        EnemyHealthShrineUpgrade: 3,
      }),
    ).toEqual({ kind: 'unchanged' });
  });

  it('refuses Vows whose starting Grasp cannot hold the current Arcana', () => {
    const full = apply(
      project(),
      planManualArcanaReplacement(catalog, 'Underworld', project().route.loadout, FULL_GRASP),
    );
    expect(
      planFearRanksReplacement(catalog, 'Underworld', full.route.loadout, {
        LimitGraspShrineUpgrade: 1,
      }),
    ).toEqual({ kind: 'refused', grasp: { cost: 30, capacity: 18, legal: false } });
  });
});
