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
      'b68bb736af313fc5a090f63ea3080505fa08e97be03cffb6db6aba8b22054398',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '300a04512f0b093b5fec1e9215438d0deb187ec097d80f55e999cbdf1367f7be',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'c46ad403eefeb2b5feafd46ee99815264a175936100238e5a379ffe229ef5870',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '307e5ff3d4d8eb071197b3037d0a66c3aac201864b38baf407f08f0a7ca239b6',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'c12517413f21d11382140608fc05ba0a65c0df1da3505886f23021700323af20',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'd9b3a101b435583299cb3bde56ebe1d68213438a7dff6461de7ad38b35bb8851',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '0a7d92efc8adc9f3e9717147009613db026855541723ab2a7253a3f2df07b8de',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '6ce18d1fdddb959838228f3e9ced0e1c7091739e2474721d401574d357fada44',
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
      '1b035dd0acef6bb4045ffe99d709d806358f30bdef01cc9a8f85b892c8880d73',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '81bd1c391a57d7635c488ca1edf97792aa19b6c31c359b9d755589dd4f90cd79',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'd73e5dc0e8ce5b6eb3ff72fdd3bee1acd5b10eeff60258a841a1ef152722615a',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '034e579f5d098805b9af2636e150d1241d91a3721e0fbe00cd5c801bce85df95',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
