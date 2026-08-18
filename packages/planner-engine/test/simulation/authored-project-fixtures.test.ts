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
      '0a19dc616cd0346257f4004a96d546bdec2571812de535e5dc94fca0aa673857',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '542f2f61807ae9e70e578fd3bdeb0c13bf59202b2aa8c091bde358ba7ddd8192',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '7491c43c5ac3417454abd265559a48e914adbd429ec517b8b1abc052b4700727',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'bc3095e9f94fe3e5df2b2424699f10b2fdc08a9954072a390c2076a04c9ff703',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '004c60b7c5410842aac2cca68f2dfac14fc16f9910742837458b3e16ea7b65d1',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '1ab0cacf171a3ce8c012f8f85421d10b2e5bb2da650b3c803a32de3ec3f7be1f',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '0bb697840180062f5dbf3520f418c0aac5e87df9587b70936b24a3bf0197db12',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '2b34561d5cb2854be53d134af2cd9b657a440b90f3cba7ba853c561f315632ae',
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
      '87d7ae25288a9b4c85a10196da0ed5ee84d0bbc1a22ea96b9c66839e4ecb798c',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '9a499b9ae2951186af42dd372b2204a01e7a512107edf754dccc12bbf4f0db15',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '330e23238c3ac012593676e18c42a4a47654b92a52279fbfb08f72c2a22ad201',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '32ddb31371aa68431bafe74f4534db6490ea0f79bb6515cf5a29926deb91e5b6',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
