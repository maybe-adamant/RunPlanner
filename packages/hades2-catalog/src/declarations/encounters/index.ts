import {
  fCompletionEncounterProfiles,
  fMinibossEncounterProfiles,
  fOpeningEncounterProfiles,
  fStoryEncounterProfiles,
} from './f';
import {
  gCompletionEncounterProfiles,
  gMinibossEncounterProfiles,
  gStoryEncounterProfiles,
} from './g';
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
  ...fStoryEncounterProfiles,
  ...gStoryEncounterProfiles,
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
