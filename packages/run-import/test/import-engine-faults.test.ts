import { describe, expect, it, vi } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createProjectDocument,
  createRouteAddress,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import type { RunRecord } from '../src/run-record';
import type { RunImportReportEntry } from '../src/report';
import { projectFromRunRecord, RunImportWalk } from '../src/import';
import { fixture } from './support/run-import';

// Settlement faults are engine defects no real record produces; this stub attaches one to every
// applied loadout replacement, at the loadout's route.
vi.mock('@run-planner/engine/authoring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@run-planner/engine/authoring')>();
  return {
    ...actual,
    createAuthoringSession: (...args: Parameters<typeof actual.createAuthoringSession>) => {
      const session = actual.createAuthoringSession(...args);
      return {
        ...session,
        apply: (command: ProjectCommand, admission?: 'settled' | 'noNewFinding') => {
          const outcome = session.apply(command, admission);
          return outcome.kind === 'applied' && command.kind === 'ReplaceRouteLoadout'
            ? { ...outcome, fault: { key: 'stub', owner: command.route } }
            : outcome;
        },
      };
    },
  };
});

/** Erebus through its PostBoss. */
function erebus(): RunRecord {
  const record = fixture('underworld');
  return { ...record, route: { biomes: ['F'], dream: false }, rooms: record.rooms.slice(0, 14) };
}

describe('run import of a settlement fault', () => {
  it('reports the fault at its owner and keeps the faulted answer', () => {
    const record = erebus();
    const imported = projectFromRunRecord(catalog, record);
    const route = createRouteAddress(imported.project.route.routeKey);
    expect(imported.report.entries).toContainEqual({
      area: 'loadout',
      reason: 'engineFault',
      address: route,
    });
    expect(imported.project.route.loadout.aspectKey).toBe(record.loadout.aspect?.name);
  });

  it('drops the fault of an application a transaction rolls back', () => {
    const record = erebus();
    const project = createProjectDocument(catalog, {
      projectId: 'faults',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    const entries: RunImportReportEntry[] = [];
    const walk = new RunImportWalk(
      catalog,
      record,
      simulateProjectAssembly(catalog, project),
      entries,
    );
    const command: ProjectCommand = {
      kind: 'ReplaceRouteLoadout',
      route: createRouteAddress('Underworld'),
      weaponKey: record.loadout.weapon!,
      aspectKey: record.loadout.aspect!.name,
    };
    expect(walk.transaction(() => walk.apply(command) && false)).toBe(false);
    expect(entries).toEqual([]);
    expect(walk.transaction(() => walk.apply(command))).toBe(true);
    expect(entries).toMatchObject([{ reason: 'engineFault' }]);
  });
});
