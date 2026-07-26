/** Signals a projection shape that the shared non-Hub workspace cannot render. */
export class BiomeWorkspaceContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'BiomeWorkspaceContractError';
  }
}
