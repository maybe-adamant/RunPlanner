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
      '82e40c8c50f786809a02606af57b46dda90b267230918ba8ffa2090fb4b1fd95',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '78b9fba99d4ee42ca10930ebfe0b37be3a4df11306bd060350ad7f2fae53bed9',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '735201702e8226c3f1011abc3482bde6750f0ad19620d90e5fe78f543951fd9c',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'f9bdaa63c0b2aedf13088d5f9d6d742d73e3adfefdce43d5864809d02c0d43b4',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '533b386fb7844348d80813b4b63023c0886d305631c9977aa83da9fff61bda05',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '094e5877f94bd45fd0621554144c5315be8d7f2dbcdb62ef8462bf7bca09c9d1',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '8eab9570317fe7e8abda8610ec505781942e0dca3eb8ad2b5c1a02b6053e1ab4',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '84e40b00ea1a52ba7a56d56f25c79df5d8f365c75877cbd18da0d2045d12fad5',
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
      '29bde96c179c73d13fcdac28e5802f634ff3d01ca45f73dae58531418d276da5',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '0eccafb8b8c66d9336bd978e61888cdb09bc749c789d782f0cd5e1944be753f0',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'cd3db551ee08a3e191efbbd2a1997cd1891b43754364e531e4adbd68483a4c18',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '5acb539aeee265ff8513f0f2a69f4ff88a18f33c7a97240d0c9635e0b42ff5d2',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
