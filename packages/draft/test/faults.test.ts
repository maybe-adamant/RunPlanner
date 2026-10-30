import { describe, expect, it, vi } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createDefaultRouteLoadout,
  createProjectDocument,
  createRouteAddress,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';
import { draftProject, type DraftSpec } from '../src';
import { draftBasket } from './support/draft-basket';

const stub = vi.hoisted(() => ({ faulting: false }));

// Settlement faults are engine defects no drafted plan produces; while `faulting`, this stub
// attaches one to every applied command, named by the command's kind.
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
          return stub.faulting && outcome.kind === 'applied'
            ? {
                ...outcome,
                fault: { key: command.kind, owner: createRouteAddress('Underworld') },
              }
            : outcome;
        },
      };
    },
  };
});

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;
const base = createProjectDocument(catalog, {
  projectId: 'faults',
  routeKey: 'Underworld',
  configuredBiomeCount: 1,
});
const spec: DraftSpec = {
  loadout,
  world: {
    godKeys: ['Zeus', 'Apollo', 'Aphrodite', 'Hestia'],
    storyNpcByBiome: { F: 'Arachne' },
    fieldNpcsByBiome: { F: ['Artemis'] },
  },
  basketByGiver: draftBasket(['ZeusWeaponBoon']),
  rackKeepsakeKeys: [null, null, null],
};

describe('draftProject with settlement faults', () => {
  it('records the kept plan’s faults and drafts the same plan', () => {
    stub.faulting = false;
    const clean = draftProject(catalog, base, spec, 1);
    stub.faulting = true;
    const faulted = draftProject(catalog, base, spec, 1);
    stub.faulting = false;
    if (clean.kind !== 'drafted' || faulted.kind !== 'drafted') throw new Error('not drafted');
    expect(clean.faults).toEqual([]);
    expect(faulted.command).toEqual(clean.command);
    const kinds = new Set(faulted.faults.map((fault) => fault.key));
    // The chosen walk's decisions and the encounter customizations drafted after it.
    expect(kinds).toContain('ReplaceEncounterCustomization');
    expect(kinds).toContain('CreateTarget');
  });
});
