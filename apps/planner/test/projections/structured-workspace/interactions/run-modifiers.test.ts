import { expect, it } from 'vitest';
import { NATIVE_RUN_MODIFIERS, createRouteAddress } from '@run-planner/engine/authored-project';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';

it('projects engine defaults and complete intents bound to the current route and siblings', () => {
  const application = createOpenTestApplication('FreshFile');
  const control = () =>
    application.selectStructuredWorkspace(application.store.getState())!.route.runModifiers;
  expect(control().value).toBe(NATIVE_RUN_MODIFIERS);
  application.store.dispatch(authoredProjectCommandDispatched(control().setCrits(true).command));
  expect(control().setDoubleDamage(true).command).toEqual({
    kind: 'ReplaceRunModifiers',
    route: createRouteAddress('FreshFile'),
    value: {
      ...NATIVE_RUN_MODIFIERS,
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: true,
    },
  });
  const result = control().goldDraftIntent('1.25');
  expect(result.kind).toBe('valid');
  if (result.kind !== 'valid') throw new Error('Valid draft rejected');
  expect(result.intent.command).toMatchObject({
    value: {
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: false,
      enemyGoldDropChanceMultiplier: 1.25,
    },
  });
});
