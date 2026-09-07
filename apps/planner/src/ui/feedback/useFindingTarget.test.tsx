// @vitest-environment jsdom
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { useState } from 'react';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';
import { findingSelected } from '@planner/state/editorSessionSlice';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { FindingTargetScope, useFindingTarget } from './useFindingTarget';

afterEach(cleanup);
const owner = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('feedback-control'),
);
const first: SemanticFinding = {
  code: 'rewardMissing',
  origin: owner,
  evidence: {},
  phase: 'rewardGeneration',
  severity: 'error',
};
const second: SemanticFinding = {
  code: 'rewardAcquisitionUnavailable',
  origin: owner,
  evidence: {},
  phase: 'rewardGeneration',
  severity: 'error',
};

function Control({ group = false }: { readonly group?: boolean }) {
  const target = useFindingTarget();
  const [value, setValue] = useState('retained draft');
  return group ? (
    <section {...target(owner)} aria-label="Inventory" tabIndex={-1}>
      <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />
    </section>
  ) : (
    <input
      {...target(owner)}
      aria-label="Draft"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

it.each([false, true])(
  'keeps a shared highlight until its last finding clears and preserves keyboard draft focus (group=%s)',
  (group) => {
    const application = createOpenTestApplication();
    const ui = (findings: readonly SemanticFinding[]) => (
      <Provider store={application.store}>
        <FindingTargetScope findings={new Map([[semanticAddressKey(owner), findings]])}>
          <Control group={group} />
        </FindingTargetScope>
      </Provider>
    );
    const view = render(ui([first, second]));
    const input = screen.getByRole('textbox', { name: 'Draft' });
    const target = group ? screen.getByRole('region', { name: 'Inventory' }) : input;
    expect(target.getAttribute('data-has-findings')).toBe('true');
    expect(target.getAttribute('aria-description')).toContain('reward');
    act(() =>
      application.store.dispatch(
        findingSelected({ key: semanticFindingKey(first), origin: owner, focusAddress: owner }),
      ),
    );
    expect(document.activeElement).toBe(target);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'keyboard draft' } });
    view.rerender(ui([second]));
    expect(target.getAttribute('data-has-findings')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(input);
    expect((input as HTMLInputElement).value).toBe('keyboard draft');
    expect(document.activeElement).toBe(input);
    view.rerender(ui([]));
    expect(target.getAttribute('data-has-findings')).toBe('false');
    expect(target.hasAttribute('aria-description')).toBe(false);
    expect((input as HTMLInputElement).value).toBe('keyboard draft');
  },
);
