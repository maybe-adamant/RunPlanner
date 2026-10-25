import { createProjectDocument } from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import { createWorkerDraftRunner, type DraftRunRequest } from '@planner/workspace/draftRun';
import type {
  DraftRunEvent,
  DraftWorkerRequest,
  DraftWorkerResponse,
} from '@planner/workspace/draftWorkerProtocol';

/** Records what the runner posts and lets the test answer as the worker. */
class FakeWorker {
  readonly posted: DraftWorkerRequest[] = [];
  terminated = false;
  onmessage: ((message: MessageEvent<DraftWorkerResponse>) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;

  postMessage(message: DraftWorkerRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  answer(id: number, event: DraftRunEvent): void {
    this.onmessage?.({ data: { id, event } } as MessageEvent<DraftWorkerResponse>);
  }

  crash(message: string): void {
    this.onerror?.({ message, preventDefault() {} } as ErrorEvent);
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const runner = createWorkerDraftRunner(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  });
  const request: DraftRunRequest = {
    project: createProjectDocument(catalog, {
      projectId: 'run-plan',
      routeKey: 'Underworld',
      configuredBiomeCount: 0,
    }),
    spec: {
      loadout: {
        weaponKey: 'WeaponStaffSwing',
        aspectKey: 'BaseStaffAspect',
        familiarKey: 'FrogFamiliar',
        manualArcanaKeys: [],
        fearRanks: {},
        startingKeepsakeKey: 'MaxHealthKeepsake',
      },
      world: { godKeys: [], storyNpcByBiome: {}, fieldNpcsByBiome: {} },
      basketByGiver: {},
      rackKeepsakeKeys: [null, null, null],
    },
    seed: 5,
  };
  const start = () => {
    const events: DraftRunEvent[] = [];
    const handle = runner.start(request, (event) => events.push(event));
    return { events, handle };
  };
  return { start, workers };
}

const settled: DraftRunEvent = {
  kind: 'settled',
  result: { kind: 'failed', biomeKey: 'F', reasons: [] },
};

describe('worker draft runner', () => {
  it('routes each answer to the run with its id, over one worker', () => {
    const { start, workers } = setup();
    const first = start();
    const second = start();
    expect(workers).toHaveLength(1);
    const [a, b] = workers[0]!.posted;
    expect(a!.id).not.toBe(b!.id);
    expect(a!.seed).toBe(5);
    workers[0]!.answer(b!.id, settled);
    expect(first.events).toEqual([]);
    expect(second.events).toEqual([settled]);
    workers[0]!.answer(a!.id, settled);
    expect(first.events).toEqual([settled]);
  });

  it('terminates the worker on cancel and starts a new one for the next run', () => {
    const { start, workers } = setup();
    const run = start();
    run.handle.cancel();
    expect(workers[0]!.terminated).toBe(true);
    workers[0]!.answer(workers[0]!.posted[0]!.id, settled);
    expect(run.events).toEqual([]);

    const next = start();
    expect(workers).toHaveLength(2);
    workers[1]!.answer(workers[1]!.posted[0]!.id, settled);
    expect(next.events).toEqual([settled]);
  });

  it('reports a worker crash to every run and replaces the worker', () => {
    const { start, workers } = setup();
    const first = start();
    const second = start();
    workers[0]!.crash('boom');
    expect(first.events).toEqual([{ kind: 'error', message: 'boom' }]);
    expect(second.events).toEqual([{ kind: 'error', message: 'boom' }]);
    expect(workers[0]!.terminated).toBe(true);
    start();
    expect(workers).toHaveLength(2);
  });
});
