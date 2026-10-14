import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceId,
  semanticAddressKey,
  type AuthoredAdditionalExit,
  type BiomeTopology,
  type ExitDecision,
  type ExitSelection,
  type BiomeAddress,
  type OccurrenceId,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  authoredBatchEnteredRewardStores,
  canonicalBatchEnteredRewardStores,
  materializeBiomePrefix,
  type CanonicalBatch,
} from '@run-planner/engine/simulation';
import { loadSurfaceNOProject } from '@run-planner/test-fixtures/surface';

import {
  enteredRewardStore,
  resolvedStoreKey,
} from '../../src/simulation/materialization/rooms/templates';
import { ordinaryPositionFor } from '../support/route-position';
import { createSelectedContractContinuationProject } from './support/detour-generation-fixtures';
import { createCompleteFTakeoverProject, fBiome } from './support/f-takeover-project';

const sourceId = createOccurrenceId('entered-store-source');

interface BatchSpec {
  readonly sourceGameName: string;
  readonly baseStore: string | null;
  /** A ShipCombat source whose last active wheel decided the store. */
  readonly shipWheelStore?: string;
  readonly targets: readonly { readonly exitKey: string; readonly gameName: string }[];
  readonly additional?: readonly {
    readonly key: 'chaos' | 'zagreusContract';
    readonly gameName: string;
  }[];
  readonly selection: ExitSelection;
}

function occurrence(
  occurrenceId: OccurrenceId,
  gameName: string,
  additionalExits: readonly AuthoredAdditionalExit[] = [],
  state?: object,
): RoomOccurrence {
  return { occurrenceId, gameName, additionalExits, state } as unknown as RoomOccurrence;
}

/** A minimal authored batch over real room declarations. */
function batch(spec: BatchSpec): {
  readonly topology: BiomeTopology;
  readonly decision: ExitDecision;
} {
  const targets = spec.targets.map((target) => ({
    ...target,
    occurrenceId: createOccurrenceId(`entered-store-${target.exitKey}`),
  }));
  const additional = (spec.additional ?? []).map((exit) => ({
    ...exit,
    occurrenceId: createOccurrenceId(`entered-store-${exit.key}`),
  }));
  const topology = {
    startOccurrenceId: sourceId,
    occurrences: [
      occurrence(
        sourceId,
        spec.sourceGameName,
        additional.map(
          (exit) =>
            ({
              kind: exit.key,
              key: exit.key,
              occurrenceId: exit.occurrenceId,
            }) as unknown as AuthoredAdditionalExit,
        ),
        spec.shipWheelStore === undefined
          ? undefined
          : {
              kind: 'shipCombat',
              encounterCount: 2,
              wheels: { wheel1: { storeKey: spec.shipWheelStore } },
            },
      ),
      ...targets.map((target) => occurrence(target.occurrenceId, target.gameName)),
      ...additional.map((exit) => occurrence(exit.occurrenceId, exit.gameName)),
    ],
    decisions: [],
    fixedRoomLinks: [],
  } as unknown as BiomeTopology;
  const decision: ExitDecision = {
    kind: 'exit',
    source: { kind: 'occurrence', occurrenceId: sourceId },
    normal: {
      kind: 'batch',
      rewardStore:
        spec.shipWheelStore === undefined
          ? { kind: 'authoredBaseStore', baseRewardStoreKey: spec.baseStore }
          : { kind: 'sourceOfferPoint' },
      batchState: null,
      targets: targets.map(({ exitKey, occurrenceId }) => ({ exitKey, occurrenceId })),
    },
    selection: spec.selection,
  };
  return { topology, decision };
}

function stores(spec: BatchSpec) {
  const { topology, decision } = batch(spec);
  return authoredBatchEnteredRewardStores(catalog, topology, decision);
}

describe('entered reward store precedence', () => {
  const base = catalog.rooms.byKey.F_Combat02!;

  it('lets an individual store win over a forced one, as the door does', () => {
    const room: RoomDeclaration = Object.freeze({
      ...base,
      forcedRewardStoreKey: 'RunProgress',
      individualRewardStoreKey: 'MetaProgress',
    });
    expect(resolvedStoreKey(room, 'RunProgress')).toBe('MetaProgress');
    expect(enteredRewardStore(room, 'RunProgress')).toEqual({
      kind: 'store',
      storeKey: 'MetaProgress',
    });
  });

  it('reads fixed, none and unresolved entered stores from the declaration', () => {
    expect(enteredRewardStore(catalog.rooms.byKey.C_Boss01!, 'MetaProgress')).toEqual({
      kind: 'store',
      storeKey: 'RunProgress',
    });
    expect(enteredRewardStore(catalog.rooms.byKey.O_Combat01!, 'RunProgress')).toEqual({
      kind: 'none',
    });
    expect(enteredRewardStore(base, undefined)).toEqual({ kind: 'unresolved' });
  });
});

describe('authored batch entered reward stores', () => {
  it('flips an ordinary door to the store a forced sibling writes over the batch', () => {
    const product = stores({
      sourceGameName: 'F_Opening01',
      baseStore: 'MetaProgress',
      targets: [
        { exitKey: 'exit1', gameName: 'F_Combat02' },
        { exitKey: 'exit2', gameName: 'F_MiniBoss01' },
      ],
      selection: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(product.exits.map((exit) => [exit.exit, exit.entered])).toEqual([
      [
        { kind: 'normal', exitKey: 'exit1' },
        { kind: 'store', storeKey: 'RunProgress' },
      ],
      [
        { kind: 'normal', exitKey: 'exit2' },
        { kind: 'store', storeKey: 'RunProgress' },
      ],
    ]);
    expect(product.selected).toMatchObject({
      gameName: 'F_Combat02',
      entered: { kind: 'store', storeKey: 'RunProgress' },
    });
  });

  it('keeps the ship-decided store at a single unpinned door', () => {
    const alone = stores({
      sourceGameName: 'O_Combat07',
      baseStore: null,
      shipWheelStore: 'MetaProgress',
      targets: [{ exitKey: 'exit1', gameName: 'O_Reprieve01' }],
      selection: { kind: 'derived' },
    });
    expect(alone.selected?.entered).toEqual({ kind: 'store', storeKey: 'MetaProgress' });
  });

  it('keeps the batch store at a single unpinned door', () => {
    const product = stores({
      sourceGameName: 'F_Opening01',
      baseStore: 'MetaProgress',
      targets: [{ exitKey: 'exit1', gameName: 'F_Combat02' }],
      selection: { kind: 'derived' },
    });
    expect(product.selected?.entered).toEqual({ kind: 'store', storeKey: 'MetaProgress' });
  });

  it('reports a door whose room records no entered store as none', () => {
    const product = stores({
      sourceGameName: 'O_Shop01',
      baseStore: 'RunProgress',
      targets: [{ exitKey: 'exit1', gameName: 'O_Combat01' }],
      additional: [{ key: 'zagreusContract', gameName: 'C_Boss01' }],
      selection: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(product.selected).toMatchObject({ gameName: 'O_Combat01', entered: { kind: 'none' } });
  });

  it('counts a selected additional exit by its own room store', () => {
    const contract = stores({
      sourceGameName: 'O_Shop01',
      baseStore: 'MetaProgress',
      targets: [{ exitKey: 'exit1', gameName: 'O_Combat01' }],
      additional: [{ key: 'zagreusContract', gameName: 'C_Boss01' }],
      selection: { kind: 'additional', additionalExitKey: 'zagreusContract' },
    });
    expect(contract.selected).toMatchObject({
      exit: { kind: 'additional', additionalExitKey: 'zagreusContract' },
      gameName: 'C_Boss01',
      entered: { kind: 'store', storeKey: 'RunProgress' },
    });
    const chaos = stores({
      sourceGameName: 'F_Opening01',
      baseStore: null,
      targets: [],
      additional: [{ key: 'chaos', gameName: 'Chaos_01' }],
      selection: { kind: 'additional', additionalExitKey: 'chaos' },
    });
    expect(chaos.selected).toMatchObject({
      gameName: 'Chaos_01',
      entered: { kind: 'store', storeKey: 'Secrets' },
    });
  });

  it('publishes every exit and no selection while none is chosen', () => {
    const product = stores({
      sourceGameName: 'O_Shop01',
      baseStore: null,
      targets: [],
      additional: [{ key: 'zagreusContract', gameName: 'C_Boss01' }],
      selection: { kind: 'unresolved' },
    });
    expect(product.selected).toBeUndefined();
    expect(product.exits).toHaveLength(1);
  });
});

function expectAuthoredMatchesCanonical(
  project: ProjectDocument,
  biome: BiomeAddress,
  expectBatch: (batches: readonly CanonicalBatch[]) => void,
) {
  const plan = project.route.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)!;
  const snapshot = materializeBiomePrefix(
    catalog,
    biome,
    ordinaryPositionFor(catalog, biome),
    plan,
    project.route.loadout,
  );
  const batches = (snapshot?.decisions ?? []).filter(
    (decision): decision is CanonicalBatch => decision.kind === 'batch',
  );
  expectBatch(batches);
  for (const canonical of batches) {
    const authored = plan.topology!.decisions.find(
      (decision): decision is ExitDecision =>
        decision.kind === 'exit' &&
        semanticAddressKey(createExitDecisionAddress(biome, decision.source)) ===
          semanticAddressKey(canonical.origin),
    )!;
    expect(canonicalBatchEnteredRewardStores(catalog, canonical)).toEqual(
      authoredBatchEnteredRewardStores(catalog, plan.topology!, authored),
    );
  }
}

describe('canonical batch entered reward stores', () => {
  it('agrees with the authored reading for an F batch beside a contract', () => {
    expectAuthoredMatchesCanonical(
      createSelectedContractContinuationProject().project,
      createBiomeAddress('Underworld', 'F'),
      (batches) => expect(batches.length).toBeGreaterThan(0),
    );
  });

  it('agrees with the authored reading for O ship-decided batches', () => {
    expectAuthoredMatchesCanonical(
      loadSurfaceNOProject(),
      createBiomeAddress('Surface', 'O'),
      (batches) =>
        expect(batches.some((batch) => batch.rewardStore.kind === 'sourceOfferPoint')).toBe(true),
    );
  });

  it('agrees with the authored reading for a takeover batch', () => {
    expectAuthoredMatchesCanonical(createCompleteFTakeoverProject(), fBiome, (batches) =>
      expect(
        batches.some((batch) =>
          batch.targets.some((target) => target.room.gameName === 'F_PreBoss01'),
        ),
      ).toBe(true),
    );
  });
});
