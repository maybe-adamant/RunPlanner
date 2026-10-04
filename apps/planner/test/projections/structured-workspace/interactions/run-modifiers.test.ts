import { expect, it } from 'vitest';
import { NATIVE_RUN_MODIFIERS, createRouteAddress } from '@run-planner/engine/authored-project';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';

it('projects engine defaults and complete intents bound to the current route and siblings', () => {
  const application = createOpenTestApplication('FreshFile');
  const control = () =>
    application.selectStructuredWorkspace(application.store.getState())!.route.runModifiers;
  expect(control().value).toBe(NATIVE_RUN_MODIFIERS);
  const result = control().goldDraftIntent('1.25');
  expect(result.kind).toBe('valid');
  if (result.kind !== 'valid') throw new Error('Valid draft rejected');
  expect(result.intent.command).toEqual({
    kind: 'ReplaceRunModifiers',
    route: createRouteAddress('FreshFile'),
    value: { ...NATIVE_RUN_MODIFIERS, enemyGoldDropChanceMultiplier: 1.25 },
  });
  for (const draft of ['', 'x', '0.5', '5.5']) {
    expect(control().goldDraftIntent(draft)).toEqual({
      kind: 'invalid',
      message: 'Enter a multiplier between 1 and 5.',
    });
  }
});
