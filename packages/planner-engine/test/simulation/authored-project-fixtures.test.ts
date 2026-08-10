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
      '7659396219dddac38cc078d362c7f0ebcad655fffedda92571738bee688d09af',
    ],
    [
      'Underworld F/G alternate miniboss',
      () => createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' }),
      '4bddc8e0d895817d7aa60761ca70382119ad1343a854768ba7fb2106dd20c6bb',
    ],
    [
      'Underworld F/G alternate Preboss source',
      () => createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      'cf23e5757394c63782d9d01e887263472d1e0c80321cd47246eaf7b0b40035c1',
    ],
    [
      'Underworld F/G combined alternates',
      () =>
        createCompleteFGProject({
          pickedMiniboss: 'G_MiniBoss02',
          prebossSource: 'G_Combat14',
        }),
      'e859562a5be39b06191bbaed0c278b65db8c89f1ab3c8a3ec58684bbf6534c27',
    ],
    [
      'Underworld F/G/H',
      () => createGoldenFGHProject(),
      'ca0ae6b17fb2849d1e8aa7cd9fb4971461727fdbc0ef3c43875e7817a17b8408',
    ],
    [
      'Underworld F/G/H/I',
      () => createGoldenFGHIProject(),
      'bd351d12193dfd23466671744544a53cf7e970d0c39f623eb9cc52535888c858',
    ],
    [
      'Surface N',
      () => createRepresentativeNProject(),
      '6091e08233ceeb6c0ed5fd6eec6f13eec460e1a7922d2c9cd47ba86f1731971e',
    ],
    [
      'Surface N partial Hub handoff',
      () =>
        createRepresentativeNProject({
          includePreboss: false,
          visitSlotKeys: nVisitSlotKeys.slice(0, 3),
        }),
      'd0cdc53a1b3627f73532a0f23b26fe00e4f6b60ae9c1621037063b94be3176a6',
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
      'd102de951a547bdd6441e4c342e712f888df60208f937f68bf7441507dd2c10e',
    ],
    [
      'Surface N/O',
      () => createRepresentativeNOProject(),
      '599d485eb3ee4f7360b2e6b12f2d15cb51597da50101c87fc61aadaf845c1449',
    ],
    [
      'Surface N/O/P',
      () => createRepresentativeNOPProject(),
      'a467eb6aef6df8e2b669878a898c8a2ca6fc2f7d8b8ece7270d92c517c7a277d',
    ],
    [
      'Surface N/O/P/Q',
      () => createRepresentativeNOPQProject(),
      '0373ea197357b6a9673bede53d26e677868ee9907b505be77e3e634e4d3937ce',
    ],
  ])('preserves the characterized %s document', (_name, createProject, digest) => {
    expect(authoredDocumentDigest(createProject())).toBe(digest);
  });

  it('keeps the fixed N occurrence alias equal to the canonical occurrence identities', () => {
    expect(nFixedOccurrenceIds).toEqual(nOccurrenceIds);
  });
});
