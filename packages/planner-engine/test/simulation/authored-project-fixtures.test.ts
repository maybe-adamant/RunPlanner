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
      '7746f69604b0810026cbbd4f084312ed3c773356ffbcb17e3a8fb39c81a7a033',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'ac0d4ec70498b96d5027c9892a019cccc533868dc59e58c68e8f3430670a75d7',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'd52984b8af58205a1a3f9a4f815fe25bed229da4e557d440d8dce555d4e4daeb',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '369aec042f3ea37f976b06082e4d51c3799070f0ea9991d77ac246b02747d675',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'a4446f3046b9a3664f0c569b08453644adfeafce2b880116f0507707ee176805',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      '676048198cc9389e867d7993dae8b95d0630fab788fd8879400c2b42bc49b937',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '55e1bcc0bae3eea32fd4e2082d9640815fdfad46d578d9e6537c0598b294ed10',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      '3678f46cacacc9cd477dd490d712d08251107b04ebfbbb8ae650b3e3ac32dff4',
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
      'b68f418ccc2e2cc15b5fc31a125b536d545efb99bf181e2a49eee38b16dc360c',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '2e2dec0f4fb2286c334889758c2779baa78baaa8498d6f0ddc9c7397bcc4e390',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'fe3ff6409a24586570048e41b7384dbcdcfb03c23efa4038c86cbdea4570f5f2',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '73f7bcc8df17816787882f97fcfed2ea83cb4c9f17122fe20a27ecec947aabdb',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
