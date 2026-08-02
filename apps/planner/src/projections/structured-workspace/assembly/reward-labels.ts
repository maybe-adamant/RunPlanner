/** Keep declaration-facing reward-store labels consistent across workspace families. */
export function workspaceRewardStoreLabel(storeKey: string): string {
  switch (storeKey) {
    case 'RunProgress':
      return 'Major Reward';
    case 'MetaProgress':
      return 'Minor Reward';
    default:
      return storeKey;
  }
}
