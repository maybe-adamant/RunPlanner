// Every supported major schema transition in order; a new schema appends its step here.
// The loader and the offline schema:migrate runner both read this list.
import * as step86To87 from './project-86-to-87.js';
import * as step87To88 from './project-87-to-88.js';
import * as step88To89 from './project-88-to-89.js';
import * as step89To90 from './project-89-to-90.js';
import * as step90To91 from './project-90-to-91.js';
import * as step91To92 from './project-91-to-92.js';
import * as step92To93 from './project-92-to-93.js';
import * as step93To94 from './project-93-to-94.js';
import * as step94To95 from './project-94-to-95.js';
import * as step95To96 from './project-95-to-96.js';
import * as step96To97 from './project-96-to-97.js';
import * as step97To98 from './project-97-to-98.js';
import * as step98To99 from './project-98-to-99.js';
import * as step99To100 from './project-99-to-100.js';

export const PROJECT_TRANSITION_STEPS = Object.freeze([
  step86To87,
  step87To88,
  step88To89,
  step89To90,
  step90To91,
  step91To92,
  step92To93,
  step93To94,
  step94To95,
  step95To96,
  step96To97,
  step97To98,
  step98To99,
  step99To100,
]);
