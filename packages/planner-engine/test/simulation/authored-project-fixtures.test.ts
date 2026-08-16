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
      'aa424408f8632813e4d47b96d327b54fc1f45f67be48b5cac930cf5882e2b7aa',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      'a3724380874965e5512f43ef50e371908ccfadb0ec57909906146c5dcb69f7a3',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      '7e28ad479dce59540845041b36f705108a3816813539f59aa2426bc8a7c1b11c',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      '95987b7fc225761a8f9b7fb6aaf7d0aecc16694fe403990e4307ef09fcec2324',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'd5116b69415cfb5e268c670fab4b83cd674837a8d6123de23e63c511b711ab35',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'bce2dc7984ef20aaedee75c8a8e8124027a4cd3da44c89e68ac1da9d52ffc8ac',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      'd81bab3ff7463f69a8458087fe918c357f5c2885d7f1a6e5cd53821c0d9dfbe1',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'e756c1c6746604f5e01cef92d93a7022b5cf511fd82a7ae8849fdac416abd379',
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
      '604f6e1f7f86ab88efe2f33b7844eefc1a3ce13c703a46210879377ab40e6cc2',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '25ecc7e3515d854047a8b4b082e702ac4fb40dfd435cca2a1475b637407e6cae',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      '846a48c94fdb8c5288fbb3ec9ec4a186165277017f2b14f8bdb8c34fe2b43176',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      'e4877194e581bfc7ff91f45e359510390e5d318a2065993f491b7dc9b7b2e069',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
