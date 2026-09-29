import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  decodeProjectDocument,
  encodeProjectDocument,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createFreshFileRouteProject,
  freshFileGBiome,
  freshFileGFirstCombatId,
  freshFileGIntroId,
} from '@run-planner/test-fixtures/fresh-file';

let cached: ProjectDocument | undefined;
const freshRoute = () => (cached ??= createFreshFileRouteProject());

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- encoded JSON edited before strict decoding
type RawJson = any;

function editOccurrence(
  project: ProjectDocument,
  occurrenceId: string,
  edit: (raw: RawJson) => void,
) {
  const raw = JSON.parse(encodeProjectDocument(project));
  for (const biome of raw.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      if (occurrence.occurrenceId === occurrenceId) edit(occurrence);
  return raw;
}

const gIntro = createOccurrenceAddress(freshFileGBiome, freshFileGIntroId);

describe('Eris observation codec', () => {
  it('round-trips a spawned Eris with its talk and gift on a Fresh File host', () => {
    const encoded = encodeProjectDocument(freshRoute());
    expect(encodeProjectDocument(decodeProjectDocument(JSON.parse(encoded), catalog))).toBe(
      encoded,
    );
  });

  it('rejects the observation on a room that hosts no Eris on its route', () => {
    const onCombat = editOccurrence(freshRoute(), freshFileGFirstCombatId, (occurrence) => {
      occurrence.eris = { spawned: true };
    });
    expect(() => decodeProjectDocument(onCombat, catalog)).toThrow(
      /occurrences\[\d+\]\.eris: G_Combat01 hosts no Eris on route FreshFile/,
    );
    const mature = loadUnderworldFGHICheckpoint();
    for (const introId of ['golden-g-intro', 'golden-h-intro', 'golden-i-intro']) {
      const raw = editOccurrence(mature, introId, (occurrence) => {
        occurrence.eris = { spawned: true };
      });
      expect(() => decodeProjectDocument(raw, catalog)).toThrow(
        /\.eris: [GHI]_Intro hosts no Eris on route Underworld/,
      );
    }
  });

  it('rejects a false observation, an orphan talk, and an orphan or missing gift', () => {
    expect(() =>
      decodeProjectDocument(
        editOccurrence(freshRoute(), freshFileGIntroId, (occurrence) => {
          occurrence.eris = { spawned: false };
        }),
        catalog,
      ),
    ).toThrow(/\.eris\.spawned: must be true when present/);
    expect(() =>
      decodeProjectDocument(
        editOccurrence(freshRoute(), freshFileGIntroId, (occurrence) => {
          delete occurrence.eris;
          delete occurrence.acquisitionSites;
          occurrence.roomActions.order = [{ kind: 'interactEris' }];
        }),
        catalog,
      ),
    ).toThrow(/roomActions\.order: an Eris interaction requires the spawned Eris observation/);
    expect(() =>
      decodeProjectDocument(
        editOccurrence(freshRoute(), freshFileGIntroId, (occurrence) => {
          delete occurrence.eris;
          occurrence.roomActions.order = [];
        }),
        catalog,
      ),
    ).toThrow(/acquisitionSites\.erisGift\.pickupEntries: has no selected pickup producer/);
    expect(() =>
      decodeProjectDocument(
        editOccurrence(freshRoute(), freshFileGIntroId, (occurrence) => {
          delete occurrence.acquisitionSites;
          occurrence.roomActions.order = [{ kind: 'interactEris' }];
        }),
        catalog,
      ),
    ).toThrow(/acquisitionSites\.erisGift\.pickupEntries: does not match selected descriptor/);
  });
});

describe('SetErisSpawned', () => {
  it('sets and clears the observation with its derived talk and gift', () => {
    const cleared = applyProjectCommand(freshRoute(), catalog, {
      kind: 'SetErisSpawned',
      occurrence: gIntro,
      spawned: false,
    });
    const intro = (project: ProjectDocument) =>
      project.route.biomes[1]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === freshFileGIntroId,
      )!;
    expect(intro(cleared)).toMatchObject({ roomActions: { order: [] } });
    expect(intro(cleared).eris).toBeUndefined();
    expect(intro(cleared).acquisitionSites).toBeUndefined();
    const restored = applyProjectCommand(cleared, catalog, {
      kind: 'SetErisSpawned',
      occurrence: gIntro,
      spawned: true,
    });
    expect(encodeProjectDocument(restored)).toBe(encodeProjectDocument(freshRoute()));
    expect(
      applyProjectCommand(cleared, catalog, {
        kind: 'SetErisSpawned',
        occurrence: gIntro,
        spawned: false,
      }),
    ).toBe(cleared);
  });

  it('records each edit as one history step', () => {
    const history = applyProjectHistoryCommand(createProjectHistory(freshRoute()), catalog, {
      kind: 'SetErisSpawned',
      occurrence: gIntro,
      spawned: false,
    });
    expect(history.past).toHaveLength(1);
    const undone = undoProjectHistory(history);
    expect(undone.present).toBe(freshRoute());
    expect(redoProjectHistory(undone).present).toBe(history.present);
  });

  it('refuses a room or route without an Eris host', () => {
    expect(() =>
      applyProjectCommand(freshRoute(), catalog, {
        kind: 'SetErisSpawned',
        occurrence: createOccurrenceAddress(freshFileGBiome, freshFileGFirstCombatId),
        spawned: true,
      }),
    ).toThrow(/G_Combat01 hosts no Eris on this route/);
    expect(() =>
      applyProjectCommand(loadUnderworldFGHICheckpoint(), catalog, {
        kind: 'SetErisSpawned',
        occurrence: createOccurrenceAddress(
          createBiomeAddress('Underworld', 'G'),
          createOccurrenceId('golden-g-intro'),
        ),
        spawned: true,
      }),
    ).toThrow(/G_Intro hosts no Eris on this route/);
  });
});
