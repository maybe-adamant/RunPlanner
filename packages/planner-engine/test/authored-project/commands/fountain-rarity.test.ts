import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  activeRoomActionReferences,
  createFountainRarityOutcomeAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  createProjectHistory,
  undoProjectHistory,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createCompleteFGProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';

const occurrence = createOccurrenceAddress(
  goldenFBiome,
  createOccurrenceId('completion:F:postboss'),
);
const fountainAction = createRoomActionAddress(
  goldenFBiome,
  occurrence.occurrenceId,
  roomActionKey({ kind: 'useFountain' }),
);
const outcome = createFountainRarityOutcomeAddress(fountainAction);

function project(): ProjectDocument {
  return createCompleteFGProject();
}

describe('Aromatic Phial authored fountain result', () => {
  it('round-trips one sparse target and supports clearing it', () => {
    const selected = applyProjectCommand(project(), catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome,
      targetTraitKey: 'ApolloWeaponBoon',
    });
    expect(
      selected.routes[0]?.biomes[0]?.completionOccurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      )?.fountainRarityResult,
    ).toEqual({ targetTraitKey: 'ApolloWeaponBoon' });
    const cleared = applyProjectCommand(selected, catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome,
      targetTraitKey: null,
    });
    expect(
      cleared.routes[0]?.biomes[0]?.completionOccurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      )?.fountainRarityResult,
    ).toBeUndefined();
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(selected)), catalog)).toEqual(
      selected,
    );
  });

  it('strictly decodes the sparse target shape and known trait identity', () => {
    const selected = applyProjectCommand(project(), catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome,
      targetTraitKey: 'ApolloWeaponBoon',
    });
    const encoded = JSON.parse(encodeProjectDocument(selected)) as {
      routes: Array<{ biomes: Array<{ completionOccurrences: Array<Record<string, unknown>> }> }>;
    };
    const completion = encoded.routes[0]?.biomes[0]?.completionOccurrences.find(
      (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
    );
    if (completion === undefined) throw new Error('missing encoded Postboss occurrence');
    completion.fountainRarityResult = {
      targetTraitKey: 'ApolloWeaponBoon',
      extra: true,
    };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(/not a project document field/);
    completion.fountainRarityResult = { targetTraitKey: 'UnknownTrait' };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(/unknown trait UnknownTrait/);
  });

  it('requires the exact nested useFountain action rather than a forged action key', () => {
    const forged = createFountainRarityOutcomeAddress(
      createRoomActionAddress(
        goldenFBiome,
        occurrence.occurrenceId,
        roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
      ),
    );
    expect(() =>
      applyProjectCommand(project(), catalog, {
        kind: 'ReplaceFountainRarityTarget',
        outcome: forged,
        targetTraitKey: 'ApolloWeaponBoon',
      }),
    ).toThrow('outcome does not own the exact fountain action');
  });

  it('rejects a useFountain target owned by a non-fountain topology declaration', () => {
    const document = project();
    const topology = document.routes[0]?.biomes[0]?.topology;
    const nonFountain = topology?.occurrences.find(
      (candidate) =>
        !activeRoomActionReferences(catalog, goldenFBiome, candidate).some(
          (reference) => reference.kind === 'useFountain',
        ),
    );
    if (nonFountain === undefined) throw new Error('missing non-fountain topology occurrence');
    const forged = createFountainRarityOutcomeAddress(
      createRoomActionAddress(
        goldenFBiome,
        nonFountain.occurrenceId,
        roomActionKey({ kind: 'useFountain' }),
      ),
    );
    expect(() =>
      applyProjectCommand(document, catalog, {
        kind: 'ReplaceFountainRarityTarget',
        outcome: forged,
        targetTraitKey: 'ApolloWeaponBoon',
      }),
    ).toThrow('outcome does not own the exact fountain action');
  });

  it('rejects a persisted target plus fabricated useFountain on a non-fountain topology occurrence', () => {
    type EncodedOccurrence = Record<string, unknown> & {
      roomActions: { order: Array<Record<string, unknown>> };
    };
    const encoded = JSON.parse(encodeProjectDocument(project())) as {
      routes: Array<{
        biomes: Array<{
          topology: {
            occurrences: Array<EncodedOccurrence>;
          } | null;
        }>;
      }>;
    };
    const topology = encoded.routes[0]?.biomes[0]?.topology;
    const nonFountain = topology?.occurrences.find(
      (candidate) =>
        !candidate.roomActions.order.some((reference) => reference.kind === 'useFountain'),
    );
    if (nonFountain === undefined) throw new Error('missing non-fountain topology fixture');
    nonFountain.roomActions = {
      order: [...nonFountain.roomActions.order, { kind: 'useFountain' }],
    };
    nonFountain.fountainRarityResult = { targetTraitKey: 'ApolloWeaponBoon' };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      'requires the declaration-owned fountain action',
    );
  });

  it('records target authoring as one semantic edit and restores it through undo', () => {
    const history = applyProjectHistoryCommand(createProjectHistory(project()), catalog, {
      kind: 'ReplaceFountainRarityTarget',
      outcome,
      targetTraitKey: 'ApolloWeaponBoon',
    });
    expect(
      history.present.routes[0]?.biomes[0]?.completionOccurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      )?.fountainRarityResult,
    ).toEqual({ targetTraitKey: 'ApolloWeaponBoon' });
    expect(undoProjectHistory(history).present).toEqual(project());
  });
});
