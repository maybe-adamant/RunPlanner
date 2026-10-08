import { expect, it } from 'vitest';
import {
  NATIVE_RUN_MODIFIERS,
  RUN_MODIFIER_DECLARATIONS,
  createProjectDocument,
  createRouteAddress,
  runModifierDeclaration,
  type OptionalPercentageRunModifierDeclaration,
  type RunModifierDeclaration,
} from '@run-planner/engine/authored-project';
import { createApplication } from '@planner/composition/createApplication';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { visibleRunModifierDeclarations } from '@planner/projections/structured-workspace/interactions/run-modifiers';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';

const keys = ['enemyGoldDropChance', 'encounterGoldRange'];

it('projects engine defaults and complete intents bound to the current route and siblings', () => {
  const application = createOpenTestApplication('FreshFile');
  const control = () =>
    application.selectStructuredWorkspace(application.store.getState())!.route.runModifiers;
  expect(control().value).toBe(NATIVE_RUN_MODIFIERS);
  expect(control().declarations.map((declaration) => declaration.key)).toEqual(keys);
  const chance = runModifierDeclaration('enemyGoldDropChance');
  const range = runModifierDeclaration('encounterGoldRange');
  if (chance.kind !== 'optionalPercentage' || range.kind !== 'optionalPercentage')
    throw new Error('gold modifiers are optional percentages');
  const result = control().draftIntent(chance, '35');
  if (result.kind !== 'valid') throw new Error('Valid draft rejected');
  const command = {
    kind: 'ReplaceRunModifiers' as const,
    route: createRouteAddress('FreshFile'),
    value: { enemyGoldDropChance: 35 },
  };
  expect(result.intent.command).toEqual(command);
  application.store.dispatch(authoredProjectCommandDispatched(command));
  const both = control().draftIntent(range, '0');
  if (both.kind !== 'valid') throw new Error('Valid draft rejected');
  expect(both.intent.command).toEqual({
    ...command,
    value: { enemyGoldDropChance: 35, encounterGoldRange: 0 },
  });
  expect(control().clearValue(chance).command).toEqual({ ...command, value: {} });
  for (const draft of ['', 'x', '-1', '100.5']) {
    expect(control().draftIntent(chance, draft)).toEqual({
      kind: 'invalid',
      message: 'Enter a value between 0 and 100.',
    });
  }
  const foreign: OptionalPercentageRunModifierDeclaration = { ...chance, key: 'notDeclared' };
  expect(() => control().draftIntent(foreign, '2')).toThrow('undeclared run modifier');
  expect(() => control().clearValue(foreign)).toThrow('undeclared run modifier');
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
  ).toEqual(keys);
  expect(visibleRunModifierDeclarations(table, true).map((declaration) => declaration.key)).toEqual(
    [...keys, 'hypotheticalInternalToggle'],
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
    ).toEqual(keys);
  }
});
