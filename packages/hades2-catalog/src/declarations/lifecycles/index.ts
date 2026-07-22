import { clockworkRoomLifecycleProfiles } from './clockwork';
import { ephyraRoomLifecycleProfiles } from './ephyra';
import { fieldsRoomLifecycleProfiles } from './fields';
import { shipRoomLifecycleProfiles } from './ship';
import { shopsRoomLifecycleProfiles } from './shops';
import { specializedRewardRoomLifecycleProfiles, standardRoomLifecycleProfiles } from './standard';
import { terminalRoomLifecycleProfiles } from './terminal';

export const roomLifecycleProfiles = [
  ...standardRoomLifecycleProfiles,
  ...ephyraRoomLifecycleProfiles,
  ...clockworkRoomLifecycleProfiles,
  ...specializedRewardRoomLifecycleProfiles,
  ...fieldsRoomLifecycleProfiles,
  ...shipRoomLifecycleProfiles,
  ...shopsRoomLifecycleProfiles,
  ...terminalRoomLifecycleProfiles,
] as const;
