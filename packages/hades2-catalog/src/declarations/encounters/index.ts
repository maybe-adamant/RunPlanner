import {
  fCompletionEncounterProfiles,
  fMinibossEncounterProfiles,
  fOpeningEncounterProfiles,
} from './f';
import { gCompletionEncounterProfiles, gMinibossEncounterProfiles } from './g';
import { hEncounterProfiles } from './h';
import { iEncounterProfiles } from './i';
import { nEncounterProfiles } from './n';
import { oEncounterProfiles } from './o';
import { pEncounterProfiles } from './p';
import { qEncounterProfiles } from './q';
import { sharedEncounterProfiles } from './shared';

export const encounterProfiles = [
  ...fOpeningEncounterProfiles,
  ...sharedEncounterProfiles,
  ...fMinibossEncounterProfiles,
  ...gMinibossEncounterProfiles,
  ...fCompletionEncounterProfiles,
  ...gCompletionEncounterProfiles,
  ...pEncounterProfiles,
  ...qEncounterProfiles,
  ...hEncounterProfiles,
  ...oEncounterProfiles,
  ...iEncounterProfiles,
  ...nEncounterProfiles,
] as const;
