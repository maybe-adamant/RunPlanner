import { createCatalog } from './catalog';

export const catalog = createCatalog({
  version: '0.0.0-foundation',
  routes: [],
});

export { CatalogContractError, createCatalog, type CatalogInput } from './catalog';
