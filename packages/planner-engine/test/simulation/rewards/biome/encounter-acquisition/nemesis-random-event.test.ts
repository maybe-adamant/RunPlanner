import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { foldTraitHistoryEvents, simulateProject } from '@run-planner/engine/simulation';
import { collectTestRequiredItems } from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  replaceNemesisRandomEventInteraction,
} from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';
import { attachTraitHistory } from '../../../../../src/simulation/traits';
import { applyEncounterSettlementTransition } from '../../../../../src/simulation/rewards/biome/encounter-acquisition/encounter-settlement';
import {
  nemesisRandomEventFamilyRefusal,
  nemesisTraitTradeTraitKeys,
} from '../../../../../src/simulation/rewards/biome/encounter-acquisition/nemesis-random-event';
import type { CanonicalAuthoredRoom } from '../../../../../src/simulation/materialization';
import { initializeTestRewardBranch } from '../../../../support/arcana-fear';
import { ordinaryPositionFor } from '../../../../support/route-position';

const owner = createEncounterPhaseAddress(
  createBiomeAddress('Underworld', 'F'),
  { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
  'Encounter',
);

/** The traits the hero holds after taking one trait from each giver, at a rarity. */
function holding(...held: readonly (readonly [string, string, 'Common' | 'Rare' | undefined])[]) {
  return foldTraitHistoryEvents(
    catalog,
    held.map(([giverKey, traitKey, rarity], sequence) => ({
      kind: 'traitOffer' as const,
      owner,
      acquisitionRole: `selection${sequence}`,
      acquisitionPoint: 'encounterInteraction',
      sequence,
      giverKey,
      options: [{ traitKey, ...(rarity === undefined ? {} : { rarity }) }],
      selectedOptionKey: 'option1' as const,
    })),
  );
}

describe('Nemesis random-event family gates', () => {
  it('takes her boons from every shop-aware god giver, Hades included', () => {
    // IsGodTrait(ForShop): GodLoot or TreatAsGodLootByShops (TraitLogic.lua:1547-1560).
    expect(
      catalog.traitGivers.values
        .filter((giver) => giver.shopAwareGodTrait)
        .map((giver) => giver.key)
        .sort(),
    ).toEqual([
      'Aphrodite',
      'Apollo',
      'Ares',
      'Artemis',
      'Athena',
      'Demeter',
      'Dionysus',
      'Hades',
      'Hephaestus',
      'Hera',
      'Hermes',
      'Hestia',
      'Poseidon',
      'Zeus',
    ]);
    const held = holding(
      ['Hades', 'HadesLifestealBoon', 'Rare'],
      ['Artemis', 'SupportingFireBoon', 'Rare'],
    ).equippedTraits;
    expect(nemesisTraitTradeTraitKeys(catalog, held)).toEqual([
      'HadesLifestealBoon',
      'SupportingFireBoon',
    ]);
    expect(nemesisRandomEventFamilyRefusal(catalog, 'traitTrade', held)).toBeUndefined();
  });

  it('prefers a Common boon and refuses her boon trade without a sellable god trait', () => {
    const held = holding(
      ['Apollo', 'ApolloWeaponBoon', 'Rare'],
      ['Hermes', 'HermesWeaponBoon', 'Common'],
    ).equippedTraits;
    expect(nemesisTraitTradeTraitKeys(catalog, held)).toEqual(['HermesWeaponBoon']);
    expect(nemesisRandomEventFamilyRefusal(catalog, 'traitTrade', {})).toEqual({
      kind: 'noSellableGodTrait',
    });
  });

  it('refuses her damage trade while the hero holds the Demeter hit shield', () => {
    const shielded = holding(['Demeter', 'ReserveManaHitShieldBoon', 'Common']).equippedTraits;
    expect(nemesisRandomEventFamilyRefusal(catalog, 'damageTrade', shielded)).toEqual({
      kind: 'heldTrait',
      traitKey: 'ReserveManaHitShieldBoon',
    });
    expect(nemesisRandomEventFamilyRefusal(catalog, 'damageTrade', {})).toBeUndefined();
    for (const family of ['freeItem', 'goldTrade', 'damageContest'] as const)
      expect(nemesisRandomEventFamilyRefusal(catalog, family, shielded)).toBeUndefined();
  });

  it('marks her damage trade at her interaction when the shield is held there', () => {
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
      'Encounter',
    );
    const event = createNemesisRandomEventAddress(phase);
    const project = collectTestRequiredItems(
      replaceNemesisRandomEventInteraction(
        applyProjectCommand(createGoldenFGHIProject(), catalog, {
          kind: 'SelectEncounter',
          phase,
          encounterKey: 'NemesisRandomEvent',
        }),
        event,
        { kind: 'damageTrade', response: 'decline' },
        { rewardType: 'MaxHealthDrop' },
      ),
    );
    const biome = simulateProject(catalog, project).route.biomes.find(
      (entry) => entry.biomeKey === 'F',
    );
    if (biome === undefined || !('history' in biome) || !('snapshot' in biome))
      throw new Error('expected a complete F evaluation');
    const room = biome.snapshot.decisions
      .flatMap((decision) => (decision.kind === 'batch' ? decision.targets : []))
      .map((target) => target.room)
      .find(
        (candidate): candidate is CanonicalAuthoredRoom =>
          candidate.occurrenceId === goldenFOccurrenceId(5, 1),
      );
    if (room === undefined) throw new Error('expected the Nemesis room');
    const interaction = biome.history.events.find(
      (entry) =>
        entry.kind === 'encounterInteractionReached' &&
        entry.interaction === 'encounter' &&
        semanticAddressKey(entry.origin) === semanticAddressKey(room.origin),
    );
    if (interaction?.kind !== 'encounterInteractionReached')
      throw new Error('expected her interaction');
    const view = biome.history.rooms.find(
      (entry) => semanticAddressKey(entry.origin) === semanticAddressKey(room.origin),
    );
    const settle = (traitHistory: ReturnType<typeof holding>) => {
      const base = initializeTestRewardBranch();
      return applyEncounterSettlementTransition({
        catalog,
        snapshot: biome.snapshot,
        routePosition: ordinaryPositionFor(catalog, biome.snapshot),
        event: interaction,
        room,
        view,
        branch: {
          ...base,
          state: Object.freeze({
            ...base.state,
            traitHistory,
            rewardHistory: attachTraitHistory(base.state.rewardHistory, traitHistory),
          }),
        },
        enteredBiomeCount: 1,
        fullRunBiomeCount: catalog.routes.byKey.Underworld!.biomeKeys.length,
        authoredSeaStarDuplicateSiteKeys: new Set(),
        gorgonEligible: false,
        gorgonCandidate: undefined,
        gorgonPhaseBlocked: false,
        gorgonEvaluationBlocked: false,
      });
    };
    const row = createRoomActionAddress(
      goldenFBiome,
      goldenFOccurrenceId(5, 1),
      roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
    );
    // The game draws her event again once her queued damage lines turn ineligible.
    expect(
      settle(holding(['Demeter', 'ReserveManaHitShieldBoon', 'Common'])).findings.map(
        (entry) => entry.finding,
      ),
    ).toEqual([
      expect.objectContaining({
        code: 'nemesisEventUnavailable',
        origin: row,
        evidence: {
          kind: 'damageTrade',
          reason: 'heldTrait',
          traitKey: 'ReserveManaHitShieldBoon',
        },
      }),
    ]);
    expect(settle(holding()).findings).toEqual([]);
  });
});
