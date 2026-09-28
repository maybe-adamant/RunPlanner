import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  gamePlanSent,
  gameSendFailed,
  gameSendStarted,
  gameSentSlotNotActivated,
} from '@planner/state/gameSendSessionSlice';
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
      application.store.dispatch(gameSendFailed({ message: 'could not write', atMs: 7 }));
      application.store.dispatch(gameSentSlotNotActivated({ slot: 5, message: 'locked', atMs: 8 }));
    };
    application.store.dispatch(authoredProjectReplaced(project));
    record();
    expect(application.store.getState().gameSendSession).toEqual({
      lastSentSlot: 5,
      lastFailure: { message: 'could not write', atMs: 7 },
      lastActivationFailure: { slot: 5, message: 'locked', atMs: 8 },
    });
    application.store.dispatch(gameSendStarted());
    expect(application.store.getState().gameSendSession).toEqual({
      lastSentSlot: 5,
      lastFailure: null,
      lastActivationFailure: null,
    });
    record();
    const history = application.store.getState().projectWorkspace.history;
    expect(history?.present).toBe(project);

    application.store.dispatch(newProjectCreated(project));
    expect(application.store.getState().gameSendSession).toEqual({
      lastSentSlot: null,
      lastFailure: null,
      lastActivationFailure: null,
    });
    record();
    const assembly = application.store.getState().projectWorkspace.assembly!;
    application.store.dispatch(
      profileLoadSucceeded({ assembly, project, baselineJson: '{}', fileName: 'other.json' }),
    );
    expect(application.store.getState().gameSendSession).toEqual({
      lastSentSlot: null,
      lastFailure: null,
      lastActivationFailure: null,
    });
    record();
    application.store.dispatch(authoredProjectReplaced(project));
    expect(application.store.getState().gameSendSession.lastFailure).toBeNull();
  });
});
