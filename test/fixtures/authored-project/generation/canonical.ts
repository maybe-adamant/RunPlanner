import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  createGoldenFGHProject,
} from '../underworld';
import {
  createRepresentativeNProject,
  createRepresentativeNOProject,
  createRepresentativeNOPProject,
  createRepresentativeNOPQProject,
} from '../surface';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { GoldenGProjectOptions } from '../underworld';
import type { CompleteNFixtureOptions } from '../surface';

export interface GeneratedCheckpoint {
  readonly id: string;
  readonly project: ProjectDocument;
  readonly provenance: string;
}

export const generatedCheckpoints: readonly GeneratedCheckpoint[] = Object.freeze([
  {
    id: 'underworld-fg',
    project: createCompleteFGProject(),
    provenance: 'createCompleteFGProject()',
  },
  {
    id: 'underworld-fgh',
    project: createGoldenFGHProject(),
    provenance: 'createGoldenFGHProject()',
  },
  {
    id: 'underworld-fghi',
    project: createGoldenFGHIProject(),
    provenance: 'createGoldenFGHIProject()',
  },
  {
    id: 'surface-n',
    project: createRepresentativeNProject(),
    provenance: 'createRepresentativeNProject()',
  },
  {
    id: 'surface-no',
    project: createRepresentativeNOProject(),
    provenance: 'createRepresentativeNOProject()',
  },
  {
    id: 'surface-nop',
    project: createRepresentativeNOPProject(),
    provenance: 'createRepresentativeNOPProject()',
  },
  {
    id: 'surface-nopq',
    project: createRepresentativeNOPQProject(),
    provenance: 'createRepresentativeNOPQProject()',
  },
]);

export const generatedVariants = Object.freeze([
  {
    id: 'underworld-fg-alt-miniboss',
    project: createCompleteFGProject({
      pickedMiniboss: 'G_MiniBoss02',
    } satisfies GoldenGProjectOptions),
    provenance: "createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' })",
  },
  {
    id: 'underworld-fg-alt-preboss',
    project: createCompleteFGProject({
      prebossSource: 'G_Combat14',
    } satisfies GoldenGProjectOptions),
    provenance: "createCompleteFGProject({ prebossSource: 'G_Combat14' })",
  },
  {
    id: 'underworld-fg-alt-combined',
    project: createCompleteFGProject({
      pickedMiniboss: 'G_MiniBoss02',
      prebossSource: 'G_Combat14',
    } satisfies GoldenGProjectOptions),
    provenance:
      "createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02', prebossSource: 'G_Combat14' })",
  },
  {
    id: 'surface-n-partial-hub',
    project: createRepresentativeNProject({
      includePreboss: false,
      visitSlotKeys: ['combat05', 'miniBoss01', 'combat02'],
    } satisfies CompleteNFixtureOptions),
    provenance:
      "createRepresentativeNProject({ includePreboss: false, visitSlotKeys: ['combat05', 'miniBoss01', 'combat02'] })",
  },
  {
    id: 'surface-n-alt-open-set',
    project: createRepresentativeNProject({
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
    } satisfies CompleteNFixtureOptions),
    provenance:
      "createRepresentativeNProject({ openSlotKeys: ['combat11', 'combat10', 'combat09', 'combat05', 'story', 'combat02', 'combat01', 'miniBoss01', 'combat23'], visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'story'] })",
  },
]);
