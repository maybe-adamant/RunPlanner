import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { gameSendFailed, gameSentSlotNotActivated } from '@planner/state/gameSendSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { bugReportFileName, projectBugReportFacts } from '@planner/workspace/bugReport';
import { createFakeGameModuleHost } from '@planner-test/fixtures/gameModuleHost';

describe('bug report operations', () => {
  it('names the report by local date and minute', () => {
    expect(bugReportFileName(new Date(2026, 0, 5, 7, 9, 59))).toBe(
      'run-planner-report-20260105-0709.zip',
    );
  });

  it('sends planner facts and the last send failure, but no plan when none is open', async () => {
    const game = createFakeGameModuleHost();
    const application = createApplication({
      buildIdentity: { build: 'abc1234', commit: 'a'.repeat(40), version: '1.4.0' },
      gameModuleHost: game.host,
    });
    application.store.dispatch(gameSendFailed({ message: 'Target unavailable.', atMs: 0 }));
    application.store.dispatch(gameSentSlotNotActivated({ slot: 2, message: 'Locked.', atMs: 0 }));

    await expect(
      application.bugReport!.create({ openPlan: true, plansInGame: false, gameLogs: true }),
    ).resolves.toMatchObject({ kind: 'saved' });

    const [, request] = game.host.createBugReport.mock.calls[0]!;
    expect(request).toMatchObject({
      openPlan: null,
      includePlanSlots: false,
      includeLogs: true,
      appFacts: {
        plannerVersion: '1.4.0',
        build: 'abc1234',
        catalogVersion: application.catalogSummary.version,
        openPlan: null,
        lastSendFailure: { message: 'Target unavailable.', at: '1970-01-01T00:00:00.000Z' },
        lastSendNotActivated: { slot: 2, message: 'Locked.', at: '1970-01-01T00:00:00.000Z' },
        settlementFault: null,
      },
    });
  });

  it('carries the recorded settlement fault', () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHProject()));
    const state = application.store.getState();
    if (state.projectWorkspace.kind !== 'openProject') throw new Error('Expected an open project');
    const owner = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('settlement-fault-owner'),
    );
    const key = `delivery:${semanticAddressKey(owner)}`;
    const facts = projectBugReportFacts(
      {
        ...state,
        projectWorkspace: { ...state.projectWorkspace, settlementFault: { key, owner } },
      },
      {
        buildIdentity: application.buildIdentity,
        catalogVersion: application.catalogSummary.version,
        currentGamePlan: application.projectOperations.inspectCurrentGamePlan(),
      },
    );
    expect(facts.settlementFault).toEqual({ key, owner: semanticAddressKey(owner) });
  });

  it('is absent without a desktop host', () => {
    expect(createApplication().bugReport).toBeUndefined();
  });
});
