import type { Catalog } from '../../../catalog-schema';
import type { InfernalContractPedestalState } from '../../model';
import { failProjectDocument } from '../../validation';
import {
  INFERNAL_CONTRACT_ENTRY_KEY,
  infernalContractPedestalProfile,
} from '../../infernal-contract-pedestal';
import { decodeShopOffer } from './shop-codec';

/** The pedestal's one item, drawn from the room's declared ZagPedestalOptions pool. */
export function decodeInfernalContractPedestal(
  value: unknown,
  catalog: Catalog,
  routeKey: string,
  roomGameName: string,
  path: string,
): InfernalContractPedestalState {
  const profile = infernalContractPedestalProfile(catalog, roomGameName);
  const slot = profile?.slots.byKey[INFERNAL_CONTRACT_ENTRY_KEY];
  const group = slot === undefined ? undefined : profile?.groups.byKey[slot.groupKey];
  if (profile === undefined || group === undefined)
    failProjectDocument(path, `${roomGameName} declares no Contract pedestal pool`);
  return decodeShopOffer(value, catalog, routeKey, profile, group.options.values, path);
}
