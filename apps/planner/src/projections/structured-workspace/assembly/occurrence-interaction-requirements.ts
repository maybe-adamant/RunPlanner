import type { Catalog } from '@run-planner/engine/catalog-schema';
import { requireWorkspaceRoom as requireRoom } from './catalog-room';
import { requireRewardWheelAttachment } from './occurrence-reward-assembly';
import { type WorkspaceEncounterPhase, type WorkspaceRoomSummary } from '../contract';
import { workspaceRewardStoreLabel } from './reward-labels';
import type { WorkspaceOccurrenceInteractionRequirement } from '../interactions/interaction-requirements';

function encounterPhaseInteractionRequirement(
  owner: WorkspaceRoomSummary['address'],
  phases: readonly WorkspaceEncounterPhase[],
): WorkspaceOccurrenceInteractionRequirement | undefined {
  const interactivePhases = phases.filter(
    (phase) =>
      phase.customizable ||
      phase.nemesisFeature !== undefined ||
      phase.nemesisEvent !== undefined ||
      phase.figLeaf !== undefined ||
      phase.gorgonCondition !== undefined,
  );
  if (interactivePhases.length === 0) return undefined;
  return Object.freeze({
    kind: 'encounterPhases' as const,
    owner,
    phases: Object.freeze(
      interactivePhases.map((phase) =>
        Object.freeze({
          candidateChoices: phase.candidateChoices,
          owner: phase.address,
          selectedEncounterKey: phase.selectedEncounter.key,
          selectionEnabled: phase.customizable,
          ...(phase.nemesisFeature === undefined ? {} : { nemesisFeature: phase.nemesisFeature }),
          ...(phase.nemesisEvent === undefined ? {} : { nemesisEvent: phase.nemesisEvent }),
          ...(phase.figLeaf === undefined
            ? {}
            : {
                figLeaf: Object.freeze({
                  selected: phase.figLeaf.selected,
                  supported: phase.figLeaf.supported,
                }),
              }),
          ...(phase.gorgonCondition === undefined
            ? {}
            : {
                gorgonCondition: Object.freeze({
                  selected: phase.gorgonCondition.selected,
                  supported: phase.gorgonCondition.supported,
                }),
              }),
        }),
      ),
    ),
  });
}

export function occurrenceInteractionRequirements(
  catalog: Catalog,
  room: WorkspaceRoomSummary,
): readonly WorkspaceOccurrenceInteractionRequirement[] {
  const requirements: WorkspaceOccurrenceInteractionRequirement[] = [];
  const topLevelEncounterRequirement = encounterPhaseInteractionRequirement(
    room.address,
    room.encounterPhases,
  );
  if (topLevelEncounterRequirement !== undefined) requirements.push(topLevelEncounterRequirement);

  if (room.zagreusSpawn?.materialized === true) {
    requirements.push(
      Object.freeze({ kind: 'zagreusSpawn' as const, owner: room.zagreusSpawn.owner }),
    );
  }
  if (room.naturalChaosSpawn !== undefined) {
    requirements.push(
      Object.freeze({ kind: 'naturalChaosSpawn' as const, owner: room.naturalChaosSpawn.owner }),
    );
  }
  if (room.resources !== undefined) {
    requirements.push(
      Object.freeze({
        kind: 'resourcePlacements' as const,
        owner: room.address,
        resources: room.resources,
      }),
    );
  }
  const activeShopOwners = new Set<string>();
  if (room.roomLocal.kind === 'shop' && room.roomLocal.materialized) {
    for (const offer of room.roomLocal.offers) {
      activeShopOwners.add(offer.participation.interactionKey);
      requirements.push(
        Object.freeze({
          kind: 'shopPurchaseParticipation' as const,
          owner: offer.participation.owner,
          purchased: offer.participation.purchased,
        }),
      );
    }
  }
  if (room.roomActions !== undefined) {
    requirements.push(
      Object.freeze({
        kind: 'roomActions' as const,
        owner: room.roomActions.owner,
        proposals: room.roomActions.proposals,
      }),
    );
    for (const row of room.roomActions.repairRows) {
      if (row.shopParticipation === undefined) continue;
      if (activeShopOwners.has(row.shopParticipation.interactionKey)) continue;
      requirements.push(
        Object.freeze({
          kind: 'shopPurchaseParticipation' as const,
          owner: row.shopParticipation.owner,
          purchased: true,
        }),
      );
    }
  }
  for (const feature of room.workbench.features) {
    if (feature.kind === 'stygianWell') {
      requirements.push(
        Object.freeze({
          kind: 'stygianWell' as const,
          owner: room.address,
          present: feature.present,
          ...(feature.presenceInteractionKey === undefined
            ? {}
            : { presenceInteractionKey: feature.presenceInteractionKey }),
          interacted: feature.interacted,
          ...(feature.interactionKey === undefined
            ? {}
            : { interactionKey: feature.interactionKey }),
          slots: Object.freeze(
            feature.slots.map((slot) =>
              Object.freeze({
                generationKey: slot.generationKey,
                slotKey: slot.key,
                itemKey: slot.itemKey,
                candidateItemKeys: slot.candidateItemKeys,
                offerInteractionKey: slot.offerInteractionKey,
                purchased: slot.purchased,
                purchaseInteractionKey: slot.purchaseInteractionKey,
                ...(slot.twist === undefined
                  ? {}
                  : {
                      twist: Object.freeze({
                        itemKey: slot.twist.itemKey,
                        candidateItemKeys: slot.twist.candidateItemKeys,
                        interactionKey: slot.twist.interactionKey,
                      }),
                    }),
              }),
            ),
          ),
        }),
      );
      continue;
    }
    if (feature.kind === 'hermesShrine') {
      requirements.push(
        Object.freeze({
          kind: 'hermesShrine' as const,
          owner: room.address,
          present: feature.present,
          ...(feature.presenceInteractionKey === undefined
            ? {}
            : { presenceInteractionKey: feature.presenceInteractionKey }),
          slots: Object.freeze([
            ...feature.slots.map((slot) =>
              Object.freeze({
                slotKey: slot.key,
                rewardType: slot.rewardType,
                candidateRewardTypes: slot.candidateRewardTypes,
                purchase: slot.purchase,
                offerInteractionKey: slot.offerInteractionKey,
                purchaseInteractionKey: slot.purchaseInteractionKey,
              }),
            ),
            ...(feature.travelDealRefill === undefined
              ? []
              : [
                  Object.freeze({
                    slotKey: 'travelDealRefill' as const,
                    rewardType: feature.travelDealRefill.rewardType,
                    candidateRewardTypes: feature.travelDealRefill.candidateRewardTypes,
                    purchase: feature.travelDealRefill.purchase,
                    offerInteractionKey: feature.travelDealRefill.offerInteractionKey,
                    purchaseInteractionKey: feature.travelDealRefill.purchaseInteractionKey,
                  }),
                ]),
          ]),
        }),
      );
      continue;
    }
    if (feature.kind !== 'purgingPool') continue;
    requirements.push(
      Object.freeze({
        kind: 'purgingPoolInteraction' as const,
        owner: room.address,
        interactionKey: feature.interactionKey,
        interacted: feature.interacted,
      }),
    );
    if (!feature.interacted) continue;
    requirements.push(
      Object.freeze({
        kind: 'purgingPoolSlots' as const,
        owner: room.address,
        slots: Object.freeze(
          feature.slots.map((slot) =>
            Object.freeze({
              interactionKey: slot.interactionKey,
              slotKey: slot.key,
              traitKey: slot.traitKey,
            }),
          ),
        ),
      }),
    );
  }

  switch (room.roomLocal.kind) {
    case 'none':
    case 'fixed':
    case 'incomingReward':
      return Object.freeze(requirements);
    case 'fields':
      return Object.freeze(requirements);
    case 'ship': {
      const declaration = requireRoom(catalog, room.gameName);
      const wheels = room.roomLocal.wheels.map((wheel) => {
        const attachment = requireRewardWheelAttachment(catalog, declaration, wheel.key);
        return Object.freeze({
          address: wheel.address,
          offerCount: wheel.offerCount,
          offerCountChoices: Object.freeze(
            Array.from(
              { length: attachment.offerCount.max - attachment.offerCount.min + 1 },
              (_, index) => {
                const value = attachment.offerCount.min + index;
                return Object.freeze({ label: String(value), value });
              },
            ),
          ),
          pickChoices: Object.freeze(
            Array.from({ length: wheel.offerCount }, (_, index) => {
              const value = index + 1;
              return Object.freeze({ label: `Offer ${value}`, value });
            }),
          ),
          pickedOfferIndex: wheel.pickedOfferIndex,
          storeKey: wheel.storeKey,
          storeChoices: Object.freeze(
            attachment.reward.storeKeys.map((value) =>
              Object.freeze({ label: workspaceRewardStoreLabel(value), value }),
            ),
          ),
        });
      });
      requirements.push(
        Object.freeze({
          combatPhaseCount: room.roomLocal.combatPhaseCount,
          combatPhaseCountChoices: Object.freeze([
            Object.freeze({ label: 'Intro + 1 combat', value: 2 as const }),
            Object.freeze({ label: 'Intro + 2 combats', value: 3 as const }),
          ]),
          kind: 'shipCombatPhaseCount' as const,
          owner: room.address,
          wheels: Object.freeze(wheels),
        }),
      );
      return Object.freeze(requirements);
    }
    case 'shop': {
      const shop = room.roomLocal;
      if (!shop.materialized) {
        return Object.freeze(requirements);
      }
      return Object.freeze(requirements);
    }
  }
}
