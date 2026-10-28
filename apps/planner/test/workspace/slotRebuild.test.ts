import { describe, expect, it, vi } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createProjectDocument,
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { decodeExecutionPlan } from '@run-planner/engine/execution-plan';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';

import { decodeSlotSource, encodeSlotSource } from '@planner/persistence/slotSource';
import { legacySchema99Body } from '@run-planner/test-fixtures/shared';
import type { GamePlanSlotNumber } from '@planner/persistence/gameModuleHost';
import { createSlotRebuildController } from '@planner/workspace/slotRebuild';
import { compileProjectFile } from '@planner/workspace/projectFileCompilation';
import { projectBugReportFacts } from '@planner/workspace/bugReport';
import { createDevelopmentBuildIdentity } from '@planner/composition/buildIdentity';
import { createApplication } from '@planner/composition/createApplication';

// Observes the compile options a rebuild passes, compiling as usual.
vi.mock('@planner/workspace/projectFileCompilation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@planner/workspace/projectFileCompilation')>();
  return { ...actual, compileProjectFile: vi.fn(actual.compileProjectFile) };
});
import {
  createFakeGameModuleHost,
  gameModuleStatus,
  planSlot,
  planSlots,
} from '@planner-test/fixtures/gameModuleHost';

function compilingProject(): ProjectDocument {
  const complete = createCompleteFGProject();
  return { ...complete, route: { ...complete.route, biomes: complete.route.biomes.slice(0, 1) } };
}

function incompleteProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    configuredBiomeCount: 1,
    projectId: 'incomplete',
    routeKey: 'Underworld',
  });
}

// A project document saved under the given major, as an earlier planner wrote it: before
// schema 98 the plan's name is the source's, not the project's.
function sourceJson(
  project: ProjectDocument,
  schemaVersion: number = PROJECT_DOCUMENT_SCHEMA_VERSION,
) {
  const encoded = JSON.parse(encodeProjectDocument(project)) as Record<string, unknown>;
  const document =
    schemaVersion < PROJECT_DOCUMENT_SCHEMA_VERSION ? legacySchema99Body(encoded) : encoded;
  document.schemaVersion = schemaVersion;
  const legacy = schemaVersion < 98;
  if (legacy) delete document.name;
  return encodeSlotSource({
    ...(legacy ? { displayName: 'Erebus opener' } : {}),
    internalRunModifiers: false,
    projectJson: JSON.stringify(document),
  });
}

const stale = {
  state: 'stale',
  routeKey: 'Underworld',
  biomeKeys: ['F'],
  modifiedAtMs: 1,
} as const;

function setup(sources: Readonly<Partial<Record<GamePlanSlotNumber, string>>>) {
  const status = gameModuleStatus({
    inspection: {
      planSlots: planSlots(
        planSlot(1, { ...stale, state: 'present', hasSource: true }),
        ...Object.keys(sources).map((slot) =>
          planSlot(Number(slot) as GamePlanSlotNumber, { ...stale, hasSource: true }),
        ),
        planSlot(9, { ...stale, hasSource: false }),
      ),
    },
  });
  const game = createFakeGameModuleHost(status);
  game.sources.set(1, sourceJson(compilingProject()));
  for (const [slot, json] of Object.entries(sources)) game.sources.set(Number(slot), json);
  let changed = 0;
  const controller = createSlotRebuildController({
    catalog,
    devBuild: false,
    host: game.host,
    now: () => new Date('2026-10-15T12:00:00.000Z'),
    onSlotsChanged: () => void (changed += 1),
  });
  return { controller, game, status, changed: () => changed };
}

describe('slot rebuild', () => {
  it('rebuilds outdated slots from their sources and leaves admitted and unsourced slots', async () => {
    const { controller, game, status, changed } = setup({
      2: sourceJson(compilingProject()),
      // Before schema 98 the slot source names its plan beside the project.
      3: sourceJson(compilingProject(), 97),
    });

    const report = await controller.rebuild(status);

    expect(report).toEqual({
      problem: null,
      outcomes: [
        { slot: 2, kind: 'rebuilt' },
        { slot: 3, kind: 'rebuilt' },
        { slot: 9, kind: 'noSource' },
      ],
    });
    expect(controller.getSnapshot()).toBe(report);
    expect(changed()).toBe(1);
    // Rebuilding never sends, so the active slot is kept.
    expect(game.host.publish).not.toHaveBeenCalled();
    expect(game.host.setActiveSlot).not.toHaveBeenCalled();
    expect(game.rebuilt.map((entry) => entry.slotNumber)).toEqual([2, 3]);
    const migrated = game.rebuilt[1]!;
    expect(decodeExecutionPlan(JSON.parse(migrated.json)).displayName).toBe('Erebus opener');
    expect(migrated.summary.sentAt).toBe('2026-10-15T12:00:00.000Z');
    // The migrated document is kept, so the next rebuild starts from the current schema.
    const stored = decodeSlotSource(migrated.sourceJson);
    expect(JSON.parse(stored.projectJson)).toMatchObject({
      schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
      name: 'Erebus opener',
    });
    expect(stored.displayName).toBeUndefined();
    expect(decodeExecutionPlan(JSON.parse(game.rebuilt[0]!.json)).displayName).toBe(
      compilingProject().name,
    );
  });

  it('keeps a migrated project that no longer builds outdated with its reason', async () => {
    const { controller, game, status } = setup({
      4: sourceJson(incompleteProject(), PROJECT_DOCUMENT_SCHEMA_VERSION - 1),
    });

    const report = await controller.rebuild(status);

    expect(report.outcomes[0]).toEqual({
      slot: 4,
      kind: 'failed',
      reason: 'Couldn’t rebuild after the update — open the project and resend.',
    });
    expect(game.rebuilt).toEqual([]);
  });

  it('flags a project of this schema pair that no longer builds as a defect', async () => {
    const { controller, status } = setup({ 5: sourceJson(incompleteProject()) });

    const report = await controller.rebuild(status);

    expect(report.outcomes[0]).toEqual({
      slot: 5,
      kind: 'defect',
      reason: 'Couldn’t rebuild a plan this planner should still build — create a bug report.',
      error: expect.stringMatching(/not eligible for execution/),
    });
    // The compiler's error goes only into the bug report.
    const facts = projectBugReportFacts(createApplication().store.getState(), {
      buildIdentity: createDevelopmentBuildIdentity(),
      catalogVersion: catalog.version,
      currentGamePlan: { kind: 'noProject' },
      slotRebuild: report,
    });
    expect(facts.slotRebuildDefects).toEqual([
      { slot: 5, error: expect.stringMatching(/not eligible for execution/) },
    ]);
  });

  it('reports a source it cannot read or write as failed, never as a defect', async () => {
    const { controller, game } = setup({ 6: '{"format":"tampered"}' });
    game.host.rebuildSlot.mockRejectedValueOnce(new Error('disk full'));
    game.sources.set(7, sourceJson(compilingProject()));
    const both = gameModuleStatus({
      inspection: {
        planSlots: planSlots(
          planSlot(6, { ...stale, hasSource: true }),
          planSlot(7, { ...stale, hasSource: true }),
        ),
      },
    });

    const report = await controller.rebuild(both);

    expect(report.outcomes).toEqual([
      {
        slot: 6,
        kind: 'failed',
        reason: expect.stringMatching(/^Couldn’t read its stored source: /),
      },
      { slot: 7, kind: 'failed', reason: 'Couldn’t write it: disk full' },
    ]);
  });

  it('compiles a stored internal run modifier only in a development build', async () => {
    const internal = JSON.parse(sourceJson(compilingProject())) as Record<string, unknown>;
    internal.internalRunModifiers = true;
    const { controller, game, status } = setup({ 2: JSON.stringify(internal) });
    vi.mocked(compileProjectFile).mockClear();

    await controller.rebuild(status);

    expect(compileProjectFile).toHaveBeenCalledWith(catalog, expect.any(String), {
      internalRunModifiers: false,
    });
    // The stored option is kept for a later development rebuild.
    expect(decodeSlotSource(game.rebuilt[0]!.sourceJson).internalRunModifiers).toBe(true);
  });

  it('runs one rebuild at a time and shares it with a second request', async () => {
    const { controller, game, status } = setup({ 2: sourceJson(compilingProject()) });

    const [first, second] = await Promise.all([
      controller.rebuild(status),
      controller.rebuild(status),
    ]);

    expect(second).toBe(first);
    expect(game.rebuilt).toHaveLength(1);
  });

  it('rebuilds nothing while the module still needs an update', async () => {
    const { controller, game, status } = setup({ 2: sourceJson(compilingProject()) });

    const report = await controller.rebuild({
      ...status,
      publicationBlockers: [{ code: 'moduleMismatch', found: '0.0.9', required: '0.1.0' }],
    });

    expect(report.outcomes).toEqual([]);
    expect(report.problem).toMatch(/Update the game module/);
    expect(game.rebuilt).toEqual([]);
  });

  it('rebuilds after an install only when it outdated a slot with a source', async () => {
    const { controller, game, status } = setup({ 2: sourceJson(compilingProject()) });

    expect(await controller.afterInstall({ outcome: 'unchanged', status })).toBeNull();
    expect(
      await controller.afterInstall({
        outcome: 'installed',
        status: gameModuleStatus({ inspection: { planSlots: planSlots(planSlot(9, stale)) } }),
      }),
    ).toBeNull();
    expect(game.rebuilt).toEqual([]);
    expect((await controller.afterInstall({ outcome: 'installed', status }))?.outcomes).toEqual([
      { slot: 2, kind: 'rebuilt' },
      { slot: 9, kind: 'noSource' },
    ]);
    // An install that leaves nothing to rebuild clears the earlier report.
    await controller.afterInstall({ outcome: 'installed', status: gameModuleStatus() });
    expect(controller.getSnapshot()).toBeNull();
  });
});
