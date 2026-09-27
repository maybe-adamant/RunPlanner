import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { gamePlanSent, gameSendFeedbackShown } from '@planner/state/gameSendSessionSlice';
import { newProjectCreated, profileLoadSucceeded } from '@planner/state/profileSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { createProjectDocument } from '@run-planner/engine/authored-project';

describe('game send session', () => {
  it('remembers the loaded project’s last send until another document replaces it', () => {
    const application = createApplication();
    const project = createProjectDocument(application.catalog, {
      projectId: 'run-plan',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    const record = () => {
      application.store.dispatch(gamePlanSent({ slot: 5 }));
      application.store.dispatch(gameSendFeedbackShown({ tone: 'success', text: 'Sent' }));
    };
    application.store.dispatch(authoredProjectReplaced(project));
    record();
    expect(application.store.getState().gameSendSession).toEqual({
      lastSentSlot: 5,
      feedback: { tone: 'success', text: 'Sent' },
    });
    const history = application.store.getState().projectWorkspace.history;
    expect(history?.present).toBe(project);

    application.store.dispatch(newProjectCreated(project));
    expect(application.store.getState().gameSendSession).toEqual({
      lastSentSlot: null,
      feedback: null,
    });
    record();
    const assembly = application.store.getState().projectWorkspace.assembly!;
    application.store.dispatch(
      profileLoadSucceeded({ assembly, project, baselineJson: '{}', fileName: 'other.json' }),
    );
    expect(application.store.getState().gameSendSession.lastSentSlot).toBeNull();
    record();
    application.store.dispatch(authoredProjectReplaced(project));
    expect(application.store.getState().gameSendSession.feedback).toBeNull();
  });
});
