import { createCatalog } from './catalog';
import { declarations } from './declarations';

export const catalog = createCatalog(declarations);

export { CatalogContractError, createCatalog } from './catalog';
export { type RawCatalogInput as CatalogInput } from './declarations';
