/// <reference types="node" />

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  createCompleteFGProject,
  createGoldenFGHProject,
  createGoldenFGHIProject,
} from '@run-planner/test-fixtures/underworld';
import {
  createRepresentativeNOProject,
  createRepresentativeNOPProject,
  createRepresentativeNOPQProject,
  createRepresentativeNProject,
  nFixedOccurrenceIds,
  nOccurrenceIds,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures/surface';

function authoredDocumentDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('canonical authored-project fixtures', () => {
  it.each([
    [
      'Underworld F/G default',
      () => createCompleteFGProject(),
      '9858d88a816ed38b6aaf7585b2810276ea2897b94395ee1b7276c66afb3a455c',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '150f9808ce4ee3ac79b282eea4a437899aec54f3836ebc753298dcb0f87e0285',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'b4f091fc1794640c13d6c1908d3bce2a5ade5657c671f8f971343bc416fc839b',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '114add76a0f6f9165448f3c4f9df000e07665122aa69ae1cbc7936bd5673ab00',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '362900acf726033d4376a8c1dca4187e715d0f2d96b79ae85761645b85968dc9',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '36a203ed679ae1cbda4446567193c38beb8d8cb1e151605fcae722bdc6b93c2f',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '467044f494b0f39ea1ad5158e24671d20903855c1fae186b8e0a26f1e483ec6f',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'c06ec0e9d679cd0d938a3d089ea1338017e1a105c672c7f57d0ede170dc2598f',
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
      '6ba903a3844b3f0590040fc80cf4ddb3e575b7055456f58cd5ae78e5be686aef',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '5e431940879b6066955779ca15c7c6d9a6a6347e7c6292a0ae0e42609f386c67',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '86ba73f172cbfc2357ea5591a9e06c55c15d7346f07eac518f70647cb46820c8',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'd4d31a46175d1c13b09e30bb81cb30da743b4885374ab49743e7e58f6cf429e7',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
