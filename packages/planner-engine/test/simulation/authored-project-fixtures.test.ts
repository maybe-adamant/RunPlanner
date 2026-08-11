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
      'dd3946b7d9dedadf4f3112ed6229133a11325d8ab3c298fc2ecc056f510d2162',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '357921bef40f1395d712f2bbb4cffc1d7be0523c3cc3adacfb42ced25be8306e',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '48b47459c796fa6f60dff6bbc024d4fbf1fbcdbf24d5b0132d5ef3a0664efd6e',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '03387c1efb2d6fdbb0659bad0419583e299d48c5356fe3376e5d4c0424f1772d',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'eb307fab628641257e8d354e7dd2dab8979ab6378195064a40ca2cae8e551540',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'ae30f1e55e7566e39f7d8a9f3aff4203bdf2f443e55e54860c7ccd0c81b8782f',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '7c74f89b21f01379fa99543114930e41222fe4e86fd6c8469c403173c528960a',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'b7622af2874434346844f58c6709b1067daae5cf9b79fd98af6301c8a5ff9c96',
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
      'f3e3e4c830688df558d2f1d6247d624ec2c17edfb646b59a317523b260c490d5',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '813671b9fd93754f6dd2aa81f15d49c06bf174d2da1c5cfa4f9a7c61bcc56c4a',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '12e36c8f03a1a464d67668039714c7b03d47a3044ce373413266188796c26174',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'a624c94d961f1aa0cf36187dd890ea88b037cea22946f883ab4f210f14164869',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
