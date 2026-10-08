// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import type { ProjectDocument } from '@run-planner/engine/authored-project';

import { createApplication } from '@planner/composition/createApplication';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import {
  groupedOutcomeProject,
  unavailableEchoOptionProject,
} from '@planner-test/support/finding-states';

afterEach(cleanup);

function marked(root: HTMLElement): readonly (string | null)[] {
  return [...root.querySelectorAll<HTMLElement>('[data-has-findings="true"]')].map((element) =>
    element.getAttribute('aria-label'),
  );
}

/** Follows the route issue to its Timeline launcher and opens that launcher's dialog. */
async function openMarkedTraitDialog(project: ProjectDocument) {
  const application = createApplication();
  application.store.dispatch(authoredProjectReplaced(project));
  const view = renderPlannerForInteraction({ application });
  await view.user.click(document.querySelector<HTMLElement>('.assessment-issue-button')!);
  const launcher = await waitFor(() => {
    const found = document.querySelector<HTMLElement>(
      '.trait-offer-launcher[data-has-findings="true"]',
    );
    if (found === null) throw new Error('the route issue marks no trait launcher');
    return found;
  });
  await view.user.click(launcher);
  return { application, dialog: await screen.findByRole('dialog'), launcher, view };
}

function feedback(name: string): string {
  return within(screen.getByRole('dialog')).getByRole('status', { name }).textContent ?? '';
}

/** Picks the first offered choice of each named picker in order. */
async function pickFirst(user: UserEvent, names: readonly string[]) {
  for (const name of names) {
    const picker = screen.queryByRole('button', { name });
    if (picker === null || (picker as HTMLButtonElement).disabled) continue;
    await user.click(picker);
    const option = (await screen.findAllByRole('option')).find(
      (candidate) => candidate.getAttribute('aria-disabled') !== 'true',
    );
    if (option === undefined) throw new Error(`${name} offers no choice`);
    await user.click(option);
  }
}

it.each([
  [
    'an unresolved All Together set',
    'All Together',
    'All Together Earth',
    'Choose All Together traits',
    ['All Together Earth', 'All Together Fire', 'All Together Air', 'All Together Water'],
  ],
  [
    'an incomplete Natural Selection',
    'Natural Selection',
    'Natural Selection 1st core',
    'Choose Natural Selection targets',
    ['Natural Selection 1st core', 'Natural Selection 2nd core'],
  ],
] as const)(
  'marks %s on its own picker and lists it at rest until an edit resolves it',
  async (_name, effect, control, message, pickers) => {
    const { application, dialog, launcher, view } = await openMarkedTraitDialog(
      groupedOutcomeProject(effect),
    );
    await waitFor(() => expect(marked(dialog)).toEqual([control]));
    expect(launcher.getAttribute('data-has-findings')).toBe('true');
    expect(feedback('Offer feedback')).toContain(message);
    await pickFirst(view.user, pickers);
    await waitFor(() => expect(feedback('Offer feedback')).not.toContain(message));
    application.dispose();
  },
);

it('marks an unavailable Boon Boon Boon row on its nested launcher, then on the row itself', async () => {
  const message = 'Boon Boon Boon outcome unavailable';
  const { application, dialog, launcher, view } = await openMarkedTraitDialog(
    unavailableEchoOptionProject(),
  );
  await waitFor(() => expect(marked(dialog)).toEqual(['Boon Boon Boon choice']));
  expect(feedback('Offer feedback')).toContain(message);
  await view.user.click(within(dialog).getByRole('button', { name: 'Boon Boon Boon choice' }));
  await waitFor(() => expect(marked(dialog)).toEqual(['Boon Boon Boon outcome 1']));
  expect(launcher.getAttribute('data-has-findings')).toBe('true');
  expect(feedback('Choice feedback')).toContain(message);
  await view.user.click(screen.getByLabelText('Boon Boon Boon outcome 1'));
  await view.user.click(await screen.findByRole('option', { name: /^Passion Rush/ }));
  await waitFor(() => expect(feedback('Choice feedback')).not.toContain(message));
  application.dispose();
});
