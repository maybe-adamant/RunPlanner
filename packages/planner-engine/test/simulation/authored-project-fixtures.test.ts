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
      'd5d4bd46cfcb33a5569be259e463a685b45eeeee44ea2de45314250d08477dfc',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'e647fb6bd1aa7ff9a76d03ce49193d885046ea7d89c9bbd58df064f07f03d880',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'da3ee56bcc7255ecacacaf7f2663c141345c7b819f5fdde05d776c0051f53564',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '51cb3c5d4bb9cf6d0d61f0277973e6860cde63f3c3f7a02b11140170565c8158',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '3244d3b305a45a57b6e1accd6e548fe82220b6b6f2123a5d2682a627e49e811c',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '04a6b22b8d0fe0f310e6704f37d7f566b21e60a1c8432f8160a24fdafb89f832',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '147c80c48e98d41d74f6f6f2dde412d911e935f346376cc314e9eb199219231f',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'aec709a9b3e139c563d4554c9592d9a4fd48b08f1f277b5b413aec4e786e6651',
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
      '94c714e0065ed4a7d0e3d9257a38edfb558a3210f896da4da006678db2406cb8',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'ad40bc69ce8c6c0f3051de70cd94913a7f008651da915e5c9152546d57790c3b',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '4c68f45ae272dd9c2a26acd773e754ac1f21a963f8d7374e2788a698f756f941',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '4ad030baafd477546bbc6f6222a805af711989427960a9c93b8883fa7d934f2a',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
