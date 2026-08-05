import { anomalyEncounterDefinitions } from './anomaly';
import { cEncounterDefinitions } from './c';
import { fEncounterDefinitions, fEncounterSets } from './f';
import { gEncounterDefinitions, gEncounterSets } from './g';
import { hEncounterDefinitions, hEncounterSets } from './h';
import { iEncounterDefinitions, iEncounterSets } from './i';
import { nEncounterDefinitions, nEncounterSets } from './n';
import { oEncounterDefinitions, oEncounterSets } from './o';
import { pEncounterDefinitions, pEncounterSets } from './p';
import { qEncounterDefinitions, qEncounterSets } from './q';
import {
  sharedEncounterDefinitions,
  sharedEncounterEnvelopes,
  sharedEncounterSets,
} from './shared';

export const encounterEnvelopes = [...sharedEncounterEnvelopes] as const;

export const encounterDefinitions = [
  ...sharedEncounterDefinitions,
  ...anomalyEncounterDefinitions,
  ...cEncounterDefinitions,
  ...fEncounterDefinitions,
  ...gEncounterDefinitions,
  ...hEncounterDefinitions,
  ...iEncounterDefinitions,
  ...nEncounterDefinitions,
  ...oEncounterDefinitions,
  ...pEncounterDefinitions,
  ...qEncounterDefinitions,
] as const;

export const encounterSets = [
  ...sharedEncounterSets,
  ...fEncounterSets,
  ...gEncounterSets,
  ...hEncounterSets,
  ...iEncounterSets,
  ...nEncounterSets,
  ...oEncounterSets,
  ...pEncounterSets,
  ...qEncounterSets,
] as const;
