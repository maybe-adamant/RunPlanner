import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceId,
  type AuthoredTraitOffer,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

function withArcana(project: ProjectDocument, arcanaKeys: readonly string[]): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: project.route.routeKey },
    arcanaKeys,
  });
}

/** The golden route's F and G Boss Judgment draws; F's holds the screen-reroll card unless replaced. */
function withJudgments(project: ProjectDocument, fArcana: readonly string[]): ProjectDocument {
  let next = project;
  for (const [biomeKey, arcanaKeys] of [
    ['F', fArcana],
    ['G', ['LowManaDamageBonus', 'CastCount', 'SorceryRegenUpgrade', 'CastBuff', 'BonusHealth']],
  ] as const)
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceJudgmentArcana',
      judgment: {
        kind: 'judgmentArcana',
        routeKey: 'Underworld',
        biomeKey,
        occurrenceId: createOccurrenceId(`golden-${biomeKey.toLowerCase()}-preboss-shop:boss`),
        phaseKey: 'Encounter',
      },
      arcanaKeys: [...arcanaKeys],
    });
  return next;
}

const screenCard = ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'];
const noScreenCard = ['CastCount', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'];

/** The Oceanus Boon offers, whose screens show the native reroll button. */
function oceanusBoons(project: ProjectDocument) {
  const { workspace } = projectStructuredWorkspaceFixture(project);
  return [...workspace.interactions.traitOffers.values()].filter(
    (interaction) =>
      interaction.owner.biomeKey === 'G' &&
      interaction.giver.providerKind === 'olympian' &&
      interaction.value?.kind === 'traits',
  );
}

describe('screen reroll counts', () => {
  const held = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);

  it('offer a count where a held card enables screen rerolls, up to what the pool allows', () => {
    const [boon] = oceanusBoons(withJudgments(held, screenCard));
    expect(boon?.screenRerolls).toMatchObject({ count: 0 });
    expect(boon!.screenRerolls!.maxCount).toBeGreaterThan(0);
    expect(
      oceanusBoons(withJudgments(held, noScreenCard)).every(
        (interaction) => interaction.screenRerolls === undefined,
      ),
    ).toBe(true);
  });

  it('allow exactly the rerolls a pool of 10 pays for: four, and refuse a fifth', () => {
    // Doors, screens and The Fates around them: 3 + 3 + 4 rerolls at run start.
    const pooled = applyProjectCommand(loadUnderworldFGCheckpoint(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: { kind: 'route', routeKey: 'Underworld' },
      arcanaKeys: ['ScreenReroll', 'DoorReroll', 'StartingGold'],
    });
    const opening = (project: ProjectDocument) =>
      [
        ...projectStructuredWorkspaceFixture(project).workspace.interactions.traitOffers.values(),
      ].find(
        (interaction) =>
          interaction.owner.owner.kind === 'incomingReward' &&
          interaction.owner.owner.occurrenceId === createOccurrenceId('golden-f-start'),
      )!;
    // 1 + 2 + 3 + 4 = 10.
    expect(opening(pooled).screenRerolls).toMatchObject({ count: 0, maxCount: 4 });
    const value = opening(pooled).value as Extract<AuthoredTraitOffer, { readonly kind: 'traits' }>;
    for (const count of [3, 4]) {
      const authored = applyProjectCommand(
        pooled,
        catalog,
        opening(pooled).intentFor(Object.freeze({ ...value, rerollCount: count })).command,
      );
      expect(opening(authored).screenRerolls).toMatchObject({ count, maxCount: 4 });
    }
    const exhausted = applyProjectCommand(
      pooled,
      catalog,
      opening(pooled).intentFor(Object.freeze({ ...value, rerollCount: 4 })).command,
    );
    expect(opening(exhausted).screenRerolls).toEqual({
      count: 4,
      maxCount: 4,
      lockAtMax: 'poolEmpty',
    });
  });

  it('keep an authored count without the card, locked where it is', () => {
    const project = withJudgments(held, screenCard);
    const [boon] = oceanusBoons(project);
    const value = boon!.value as Extract<AuthoredTraitOffer, { readonly kind: 'traits' }>;
    const rerolled = applyProjectCommand(
      project,
      catalog,
      boon!.intentFor(Object.freeze({ ...value, rerollCount: 2 })).command,
    );
    const owner = JSON.stringify(boon!.owner);
    const find = (next: ProjectDocument) =>
      oceanusBoons(next).find((interaction) => JSON.stringify(interaction.owner) === owner);
    expect(find(rerolled)?.screenRerolls).toMatchObject({ count: 2 });
    const withoutCard = withJudgments(rerolled, noScreenCard);
    expect(find(withoutCard)?.screenRerolls).toEqual({
      count: 2,
      maxCount: 2,
      lockAtMax: 'notEnabled',
    });
  });
});
