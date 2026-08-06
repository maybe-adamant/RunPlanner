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
      'a0662ea738beb1f801fb66336fc9d79eacf301898b81440d1bb309c5fb694516',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '3b569ce6da61fabe9d63f2aa6c1bfff2fd642c4037b828afa6192fecf808877b',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '0c4f00567d4678ee5a15f914442571037b63d6fe87d543b886fddd52d3febf70',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'f8eb5a7ed1a001cfe84c88f8beaf0dc8e5c22b694f77d9019f57961b12b0eb87',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'b945ef2eaf8f6f3e0a4b469e6e8aaa7cd28cb271437a409948190ce2c6a1692e',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '6467f4a4ff493e1fc96aba2a59bf0d259c78bd3fe01bf2dd6fda37636a22ce8b',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '3090611596895d0d1298ff2d66f1ee39a3364827a088df36caf888727b3742de',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '2f32cb16e2345ce605bcb5fcfad866e07cf17d90f9eeeea82aafdb30828d2ce3',
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
      '723b52f153ad593fe97fbe5c324185ea7da251c2299243ef0b23021591d66482',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '31a5cb545a4b307d787a2de96f40d44e37c6125c22bcd5e9bf1b243e3e44d88e',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '8b63c3e10e1fd8e44b65f81a6e6b7c6af3c5fa954e0c6c4a4730bb6f1e486e2a',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'f26398554109617c0439e079c4113a0510b177679831ec75bf3d413be3b7f45c',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
