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
      '6eec79678aaf643ec1693a128716b2644370ed94a1e2ec2908a1e44de0ed9111',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '869fa35e182ca838c6180a8c21574673bd7643dff7e91edf30487a2fa91e4088',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'e895eeff1b0e62197f856592a1a175c1bd6adc6b0afcc7c037009619c68aebc4',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'b7da2302c2b9ae7382b778bd5be9d99e77f8392dbc2600976b436949a9035198',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'b8c91e706672188a83ec6b13e6c1955c0c88b114dadaf7d73ce96b5a88ce979d',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'bab6c2e71fe26f00c538109409d7c65a22c7561360c08e99a6ea60d747b21251',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'a1e07eaa98b513f9c70fe2e790e7b46e9de5e4e7490e5821cfaa02480d413a35',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '88a32b811965f62500c32d556df8e232e6a0622edfafa67089e199bc20a18c65',
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
      'c509d733b668f8d73310ca1f416631dc26494b218c87e2f29031c8e995cf02df',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '03a0e00b5a8aad8819ea9cfb228a976bc1b29f4be214dd4de8d98b89c609d3e4',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '57f864618b8b2d83409a086754404e318dae9a70d205bbd23346ff766535ef35',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '319e7453a05449d10f04c6720a3b83420d7a27cbc722370a8e32a40ba1a96e96',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
