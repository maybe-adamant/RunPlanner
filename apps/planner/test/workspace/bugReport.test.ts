import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { gameSendFailed, gameSentSlotNotActivated } from '@planner/state/gameSendSessionSlice';
import { bugReportFileName } from '@planner/workspace/bugReport';
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
      },
    });
  });

  it('is absent without a desktop host', () => {
    expect(createApplication().bugReport).toBeUndefined();
  });
});
