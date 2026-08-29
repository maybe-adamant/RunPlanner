import type { RoomActionReference } from './model';

/** Stable collision-safe identity for one closed room-action reference. */
export function roomActionKey(reference: RoomActionReference): string {
  switch (reference.kind) {
    case 'completeFieldsCage':
    case 'interactEncounter':
    case 'interactGorgon':
      return JSON.stringify([reference.kind, reference.phaseKey]);
    case 'interactIncomingReward':
      return JSON.stringify([reference.kind, reference.producerPoint, reference.acquisitionRole]);
    case 'interactLocalReward':
      return JSON.stringify([reference.kind, reference.groupKey, reference.slotKey]);
    case 'chooseRewardWheel':
    case 'interactWheelReward':
      return JSON.stringify([reference.kind, reference.wheelKey]);
    case 'interactShopOffer':
      return JSON.stringify([reference.kind, reference.offerKey]);
    case 'purchaseStygianWellOffer':
      return JSON.stringify([reference.kind, reference.generationKey]);
    case 'sellPurgingPoolTrait':
      return JSON.stringify([reference.kind, reference.slotKey]);
    case 'interactAcquisitionEntry':
      return JSON.stringify([reference.kind, reference.siteKey, reference.entryKey]);
    case 'useFountain':
    case 'interactKeepsakeRack':
      return JSON.stringify([reference.kind]);
  }
}
