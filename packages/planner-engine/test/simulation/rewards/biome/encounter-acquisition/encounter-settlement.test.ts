import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { foldTraitHistoryEvents, simulateProject } from '@run-planner/engine/simulation';
import { loadSurfaceNOPQProject, pOccurrenceId } from '@run-planner/test-fixtures/surface';
import { beforeAll, describe, expect, it } from 'vitest';
import { attachTraitHistory } from '../../../../../src/simulation/traits';
import { applyEncounterSettlementTransition } from '../../../../../src/simulation/rewards/biome/encounter-acquisition/encounter-settlement';
import { initializeTestRewardBranches } from '../../../../support/arcana-fear';

describe('Personal Loan boss checkpoint', () => {
  const project = loadSurfaceNOPQProject();
  let evaluation: ReturnType<typeof simulateProject>;
  beforeAll(() => {
    evaluation = simulateProject(catalog, project);
  });

  it.each([
    { biomeKey: 'P', eventKind: 'bossDefeated', enteredBiomeCount: 3, blocked: true },
    { biomeKey: 'P', eventKind: 'encounterCompleted', enteredBiomeCount: 3, blocked: false },
    { biomeKey: 'Q', eventKind: 'bossDefeated', enteredBiomeCount: 4, blocked: false },
  ] as const)(
    '$biomeKey $eventKind applies payout block: $blocked',
    ({ biomeKey, eventKind, enteredBiomeCount, blocked }) => {
      const biome = evaluation.route.biomes.find((entry) => entry.biomeKey === biomeKey);
      if (biome?.authoring !== 'complete' || !('snapshot' in biome))
        throw new Error('expected a complete Surface biome');
      const room = biome.snapshot.fixedRoomLinks.find(
        (link) =>
          catalog.rooms.byKey[link.target.gameName]?.mode.kind === 'authored' &&
          link.target.gameName === `${biomeKey}_Boss01`,
      )?.target;
      if (room === undefined) throw new Error('expected the fixed boss room');
      const event = biome.history.events.find(
        (entry) =>
          entry.kind === eventKind &&
          semanticAddressKey(entry.origin) === semanticAddressKey(room.origin),
      );
      if (event?.kind !== 'bossDefeated' && event?.kind !== 'encounterCompleted')
        throw new Error('expected the native boss lifecycle event');
      const traitHistory = foldTraitHistoryEvents(catalog, [
        {
          kind: 'traitOffer',
          owner: createEncounterPhaseAddress(
            createBiomeAddress('Surface', 'P'),
            {
              kind: 'occurrence',
              occurrenceId: pOccurrenceId('P_Story01', 7, 1),
            },
            'Encounter',
          ),
          acquisitionRole: 'selection',
          acquisitionPoint: 'encounterInteraction',
          sequence: 0,
          giverKey: 'Dionysus',
          options: [{ traitKey: 'BankBoon', rarity: 'Common' }],
          selectedOptionKey: 'option1',
        },
      ]);
      const base = initializeTestRewardBranches()[0]!;
      const branch = {
        ...base,
        state: Object.freeze({
          ...base.state,
          traitHistory: traitHistory,
          rewardHistory: attachTraitHistory(base.state.rewardHistory, traitHistory),
        }),
      };
      const result = applyEncounterSettlementTransition({
        catalog,
        snapshot: biome.snapshot,
        event,
        room,
        view: undefined,
        branches: [branch],
        enteredBiomeCount,
        fullRunBiomeCount: catalog.routes.byKey.Surface!.biomeKeys.length,
        authoredSeaStarDuplicateSiteKeys: new Set(),
        gorgonEligible: false,
        gorgonCandidate: undefined,
        gorgonPhaseBlocked: false,
        gorgonEvaluationBlocked: false,
      });
      const history = result.branches[0]?.state.traitHistory;
      expect(history?.equippedTraits.BankBoon).toMatchObject({
        traitKey: 'BankBoon',
        rarity: 'Common',
      });
      expect(history?.equippedTraits.BankBoon?.rarityBlockedInRun === true).toBe(blocked);
      expect(history?.events.filter((entry) => entry.kind === 'rarityBlock')).toHaveLength(
        blocked ? 1 : 0,
      );
      expect(history?.godBoonRarityCounts).toEqual(traitHistory.godBoonRarityCounts);
      expect(history?.elementCounts).toEqual(traitHistory.elementCounts);
    },
  );
});
