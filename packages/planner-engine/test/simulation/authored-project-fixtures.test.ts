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
      '1ce7c8e843e26bb69da135f687c0f3fa7f41554c70ab031b6c15f186e0cc0fc5',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'ec81d93651a54fd6a09eb6d14e5c5b98b5426232a5af5868b9e53ddd330d74bb',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'fadf2cc481239d96aae1a8cc345dae62193136d2482deed52c992f51bb210edb',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'f57dc2c559e8d80f60a45af93263846c9ed5d26e645a2874e03dbed024c50bfc',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'f5ae8c5357572d1678fbb83918eaba507b053f3e1b53812356744f979f6262e6',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '0ee6e21149225067af25d4437484899321ecf3a566512e632a6b7d5c536af0ec',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'e1baa228aea22db61b0a8d07a7eeb4b6ce98bd46f9e4320a8884fc1e916e94bb',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'a35c21252d52fa0fbad0b00980ccf5a458fa1f24e1ce1c99e8b628b217e5d888',
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
      'be5185c2a928929640e32ef38ac9d2479f88d0098a3823df1e2614f01142f25f',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'e95e9aaa1b5a1ecd752b08d94e0aa2790df634ab2c66817ab6d2a3b544319250',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'c2fe445aaaf391dff9c73160b7132466723946369b72cd86e230ba9f669514c5',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '3d5a25783ae29991f27850ed1179e8c9b2c090892ad5ee22f1fbeb21d08adbae',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
