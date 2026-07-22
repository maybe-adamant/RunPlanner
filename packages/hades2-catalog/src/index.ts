import { createCatalog } from './compiler/createCatalog';
import { declarations } from './declarations';

export const catalog = createCatalog(declarations);

export { CatalogContractError, createCatalog } from './compiler/createCatalog';
export { type RawCatalogInput as CatalogInput } from './declarations';
