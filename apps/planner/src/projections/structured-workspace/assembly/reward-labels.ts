/** Keep declaration-facing reward-store labels consistent across workspace families. */
export function workspaceRewardStoreLabel(storeKey: string): string {
  switch (storeKey) {
    case 'RunProgress':
      return 'Run Progress';
    case 'MetaProgress':
      return 'Meta Progress';
    default:
      return storeKey;
  }
}
