import {
  parseArtificerReplacementEntryKey,
  parseEchoLastRewardPickupEntryKey,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { summarizeRewardOffer } from '@planner/projections/rewardPicker';
import { workspaceAcquisitionRoleLabel } from './occurrence-reward-assembly';
import type {
  WorkspaceEncounterPhase,
  WorkspaceRewardControl,
  WorkspaceRoomLocal,
} from '../contract';

function wellPurchaseLabel(
  catalog: Catalog,
  occurrence: Pick<import('@run-planner/engine/authored-project').RoomOccurrence, 'stygianWell'>,
  generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey,
): string {
  const slotKey = generationKey.startsWith('initial:')
    ? (generationKey.slice(
        'initial:'.length,
      ) as import('@run-planner/engine/authored-project').StygianWellSlotKey)
    : undefined;
  const itemKey =
    slotKey === undefined
      ? occurrence.stygianWell?.travelDealRefillKey
      : occurrence.stygianWell?.offerKeyBySlot[slotKey];
  const itemLabel =
    itemKey === null || itemKey === undefined
      ? undefined
      : catalog.rewards.shops.byKey.RoomShop?.groups.values
          .flatMap((group) => group.options.values)
          .find((option) => option.key === itemKey)?.label;
  if (itemLabel !== undefined) return itemLabel;
  const slotLabel =
    slotKey === undefined
      ? 'Travel Deal'
      : (catalog.rewards.shops.byKey.RoomShop?.slots.byKey[slotKey]?.label ?? slotKey);
  return `Well ${slotLabel}`;
}

function shrinePurchaseLabel(
  catalog: Catalog,
  occurrence: Pick<import('@run-planner/engine/authored-project').RoomOccurrence, 'hermesShrine'>,
  generationKey: import('@run-planner/engine/authored-project').HermesShrineGenerationKey,
): string {
  const slotKey = generationKey.startsWith('initial:')
    ? (generationKey.slice(
        'initial:'.length,
      ) as import('@run-planner/engine/authored-project').HermesShrineSlotKey)
    : undefined;
  const offer =
    slotKey === undefined
      ? occurrence.hermesShrine?.travelDealRefill?.offer
      : occurrence.hermesShrine?.offerBySlot[slotKey];
  const rewardType = offer?.offer.rewardType;
  const rewardLabel =
    rewardType === undefined ? undefined : catalog.rewards.rewardTypes.byKey[rewardType]?.label;
  if (rewardLabel !== undefined) return rewardLabel;
  const slotLabel =
    slotKey === undefined
      ? 'Travel Deal'
      : (catalog.rewards.shops.byKey.SurfaceShop?.slots.byKey[slotKey]?.label ?? slotKey);
  return `Shrine ${slotLabel}`;
}

/** Presentation labels for engine-authored action references. */
export function occurrenceActionLabel(
  catalog: Catalog,
  reference: import('@run-planner/engine/authored-project').RoomActionReference,
  roomLocal: WorkspaceRoomLocal,
  encounterPhases: readonly WorkspaceEncounterPhase[],
  rewardControl: WorkspaceRewardControl | undefined,
  occurrence: Pick<
    import('@run-planner/engine/authored-project').RoomOccurrence,
    'hermesShrine' | 'stygianWell'
  >,
  purgingPoolTraitKeyBySlot?: Readonly<Record<'left' | 'middle' | 'right', string | null>>,
): string {
  const pickupLabel = (subject: string): string => {
    const label = `Interact with ${subject} pickup`;
    const summary =
      rewardControl?.offer === null || rewardControl?.offer === undefined
        ? undefined
        : summarizeRewardOffer(catalog, rewardControl.offer);
    const described =
      summary === undefined || summary === subject
        ? label
        : summary.startsWith(`${subject} · `)
          ? `${label} · ${summary.slice(subject.length + 3)}`
          : `${label} · ${summary}`;
    return rewardControl?.realizedAcquisition === undefined
      ? described
      : `${described} -> ${rewardControl.realizedAcquisition.label} (Vow of Forfeit)`;
  };
  const phase =
    'phaseKey' in reference
      ? encounterPhases.find((candidate) => candidate.address.phaseKey === reference.phaseKey)
      : undefined;
  switch (reference.kind) {
    case 'completeFieldsCage':
      return `Complete ${phase?.label ?? reference.phaseKey}`;
    case 'interactIncomingReward':
      return pickupLabel(workspaceAcquisitionRoleLabel(reference.acquisitionRole));
    case 'interactLocalReward': {
      const local =
        roomLocal.kind !== 'fields'
          ? undefined
          : [...roomLocal.cages, ...roomLocal.optionalRewards].find(
              (candidate) =>
                candidate.control.owner.address.kind === 'localReward' &&
                candidate.control.owner.address.groupKey === reference.groupKey &&
                candidate.control.owner.address.slotKey === reference.slotKey,
            );
      return pickupLabel(local?.label ?? reference.slotKey);
    }
    case 'chooseRewardWheel': {
      const wheel =
        roomLocal.kind === 'ship'
          ? roomLocal.wheels.find((candidate) => candidate.key === reference.wheelKey)
          : undefined;
      return `Choose ${wheel?.label ?? reference.wheelKey}`;
    }
    case 'interactWheelReward': {
      const wheel =
        roomLocal.kind === 'ship'
          ? roomLocal.wheels.find((candidate) => candidate.key === reference.wheelKey)
          : undefined;
      return pickupLabel(wheel?.label ?? `${reference.wheelKey} reward`);
    }
    case 'interactShopOffer': {
      const offer =
        roomLocal.kind === 'shop'
          ? roomLocal.offers.find((candidate) => candidate.key === reference.offerKey)
          : undefined;
      const rewardLabel =
        rewardControl?.offer === null || rewardControl?.offer === undefined
          ? undefined
          : summarizeRewardOffer(catalog, rewardControl.offer);
      return `Buy ${rewardLabel ?? offer?.label ?? reference.offerKey}`;
    }
    case 'purchaseHermesShrineOffer':
      return `Buy ${shrinePurchaseLabel(catalog, occurrence, reference.generationKey)}`;
    case 'purchaseStygianWellOffer':
      return `Buy ${wellPurchaseLabel(catalog, occurrence, reference.generationKey)}`;
    case 'sellPurgingPoolTrait': {
      const traitKey = purgingPoolTraitKeyBySlot?.[reference.slotKey];
      return `Sell ${traitKey === null || traitKey === undefined ? `${reference.slotKey} Pool trait` : (catalog.traits.byKey[traitKey]?.label ?? traitKey)}`;
    }
    case 'interactEncounter':
      return `Interact with ${phase?.selectedEncounter.label ?? `${reference.phaseKey} encounter`}`;
    case 'interactGorgon':
      return 'Interact with Athena';
    case 'interactAcquisitionEntry': {
      const supplemental =
        roomLocal.kind === 'shop'
          ? roomLocal.supplementalOffers.find((candidate) => candidate.key === reference.entryKey)
          : undefined;
      const entryLabel =
        parseArtificerReplacementEntryKey(reference.entryKey) !== undefined
          ? 'Artificer'
          : parseEchoLastRewardPickupEntryKey(reference.entryKey) !== undefined
            ? 'Reward Reward Reward replay'
            : rewardControl?.kind === 'explicitReward' && rewardControl.rewardTypes.length === 1
              ? (catalog.rewards.rewardTypes.byKey[rewardControl.rewardTypes[0]!]?.label ??
                reference.entryKey)
              : reference.entryKey;
      return pickupLabel(supplemental?.label ?? entryLabel);
    }
    case 'useFountain':
      return 'Use fountain';
    case 'interactKeepsakeRack':
      return 'Choose keepsake';
  }
}
