import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../src/import';
import { fixture, occurrence, occurrenceOf } from './support/run-import';

describe('run import of Fields cages', () => {
  const BRIDGE = 28;
  const UNTAKEN = 'H-r28-d565616';
  let imported: RunImport;

  beforeAll(() => {
    // The Bridge's untaken door as a record shows it when a store refilled: no cages attributed.
    const record = fixture('underworld-1010');
    imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === BRIDGE
          ? {
              ...room,
              doors: room.doors.map((door) => {
                const { cageRewards, ...rest } = door;
                return cageRewards === undefined ? door : rest;
              }),
            }
          : room,
      ),
    });
  });

  it("takes an untaken door's cages the stores lost across its room", () => {
    const state = occurrence(imported.project, UNTAKEN).state;
    expect(
      state.kind === 'fieldsCombat'
        ? Object.values(state.cages)
            .flatMap((cage) => (cage === null ? [] : [cage.offer.rewardType]))
            .sort()
        : [],
    ).toEqual(['HermesUpgrade', 'MaxHealthDrop', 'MaxManaDrop']);
    expect(
      imported.report.entries.filter((entry) => occurrenceOf(entry.address) === UNTAKEN),
    ).toEqual([]);
    const bridge = imported.report.rooms![BRIDGE]!;
    expect(bridge.verdict !== 'unchecked' && bridge.introduced).toEqual([]);
  });

  it('takes the twin door to the entered room whose draws the next entry save accepts', () => {
    // The capture's Bridge offers two doors to H_Combat07 that no saved fact tells apart; only
    // with the second in native order taken can the other's cages be drawn before the refill.
    const capture = projectFromRunRecord(catalog, fixture('underworld'));
    const untaken = occurrence(capture.project, 'H-r28-d565616').state;
    expect(untaken.kind === 'fieldsCombat' && Object.values(untaken.cages).length).toBe(3);
    expect(
      capture.project.route.biomes
        .flatMap((biome) => biome.topology?.occurrences ?? [])
        .some((entry) => entry.occurrenceId === 'H-r28-d564300'),
    ).toBe(false);
    expect(capture.report.rooms![BRIDGE]).toMatchObject({ verdict: 'accepted' });
  });
});
