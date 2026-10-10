import { expect, it } from 'vitest';
import {
  NATIVE_RUN_MODIFIERS,
  RUN_MODIFIER_DECLARATIONS,
  createProjectDocument,
  createRouteAddress,
  runModifierDeclaration,
  type OptionalPercentageRunModifierDeclaration,
  type ProjectCommand,
  type ProjectDocument,
  type RunModifierDeclaration,
  type RunStartPoint,
} from '@run-planner/engine/authored-project';
import { createApplication } from '@planner/composition/createApplication';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { visibleRunModifierDeclarations } from '@planner/projections/structured-workspace/interactions/run-modifiers';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

const keys = ['enemyGoldDropChance', 'encounterGoldRange', 'startPoint'];

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
  // The composition root accepts the gate explicitly; every declared modifier is released.
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

/** The replacement value of a run-modifier intent. */
function valueOf(intent: { readonly command: ProjectCommand }) {
  if (intent.command.kind !== 'ReplaceRunModifiers')
    throw new Error('expected a run-modifier edit');
  return intent.command.value;
}

function openGolden(devBuild: boolean, document: ProjectDocument = createGoldenFGHIProject()) {
  const application = createApplication({ devBuild });
  application.store.dispatch(newProjectCreated(document));
  const control = () =>
    application.selectStructuredWorkspace(application.store.getState())!.route.runModifiers;
  return { application, control };
}

it('binds Practice mode to the engine start-point domain with complete one-step intents', () => {
  const { application, control } = openGolden(true);
  const startPoint = () => control().startPoint!;
  expect(control()).not.toHaveProperty('startPointBlock');
  expect(startPoint()).toMatchObject({ value: undefined, valueLabel: '' });
  expect(startPoint()).not.toHaveProperty('unavailable');
  const domain = startPoint().loadDomain();
  expect(startPoint().loadDomain()).toBe(domain);
  expect(domain.map((row) => row.label)).toEqual(['Erebus', 'Oceanus', 'Fields', 'Tartarus']);
  expect(domain[0]!.options).toEqual([
    {
      biomeKey: 'F',
      point: 'opening',
      label: 'Opening',
      selected: false,
      // The route start is evidently unavailable, so it carries no hover.
      available: false,
    },
    { biomeKey: 'F', point: 'preboss', label: 'Preboss', selected: false, available: true },
  ]);
  const route = createRouteAddress('Underworld');
  const choose = startPoint().selectIntent({ biomeKey: 'G', point: 'opening' }).command;
  expect(choose).toEqual({
    kind: 'ReplaceRunModifiers',
    route,
    value: { startPoint: { biomeKey: 'G', point: 'opening' } },
  });
  application.store.dispatch(authoredProjectCommandDispatched(choose));
  expect(startPoint().valueLabel).toBe('Oceanus · Opening');
  expect(startPoint().loadDomain()[1]!.options[0]!.selected).toBe(true);
  const gold = startPoint().goldDraftIntent(' 120 ');
  if (gold.kind !== 'valid') throw new Error('Valid gold rejected');
  expect(valueOf(gold.intent)).toEqual({
    startPoint: { biomeKey: 'G', point: 'opening', gold: 120 },
  });
  application.store.dispatch(authoredProjectCommandDispatched(gold.intent.command));
  expect(valueOf(startPoint().selectIntent({ biomeKey: 'H', point: 'preboss' }))).toEqual({
    startPoint: { biomeKey: 'H', point: 'preboss', gold: 120 },
  });
  const none = startPoint().goldDraftIntent('');
  expect(none.kind === 'valid' && valueOf(none.intent)).toEqual({
    startPoint: { biomeKey: 'G', point: 'opening' },
  });
  for (const draft of ['-1', '2.5', 'x', '100000'])
    expect(startPoint().goldDraftIntent(draft)).toEqual({
      kind: 'invalid',
      message: 'Enter whole gold between 0 and 99999, or leave it empty to add none.',
    });
  const chance = runModifierDeclaration('enemyGoldDropChance');
  if (chance.kind !== 'optionalPercentage') throw new Error('expected a percentage');
  const sibling = control().draftIntent(chance, '40');
  if (sibling.kind !== 'valid') throw new Error('Valid draft rejected');
  application.store.dispatch(authoredProjectCommandDispatched(sibling.intent.command));
  // Unchecking removes the start point and its gold in one edit, keeping siblings.
  expect(valueOf(startPoint().selectIntent(undefined))).toEqual({ enemyGoldDropChance: 40 });
});

it('blocks publication by an ineligible start point in every build', () => {
  const golden = createGoldenFGHIProject();
  const withStart = (startPoint: RunStartPoint): ProjectDocument => ({
    ...golden,
    route: { ...golden.route, loadout: { ...golden.route.loadout, runModifiers: { startPoint } } },
  });
  const dangling = withStart({ biomeKey: 'N', point: 'preboss' });
  const dev = openGolden(true, dangling).control();
  expect(dev.startPointBlock).toEqual({
    code: 'startPointIneligible',
    reason: { kind: 'notOnItinerary' },
  });
  // The Game panel states the reason; the control only marks it unavailable.
  expect(dev.startPoint).toMatchObject({ valueLabel: 'Ephyra · Preboss', unavailable: true });
  const eligibleWorkspace = openGolden(true, withStart({ biomeKey: 'G', point: 'opening' }));
  const eligible = eligibleWorkspace.control();
  expect(eligible).not.toHaveProperty('startPointBlock');
  expect(eligible.startPoint).not.toHaveProperty('unavailable');
  // An eligible start point publishes with its start state.
  expect(eligibleWorkspace.application.projectOperations.inspectCurrentGamePlan()).toMatchObject({
    kind: 'publishable',
  });
  // A released build shows and publishes the start point too.
  const released = openGolden(false, dangling);
  expect(released.control().startPoint).toMatchObject({ valueLabel: 'Ephyra · Preboss' });
  expect(released.application.projectOperations.inspectCurrentGamePlan()).toEqual({
    kind: 'notPublishable',
    code: 'startPointIneligible',
    startPointReason: { kind: 'notOnItinerary' },
  });
});
