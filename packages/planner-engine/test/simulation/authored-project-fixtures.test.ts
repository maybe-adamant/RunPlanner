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
      'ac473c88f2c2b4397e479b7c73d997c852fba7d6f5a875f63c0209e0e5caa38c',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'd29ef56e68a0bd358f567943fb571ae26749251a87139e3c04c234b6606d22ea',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '72d23cdfa5f033d51a71b8072dfb7f57fcfb185a762de3807a351e44835be058',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '6b84b28d68f0c47dee59eb6b81d355356575a4eb2dc3b9ffe1b52153f974d4c2',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '73c98ef009f3ebf42d791095f5867dafb64fb411ddba7c48b45d5d77afca3011',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '9c84ffd394117a70ced3f41e3f957109924c4eb097788db853ae40f7ff2234a3',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'cfbcd0dfc7cc977c83d0e28c778866ccf28dff40e24672244d11d9bf7ea06ba6',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '9a7b234183ed1b33141c7356a59761227891ef7f22e4123429669a0ec87a4952',
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
      'ba872b1c612c8556f18901fe990087a5cc5fef281162b5cac454941b566fdecc',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '74c1b7cf76988d30cf600648644406d9f791dd4e7f4ca2af3072906c38fa5b36',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '94db917cf8033f65de999bd72ce492a6d3c91848abdf55250735e2c669891d74',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'd50b9f936b7e1284bbbb27b9c7ddfd5eedd08fb3a188c5d9fe7452a7bb5e7d35',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
