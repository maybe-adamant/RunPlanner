/** Signals a workspace projection shape that no rendered workbench has claimed. */
export class BiomeWorkspaceContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'BiomeWorkspaceContractError';
  }
}
