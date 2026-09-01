import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createCompleteFGIxionChaosProject,
  createCompleteFGAnomalyProject,
  createCompleteFGProject,
  createUnderworldFPoolCheckpoint,
} from '@run-planner/test-fixtures/underworld';
import { simulateProjectAssembly } from '../../src/simulation';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
  ExecutionPlanCodecError,
} from '../../src/execution-plan';
import fOpeningFixture from './fixtures/f-opening.execution.json';
import fgFixture from './fixtures/fg.execution.json';
import fgAnomalyFixture from './fixtures/fg-anomaly.execution.json';
import fgIxionChaosFixture from './fixtures/fg-ixion-chaos.execution.json';

function fOnlyProject(project = createCompleteFGProject()) {
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(project.route.biomes.slice(0, 1)),
    }),
  });
}

function planFor(project: ReturnType<typeof createCompleteFGProject>) {
  const assembly = simulateProjectAssembly(catalog, project);
  const product = assembleExecutionProduct({ assembly });
  return { product, plan: compileExecutionPlan({ product }) };
}

describe('protocol-v10 compiler and codec', () => {
  it.each([
    ['f-opening', fOnlyProject(), fOpeningFixture],
    ['fg', createCompleteFGProject(), fgFixture],
    ['fg-ixion-chaos', createCompleteFGIxionChaosProject(), fgIxionChaosFixture],
    ['fg-anomaly', createCompleteFGAnomalyProject(), fgAnomalyFixture],
  ])('keeps the %s product byte-stable', (_name, project, fixture) => {
    const { plan } = planFor(project);
    if (fixture !== undefined) expect(decodeExecutionPlan(fixture)).toEqual(plan);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  });

  it('keeps diagnostic frames compact and nonblocking on the wire', () => {
    const { plan } = planFor(createCompleteFGProject());
    const encoded = encodeExecutionPlan(plan);
    const wire = JSON.parse(encoded) as {
      readonly occurrences: readonly {
        readonly diagnostics?: {
          readonly roomEntered?: Record<string, unknown>;
          readonly beforeRoomExit?: Record<string, unknown>;
        };
      }[];
    };
    const diagnosticFrames = wire.occurrences.flatMap((occurrence) =>
      [occurrence.diagnostics?.roomEntered, occurrence.diagnostics?.beforeRoomExit].filter(
        (frame): frame is Record<string, unknown> => frame !== undefined && 'frame' in frame,
      ),
    );
    expect(diagnosticFrames[0]).toMatchObject({ frame: 0 });
    expect(Object.keys((diagnosticFrames[0]!.replace ?? {}) as object)).toHaveLength(12);
    expect(
      diagnosticFrames.some((frame) => Object.keys((frame.replace ?? {}) as object).length < 12),
    ).toBe(true);
    expect(encoded.length).toBeLessThan(JSON.stringify(plan).length * 0.75);
    expect(decodeExecutionPlan(wire)).toEqual(plan);
  });

  it('rejects disconnected cursors and contradictory target identities on the codec boundary', () => {
    const { product } = planFor(createCompleteFGProject());
    const opening = product.occurrences[0]!;
    if (opening.doors.kind !== 'batch') throw new Error('expected opening batch');
    const openingDoors = opening.doors;
    const connected = new Set(openingDoors.targets.map((target) => target.room.id));
    const disconnected = product.occurrences.find(
      (occurrence) =>
        occurrence.id !== opening.id &&
        !connected.has(occurrence.id) &&
        !(opening.overview.additional ?? []).some(
          (additional) => additional.room.id === occurrence.id,
        ),
    );
    expect(disconnected).toBeDefined();
    if (disconnected === undefined) throw new Error('fixture lacks disconnected occurrence');
    const disconnectedPlan = compileExecutionPlan({
      product: Object.freeze({
        ...product,
        selectedOccurrenceIds: Object.freeze([opening.id, disconnected.id]),
      }),
    });
    expect(() => decodeExecutionPlan(disconnectedPlan)).toThrow(/disconnected/);

    const target = openingDoors.targets[0]!;
    const contradictoryProduct = Object.freeze({
      ...product,
      occurrences: Object.freeze(
        product.occurrences.map((occurrence) =>
          occurrence.id !== opening.id
            ? occurrence
            : Object.freeze({
                ...occurrence,
                doors: Object.freeze({
                  ...occurrence.doors,
                  targets: Object.freeze([
                    Object.freeze({
                      ...target,
                      room: Object.freeze({ ...target.room, gameName: 'ContradictoryRoom' }),
                    }),
                    ...openingDoors.targets.slice(1),
                  ]),
                }),
              }),
        ),
      ),
    });
    const contradictoryPlan = compileExecutionPlan({ product: contradictoryProduct });
    expect(() => decodeExecutionPlan(contradictoryPlan)).toThrow(
      /contradicts its occurrence identity/,
    );
  });

  it('rejects protocol-v9 trace products and malformed v10 unions', () => {
    expect(() => decodeExecutionPlan({ ...fOpeningFixture, protocolVersion: 9 })).toThrow(
      ExecutionPlanCodecError,
    );
    expect(() =>
      decodeExecutionPlan({
        ...fOpeningFixture,
        rooms: fOpeningFixture.occurrences,
        occurrences: undefined,
      }),
    ).toThrow(ExecutionPlanCodecError);
    const malformed = JSON.parse(JSON.stringify(fOpeningFixture)) as Record<string, unknown>;
    const occurrences = malformed.occurrences as Record<string, unknown>[];
    const timeline = occurrences[0]!.timeline as Record<string, unknown>;
    const transactions = timeline.transactions as Record<string, unknown>[];
    transactions[0] = {
      kind: 'acquisition',
      owner: 'opaque',
      sourceOwner: 'opaque',
      reward: {},
      producerLifecycleKey: 'x',
      roles: [],
      window: { kind: 'postOutgoing' },
      required: true,
    };
    expect(() => decodeExecutionPlan(malformed)).toThrow(ExecutionPlanCodecError);
  });

  it('rejects the G-only Anomaly payload on an F occurrence', () => {
    const { product } = planFor(fOnlyProject());
    const malformed = compileExecutionPlan({
      product: Object.freeze({
        ...product,
        occurrences: Object.freeze(
          product.occurrences.map((occurrence, index) =>
            index === 0
              ? Object.freeze({
                  ...occurrence,
                  anomaly: Object.freeze({
                    replacedRoomGameName: 'F_Combat01',
                    success: true,
                  }),
                })
              : occurrence,
          ),
        ),
      }),
    });
    expect(() => decodeExecutionPlan(malformed)).toThrow(/only supported for G occurrences/);
  });

  it('rejects unknown fields in the strict Anomaly payload union', () => {
    const malformed = JSON.parse(JSON.stringify(fgAnomalyFixture)) as {
      occurrences: Array<{ anomaly?: Record<string, unknown> }>;
    };
    const occurrence = malformed.occurrences.find((entry) => entry.anomaly !== undefined);
    if (occurrence?.anomaly === undefined) throw new Error('fixture lacks Anomaly payload');
    occurrence.anomaly.extra = true;
    expect(() => decodeExecutionPlan(malformed)).toThrow(/unknown field extra/);
  });

  it('rejects incomplete or duplicate interacted Well and Pool inventories', () => {
    const wellMalformed = JSON.parse(JSON.stringify(fgIxionChaosFixture)) as {
      occurrences: Array<{ overview: { stygianWell?: Record<string, unknown> } }>;
    };
    const wellOccurrence = wellMalformed.occurrences.find(
      (entry) => entry.overview.stygianWell !== undefined,
    );
    if (wellOccurrence?.overview.stygianWell === undefined)
      throw new Error('fixture lacks a Well overview');
    const well = wellOccurrence.overview.stygianWell;
    well.interacted = true;
    delete well.offers;
    expect(() => decodeExecutionPlan(wellMalformed)).toThrow(
      /offers must be present iff interacted/,
    );

    const duplicateWell = JSON.parse(JSON.stringify(fgIxionChaosFixture)) as {
      occurrences: Array<{
        overview: { stygianWell?: { interacted: boolean; offers?: unknown[] } };
      }>;
    };
    const duplicateWellOccurrence = duplicateWell.occurrences.find(
      (entry) => entry.overview.stygianWell?.offers !== undefined,
    );
    if (duplicateWellOccurrence?.overview.stygianWell?.offers === undefined)
      throw new Error('fixture lacks interacted Well inventory');
    duplicateWellOccurrence.overview.stygianWell.offers.push(
      duplicateWellOccurrence.overview.stygianWell.offers[0],
    );
    expect(() => decodeExecutionPlan(duplicateWell)).toThrow(/duplicate generation keys/);

    const poolMalformed = JSON.parse(JSON.stringify(fgIxionChaosFixture)) as {
      occurrences: Array<{ overview: { purgingPool?: Record<string, unknown> } }>;
    };
    const poolOccurrence = poolMalformed.occurrences.find(
      (entry) => entry.overview.purgingPool !== undefined,
    );
    if (poolOccurrence?.overview.purgingPool === undefined)
      throw new Error('fixture lacks a Pool overview');
    const pool = poolOccurrence.overview.purgingPool;
    pool.interacted = false;
    delete pool.traits;
    expect(() => decodeExecutionPlan(poolMalformed)).not.toThrow();
    pool.interacted = true;
    delete pool.traits;
    expect(() => decodeExecutionPlan(poolMalformed)).toThrow(
      /traits must be present iff interacted/,
    );

    const duplicatePool = JSON.parse(
      JSON.stringify(planFor(authorLegalTraitOffers(createUnderworldFPoolCheckpoint())).plan),
    ) as {
      occurrences: Array<{
        overview: { purgingPool?: { interacted: boolean; traits?: unknown[] } };
      }>;
    };
    const duplicatePoolOccurrence = duplicatePool.occurrences.find(
      (entry) => entry.overview.purgingPool?.traits !== undefined,
    );
    if (duplicatePoolOccurrence?.overview.purgingPool?.traits === undefined)
      throw new Error('fixture lacks interacted Pool inventory');
    duplicatePoolOccurrence.overview.purgingPool.traits[1] =
      duplicatePoolOccurrence.overview.purgingPool.traits[0];
    expect(() => decodeExecutionPlan(duplicatePool)).toThrow(/duplicate slot keys/);
  });
});
