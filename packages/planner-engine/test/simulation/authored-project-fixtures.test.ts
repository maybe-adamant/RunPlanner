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
      '73b040dd4de24b9356bebf3033effc9931b346cc235840c1607a9c825117597f',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '0563d6f7f8441398f3e03e072544b07eb057ebbeb64f2e15241ffe85684380b4',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '24a5b6ed51020360b4158b433913d39ac7d13a3f2a8406cd6742feefb4380c70',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '0ccd9e683b5abda9df4271b7a20d67e1c01df510ec643db54748329318aeecb8',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '612798c79c8bc034d3684aa143c9b0e4f8d42aeac8f20acfe40d5aa69f30bcb2',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'b8591d994782790eb7eb32adbaa7ff4a191e833c7235ea1df2f89c97a95f1b56',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'e69fb3fca448b34380cb3057104ba1a76df8455570a00baeafcdecdfa397b75e',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'ce911c6eea47c4ffb11e3e37a5b1da6b1dfb627630f222ebc96c21007fb7bcba',
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
      'ff12b11bfff2cc12560d7c49df5c0eb24ccf8f3303276f67056960e14d53720e',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'ddd2d934dc5104b91c4e9acf6820e9ff8c1283684a72232525ddee817219dfaa',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '6dad9148ac9f22415a535e8cb70a13062f7110a31250a8481cdfc0026421f20c',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '6e66bc38ae2685c7c5f081aec057b56b379864410c2407dc7176e96a004b97ad',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
