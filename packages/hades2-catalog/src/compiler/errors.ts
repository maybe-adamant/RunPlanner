export class CatalogContractError extends Error {
  public readonly path: string;

  public constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'CatalogContractError';
    this.path = path;
  }
}

export function fail(path: string, message: string): never {
  throw new CatalogContractError(path, message);
}
