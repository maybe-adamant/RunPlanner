import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';

const combat = createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-combat02'));
const postboss = createOccurrenceAddress(
  goldenFBiome,
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);

function occurrenceOf(project: ProjectDocument, address: typeof combat) {
  return project.route.biomes
    .find((biome) => biome.biomeKey === address.biomeKey)!
    .topology!.occurrences.find((entry) => entry.occurrenceId === address.occurrenceId)!;
}

type Raw = {
  route: { biomes: { biomeKey: string; topology: { occurrences: Record<string, unknown>[] } }[] };
};
function rawOccurrence(raw: Raw, address: typeof combat) {
  return raw.route.biomes
    .find((biome) => biome.biomeKey === address.biomeKey)!
    .topology.occurrences.find((entry) => entry.occurrenceId === address.occurrenceId)!;
}

describe('room layout commands', () => {
  it('replaces the whole layout, clears it to absence and refuses a non-start entry', () => {
    const project = createGoldenFGHIProject();
    const flipped = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence: combat,
      layout: { flipped: false, entryStartPointId: 622320 },
    });
    expect(occurrenceOf(flipped, combat).layout).toEqual({
      flipped: false,
      entryStartPointId: 622320,
    });
    expect(
      applyProjectCommand(flipped, catalog, {
        kind: 'ReplaceRoomLayout',
        occurrence: combat,
        layout: { flipped: false, entryStartPointId: 622320 },
      }),
    ).toBe(flipped);
    const cleared = applyProjectCommand(flipped, catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence: combat,
      layout: {},
    });
    expect('layout' in occurrenceOf(cleared, combat)).toBe(false);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceRoomLayout',
        occurrence: combat,
        layout: { entryStartPointId: 1 },
      }),
    ).toThrow(/not a HeroStart/);
  });

  it('round-trips a layout and rejects an empty or foreign one on decode', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence: combat,
      layout: { flipped: true },
    });
    const raw = JSON.parse(encodeProjectDocument(project)) as Raw;
    expect(decodeProjectDocument(raw, catalog)).toEqual(project);
    rawOccurrence(raw, combat).layout = {};
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(/absence is the unset layout/);
    rawOccurrence(raw, combat).layout = { entryStartPointId: 1 };
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(/not a HeroStart/);
  });

  it('clears the layout with a room replacement', () => {
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence: combat,
      layout: { flipped: true },
    });
    const replaced = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: combat,
      gameName: 'H_Combat04',
    });
    expect('layout' in occurrenceOf(replaced, combat)).toBe(false);
  });
});

describe('room object anchor commands', () => {
  it("places a present object on one of the room's anchors and back to native", () => {
    const project = createGoldenFGHIProject();
    const anchors = catalog.rooms.byKey.F_PostBoss01!.mapPoints!.challengeSwitchAnchors;
    const placed = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRoomObjectAnchor',
      occurrence: postboss,
      object: 'purgingPool',
      anchorId: anchors[1]!.id,
    });
    expect(occurrenceOf(placed, postboss).purgingPool?.anchorId).toBe(anchors[1]!.id);
    const raw = JSON.parse(encodeProjectDocument(placed)) as Raw;
    expect(decodeProjectDocument(raw, catalog)).toEqual(placed);
    (rawOccurrence(raw, postboss).purgingPool as Record<string, unknown>).anchorId = 1;
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(/not a ChallengeSwitchBase/);
    const native = applyProjectCommand(placed, catalog, {
      kind: 'ReplaceRoomObjectAnchor',
      occurrence: postboss,
      object: 'purgingPool',
      anchorId: null,
    });
    expect(occurrenceOf(native, postboss).purgingPool).toEqual(
      occurrenceOf(project, postboss).purgingPool,
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceRoomObjectAnchor',
        occurrence: postboss,
        object: 'purgingPool',
        anchorId: 1,
      }),
    ).toThrow(/not a ChallengeSwitchBase/);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceRoomObjectAnchor',
        occurrence: postboss,
        object: 'challengeSwitch',
        anchorId: anchors[1]!.id,
      }),
    ).toThrow(/holds no challengeSwitch/);
  });
});
