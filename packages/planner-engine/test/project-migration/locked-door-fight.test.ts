import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { moveLockedDoorFightOntoDoor } from '@run-planner/engine/project-migration';
import {
  simulateProjectAssembly,
  unlockExitEncounterSupportForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';

// G_Combat01's second door can lock.
const HOST = 'golden-g-b1-e1';

interface RawOccurrence {
  readonly occurrenceId: string;
  readonly encounters: { customizationByLockedExit?: Record<string, unknown> };
  readonly roomActions: { readonly order: Record<string, unknown>[] };
}

const rawHost = (document: unknown) =>
  (
    document as {
      readonly route: {
        readonly biomes: readonly {
          readonly topology: { readonly occurrences: readonly RawOccurrence[] } | null;
        }[];
      };
    }
  ).route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .find((occurrence) => occurrence.occurrenceId === HOST)!;

/** The golden plan with G's second door locked, its fight customized and pressed. */
function customizedPress(): ProjectDocument {
  const golden = loadUnderworldFGHICheckpoint();
  const biome = createBiomeAddress(golden.route.routeKey, 'G');
  const occurrence = createOccurrenceAddress(biome, createOccurrenceId(HOST));
  const reference = Object.freeze({ kind: 'unlockExit' as const, exitKey: 'exit2' });
  const action = createRoomActionAddress(biome, createOccurrenceId(HOST), roomActionKey(reference));
  const locked = applyProjectCommand(golden, catalog, {
    kind: 'ReplaceLockedExit',
    occurrence,
    exitKey: 'exit2',
    locked: true,
  });
  const pressed = applyProjectCommand(locked, catalog, {
    kind: 'InsertRoomAction',
    action,
    reference,
    index: rawHost(locked).roomActions.order.length,
  });
  const capability = unlockExitEncounterSupportForProjectEvaluationAssembly(
    simulateProjectAssembly(catalog, pressed),
    action,
  )!;
  return applyProjectCommand(pressed, catalog, {
    kind: 'ReplaceLockedExitCustomization',
    occurrence,
    exitKey: 'exit2',
    decisionKey: capability.decisionKey,
    value: capability.initialize()!,
  });
}

/** The same plan as schema 102 stored it: the fight on the press. */
function savedOnThePress(current: ProjectDocument): unknown {
  const raw = JSON.parse(encodeProjectDocument(current)) as unknown;
  const host = rawHost(raw);
  const fight = host.encounters.customizationByLockedExit!['exit2'];
  delete host.encounters.customizationByLockedExit;
  host.roomActions.order.find((row) => row.kind === 'unlockExit')!.customization = fight;
  return raw;
}

describe('moving a locked door’s fight from its press onto the door', () => {
  it('moves the press’s fight unchanged onto its door, leaving the press thin', () => {
    const current = customizedPress();
    const saved = savedOnThePress(current);
    expect(() => decodeProjectDocument(saved, catalog)).toThrow(/customization/);
    const moved = moveLockedDoorFightOntoDoor(saved);
    expect(moved).toEqual(JSON.parse(encodeProjectDocument(current)));
    expect(encodeProjectDocument(decodeProjectDocument(moved, catalog))).toBe(
      encodeProjectDocument(current),
    );
    // The input is never mutated.
    expect(rawHost(saved).encounters.customizationByLockedExit).toBeUndefined();
  });

  it('returns a plan without a customized press, or a malformed one, as it is', () => {
    const plain = JSON.parse(encodeProjectDocument(loadUnderworldFGHICheckpoint())) as unknown;
    expect(moveLockedDoorFightOntoDoor(plain)).toBe(plain);
    for (const malformed of [null, 'plan', { route: 'not a route' }])
      expect(moveLockedDoorFightOntoDoor(malformed)).toBe(malformed);
  });
});
