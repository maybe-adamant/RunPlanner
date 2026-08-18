/// <reference types="node" />

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  createCompleteFGProject,
  createGoldenFGHProject,
  createGoldenFGHIProject,
  createRepresentativeNOProject,
  createRepresentativeNOPProject,
  createRepresentativeNOPQProject,
  createRepresentativeNProject,
  nFixedOccurrenceIds,
  nOccurrenceIds,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures';

function authoredDocumentDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('canonical authored-project fixtures', () => {
  it.each([
    [
      'Underworld F/G default',
      () => createCompleteFGProject(),
      '1effef53e558f60a833ad34066620ce954a392687a707b087f9b32e9fdb985f4',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'a7765201ebdadef6ab582ce6abe1be19e201dc8bab2e29f15892423dbe4f368d',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'c1ab0b4280ce437af4b9810ded53b1c54f4a092001b9763025c37d2165d399f1',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '692217af7e8cf82004658cdfb5140789b4594d5cbe7acc2513bf63a67ec3520a',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '134d10331da71ab04bf0019b7cbc304f7c574ff122d6a54aa5b2215b1f08354e',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '19bbb4d2cbcb0a803f51c99e030aeaf96cc42171a1e1a90d90e14a20caed4b9e',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'e9bcbe8aa8a669354695a6e62decb95201cca093defbd03dbf026009bbd9d1c1',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'ae8c7fbabfb7b8a0f6520c13035f6ce9a1e44f98cefa2eee675652cce5b6b34a',
    ],
    [
      'Surface N alternate open Hub slot',
      () =>
        createRepresentativeNProject({
          openSlotKeys: [
            'combat11',
            'combat10',
            'combat09',
            'combat05',
            'story',
            'combat02',
            'combat01',
            'miniBoss01',
            'combat23',
          ],
          visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'story'],
        }),
      '069a6b73480fcb1ee9f0a0403d5cb1878221c5b44af44d3d195208dfdaa3396c',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '5df15ddeb5ed52a0bdfbd542b1e4b5354c7d3310f44935ec7f8b5581d0a0f66a',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '1f2cdc56548ca5e434110d80a962e9f1c3ae69c2972326d7bd42863db12bff22',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '460aa5d203959b2fcbd1720d3d79058ae80f9349cc990009c3410e84fc1be075',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
