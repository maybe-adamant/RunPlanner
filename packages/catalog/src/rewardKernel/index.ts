import { rewardKernelDeclarations } from './declarations';
import { createRewardKernelCatalog } from './normalize';

export const rewardKernelCatalog = createRewardKernelCatalog(rewardKernelDeclarations);

export { ordinarySources, rewardKernelDeclarations } from './declarations';
export { createRewardKernelCatalog } from './normalize';
export type {
  RawAcquisitionRoleDeclaration,
  RawConcreteAcquisitionDeclaration,
  RawPayloadDomainDeclaration,
  RawRewardKernelInput,
  RawRewardStoreDeclaration,
  RawRewardStoreEntryDeclaration,
  RawRewardTypeDeclaration,
  RawShopGroupDeclaration,
  RawShopOptionEntryDeclaration,
  RawShopProfileDeclaration,
} from './types';
