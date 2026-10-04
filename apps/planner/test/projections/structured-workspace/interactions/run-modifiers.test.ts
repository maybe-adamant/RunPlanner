import { expect, it } from 'vitest';
import {
  NATIVE_RUN_MODIFIERS,
  RUN_MODIFIER_DECLARATIONS,
  createProjectDocument,
  createRouteAddress,
  runModifierDeclaration,
  type NumberRunModifierDeclaration,
  type RunModifierDeclaration,
} from '@run-planner/engine/authored-project';
import { createApplication } from '@planner/composition/createApplication';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import { visibleRunModifierDeclarations } from '@planner/projections/structured-workspace/interactions/run-modifiers';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';

it('projects engine defaults and complete intents bound to the current route and siblings', () => {
  const application = createOpenTestApplication('FreshFile');
  const control = () =>
    application.selectStructuredWorkspace(application.store.getState())!.route.runModifiers;
  expect(control().value).toBe(NATIVE_RUN_MODIFIERS);
  expect(control().declarations.map((declaration) => declaration.key)).toEqual([
    'enemyGoldDropChanceMultiplier',
  ]);
  const gold = runModifierDeclaration('enemyGoldDropChanceMultiplier');
  if (gold.kind !== 'number') throw new Error('gold multiplier is a number declaration');
  const result = control().draftIntent(gold, '1.25');
  expect(result.kind).toBe('valid');
  if (result.kind !== 'valid') throw new Error('Valid draft rejected');
  expect(result.intent.command).toEqual({
    kind: 'ReplaceRunModifiers',
    route: createRouteAddress('FreshFile'),
    value: { ...NATIVE_RUN_MODIFIERS, enemyGoldDropChanceMultiplier: 1.25 },
  });
  for (const draft of ['', 'x', '0.5', '5.5']) {
    expect(control().draftIntent(gold, draft)).toEqual({
      kind: 'invalid',
      message: 'Enter a value between 1 and 5.',
    });
  }
  const foreign: NumberRunModifierDeclaration = { ...gold, key: 'notDeclared' };
  expect(() => control().draftIntent(foreign, '2')).toThrow('undeclared run modifier');
});

it('authors only released declarations outside a development build', () => {
  const released = createOpenTestApplication('Underworld');
  expect(
    released.selectStructuredWorkspace(released.store.getState())!.route.runModifiers.declarations,
  ).toEqual(RUN_MODIFIER_DECLARATIONS.filter((declaration) => declaration.stage === 'released'));
  // The declaration table is a frozen engine constant, so a hypothetical internal
  // modifier exercises the filtering helper the control is built from.
  const internal: RunModifierDeclaration = {
    key: 'hypotheticalInternalToggle',
    kind: 'boolean',
    default: false,
    label: 'Hypothetical',
    description: 'Exists only in this test.',
    stage: 'internal',
  };
  const table = [...RUN_MODIFIER_DECLARATIONS, internal];
  expect(
    visibleRunModifierDeclarations(table, false).map((declaration) => declaration.key),
  ).toEqual(['enemyGoldDropChanceMultiplier']);
  expect(visibleRunModifierDeclarations(table, true).map((declaration) => declaration.key)).toEqual(
    ['enemyGoldDropChanceMultiplier', 'hypotheticalInternalToggle'],
  );
  // The composition root accepts the gate explicitly; the shipped table has no internal entry.
  for (const devBuild of [false, true]) {
    const application = createApplication({ devBuild });
    application.store.dispatch(
      newProjectCreated(
        createProjectDocument(application.catalog, {
          projectId: 'run-plan',
          routeKey: 'Underworld',
          configuredBiomeCount: 0,
        }),
      ),
    );
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())!
        .route.runModifiers.declarations.map((declaration) => declaration.key),
    ).toEqual(['enemyGoldDropChanceMultiplier']);
  }
});
