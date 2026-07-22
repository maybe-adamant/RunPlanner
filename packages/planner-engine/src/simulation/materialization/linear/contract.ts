export class LinearMaterializationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LinearMaterializationContractError';
  }
}

export function fail(detail: string): never {
  throw new LinearMaterializationContractError(detail);
}
