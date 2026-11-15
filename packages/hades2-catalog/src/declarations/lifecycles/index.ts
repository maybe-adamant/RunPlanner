import { ephyraRoomLifecycleProfiles } from './ephyra';
import { fieldsRoomLifecycleProfiles } from './fields';
import { prebossCompletionRoomLifecycleProfiles } from './preboss-completion';
import { shipRoomLifecycleProfiles } from './ship';
import { shopsRoomLifecycleProfiles } from './shops';
import { specializedRewardRoomLifecycleProfiles, standardRoomLifecycleProfiles } from './standard';

export const roomLifecycleProfiles = [
  ...standardRoomLifecycleProfiles,
  ...ephyraRoomLifecycleProfiles,
  ...specializedRewardRoomLifecycleProfiles,
  ...fieldsRoomLifecycleProfiles,
  ...shipRoomLifecycleProfiles,
  ...shopsRoomLifecycleProfiles,
  ...prebossCompletionRoomLifecycleProfiles,
] as const;
