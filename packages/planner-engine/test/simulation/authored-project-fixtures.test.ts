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
      'edab48644b29a7b9f07c2d7b1a7050b3b1017a955c6cc63f5ecb8b60a4dc9e01',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'cc38ffad9aa4760c595f78e0417a41fd663d971aeb5166462786a11a0c881bf0',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'e51bcaa0e28ec1b733e6bccfb90343cbd9bdb75d21e5bf7d09a8ff799a63ccba',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '1fe822eee19d9f947b30cc06d86932ee7d86fdb53c30d692acdf29d791b02002',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      '06752f0675e872bc33d663a9ca90da20d6aef2e19b50b274304767f652bd7a10',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '2dc3248bd5806b8db7bfb44811b7a6f2b382f2c34e7c445400738681452cb236',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '862417ff3d91003187f519bbcd3e94b4b5359ad74389cb2bf6c4301373cc620a',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'f6621a6353fe4bf0b9fb1a534460bdd129dd26ddc8ea5b0de4c7ac57673a2485',
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
      '94c80d45075f61dfb5cc8f39ff1d61433318cf0a23094acfdaedaa44edbb5600',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      'ed64814d00a298b86796242f20f3addac6dff4237fa3ed495205c4c23ca65eaf',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '0e3f5441fb02c1679bdf071c215e6aae01f816135296002cbf30f34f06fc3b04',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '6548f5301225a149eca271cb203f9fe0fb19b37aa7d5a39e0b0d9e5b2a1a9f91',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
