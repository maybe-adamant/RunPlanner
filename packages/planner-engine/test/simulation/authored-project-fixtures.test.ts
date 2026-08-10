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
      '413c209d6c9f48f1ee7a1db84049570fa4efcaaa8b466d1f5127330cd3fa53e6',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'd3c14d653ce91c7ef56b1fabf6ec24da512f1eac311aaea319c95675287065c8',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '4cac2f259e1cd2066bff96a14dc4418429e8b9e2840c7d26808970e1e94e7f26',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'f2f20ebdd1386ea0ac05051c47e74bc82f1492d13bbb7c1bcb2f15c39dcc4256',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'e049b4681d07aef6613c0f9d8c853abdfd76aa7101909bb2a501173e43ed29d0',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '2fbce6051281a8937c7bd12e077bf33e1a1492f2f69a9dd5d9fd756b3a47ac38',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '2d434638901d05ab8d2779020a70ae3773ab889f6ba628c146d7a1b638f9cbb4',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '1654152fb0b01bd4d5fca8c223952c67099223f4d0db6ab3f9f682011149644f',
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
      '6013f94afb30f5e4e5484a451a08086e61f849b31fea2abeb9e5f5efed38a248',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '6cc57d54dc5ea5ff13800a5262398bf6ae63018e259374988d867c1451f764ad',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '62b817c0ae790e26845ba1c3437143ae1e92dbe1a008918c80957a2524762869',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '3367b03c79d79410e733699bc1347fdfcf4b9995775b6404b15c18160a557e2a',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
